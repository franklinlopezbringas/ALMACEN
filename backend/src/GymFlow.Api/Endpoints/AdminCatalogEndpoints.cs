using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Services;

namespace GymFlow.Api.Endpoints;

public static class AdminCatalogEndpoints
{
    public static IEndpointRouteBuilder MapAdminCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1").WithTags("Administration").RequireAuthorization();
        group.MapGet("/branches", (int? page, int? pageSize, AdminCatalogService service, CancellationToken ct) =>
            service.BranchesAsync(page ?? 1, pageSize ?? 25, ct)).RequirePermission("STORE.VIEW");
        group.MapGet("/products/manage", (string? search, string? status, long? branchId, int? page, int? pageSize, AdminCatalogService service, CancellationToken ct) =>
            service.ProductsAsync(search, status, branchId, page ?? 1, pageSize ?? 25, ct)).RequirePermission("INVENTORY.MANAGE");
        group.MapPost("/products", async (SaveProductRequest request, HttpContext http, AdminCatalogService service, CancellationToken ct) =>
            Results.Ok(new { publicId = await service.SaveProductAsync(null, request, http.User.RequireUserId(), ct) })).RequirePermission("INVENTORY.MANAGE");
        group.MapPut("/products/{id:guid}", async (Guid id, SaveProductRequest request, HttpContext http, AdminCatalogService service, CancellationToken ct) =>
            Results.Ok(new { publicId = await service.SaveProductAsync(id, request, http.User.RequireUserId(), ct) })).RequirePermission("INVENTORY.MANAGE");
        group.MapGet("/plans", (string? search, string? status, int? page, int? pageSize, AdminCatalogService service, CancellationToken ct) =>
            service.PlansAsync(search, status, page ?? 1, pageSize ?? 25, ct)).RequirePermission("MEMBERSHIPS.MANAGE");
        group.MapPost("/plans", async (CreatePlanRequest request, HttpContext http, AdminCatalogService service, CancellationToken ct) =>
            Results.Ok(new { publicId = await service.CreatePlanAsync(request, http.User.RequireUserId(), ct) })).RequirePermission("SETTINGS.MANAGE");
        group.MapPut("/plans/{id:guid}", async (Guid id, SavePlanRequest request, HttpContext http, AdminCatalogService service, CancellationToken ct) =>
        {
            await service.UpdatePlanAsync(id, request, http.User.RequireUserId(), ct); return Results.NoContent();
        }).RequirePermission("SETTINGS.MANAGE");
        group.MapPost("/plans/{id:guid}/versions", async (Guid id, PublishPlanVersionRequest request, HttpContext http, AdminCatalogService service, CancellationToken ct) =>
            Results.Ok(new { planVersionId = await service.PublishVersionAsync(id, request, http.User.RequireUserId(), ct) })).RequirePermission("SETTINGS.MANAGE");
        return app;
    }
}
