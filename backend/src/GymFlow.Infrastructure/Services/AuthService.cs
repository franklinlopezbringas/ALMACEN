using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class AuthService(
    GymFlowDbContext db,
    IPasswordService passwords,
    ITokenService tokens,
    IClock clock) : IAuthService
{
    public async Task<AuthResponse?> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password)) return null;
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var organization = await db.Organizations.AsNoTracking()
            .SingleOrDefaultAsync(x => x.PublicId == request.OrganizationPublicId && x.Status == "ACTIVE", cancellationToken);
        if (organization is null) return null;

        var user = await db.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);
        if (user is null || user.Status != "ACTIVE" || user.PasswordHash is null) return null;
        if (user.LockoutEndUtc is not null && user.LockoutEndUtc > clock.UtcNow) return null;

        var membership = await db.UserOrganizations.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.OrganizationId == organization.OrganizationId && x.UserId == user.UserId && x.Status == "ACTIVE", cancellationToken);
        if (membership is null) return null;

        if (!passwords.Verify(request.Password, user.PasswordHash))
        {
            user.FailedAccessCount++;
            if (user.FailedAccessCount >= 8) user.LockoutEndUtc = clock.UtcNow.AddMinutes(15);
            await db.SaveChangesAsync(cancellationToken);
            return null;
        }

        user.FailedAccessCount = 0;
        user.LockoutEndUtc = null;
        user.LastLoginAtUtc = clock.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return await IssueAsync(user, organization, membership, request.DeviceName, ipAddress, userAgent, cancellationToken);
    }

    public async Task<AuthResponse?> RefreshAsync(RefreshRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken)) return null;
        var hash = tokens.HashRefreshToken(request.RefreshToken);
        var now = clock.UtcNow;
        var session = await db.UserSessions.AsNoTracking().SingleOrDefaultAsync(x => x.RefreshTokenHash.SequenceEqual(hash) && x.RevokedAtUtc == null && x.ExpiresAtUtc > now, cancellationToken);
        if (session is null || session.OrganizationId is null) return null;

        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == session.UserId && x.Status == "ACTIVE", cancellationToken);
        var organization = await db.Organizations.AsNoTracking().SingleOrDefaultAsync(x => x.OrganizationId == session.OrganizationId && x.Status == "ACTIVE", cancellationToken);
        if (user is null || organization is null) return null;

        var membership = await db.UserOrganizations.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.OrganizationId == organization.OrganizationId && x.UserId == user.UserId && x.Status == "ACTIVE", cancellationToken);
        if (membership is null) return null;

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var consumed = await db.UserSessions
            .Where(x => x.UserSessionId == session.UserSessionId && x.RevokedAtUtc == null && x.ExpiresAtUtc > now)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAtUtc, now), cancellationToken);
        if (consumed != 1) return null;
        var response = await IssueAsync(user, organization, membership, session.DeviceName, ipAddress, userAgent, cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return response;
    }

    private async Task<AuthResponse> IssueAsync(User user, Organization organization, UserOrganization membership, string? deviceName, string? ipAddress, string? userAgent, CancellationToken ct)
    {
        var roleIds = await db.UserRoles.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.OrganizationId == organization.OrganizationId && x.UserOrganizationId == membership.UserOrganizationId)
            .Select(x => x.RoleId).ToListAsync(ct);

        var roles = await db.Roles.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.OrganizationId == organization.OrganizationId && roleIds.Contains(x.RoleId) && x.Status == "ACTIVE")
            .Select(x => x.Code).ToListAsync(ct);

        roleIds = await db.Roles.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.OrganizationId == organization.OrganizationId && roleIds.Contains(x.RoleId) && x.Status == "ACTIVE")
            .Select(x => x.RoleId).ToListAsync(ct);

        var permissions = await (
            from rp in db.RolePermissions.AsNoTracking()
            join p in db.Permissions.AsNoTracking() on rp.PermissionId equals p.PermissionId
            where roleIds.Contains(rp.RoleId) && p.Status == "ACTIVE"
            select p.Code).Distinct().ToListAsync(ct);

        var access = tokens.CreateAccessToken(user.PublicId, user.UserId, organization.PublicId, organization.OrganizationId, user.Email, roles, permissions);
        var refresh = tokens.CreateRefreshToken();
        var refreshExpires = clock.UtcNow.AddDays(14);

        db.UserSessions.Add(new UserSession
        {
            UserId = user.UserId,
            OrganizationId = organization.OrganizationId,
            RefreshTokenHash = tokens.HashRefreshToken(refresh),
            DeviceName = deviceName,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAtUtc = clock.UtcNow,
            ExpiresAtUtc = refreshExpires
        });
        await db.SaveChangesAsync(ct);

        return new AuthResponse(
            access.Token,
            access.ExpiresAtUtc,
            refresh,
            refreshExpires,
            new UserContext(user.PublicId, organization.PublicId, user.Email, roles, permissions));
    }
}
