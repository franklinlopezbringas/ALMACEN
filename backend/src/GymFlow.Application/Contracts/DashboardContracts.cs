namespace GymFlow.Application.Contracts;

public sealed record DashboardSummary(long ActiveMembers, long ExpiringMembershipsNext7Days, decimal OutstandingReceivables, long EntriesToday);
