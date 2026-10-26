using System.ComponentModel.DataAnnotations.Schema;
namespace GymFlow.Application.Contracts;

public sealed record CreateHandoffRequest(Guid RequestId, long BranchId, long? ToEmployeeId, long? CashShiftId, string? Notes, string? PendingItems);
public sealed record HandoffTransitionRequest(byte[] RowVersion);
public sealed record HandoffItem(long ShiftHandoffId, long BranchId, long FromEmployeeId, string FromName, long? ToEmployeeId, string? ToName, long? CashShiftId, string Status, string? Notes, string? PendingItems, DateTime HandedOffAtUtc, DateTime? AcknowledgedAtUtc, long CreatedByUserId, byte[] RowVersion);
public sealed record ReceptionEmployeeItem(long EmployeeId, string FullName);

public sealed record ClassTransitionRequest(Guid RequestId, string Status, DateTime ReservedAtUtc);
public sealed record ExceptionRequest(Guid RequestId, long MemberId, string Reason, DateTime ValidFromUtc, DateTime ValidToUtc);
public sealed record ExceptionReviewRequest(string Status);
public sealed record ExceptionItem(long AccessExceptionId,long MemberId,string FullName,string Reason,string Status,DateTime ValidFromUtc,DateTime ValidToUtc,long RequestedByUserId,long? ReviewedByUserId,DateTime RequestedAtUtc,DateTime? ReviewedAtUtc);
public sealed record IncidentRequest(Guid RequestId,long? MemberId,string Category,string Priority,string Subject,string Description);
public sealed record IncidentItem(long SupportTicketId,long? MemberId,string? MemberName,long? ConversationId,string Category,string Priority,string Status,string Subject,DateTime CreatedAtUtc);
public sealed record MessageRequest(Guid RequestId,string Body);
public sealed record ConversationItem(long ConversationId,string? Subject,string ConversationType,DateTime CreatedAtUtc,DateTime? ClosedAtUtc);
public sealed record MessageItem(long MessageId,long SenderUserId,string Body,DateTime SentAtUtc);
public sealed record ReturnRequest(Guid RequestId,long OrderItemId,[property: Column(TypeName="decimal(18,3)")] decimal Quantity,string Reason);
public sealed record ReturnProcessRequest(Guid RequestId,long? CashShiftId,IReadOnlyList<RefundSplitInput> Splits);
public sealed record RefundSplitInput(long PaymentSplitId,[property: Column(TypeName="decimal(19,4)")] decimal Amount);
public sealed record ReturnItem(long ProductReturnId,long OrderId,long OrderItemId,long ProductId,string ProductName,[property: Column(TypeName="decimal(18,3)")] decimal Quantity,[property: Column(TypeName="decimal(19,4)")] decimal Amount,string Reason,string Status,DateTime RequestedAtUtc);
public sealed record ReturnableLine(long OrderItemId,Guid OrderPublicId,string OrderNumber,string Description,[property: Column(TypeName="decimal(18,3)")] decimal Quantity,[property: Column(TypeName="decimal(18,3)")] decimal ReturnedQuantity,[property: Column(TypeName="decimal(19,4)")] decimal UnitPrice);
public sealed record RefundSource(long PaymentSplitId,string MethodName,bool IsCash,[property: Column(TypeName="decimal(19,4)")] decimal Amount,[property: Column(TypeName="decimal(19,4)")] decimal RefundedAmount);
