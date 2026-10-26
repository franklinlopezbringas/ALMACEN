using Xunit;
namespace GymFlow.Tests;

public sealed class ArchitectureSmokeTests
{
    [Fact]
    public void CoreProjectNamesAreStable()
    {
        Assert.Equal("GymFlow.Domain", typeof(GymFlow.Domain.Entities.Member).Assembly.GetName().Name);
        Assert.Equal("GymFlow.Application", typeof(GymFlow.Application.Contracts.PagedResult<>).Assembly.GetName().Name);
        Assert.Equal("GymFlow.Infrastructure", typeof(GymFlow.Infrastructure.Persistence.GymFlowDbContext).Assembly.GetName().Name);
    }
}
