using System.Globalization;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class HandoffService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock)
{
    public async Task<long> EmployeeAsync(long actor, CancellationToken ct)
        => await (from e in db.Employees.AsNoTracking() join u in db.UserOrganizations.AsNoTracking() on e.PersonId equals u.PersonId
                  where u.UserId == actor && u.Status == "ACTIVE" && e.Status == "ACTIVE" select (long?)e.EmployeeId).SingleOrDefaultAsync(ct)
            ?? throw new UnauthorizedAccessException("An active employee profile is required.");

    private IQueryable<Employee> EligibleEmployees() => db.Employees.AsNoTracking().Where(e => e.Status == "ACTIVE" &&
        (from u in db.UserOrganizations join ur in db.UserRoles on u.UserOrganizationId equals ur.UserOrganizationId
         join r in db.Roles on ur.RoleId equals r.RoleId
         where u.PersonId == e.PersonId && u.Status == "ACTIVE" && (r.Code == "RECEPTION" || r.Code == "ADMIN") select u.UserId).Any());

    public Task<PagedResult<ReceptionEmployeeItem>> EmployeesAsync(int page, int size, CancellationToken ct)
        => PageAsync(from e in EligibleEmployees() join p in db.People.AsNoTracking() on e.PersonId equals p.PersonId orderby p.FirstName, e.EmployeeId select new ReceptionEmployeeItem(e.EmployeeId,p.FirstName+" "+p.LastName),page,size,ct);

    private IQueryable<HandoffItem> Items() => db.Database.SqlQuery<HandoffItem>($"SELECT h.ShiftHandoffId,h.BranchId,h.FromEmployeeId,p.FirstName+' '+p.LastName AS FromName,h.ToEmployeeId,t.FirstName+' '+t.LastName AS ToName,h.CashShiftId,h.Status,h.Notes,h.PendingItems,h.HandedOffAtUtc,h.AcknowledgedAtUtc,h.CreatedByUserId,h.RowVersion FROM core.ShiftHandoffs h JOIN core.Employees e ON e.OrganizationId=h.OrganizationId AND e.EmployeeId=h.FromEmployeeId JOIN core.People p ON p.OrganizationId=e.OrganizationId AND p.PersonId=e.PersonId LEFT JOIN core.Employees te ON te.OrganizationId=h.OrganizationId AND te.EmployeeId=h.ToEmployeeId LEFT JOIN core.People t ON t.OrganizationId=te.OrganizationId AND t.PersonId=te.PersonId WHERE h.OrganizationId={tenant.OrganizationId}");

    public async Task<PagedResult<HandoffItem>> ListAsync(long actor, long? branchId, int page, int size, CancellationToken ct)
    {
        var employee = await EmployeeAsync(actor,ct);
        return await PageAsync(Items().Where(h => (branchId==null || h.BranchId==branchId) && (h.FromEmployeeId==employee || h.ToEmployeeId==employee || h.ToEmployeeId==null && h.Status=="PENDING")).OrderByDescending(h=>h.HandedOffAtUtc).ThenByDescending(h=>h.ShiftHandoffId),page,size,ct);
    }
    public async Task<HandoffItem> CreateAsync(CreateHandoffRequest request,long actor,CancellationToken ct)
    {
        if (request.Notes?.Length>2000 || request.PendingItems?.Length>4000) throw new ArgumentException("Handoff text is too long.");
        await using var tx=db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(ct):null;
        var replay=await OperationReplay.FindAsync(db,tenant.OrganizationId,actor,"HANDOFF.CREATE",request.RequestId,request,ct);
        if(replay is not null) return await Items().SingleAsync(h=>h.ShiftHandoffId==replay,ct);
        var employee=await EmployeeAsync(actor,ct);
        if(!await db.Branches.AsNoTracking().AnyAsync(b=>b.BranchId==request.BranchId && b.Status=="ACTIVE",ct)) throw new KeyNotFoundException();
        if(request.ToEmployeeId is not null && !await EligibleEmployees().AnyAsync(e=>e.EmployeeId==request.ToEmployeeId,ct)) throw new KeyNotFoundException();
        if(request.CashShiftId is not null && !await (from s in db.CashShifts.AsNoTracking() join r in db.CashRegisters.AsNoTracking() on s.CashRegisterId equals r.CashRegisterId where s.CashShiftId==request.CashShiftId && s.EmployeeId==employee && r.BranchId==request.BranchId && s.OpenedByUserId==actor select s).AnyAsync(ct)) throw new KeyNotFoundException();
        var row=new ShiftHandoff {OrganizationId=tenant.OrganizationId,BranchId=request.BranchId,FromEmployeeId=employee,ToEmployeeId=request.ToEmployeeId,CashShiftId=request.CashShiftId,Notes=request.Notes?.Trim(),PendingItems=request.PendingItems?.Trim(),HandedOffAtUtc=clock.UtcNow,CreatedAtUtc=clock.UtcNow,CreatedByUserId=actor};
        db.ShiftHandoffs.Add(row); await db.SaveChangesAsync(ct);
        await OperationReplay.WriteAsync(db,tenant.OrganizationId,actor,"HANDOFF.CREATE","ShiftHandoff",request.RequestId,row.ShiftHandoffId,request,ct);
        if(tx is not null) await tx.CommitAsync(ct);
        return await Items().SingleAsync(h=>h.ShiftHandoffId==row.ShiftHandoffId,ct);
    }
    public async Task<HandoffItem> TransitionAsync(long id,HandoffTransitionRequest request,long actor,bool acknowledge,CancellationToken ct)
    {
        var employee=await EmployeeAsync(actor,ct);
        await using var tx=db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(ct):null;
        await db.AcquireAsync(tenant.OrganizationId,$"handoff:{id}",ct);
        var row=await db.ShiftHandoffs.SingleOrDefaultAsync(h=>h.ShiftHandoffId==id,ct) ?? throw new KeyNotFoundException();
        if(acknowledge ? row.ToEmployeeId is not null && row.ToEmployeeId!=employee : row.CreatedByUserId!=actor) throw new UnauthorizedAccessException("Only the recipient can acknowledge, and only the sender can cancel.");
        if(request.RowVersion is null || !row.RowVersion.SequenceEqual(request.RowVersion)) throw new DbUpdateConcurrencyException();
        if(row.Status!="PENDING") throw new InvalidOperationException("This handoff has already been completed.");
        var before=new {row.Status,row.ToEmployeeId};
        row.Status=acknowledge?"ACKNOWLEDGED":"CANCELLED";
        if(acknowledge){row.ToEmployeeId=employee;row.AcknowledgedAtUtc=clock.UtcNow;}
        await db.SaveChangesAsync(ct);
        await ReceptionAudit.WriteAsync(db,tenant.OrganizationId,actor,acknowledge?"HANDOFF.ACKNOWLEDGE":"HANDOFF.CANCEL","ShiftHandoff",id.ToString(CultureInfo.InvariantCulture),before,new {row.Status,row.ToEmployeeId,row.AcknowledgedAtUtc},ct);
        if(tx is not null) await tx.CommitAsync(ct);
        return await Items().SingleAsync(h=>h.ShiftHandoffId==id,ct);
    }
    internal static async Task<PagedResult<T>> PageAsync<T>(IQueryable<T> q,int page,int size,CancellationToken ct)
    {
        page=Math.Clamp(page,1,1000000);size=Math.Clamp(size,1,100);
        return new(await q.Skip((page-1)*size).Take(size).ToListAsync(ct),page,size,await q.LongCountAsync(ct));
    }
}
