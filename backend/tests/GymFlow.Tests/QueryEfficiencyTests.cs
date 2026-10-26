using System.Data.Common;
using GymFlow.Application.Abstractions;
using GymFlow.Infrastructure.Persistence;
using GymFlow.Infrastructure.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace GymFlow.Tests;

public sealed class QueryEfficiencyTests
{
    public static bool IsConfigured => SqlServerIntegrationTests.IsConfigured;
    private sealed record Tenant(long OrganizationId) : ICurrentTenant
    {
        public bool IsResolved => OrganizationId > 0;
    }

    private sealed class Counter : DbCommandInterceptor
    {
        public int Reads { get; set; }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            Reads++;
            return ValueTask.FromResult(result);
        }
    }

    [Theory(Skip = "Set GYMFLOW_TEST_CONNECTION for real SQL integration.", SkipUnless = nameof(IsConfigured))]
    [InlineData("members")]
    [InlineData("classes")]
    [InlineData("products")]
    [InlineData("prospects")]
    [InlineData("notifications")]
    [InlineData("rewards")]
    public async Task PageSizeDoesNotIncreaseQueryCountOrTrackReadOnlyEntities(string serviceName)
    {
        var ct = TestContext.Current.CancellationToken;
        await using var connection = new SqlConnection(Environment.GetEnvironmentVariable("GYMFLOW_TEST_CONNECTION"));
        await connection.OpenAsync(ct);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            SET QUOTED_IDENTIFIER ON;
            INSERT core.Organizations(LegalName,TradeName) VALUES('Query validation','Query validation');
            DECLARE @org bigint=SCOPE_IDENTITY();
            INSERT core.Branches(OrganizationId,Code,Name) VALUES(@org,'Q','Query branch');
            DECLARE @branch bigint=SCOPE_IDENTITY();
            DECLARE @email nvarchar(320)=CONCAT(NEWID(),'@demo.gymflow.local');
            INSERT security.Users(Email,NormalizedEmail,Status) VALUES(@email,UPPER(@email),'ACTIVE');
            DECLARE @user bigint=SCOPE_IDENTITY();
            INSERT training.Classes(OrganizationId,Code,Name,DefaultCapacity,DurationMinutes) VALUES(@org,'Q','Query class',10,45);
            DECLARE @class bigint=SCOPE_IDENTITY();
            DECLARE @i int=1;
            WHILE @i<=3 BEGIN
                INSERT core.People(OrganizationId,FirstName,LastName) VALUES(@org,'Identical','Names');
                DECLARE @person bigint=SCOPE_IDENTITY();
                INSERT core.Members(OrganizationId,PersonId,MemberCode) VALUES(@org,@person,CONCAT('Q',@i));
                INSERT crm.Prospects(OrganizationId,PersonId) VALUES(@org,@person);
                INSERT commerce.Products(OrganizationId,Sku,Name,SalePrice,CurrencyCode) VALUES(@org,CONCAT('Q',@i),'Identical products',1,'PEN');
                DECLARE @product bigint=SCOPE_IDENTITY();
                INSERT commerce.InventoryBalances(OrganizationId,BranchId,ProductId,QuantityOnHand) VALUES(@org,@branch,@product,0);
                INSERT training.ClassSessions(OrganizationId,ClassId,BranchId,StartsAtUtc,EndsAtUtc,Capacity)
                VALUES(@org,@class,@branch,DATEADD(day,1,SYSUTCDATETIME()),DATEADD(day,2,SYSUTCDATETIME()),10);
                INSERT communication.Notifications(OrganizationId,UserId,NotificationType,Title,Body) VALUES(@org,@user,'TEST','Test','Test');
                INSERT loyalty.Rewards(OrganizationId,RewardType,Name,PointsCost) VALUES(@org,'BENEFIT','Identical rewards',1);
                SET @i+=1;
            END;
            SELECT @org,@user,@branch;
            """;
        long organizationId, userId, branchId;
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            Assert.True(await reader.ReadAsync(ct));
            organizationId = reader.GetInt64(0);
            userId = reader.GetInt64(1);
            branchId = reader.GetInt64(2);
        }
        var counter = new Counter();
        var tenant = new Tenant(organizationId);
        await using var db = new GymFlowDbContext(new DbContextOptionsBuilder<GymFlowDbContext>()
            .UseSqlServer(connection).AddInterceptors(counter).Options, tenant);
        await db.Database.UseTransactionAsync(transaction, ct);
        var clock = new SystemClock();
        async Task<int> ReadPage(int size)
        {
            return serviceName switch
            {
                "members" => (await new MemberService(db, tenant, clock).SearchAsync(null, 1, size, ct)).Items.Count,
                "classes" => (await new ClassService(db, tenant, clock).UpcomingAsync(DateTime.UtcNow, 1, size, ct)).Items.Count,
                "products" => (await new ProductService(db).SearchAsync(null, branchId, 1, size, ct)).Items.Count,
                "prospects" => (await new CrmService(db, tenant, clock).SearchAsync(null, null, 1, size, ct)).Items.Count,
                "notifications" => (await new NotificationService(db, tenant, clock).MineAsync(userId, 1, size, ct)).Items.Count,
                "rewards" => (await new LoyaltyService(db, tenant, clock).RewardsAsync(1, size, ct)).Items.Count,
                _ => throw new ArgumentOutOfRangeException(nameof(serviceName))
            };
        }
        Assert.Equal(1, await ReadPage(1));
        var smallPageReads = counter.Reads;
        counter.Reads = 0;
        Assert.Equal(3, await ReadPage(100));
        Assert.Equal(smallPageReads, counter.Reads);
        Assert.InRange(counter.Reads, 1, 3);
        Assert.Empty(db.ChangeTracker.Entries());
        await transaction.RollbackAsync(ct);
    }
}
