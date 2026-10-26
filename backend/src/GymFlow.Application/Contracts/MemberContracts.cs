namespace GymFlow.Application.Contracts;

public sealed record MemberListItem(Guid PublicId, string MemberCode, string FullName, string? DocumentNumber, string? Phone, string Status, string? MembershipStatus, DateOnly? MembershipEndDate, long MemberId = 0);
public sealed record MemberDetail(Guid PublicId, string MemberCode, string FirstName, string LastName, string? DocumentType, string? DocumentNumber, string? Phone, string? Email, string Status, long? HomeBranchId, long MemberId = 0, byte[]? RowVersion = null);
public sealed record CreateMemberRequest(string FirstName, string LastName, string? DocumentType, string? DocumentNumber, string? Phone, string? Email, long? HomeBranchId);

public sealed record ProspectListItem(long ProspectId, string FullName, string? Phone, string? Email, string Status, string? LeadSource, DateTime? NextFollowUpAtUtc, string? InterestedPlan = null, DateTime? LastContactAtUtc = null);
public sealed record CreateProspectRequest(string FirstName, string LastName, string? DocumentType, string? DocumentNumber, string? Phone, string? Email, long? LeadSourceId, long? InterestedPlanId, string? Notes);
public sealed record ConvertProspectRequest(long? HomeBranchId);
