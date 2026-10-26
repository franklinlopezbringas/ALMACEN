using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Services;

namespace GymFlow.Api.Endpoints;

public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        var group=app.MapGroup("/api/v1/payments").WithTags("Payments").RequireAuthorization();
        group.MapPost("/",async (RegisterPaymentRequest request,HttpContext http,IPaymentService service,ReceptionService reception,CancellationToken ct)=>
        {
            if (request.CashShiftId is not null && !http.User.IsInRole("ADMIN")) await reception.RequireOwnShiftAsync(http.User.RequireUserId(),request.CashShiftId.Value,ct);
            return Results.Created("/api/v1/payments",await service.RegisterAsync(request,http.User.RequireUserId(),ct));
        })
            .RequirePermission("PAYMENTS.CREATE");
        return app;
    }
}
