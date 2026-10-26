using System.Security.Claims;

namespace GymFlow.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    public static long RequireUserId(this ClaimsPrincipal user)
        => long.TryParse(user.FindFirstValue("uid"),out var value) ? value : throw new UnauthorizedAccessException("Missing user id claim.");
}
