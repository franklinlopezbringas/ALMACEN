using GymFlow.Application.Contracts;

namespace GymFlow.Application.Services;

public interface IAuthService
{
    Task<AuthResponse?> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken);
    Task<AuthResponse?> RefreshAsync(RefreshRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken);
}

public interface IMemberService
{
    Task<PagedResult<MemberListItem>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken);
    Task<MemberDetail?> GetAsync(Guid publicId, CancellationToken cancellationToken);
    Task<MemberDetail> CreateAsync(CreateMemberRequest request, CancellationToken cancellationToken);
}

public interface IMembershipService
{
    Task<PagedResult<MembershipListItem>> SearchAsync(MembershipQuery query, CancellationToken cancellationToken);
    Task<MembershipResult> CreateAsync(CreateMembershipRequest request, long? actorUserId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ExpiringMembershipItem>> ExpiringAsync(int days, int take, CancellationToken cancellationToken);
}

public interface IPaymentService
{
    Task<PaymentResult> RegisterAsync(RegisterPaymentRequest request, long actorUserId, CancellationToken cancellationToken);
}

public interface IAccessService
{
    Task<CheckInResult> CheckInAsync(CheckInRequest request, long? actorUserId, CancellationToken cancellationToken);
}

public interface IDashboardService
{
    Task<DashboardSummary> GetSummaryAsync(CancellationToken cancellationToken);
}

public interface IClassService
{
    Task<PagedResult<ClassParticipantItem>> ParticipantsAsync(long sessionId, string? status, int page, int pageSize, CancellationToken cancellationToken);
    Task<PagedResult<ClassSessionListItem>> UpcomingAsync(DateTime fromUtc, int page, int pageSize, CancellationToken cancellationToken);
    Task ReserveAsync(long classSessionId, ReserveClassRequest request, long actorUserId, CancellationToken cancellationToken, string source = "MEMBER_APP");
}

public interface IProductService
{
    Task<PagedResult<ProductListItem>> SearchAsync(string? search, long? branchId, int page, int pageSize, CancellationToken cancellationToken);
}

public interface ICashService
{
    Task<CashShiftResult> OpenAsync(OpenCashShiftRequest request, long actorUserId, CancellationToken cancellationToken);
    Task<CashShiftResult> CloseAsync(long cashShiftId, CloseCashShiftRequest request, long actorUserId, CancellationToken cancellationToken);
}

public interface ICrmService
{
    Task<PagedResult<ProspectListItem>> SearchAsync(string? search, string? status, int page, int pageSize, CancellationToken cancellationToken);
    Task<long> CreateAsync(CreateProspectRequest request, long actorUserId, CancellationToken cancellationToken);
    Task<MemberDetail> ConvertAsync(long prospectId, ConvertProspectRequest request, long actorUserId, CancellationToken cancellationToken);
}

public interface ITrainerService
{
    Task<PagedResult<AssignedMemberItem>> AssignedMembersAsync(long actorUserId, int page, int pageSize, CancellationToken cancellationToken);
    Task<long> AddProgressReviewAsync(long actorUserId, AddProgressReviewRequest request, CancellationToken cancellationToken);
}

public interface ILoyaltyService
{
    Task<PointBalanceResult> GetBalanceAsync(long memberId, CancellationToken cancellationToken);
    Task<PagedResult<PointTransactionItem>> GetTransactionsAsync(long memberId, int page, int pageSize, CancellationToken cancellationToken);
    Task<PagedResult<RewardItem>> RewardsAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<RedemptionResult> RedeemAsync(RedeemRewardRequest request, long actorUserId, CancellationToken cancellationToken);
}

public interface INotificationService
{
    Task<PagedResult<NotificationItem>> MineAsync(long actorUserId, int page, int pageSize, CancellationToken cancellationToken);
    Task MarkReadAsync(long notificationId, long actorUserId, CancellationToken cancellationToken);
}

public interface IAutomationService
{
    Task<JobResult> EnqueueAsync(EnqueueJobRequest request, CancellationToken cancellationToken);
    Task<JobResult?> GetAsync(Guid publicId, CancellationToken cancellationToken);
}

public interface IPublicCatalogService
{
    Task<IReadOnlyList<PublicPlanItem>> PlansAsync(Guid organizationPublicId, CancellationToken cancellationToken);
}
