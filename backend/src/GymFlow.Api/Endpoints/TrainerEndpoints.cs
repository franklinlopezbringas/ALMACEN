using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class TrainerEndpoints
{
    public static IEndpointRouteBuilder MapTrainerEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/trainer").WithTags("Trainer").RequireAuthorization();
        group.MapGet("/members", (int? page, int? pageSize, HttpContext http, ITrainerService service, CancellationToken ct) =>
            service.AssignedMembersAsync(http.User.RequireUserId(), page ?? 1, pageSize ?? 25, ct))
            .RequirePermission("TRAINING.MEMBERS_VIEW");
        group.MapPost("/progress-reviews", async (AddProgressReviewRequest request, HttpContext http, ITrainerService service, CancellationToken ct) =>
        {
            var id = await service.AddProgressReviewAsync(http.User.RequireUserId(), request, ct);
            return Results.Created($"/api/v1/trainer/progress-reviews/{id}", new { progressReviewId = id });
        }).RequirePermission("TRAINING.PROGRESS_MANAGE");
        return app;
    }
}
