using GymFlow.Domain.Common;

namespace GymFlow.Domain.Entities;

[System.Diagnostics.CodeAnalysis.SuppressMessage("Naming", "CA1711", Justification = "Canonical database business term; not a CLR exception or CAS permission.")]
public sealed class AccessException : ITenantEntity
{
    public long AccessExceptionId { get; set; }
    public long OrganizationId { get; set; }
    public long MemberId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime ValidFromUtc { get; set; }
    public DateTime ValidToUtc { get; set; }
    public string Status { get; set; } = "REQUESTED";
    public long RequestedByUserId { get; set; }
    public long? ReviewedByUserId { get; set; }
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
}

public sealed class AttendanceEvent : ITenantEntity
{
    public long AttendanceEventId { get; set; }
    public long OrganizationId { get; set; }
    public long BranchId { get; set; }
    public long MemberId { get; set; }
    public string EventType { get; set; } = "ENTRY";
    public string AccessMethod { get; set; } = "QR";
    public string Result { get; set; } = "DENIED";
    public DateTime OccurredAtUtc { get; set; }
    public long? AccessExceptionId { get; set; }
    public long? DeviceId { get; set; }
    public long? RegisteredByUserId { get; set; }
    public string? ReasonCode { get; set; }
}

public sealed class TrainerProfile : ITenantEntity
{
    public long TrainerProfileId { get; set; }
    public long OrganizationId { get; set; }
    public long EmployeeId { get; set; }
    public short? ExperienceYears { get; set; }
    public string Modality { get; set; } = "BOTH";
    public string? Bio { get; set; }
    public bool IsPublic { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public byte[] RowVersion { get; set; } = [];
}

public sealed class GymClass : ITenantEntity
{
    public long ClassId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public short DefaultCapacity { get; set; }
    public short DurationMinutes { get; set; }
    public bool IsPublic { get; set; }
    public string Status { get; set; } = "ACTIVE";
}

public sealed class ClassSession : ITenantEntity
{
    public long ClassSessionId { get; set; }
    public long OrganizationId { get; set; }
    public long ClassId { get; set; }
    public long BranchId { get; set; }
    public long? TrainerProfileId { get; set; }
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public short Capacity { get; set; }
    public string Status { get; set; } = "SCHEDULED";
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ClassReservation : ITenantEntity
{
    public long ClassReservationId { get; set; }
    public long OrganizationId { get; set; }
    public long ClassSessionId { get; set; }
    public long MemberId { get; set; }
    public string Status { get; set; } = "CONFIRMED";
    public int? WaitlistPosition { get; set; }
    public string Source { get; set; } = "MEMBER_APP";
    public DateTime ReservedAtUtc { get; set; }
    public DateTime? CancelledAtUtc { get; set; }
    public DateTime? AttendedAtUtc { get; set; }
}

public sealed class Product : ITenantEntity
{
    public long ProductId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public long? ProductCategoryId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal SalePrice { get; set; }
    public string CurrencyCode { get; set; } = "PEN";
    public decimal MinimumStock { get; set; }
    public bool IsPublic { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public byte[] RowVersion { get; set; } = [];
}

public sealed class InventoryBalance : ITenantEntity
{
    public long OrganizationId { get; set; }
    public long BranchId { get; set; }
    public long ProductId { get; set; }
    public decimal QuantityOnHand { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
