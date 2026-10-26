using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using GymFlow.Infrastructure.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GymFlow.Tests;

public sealed class ReceptionIntegrationTests
{
    public static bool IsConfigured => SqlServerIntegrationTests.IsConfigured;
    private sealed record Tenant(long OrganizationId) : ICurrentTenant { public bool IsResolved => OrganizationId > 0; }

    [Theory(Skip = "Set GYMFLOW_TEST_CONNECTION for real SQL integration.", SkipUnless = nameof(IsConfigured))]
    [InlineData("partial-mixed")]
    [InlineData("cash")]
    [InlineData("yape")]
    [InlineData("card")]
    [InlineData("pos")]
    [InlineData("access")]
    [InlineData("tenant")]
    [InlineData("pagination")]
    [InlineData("member-renew")]
    public async Task ReceptionPreservesFinancialAndAccessInvariants(string area)
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
        switch (area)
        {
            case "partial-mixed":
            {
                var request = new RegisterPaymentRequest(member, null, branch, 50, "PEN", "RECEPTION", shift.CashShiftId,
                    [new(ids[7],20,null,null),new(ids[8],30,"Yape confirmado",null)], [new(ids[10],50)], Guid.NewGuid());
                var first = await payments.RegisterAsync(request, actor, ct);
                var replay = await payments.RegisterAsync(request, actor, ct);
                Assert.Equal(first.PublicId, replay.PublicId);
                Assert.Equal(70, Assert.Single((await reads.DebtsAsync(member,1,10,ct)).Items).BalanceAmount);
                await payments.RegisterAsync(new(member,null,branch,70,"PEN","RECEPTION",shift.CashShiftId,
                    [new(ids[7],20,null,null),new(ids[9],50,null,null)],[new(ids[10],70)],Guid.NewGuid()),actor,ct);
                Assert.Empty((await reads.DebtsAsync(member,1,10,ct)).Items);
                Assert.Equal(2, await db.Payments.CountAsync(ct));
                Assert.Equal(40, await db.CashMovements.SumAsync(m=>m.Amount,ct));
                var receipt = await reads.ReceiptAsync(first.PublicId,ct);
                Assert.Equal(2,receipt.Splits.Count); Assert.Equal(20,receipt.Splits.Where(s=>s.IsCash).Sum(s=>s.Amount));
                var closed = await cashService.CloseAsync(shift.CashShiftId,new(140,"Cierre conciliado"),actor,ct);
                Assert.Equal(0,closed.DifferenceAmount); Assert.Equal("CLOSED",closed.Status);
                break;
            }
            case "cash": case "yape": case "card":
            {
                var method = area=="cash"?ids[7]:area=="yape"?ids[8]:ids[9];
                await payments.RegisterAsync(new(member,null,branch,50,"PEN","RECEPTION",area=="cash"?shift.CashShiftId:null,
                    [new(method,50,null,null)],[new(ids[10],50)],Guid.NewGuid()),actor,ct);
                Assert.Equal(area=="cash"?50:0,await db.CashMovements.SumAsync(m=>m.Amount,ct));
                var current=Assert.Single((await reads.ShiftsAsync(actor,1,10,ct)).Items);
                Assert.Equal(area=="cash"?150:100,current.ExpectedAmount);
                break;
            }
            case "pos":
            {
                var product=await db.Products.AsNoTracking().SingleAsync(ct);
                var pos=new PosService(db,tenant,payments);
                var request=new PosRequest(Guid.NewGuid(),branch,member,shift.CashShiftId,"PEN",[new(product.PublicId,2,35)],[new(ids[7],30,null,null),new(ids[8],40,null,null)]);
                var sale=await pos.SellAsync(request,actor,ct);
                Assert.Equal(sale,await pos.SellAsync(request,actor,ct));
                Assert.Equal(8,await db.InventoryBalances.AsNoTracking().Select(b=>b.QuantityOnHand).SingleAsync(ct));
                Assert.Equal(30,await db.CashMovements.SumAsync(m=>m.Amount,ct));
                Assert.Single((await reads.ReceiptAsync(sale.Payment.PublicId,ct)).Items);
                Assert.Equal(1,await db.Payments.CountAsync(ct));
                Assert.Equal(2,await db.Database.SqlQuery<decimal>($"SELECT COALESCE(SUM(Quantity),0) AS Value FROM commerce.InventoryMovements WHERE OrganizationId={org} AND MovementType='SALE_OUT'").SingleAsync(ct));
                await Assert.ThrowsAsync<InvalidOperationException>(()=>pos.SellAsync(request with { Items=[new(product.PublicId,1,35)] },actor,ct));
                break;
            }
            case "access":
            {
                var access=new AccessService(db,tenant,clock);
                var denied=await access.CheckInAsync(new(member,branch,"MANUAL",null),actor,ct);
                Assert.False(denied.Allowed);
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT access.AccessExceptions(OrganizationId,MemberId,Reason,ValidFromUtc,ValidToUtc,Status,RequestedByUserId,ReviewedByUserId,ReviewedAtUtc) VALUES({org},{member},'Authorized fixture',DATEADD(hour,-1,SYSUTCDATETIME()),DATEADD(hour,1,SYSUTCDATETIME()),'APPROVED',{actor},{actor},SYSUTCDATETIME())",ct);
                Assert.Equal(0,await db.AttendanceEvents.CountAsync(a=>a.Result!="DENIED",ct));
                var admitted=await access.CheckInAsync(new(member,branch,"MANUAL",null),actor,ct);
                Assert.True(admitted.Allowed); Assert.Equal("EXCEPTION",admitted.Result);
                var events=await reads.AccessAsync(member,branch,null,null,1,1,ct);
                Assert.Equal(2,events.Total); Assert.Single(events.Items); Assert.Equal("EXCEPTION",events.Items[0].Result);
                var credential=Guid.NewGuid().ToString("N");
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT access.AccessCredentials(OrganizationId,MemberId,CredentialType,ExternalCredentialId) VALUES({org},{member},'QR',{credential})",ct);
                Assert.Equal(member,await reads.ResolveQrAsync(credential,ct));
                Assert.Equal(2,await db.AttendanceEvents.CountAsync(ct));
                await using var other=new GymFlowDbContext(options,new Tenant(ids[1]));await other.Database.UseTransactionAsync(tx,ct);
                await Assert.ThrowsAsync<KeyNotFoundException>(()=>new ReceptionService(other,new Tenant(ids[1]),clock).ResolveQrAsync(credential,ct));
                break;
            }
            case "tenant":
            {
                await using var other=new GymFlowDbContext(options,new Tenant(ids[1]));await other.Database.UseTransactionAsync(tx,ct);
                var foreign=new ReceptionService(other,new Tenant(ids[1]),clock);
                Assert.Empty((await foreign.ShiftsAsync(actor,1,10,ct)).Items);
                await Assert.ThrowsAsync<KeyNotFoundException>(()=>foreign.DebtsAsync(member,1,10,ct));
                await Assert.ThrowsAsync<KeyNotFoundException>(()=>foreign.AccessAsync(member,null,null,null,1,10,ct));
                await Assert.ThrowsAsync<KeyNotFoundException>(()=>foreign.MovementsAsync(actor,shift.CashShiftId,1,10,ct));
                await Assert.ThrowsAsync<KeyNotFoundException>(()=>reads.RequireOwnShiftAsync(actor+100000,shift.CashShiftId,ct));
                var p=await db.Products.AsNoTracking().SingleAsync(ct);
                await Assert.ThrowsAsync<KeyNotFoundException>(()=>new PosService(other,new Tenant(ids[1]),new PaymentService(other,new Tenant(ids[1]),clock)).SellAsync(new(Guid.NewGuid(),branch,null,null,"PEN",[new(p.PublicId,1,35)],[new(ids[8],35,null,null)]),actor,ct));
                break;
            }
            case "member-renew":
            {
                var catalog=new AdminCatalogService(db,tenant,clock);
                await catalog.CreatePlanAsync(new(new("FLOW","Plan Flow",null,true,"ACTIVE",null),new(120,"PEN",1,"MONTH",0,null)),actor,ct);
                var version=(await catalog.PlansAsync(null,"ACTIVE",1,10,ct)).Items[0].PlanVersionId!.Value;
                var service=new MembershipService(db,tenant,clock);
                var first=await service.CreateAsync(new(member,version,branch,DateOnly.FromDateTime(DateTime.UtcNow),"RECEPTION",null,Guid.NewGuid()),actor,ct);
                var request=new CreateMembershipRequest(member,version,branch,first.EndDate.AddDays(1),"RECEPTION",first.MembershipId,Guid.NewGuid());
                var next=await service.CreateAsync(request,actor,ct);
                Assert.Equal(next,await service.CreateAsync(request,actor,ct));
                Assert.Equal(first.MembershipId,(await db.Memberships.AsNoTracking().SingleAsync(m=>m.MembershipId==next.MembershipId,ct)).PreviousMembershipId);
                Assert.Equal(2,await db.Memberships.CountAsync(ct));
                Assert.Equal(120,(await db.Memberships.AsNoTracking().SingleAsync(m=>m.MembershipId==first.MembershipId,ct)).ContractedPrice);
                var detail=await new MemberService(db,tenant,clock).GetAsync((await db.Members.AsNoTracking().SingleAsync(ct)).PublicId,ct);
                Assert.Equal(member,detail!.MemberId);Assert.NotNull(detail.RowVersion);
                await reads.UpdateMemberAsync(detail.PublicId,new("Elena","Campos",null,"elena@example.test",detail.RowVersion),actor,ct);
                await Assert.ThrowsAsync<DbUpdateConcurrencyException>(()=>reads.UpdateMemberAsync(detail.PublicId,new("Elena","Campos",null,null,detail.RowVersion),actor,ct));
                break;
            }
            case "pagination":
            {
                var first=await reads.MethodsAsync(1,1,ct); var second=await reads.MethodsAsync(2,1,ct);
                Assert.Equal(3,first.Total); Assert.NotEqual(first.Items[0].PaymentMethodId,second.Items[0].PaymentMethodId);
                Assert.Equal(ids[5],(await reads.ContextAsync(actor,ct)).EmployeeId);
                Assert.Single((await reads.RegistersAsync(1,1,ct)).Items);
                Assert.DoesNotContain(db.ChangeTracker.Entries(), e=>e.Entity is GymFlow.Domain.Entities.PaymentMethod);
                break;
            }
        }
        Assert.True(await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM audit.AuditLogs WHERE OrganizationId={org} AND UserId={actor} AND ISJSON(AfterJson)=1").SingleAsync(ct)>0);
        await tx.RollbackAsync(ct);
    }
}
