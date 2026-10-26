using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class NotificationService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : INotificationService
{
    public async Task<PagedResult<NotificationItem>> MineAsync(long actorUserId, int page, int pageSize, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Notifications.AsNoTracking().Where(x => x.UserId == actorUserId);
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderByDescending(x => x.CreatedAtUtc).ThenByDescending(x => x.NotificationId)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new NotificationItem(x.NotificationId, x.NotificationType, x.Title, x.Body, x.Status, x.CreatedAtUtc, x.ReadAtUtc))
            .ToListAsync(cancellationToken);
        return new PagedResult<NotificationItem>(items, page, pageSize, total);
    }

    public async Task MarkReadAsync(long notificationId, long actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        var notification = await db.Notifications.SingleOrDefaultAsync(x => x.NotificationId == notificationId && x.UserId == actorUserId, cancellationToken)
            ?? throw new InvalidOperationException("Notification not found.");
        if (notification.ReadAtUtc is null)
        {
            notification.ReadAtUtc = clock.UtcNow;
            notification.Status = "READ";
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
