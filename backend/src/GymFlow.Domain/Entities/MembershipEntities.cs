using GymFlow.Domain.Common;

namespace GymFlow.Domain.Entities;

public sealed class Plan : ITenantEntity
{
    public long PlanId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public byte[] RowVersion { get; set; } = [];
}

public sealed class PlanVersion : ITenantEntity
{
    public long PlanVersionId { get; set; }
    public long OrganizationId { get; set; }
    public long PlanId { get; set; }
    public int VersionNumber { get; set; }
    public decimal Price { get; set; }
    public string CurrencyCode { get; set; } = "PEN";
    public int DurationValue { get; set; }
    public string DurationUnit { get; set; } = "MONTH";
    public int FreezeDaysLimit { get; set; }
    public int? ClassReservationLimit { get; set; }
    public DateOnly ValidFrom { get; set; }
    public DateOnly? ValidTo { get; set; }
    public string Status { get; set; } = "ACTIVE";
}

public sealed class Membership : ITenantEntity
{
    public long MembershipId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public long MemberId { get; set; }
    public long PlanVersionId { get; set; }
    public long? HomeBranchId { get; set; }
    public long? PreviousMembershipId { get; set; }
    public long? SourceOrderId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal ContractedPrice { get; set; }
    public string CurrencyCode { get; set; } = "PEN";
    public string Status { get; set; } = "PENDING";
    public string Origin { get; set; } = "RECEPTION";
    public long? CreatedByUserId { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
