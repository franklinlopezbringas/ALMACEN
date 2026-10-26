using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using GymFlow.Infrastructure.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Xunit;
namespace GymFlow.Tests;
public sealed class ReceptionClosureTests
{
    public static bool IsConfigured=>SqlServerIntegrationTests.IsConfigured;
    private sealed record Tenant(long OrganizationId):ICurrentTenant { public bool IsResolved=>OrganizationId>0; }
    private sealed class TestClock(DateTime now):IClock {public DateTime UtcNow {get;set;}=now;}
    [Theory(Skip="Set GYMFLOW_TEST_CONNECTION for SQL integration.",SkipUnless=nameof(IsConfigured))]
    [InlineData("handoff") ]
    [InlineData("handoff-cash") ]
    [InlineData("handoff-cancel") ]
    [InlineData("handoff-tenant") ]
    [InlineData("handoff-rowversion") ]
    [InlineData("return-full") ]
    [InlineData("return-partial") ]
    [InlineData("return-fraction") ]
    [InlineData("return-mixed") ]
    [InlineData("return-limits") ]
    [InlineData("return-tenant") ]
    [InlineData("class-cancel") ]
    [InlineData("class-attend") ]
    [InlineData("class-noshow") ]
    [InlineData("exception") ]
    [InlineData("incident") ]
    [InlineData("messaging") ]
    public async Task ClosurePreservesStateAndTenantBoundaries(string area)
    {
        var ct = TestContext.Current.CancellationToken;
        await using var connection = new SqlConnection(Environment.GetEnvironmentVariable("GYMFLOW_TEST_CONNECTION"));
        await connection.OpenAsync(ct);
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        await using var command = connection.CreateCommand(); command.Transaction = tx;
        command.CommandText = """
            INSERT core.Organizations(LegalName,TradeName) VALUES(N'Recepción rollback',N'Recepción rollback');
            DECLARE @org bigint=SCOPE_IDENTITY();
            INSERT core.Organizations(LegalName,TradeName) VALUES(N'Aislamiento rollback',N'Aislamiento rollback');
            DECLARE @other bigint=SCOPE_IDENTITY();
            INSERT core.Branches(OrganizationId,Code,Name) VALUES(@org,'CENTRO',N'Sede Centro');
            DECLARE @branch bigint=SCOPE_IDENTITY();
            DECLARE @email nvarchar(320)=CONCAT(NEWID(),'@example.test');
            INSERT security.Users(Email,NormalizedEmail,Status) VALUES(@email,UPPER(@email),'ACTIVE');
            DECLARE @actor bigint=SCOPE_IDENTITY();
            INSERT core.People(OrganizationId,FirstName,LastName) VALUES(@org,N'Elena',N'Campos');
            DECLARE @person bigint=SCOPE_IDENTITY();
            INSERT core.Members(OrganizationId,PersonId,MemberCode) VALUES(@org,@person,'SOC-ELENA');
            DECLARE @member bigint=SCOPE_IDENTITY();
            INSERT core.Employees(OrganizationId,PersonId,EmployeeCode,JobTitle,HireDate) VALUES(@org,@person,'EMP-ELENA','Reception','2026-01-01');
            DECLARE @employee bigint=SCOPE_IDENTITY();
            INSERT security.UserOrganizations(UserId,OrganizationId,PersonId) VALUES(@actor,@org,@person);
            INSERT finance.CashRegisters(OrganizationId,BranchId,Code,Name) VALUES(@org,@branch,'MOSTRADOR',N'Caja Mostrador');
            DECLARE @register bigint=SCOPE_IDENTITY();
            INSERT finance.PaymentMethods(OrganizationId,Code,Name,IsCash,IsOnline) VALUES(@org,'CASH',N'Efectivo',1,0);
            DECLARE @cash bigint=SCOPE_IDENTITY();
            INSERT finance.PaymentMethods(OrganizationId,Code,Name,IsCash,IsOnline) VALUES(@org,'YAPE',N'Yape',0,0);
            DECLARE @yape bigint=SCOPE_IDENTITY();
            INSERT finance.PaymentMethods(OrganizationId,Code,Name,IsCash,IsOnline) VALUES(@org,'CARD',N'Tarjeta',0,0);
            DECLARE @card bigint=SCOPE_IDENTITY();
            INSERT finance.Receivables(OrganizationId,MemberId,Description,TotalAmount,CurrencyCode,DueDate) VALUES(@org,@member,'Membresía',120,'PEN','2026-10-21');
            DECLARE @debt bigint=SCOPE_IDENTITY();
            INSERT commerce.Products(OrganizationId,Sku,Name,SalePrice,CurrencyCode) VALUES(@org,'BOTELLA',N'Botella deportiva',35,'PEN');
            DECLARE @product bigint=SCOPE_IDENTITY();
            INSERT commerce.InventoryBalances(OrganizationId,BranchId,ProductId,QuantityOnHand) VALUES(@org,@branch,@product,10);
            INSERT commerce.InventoryMovements(OrganizationId,BranchId,ProductId,MovementType,Quantity,Reason) VALUES(@org,@branch,@product,'ADJUSTMENT_IN',10,'Opening fixture');
            SELECT @org,@other,@branch,@actor,@member,@employee,@register,@cash,@yape,@card,@debt,@product;
            """;
        var ids = new long[12];
        await using (var reader = await command.ExecuteReaderAsync(ct))
        { Assert.True(await reader.ReadAsync(ct)); for (var i = 0; i < ids.Length; i++) ids[i] = reader.GetInt64(i); }
        var org = ids[0]; var branch = ids[2]; var actor = ids[3]; var member = ids[4];
        var tenant = new Tenant(org);
        var options = new DbContextOptionsBuilder<GymFlowDbContext>().UseSqlServer(connection).Options;
        await using var db = new GymFlowDbContext(options, tenant); await db.Database.UseTransactionAsync(tx, ct);
        var clock = new SystemClock(); var reads = new ReceptionService(db, tenant, clock);
        var cashService = new CashService(db, tenant, clock); var payments = new PaymentService(db, tenant, clock);
        var shift = await cashService.OpenAsync(new(ids[6], ids[5], 100, "Apertura"), actor, ct);

        var handoffs=new HandoffService(db,tenant,clock);
        if(area.StartsWith("handoff",StringComparison.Ordinal))
        {
            var request=new CreateHandoffRequest(Guid.NewGuid(),branch,null,area=="handoff-cash"?shift.CashShiftId:null,"Seguimiento pendiente","Contactar al socio");
            var row=await handoffs.CreateAsync(request,actor,ct);
            Assert.Equal(row.ShiftHandoffId,(await handoffs.CreateAsync(request,actor,ct)).ShiftHandoffId);
            Assert.Equal(1,(await handoffs.ListAsync(actor,branch,1,1,ct)).Total);
            if(area=="handoff-tenant")
            {
                await using var foreign=new GymFlowDbContext(options,new Tenant(ids[1]));await foreign.Database.UseTransactionAsync(tx,ct);
                await Assert.ThrowsAsync<UnauthorizedAccessException>(()=>new HandoffService(foreign,new Tenant(ids[1]),clock).TransitionAsync(row.ShiftHandoffId,new(row.RowVersion),actor,true,ct));
            }
            else if(area=="handoff-rowversion") await Assert.ThrowsAsync<DbUpdateConcurrencyException>(()=>handoffs.TransitionAsync(row.ShiftHandoffId,new(new byte[8]),actor,true,ct));
            else
            {
                var result=await handoffs.TransitionAsync(row.ShiftHandoffId,new(row.RowVersion),actor,area!="handoff-cancel",ct);
                Assert.Equal(area=="handoff-cancel"?"CANCELLED":"ACKNOWLEDGED",result.Status);
                await Assert.ThrowsAsync<DbUpdateConcurrencyException>(()=>handoffs.TransitionAsync(row.ShiftHandoffId,new(row.RowVersion),actor,false,ct));
            }
            Assert.Equal("OPEN",(await db.CashShifts.SingleAsync(ct)).Status);
        }
        else if(area.StartsWith("return",StringComparison.Ordinal))
        {
            var product=await db.Products.AsNoTracking().SingleAsync(ct);
            var pos=new PosService(db,tenant,payments);
            await pos.SellAsync(new(Guid.NewGuid(),branch,member,shift.CashShiftId,"PEN",[new(product.PublicId,2,35)],[new(ids[7],30,null,null),new(ids[8],40,null,null)]),actor,ct);
            var service=new ReturnsService(db,tenant);
            var line=Assert.Single((await service.LinesAsync(null,1,10,ct)).Items);
            var quantity=area=="return-fraction"?0.001m:area=="return-partial"?1m:2m;
            var request=new ReturnRequest(Guid.NewGuid(),line.OrderItemId,quantity,"Cambio solicitado");
            var row=await service.RequestAsync(request,actor,ct);
            Assert.Equal(row.ProductReturnId,(await service.RequestAsync(request,actor,ct)).ProductReturnId);
            await service.ReviewAsync(row.ProductReturnId,new("APPROVED"),actor,ct);
            var sources=await service.SourcesAsync(row.ProductReturnId,ct);
            if(area=="return-tenant")
            {
                await using var foreign=new GymFlowDbContext(options,new Tenant(ids[1]));await foreign.Database.UseTransactionAsync(tx,ct);
                await Assert.ThrowsAsync<KeyNotFoundException>(()=>new ReturnsService(foreign,new Tenant(ids[1])).SourcesAsync(row.ProductReturnId,ct));
            }
            else if(area=="return-limits")
                await Assert.ThrowsAsync<InvalidOperationException>(()=>service.ProcessAsync(row.ProductReturnId,new(Guid.NewGuid(),shift.CashShiftId,[new(sources.Single(s=>s.IsCash).PaymentSplitId,70)]),actor,ct));
            else
            {
                var splits=quantity<2?[new RefundSplitInput(sources.Single(s=>!s.IsCash).PaymentSplitId,quantity*35)]:new RefundSplitInput[]{new(sources.Single(s=>s.IsCash).PaymentSplitId,30),new(sources.Single(s=>!s.IsCash).PaymentSplitId,40)};
                var process=new ReturnProcessRequest(Guid.NewGuid(),quantity<2?null:shift.CashShiftId,splits);
                Assert.Equal("PROCESSED",(await service.ProcessAsync(row.ProductReturnId,process,actor,ct)).Status);
                await service.ProcessAsync(row.ProductReturnId,process,actor,ct);
                Assert.Equal(8+quantity,await db.InventoryBalances.AsNoTracking().Select(b=>b.QuantityOnHand).SingleAsync(ct));
                Assert.Equal(quantity<2?0:30,await db.CashMovements.Where(m=>m.MovementType=="REFUND").SumAsync(m=>m.Amount,ct));
                Assert.Equal(quantity*35,await db.Database.SqlQuery<decimal>($"SELECT COALESCE(SUM(Amount),0) AS Value FROM finance.Refunds WHERE OrganizationId={org}").SingleAsync(ct));
                Assert.Equal(quantity<2?"PARTIALLY_REFUNDED":"REFUNDED",await db.Payments.AsNoTracking().Select(p=>p.Status).SingleAsync(ct));
            }
        }
        else if(area.StartsWith("class",StringComparison.Ordinal))
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT training.Classes(OrganizationId,Code,Name,DefaultCapacity,DurationMinutes) VALUES({org},'YOGA','Yoga',1,60)",ct);
            var cls=await db.Classes.SingleAsync(ct);var starts=DateTime.UtcNow.AddHours(1);
            var session=new GymFlow.Domain.Entities.ClassSession {OrganizationId=org,ClassId=cls.ClassId,BranchId=branch,Capacity=1,StartsAtUtc=starts,EndsAtUtc=starts.AddHours(1)};
            db.ClassSessions.Add(session);await db.SaveChangesAsync(ct);
            var reservation=new GymFlow.Domain.Entities.ClassReservation {OrganizationId=org,ClassSessionId=session.ClassSessionId,MemberId=member,ReservedAtUtc=DateTime.UtcNow};db.ClassReservations.Add(reservation);await db.SaveChangesAsync(ct);await db.Entry(reservation).ReloadAsync(ct);
            var at=area=="class-cancel"?starts.AddMinutes(-1):area=="class-attend"?starts.AddMinutes(1):starts.AddHours(2);
            if(area=="class-cancel")
            {
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT core.People(OrganizationId,FirstName,LastName) VALUES({org},'Marta','Lagos'); DECLARE @p bigint=SCOPE_IDENTITY(); INSERT core.Members(OrganizationId,PersonId,MemberCode) VALUES({org},@p,'WAIT'); DECLARE @m bigint=SCOPE_IDENTITY(); INSERT training.ClassReservations(OrganizationId,ClassSessionId,MemberId,Status,WaitlistPosition) VALUES({org},{session.ClassSessionId},@m,'WAITLISTED',1)",ct);
            }
            if(area=="class-cancel")
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT core.People(OrganizationId,FirstName,LastName) VALUES({org},'Clara','Soto'); DECLARE @p bigint=SCOPE_IDENTITY(); INSERT core.Members(OrganizationId,PersonId,MemberCode) VALUES({org},@p,'WAIT2'); DECLARE @m bigint=SCOPE_IDENTITY(); INSERT training.ClassReservations(OrganizationId,ClassSessionId,MemberId,Status,WaitlistPosition) VALUES({org},{session.ClassSessionId},@m,'WAITLISTED',2)",ct);
            var action=area=="class-cancel"?"CANCELLED":area=="class-attend"?"ATTENDED":"NO_SHOW";
            var request=new ClassTransitionRequest(Guid.NewGuid(),action,reservation.ReservedAtUtc);
            var invalidClock=action=="CANCELLED"?starts.AddMinutes(1):action=="ATTENDED"?starts.AddMinutes(-1):starts.AddMinutes(1);
            await Assert.ThrowsAsync<InvalidOperationException>(()=>new ClassOperationsService(db,tenant,new TestClock(invalidClock)).TransitionAsync(reservation.ClassReservationId,request with {RequestId=Guid.NewGuid()},actor,ct));
            var service=new ClassOperationsService(db,tenant,new TestClock(at));
            await service.TransitionAsync(reservation.ClassReservationId,request,actor,ct);await service.TransitionAsync(reservation.ClassReservationId,request,actor,ct);
            Assert.Equal(action,reservation.Status);
            if(action=="CANCELLED")
            {
                Assert.Equal(1,await db.ClassReservations.CountAsync(r=>r.Status=="CONFIRMED",ct));
                Assert.Equal("WAIT",await (from r in db.ClassReservations join m in db.Members on r.MemberId equals m.MemberId where r.Status=="CONFIRMED" select m.MemberCode).SingleAsync(ct));
                Assert.Equal("WAIT2",await (from r in db.ClassReservations join m in db.Members on r.MemberId equals m.MemberId where r.Status=="WAITLISTED" select m.MemberCode).SingleAsync(ct));
            }
            if(action=="ATTENDED") Assert.NotNull(reservation.AttendedAtUtc);
        }
        else if(area=="exception")
        {
            var service=new AccessExceptionService(db,tenant,clock);
            var row=await service.RequestAsync(new(Guid.NewGuid(),member,"Validacion operativa",DateTime.UtcNow.AddMinutes(-1),DateTime.UtcNow.AddHours(1)),actor,ct);
            await service.ReviewAsync(row.AccessExceptionId,new("APPROVED"),actor,ct);
            Assert.Empty(await db.AttendanceEvents.ToListAsync(ct));
            Assert.True((await new AccessService(db,tenant,clock).CheckInAsync(new(member,branch,"MANUAL",null),actor,ct)).Allowed);
            Assert.Single(await db.AttendanceEvents.ToListAsync(ct));
            Assert.Equal(actor,Assert.Single((await service.ListAsync(member,1,10,ct)).Items).ReviewedByUserId);
        }
        else
        {
            var service=new SupportService(db,tenant);
            var request=new IncidentRequest(Guid.NewGuid(),member,"ACCESS","NORMAL","Consultar acceso","Socio solicita revisar acceso.");
            var id=await service.CreateAsync(request,actor,ct);Assert.Equal(id,await service.CreateAsync(request,actor,ct));
            var incident=Assert.Single((await service.IncidentsAsync(actor,1,10,ct)).Items);Assert.Equal(member,incident.MemberId);
            var conversation=Assert.Single((await service.ConversationsAsync(actor,1,10,ct)).Items);
            if(area=="messaging")
            {
                var message=new MessageRequest(Guid.NewGuid(),"Consulta recibida.");
                var sent=await service.SendAsync(conversation.ConversationId,message,actor,ct);Assert.Equal(sent,await service.SendAsync(conversation.ConversationId,message,actor,ct));
                Assert.Equal(2,(await service.MessagesAsync(conversation.ConversationId,actor,1,10,ct)).Total);
                await Assert.ThrowsAsync<KeyNotFoundException>(()=>service.MessagesAsync(conversation.ConversationId,long.MaxValue,1,10,ct));
            }
            await using var foreign=new GymFlowDbContext(options,new Tenant(ids[1]));await foreign.Database.UseTransactionAsync(tx,ct);
            Assert.Empty((await new SupportService(foreign,new Tenant(ids[1])).IncidentsAsync(actor,1,10,ct)).Items);
        }
        Assert.True(await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM audit.AuditLogs WHERE OrganizationId={org}").SingleAsync(ct)>0);
        await tx.RollbackAsync(ct);
    }
}
