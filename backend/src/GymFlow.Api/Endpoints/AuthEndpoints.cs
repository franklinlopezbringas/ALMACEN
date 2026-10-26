using GymFlow.Application.Contracts;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group=app.MapGroup("/api/v1/auth").WithTags("Auth");
        group.MapPost("/login",async (LoginRequest request,HttpContext http,IAuthService auth,CancellationToken ct)=>
        {
            var result=await auth.LoginAsync(request,http.Connection.RemoteIpAddress?.ToString(),http.Request.Headers.UserAgent.ToString(),ct);
            return result is null ? Results.Unauthorized() : Results.Ok(result);
        }).AllowAnonymous().RequireRateLimiting("auth");

        group.MapPost("/refresh",async (RefreshRequest request,HttpContext http,IAuthService auth,CancellationToken ct)=>
        {
            var result=await auth.RefreshAsync(request,http.Connection.RemoteIpAddress?.ToString(),http.Request.Headers.UserAgent.ToString(),ct);
            return result is null ? Results.Unauthorized() : Results.Ok(result);
        }).AllowAnonymous().RequireRateLimiting("auth");
        return app;
    }
}
