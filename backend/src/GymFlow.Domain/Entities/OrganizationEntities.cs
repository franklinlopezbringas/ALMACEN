using GymFlow.Domain.Common;

namespace GymFlow.Domain.Entities;

public sealed class Organization
{
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public string LegalName { get; set; } = string.Empty;
    public string TradeName { get; set; } = string.Empty;
    public string? TaxId { get; set; }
    public string DefaultCurrencyCode { get; set; } = "PEN";
    public string DefaultTimeZoneId { get; set; } = "America/Lima";
    public string Status { get; set; } = "ACTIVE";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class Branch : ITenantEntity
{
    public long BranchId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? District { get; set; }
    public string TimeZoneId { get; set; } = "America/Lima";
    public string Status { get; set; } = "ACTIVE";
    public byte[] RowVersion { get; set; } = [];
}
