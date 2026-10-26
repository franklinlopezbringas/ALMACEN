namespace GymFlow.Application.Contracts;

public sealed record CreateMembershipRequest(long MemberId, long PlanVersionId, long? HomeBranchId, DateOnly StartDate, string Origin, long? PreviousMembershipId = null, Guid? RequestId = null);
public sealed record MembershipResult(Guid PublicId, long MembershipId, DateOnly StartDate, DateOnly EndDate, decimal ContractedPrice, string CurrencyCode, string Status, long? ReceivableId);
public sealed record ExpiringMembershipItem(Guid MembershipPublicId, long MemberId, string MemberCode, string FullName, DateOnly EndDate, int DaysRemaining, string PlanName);
