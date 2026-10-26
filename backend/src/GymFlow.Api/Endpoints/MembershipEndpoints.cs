using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class MembershipEndpoints
{
    public static IEndpointRouteBuilder MapMembershipEndpoints(this IEndpointRouteBuilder app)
    {
        var group=app.MapGroup("/api/v1/memberships").WithTags("Memberships").RequireAuthorization();
        group.MapGet("/", ([AsParameters] MembershipQuery query, IMembershipService service, CancellationToken ct) => service.SearchAsync(query, ct))
            .RequirePermission("MEMBERSHIPS.VIEW").RequirePermission("MEMBERS.VIEW");
        group.MapPost("/",async (CreateMembershipRequest request,HttpContext http,IMembershipService service,CancellationToken ct)=>
            Results.Created("/api/v1/memberships",await service.CreateAsync(request,http.User.RequireUserId(),ct)))
            .RequirePermission("MEMBERSHIPS.MANAGE");
        group.MapGet("/expiring",(int? days,int? take,IMembershipService service,CancellationToken ct)=>service.ExpiringAsync(days ?? 7,take ?? 50,ct))
            .RequirePermission("MEMBERSHIPS.VIEW");
        return app;
    }
}
