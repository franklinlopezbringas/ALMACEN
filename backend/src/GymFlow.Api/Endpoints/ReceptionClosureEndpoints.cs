using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Services;
namespace GymFlow.Api.Endpoints;
public static class ReceptionClosureEndpoints
{
    public static IEndpointRouteBuilder MapReceptionClosureEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1").WithTags("Reception closure").RequireAuthorization(p=>p.RequireRole("ADMIN","RECEPTION"));
        g.MapGet("/shift-handoffs",(HttpContext h,long? branchId,int? page,int? pageSize,HandoffService s,CancellationToken ct)=>s.ListAsync(h.User.RequireUserId(),branchId,page??1,pageSize??10,ct)).RequirePermission("MESSAGES.USE");
        g.MapGet("/shift-handoffs/employees",(int? page,int? pageSize,HandoffService s,CancellationToken ct)=>s.EmployeesAsync(page??1,pageSize??25,ct)).RequirePermission("MESSAGES.USE");
        g.MapPost("/shift-handoffs",(CreateHandoffRequest r,HttpContext h,HandoffService s,CancellationToken ct)=>s.CreateAsync(r,h.User.RequireUserId(),ct)).RequirePermission("MESSAGES.USE");
        g.MapPost("/shift-handoffs/{id:long}/acknowledge",(long id,HandoffTransitionRequest r,HttpContext h,HandoffService s,CancellationToken ct)=>s.TransitionAsync(id,r,h.User.RequireUserId(),true,ct)).RequirePermission("MESSAGES.USE");
        g.MapPost("/shift-handoffs/{id:long}/cancel",(long id,HandoffTransitionRequest r,HttpContext h,HandoffService s,CancellationToken ct)=>s.TransitionAsync(id,r,h.User.RequireUserId(),false,ct)).RequirePermission("MESSAGES.USE");
        g.MapPost("/classes/reservations/{id:long}/status",async(long id,ClassTransitionRequest r,HttpContext h,ClassOperationsService s,CancellationToken ct)=>{await s.TransitionAsync(id,r,h.User.RequireUserId(),ct);return Results.NoContent();}).RequirePermission("CLASSES.RESERVE_FOR_OTHERS");
        g.MapGet("/access/exceptions",(long? memberId,int? page,int? pageSize,AccessExceptionService s,CancellationToken ct)=>s.ListAsync(memberId,page??1,pageSize??10,ct)).RequirePermission("ACCESS.EXCEPTION_REQUEST");
        g.MapPost("/access/exceptions",(ExceptionRequest r,HttpContext h,AccessExceptionService s,CancellationToken ct)=>s.RequestAsync(r,h.User.RequireUserId(),ct)).RequirePermission("ACCESS.EXCEPTION_REQUEST");
        g.MapPost("/access/exceptions/{id:long}/review",async(long id,ExceptionReviewRequest r,HttpContext h,AccessExceptionService s,CancellationToken ct)=>{await s.ReviewAsync(id,r,h.User.RequireUserId(),ct);return Results.NoContent();}).RequirePermission("ACCESS.EXCEPTION_APPROVE");
        g.MapGet("/incidents",(HttpContext h,int? page,int? pageSize,SupportService s,CancellationToken ct)=>s.IncidentsAsync(h.User.RequireUserId(),page??1,pageSize??10,ct)).RequirePermission("MESSAGES.USE");
        g.MapPost("/incidents",async(IncidentRequest r,HttpContext h,SupportService s,CancellationToken ct)=>Results.Ok(new {SupportTicketId=await s.CreateAsync(r,h.User.RequireUserId(),ct)})).RequirePermission("MESSAGES.USE");
        g.MapGet("/store/returns",(int? page,int? pageSize,ReturnsService s,CancellationToken ct)=>s.ListAsync(page??1,pageSize??10,ct)).RequirePermission("STORE.SELL");
        g.MapGet("/store/returns/lines",(string? search,int? page,int? pageSize,ReturnsService s,CancellationToken ct)=>s.LinesAsync(search,page??1,pageSize??10,ct)).RequirePermission("STORE.SELL");
        g.MapPost("/store/returns",(ReturnRequest r,HttpContext h,ReturnsService s,CancellationToken ct)=>s.RequestAsync(r,h.User.RequireUserId(),ct)).RequirePermission("STORE.SELL");
        g.MapGet("/store/returns/{id:long}/sources",(long id,ReturnsService s,CancellationToken ct)=>s.SourcesAsync(id,ct)).RequirePermission("STORE.SELL");
        g.MapPost("/store/returns/{id:long}/review",async(long id,ExceptionReviewRequest r,HttpContext h,ReturnsService s,CancellationToken ct)=>{await s.ReviewAsync(id,r,h.User.RequireUserId(),ct);return Results.NoContent();}).RequirePermission("REFUNDS.APPROVE");
        g.MapPost("/store/returns/{id:long}/process",(long id,ReturnProcessRequest r,HttpContext h,ReturnsService s,CancellationToken ct)=>s.ProcessAsync(id,r,h.User.RequireUserId(),ct)).RequirePermission("STORE.SELL").RequirePermission("PAYMENTS.CREATE");
        var m=app.MapGroup("/api/v1/conversations").WithTags("Messaging").RequireAuthorization().RequirePermission("MESSAGES.USE");
        m.MapGet("/",(HttpContext h,int? page,int? pageSize,SupportService s,CancellationToken ct)=>s.ConversationsAsync(h.User.RequireUserId(),page??1,pageSize??10,ct));
        m.MapGet("/{id:long}/messages",(long id,HttpContext h,int? page,int? pageSize,SupportService s,CancellationToken ct)=>s.MessagesAsync(id,h.User.RequireUserId(),page??1,pageSize??20,ct));
        m.MapPost("/{id:long}/messages",async(long id,MessageRequest r,HttpContext h,SupportService s,CancellationToken ct)=>Results.Ok(new {MessageId=await s.SendAsync(id,r,h.User.RequireUserId(),ct)}));
        return app;
    }
}
