using GymFlow.Api.Auth;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Services;

namespace GymFlow.Api.Endpoints;

public static class ReceptionEndpoints
{
    public static IEndpointRouteBuilder MapReceptionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1").WithTags("Reception").RequireAuthorization();
        group.MapPost("/access/check-in/qr", async (QrCheckInRequest request, HttpContext http, ReceptionService reception, IAccessService access, CancellationToken ct) =>
        {
            var memberId = await reception.ResolveQrAsync(request.Credential, ct);
            return Results.Ok(await access.CheckInAsync(new(memberId, request.BranchId, "QR", null), http.User.RequireUserId(), ct));
        }).RequirePermission("ACCESS.CHECKIN").Produces<CheckInResult>();
        group.MapGet("/reception/context", (HttpContext http, ReceptionService service, CancellationToken ct) => service.ContextAsync(http.User.RequireUserId(), ct)).RequirePermission("CASH.VIEW");
        group.MapGet("/cash-registers", (int? page, int? pageSize, ReceptionService service, CancellationToken ct) => service.RegistersAsync(page ?? 1, pageSize ?? 25, ct)).RequirePermission("CASH.VIEW");
        group.MapGet("/payment-methods", (int? page, int? pageSize, ReceptionService service, CancellationToken ct) => service.MethodsAsync(page ?? 1, pageSize ?? 25, ct)).RequirePermission("PAYMENTS.CREATE");
        group.MapGet("/receivables", (long memberId, int? page, int? pageSize, ReceptionService service, CancellationToken ct) => service.DebtsAsync(memberId, page ?? 1, pageSize ?? 25, ct)).RequirePermission("PAYMENTS.VIEW");
        group.MapGet("/payments", (long memberId, int? page, int? pageSize, ReceptionService service, CancellationToken ct) => service.PaymentsAsync(memberId, page ?? 1, pageSize ?? 25, ct)).RequirePermission("PAYMENTS.VIEW");
        group.MapGet("/payments/{id:guid}", (Guid id, ReceptionService service, CancellationToken ct) => service.ReceiptAsync(id, ct)).RequirePermission("PAYMENTS.VIEW");
        group.MapGet("/cash-shifts/me", (HttpContext http, string? status, int? page, int? pageSize, ReceptionService service, CancellationToken ct) => service.ShiftsAsync(http.User.RequireUserId(), page ?? 1, pageSize ?? 25, ct, status)).RequirePermission("CASH.VIEW");
        group.MapGet("/cash-shifts/{id:long}/movements", (long id, HttpContext http, int? page, int? pageSize, ReceptionService service, CancellationToken ct) => service.MovementsAsync(http.User.RequireUserId(), id, page ?? 1, pageSize ?? 25, ct)).RequirePermission("CASH.VIEW");
        group.MapGet("/access/events", (long? memberId, long? branchId, DateTime? fromUtc, DateTime? toUtc, int? page, int? pageSize, ReceptionService service, CancellationToken ct) => service.AccessAsync(memberId, branchId, fromUtc, toUtc, page ?? 1, pageSize ?? 25, ct)).RequirePermission("ACCESS.CHECKIN");
        group.MapPut("/members/{id:guid}", async (Guid id, UpdateMemberRequest request, HttpContext http, ReceptionService service, CancellationToken ct) =>
        {
            await service.UpdateMemberAsync(id, request, http.User.RequireUserId(), ct);
            return Results.NoContent();
        }).RequirePermission("MEMBERS.UPDATE");
        group.MapPost("/store/sales", async (PosRequest request, HttpContext http, PosService service, ReceptionService reception, CancellationToken ct) =>
        {
            if (request.CashShiftId is not null && !http.User.IsInRole("ADMIN"))
                await reception.RequireOwnShiftAsync(http.User.RequireUserId(), request.CashShiftId.Value, ct);
            return Results.Ok(await service.SellAsync(request, http.User.RequireUserId(), ct));
        }).RequirePermission("STORE.SELL").RequirePermission("PAYMENTS.CREATE").Produces<PosResult>();
        return app;
    }
}
