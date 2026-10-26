using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Persistence;
using GymFlow.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GymFlow.Tests;

public sealed class PosConcurrencyTests
{
    public static bool IsConfigured => SqlServerIntegrationTests.IsConfigured;
    private sealed record Tenant(long OrganizationId) : ICurrentTenant { public bool IsResolved => OrganizationId > 0; }
    private sealed class PaymentFailure(IPaymentService inner) : IPaymentService
    {
        public async Task<PaymentResult> RegisterAsync(RegisterPaymentRequest request, long actorUserId, CancellationToken cancellationToken)
        {
            await inner.RegisterAsync(request, actorUserId, cancellationToken);
            throw new InvalidOperationException("Injected failure after payment and drawer writes.");
        }
    }
    // Real independent connections are required to test competing SQL transaction locks.
    // This isolated, login-less test organization is retained inactive with its audit/ledgers.
    [Fact(Skip = "Set GYMFLOW_TEST_CONNECTION for real SQL concurrency.", SkipUnless = nameof(IsConfigured))]
    public async Task PosRollbackReplayLastStockDoublePaymentAndDrawerCloseAreAtomic()
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
        var shift=await new CashService(db,tenant,clock).OpenAsync(new(register,employee,100,"Pruebas concurrentes"),actor,ct);
        PosRequest Request(Guid? id=null, bool mixed=false)=>new(id??Guid.NewGuid(),branch,member,shift.CashShiftId,"PEN",
            [new(products[0].PublicId,1,35)],mixed?[new(cash,10,null,null),new(yape,25,null,null)]:[new(yape,35,null,null)]);
        async Task<PosResult> Sell(PosRequest request,bool fail=false)
        {
            await using var context=Create();
            IPaymentService payment=new PaymentService(context,tenant,clock);
            if(fail)payment=new PaymentFailure(payment);
            return await new PosService(context,tenant,payment).SellAsync(request,actor,ct);
        }
        async Task AssertNoSale(Guid id)
        {
            Assert.False(await db.Payments.AsNoTracking().AnyAsync(p=>p.PublicId==id,ct));
            Assert.Equal(0,await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM finance.Orders WHERE OrganizationId={org} AND PublicId={id}").SingleAsync(ct));
            Assert.Equal(0,await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM audit.AuditLogs WHERE OrganizationId={org} AND EntityId={id.ToString()}").SingleAsync(ct));
        }
        var failed=Request(mixed:true);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Sell(failed,true));
        await AssertNoSale(failed.RequestId);
        Assert.Equal(0,await db.CashMovements.CountAsync(ct));
        Assert.All(await db.InventoryBalances.AsNoTracking().ToListAsync(ct),b=>Assert.Equal(1,b.QuantityOnHand));
        // A missing method fails after order/detail/inventory writes and must undo all of them.
        var invalid=Request() with { Splits=[new(long.MaxValue,35,null,null)] };
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Sell(invalid)); await AssertNoSale(invalid.RequestId);
        // Multi-line shortage rolls back the first product as well as the order.
        var shortage=Request() with { Items=[new(products[0].PublicId,1,35),new(products[1].PublicId,2,20)],Splits=[new(yape,75,null,null)] };
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Sell(shortage)); await AssertNoSale(shortage.RequestId);
        Assert.All(await db.InventoryBalances.AsNoTracking().ToListAsync(ct),b=>Assert.Equal(1,b.QuantityOnHand));
        var one=Request(mixed:true);var two=Request(mixed:true);
        async Task<bool> Attempt(PosRequest r){try{await Sell(r);return true;}catch(InvalidOperationException){return false;}}
        var results=await Task.WhenAll(Attempt(one),Attempt(two)); Assert.Single(results,x=>x);
        var won=results[0]?one:two;var lost=results[0]?two:one;
        await AssertNoSale(lost.RequestId);
        Assert.Equal(0,await db.InventoryBalances.AsNoTracking().Where(b=>b.ProductId==products[0].ProductId).Select(b=>b.QuantityOnHand).SingleAsync(ct));
        Assert.Equal(10,await db.CashMovements.SumAsync(m=>m.Amount,ct));
        var replay=await Task.WhenAll(Sell(won),Sell(won)); Assert.Equal(replay[0],replay[1]);
        Assert.Equal(1,await db.Payments.CountAsync(ct));
        await Assert.ThrowsAsync<InvalidOperationException>(()=>Sell(Request()));
        // Same request racing creates one payment; distinct overpayments compete for the debt lock.
        var paymentRequest=new RegisterPaymentRequest(member,null,branch,60,"PEN","RECEPTION",null,[new(yape,60,null,null)],[new(debt,60)],Guid.NewGuid());
        async Task<PaymentResult> Pay(RegisterPaymentRequest r){await using var context=Create();return await new PaymentService(context,tenant,clock).RegisterAsync(r,actor,ct);}
        var paid=await Task.WhenAll(Pay(paymentRequest),Pay(paymentRequest));Assert.Equal(paid[0].PublicId,paid[1].PublicId);
        Assert.Equal(40,(await new ReceptionService(db,tenant,clock).DebtsAsync(member,1,10,ct)).Items[0].BalanceAmount);
        var remaining=paymentRequest with { TotalAmount=40,Splits=[new(yape,40,null,null)],Allocations=[new(debt,40)],RequestId=Guid.NewGuid() };
        async Task<bool> TryPay(RegisterPaymentRequest r){try{await Pay(r);return true;}catch(InvalidOperationException){return false;}}
        Assert.Single(await Task.WhenAll(TryPay(remaining),TryPay(remaining with { RequestId=Guid.NewGuid() })),x=>x);
        Assert.Equal(10,await db.CashMovements.SumAsync(m=>m.Amount,ct));
        async Task<bool> Close(){await using var context=Create();try{await new CashService(context,tenant,clock).CloseAsync(shift.CashShiftId,new(110,"Cierre de pruebas"),actor,ct);return true;}catch(InvalidOperationException){return false;}}
        Assert.Single(await Task.WhenAll(Close(),Close()),x=>x);
        var final=await db.CashShifts.AsNoTracking().SingleAsync(s=>s.CashShiftId==shift.CashShiftId,ct);Assert.Equal("CLOSED",final.Status);Assert.Equal(0,final.DifferenceAmount);
        Assert.Equal(1,await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM audit.AuditLogs WHERE OrganizationId={org} AND Action='POS.SALE'").SingleAsync(ct));
        Assert.Equal(1,await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM commerce.InventoryMovements WHERE OrganizationId={org} AND MovementType='SALE_OUT'").SingleAsync(ct));
    }
}
