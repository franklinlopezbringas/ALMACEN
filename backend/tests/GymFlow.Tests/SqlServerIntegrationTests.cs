using GymFlow.Application.Abstractions;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Xunit;

namespace GymFlow.Tests;

public sealed class SqlServerIntegrationTests
{
    public static bool IsConfigured => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GYMFLOW_TEST_CONNECTION"));

    private sealed record Tenant(long OrganizationId) : ICurrentTenant
    {
        public bool IsResolved => OrganizationId > 0;
    }

    [Fact(Skip = "Set GYMFLOW_TEST_CONNECTION for real SQL integration.", SkipUnless = nameof(IsConfigured))]
    public async Task RowVersionRejectsStaleEfUpdateAndTransactionRollsBack()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var connection = new SqlConnection(Environment.GetEnvironmentVariable("GYMFLOW_TEST_CONNECTION"));
        await connection.OpenAsync(ct);
        var options = new DbContextOptionsBuilder<GymFlowDbContext>().UseSqlServer(connection).Options;
        await using var setup = new GymFlowDbContext(options, new Tenant(0));
        await using var transaction = await setup.Database.BeginTransactionAsync(ct);
        var organization = new Organization { PublicId = Guid.NewGuid(), LegalName = "Rollback validation", TradeName = "Rollback validation", CreatedAtUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow };
        setup.Organizations.Add(organization);
        await setup.SaveChangesAsync(ct);

        await using var first = new GymFlowDbContext(options, new Tenant(organization.OrganizationId));
        await first.Database.UseTransactionAsync(transaction.GetDbTransaction(), ct);
        var person = new Person { OrganizationId = organization.OrganizationId, PublicId = Guid.NewGuid(), FirstName = "Validation", LastName = "Concurrency" };
        first.People.Add(person);
        await first.SaveChangesAsync(ct);
        var member = new Member { OrganizationId = organization.OrganizationId, PublicId = Guid.NewGuid(), PersonId = person.PersonId, MemberCode = "VALIDATION", RegistrationDate = DateOnly.FromDateTime(DateTime.UtcNow) };
        first.Members.Add(member);
        await first.SaveChangesAsync(ct);

        await using var second = new GymFlowDbContext(options, new Tenant(organization.OrganizationId));
        await second.Database.UseTransactionAsync(transaction.GetDbTransaction(), ct);
        var stale = await second.Members.SingleAsync(x => x.MemberId == member.MemberId, ct);
        member.Status = "INACTIVE";
        await first.SaveChangesAsync(ct);
        stale.Status = "BLOCKED";
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync(ct));
        await transaction.RollbackAsync(ct);
        Assert.False(await setup.Organizations.AsNoTracking().AnyAsync(x => x.OrganizationId == organization.OrganizationId, ct));
    }

    [Fact(Skip = "Set GYMFLOW_TEST_CONNECTION for real SQL integration.", SkipUnless = nameof(IsConfigured))]
    public async Task EveryMappedPropertyExistsInCanonicalSqlDatabase()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var connection = new SqlConnection(Environment.GetEnvironmentVariable("GYMFLOW_TEST_CONNECTION"));
        await connection.OpenAsync(ct);
        await using var db = new GymFlowDbContext(new DbContextOptionsBuilder<GymFlowDbContext>().UseSqlServer(connection).Options, new Tenant(0));
        foreach (var entity in db.Model.GetEntityTypes())
        {
            var table = entity.GetTableName() ?? entity.GetViewName();
            var schema = entity.GetSchema() ?? entity.GetViewSchema();
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(@table)";
            command.Parameters.AddWithValue("@table", schema+"."+table);
            var columns = new HashSet<string>(StringComparer.Ordinal);
            await using (var reader = await command.ExecuteReaderAsync(ct))
                while (await reader.ReadAsync(ct)) columns.Add(reader.GetString(0));
            Assert.NotEmpty(columns);
            foreach (var property in entity.GetProperties()) Assert.Contains(property.Name, columns);
        }
    }
}
