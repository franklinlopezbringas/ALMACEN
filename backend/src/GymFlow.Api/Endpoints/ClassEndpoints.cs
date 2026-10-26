using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Api.Endpoints;

public static class ClassEndpoints
{
    public static IEndpointRouteBuilder MapClassEndpoints(this IEndpointRouteBuilder app)
    {
        var group=app.MapGroup("/api/v1/classes").WithTags("Classes").RequireAuthorization();
        group.MapGet("/sessions",(DateTime? fromUtc,int? page,int? pageSize,IClassService service,CancellationToken ct)=>
            service.UpcomingAsync(fromUtc ?? DateTime.UtcNow,page ?? 1,pageSize ?? 25,ct)).RequirePermission("CLASSES.VIEW");

        group.MapGet("/sessions/{sessionId:long}/participants", async (long sessionId, string? status, int? page, int? pageSize,
            HttpContext http, IClassService service, CancellationToken ct) =>
        {
            if (!http.User.HasClaim("perm", "CLASSES.MANAGE") && !http.User.HasClaim("perm", "CLASSES.RESERVE_FOR_OTHERS")
                && !http.User.HasClaim("perm", "TRAINING.MEMBERS_VIEW")) return Results.Forbid();
            return Results.Ok(await service.ParticipantsAsync(sessionId, status, page ?? 1, pageSize ?? 25, ct));
        }).RequirePermission("CLASSES.VIEW").Produces<PagedResult<ClassParticipantItem>>();

        group.MapPost("/sessions/{sessionId:long}/reserve/me",async (long sessionId,HttpContext http,GymFlowDbContext db,IClassService service,CancellationToken ct)=>
        {
            var uid=http.User.RequireUserId();
            var userOrg=await db.UserOrganizations.AsNoTracking().SingleOrDefaultAsync(x=>x.UserId==uid && x.Status=="ACTIVE",ct);
            if (userOrg?.PersonId is null) return Results.BadRequest(new { error="The current user is not linked to a member profile." });
            var member=await db.Members.AsNoTracking().SingleOrDefaultAsync(x=>x.PersonId==userOrg.PersonId && x.Status=="ACTIVE",ct);
            if (member is null) return Results.BadRequest(new { error="The current user is not an active member." });
            await service.ReserveAsync(sessionId,new ReserveClassRequest(member.MemberId),uid,ct);
            return Results.NoContent();
        }).RequirePermission("CLASSES.RESERVE");

        group.MapPost("/sessions/{sessionId:long}/reserve/{memberId:long}",async (long sessionId,long memberId,HttpContext http,IClassService service,CancellationToken ct)=>
        {
            await service.ReserveAsync(sessionId,new ReserveClassRequest(memberId),http.User.RequireUserId(),ct,http.User.IsInRole("ADMIN")?"ADMIN":"RECEPTION");
            return Results.NoContent();
        }).RequirePermission("CLASSES.RESERVE_FOR_OTHERS");
        return app;
    }
}
