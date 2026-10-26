namespace GymFlow.Application.Contracts;

public sealed record LoginRequest(string Email, string Password, Guid OrganizationPublicId, string? DeviceName);
public sealed record RefreshRequest(string RefreshToken);
public sealed record AuthResponse(string AccessToken, DateTime AccessTokenExpiresAtUtc, string RefreshToken, DateTime RefreshTokenExpiresAtUtc, UserContext User);
public sealed record UserContext(Guid UserPublicId, Guid OrganizationPublicId, string Email, IReadOnlyList<string> Roles, IReadOnlyList<string> Permissions);
