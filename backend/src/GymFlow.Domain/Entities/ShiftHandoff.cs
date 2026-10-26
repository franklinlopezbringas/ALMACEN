using GymFlow.Domain.Common;

namespace GymFlow.Domain.Entities;

public sealed class ShiftHandoff : ITenantEntity
{
    public long ShiftHandoffId { get; set; }
    public long OrganizationId { get; set; }
    public long BranchId { get; set; }
    public long FromEmployeeId { get; set; }
    public long? ToEmployeeId { get; set; }
    public long? CashShiftId { get; set; }
    public string Status { get; set; } = "PENDING";
    public string? Notes { get; set; }
    public string? PendingItems { get; set; }
    public DateTime HandedOffAtUtc { get; set; }
    public DateTime? AcknowledgedAtUtc { get; set; }
    public long CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
