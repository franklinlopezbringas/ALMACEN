using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class DashboardService(GymFlowDbContext db, IClock clock) : IDashboardService
{
    public async Task<DashboardSummary> GetSummaryAsync(CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(clock.UtcNow);
        var next7 = today.AddDays(7);
        var dayStart = clock.UtcNow.Date;
        var dayEnd = dayStart.AddDays(1);

        var activeMembers = await db.Members.AsNoTracking().LongCountAsync(x => x.Status == "ACTIVE", cancellationToken);
        var expiring = await db.Memberships.AsNoTracking().LongCountAsync(x => x.Status == "ACTIVE" && x.EndDate >= today && x.EndDate <= next7, cancellationToken);
        var outstanding = await db.ReceivableBalances.AsNoTracking().Where(x => x.Status == "OPEN" || x.Status == "PARTIALLY_PAID").SumAsync(x => x.BalanceAmount, cancellationToken);
        var entries = await db.AttendanceEvents.AsNoTracking().LongCountAsync(x => x.EventType == "ENTRY" && (x.Result == "ALLOWED" || x.Result == "EXCEPTION") && x.OccurredAtUtc >= dayStart && x.OccurredAtUtc < dayEnd, cancellationToken);
        return new DashboardSummary(activeMembers,expiring,outstanding,entries);
    }
}
