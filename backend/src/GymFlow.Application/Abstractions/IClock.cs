namespace GymFlow.Application.Abstractions;

public interface IClock
{
    DateTime UtcNow { get; }
}
