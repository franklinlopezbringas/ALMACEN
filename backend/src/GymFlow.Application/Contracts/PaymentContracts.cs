namespace GymFlow.Application.Contracts;

public sealed record PaymentSplitInput(long PaymentMethodId, decimal Amount, string? ExternalReference, string? ProviderTransactionId);
public sealed record PaymentAllocationInput(long ReceivableId, decimal Amount);
public sealed record RegisterPaymentRequest(long? MemberId, long? OrderId, long? BranchId, decimal TotalAmount, string CurrencyCode, string Source, long? CashShiftId, IReadOnlyList<PaymentSplitInput> Splits, IReadOnlyList<PaymentAllocationInput> Allocations, Guid? RequestId = null);
public sealed record PaymentResult(Guid PublicId, long PaymentId, string? ReceiptNumber, decimal TotalAmount, string CurrencyCode, string Status, DateTime ReceivedAtUtc);
