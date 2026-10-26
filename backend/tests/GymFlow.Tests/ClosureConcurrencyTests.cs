using System.Data.Common;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using GymFlow.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;
namespace GymFlow.Tests;
public sealed class ClosureConcurrencyTests
{
    public static bool IsConfigured=>SqlServerIntegrationTests.IsConfigured;
    private sealed record Tenant(long OrganizationId):ICurrentTenant {public bool IsResolved=>OrganizationId>0;}
    private sealed class InventoryFailure:DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command,CommandEventData eventData,InterceptionResult<int> result,CancellationToken cancellationToken=default)
        {
            if(command.CommandText.Contains("SET QuantityOnHand=QuantityOnHand+",StringComparison.Ordinal)) throw new InvalidOperationException("Injected inventory failure after refund and cash.");
            return ValueTask.FromResult(result);
        }
    }
    [Fact(Skip="Set GYMFLOW_TEST_CONNECTION for independent SQL connections.",SkipUnless=nameof(IsConfigured))]
    public async Task RefundRollbackConcurrentRequestsAndHandoffRowVersionPreserveHistory()
    {
        var ct=TestContext.Current.CancellationToken;
        var options=new DbContextOptionsBuilder<GymFlowDbContext>().UseSqlServer(Environment.GetEnvironmentVariable("GYMFLOW_TEST_CONNECTION")).Options;
        await using var setup=new GymFlowDbContext(options,new Tenant(0));
        var org=(await setup.Database.SqlQuery<long>($"INSERT core.Organizations(LegalName,TradeName,Status) OUTPUT INSERTED.OrganizationId AS Value VALUES('Pruebas aisladas de recepción','Pruebas aisladas de recepción','INACTIVE')").ToListAsync(ct)).Single();
        var tenant=new Tenant(org);
        GymFlowDbContext Create()=>new(options,tenant);
        await using var db=Create();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            DECLARE @org bigint={org};
            INSERT core.Branches(OrganizationId,Code,Name) VALUES(@org,'CENTRO','Sede Centro');
            DECLARE @branch bigint=SCOPE_IDENTITY();
            INSERT core.People(OrganizationId,FirstName,LastName) VALUES(@org,'Elena','Campos');
            DECLARE @person bigint=SCOPE_IDENTITY();
            INSERT core.Members(OrganizationId,PersonId,MemberCode) VALUES(@org,@person,'SOC-ELENA');
            DECLARE @member bigint=SCOPE_IDENTITY();
            INSERT core.Employees(OrganizationId,PersonId,EmployeeCode,JobTitle,HireDate) VALUES(@org,@person,'MOSTRADOR','Reception','2026-01-01');
            DECLARE @employee bigint=SCOPE_IDENTITY();
            INSERT finance.CashRegisters(OrganizationId,BranchId,Code,Name) VALUES(@org,@branch,'CAJA','Caja de pruebas');
            INSERT finance.PaymentMethods(OrganizationId,Code,Name,IsCash,IsOnline) VALUES(@org,'CASH','Efectivo',1,0),(@org,'YAPE','Yape',0,0);
            INSERT finance.Receivables(OrganizationId,MemberId,Description,TotalAmount,CurrencyCode,DueDate) VALUES(@org,@member,'Contrato de prueba',100,'PEN','2026-10-21');
            INSERT commerce.Products(OrganizationId,Sku,Name,SalePrice,CurrencyCode,IsPublic) VALUES(@org,'BOTELLA','Botella deportiva',35,'PEN',0),(@org,'TOALLA','Toalla de entrenamiento',20,'PEN',0);
            INSERT commerce.InventoryBalances(OrganizationId,BranchId,ProductId,QuantityOnHand) SELECT @org,@branch,ProductId,1 FROM commerce.Products WHERE OrganizationId=@org;
            INSERT commerce.InventoryMovements(OrganizationId,BranchId,ProductId,MovementType,Quantity,Reason) SELECT @org,@branch,ProductId,'ADJUSTMENT_IN',1,'Fixture aislado' FROM commerce.Products WHERE OrganizationId=@org;
            """,ct);
        // No usable credentials or role assignments are provisioned for this fixture.
        var email=Guid.NewGuid().ToString("N")+"@example.test";
        var actor=(await db.Database.SqlQuery<long>($"INSERT security.Users(Email,NormalizedEmail,Status) OUTPUT INSERTED.UserId AS Value VALUES({email},{email.ToUpperInvariant()},'DISABLED')").ToListAsync(ct)).Single();
        var branch=await db.Branches.Select(b=>b.BranchId).SingleAsync(ct);
        var member=await db.Members.Select(m=>m.MemberId).SingleAsync(ct);
        var register=await db.CashRegisters.Select(r=>r.CashRegisterId).SingleAsync(ct);
        var employee=await db.Employees.Select(e=>e.EmployeeId).SingleAsync(ct);
        var methods=await db.PaymentMethods.ToListAsync(ct);
        var cash=methods.Single(m=>m.IsCash).PaymentMethodId;var yape=methods.Single(m=>!m.IsCash).PaymentMethodId;
        var products=await db.Products.AsNoTracking().OrderBy(p=>p.ProductId).ToListAsync(ct);
        var debt=await db.Receivables.Select(r=>r.ReceivableId).SingleAsync(ct);
        var clock=new SystemClock();
        async Task<CashShiftResult?> Open()
        {
            await using var context=Create();
            try{return await new CashService(context,tenant,clock).OpenAsync(new(register,employee,100,"Pruebas concurrentes"),actor,ct);}
            catch(InvalidOperationException e) when(e.Message=="This cash register already has an open shift."){return null;}
        }
        var openings=await Task.WhenAll(Open(),Open());
        var shift=Assert.Single(openings,x=>x is not null)!;
        Assert.Equal(1,await db.CashShifts.CountAsync(s=>s.Status=="OPEN",ct));

        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT security.UserOrganizations(OrganizationId,UserId,PersonId) SELECT {org},{actor},PersonId FROM core.Employees WHERE OrganizationId={org} AND EmployeeId={employee}",ct);
        var sale=await new PosService(db,tenant,new PaymentService(db,tenant,clock)).SellAsync(new(Guid.NewGuid(),branch,member,shift.CashShiftId,"PEN",[new(products[0].PublicId,1,35)],[new(cash,10,null,null),new(yape,25,null,null)]),actor,ct);
        var service=new ReturnsService(db,tenant);var line=Assert.Single((await service.LinesAsync(sale.OrderNumber,1,10,ct)).Items);
        var request=new ReturnRequest(Guid.NewGuid(),line.OrderItemId,1,"Cambio en mostrador");
        async Task<ReturnItem> Request(ReturnRequest r){await using var context=Create();return await new ReturnsService(context,tenant).RequestAsync(r,actor,ct);}
        var rows=await Task.WhenAll(Request(request),Request(request));Assert.Equal(rows[0].ProductReturnId,rows[1].ProductReturnId);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Request(request with {RequestId=Guid.NewGuid()}));
        var id=rows[0].ProductReturnId;await service.ReviewAsync(id,new("APPROVED"),actor,ct);
        var sources=await service.SourcesAsync(id,ct);
        var process=new ReturnProcessRequest(Guid.NewGuid(),shift.CashShiftId,sources.Select(s=>new RefundSplitInput(s.PaymentSplitId,s.Amount)).ToArray());
        await using(var failed=new GymFlowDbContext(new DbContextOptionsBuilder<GymFlowDbContext>().UseSqlServer(Environment.GetEnvironmentVariable("GYMFLOW_TEST_CONNECTION")).AddInterceptors(new InventoryFailure()).Options,tenant))
            await Assert.ThrowsAsync<InvalidOperationException>(()=>new ReturnsService(failed,tenant).ProcessAsync(id,process,actor,ct));
        Assert.Equal(0,await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM finance.Refunds WHERE OrganizationId={org}").SingleAsync(ct));
        Assert.Equal(0,await db.CashMovements.CountAsync(m=>m.MovementType=="REFUND",ct));
        Assert.Equal(0,await db.InventoryBalances.AsNoTracking().Where(b=>b.ProductId==products[0].ProductId).Select(b=>b.QuantityOnHand).SingleAsync(ct));
        Assert.Equal("APPROVED",Assert.Single((await service.ListAsync(1,10,ct)).Items).Status);
        async Task<ReturnItem> Process(ReturnProcessRequest r){await using var context=Create();return await new ReturnsService(context,tenant).ProcessAsync(id,r,actor,ct);}
        var results=await Task.WhenAll(Process(process),Process(process));Assert.Equal(results[0],results[1]);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Process(process with {RequestId=Guid.NewGuid()}));
        Assert.Equal(2,await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM finance.Refunds WHERE OrganizationId={org}").SingleAsync(ct));
        Assert.Equal(10,await db.CashMovements.Where(m=>m.MovementType=="REFUND").SumAsync(m=>m.Amount,ct));
        Assert.Equal(1,await db.InventoryBalances.AsNoTracking().Where(b=>b.ProductId==products[0].ProductId).Select(b=>b.QuantityOnHand).SingleAsync(ct));
        Assert.Equal(1,await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM commerce.InventoryMovements WHERE OrganizationId={org} AND MovementType='RETURN_IN'").SingleAsync(ct));
        var handoff=await new HandoffService(db,tenant,clock).CreateAsync(new(Guid.NewGuid(),branch,null,shift.CashShiftId,"Entrega de prueba",null),actor,ct);
        async Task<bool> Transition(bool ack)
        {
            await using var context=Create();try{await new HandoffService(context,tenant,clock).TransitionAsync(handoff.ShiftHandoffId,new(handoff.RowVersion),actor,ack,ct);return true;}
            catch(DbUpdateConcurrencyException){return false;}
        }
        Assert.Single(await Task.WhenAll(Transition(true),Transition(false)),success=>success);
        Assert.Equal(1,await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM audit.AuditLogs WHERE OrganizationId={org} AND Action='RETURN.PROCESS'").SingleAsync(ct));
        var close=await new CashService(db,tenant,clock).CloseAsync(shift.CashShiftId,new(100,"Reembolso conciliado"),actor,ct);Assert.Equal(0,close.DifferenceAmount);
    }
}
