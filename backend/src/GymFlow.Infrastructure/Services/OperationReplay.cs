using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

internal static class OperationReplay
{
    public static async Task<long?> FindAsync(GymFlowDbContext db, long org, long actor, string action, Guid key, object request, CancellationToken ct)
    {
        if (key == Guid.Empty) throw new ArgumentException("RequestId is required.");
        await db.AcquireAsync(org, $"request:{action}:{key}", ct);
        var id = key.ToString();
        var rows = await db.Database.SqlQuery<long>($"SELECT CAST(JSON_VALUE(AfterJson,'$.Id') AS bigint) AS Value FROM audit.AuditLogs WHERE OrganizationId={org} AND Action={action} AND EntityId={id}").ToListAsync(ct);
        if (rows.Count == 0) return null;
        await ReceptionAudit.VerifyReplayAsync(db, org, actor, action, id, request, ct);
        return rows.Single();
    }
    public static Task WriteAsync(GymFlowDbContext db, long org, long actor, string action, string entity, Guid key, long id, object request, CancellationToken ct)
        => ReceptionAudit.WriteAsync(db, org, actor, action, entity, key.ToString(), null, new { Id = id, RequestHash = ReceptionAudit.Hash(request) }, ct);
}
