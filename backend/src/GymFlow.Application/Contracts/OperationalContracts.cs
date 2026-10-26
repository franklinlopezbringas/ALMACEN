namespace GymFlow.Application.Contracts;

public sealed record OpenCashShiftRequest(long CashRegisterId, long EmployeeId, decimal OpeningAmount, string? OpeningNotes);
public sealed record CloseCashShiftRequest(decimal CountedAmount, string? ClosingNotes);
public sealed record CashShiftResult(long CashShiftId, string Status, decimal OpeningAmount, decimal? ExpectedAmount, decimal? CountedAmount, decimal? DifferenceAmount);

public sealed record AssignedMemberItem(long MemberId, Guid PublicId, string MemberCode, string FullName, string? MembershipStatus, DateOnly? MembershipEndDate);
public sealed record AddProgressReviewRequest(long MemberId, string Rating, decimal? ProgressPercentage, string? VisibleComment, string? PrivateNote, string? Achievements, string? NextGoal);

public sealed record PointBalanceResult(long MemberId, int CurrentBalance, int LifetimeEarned, int LifetimeRedeemed);
public sealed record PointTransactionItem(long Id, string Type, int Points, string ReasonCode, string? Description, DateTime CreatedAtUtc);
public sealed record RewardItem(Guid PublicId, string Type, string Name, string? Description, int PointsCost, string Status);
public sealed record RedeemRewardRequest(long MemberId, long RewardId);
public sealed record RedemptionResult(long RedemptionId, string RedemptionCode, int PointsSpent, string Status);

public sealed record NotificationItem(long Id, string Type, string Title, string Body, string Status, DateTime CreatedAtUtc, DateTime? ReadAtUtc);
public sealed record EnqueueJobRequest(string JobType, string PayloadJson, byte Priority, DateTime? AvailableAtUtc);
public sealed record JobResult(Guid PublicId, long JobId, string JobType, string Status, byte Priority, DateTime AvailableAtUtc, short Attempts, short MaxAttempts);
