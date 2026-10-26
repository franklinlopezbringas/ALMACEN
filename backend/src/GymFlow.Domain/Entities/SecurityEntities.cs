using GymFlow.Domain.Common;

namespace GymFlow.Domain.Entities;

public sealed class User
{
    public long UserId { get; set; }
    public Guid PublicId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string NormalizedEmail { get; set; } = string.Empty;
    public string? PasswordHash { get; set; }
    public bool EmailVerified { get; set; }
    public int FailedAccessCount { get; set; }
    public DateTime? LockoutEndUtc { get; set; }
    public Guid SecurityStamp { get; set; }
    public string Status { get; set; } = "PENDING_VERIFICATION";
    public DateTime? LastLoginAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class UserOrganization : ITenantEntity
{
    public long UserOrganizationId { get; set; }
    public long OrganizationId { get; set; }
    public long UserId { get; set; }
    public long? PersonId { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public DateTime JoinedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class Role : ITenantEntity
{
    public long RoleId { get; set; }
    public long OrganizationId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
}

[System.Diagnostics.CodeAnalysis.SuppressMessage("Naming", "CA1711", Justification = "Canonical RBAC business term, not a CAS permission.")]
public sealed class Permission
{
    public long PermissionId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
}

public sealed class UserRole : ITenantEntity
{
    public long OrganizationId { get; set; }
    public long UserOrganizationId { get; set; }
    public long RoleId { get; set; }
}

[System.Diagnostics.CodeAnalysis.SuppressMessage("Naming", "CA1711", Justification = "Canonical RBAC business term, not a CAS permission.")]
public sealed class RolePermission
{
    public long RoleId { get; set; }
    public long PermissionId { get; set; }
}

public sealed class UserSession
{
    public long UserSessionId { get; set; }
    public long UserId { get; set; }
    public long? OrganizationId { get; set; }
    public byte[] RefreshTokenHash { get; set; } = [];
    public string? DeviceName { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
}
