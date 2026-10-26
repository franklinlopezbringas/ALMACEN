using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class MemberEndpoints
{
    public static IEndpointRouteBuilder MapMemberEndpoints(this IEndpointRouteBuilder app)
    {
        var group=app.MapGroup("/api/v1/members").WithTags("Members").RequireAuthorization();
        group.MapGet("/",(string? search,int? page,int? pageSize,IMemberService service,CancellationToken ct)=>service.SearchAsync(search,page ?? 1,pageSize ?? 25,ct))
            .RequirePermission("MEMBERS.VIEW");
        group.MapGet("/{publicId:guid}",async (Guid publicId,IMemberService service,CancellationToken ct)=>
        {
            var result=await service.GetAsync(publicId,ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).RequirePermission("MEMBERS.VIEW");
        group.MapPost("/",async (CreateMemberRequest request,IMemberService service,CancellationToken ct)=>Results.Created("/api/v1/members",await service.CreateAsync(request,ct)))
            .RequirePermission("MEMBERS.CREATE");
        return app;
    }
}
