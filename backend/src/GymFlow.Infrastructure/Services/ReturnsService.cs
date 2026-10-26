using System.Globalization;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace GymFlow.Infrastructure.Services;
public sealed class ReturnsService(GymFlowDbContext db,ICurrentTenant tenant)
{
    private IQueryable<ReturnItem> Items()=>db.Database.SqlQuery<ReturnItem>($"SELECT r.ProductReturnId,r.OrderId,r.OrderItemId,r.ProductId,i.Description AS ProductName,r.Quantity,CAST(ROUND(r.Quantity*i.UnitPrice,4) AS decimal(19,4)) AS Amount,r.Reason,r.Status,r.RequestedAtUtc FROM commerce.ProductReturns r JOIN finance.OrderItems i ON i.OrganizationId=r.OrganizationId AND i.OrderItemId=r.OrderItemId WHERE r.OrganizationId={tenant.OrganizationId}");
    public Task<PagedResult<ReturnItem>> ListAsync(int page,int size,CancellationToken ct)=>HandoffService.PageAsync(Items().OrderByDescending(r=>r.RequestedAtUtc).ThenByDescending(r=>r.ProductReturnId),page,size,ct);
    public Task<PagedResult<ReturnableLine>> LinesAsync(string? search,int page,int size,CancellationToken ct)
    {
        search=search?.Trim()??"";if(search.Length>100) throw new ArgumentException("Search is too long.");
        return HandoffService.PageAsync(db.Database.SqlQuery<ReturnableLine>($"SELECT i.OrderItemId,o.PublicId AS OrderPublicId,o.OrderNumber,i.Description,i.Quantity,COALESCE((SELECT SUM(r.Quantity) FROM commerce.ProductReturns r WHERE r.OrganizationId=i.OrganizationId AND r.OrderItemId=i.OrderItemId AND r.Status IN ('REQUESTED','APPROVED','PROCESSED')),0) AS ReturnedQuantity,i.UnitPrice FROM finance.OrderItems i JOIN finance.Orders o ON o.OrganizationId=i.OrganizationId AND o.OrderId=i.OrderId WHERE o.OrganizationId={tenant.OrganizationId} AND o.OrderType='STORE' AND o.Channel='RECEPTION' AND o.OrderNumber LIKE 'POS-%' AND i.ItemType='PRODUCT' AND i.DiscountAmount=0 AND i.TaxAmount=0 AND ({search}='' OR CHARINDEX({search},o.OrderNumber)>0)").OrderByDescending(i=>i.OrderItemId),page,size,ct);
    }
    public async Task<ReturnItem> RequestAsync(ReturnRequest request,long actor,CancellationToken ct)
    {
        if(request.Quantity<=0 || decimal.Round(request.Quantity,3)!=request.Quantity || string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length>500) throw new ArgumentException("Provide quantity and reason.");
        await using var tx=db.Database.CurrentTransaction is null?await db.Database.BeginTransactionAsync(ct):null;
        var replay=await OperationReplay.FindAsync(db,tenant.OrganizationId,actor,"RETURN.REQUEST",request.RequestId,request,ct);
        if(replay is not null) return await Items().SingleAsync(r=>r.ProductReturnId==replay,ct);
        var order=await db.Database.SqlQuery<long>($"SELECT o.OrderId AS Value FROM finance.OrderItems i JOIN finance.Orders o ON o.OrganizationId=i.OrganizationId AND o.OrderId=i.OrderId WHERE i.OrganizationId={tenant.OrganizationId} AND i.OrderItemId={request.OrderItemId} AND o.OrderType='STORE' AND o.Channel='RECEPTION' AND o.OrderNumber LIKE 'POS-%' AND i.ItemType='PRODUCT' AND i.DiscountAmount=0 AND i.TaxAmount=0").SingleOrDefaultAsync(ct);
        if(order==0) throw new KeyNotFoundException();
        await db.AcquireAsync(tenant.OrganizationId,$"return-order:{order}",ct);
        var available=await db.Database.SqlQuery<decimal>($"SELECT i.Quantity-COALESCE((SELECT SUM(r.Quantity) FROM commerce.ProductReturns r WHERE r.OrganizationId=i.OrganizationId AND r.OrderItemId=i.OrderItemId AND r.Status IN ('REQUESTED','APPROVED','PROCESSED')),0) AS Value FROM finance.OrderItems i WHERE i.OrganizationId={tenant.OrganizationId} AND i.OrderItemId={request.OrderItemId}").SingleAsync(ct);
        if(request.Quantity>available) throw new InvalidOperationException("Quantity already returned or requested.");
        var price=await db.Database.SqlQuery<decimal>($"SELECT UnitPrice AS Value FROM finance.OrderItems WHERE OrganizationId={tenant.OrganizationId} AND OrderItemId={request.OrderItemId}").SingleAsync(ct);
        if(decimal.Round(request.Quantity*price,4)!=request.Quantity*price) throw new ArgumentException("Return amount supports at most four decimal places.");
        var product=await db.Database.SqlQuery<long>($"SELECT ReferenceId AS Value FROM finance.OrderItems WHERE OrganizationId={tenant.OrganizationId} AND OrderItemId={request.OrderItemId}").SingleAsync(ct);
        var id=(await db.Database.SqlQuery<long>($"INSERT commerce.ProductReturns(OrganizationId,OrderId,OrderItemId,ProductId,Quantity,Reason,RequestedByUserId) OUTPUT INSERTED.ProductReturnId AS Value VALUES({tenant.OrganizationId},{order},{request.OrderItemId},{product},{SqlValues.Quantity(request.Quantity)},{request.Reason.Trim()},{actor})").ToListAsync(ct)).Single();
        await OperationReplay.WriteAsync(db,tenant.OrganizationId,actor,"RETURN.REQUEST","ProductReturn",request.RequestId,id,request,ct);
        if(tx is not null) await tx.CommitAsync(ct);return await Items().SingleAsync(r=>r.ProductReturnId==id,ct);
    }
    public async Task ReviewAsync(long id,ExceptionReviewRequest request,long actor,CancellationToken ct)
    {
        if(request.Status is not ("APPROVED" or "REJECTED")) throw new ArgumentException("Invalid review.");
        await using var tx=db.Database.CurrentTransaction is null?await db.Database.BeginTransactionAsync(ct):null;
        var row=await Items().SingleOrDefaultAsync(r=>r.ProductReturnId==id,ct)??throw new KeyNotFoundException();
        await db.AcquireAsync(tenant.OrganizationId,$"return-order:{row.OrderId}",ct);
        var changed=await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE commerce.ProductReturns SET Status={request.Status},ApprovedByUserId={actor} WHERE OrganizationId={tenant.OrganizationId} AND ProductReturnId={id} AND Status='REQUESTED'",ct);
        if(changed!=1) throw new InvalidOperationException("Return was already reviewed.");
        await ReceptionAudit.WriteAsync(db,tenant.OrganizationId,actor,"RETURN.REVIEW","ProductReturn",id.ToString(CultureInfo.InvariantCulture),new {Status="REQUESTED"},new {request.Status,ApprovedByUserId=actor},ct);
        if(tx is not null) await tx.CommitAsync(ct);
    }
    public async Task<IReadOnlyList<RefundSource>> SourcesAsync(long id,CancellationToken ct)
    {
        var row=await Items().SingleOrDefaultAsync(r=>r.ProductReturnId==id,ct)??throw new KeyNotFoundException();
        return await db.Database.SqlQuery<RefundSource>($"SELECT s.PaymentSplitId,m.Name AS MethodName,m.IsCash,s.Amount,COALESCE((SELECT SUM(f.Amount) FROM finance.Refunds f WHERE f.OrganizationId=s.OrganizationId AND f.PaymentSplitId=s.PaymentSplitId AND f.Status IN ('APPROVED','PROCESSED')),0) AS RefundedAmount FROM finance.PaymentSplits s JOIN finance.Payments p ON p.OrganizationId=s.OrganizationId AND p.PaymentId=s.PaymentId JOIN finance.PaymentMethods m ON m.OrganizationId=s.OrganizationId AND m.PaymentMethodId=s.PaymentMethodId WHERE p.OrganizationId={tenant.OrganizationId} AND p.OrderId={row.OrderId} AND p.Status IN ('COMPLETED','PARTIALLY_REFUNDED') ORDER BY s.PaymentSplitId").ToListAsync(ct);
    }
    public async Task<ReturnItem> ProcessAsync(long id,ReturnProcessRequest request,long actor,CancellationToken ct)
    {
        if(request.Splits is null || request.Splits.Count is <1 or >20 || request.Splits.Any(s=>s is null || s.Amount<=0 || decimal.Round(s.Amount,4)!=s.Amount) || request.Splits.Select(s=>s.PaymentSplitId).Distinct().Count()!=request.Splits.Count) throw new ArgumentException("Invalid refund splits.");
        await using var tx=db.Database.CurrentTransaction is null?await db.Database.BeginTransactionAsync(ct):null;
        var payload=new {Id=id,Request=request};var replay=await OperationReplay.FindAsync(db,tenant.OrganizationId,actor,"RETURN.PROCESS",request.RequestId,payload,ct);
        if(replay is not null) return await Items().SingleAsync(r=>r.ProductReturnId==replay,ct);
        var row=await Items().SingleOrDefaultAsync(r=>r.ProductReturnId==id,ct)??throw new KeyNotFoundException();
        await db.AcquireAsync(tenant.OrganizationId,$"return-order:{row.OrderId}",ct);
        row=await Items().SingleAsync(r=>r.ProductReturnId==id,ct);
        if(row.Status!="APPROVED" || request.Splits.Sum(s=>s.Amount)!=row.Amount) throw new InvalidOperationException("An approved return and exact refund total are required.");
        var legacy=await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM finance.Refunds f JOIN finance.Payments p ON p.OrganizationId=f.OrganizationId AND p.PaymentId=f.PaymentId WHERE f.OrganizationId={tenant.OrganizationId} AND p.OrderId={row.OrderId} AND f.PaymentSplitId IS NULL AND f.Status IN ('APPROVED','PROCESSED')").SingleAsync(ct);
        if(legacy>0) throw new InvalidOperationException("A prior refund has no original method reference. Reconcile it before proceeding.");
        var sources=await SourcesAsync(id,ct);
        foreach(var split in request.Splits)
            if(!sources.Any(s=>s.PaymentSplitId==split.PaymentSplitId && s.Amount-s.RefundedAmount>=split.Amount)) throw new InvalidOperationException("Refund exceeds the original payment method balance.");
        var branch=await db.Database.SqlQuery<long>($"SELECT BranchId AS Value FROM finance.Orders WHERE OrganizationId={tenant.OrganizationId} AND OrderId={row.OrderId}").SingleAsync(ct);
        await db.AcquireAsync(tenant.OrganizationId,$"stock:{branch}:{row.ProductId}",ct);
        var cash=request.Splits.Where(s=>sources.Single(m=>m.PaymentSplitId==s.PaymentSplitId).IsCash).Sum(s=>s.Amount);
        if(cash>0)
        {
            if(request.CashShiftId is null) throw new InvalidOperationException("An open cash shift is required for cash refunds.");
            await db.AcquireAsync(tenant.OrganizationId,$"cash:{request.CashShiftId}",ct);
            if(!await (from s in db.CashShifts.AsNoTracking() join r in db.CashRegisters.AsNoTracking() on s.CashRegisterId equals r.CashRegisterId where s.CashShiftId==request.CashShiftId && s.Status=="OPEN" && s.OpenedByUserId==actor && r.BranchId==branch select s).AnyAsync(ct)) throw new UnauthorizedAccessException("Use your own open cash shift at the sale branch.");
        }
        foreach(var split in request.Splits)
        {
            var refund=(await db.Database.SqlQuery<long>($"DECLARE @ids TABLE(Id bigint); INSERT finance.Refunds(OrganizationId,PaymentId,PaymentSplitId,ProductReturnId,Amount,Reason,Status,RequestedByUserId,ApprovedByUserId,RequestedAtUtc,ApprovedAtUtc,ProcessedAtUtc) OUTPUT INSERTED.RefundId INTO @ids SELECT s.OrganizationId,s.PaymentId,s.PaymentSplitId,r.ProductReturnId,{SqlValues.Money(split.Amount)},r.Reason,'PROCESSED',r.RequestedByUserId,r.ApprovedByUserId,r.RequestedAtUtc,(SELECT MAX(a.OccurredAtUtc) FROM audit.AuditLogs a WHERE a.OrganizationId=r.OrganizationId AND a.EntityType='ProductReturn' AND a.EntityId=CONVERT(nvarchar(100),r.ProductReturnId) AND a.Action='RETURN.REVIEW' AND a.UserId=r.ApprovedByUserId),SYSUTCDATETIME() FROM finance.PaymentSplits s CROSS JOIN commerce.ProductReturns r WHERE s.OrganizationId={tenant.OrganizationId} AND s.PaymentSplitId={split.PaymentSplitId} AND r.OrganizationId=s.OrganizationId AND r.ProductReturnId={id}; SELECT Id AS Value FROM @ids").ToListAsync(ct)).Single();
            if(sources.Single(s=>s.PaymentSplitId==split.PaymentSplitId).IsCash)
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT finance.CashMovements(OrganizationId,CashShiftId,MovementType,Amount,RefundId,Description,CreatedByUserId) VALUES({tenant.OrganizationId},{request.CashShiftId},'REFUND',{SqlValues.Money(split.Amount)},{refund},'POS return',{actor})",ct);
        }
        var updated=await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE commerce.InventoryBalances SET QuantityOnHand=QuantityOnHand+{SqlValues.Quantity(row.Quantity)},UpdatedAtUtc=SYSUTCDATETIME() WHERE OrganizationId={tenant.OrganizationId} AND BranchId={branch} AND ProductId={row.ProductId}",ct);
        if(updated!=1) throw new InvalidOperationException("Inventory balance is unavailable. No refund was committed.");
        var reference="RETURN-"+id.ToString(CultureInfo.InvariantCulture);
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT commerce.InventoryMovements(OrganizationId,BranchId,ProductId,MovementType,Quantity,OrderItemId,ReferenceText,Reason,CreatedByUserId) VALUES({tenant.OrganizationId},{branch},{row.ProductId},'RETURN_IN',{SqlValues.Quantity(row.Quantity)},{row.OrderItemId},{reference},'POS return',{actor})",ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE commerce.ProductReturns SET Status='PROCESSED',ProcessedAtUtc=SYSUTCDATETIME() WHERE OrganizationId={tenant.OrganizationId} AND ProductReturnId={id}",ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE p SET Status=CASE WHEN (SELECT SUM(f.Amount) FROM finance.Refunds f WITH (INDEX(IX_Refunds_Payment_Status)) WHERE f.OrganizationId=p.OrganizationId AND f.PaymentId=p.PaymentId AND f.Status='PROCESSED')>=p.TotalAmount THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END FROM finance.Payments p WITH (INDEX(IX_Payments_Org_Order)) WHERE p.OrganizationId={tenant.OrganizationId} AND p.OrderId={row.OrderId}; UPDATE o SET Status='REFUNDED' FROM finance.Orders o WHERE o.OrganizationId={tenant.OrganizationId} AND o.OrderId={row.OrderId} AND o.TotalAmount<=(SELECT COALESCE(SUM(f.Amount),0) FROM finance.Payments p WITH (INDEX(IX_Payments_Org_Order)) JOIN finance.Refunds f WITH (INDEX(IX_Refunds_Payment_Status)) ON p.OrganizationId=f.OrganizationId AND p.PaymentId=f.PaymentId WHERE p.OrganizationId=o.OrganizationId AND p.OrderId=o.OrderId AND f.Status='PROCESSED')",ct);
        await OperationReplay.WriteAsync(db,tenant.OrganizationId,actor,"RETURN.PROCESS","ProductReturn",request.RequestId,id,payload,ct);
        if(tx is not null) await tx.CommitAsync(ct);return await Items().SingleAsync(r=>r.ProductReturnId==id,ct);
    }
}
