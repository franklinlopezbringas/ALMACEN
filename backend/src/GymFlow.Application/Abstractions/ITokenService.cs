namespace GymFlow.Application.Abstractions;

public sealed record AccessTokenIssue(string Token, DateTime ExpiresAtUtc);

public interface ITokenService
{
    AccessTokenIssue CreateAccessToken(Guid userPublicId, long userId, Guid organizationPublicId, long organizationId, string email, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions);
    string CreateRefreshToken();
    byte[] HashRefreshToken(string refreshToken);
}
