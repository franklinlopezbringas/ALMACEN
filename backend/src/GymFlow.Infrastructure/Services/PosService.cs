using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class PosService(GymFlowDbContext db, ICurrentTenant tenant, IPaymentService payments)
{
    public async Task<PosResult> SellAsync(PosRequest request, long actor, CancellationToken ct)
    {
        if (!tenant.IsResolved) throw new UnauthorizedAccessException();
        if (request.RequestId == Guid.Empty || request.Items is null || request.Items.Count is < 1 or > 30 || request.Splits is null
            || request.Items.Any(i => i is null || i.Quantity <= 0 || i.Quantity > 1000 || decimal.Round(i.Quantity, 3) != i.Quantity)
            || request.Splits.Any(s => s is null)
            || request.Items.Select(i => i.ProductPublicId).Distinct().Count() != request.Items.Count)
            throw new ArgumentException("Select 1 to 30 distinct products and valid quantities.");
        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(ct) : null;
        await db.AcquireAsync(tenant.OrganizationId, $"pos:{request.RequestId}", ct);
        var number = "POS-" + request.RequestId.ToString("N").ToUpperInvariant();
        var existing = await db.Database.SqlQuery<long>($"SELECT OrderId AS Value FROM finance.Orders WHERE OrganizationId={tenant.OrganizationId} AND PublicId={request.RequestId}").ToListAsync(ct);
        if (existing.Count != 0)
        {
            await ReceptionAudit.VerifyReplayAsync(db, tenant.OrganizationId, actor, "POS.SALE", request.RequestId.ToString(), request, ct);
            var p = await db.Payments.AsNoTracking().SingleAsync(p => p.OrderId == existing[0], ct);
            if (tx is not null) await tx.CommitAsync(ct);
            return new(request.RequestId, number, new(p.PublicId, p.PaymentId, p.ReceiptNumber, p.TotalAmount, p.CurrencyCode, p.Status, p.ReceivedAtUtc));
        }
        if (!await db.Branches.AsNoTracking().AnyAsync(b => b.BranchId == request.BranchId && b.Status == "ACTIVE", ct)) throw new KeyNotFoundException();
        if (request.MemberId is not null && !await db.Members.AsNoTracking().AnyAsync(m => m.MemberId == request.MemberId && m.Status == "ACTIVE", ct)) throw new KeyNotFoundException();
        var ids = request.Items.Select(i => i.ProductPublicId).ToArray();
        var products = await db.Products.AsNoTracking().Where(p => ids.Contains(p.PublicId) && p.Status == "ACTIVE").ToListAsync(ct);
        if (products.Count != ids.Length) throw new KeyNotFoundException();
        decimal total = 0;
        foreach (var product in products.OrderBy(p => p.ProductId))
        {
            var item = request.Items.Single(i => i.ProductPublicId == product.PublicId);
            if (product.CurrencyCode != request.CurrencyCode || item.ExpectedUnitPrice != product.SalePrice) throw new InvalidOperationException("Product price or currency changed. Reload the cart.");
            var line = item.Quantity * product.SalePrice;
            if (decimal.Round(line, 4) != line) throw new ArgumentException("Line total supports at most four decimal places.");
            total += line;
            await db.AcquireAsync(tenant.OrganizationId, $"stock:{request.BranchId}:{product.ProductId}", ct);
        }
        if (total <= 0 || total > 999999999m || request.Splits.Sum(s => s.Amount) != total) throw new ArgumentException("Payment splits must equal the sale total.");
        var order = (await db.Database.SqlQuery<long>($"INSERT finance.Orders(OrganizationId,PublicId,OrderNumber,OrderType,Channel,UserId,MemberId,BranchId,CurrencyCode,SubtotalAmount,TotalAmount,Status) OUTPUT INSERTED.OrderId AS Value VALUES({tenant.OrganizationId},{request.RequestId},{number},'STORE','RECEPTION',{actor},{request.MemberId},{request.BranchId},{request.CurrencyCode},{SqlValues.Money(total)},{SqlValues.Money(total)},'PENDING')").ToListAsync(ct)).Single();
        foreach (var product in products.OrderBy(p => p.ProductId))
        {
            var item = request.Items.Single(i => i.ProductPublicId == product.PublicId);
            var changed = await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE commerce.InventoryBalances SET QuantityOnHand=QuantityOnHand-{SqlValues.Quantity(item.Quantity)},UpdatedAtUtc=SYSUTCDATETIME() WHERE OrganizationId={tenant.OrganizationId} AND BranchId={request.BranchId} AND ProductId={product.ProductId} AND QuantityOnHand>={SqlValues.Quantity(item.Quantity)}", ct);
            if (changed != 1) throw new InvalidOperationException("Insufficient stock. Reload availability before selling.");
            var lineTotal = item.Quantity * product.SalePrice;
            var line = (await db.Database.SqlQuery<long>($"INSERT finance.OrderItems(OrganizationId,OrderId,ItemType,ReferenceId,Sku,Description,Quantity,UnitPrice,TotalAmount) OUTPUT INSERTED.OrderItemId AS Value VALUES({tenant.OrganizationId},{order},'PRODUCT',{product.ProductId},{product.Sku},{product.Name},{SqlValues.Quantity(item.Quantity)},{SqlValues.Money(product.SalePrice)},{SqlValues.Money(lineTotal)})").ToListAsync(ct)).Single();
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT commerce.InventoryMovements(OrganizationId,BranchId,ProductId,MovementType,Quantity,OrderItemId,ReferenceText,Reason,CreatedByUserId) VALUES({tenant.OrganizationId},{request.BranchId},{product.ProductId},'SALE_OUT',{SqlValues.Quantity(item.Quantity)},{line},{number},'POS sale',{actor})", ct);
        }
        // The existing payment service participates in this same SQL transaction.
        // Any rejected split/closed drawer/stock conflict rolls back every write.
        var payment = await payments.RegisterAsync(new(request.MemberId, order, request.BranchId, total, request.CurrencyCode,
            "RECEPTION", request.CashShiftId, request.Splits, [], request.RequestId), actor, ct);
        await ReceptionAudit.WriteAsync(db, tenant.OrganizationId, actor, "POS.SALE", "Order", request.RequestId.ToString(), null,
            new { OrderId = order, payment.PaymentId, Total = total, RequestHash = ReceptionAudit.Hash(request) }, ct);
        if (tx is not null) await tx.CommitAsync(ct);
        return new(request.RequestId, number, payment);
    }
}
