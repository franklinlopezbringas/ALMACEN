using GymFlow.Application.Abstractions;
using GymFlow.Domain.Common;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using GymFlow.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GymFlow.Tests;

public sealed class PersistenceRegressionTests
{
    private sealed record Tenant(long OrganizationId) : ICurrentTenant
    {
        public bool IsResolved => OrganizationId > 0;
    }

    private static GymFlowDbContext Context(long id) => new(
        new DbContextOptionsBuilder<GymFlowDbContext>().UseSqlServer("Server=.\\SQLEXPRESS;Database=GymFlowDb;Integrated Security=True;TrustServerCertificate=True").Options,
        new Tenant(id));

    [Fact]
    public void EveryTenantEntityHasQueryFilter()
    {
        using var db = Context(1);
        foreach (var entity in db.Model.GetEntityTypes().Where(x => typeof(ITenantEntity).IsAssignableFrom(x.ClrType)))
            Assert.NotNull(entity.GetDeclaredQueryFilters().SingleOrDefault());
    }

    [Fact]
    public void CachedModelUsesTheCurrentContextTenant()
    {
        using var first = Context(71);
        using var second = Context(93);
        var firstSql = first.Members.ToQueryString();
        var secondSql = second.Members.ToQueryString();
        Assert.Contains("71", firstSql, StringComparison.Ordinal);
        Assert.Contains("93", secondSql, StringComparison.Ordinal);
        Assert.DoesNotContain("71", secondSql, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    public async Task CrossTenantInsertFailsBeforeDatabaseAccess(long organizationId)
    {
        await using var db = Context(1);
        db.Members.Add(new Member { OrganizationId = organizationId });
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => db.SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public void TenantOwnershipCannotBeChangedOnAttachedEntity()
    {
        using var db = Context(1);
        var member = new Member { MemberId = 1, OrganizationId = 2 };
        db.Attach(member);
        member.OrganizationId = 1;
        Assert.Throws<UnauthorizedAccessException>(() => db.SaveChanges());
    }

    [Theory]
    [InlineData("pbkdf2-sha256$0$AA==$AA==")]
    [InlineData("pbkdf2-sha256$210000$$")]
    [InlineData("pbkdf2-sha256$999999999$AA==$AA==")]
    [InlineData("pbkdf2-sha256$210000$invalid$invalid")]
    public void MalformedPasswordHashesFailClosed(string hash)
    {
        Assert.False(new PasswordService().Verify("test", hash));
    }
}
