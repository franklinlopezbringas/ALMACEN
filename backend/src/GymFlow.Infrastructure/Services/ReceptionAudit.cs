using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

internal static class ReceptionAudit
{
    public static string Hash(object request) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request))));
    public static Task WriteAsync(GymFlowDbContext db, long org, long actor, string action, string entity, string id, object? before, object after, CancellationToken ct)
    {
        var beforeJson = before is null ? null : JsonSerializer.Serialize(before);
        var afterJson = JsonSerializer.Serialize(after);
        return db.Database.ExecuteSqlInterpolatedAsync($"INSERT audit.AuditLogs(OrganizationId,UserId,Action,EntityType,EntityId,BeforeJson,AfterJson) VALUES({org},{actor},{action},{entity},{id},{beforeJson},{afterJson})", ct);
    }
    public static async Task VerifyReplayAsync(GymFlowDbContext db, long org, long actor, string action, string id, object request, CancellationToken ct)
    {
        var hash = Hash(request);
        var matches = await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM audit.AuditLogs WHERE OrganizationId={org} AND UserId={actor} AND Action={action} AND EntityId={id} AND JSON_VALUE(AfterJson,'$.RequestHash')={hash}").SingleAsync(ct);
        if (matches != 1) throw new InvalidOperationException("Request identifier was already used for a different operation.");
    }
}
