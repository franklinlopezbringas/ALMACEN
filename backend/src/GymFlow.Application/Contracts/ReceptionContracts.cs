using System.ComponentModel.DataAnnotations.Schema;
namespace GymFlow.Application.Contracts;

public sealed record ReceptionContext(long? EmployeeId, string? EmployeeName, string CurrencyCode);
public sealed record RegisterItem(long CashRegisterId, long BranchId, string Name, string BranchName, bool IsOpen);
public sealed record MethodItem(long PaymentMethodId, string Code, string Name, bool IsCash);
public sealed record DebtItem(long ReceivableId, long MemberId, string Description, [property: Column(TypeName="decimal(19,4)")] decimal TotalAmount, [property: Column(TypeName="decimal(19,4)")] decimal BalanceAmount, string CurrencyCode, DateOnly DueDate, string Status);
public sealed record ShiftItem(long CashShiftId, long BranchId, string RegisterName, string Status, DateTime OpenedAtUtc, DateTime? ClosedAtUtc, [property: Column(TypeName="decimal(19,4)")] decimal OpeningAmount, [property: Column(TypeName="decimal(19,4)")] decimal ExpectedAmount, decimal? CountedAmount, decimal? DifferenceAmount, string? OpeningNotes, string? ClosingNotes);
public sealed record MovementItem(long CashMovementId, string MovementType, [property: Column(TypeName="decimal(19,4)")] decimal Amount, string Description, DateTime CreatedAtUtc);
public sealed record AccessItem(long AttendanceEventId, long MemberId, string MemberCode, string FullName, string Result, string? ReasonCode, string AccessMethod, DateTime OccurredAtUtc, long BranchId);
public sealed record ReceiptSplit(string Method, bool IsCash, [property: Column(TypeName="decimal(19,4)")] decimal Amount, string? ExternalReference);
public sealed record ReceiptLine(string Description, [property: Column(TypeName="decimal(18,3)")] decimal Quantity, [property: Column(TypeName="decimal(19,4)")] decimal UnitPrice, [property: Column(TypeName="decimal(19,4)")] decimal TotalAmount);
public sealed record ReceiptDetail(PaymentResult Payment, string? MemberName, IReadOnlyList<ReceiptSplit> Splits, IReadOnlyList<ReceiptLine> Items);
public sealed record PosLine(Guid ProductPublicId, [property: Column(TypeName="decimal(18,3)")] decimal Quantity, [property: Column(TypeName="decimal(19,4)")] decimal ExpectedUnitPrice);
public sealed record PosRequest(Guid RequestId, long BranchId, long? MemberId, long? CashShiftId, string CurrencyCode, IReadOnlyList<PosLine> Items, IReadOnlyList<PaymentSplitInput> Splits);
public sealed record PosResult(Guid OrderPublicId, string OrderNumber, PaymentResult Payment);
public sealed record UpdateMemberRequest(string FirstName, string LastName, string? Phone, string? Email, byte[] RowVersion);
public sealed record QrCheckInRequest(string Credential, long BranchId);
