using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using GymFlow.Api.Options;
using GymFlow.Application.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace GymFlow.Api.Auth;

public sealed class JwtTokenService(IOptions<JwtOptions> options, IClock clock) : ITokenService
{
    private readonly JwtOptions _options = options.Value;

    public AccessTokenIssue CreateAccessToken(Guid userPublicId,long userId,Guid organizationPublicId,long organizationId,string email,IReadOnlyCollection<string> roles,IReadOnlyCollection<string> permissions)
    {
        if (string.IsNullOrWhiteSpace(_options.SigningKey) || _options.SigningKey.Length < 32)
            throw new InvalidOperationException("Jwt:SigningKey must contain at least 32 characters.");

        var now=clock.UtcNow;
        var expires=now.AddMinutes(Math.Clamp(_options.AccessTokenMinutes,5,60));
        var claims=new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,userPublicId.ToString()),
            new("uid",userId.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new("org",organizationId.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new("org_public",organizationPublicId.ToString()),
            new(JwtRegisteredClaimNames.Email,email),
            new(JwtRegisteredClaimNames.Jti,Guid.NewGuid().ToString())
        };
        claims.AddRange(roles.Select(x=>new Claim(ClaimTypes.Role,x)));
        claims.AddRange(permissions.Select(x=>new Claim("perm",x)));

        var key=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        var token=new JwtSecurityToken(_options.Issuer,_options.Audience,claims,now,expires,new SigningCredentials(key,SecurityAlgorithms.HmacSha256));
        return new AccessTokenIssue(new JwtSecurityTokenHandler().WriteToken(token),expires);
    }

    public string CreateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    public byte[] HashRefreshToken(string refreshToken) => SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken));
}
