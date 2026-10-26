using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace GymFlow.Infrastructure.Services;
public sealed class SupportService(GymFlowDbContext db,ICurrentTenant tenant)
{
    public Task<PagedResult<IncidentItem>> IncidentsAsync(long actor,int page,int size,CancellationToken ct) => HandoffService.PageAsync(db.Database.SqlQuery<IncidentItem>($"SELECT t.SupportTicketId,t.MemberId,p.FirstName+' '+p.LastName AS MemberName,t.ConversationId,t.Category,t.Priority,t.Status,t.Subject,t.CreatedAtUtc FROM communication.SupportTickets t LEFT JOIN core.Members m ON m.OrganizationId=t.OrganizationId AND m.MemberId=t.MemberId LEFT JOIN core.People p ON p.OrganizationId=m.OrganizationId AND p.PersonId=m.PersonId WHERE t.OrganizationId={tenant.OrganizationId} AND (t.CreatedByUserId={actor} OR t.AssignedToUserId={actor} OR EXISTS(SELECT 1 FROM communication.ConversationParticipants cp WHERE cp.OrganizationId=t.OrganizationId AND cp.ConversationId=t.ConversationId AND cp.UserId={actor} AND cp.LeftAtUtc IS NULL))").OrderByDescending(t=>t.CreatedAtUtc).ThenByDescending(t=>t.SupportTicketId),page,size,ct);
    public async Task<long> CreateAsync(IncidentRequest request,long actor,CancellationToken ct)
    {
        if(request.Category is not ("ACCESS" or "PAYMENT" or "MEMBERSHIP" or "PRODUCT" or "CLASS" or "GENERAL") || request.Priority is not ("LOW" or "NORMAL" or "HIGH" or "URGENT") || string.IsNullOrWhiteSpace(request.Subject) || request.Subject.Length>200 || string.IsNullOrWhiteSpace(request.Description) || request.Description.Length>4000) throw new ArgumentException("Complete the incident category, priority, subject and description.");
        await using var tx=db.Database.CurrentTransaction is null?await db.Database.BeginTransactionAsync(ct):null;
        var replay=await OperationReplay.FindAsync(db,tenant.OrganizationId,actor,"INCIDENT.CREATE",request.RequestId,request,ct);if(replay is not null) return replay.Value;
        if(request.MemberId is not null && !await db.Members.AsNoTracking().AnyAsync(m=>m.MemberId==request.MemberId,ct)) throw new KeyNotFoundException();
        var conversation=(await db.Database.SqlQuery<long>($"INSERT communication.Conversations(OrganizationId,ConversationType,Subject) OUTPUT INSERTED.ConversationId AS Value VALUES({tenant.OrganizationId},'SUPPORT',{request.Subject.Trim()})").ToListAsync(ct)).Single();
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT communication.ConversationParticipants(OrganizationId,ConversationId,UserId) VALUES({tenant.OrganizationId},{conversation},{actor})",ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT communication.Messages(OrganizationId,ConversationId,SenderUserId,Body) VALUES({tenant.OrganizationId},{conversation},{actor},{request.Description.Trim()})",ct);
        var id=(await db.Database.SqlQuery<long>($"INSERT communication.SupportTickets(OrganizationId,MemberId,ConversationId,CreatedByUserId,Category,Priority,Subject) OUTPUT INSERTED.SupportTicketId AS Value VALUES({tenant.OrganizationId},{request.MemberId},{conversation},{actor},{request.Category},{request.Priority},{request.Subject.Trim()})").ToListAsync(ct)).Single();
        await OperationReplay.WriteAsync(db,tenant.OrganizationId,actor,"INCIDENT.CREATE","SupportTicket",request.RequestId,id,request,ct);
        if(tx is not null) await tx.CommitAsync(ct);return id;
    }
    public Task<PagedResult<ConversationItem>> ConversationsAsync(long actor,int page,int size,CancellationToken ct) => HandoffService.PageAsync(db.Database.SqlQuery<ConversationItem>($"SELECT c.ConversationId,c.Subject,c.ConversationType,c.CreatedAtUtc,c.ClosedAtUtc FROM communication.Conversations c JOIN communication.ConversationParticipants p ON p.OrganizationId=c.OrganizationId AND p.ConversationId=c.ConversationId WHERE c.OrganizationId={tenant.OrganizationId} AND p.UserId={actor} AND p.LeftAtUtc IS NULL").OrderByDescending(c=>c.CreatedAtUtc).ThenByDescending(c=>c.ConversationId),page,size,ct);
    private async Task RequireParticipantAsync(long id,long actor,bool writing,CancellationToken ct)
    {
        var count=await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM communication.Conversations c JOIN communication.ConversationParticipants p ON p.OrganizationId=c.OrganizationId AND p.ConversationId=c.ConversationId WHERE c.OrganizationId={tenant.OrganizationId} AND c.ConversationId={id} AND p.UserId={actor} AND p.LeftAtUtc IS NULL AND ({!writing}=1 OR c.ClosedAtUtc IS NULL)").SingleAsync(ct);
        if(count!=1) throw new KeyNotFoundException("Conversation unavailable.");
    }
    public async Task<PagedResult<MessageItem>> MessagesAsync(long id,long actor,int page,int size,CancellationToken ct)
    {
        await RequireParticipantAsync(id,actor,false,ct);
        return await HandoffService.PageAsync(db.Database.SqlQuery<MessageItem>($"SELECT MessageId,SenderUserId,Body,SentAtUtc FROM communication.Messages WHERE OrganizationId={tenant.OrganizationId} AND ConversationId={id} AND DeletedAtUtc IS NULL").OrderByDescending(m=>m.SentAtUtc).ThenByDescending(m=>m.MessageId),page,size,ct);
    }
    public async Task<long> SendAsync(long id,MessageRequest request,long actor,CancellationToken ct)
    {
        if(string.IsNullOrWhiteSpace(request.Body) || request.Body.Length>4000) throw new ArgumentException("Message must contain 1 to 4000 characters.");
        await using var tx=db.Database.CurrentTransaction is null?await db.Database.BeginTransactionAsync(ct):null;
        await db.AcquireAsync(tenant.OrganizationId,$"conversation:{id}",ct);
        await RequireParticipantAsync(id,actor,true,ct);
        var payload=new {Id=id,Request=request};var replay=await OperationReplay.FindAsync(db,tenant.OrganizationId,actor,"MESSAGE.SEND",request.RequestId,payload,ct);if(replay is not null) return replay.Value;
        var message=(await db.Database.SqlQuery<long>($"INSERT communication.Messages(OrganizationId,ConversationId,SenderUserId,Body) OUTPUT INSERTED.MessageId AS Value VALUES({tenant.OrganizationId},{id},{actor},{request.Body.Trim()})").ToListAsync(ct)).Single();
        await OperationReplay.WriteAsync(db,tenant.OrganizationId,actor,"MESSAGE.SEND","Message",request.RequestId,message,payload,ct);
        if(tx is not null) await tx.CommitAsync(ct);return message;
    }
}
