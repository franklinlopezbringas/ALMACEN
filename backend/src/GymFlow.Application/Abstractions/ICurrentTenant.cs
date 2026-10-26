namespace GymFlow.Application.Abstractions;

public interface ICurrentTenant
{
    long OrganizationId { get; }
    bool IsResolved { get; }
}
