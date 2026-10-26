using GymFlow.Application.Abstractions;

namespace GymFlow.Api.Auth;

public sealed class HttpContextCurrentTenant(IHttpContextAccessor accessor) : ICurrentTenant
{
    public long OrganizationId
        => long.TryParse(accessor.HttpContext?.User.FindFirst("org")?.Value, out var value) ? value : 0;

    public bool IsResolved => OrganizationId > 0;
}
