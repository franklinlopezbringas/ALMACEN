using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Persistence;

internal static class TransactionLocks
{
    // Transaction-owned SQL locks coordinate every API process, including empty aggregates.
    public static Task AcquireAsync(this GymFlowDbContext db, long organizationId, string resource, CancellationToken ct)
    {
        var key = $"GymFlow:{organizationId}:{resource}";
        return db.Database.ExecuteSqlInterpolatedAsync($"""
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock @Resource={key}, @LockMode='Exclusive',
                @LockOwner='Transaction', @LockTimeout=15000;
            IF @result < 0 THROW 51030, 'Concurrent operation could not acquire its transaction lock.', 1;
            """, ct);
    }
}
