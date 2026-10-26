namespace GymFlow.Application.Contracts;

public sealed record PublicPlanItem(
    Guid PublicId,
    string Code,
    string Name,
    string? Description,
    decimal Price,
    string CurrencyCode,
    int DurationValue,
    string DurationUnit,
    int FreezeDaysLimit);
