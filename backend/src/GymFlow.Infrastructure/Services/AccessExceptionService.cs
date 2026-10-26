using System.Globalization;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace GymFlow.Infrastructure.Services;
public sealed class AccessExceptionService(GymFlowDbContext db,ICurrentTenant tenant,IClock clock)
{
    private IQueryable<ExceptionItem> Items() => db.Database.SqlQuery<ExceptionItem>($"SELECT e.AccessExceptionId,e.MemberId,p.FirstName+' '+p.LastName AS FullName,e.Reason,e.Status,e.ValidFromUtc,e.ValidToUtc,e.RequestedByUserId,e.ReviewedByUserId,e.RequestedAtUtc,e.ReviewedAtUtc FROM access.AccessExceptions e JOIN core.Members m ON m.OrganizationId=e.OrganizationId AND m.MemberId=e.MemberId JOIN core.People p ON p.OrganizationId=m.OrganizationId AND p.PersonId=m.PersonId WHERE e.OrganizationId={tenant.OrganizationId}");
    public Task<PagedResult<ExceptionItem>> ListAsync(long? memberId,int page,int size,CancellationToken ct) => HandoffService.PageAsync(Items().Where(e=>memberId==null || e.MemberId==memberId).OrderByDescending(e=>e.RequestedAtUtc).ThenByDescending(e=>e.AccessExceptionId),page,size,ct);
    public async Task<ExceptionItem> RequestAsync(ExceptionRequest request,long actor,CancellationToken ct)
    {
        if(string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length>500 || request.ValidFromUtc>=request.ValidToUtc || request.ValidToUtc<=clock.UtcNow) throw new ArgumentException("Provide a reason and a valid time window.");
        await using var tx=db.Database.CurrentTransaction is null?await db.Database.BeginTransactionAsync(ct):null;
        var replay=await OperationReplay.FindAsync(db,tenant.OrganizationId,actor,"EXCEPTION.REQUEST",request.RequestId,request,ct);
        if(replay is not null) return await Items().SingleAsync(e=>e.AccessExceptionId==replay,ct);
        if(!await db.Members.AsNoTracking().AnyAsync(m=>m.MemberId==request.MemberId,ct)) throw new KeyNotFoundException();
        var row=new GymFlow.Domain.Entities.AccessException {OrganizationId=tenant.OrganizationId,MemberId=request.MemberId,Reason=request.Reason.Trim(),ValidFromUtc=request.ValidFromUtc,ValidToUtc=request.ValidToUtc,RequestedByUserId=actor,RequestedAtUtc=clock.UtcNow};
        db.AccessExceptions.Add(row);await db.SaveChangesAsync(ct);
        await OperationReplay.WriteAsync(db,tenant.OrganizationId,actor,"EXCEPTION.REQUEST","AccessException",request.RequestId,row.AccessExceptionId,request,ct);
        if(tx is not null) await tx.CommitAsync(ct);
        return await Items().SingleAsync(e=>e.AccessExceptionId==row.AccessExceptionId,ct);
    }
    public async Task ReviewAsync(long id,ExceptionReviewRequest request,long actor,CancellationToken ct)
    {
        if(request.Status is not ("APPROVED" or "REJECTED")) throw new ArgumentException("Invalid review status.");
        await using var tx=db.Database.CurrentTransaction is null?await db.Database.BeginTransactionAsync(ct):null;
        await db.AcquireAsync(tenant.OrganizationId,$"exception:{id}",ct);
        var row=await db.AccessExceptions.SingleOrDefaultAsync(e=>e.AccessExceptionId==id,ct)??throw new KeyNotFoundException();
        if(row.Status!="REQUESTED") throw new InvalidOperationException("This request was already reviewed.");
        row.Status=request.Status;row.ReviewedByUserId=actor;row.ReviewedAtUtc=clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await ReceptionAudit.WriteAsync(db,tenant.OrganizationId,actor,"EXCEPTION.REVIEW","AccessException",id.ToString(CultureInfo.InvariantCulture),new {Status="REQUESTED"},new {row.Status,row.ReviewedByUserId,row.ReviewedAtUtc},ct);
        // An approval deliberately creates no AttendanceEvent. Only a physical check-in does.
        if(tx is not null) await tx.CommitAsync(ct);
    }
}
