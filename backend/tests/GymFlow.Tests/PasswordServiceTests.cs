using Xunit;
using GymFlow.Infrastructure.Security;

namespace GymFlow.Tests;

public sealed class PasswordServiceTests
{
    [Fact]
    public void HashAndVerifyRoundTrip()
    {
        var service = new PasswordService();
        var hash = service.Hash("S3cure-Demo-Password!");
        Assert.True(service.Verify("S3cure-Demo-Password!", hash));
        Assert.False(service.Verify("wrong", hash));
    }
}
