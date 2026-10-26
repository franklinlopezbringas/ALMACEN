using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class PublicCatalogService(GymFlowDbContext db, IClock clock) : IPublicCatalogService
{
    public async Task<IReadOnlyList<PublicPlanItem>> PlansAsync(Guid organizationPublicId, CancellationToken cancellationToken)
    {
        var organizationId = await db.Organizations.AsNoTracking()
            .Where(x => x.PublicId == organizationPublicId && x.Status == "ACTIVE")
            .Select(x => (long?)x.OrganizationId)
            .SingleOrDefaultAsync(cancellationToken);
        if (organizationId is null) return [];

        var today = DateOnly.FromDateTime(clock.UtcNow);
        return await (
            from plan in db.Plans.IgnoreQueryFilters().AsNoTracking()
            from version in db.PlanVersions.IgnoreQueryFilters().AsNoTracking()
                .Where(v => v.OrganizationId == organizationId.Value && v.PlanId == plan.PlanId && v.Status == "ACTIVE"
                            && v.ValidFrom <= today && (v.ValidTo == null || v.ValidTo >= today))
                .OrderByDescending(v => v.VersionNumber).Take(1)
            where plan.OrganizationId == organizationId.Value && plan.IsPublic && plan.Status == "ACTIVE"
            orderby version.Price, plan.Name
            select new PublicPlanItem(plan.PublicId, plan.Code, plan.Name, plan.Description, version.Price, version.CurrencyCode,
                version.DurationValue, version.DurationUnit, version.FreezeDaysLimit))
            .Take(100).ToListAsync(cancellationToken);
    }
}
