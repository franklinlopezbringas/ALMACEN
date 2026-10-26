using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Services;

namespace GymFlow.Api.Endpoints;

public static class CashEndpoints
{
    public static IEndpointRouteBuilder MapCashEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/cash-shifts").WithTags("Cash").RequireAuthorization();
        group.MapPost("/open", async (OpenCashShiftRequest request, HttpContext http, ICashService service, ReceptionService reception, CancellationToken ct) =>
        {
            if (!http.User.IsInRole("ADMIN"))
            {
                var context = await reception.ContextAsync(http.User.RequireUserId(), ct);
                if (context.EmployeeId != request.EmployeeId) return Results.Forbid();
            }
            return Results.Created("/api/v1/cash-shifts", await service.OpenAsync(request, http.User.RequireUserId(), ct));
        })
            .RequirePermission("CASH.OPEN");
        group.MapPost("/{cashShiftId:long}/close", async (long cashShiftId, CloseCashShiftRequest request, HttpContext http, ICashService service, ReceptionService reception, CancellationToken ct) =>
        {
            if (!http.User.IsInRole("ADMIN")) await reception.RequireOwnShiftAsync(http.User.RequireUserId(), cashShiftId, ct);
            return Results.Ok(await service.CloseAsync(cashShiftId, request, http.User.RequireUserId(), ct));
        })
            .RequirePermission("CASH.CLOSE");
        return app;
    }
}
