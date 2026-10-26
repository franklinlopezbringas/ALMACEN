using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class PublicEndpoints
{
    public static IEndpointRouteBuilder MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/public").WithTags("Public").AllowAnonymous();
        group.MapGet("/{organizationPublicId:guid}/plans", (Guid organizationPublicId, IPublicCatalogService service, CancellationToken ct) =>
            service.PlansAsync(organizationPublicId, ct));
        return app;
    }
}
