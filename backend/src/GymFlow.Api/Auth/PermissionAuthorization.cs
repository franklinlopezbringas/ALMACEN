using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace GymFlow.Api.Auth;

public sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User.HasClaim("perm", requirement.Permission)) context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

public sealed class PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : IAuthorizationPolicyProvider
{
    private const string Prefix="perm:";
    private readonly DefaultAuthorizationPolicyProvider _fallback=new(options);

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (!policyName.StartsWith(Prefix,StringComparison.OrdinalIgnoreCase)) return _fallback.GetPolicyAsync(policyName);
        var permission=policyName[Prefix.Length..];
        var policy=new AuthorizationPolicyBuilder().RequireAuthenticatedUser().AddRequirements(new PermissionRequirement(permission)).Build();
        return Task.FromResult<AuthorizationPolicy?>(policy);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync()=>_fallback.GetDefaultPolicyAsync();
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync()=>_fallback.GetFallbackPolicyAsync();
}

public static class PermissionEndpointExtensions
{
    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder,string permission) where TBuilder:IEndpointConventionBuilder
    {
        builder.RequireAuthorization("perm:"+permission);
        return builder;
    }
}
