using GymFlow.Api.Auth;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/notifications").WithTags("Notifications").RequireAuthorization();
        group.MapGet("/me", (int? page, int? pageSize, HttpContext http, INotificationService service, CancellationToken ct) =>
            service.MineAsync(http.User.RequireUserId(), page ?? 1, pageSize ?? 25, ct));
        group.MapPost("/{notificationId:long}/read", async (long notificationId, HttpContext http, INotificationService service, CancellationToken ct) =>
        {
            await service.MarkReadAsync(notificationId, http.User.RequireUserId(), ct);
            return Results.NoContent();
        });
        return app;
    }
}
