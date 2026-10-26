using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class TrainerService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : ITrainerService
{
    public async Task<PagedResult<AssignedMemberItem>> AssignedMembersAsync(long actorUserId, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var trainerId = await ResolveTrainerIdAsync(actorUserId, cancellationToken);
        var today = DateOnly.FromDateTime(clock.UtcNow);

        var query =
            from assignment in db.TrainerMemberAssignments.AsNoTracking()
            join member in db.Members.AsNoTracking() on assignment.MemberId equals member.MemberId
            join person in db.People.AsNoTracking() on member.PersonId equals person.PersonId
            where assignment.TrainerProfileId == trainerId && assignment.Status == "ACTIVE"
                  && assignment.AssignedFrom <= today && (assignment.AssignedTo == null || assignment.AssignedTo >= today)
            select new { assignment, member, person };

        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(x => x.person.LastName).ThenBy(x => x.person.FirstName).ThenBy(x => x.assignment.TrainerMemberAssignmentId)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new AssignedMemberItem(
                x.member.MemberId,
                x.member.PublicId,
                x.member.MemberCode,
                x.person.FirstName + " " + x.person.LastName,
                db.Memberships.Where(m => m.MemberId == x.member.MemberId && m.StartDate <= today && m.EndDate >= today)
                    .OrderByDescending(m => m.EndDate).Select(m => m.Status).FirstOrDefault(),
                db.Memberships.Where(m => m.MemberId == x.member.MemberId && m.StartDate <= today && m.EndDate >= today)
                    .OrderByDescending(m => m.EndDate).Select(m => (DateOnly?)m.EndDate).FirstOrDefault()))
            .ToListAsync(cancellationToken);

        return new PagedResult<AssignedMemberItem>(items, page, pageSize, total);
    }

    public async Task<long> AddProgressReviewAsync(long actorUserId, AddProgressReviewRequest request, CancellationToken cancellationToken)
    {
        if (request.ProgressPercentage is < 0 or > 100) throw new ArgumentOutOfRangeException(nameof(request));
        var allowedRatings = new[] { "NEEDS_ATTENTION", "SLOW_PROGRESS", "EXPECTED_PROGRESS", "GOOD_PROGRESS", "GOAL_REACHED" };
        var rating = request.Rating.Trim().ToUpperInvariant();
        if (!allowedRatings.Contains(rating)) throw new InvalidOperationException("Progress rating is invalid.");

        var trainerId = await ResolveTrainerIdAsync(actorUserId, cancellationToken);
        var today = DateOnly.FromDateTime(clock.UtcNow);
        var assigned = await db.TrainerMemberAssignments.AsNoTracking().AnyAsync(x =>
            x.TrainerProfileId == trainerId && x.MemberId == request.MemberId && x.Status == "ACTIVE"
            && x.AssignedFrom <= today && (x.AssignedTo == null || x.AssignedTo >= today), cancellationToken);
        if (!assigned) throw new UnauthorizedAccessException("The member is not assigned to the current trainer.");

        var review = new ProgressReview
        {
            OrganizationId = tenant.OrganizationId,
            MemberId = request.MemberId,
            TrainerProfileId = trainerId,
            Rating = rating,
            ProgressPercentage = request.ProgressPercentage,
            VisibleComment = request.VisibleComment?.Trim(),
            PrivateNote = request.PrivateNote?.Trim(),
            Achievements = request.Achievements?.Trim(),
            NextGoal = request.NextGoal?.Trim(),
            ReviewedAtUtc = clock.UtcNow
        };
        db.ProgressReviews.Add(review);
        await db.SaveChangesAsync(cancellationToken);
        return review.ProgressReviewId;
    }

    private async Task<long> ResolveTrainerIdAsync(long actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        var userOrganization = await db.UserOrganizations.AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == actorUserId && x.Status == "ACTIVE", cancellationToken)
            ?? throw new UnauthorizedAccessException("User does not belong to this organization.");
        if (userOrganization.PersonId is null) throw new UnauthorizedAccessException("User is not linked to a person.");

        var employeeId = await db.Employees.AsNoTracking()
            .Where(x => x.PersonId == userOrganization.PersonId && x.Status == "ACTIVE")
            .Select(x => (long?)x.EmployeeId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new UnauthorizedAccessException("User is not an active employee.");

        return await db.TrainerProfiles.AsNoTracking()
            .Where(x => x.EmployeeId == employeeId && x.Status == "ACTIVE")
            .Select(x => (long?)x.TrainerProfileId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new UnauthorizedAccessException("User is not an active trainer.");
    }
}
