using System.Data;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class LoyaltyService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : ILoyaltyService
{
    public async Task<PointBalanceResult> GetBalanceAsync(long memberId, CancellationToken cancellationToken)
    {
        var account = await db.PointAccounts.AsNoTracking().SingleOrDefaultAsync(x => x.MemberId == memberId, cancellationToken);
        return account is null
            ? new PointBalanceResult(memberId, 0, 0, 0)
            : new PointBalanceResult(memberId, account.CurrentBalance, account.LifetimeEarned, account.LifetimeRedeemed);
    }

    public async Task<PagedResult<PointTransactionItem>> GetTransactionsAsync(long memberId, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var accountId = await db.PointAccounts.AsNoTracking().Where(x => x.MemberId == memberId).Select(x => (long?)x.PointAccountId).SingleOrDefaultAsync(cancellationToken);
        if (accountId is null) return new PagedResult<PointTransactionItem>([], page, pageSize, 0);

        var query = db.PointTransactions.AsNoTracking().Where(x => x.PointAccountId == accountId.Value);
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderByDescending(x => x.CreatedAtUtc).ThenByDescending(x => x.PointTransactionId)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new PointTransactionItem(x.PointTransactionId, x.TransactionType, x.Points, x.ReasonCode, x.Description, x.CreatedAtUtc))
            .ToListAsync(cancellationToken);
        return new PagedResult<PointTransactionItem>(items, page, pageSize, total);
    }

    public async Task<PagedResult<RewardItem>> RewardsAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Rewards.AsNoTracking().Where(x => x.Status == "ACTIVE");
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(x => x.PointsCost).ThenBy(x => x.Name).ThenBy(x => x.RewardId)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new RewardItem(x.PublicId, x.RewardType, x.Name, x.Description, x.PointsCost, x.Status))
            .ToListAsync(cancellationToken);
        return new PagedResult<RewardItem>(items, page, pageSize, total);
    }

    public async Task<RedemptionResult> RedeemAsync(RedeemRewardRequest request, long actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        await db.AcquireAsync(tenant.OrganizationId, $"reward:{request.RewardId}", cancellationToken);
        await db.AcquireAsync(tenant.OrganizationId, $"points:{request.MemberId}", cancellationToken);

        var reward = await db.Rewards.SingleOrDefaultAsync(x => x.RewardId == request.RewardId && x.Status == "ACTIVE", cancellationToken)
            ?? throw new InvalidOperationException("Reward is not available.");
        if (!await db.Members.AsNoTracking().AnyAsync(x => x.MemberId == request.MemberId && x.Status == "ACTIVE", cancellationToken))
            throw new InvalidOperationException("Member is invalid or inactive.");

        if (reward.StockLimit is not null)
        {
            var consumed = await db.RewardRedemptions.CountAsync(x => x.RewardId == reward.RewardId && x.Status != "CANCELLED" && x.Status != "EXPIRED", cancellationToken);
            if (consumed >= reward.StockLimit.Value) throw new InvalidOperationException("Reward stock is exhausted.");
        }

        var account = await db.PointAccounts.SingleOrDefaultAsync(x => x.MemberId == request.MemberId, cancellationToken);
        if (account is null || account.CurrentBalance < reward.PointsCost) throw new InvalidOperationException("Insufficient GymPoints.");

        account.CurrentBalance -= reward.PointsCost;
        account.LifetimeRedeemed += reward.PointsCost;
        var pointTransaction = new PointTransaction
        {
            OrganizationId = tenant.OrganizationId,
            PointAccountId = account.PointAccountId,
            TransactionType = "REDEEM",
            Points = reward.PointsCost,
            ReasonCode = "REWARD_REDEMPTION",
            Description = reward.Name,
            CreatedByUserId = actorUserId,
            CreatedAtUtc = clock.UtcNow
        };
        db.PointTransactions.Add(pointTransaction);

        var redemption = new RewardRedemption
        {
            OrganizationId = tenant.OrganizationId,
            RewardId = reward.RewardId,
            MemberId = request.MemberId,
            PointsSpent = reward.PointsCost,
            RedemptionCode = "CANJE-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            Status = "PENDING",
            RequestedAtUtc = clock.UtcNow
        };
        db.RewardRedemptions.Add(redemption);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return new RedemptionResult(redemption.RewardRedemptionId, redemption.RedemptionCode, redemption.PointsSpent, redemption.Status);
    }
}
