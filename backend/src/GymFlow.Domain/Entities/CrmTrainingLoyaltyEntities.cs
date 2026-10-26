using GymFlow.Domain.Common;

namespace GymFlow.Domain.Entities;

public sealed class LeadSource : ITenantEntity
{
    public long LeadSourceId { get; set; }
    public long OrganizationId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
}

public sealed class ProgressReview : ITenantEntity
{
    public long ProgressReviewId { get; set; }
    public long OrganizationId { get; set; }
    public long MemberId { get; set; }
    public long TrainerProfileId { get; set; }
    public string Rating { get; set; } = string.Empty;
    public decimal? ProgressPercentage { get; set; }
    public string? VisibleComment { get; set; }
    public string? PrivateNote { get; set; }
    public string? Achievements { get; set; }
    public string? NextGoal { get; set; }
    public DateTime ReviewedAtUtc { get; set; }
}

public sealed class TrainerMemberAssignment : ITenantEntity
{
    public long TrainerMemberAssignmentId { get; set; }
    public long OrganizationId { get; set; }
    public long TrainerProfileId { get; set; }
    public long MemberId { get; set; }
    public DateOnly AssignedFrom { get; set; }
    public DateOnly? AssignedTo { get; set; }
    public bool IsPrimary { get; set; }
    public string Status { get; set; } = "ACTIVE";
}

public sealed class PointAccount : ITenantEntity
{
    public long PointAccountId { get; set; }
    public long OrganizationId { get; set; }
    public long MemberId { get; set; }
    public int CurrentBalance { get; set; }
    public int LifetimeEarned { get; set; }
    public int LifetimeRedeemed { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class PointTransaction : ITenantEntity
{
    public long PointTransactionId { get; set; }
    public long OrganizationId { get; set; }
    public long PointAccountId { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public int Points { get; set; }
    public string ReasonCode { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class Reward : ITenantEntity
{
    public long RewardId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public long? ProductId { get; set; }
    public string RewardType { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int PointsCost { get; set; }
    public int? StockLimit { get; set; }
    public string Status { get; set; } = "ACTIVE";
}

public sealed class RewardRedemption : ITenantEntity
{
    public long RewardRedemptionId { get; set; }
    public long OrganizationId { get; set; }
    public long RewardId { get; set; }
    public long MemberId { get; set; }
    public int PointsSpent { get; set; }
    public string RedemptionCode { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING";
    public DateTime RequestedAtUtc { get; set; }
}

public sealed class Notification : ITenantEntity
{
    public long NotificationId { get; set; }
    public long OrganizationId { get; set; }
    public long UserId { get; set; }
    public string NotificationType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Channel { get; set; } = "IN_APP";
    public string Status { get; set; } = "PENDING";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public DateTime? ReadAtUtc { get; set; }
}

public sealed class AutomationJob : ITenantEntity
{
    public long JobId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public long? AutomationId { get; set; }
    public string JobType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public byte Priority { get; set; }
    public string Status { get; set; } = "PENDING";
    public DateTime AvailableAtUtc { get; set; }
    public short Attempts { get; set; }
    public short MaxAttempts { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ProspectActivity : ITenantEntity
{
    public long ProspectActivityId { get; set; }
    public long OrganizationId { get; set; }
    public long ProspectId { get; set; }
    public DateTime OccurredAtUtc { get; set; }
}
