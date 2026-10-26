using System.Data;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class CrmService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : ICrmService
{
    public async Task<PagedResult<ProspectListItem>> SearchAsync(string? search, string? status, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var term = search?.Trim();
        var normalizedStatus = status?.Trim().ToUpperInvariant();

        var query =
            from prospect in db.Prospects.AsNoTracking()
            join person in db.People.AsNoTracking() on prospect.PersonId equals person.PersonId
            join lead in db.LeadSources.AsNoTracking() on prospect.LeadSourceId equals lead.LeadSourceId into leadGroup
            from lead in leadGroup.DefaultIfEmpty()
            where (string.IsNullOrEmpty(term)
                   || person.FirstName.Contains(term)
                   || person.LastName.Contains(term)
                   || (person.Phone != null && person.Phone.Contains(term))
                   || (person.Email != null && person.Email.Contains(term)))
                  && (string.IsNullOrEmpty(normalizedStatus) || prospect.Status == normalizedStatus)
            select new { prospect, person, lead };

        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderByDescending(x => x.prospect.FirstContactAtUtc).ThenByDescending(x => x.prospect.ProspectId)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new ProspectListItem(
                x.prospect.ProspectId,
                x.person.FirstName + " " + x.person.LastName,
                x.person.Phone,
                x.person.Email,
                x.prospect.Status,
                x.lead != null ? x.lead.Name : null,
                x.prospect.NextFollowUpAtUtc,
                db.Plans.Where(p => p.PlanId == x.prospect.InterestedPlanId).Select(p => p.Name).FirstOrDefault(),
                db.ProspectActivities.Where(a => a.ProspectId == x.prospect.ProspectId)
                    .Max(a => (DateTime?)a.OccurredAtUtc) ?? x.prospect.FirstContactAtUtc))
            .ToListAsync(cancellationToken);

        return new PagedResult<ProspectListItem>(items, page, pageSize, total);
    }

    public async Task<long> CreateAsync(CreateProspectRequest request, long actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
            throw new ArgumentException("First name and last name are required.");
        if (request.LeadSourceId is not null && !await db.LeadSources.AsNoTracking().AnyAsync(x => x.LeadSourceId == request.LeadSourceId && x.Status == "ACTIVE", cancellationToken))
            throw new InvalidOperationException("Lead source is invalid.");
        if (request.InterestedPlanId is not null && !await db.Plans.AsNoTracking().AnyAsync(x => x.PlanId == request.InterestedPlanId && x.Status == "ACTIVE", cancellationToken))
            throw new InvalidOperationException("Interested plan is invalid.");

        if (!string.IsNullOrWhiteSpace(request.DocumentNumber))
        {
            var duplicate = await db.People.AsNoTracking().AnyAsync(x => x.DocumentType == request.DocumentType && x.DocumentNumber == request.DocumentNumber, cancellationToken);
            if (duplicate) throw new InvalidOperationException("A person with this document already exists in the organization.");
        }

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var person = new Person
        {
            OrganizationId = tenant.OrganizationId,
            PublicId = Guid.NewGuid(),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            DocumentType = request.DocumentType?.Trim(),
            DocumentNumber = request.DocumentNumber?.Trim(),
            Phone = request.Phone?.Trim(),
            Email = request.Email?.Trim()
        };
        db.People.Add(person);
        await db.SaveChangesAsync(cancellationToken);

        var prospect = new Prospect
        {
            OrganizationId = tenant.OrganizationId,
            PersonId = person.PersonId,
            LeadSourceId = request.LeadSourceId,
            InterestedPlanId = request.InterestedPlanId,
            Status = "NEW",
            FirstContactAtUtc = clock.UtcNow,
            Notes = request.Notes?.Trim(),
            CreatedByUserId = actorUserId
        };
        db.Prospects.Add(prospect);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return prospect.ProspectId;
    }

    public async Task<MemberDetail> ConvertAsync(long prospectId, ConvertProspectRequest request, long actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        await db.AcquireAsync(tenant.OrganizationId, $"prospect:{prospectId}", cancellationToken);
        var prospect = await db.Prospects.SingleOrDefaultAsync(x => x.ProspectId == prospectId, cancellationToken)
            ?? throw new InvalidOperationException("Prospect not found.");
        var person = await db.People.SingleAsync(x => x.PersonId == prospect.PersonId, cancellationToken);

        if (prospect.ConvertedMemberId is not null)
        {
            var existing = await db.Members.SingleAsync(x => x.MemberId == prospect.ConvertedMemberId, cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return new MemberDetail(existing.PublicId, existing.MemberCode, person.FirstName, person.LastName, person.DocumentType, person.DocumentNumber, person.Phone, person.Email, existing.Status, existing.HomeBranchId);
        }

        if (request.HomeBranchId is not null && !await db.Branches.AsNoTracking().AnyAsync(x => x.BranchId == request.HomeBranchId && x.Status == "ACTIVE", cancellationToken))
            throw new InvalidOperationException("Home branch is invalid.");

        var member = new Member
        {
            OrganizationId = tenant.OrganizationId,
            PublicId = Guid.NewGuid(),
            PersonId = person.PersonId,
            HomeBranchId = request.HomeBranchId,
            MemberCode = "SOC-" + Guid.NewGuid().ToString("N")[..10].ToUpperInvariant(),
            RegistrationDate = DateOnly.FromDateTime(clock.UtcNow),
            Status = "ACTIVE"
        };
        db.Members.Add(member);
        await db.SaveChangesAsync(cancellationToken);

        prospect.Status = "WON";
        prospect.ConvertedAtUtc = clock.UtcNow;
        prospect.ConvertedMemberId = member.MemberId;
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return new MemberDetail(member.PublicId, member.MemberCode, person.FirstName, person.LastName, person.DocumentType, person.DocumentNumber, person.Phone, person.Email, member.Status, member.HomeBranchId);
    }
}
