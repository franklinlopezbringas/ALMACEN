using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class AutomationEndpoints
{
    public static IEndpointRouteBuilder MapAutomationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/automation/jobs").WithTags("Automation").RequireAuthorization();
        group.MapPost("/", async (EnqueueJobRequest request, IAutomationService service, CancellationToken ct) =>
            Results.Accepted("/api/v1/automation/jobs", await service.EnqueueAsync(request, ct)))
            .RequirePermission("AUTOMATION.MANAGE");
        group.MapGet("/{publicId:guid}", async (Guid publicId, IAutomationService service, CancellationToken ct) =>
        {
            var result = await service.GetAsync(publicId, ct);
            return result is null ? Results.NotFound() : Results.Ok(result);
        }).RequirePermission("AUTOMATION.VIEW");
        return app;
    }
}
