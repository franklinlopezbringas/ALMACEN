using GymFlow.Application.Abstractions;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Persistence;
using GymFlow.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GymFlow.Infrastructure.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddGymFlowInfrastructure(this IServiceCollection services,IConfiguration configuration)
    {
        var connectionString=configuration.GetConnectionString("GymFlow")
            ?? throw new InvalidOperationException("ConnectionStrings:GymFlow is required.");

        services.AddDbContext<GymFlowDbContext>(options=>
            options.ConfigureWarnings(w => w.Ignore(SqlServerEventId.SavepointsDisabledBecauseOfMARS))
            // MARS is explicitly required locally. Every service aborts/disposes its
            // entire transaction on failure; none retries SaveChanges within it.
            .UseSqlServer(connectionString,sql=>
            {
                // Services own explicit transactions. Do not replay financial writes
                // automatically when the outcome of a commit is unknown.
                sql.CommandTimeout(30);
            }));

        services.AddSingleton<IClock,SystemClock>();
        services.AddSingleton<IPasswordService,PasswordService>();
        services.AddScoped<IAuthService,AuthService>();
        services.AddScoped<IMemberService,MemberService>();
        services.AddScoped<IMembershipService,MembershipService>();
        services.AddScoped<IPaymentService,PaymentService>();
        services.AddScoped<IAccessService,AccessService>();
        services.AddScoped<IDashboardService,DashboardService>();
        services.AddScoped<IClassService,ClassService>();
        services.AddScoped<IProductService,ProductService>();
        services.AddScoped<ICashService,CashService>();
        services.AddScoped<ICrmService,CrmService>();
        services.AddScoped<ITrainerService,TrainerService>();
        services.AddScoped<ILoyaltyService,LoyaltyService>();
        services.AddScoped<INotificationService,NotificationService>();
        services.AddScoped<IAutomationService,AutomationService>();
        services.AddScoped<IPublicCatalogService,PublicCatalogService>();
        services.AddScoped<AdminCatalogService>();
        services.AddScoped<ReceptionService>();
        services.AddScoped<PosService>();
        services.AddScoped<HandoffService>();
        services.AddScoped<ClassOperationsService>();
        services.AddScoped<AccessExceptionService>();
        services.AddScoped<SupportService>();
        services.AddScoped<ReturnsService>();
        return services;
    }
}
