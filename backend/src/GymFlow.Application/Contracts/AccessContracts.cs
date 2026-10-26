namespace GymFlow.Application.Contracts;

public sealed record CheckInRequest(long MemberId, long BranchId, string AccessMethod, long? DeviceId);
public sealed record CheckInResult(bool Allowed, string Result, string? ReasonCode, long AttendanceEventId, DateTime OccurredAtUtc);
