using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class AccessEndpoints
{
    public static IEndpointRouteBuilder MapAccessEndpoints(this IEndpointRouteBuilder app)
    {
        var group=app.MapGroup("/api/v1/access").WithTags("Access").RequireAuthorization();
        group.MapPost("/check-in",async (CheckInRequest request,HttpContext http,IAccessService service,CancellationToken ct)=>
            Results.Ok(await service.CheckInAsync(request,http.User.RequireUserId(),ct)))
            .RequirePermission("ACCESS.CHECKIN");
        return app;
    }
}
