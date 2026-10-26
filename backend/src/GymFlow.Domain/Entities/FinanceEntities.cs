using GymFlow.Domain.Common;

namespace GymFlow.Domain.Entities;

public sealed class Receivable : ITenantEntity
{
    public long ReceivableId { get; set; }
    public long OrganizationId { get; set; }
    public long MemberId { get; set; }
    public long? MembershipId { get; set; }
    public long? OrderId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string CurrencyCode { get; set; } = "PEN";
    public DateOnly DueDate { get; set; }
    public string Status { get; set; } = "OPEN";
    public byte[] RowVersion { get; set; } = [];
}

public sealed class Payment : ITenantEntity
{
    public long PaymentId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public string? ReceiptNumber { get; set; }
    public long? MemberId { get; set; }
    public long? OrderId { get; set; }
    public long? BranchId { get; set; }
    public decimal TotalAmount { get; set; }
    public string CurrencyCode { get; set; } = "PEN";
    public string Source { get; set; } = "RECEPTION";
    public string Status { get; set; } = "COMPLETED";
    public DateTime ReceivedAtUtc { get; set; }
    public long? ReceivedByUserId { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class PaymentSplit : ITenantEntity
{
    public long PaymentSplitId { get; set; }
    public long OrganizationId { get; set; }
    public long PaymentId { get; set; }
    public long PaymentMethodId { get; set; }
    public decimal Amount { get; set; }
    public string? ExternalReference { get; set; }
    public string? ProviderTransactionId { get; set; }
}

public sealed class PaymentAllocation : ITenantEntity
{
    public long PaymentAllocationId { get; set; }
    public long OrganizationId { get; set; }
    public long PaymentId { get; set; }
    public long ReceivableId { get; set; }
    public decimal Amount { get; set; }
}

public sealed class PaymentMethod : ITenantEntity
{
    public long PaymentMethodId { get; set; }
    public long OrganizationId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsCash { get; set; }
    public bool IsOnline { get; set; }
    public string Status { get; set; } = "ACTIVE";
}

public sealed class CashShift : ITenantEntity
{
    public long CashShiftId { get; set; }
    public long OrganizationId { get; set; }
    public long CashRegisterId { get; set; }
    public long EmployeeId { get; set; }
    public DateTime OpenedAtUtc { get; set; }
    public long OpenedByUserId { get; set; }
    public decimal OpeningAmount { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public long? ClosedByUserId { get; set; }
    public decimal? ExpectedAmountAtClose { get; set; }
    public decimal? CountedAmountAtClose { get; set; }
    public decimal? DifferenceAmount { get; set; }
    public string? OpeningNotes { get; set; }
    public string? ClosingNotes { get; set; }
    public string Status { get; set; } = "OPEN";
    public byte[] RowVersion { get; set; } = [];
}

public sealed class CashMovement : ITenantEntity
{
    public long CashMovementId { get; set; }
    public long OrganizationId { get; set; }
    public long CashShiftId { get; set; }
    public string MovementType { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public long? PaymentSplitId { get; set; }
    public string Description { get; set; } = string.Empty;
    public long CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class ReceivableBalance
{
    public long OrganizationId { get; set; }
    public long ReceivableId { get; set; }
    public long MemberId { get; set; }
    public long? MembershipId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string CurrencyCode { get; set; } = "PEN";
    public DateOnly DueDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal BalanceAmount { get; set; }
}

public sealed class CashRegister : ITenantEntity
{
    public long CashRegisterId { get; set; }
    public long OrganizationId { get; set; }
    public long BranchId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
}
