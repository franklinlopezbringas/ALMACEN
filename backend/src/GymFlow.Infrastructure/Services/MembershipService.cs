using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class MembershipService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : IMembershipService
{
    public async Task<PagedResult<MembershipListItem>> SearchAsync(MembershipQuery query, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, query.Page); var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var status = query.Status?.Trim().ToUpperInvariant(); var search = query.Search?.Trim();
        var today = DateOnly.FromDateTime(clock.UtcNow);
        if (!string.IsNullOrEmpty(status) && status is not ("PENDING" or "ACTIVE" or "FROZEN" or "EXPIRED" or "CANCELLED"))
            throw new ArgumentException("Unsupported membership status.");
        if (query.ExpiresFrom > query.ExpiresTo) throw new ArgumentException("Invalid expiration range.");
        var q = from ms in db.Memberships.AsNoTracking()
                join m in db.Members.AsNoTracking() on ms.MemberId equals m.MemberId
                join p in db.People.AsNoTracking() on m.PersonId equals p.PersonId
                join v in db.PlanVersions.AsNoTracking() on ms.PlanVersionId equals v.PlanVersionId
                join plan in db.Plans.AsNoTracking() on v.PlanId equals plan.PlanId
                let effectiveStatus = ms.Status == "ACTIVE" || ms.Status == "PENDING"
                    ? ms.EndDate < today ? "EXPIRED" : ms.StartDate > today ? "PENDING" : "ACTIVE" : ms.Status
                where (string.IsNullOrEmpty(status) || effectiveStatus == status)
                    && (query.ExpiresFrom == null || ms.EndDate >= query.ExpiresFrom)
                    && (query.ExpiresTo == null || ms.EndDate <= query.ExpiresTo)
                    && (query.MemberId == null || ms.MemberId == query.MemberId)
                    && (query.PlanId == null || plan.PlanId == query.PlanId)
                    && (string.IsNullOrEmpty(search) || (p.FirstName + " " + p.LastName).Contains(search) || m.MemberCode.Contains(search))
                select new { ms, m, p, v, plan, effectiveStatus };
        var total = await q.LongCountAsync(cancellationToken);
        return new(await q.OrderBy(x => x.ms.EndDate).ThenBy(x => x.ms.MembershipId).Skip((page - 1) * pageSize)
            .Take(pageSize).Select(x => new MembershipListItem(x.ms.PublicId, x.ms.MembershipId, x.m.MemberId, x.m.PublicId,
                x.m.MemberCode, x.p.FirstName + " " + x.p.LastName, x.plan.PlanId, x.v.PlanVersionId, x.plan.Name,
                x.ms.StartDate, x.ms.EndDate, x.effectiveStatus, x.ms.ContractedPrice, x.ms.CurrencyCode, x.ms.Status))
            .ToListAsync(cancellationToken), page, pageSize, total);
    }

    public async Task<MembershipResult> CreateAsync(CreateMembershipRequest request, long? actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
        var publicId = request.RequestId ?? Guid.NewGuid();
        if (publicId == Guid.Empty) throw new ArgumentException("RequestId must not be empty.");
        await db.AcquireAsync(tenant.OrganizationId, $"membership:{publicId}", cancellationToken);
        var existing = await db.Memberships.AsNoTracking().SingleOrDefaultAsync(m => m.PublicId == publicId, cancellationToken);
        if (existing is not null)
        {
            if (actorUserId is null) throw new InvalidOperationException("Actor required for replay.");
            await ReceptionAudit.VerifyReplayAsync(db, tenant.OrganizationId, actorUserId.Value, "MEMBERSHIP.CREATE", publicId.ToString(), request, cancellationToken);
            var debtId = await db.Receivables.AsNoTracking().Where(r => r.MembershipId == existing.MembershipId).Select(r => (long?)r.ReceivableId).SingleOrDefaultAsync(cancellationToken);
            if (tx is not null) await tx.CommitAsync(cancellationToken);
            return new(existing.PublicId,existing.MembershipId,existing.StartDate,existing.EndDate,existing.ContractedPrice,existing.CurrencyCode,existing.Status,debtId);
        }
        if (request.PreviousMembershipId is not null && !await db.Memberships.AsNoTracking().AnyAsync(m => m.MembershipId == request.PreviousMembershipId && m.MemberId == request.MemberId, cancellationToken)) throw new KeyNotFoundException();
        var member = await db.Members.SingleOrDefaultAsync(x => x.MemberId == request.MemberId && x.Status == "ACTIVE", cancellationToken)
                     ?? throw new InvalidOperationException("Member not found or inactive.");
        var version = await db.PlanVersions.SingleOrDefaultAsync(x => x.PlanVersionId == request.PlanVersionId && x.Status == "ACTIVE", cancellationToken)
                      ?? throw new InvalidOperationException("Plan version not found or inactive.");
        if (!await db.Plans.AsNoTracking().AnyAsync(x => x.PlanId == version.PlanId && x.Status == "ACTIVE", cancellationToken))
            throw new InvalidOperationException("Plan not found or inactive.");

        var endDate = CalculateEndDate(request.StartDate, version.DurationValue, version.DurationUnit);
        var today = DateOnly.FromDateTime(clock.UtcNow);
        var status = request.StartDate > today ? "PENDING" : endDate < today ? "EXPIRED" : "ACTIVE";

        var membership = new Membership
        {
            OrganizationId = tenant.OrganizationId,
            PublicId = publicId,
            PreviousMembershipId = request.PreviousMembershipId,
            MemberId = member.MemberId,
            PlanVersionId = version.PlanVersionId,
            HomeBranchId = request.HomeBranchId ?? member.HomeBranchId,
            StartDate = request.StartDate,
            EndDate = endDate,
            ContractedPrice = version.Price,
            CurrencyCode = version.CurrencyCode,
            Status = status,
            Origin = NormalizeOrigin(request.Origin),
            CreatedByUserId = actorUserId
        };
        db.Memberships.Add(membership);
        await db.SaveChangesAsync(cancellationToken);

        var receivable = new Receivable
        {
            OrganizationId = tenant.OrganizationId,
            MemberId = member.MemberId,
            MembershipId = membership.MembershipId,
            Description = $"Membership #{membership.MembershipId}",
            TotalAmount = membership.ContractedPrice,
            CurrencyCode = membership.CurrencyCode,
            DueDate = request.StartDate,
            Status = "OPEN"
        };
        // Canonical plans allow zero prices; receivables require a positive amount.
        if (membership.ContractedPrice > 0)
        {
            db.Receivables.Add(receivable);
            await db.SaveChangesAsync(cancellationToken);
        }
        if (actorUserId is not null) await ReceptionAudit.WriteAsync(db, tenant.OrganizationId, actorUserId.Value, "MEMBERSHIP.CREATE", "Membership", publicId.ToString(), null, new { membership.MembershipId, request.PreviousMembershipId, RequestHash = ReceptionAudit.Hash(request) }, cancellationToken);
        if (tx is not null) await tx.CommitAsync(cancellationToken);

        return new MembershipResult(membership.PublicId,membership.MembershipId,membership.StartDate,membership.EndDate,membership.ContractedPrice,membership.CurrencyCode,membership.Status,membership.ContractedPrice > 0 ? receivable.ReceivableId : null);
    }

    public async Task<IReadOnlyList<ExpiringMembershipItem>> ExpiringAsync(int days, int take, CancellationToken cancellationToken)
    {
        days = Math.Clamp(days, 1, 90);
        take = Math.Clamp(take, 1, 100);
        var today = DateOnly.FromDateTime(clock.UtcNow);
        var until = today.AddDays(days);

        return await (
            from ms in db.Memberships.AsNoTracking()
            join m in db.Members.AsNoTracking() on ms.MemberId equals m.MemberId
            join p in db.People.AsNoTracking() on m.PersonId equals p.PersonId
            join pv in db.PlanVersions.AsNoTracking() on ms.PlanVersionId equals pv.PlanVersionId
            join plan in db.Plans.AsNoTracking() on pv.PlanId equals plan.PlanId
            where ms.Status == "ACTIVE" && ms.EndDate >= today && ms.EndDate <= until
            orderby ms.EndDate, ms.MembershipId
            select new ExpiringMembershipItem(ms.PublicId,m.MemberId,m.MemberCode,p.FirstName + " " + p.LastName,ms.EndDate,ms.EndDate.DayNumber-today.DayNumber,plan.Name))
            .Take(take).ToListAsync(cancellationToken);
    }

    private static DateOnly CalculateEndDate(DateOnly start, int value, string unit) => unit switch
    {
        "DAY" => start.AddDays(value - 1),
        "WEEK" => start.AddDays(value * 7 - 1),
        "MONTH" => start.AddMonths(value).AddDays(-1),
        "YEAR" => start.AddYears(value).AddDays(-1),
        _ => throw new InvalidOperationException("Unsupported plan duration unit.")
    };

    private static string NormalizeOrigin(string origin)
    {
        var value = origin.Trim().ToUpperInvariant();
        return value is "WEB" or "RECEPTION" or "ADMIN" or "PROMOTION" or "MIGRATION" ? value : "RECEPTION";
    }
}
