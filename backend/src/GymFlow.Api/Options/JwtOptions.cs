namespace GymFlow.Api.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Issuer { get; init; } = "GymFlow";
    public string Audience { get; init; } = "GymFlow.Client";
    public string SigningKey { get; init; } = string.Empty;
    public int AccessTokenMinutes { get; init; } = 15;
}
