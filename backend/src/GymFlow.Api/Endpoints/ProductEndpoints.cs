using GymFlow.Api.Auth;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class ProductEndpoints
{
    public static IEndpointRouteBuilder MapProductEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/products",(string? search,long? branchId,int? page,int? pageSize,IProductService service,CancellationToken ct)=>
            service.SearchAsync(search,branchId,page ?? 1,pageSize ?? 25,ct))
            .WithTags("Products").RequirePermission("STORE.VIEW");
        return app;
    }
}
