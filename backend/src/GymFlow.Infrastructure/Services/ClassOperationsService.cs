using System.Globalization;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace GymFlow.Infrastructure.Services;
public sealed class ClassOperationsService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock)
{
    public async Task TransitionAsync(long id,ClassTransitionRequest request,long actor,CancellationToken ct)
    {
        if(request.Status is not ("CANCELLED" or "ATTENDED" or "NO_SHOW")) throw new ArgumentException("Invalid reservation action.");
        await using var tx=db.Database.CurrentTransaction is null?await db.Database.BeginTransactionAsync(ct):null;
        var payload=new {Id=id,Request=request};
        if(await OperationReplay.FindAsync(db,tenant.OrganizationId,actor,"CLASS.TRANSITION",request.RequestId,payload,ct) is not null) return;
        var sessionId=await db.ClassReservations.AsNoTracking().Where(r=>r.ClassReservationId==id).Select(r=>(long?)r.ClassSessionId).SingleOrDefaultAsync(ct)??throw new KeyNotFoundException();
        await db.AcquireAsync(tenant.OrganizationId,$"class:{sessionId}",ct);
        var row=await db.ClassReservations.SingleAsync(r=>r.ClassReservationId==id,ct);
        var session=await db.ClassSessions.AsNoTracking().SingleAsync(s=>s.ClassSessionId==sessionId,ct);
        if(row.ReservedAtUtc!=request.ReservedAtUtc) throw new DbUpdateConcurrencyException("Reservation was replaced. Reload participants.");
        if(session.Status=="CANCELLED") throw new InvalidOperationException("Session is cancelled.");
        if(request.Status=="CANCELLED")
        {
            if(clock.UtcNow>=session.StartsAtUtc || row.Status is not ("CONFIRMED" or "WAITLISTED")) throw new InvalidOperationException("Only upcoming reservations can be cancelled.");
            var free=row.Status=="CONFIRMED";
            row.Status="CANCELLED";row.WaitlistPosition=null;row.CancelledAtUtc=clock.UtcNow;
            if(free)
            {
                var next=await db.ClassReservations.Where(r=>r.ClassSessionId==sessionId && r.Status=="WAITLISTED" && db.Members.Any(m=>m.MemberId==r.MemberId && m.Status=="ACTIVE"))
                    .OrderBy(r=>r.WaitlistPosition).ThenBy(r=>r.ReservedAtUtc).ThenBy(r=>r.ClassReservationId).FirstOrDefaultAsync(ct);
                if(next is not null)
                {
                    next.Status="CONFIRMED";next.WaitlistPosition=null;
                    await ReceptionAudit.WriteAsync(db,tenant.OrganizationId,actor,"CLASS.PROMOTE","ClassReservation",next.ClassReservationId.ToString(CultureInfo.InvariantCulture),new {Status="WAITLISTED"},new {next.Status},ct);
                }
            }
        }
        else
        {
            if(row.Status!="CONFIRMED" || clock.UtcNow<session.StartsAtUtc || request.Status=="NO_SHOW" && clock.UtcNow<session.EndsAtUtc) throw new InvalidOperationException("The session time or reservation status does not permit this action.");
            row.Status=request.Status;if(request.Status=="ATTENDED") row.AttendedAtUtc=clock.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        await OperationReplay.WriteAsync(db,tenant.OrganizationId,actor,"CLASS.TRANSITION","ClassReservation",request.RequestId,id,payload,ct);
        await ReceptionAudit.WriteAsync(db,tenant.OrganizationId,actor,"CLASS."+request.Status,"ClassReservation",id.ToString(CultureInfo.InvariantCulture),null,new {row.Status,row.AttendedAtUtc,row.CancelledAtUtc},ct);
        if(tx is not null) await tx.CommitAsync(ct);
    }
}
