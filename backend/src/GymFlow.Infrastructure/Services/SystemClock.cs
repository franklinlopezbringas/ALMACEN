using GymFlow.Application.Abstractions;

namespace GymFlow.Infrastructure.Services;

public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
