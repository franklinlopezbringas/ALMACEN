using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using GymFlow.Infrastructure.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GymFlow.Tests;

public sealed class AdminIntegrationTests
{
    public static bool IsConfigured => SqlServerIntegrationTests.IsConfigured;
    private sealed record Tenant(long OrganizationId) : ICurrentTenant { public bool IsResolved => OrganizationId > 0; }

    // Every case uses real SQL Server and rolls back all setup, writes and audit rows.
    [Theory(Skip = "Set GYMFLOW_TEST_CONNECTION for SQL integration.", SkipUnless = nameof(IsConfigured))]
    [InlineData("memberships")]
    [InlineData("crm")]
    [InlineData("classes")]
    [InlineData("inventory")]
    [InlineData("plans")]
    [InlineData("tenant")]
    public async Task AdminContractsPreserveTenantHistoryAndConcurrency(string area)
    {
        var ct = TestContext.Current.CancellationToken;
        await using var connection = new SqlConnection(Environment.GetEnvironmentVariable("GYMFLOW_TEST_CONNECTION"));
        await connection.OpenAsync(ct);
        await using var tx = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        await using var command = connection.CreateCommand(); command.Transaction = tx;
        command.CommandText = """
            SET QUOTED_IDENTIFIER ON; SET NOCOUNT ON;
            INSERT core.Organizations(LegalName,TradeName) VALUES('Patch rollback A','Patch rollback A');
            DECLARE @a bigint=SCOPE_IDENTITY();
            INSERT core.Organizations(LegalName,TradeName) VALUES('Patch rollback B','Patch rollback B');
            DECLARE @b bigint=SCOPE_IDENTITY();
            INSERT core.Branches(OrganizationId,Code,Name) VALUES(@a,'A','Branch A');
            DECLARE @branch bigint=SCOPE_IDENTITY();
            INSERT core.Branches(OrganizationId,Code,Name) VALUES(@b,'B','Branch B');
            DECLARE @otherBranch bigint=SCOPE_IDENTITY();
            DECLARE @email nvarchar(320)=CONCAT(NEWID(),'@example.test');
            INSERT security.Users(Email,NormalizedEmail,Status) VALUES(@email,UPPER(@email),'ACTIVE');
            DECLARE @actor bigint=SCOPE_IDENTITY();
            INSERT core.People(OrganizationId,FirstName,LastName) VALUES(@a,'Fictional','Member');
            DECLARE @person bigint=SCOPE_IDENTITY();
            INSERT core.Members(OrganizationId,PersonId,MemberCode) VALUES(@a,@person,'PATCH');
            DECLARE @member bigint=SCOPE_IDENTITY();
            INSERT membership.Plans(OrganizationId,Code,Name) VALUES(@a,'PLAN','Historic plan');
            DECLARE @plan bigint=SCOPE_IDENTITY();
            INSERT membership.PlanVersions(OrganizationId,PlanId,VersionNumber,Price,CurrencyCode,DurationValue,DurationUnit,ValidFrom)
                VALUES(@a,@plan,1,80,'PEN',1,'MONTH','2020-01-01');
            DECLARE @version bigint=SCOPE_IDENTITY();
            INSERT membership.PlanBenefits(OrganizationId,Code,Name) VALUES(@a,'BENEFIT','Historic benefit');
            DECLARE @benefit bigint=SCOPE_IDENTITY();
            INSERT membership.PlanVersionBenefits(OrganizationId,PlanVersionId,PlanBenefitId,ValueText)
                VALUES(@a,@version,@benefit,'Preserved condition');
            INSERT membership.Memberships(OrganizationId,MemberId,PlanVersionId,StartDate,EndDate,ContractedPrice,CurrencyCode,Status)
                VALUES(@a,@member,@version,CAST(SYSUTCDATETIME() AS date),DATEADD(day,7,CAST(SYSUTCDATETIME() AS date)),80,'PEN','ACTIVE'),
                (@a,@member,@version,'2020-01-01','2020-01-31',80,'PEN','ACTIVE');
            INSERT crm.Prospects(OrganizationId,PersonId,InterestedPlanId,FirstContactAtUtc,NextFollowUpAtUtc)
                VALUES(@a,@person,@plan,'2020-01-01','2030-01-01');
            DECLARE @prospect bigint=SCOPE_IDENTITY();
            INSERT crm.ProspectActivities(OrganizationId,ProspectId,ActivityType,OccurredAtUtc)
                VALUES(@a,@prospect,'CALL','2020-02-01'),(@a,@prospect,'VISIT','2020-03-01');
            INSERT core.Employees(OrganizationId,PersonId,EmployeeCode,JobTitle,HireDate) VALUES(@a,@person,'COACH','Coach','2020-01-01');
            DECLARE @employee bigint=SCOPE_IDENTITY();
            INSERT training.TrainerProfiles(OrganizationId,EmployeeId) VALUES(@a,@employee);
            DECLARE @coach bigint=SCOPE_IDENTITY();
            INSERT training.Classes(OrganizationId,Code,Name,DefaultCapacity,DurationMinutes) VALUES(@a,'CLASS','Patch class',10,45);
            DECLARE @class bigint=SCOPE_IDENTITY();
            INSERT training.ClassSessions(OrganizationId,ClassId,BranchId,TrainerProfileId,StartsAtUtc,EndsAtUtc,Capacity)
                VALUES(@a,@class,@branch,@coach,DATEADD(day,1,SYSUTCDATETIME()),DATEADD(day,2,SYSUTCDATETIME()),10);
            DECLARE @session bigint=SCOPE_IDENTITY();
            INSERT training.ClassReservations(OrganizationId,ClassSessionId,MemberId) VALUES(@a,@session,@member);
            INSERT commerce.Products(OrganizationId,Sku,Name,SalePrice,CurrencyCode) VALUES(@b,'OTHER','Other tenant product',20,'PEN');
            SELECT @a,@b,@branch,@otherBranch,@actor,@member,@plan,@version,@session;
            """;
        var ids = new long[9];
        await using (var reader = await command.ExecuteReaderAsync(ct))
        { Assert.True(await reader.ReadAsync(ct)); for (var i = 0; i < ids.Length; i++) ids[i] = reader.GetInt64(i); }
        var tenant = new Tenant(ids[0]);
        var options = new DbContextOptionsBuilder<GymFlowDbContext>().UseSqlServer(connection).Options;
        await using var db = new GymFlowDbContext(options, tenant); await db.Database.UseTransactionAsync(tx, ct);
        var clock = new SystemClock(); var service = new AdminCatalogService(db, tenant, clock);
        var memberships = new MembershipService(db, tenant, clock);
        var classes = new ClassService(db, tenant, clock);
        switch (area)
        {
            case "memberships":
                var all = await memberships.SearchAsync(new(PageSize: 1), ct);
                Assert.Equal(2, all.Total); Assert.Single(all.Items);
                var second = await memberships.SearchAsync(new(Page: 2, PageSize: 1), ct);
                Assert.NotEqual(all.Items[0].MembershipId, second.Items[0].MembershipId);
                Assert.Single((await memberships.SearchAsync(new(Status: "ACTIVE", MemberId: ids[5], PlanId: ids[6],
                    ExpiresFrom: DateOnly.FromDateTime(DateTime.UtcNow), ExpiresTo: DateOnly.FromDateTime(DateTime.UtcNow).AddDays(7)), ct)).Items);
                Assert.Empty((await memberships.SearchAsync(new(Status: "FROZEN"), ct)).Items);
                var expired = Assert.Single((await memberships.SearchAsync(new(Status: "EXPIRED"), ct)).Items);
                Assert.Equal("EXPIRED", expired.Status); Assert.Equal("ACTIVE", expired.StoredStatus);
                Assert.Empty((await memberships.SearchAsync(new(Search: "not found"), ct)).Items);
                Assert.Empty(db.ChangeTracker.Entries());
                break;
            case "crm":
                var prospect = Assert.Single((await new CrmService(db, tenant, clock).SearchAsync(null, "NEW", 1, 25, ct)).Items);
                Assert.Equal("Historic plan", prospect.InterestedPlan);
                Assert.Equal(new DateTime(2020, 3, 1), prospect.LastContactAtUtc);
                Assert.Equal(new DateTime(2030, 1, 1), prospect.NextFollowUpAtUtc);
                Assert.Empty(db.ChangeTracker.Entries());
                break;
            case "classes":
                var session = Assert.Single((await classes.UpcomingAsync(DateTime.UtcNow, 1, 25, ct)).Items);
                Assert.Equal("Fictional Member", session.CoachName); Assert.Equal(9, session.AvailablePlaces);
                Assert.Single((await classes.ParticipantsAsync(ids[8], "CONFIRMED", 1, 1, ct)).Items);
                Assert.Empty((await classes.ParticipantsAsync(ids[8], "WAITLISTED", 1, 1, ct)).Items);
                Assert.Empty(db.ChangeTracker.Entries());
                break;
            case "inventory":
                var id = await service.SaveProductAsync(null, new("PATCH", "Bottle", 25, "PEN", 2, false, "ACTIVE", null), ids[4], ct);
                var product = Assert.Single((await service.ProductsAsync(null, null, ids[2], 1, 25, ct)).Items);
                Assert.Equal(0, product.Stock); Assert.Equal(2, product.MinimumStock);
                var productId = await db.Products.Where(x => x.PublicId == id).Select(x => x.ProductId).SingleAsync(ct);
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT commerce.InventoryMovements(OrganizationId,BranchId,ProductId,MovementType,Quantity,Reason) VALUES({ids[0]},{ids[2]},{productId},'ADJUSTMENT_IN',7,'Rollback integration test'); INSERT commerce.InventoryBalances(OrganizationId,BranchId,ProductId,QuantityOnHand) VALUES({ids[0]},{ids[2]},{productId},7);", ct);
                Assert.Equal(7, (await service.ProductsAsync(null, null, ids[2], 1, 25, ct)).Items.Single().Stock);
                var request = new SaveProductRequest("PATCH", "Bottle updated", 30, "PEN", 3, false, "INACTIVE", product.RowVersion);
                await service.SaveProductAsync(id, request, ids[4], ct);
                await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => service.SaveProductAsync(id, request, ids[4], ct));
                Assert.Single((await service.ProductsAsync(null, "INACTIVE", ids[2], 1, 25, ct)).Items);
                Assert.Equal(7, (await db.InventoryBalances.AsNoTracking().SingleAsync(ct)).QuantityOnHand);
                Assert.Equal(7, (await service.ProductsAsync(null, "INACTIVE", ids[2], 1, 25, ct)).Items.Single().Stock);
                command.CommandText = "SELECT COUNT(*) FROM commerce.vw_InventoryLedgerBalances v JOIN commerce.InventoryBalances b ON b.OrganizationId=v.OrganizationId AND b.BranchId=v.BranchId AND b.ProductId=v.ProductId WHERE v.OrganizationId=" + ids[0].ToString(System.Globalization.CultureInfo.InvariantCulture) + " AND v.LedgerQuantity=b.QuantityOnHand AND v.LedgerQuantity=7";
                Assert.Equal(1, Convert.ToInt32(await command.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture));
                await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ProductsAsync(null, null, ids[3], 1, 25, ct));
                break;
            case "plans":
                var plan = Assert.Single((await service.PlansAsync(null, null, 1, 25, ct)).Items);
                var versionId = await service.PublishVersionAsync(plan.PublicId, new(new(100, "PEN", 2, "MONTH", 5, 8), plan.RowVersion), ids[4], ct);
                var updated = Assert.Single((await service.PlansAsync(null, null, 1, 25, ct)).Items);
                Assert.Equal(2, updated.VersionNumber); Assert.Equal(versionId, updated.PlanVersionId);
                Assert.Equal(100, updated.Terms!.Price); Assert.Equal(8, updated.Terms.ClassReservationLimit);
                Assert.Equal(80, (await db.PlanVersions.AsNoTracking().SingleAsync(x => x.PlanVersionId == ids[7], ct)).Price);
                command.CommandText = "SELECT COUNT(*) FROM membership.PlanVersionBenefits WHERE PlanVersionId=" + versionId.ToString(System.Globalization.CultureInfo.InvariantCulture) + " AND ValueText='Preserved condition'";
                Assert.Equal(1, Convert.ToInt32(await command.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture));
                Assert.All(await db.Memberships.AsNoTracking().ToListAsync(ct), m => { Assert.Equal(80, m.ContractedPrice); Assert.Equal(ids[7], m.PlanVersionId); });
                await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => service.PublishVersionAsync(plan.PublicId, new(new(90, "PEN", 1, "MONTH", 0, null), plan.RowVersion), ids[4], ct));
                var created = await service.CreatePlanAsync(new(new("NEW", "New plan", null, false, "ACTIVE", null), new(0, "PEN", 1, "DAY", 0, null)), ids[4], ct);
                var row = (await service.PlansAsync("New plan", null, 1, 25, ct)).Items.Single();
                await service.UpdatePlanAsync(created, new("NEW", "New plan", null, false, "INACTIVE", row.RowVersion), ids[4], ct);
                Assert.Single((await service.PlansAsync(null, "INACTIVE", 1, 25, ct)).Items);
                await Assert.ThrowsAsync<InvalidOperationException>(() => memberships.CreateAsync(
                    new(ids[5], row.PlanVersionId!.Value, ids[2], DateOnly.FromDateTime(DateTime.UtcNow), "ADMIN"), ids[4], ct));
                break;
            case "tenant":
            {
                await using var other = new GymFlowDbContext(options, new Tenant(ids[1])); await other.Database.UseTransactionAsync(tx, ct);
                var foreign = await other.Products.AsNoTracking().SingleAsync(ct);
                await Assert.ThrowsAsync<KeyNotFoundException>(() => service.SaveProductAsync(foreign.PublicId,
                    new("OTHER", "Should not change", 0, "PEN", 0, false, "INACTIVE", foreign.RowVersion), ids[4], ct));
                var otherService = new AdminCatalogService(other, new Tenant(ids[1]), clock);
                Assert.Empty((await otherService.PlansAsync(null, null, 1, 25, ct)).Items);
                Assert.Empty((await new MembershipService(other, new Tenant(ids[1]), clock).SearchAsync(new(MemberId: ids[5]), ct)).Items);
                Assert.Empty((await new CrmService(other, new Tenant(ids[1]), clock).SearchAsync(null, null, 1, 25, ct)).Items);
                await Assert.ThrowsAsync<KeyNotFoundException>(() => new ClassService(other, new Tenant(ids[1]), clock).ParticipantsAsync(ids[8], null, 1, 25, ct));
                var ownPlan = Assert.Single((await service.PlansAsync(null, null, 1, 25, ct)).Items);
                await Assert.ThrowsAsync<KeyNotFoundException>(() => otherService.UpdatePlanAsync(ownPlan.PublicId,
                    new("PLAN", "Wrong", null, false, "INACTIVE", ownPlan.RowVersion), ids[4], ct));
                break;
            }
        }
        if (area is "inventory" or "plans")
        {
            command.CommandText = "SELECT COUNT(*) FROM audit.AuditLogs WHERE OrganizationId=@org AND UserId=@actor AND ISJSON(AfterJson)=1 AND EntityId IS NOT NULL AND (Action LIKE '%.CREATE' OR ISJSON(BeforeJson)=1)";
            command.Parameters.AddWithValue("@org", ids[0]); command.Parameters.AddWithValue("@actor", ids[4]);
            Assert.True(Convert.ToInt32(await command.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture) >= 2);
        }
        await tx.RollbackAsync(ct);
    }
}
