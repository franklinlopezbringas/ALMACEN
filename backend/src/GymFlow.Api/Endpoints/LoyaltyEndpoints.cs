using GymFlow.Api.Auth;
using GymFlow.Application.Services;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Api.Endpoints;

public static class LoyaltyEndpoints
{
    public static IEndpointRouteBuilder MapLoyaltyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/loyalty").WithTags("Loyalty").RequireAuthorization();
        group.MapGet("/rewards", (int? page, int? pageSize, ILoyaltyService service, CancellationToken ct) =>
            service.RewardsAsync(page ?? 1, pageSize ?? 25, ct))
            .RequirePermission("LOYALTY.VIEW");

        group.MapGet("/me/balance", async (HttpContext http, GymFlowDbContext db, ILoyaltyService service, CancellationToken ct) =>
        {
            var memberId = await ResolveCurrentMemberIdAsync(http, db, ct);
            return Results.Ok(await service.GetBalanceAsync(memberId, ct));
        }).RequirePermission("LOYALTY.VIEW");

        group.MapGet("/me/transactions", async (int? page, int? pageSize, HttpContext http, GymFlowDbContext db, ILoyaltyService service, CancellationToken ct) =>
        {
            var memberId = await ResolveCurrentMemberIdAsync(http, db, ct);
            return Results.Ok(await service.GetTransactionsAsync(memberId, page ?? 1, pageSize ?? 25, ct));
        }).RequirePermission("LOYALTY.VIEW");

        group.MapPost("/me/rewards/{rewardId:long}/redeem", async (long rewardId, HttpContext http, GymFlowDbContext db, ILoyaltyService service, CancellationToken ct) =>
        {
            var memberId = await ResolveCurrentMemberIdAsync(http, db, ct);
            return Results.Ok(await service.RedeemAsync(new RedeemRewardRequest(memberId, rewardId), http.User.RequireUserId(), ct));
        }).RequirePermission("LOYALTY.VIEW");

        group.MapGet("/members/{memberId:long}/balance", (long memberId, ILoyaltyService service, CancellationToken ct) =>
            service.GetBalanceAsync(memberId, ct)).RequirePermission("LOYALTY.MANAGE");

        return app;
    }

    private static async Task<long> ResolveCurrentMemberIdAsync(HttpContext http, GymFlowDbContext db, CancellationToken ct)
    {
        var uid = http.User.RequireUserId();
        var userOrg = await db.UserOrganizations.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == uid && x.Status == "ACTIVE", ct)
            ?? throw new UnauthorizedAccessException("Current user is not linked to this organization.");
        if (userOrg.PersonId is null) throw new UnauthorizedAccessException("Current user is not linked to a person.");
        return await db.Members.AsNoTracking().Where(x => x.PersonId == userOrg.PersonId && x.Status == "ACTIVE")
            .Select(x => (long?)x.MemberId).SingleOrDefaultAsync(ct)
            ?? throw new UnauthorizedAccessException("Current user is not an active member.");
    }
}
