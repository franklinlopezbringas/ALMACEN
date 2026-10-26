using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class AccessService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : IAccessService
{
    public async Task<CheckInResult> CheckInAsync(CheckInRequest request, long? actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        var now = clock.UtcNow;
        var today = DateOnly.FromDateTime(now);

        var branchExists = await db.Branches.AsNoTracking().AnyAsync(x => x.BranchId == request.BranchId && x.Status == "ACTIVE", cancellationToken);
        if (!branchExists) throw new InvalidOperationException("Branch is invalid.");

        var member = await db.Members.AsNoTracking().SingleOrDefaultAsync(x => x.MemberId == request.MemberId, cancellationToken)
            ?? throw new InvalidOperationException("Member not found.");
        if (member.Status != "ACTIVE") return await RecordAsync(false,"DENIED","MEMBER_INACTIVE",null,request,actorUserId,now,cancellationToken);

        var hasMembership = await db.Memberships.AsNoTracking().AnyAsync(x => x.MemberId == request.MemberId && x.Status == "ACTIVE" && x.StartDate <= today && x.EndDate >= today, cancellationToken);
        if (hasMembership) return await RecordAsync(true,"ALLOWED",null,null,request,actorUserId,now,cancellationToken);

        var exception = await db.AccessExceptions.AsNoTracking()
            .Where(x => x.MemberId == request.MemberId && x.Status == "APPROVED" && x.ValidFromUtc <= now && x.ValidToUtc >= now)
            .OrderByDescending(x => x.ValidToUtc).FirstOrDefaultAsync(cancellationToken);
        if (exception is not null) return await RecordAsync(true,"EXCEPTION","AUTHORIZED_EXCEPTION",exception.AccessExceptionId,request,actorUserId,now,cancellationToken);

        return await RecordAsync(false,"DENIED","NO_ACTIVE_MEMBERSHIP",null,request,actorUserId,now,cancellationToken);
    }

    private async Task<CheckInResult> RecordAsync(bool allowed,string result,string? reason,long? exceptionId,CheckInRequest request,long? actor,DateTime now,CancellationToken ct)
    {
        var method = request.AccessMethod.Trim().ToUpperInvariant();
        if (method is not ("QR" or "BIOMETRIC" or "CARD" or "MANUAL")) method = "MANUAL";
        var entry = new AttendanceEvent
        {
            OrganizationId = tenant.OrganizationId,
            BranchId = request.BranchId,
            MemberId = request.MemberId,
            EventType = "ENTRY",
            AccessMethod = method,
            Result = result,
            OccurredAtUtc = now,
            AccessExceptionId = exceptionId,
            DeviceId = request.DeviceId,
            RegisteredByUserId = actor,
            ReasonCode = reason
        };
        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(ct) : null;
        db.AttendanceEvents.Add(entry);
        await db.SaveChangesAsync(ct);
        if (actor is not null) await ReceptionAudit.WriteAsync(db, tenant.OrganizationId, actor.Value, "ACCESS.CHECKIN", "AttendanceEvent", entry.AttendanceEventId.ToString(System.Globalization.CultureInfo.InvariantCulture), null, new { request.MemberId, result, reason }, ct);
        if (tx is not null) await tx.CommitAsync(ct);
        return new CheckInResult(allowed,result,reason,entry.AttendanceEventId,entry.OccurredAtUtc);
    }
}
