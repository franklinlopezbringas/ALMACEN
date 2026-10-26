using System.Data;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class ClassService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : IClassService
{
    public async Task<PagedResult<ClassSessionListItem>> UpcomingAsync(DateTime fromUtc, int page, int pageSize, CancellationToken cancellationToken)
    {
        page=Math.Max(1,page); pageSize=Math.Clamp(pageSize,1,100);
        var q = from s in db.ClassSessions.AsNoTracking()
                join c in db.Classes.AsNoTracking() on s.ClassId equals c.ClassId
                where s.StartsAtUtc>=fromUtc && s.Status!="CANCELLED"
                select new {s,c};
        var total=await q.LongCountAsync(cancellationToken);
        var rows=await q.OrderBy(x=>x.s.StartsAtUtc).ThenBy(x=>x.s.ClassSessionId).Skip((page-1)*pageSize).Take(pageSize)
            .Select(x=>new ClassSessionListItem(x.s.ClassSessionId,x.c.Name,x.s.StartsAtUtc,x.s.EndsAtUtc,x.s.Capacity,
                db.ClassReservations.LongCount(r=>r.ClassSessionId==x.s.ClassSessionId && (r.Status=="CONFIRMED" || r.Status=="ATTENDED")),x.s.Status,
                (from trainer in db.TrainerProfiles join employee in db.Employees on trainer.EmployeeId equals employee.EmployeeId
                 join person in db.People on employee.PersonId equals person.PersonId
                 where trainer.TrainerProfileId == x.s.TrainerProfileId
                 select person.FirstName + " " + person.LastName).FirstOrDefault(),
                Math.Max(0, x.s.Capacity - db.ClassReservations.LongCount(r => r.ClassSessionId == x.s.ClassSessionId && (r.Status == "CONFIRMED" || r.Status == "ATTENDED")))))
            .ToListAsync(cancellationToken);
        return new PagedResult<ClassSessionListItem>(rows,page,pageSize,total);
    }

    public async Task<PagedResult<ClassParticipantItem>> ParticipantsAsync(long sessionId, string? status, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        if (!await db.ClassSessions.AsNoTracking().AnyAsync(s => s.ClassSessionId == sessionId, cancellationToken))
            throw new KeyNotFoundException("Class session not found.");
        var q = from r in db.ClassReservations.AsNoTracking()
                join m in db.Members.AsNoTracking() on r.MemberId equals m.MemberId
                join p in db.People.AsNoTracking() on m.PersonId equals p.PersonId
                where r.ClassSessionId == sessionId && (status == null || r.Status == status)
                select new { r, m, p };
        var total = await q.LongCountAsync(cancellationToken);
        return new(await q.OrderBy(x => x.r.ReservedAtUtc).ThenBy(x => x.r.ClassReservationId).Skip((page - 1) * pageSize)
            .Take(pageSize).Select(x => new ClassParticipantItem(x.r.ClassReservationId, x.m.MemberId, x.m.MemberCode,
                x.p.FirstName + " " + x.p.LastName, x.r.Status, x.r.WaitlistPosition, x.r.ReservedAtUtc))
            .ToListAsync(cancellationToken), page, pageSize, total);
    }

    public async Task ReserveAsync(long classSessionId, ReserveClassRequest request, long actorUserId, CancellationToken cancellationToken, string source = "MEMBER_APP")
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,cancellationToken);
        await db.AcquireAsync(tenant.OrganizationId, $"class:{classSessionId}", cancellationToken);
        var session=await db.ClassSessions.SingleOrDefaultAsync(x=>x.ClassSessionId==classSessionId && (x.Status=="SCHEDULED" || x.Status=="OPEN"),cancellationToken)
                    ?? throw new InvalidOperationException("Class session not found.");
        if (session.StartsAtUtc<=clock.UtcNow) throw new InvalidOperationException("The class has already started.");
        if (!await db.Members.AsNoTracking().AnyAsync(x=>x.MemberId==request.MemberId && x.Status=="ACTIVE",cancellationToken))
            throw new InvalidOperationException("Member is invalid.");
        var existing = await db.ClassReservations.SingleOrDefaultAsync(x=>x.ClassSessionId==classSessionId && x.MemberId==request.MemberId,cancellationToken);
        if (existing is not null && existing.Status!="CANCELLED")
            throw new InvalidOperationException("Member already has a reservation.");

        var confirmed=await db.ClassReservations.CountAsync(x=>x.ClassSessionId==classSessionId && (x.Status=="CONFIRMED" || x.Status=="ATTENDED"),cancellationToken);
        var isWaitlist=confirmed>=session.Capacity;
        int? position=null;
        if (isWaitlist) position=(await db.ClassReservations.Where(x=>x.ClassSessionId==classSessionId && x.Status=="WAITLISTED").MaxAsync(x=>x.WaitlistPosition,cancellationToken) ?? 0)+1;
        var reservation = existing ?? new ClassReservation { OrganizationId=tenant.OrganizationId, ClassSessionId=classSessionId, MemberId=request.MemberId };
        reservation.Source=source;
        reservation.Status=isWaitlist?"WAITLISTED":"CONFIRMED";
        reservation.WaitlistPosition=position;
        reservation.ReservedAtUtc=clock.UtcNow;
        reservation.CancelledAtUtc=null;
        if (existing is null) db.ClassReservations.Add(reservation);
        await db.SaveChangesAsync(cancellationToken);
        await ReceptionAudit.WriteAsync(db,tenant.OrganizationId,actorUserId,"CLASS.RESERVE","ClassReservation",reservation.ClassReservationId.ToString(System.Globalization.CultureInfo.InvariantCulture),null,new {reservation.ClassSessionId,reservation.MemberId,reservation.Status,reservation.Source,reservation.ReservedAtUtc},cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }
}
