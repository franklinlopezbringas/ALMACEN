namespace GymFlow.Application.Contracts;

public sealed record ClassSessionListItem(long ClassSessionId, string ClassName, DateTime StartsAtUtc, DateTime EndsAtUtc, short Capacity, long Reserved, string Status, string? CoachName = null, long AvailablePlaces = 0);
public sealed record ReserveClassRequest(long MemberId);
public sealed record ProductListItem(Guid PublicId, string Sku, string Name, decimal Price, string CurrencyCode, decimal? Stock, string Status);
