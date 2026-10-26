using System.Text;
using System.Threading.RateLimiting;
using GymFlow.Api.Auth;
using GymFlow.Api.Endpoints;
using GymFlow.Api.Middleware;
using GymFlow.Api.Options;
using GymFlow.Application.Abstractions;
using GymFlow.Infrastructure.Persistence;
using GymFlow.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddResponseCompression();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentTenant, HttpContextCurrentTenant>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddGymFlowInfrastructure(builder.Configuration);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwt.SigningKey) || jwt.SigningKey.Length < 32)
    throw new InvalidOperationException("Jwt:SigningKey must be configured with at least 32 characters (prefer an environment variable or secret store).");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.User.Identity?.IsAuthenticated == true
                ? context.User.FindFirst("uid")?.Value ?? "authenticated"
                : context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 300, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

builder.Services.AddHealthChecks();

var app = builder.Build();
app.UseMiddleware<ApiExceptionMiddleware>();
app.UseResponseCompression();
if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.MapHealthChecks("/health/live");
app.MapGet("/health/ready", async (GymFlowDbContext db, CancellationToken ct) =>
{
    var ready = await db.Database.CanConnectAsync(ct);
    return ready ? Results.Ok(new { status = "ready" }) : Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
}).AllowAnonymous();

app.MapAuthEndpoints();
app.MapDashboardEndpoints();
app.MapMemberEndpoints();
app.MapMembershipEndpoints();
app.MapPaymentEndpoints();
app.MapAccessEndpoints();
app.MapClassEndpoints();
app.MapProductEndpoints();
app.MapCashEndpoints();
app.MapCrmEndpoints();
app.MapTrainerEndpoints();
app.MapLoyaltyEndpoints();
app.MapNotificationEndpoints();
app.MapAutomationEndpoints();
app.MapPublicEndpoints();
app.MapAdminCatalogEndpoints();
app.MapReceptionEndpoints();
app.MapReceptionClosureEndpoints();

if (app.Environment.IsDevelopment())
{
    var demoPassword = app.Configuration["GYMFLOW_DEMO_PASSWORD"];
    if (!string.IsNullOrWhiteSpace(demoPassword))
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GymFlowDbContext>();
        var passwordService = scope.ServiceProvider.GetRequiredService<IPasswordService>();
        var demoUsers = await db.Users.Where(x => x.Email.EndsWith("@demo.gymflow.local") && x.PasswordHash == null).ToListAsync();
        foreach (var user in demoUsers) user.PasswordHash = passwordService.Hash(demoPassword);
        if (demoUsers.Count > 0) await db.SaveChangesAsync();
    }
}

app.Run();

public partial class Program;
