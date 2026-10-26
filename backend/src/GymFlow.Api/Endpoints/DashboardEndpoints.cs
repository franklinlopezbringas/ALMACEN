using GymFlow.Api.Auth;
using GymFlow.Application.Services;

namespace GymFlow.Api.Endpoints;

public static class DashboardEndpoints
{
    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/dashboard/summary",(IDashboardService service,CancellationToken ct)=>service.GetSummaryAsync(ct))
            .WithTags("Dashboard").RequirePermission("DASHBOARD.VIEW").RequirePermission("REPORTS.VIEW");
        return app;
    }
}
