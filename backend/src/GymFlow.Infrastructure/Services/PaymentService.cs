using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class PaymentService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : IPaymentService
{
    public async Task<PaymentResult> RegisterAsync(RegisterPaymentRequest request, long actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        ArgumentNullException.ThrowIfNull(request.Splits);
        ArgumentNullException.ThrowIfNull(request.Allocations);
        if (request.Splits.Any(x => x is null) || request.Allocations.Any(x => x is null)) throw new ArgumentException("Invalid payment entries.");
        ArgumentException.ThrowIfNullOrWhiteSpace(request.CurrencyCode);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.Source);
        if (decimal.Round(request.TotalAmount, 4) != request.TotalAmount
            || request.Splits.Any(x => decimal.Round(x.Amount, 4) != x.Amount)
            || request.Allocations.Any(x => decimal.Round(x.Amount, 4) != x.Amount))
            throw new ArgumentException("Amounts support at most four decimal places.", nameof(request));
        if (request.TotalAmount <= 0) throw new ArgumentOutOfRangeException(nameof(request));
        if (request.Splits.Count == 0) throw new InvalidOperationException("At least one payment split is required.");
        if (request.Splits.Any(x => x.Amount <= 0) || request.Splits.Sum(x => x.Amount) != request.TotalAmount)
            throw new InvalidOperationException("Payment splits must be positive and equal the payment total.");
        if (request.Allocations.Any(x => x.Amount <= 0) || request.Allocations.Sum(x => x.Amount) > request.TotalAmount)
            throw new InvalidOperationException("Payment allocations are invalid.");
        if (request.Allocations.Select(x => x.ReceivableId).Distinct().Count() != request.Allocations.Count)
            throw new ArgumentException("Duplicate receivable allocations are not allowed.", nameof(request));

        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
        var publicId = request.RequestId ?? Guid.NewGuid();
        if (publicId == Guid.Empty) throw new ArgumentException("RequestId must not be empty.");
        await db.AcquireAsync(tenant.OrganizationId, $"payment:{publicId}", cancellationToken);
        var prior = await db.Payments.AsNoTracking().SingleOrDefaultAsync(p => p.PublicId == publicId, cancellationToken);
        if (prior is not null)
        {
            await ReceptionAudit.VerifyReplayAsync(db, tenant.OrganizationId, actorUserId, "PAYMENT.CREATE", publicId.ToString(), request, cancellationToken);
            if (tx is not null) await tx.CommitAsync(cancellationToken);
            return new(prior.PublicId, prior.PaymentId, prior.ReceiptNumber, prior.TotalAmount, prior.CurrencyCode, prior.Status, prior.ReceivedAtUtc);
        }
        if (request.OrderId is not null)
        {
            await db.AcquireAsync(tenant.OrganizationId, $"order:{request.OrderId}", cancellationToken);
            var orderMatches = await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM finance.Orders WHERE OrganizationId={tenant.OrganizationId} AND OrderId={request.OrderId} AND Status IN ('PENDING','PARTIALLY_PAID') AND CurrencyCode={request.CurrencyCode} AND (MemberId={request.MemberId} OR (MemberId IS NULL AND {request.MemberId} IS NULL)) AND BranchId={request.BranchId} AND TotalAmount >= {request.TotalAmount} + (SELECT COALESCE(SUM(TotalAmount),0) FROM finance.Payments WHERE OrganizationId={tenant.OrganizationId} AND OrderId={request.OrderId} AND Status='COMPLETED')").SingleAsync(cancellationToken);
            if (orderMatches != 1) throw new InvalidOperationException("Order is invalid, paid, or the payment exceeds its balance.");
        }
        if (request.CashShiftId is not null)
            await db.AcquireAsync(tenant.OrganizationId, $"cash:{request.CashShiftId}", cancellationToken);
        foreach (var id in request.Allocations.Select(x => x.ReceivableId).Order())
            await db.AcquireAsync(tenant.OrganizationId, $"receivable:{id}", cancellationToken);
        if (request.MemberId is not null && !await db.Members.AnyAsync(x => x.MemberId == request.MemberId, cancellationToken))
            throw new InvalidOperationException("Member is invalid.");
        if (request.BranchId is not null && !await db.Branches.AnyAsync(x => x.BranchId == request.BranchId && x.Status == "ACTIVE", cancellationToken))
            throw new InvalidOperationException("Branch is invalid.");

        var methodIds = request.Splits.Select(x => x.PaymentMethodId).Distinct().ToArray();
        var methods = await db.PaymentMethods.AsNoTracking().Where(x => methodIds.Contains(x.PaymentMethodId) && x.Status == "ACTIVE").ToDictionaryAsync(x => x.PaymentMethodId, cancellationToken);
        if (methods.Count != methodIds.Length) throw new InvalidOperationException("One or more payment methods are invalid.");

        var receivableIds = request.Allocations.Select(x => x.ReceivableId).Distinct().ToArray();
        var receivables = await db.Receivables.Where(x => receivableIds.Contains(x.ReceivableId) && x.Status != "CANCELLED" && x.Status != "WRITTEN_OFF").ToListAsync(cancellationToken);
        if (receivables.Count != receivableIds.Length) throw new InvalidOperationException("One or more receivables are invalid.");
        if (receivables.Any(x => !string.Equals(x.CurrencyCode, request.CurrencyCode, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Payment currency must match receivable currency.");
        if (receivables.Any(x => x.MemberId != request.MemberId))
            throw new InvalidOperationException("Payment member must match the receivable member.");
        var balances = await db.ReceivableBalances.AsNoTracking().Where(x => receivableIds.Contains(x.ReceivableId))
            .ToDictionaryAsync(x => x.ReceivableId, x => x.BalanceAmount, cancellationToken);
        if (request.Allocations.Any(x => x.Amount > balances[x.ReceivableId]))
            throw new InvalidOperationException("Payment exceeds the remaining receivable balance.");

        var cashAmount = request.Splits.Where(x => methods[x.PaymentMethodId].IsCash).Sum(x => x.Amount);
        CashShift? cashShift = null;
        if (cashAmount > 0)
        {
            if (request.CashShiftId is null) throw new InvalidOperationException("An open cash shift is required for cash payments.");
            var currency = await db.Organizations.Where(o => o.OrganizationId == tenant.OrganizationId).Select(o => o.DefaultCurrencyCode).SingleAsync(cancellationToken);
            if (currency != request.CurrencyCode) throw new InvalidOperationException("Cash currency must match the organization currency.");
            cashShift = await db.CashShifts.SingleOrDefaultAsync(x => x.CashShiftId == request.CashShiftId && x.Status == "OPEN", cancellationToken)
                        ?? throw new InvalidOperationException("Cash shift is not open.");
            if (!await db.CashRegisters.AnyAsync(x => x.CashRegisterId == cashShift.CashRegisterId && x.BranchId == request.BranchId, cancellationToken))
                throw new InvalidOperationException("Cash shift must belong to the payment branch.");
        }

        var instant = clock.UtcNow;
        var now = new DateTime(instant.Ticks - instant.Ticks % TimeSpan.TicksPerMillisecond, DateTimeKind.Utc);
        var payment = new Payment
        {
            OrganizationId = tenant.OrganizationId,
            PublicId = publicId,
            ReceiptNumber = $"PAY-{now:yyyyMMddHHmmss}-{Guid.NewGuid():N}"[..31].ToUpperInvariant(),
            MemberId = request.MemberId,
            OrderId = request.OrderId,
            BranchId = request.BranchId,
            TotalAmount = request.TotalAmount,
            CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant(),
            Source = request.Source.Trim().ToUpperInvariant(),
            Status = "COMPLETED",
            ReceivedAtUtc = now,
            ReceivedByUserId = actorUserId
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync(cancellationToken);

        var splitEntities = request.Splits.Select(x => new PaymentSplit
        {
            OrganizationId = tenant.OrganizationId,
            PaymentId = payment.PaymentId,
            PaymentMethodId = x.PaymentMethodId,
            Amount = x.Amount,
            ExternalReference = x.ExternalReference,
            ProviderTransactionId = x.ProviderTransactionId
        }).ToList();
        db.PaymentSplits.AddRange(splitEntities);

        db.PaymentAllocations.AddRange(request.Allocations.Select(x => new PaymentAllocation
        {
            OrganizationId = tenant.OrganizationId,
            PaymentId = payment.PaymentId,
            ReceivableId = x.ReceivableId,
            Amount = x.Amount
        }));
        await db.SaveChangesAsync(cancellationToken);

        if (cashAmount > 0 && cashShift is not null)
        {
            foreach (var split in splitEntities.Where(x => methods[x.PaymentMethodId].IsCash))
            {
                db.CashMovements.Add(new CashMovement
                {
                    OrganizationId = tenant.OrganizationId,
                    CashShiftId = cashShift.CashShiftId,
                    MovementType = "INCOME",
                    Amount = split.Amount,
                    PaymentSplitId = split.PaymentSplitId,
                    Description = $"Cash component of {payment.ReceiptNumber}",
                    CreatedByUserId = actorUserId,
                    CreatedAtUtc = now
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        var paidByReceivable = await (
                from allocation in db.PaymentAllocations
                join p in db.Payments on allocation.PaymentId equals p.PaymentId
                where receivableIds.Contains(allocation.ReceivableId) && (p.Status == "COMPLETED" || p.Status == "PARTIALLY_REFUNDED")
                group allocation by allocation.ReceivableId into g
                select new { Id = g.Key, Paid = g.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.Id, x => x.Paid, cancellationToken);
        foreach (var receivable in receivables)
        {
            var paid = paidByReceivable.GetValueOrDefault(receivable.ReceivableId);
            receivable.Status = paid >= receivable.TotalAmount ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "OPEN";
        }
        await db.SaveChangesAsync(cancellationToken);
        if (request.OrderId is not null)
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE finance.Orders SET Status=CASE WHEN TotalAmount <= (SELECT COALESCE(SUM(TotalAmount),0) FROM finance.Payments WHERE OrganizationId={tenant.OrganizationId} AND OrderId={request.OrderId} AND Status='COMPLETED') THEN 'PAID' ELSE 'PARTIALLY_PAID' END,UpdatedAtUtc=SYSUTCDATETIME() WHERE OrganizationId={tenant.OrganizationId} AND OrderId={request.OrderId}", cancellationToken);
        await ReceptionAudit.WriteAsync(db, tenant.OrganizationId, actorUserId, "PAYMENT.CREATE", "Payment", payment.PublicId.ToString(), null, new { payment.PaymentId, payment.TotalAmount, RequestHash = ReceptionAudit.Hash(request) }, cancellationToken);
        if (tx is not null) await tx.CommitAsync(cancellationToken);

        return new PaymentResult(payment.PublicId,payment.PaymentId,payment.ReceiptNumber,payment.TotalAmount,payment.CurrencyCode,payment.Status,payment.ReceivedAtUtc);
    }
}
