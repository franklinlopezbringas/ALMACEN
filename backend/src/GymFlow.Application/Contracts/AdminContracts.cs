namespace GymFlow.Application.Contracts;

public sealed record MembershipQuery(int Page = 1, int PageSize = 25, string? Search = null, string? Status = null,
    DateOnly? ExpiresFrom = null, DateOnly? ExpiresTo = null, long? MemberId = null, long? PlanId = null);
public sealed record MembershipListItem(Guid PublicId, long MembershipId, long MemberId, Guid MemberPublicId,
    string MemberCode, string FullName, long PlanId, long PlanVersionId, string PlanName, DateOnly StartDate,
    DateOnly EndDate, string Status, decimal ContractedPrice, string CurrencyCode, string StoredStatus);
public sealed record ClassParticipantItem(long ReservationId, long MemberId, string MemberCode, string FullName,
    string Status, int? WaitlistPosition, DateTime ReservedAtUtc);
public sealed record BranchItem(long BranchId, string Code, string Name);
public sealed record AdminProductItem(Guid PublicId, string Sku, string Name, decimal Price, string CurrencyCode,
    decimal? Stock, decimal MinimumStock, bool IsPublic, string Status, byte[] RowVersion);
public sealed record SaveProductRequest(string Sku, string Name, decimal Price, string CurrencyCode,
    decimal MinimumStock, bool IsPublic, string Status, byte[]? RowVersion);
public sealed record PlanTerms(decimal Price, string CurrencyCode, int DurationValue, string DurationUnit,
    int FreezeDaysLimit, int? ClassReservationLimit);
public sealed record AdminPlanItem(Guid PublicId, long PlanId, string Code, string Name, string? Description,
    bool IsPublic, string Status, byte[] RowVersion, long? PlanVersionId, int? VersionNumber, PlanTerms? Terms);
public sealed record SavePlanRequest(string Code, string Name, string? Description, bool IsPublic, string Status,
    byte[]? RowVersion);
public sealed record CreatePlanRequest(SavePlanRequest Plan, PlanTerms Terms);
public sealed record PublishPlanVersionRequest(PlanTerms Terms, byte[] RowVersion);
