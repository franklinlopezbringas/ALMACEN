using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class MemberService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : IMemberService
{
    public async Task<PagedResult<MemberListItem>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var term = search?.Trim();

        var query =
            from m in db.Members.AsNoTracking()
            join p in db.People.AsNoTracking() on m.PersonId equals p.PersonId
            where string.IsNullOrEmpty(term)
                  || p.FirstName.Contains(term)
                  || p.LastName.Contains(term)
                  || (p.DocumentNumber != null && p.DocumentNumber.Contains(term))
                  || m.MemberCode.Contains(term)
            select new { m, p };

        var total = await query.LongCountAsync(cancellationToken);
        var today = DateOnly.FromDateTime(clock.UtcNow);
        var rows = await query
            .OrderBy(x => x.p.LastName).ThenBy(x => x.p.FirstName).ThenBy(x => x.m.MemberId)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new MemberListItem(
                x.m.PublicId,
                x.m.MemberCode,
                x.p.FirstName + " " + x.p.LastName,
                x.p.DocumentNumber,
                x.p.Phone,
                x.m.Status,
                db.Memberships.Where(ms => ms.MemberId == x.m.MemberId && ms.StartDate <= today && ms.EndDate >= today)
                    .OrderByDescending(ms => ms.EndDate).Select(ms => ms.Status).FirstOrDefault(),
                db.Memberships.Where(ms => ms.MemberId == x.m.MemberId && ms.StartDate <= today && ms.EndDate >= today)
                    .OrderByDescending(ms => ms.EndDate).Select(ms => (DateOnly?)ms.EndDate).FirstOrDefault(), x.m.MemberId))
            .ToListAsync(cancellationToken);

        return new PagedResult<MemberListItem>(rows, page, pageSize, total);
    }

    public async Task<MemberDetail?> GetAsync(Guid publicId, CancellationToken cancellationToken)
    {
        return await (
            from m in db.Members.AsNoTracking()
            join p in db.People.AsNoTracking() on m.PersonId equals p.PersonId
            where m.PublicId == publicId
            select new MemberDetail(m.PublicId,m.MemberCode,p.FirstName,p.LastName,p.DocumentType,p.DocumentNumber,p.Phone,p.Email,m.Status,m.HomeBranchId,m.MemberId,p.RowVersion))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<MemberDetail> CreateAsync(CreateMemberRequest request, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
            throw new ArgumentException("First name and last name are required.");

        if (!string.IsNullOrWhiteSpace(request.DocumentNumber))
        {
            var exists = await db.People.AsNoTracking().AnyAsync(x => x.DocumentType == request.DocumentType && x.DocumentNumber == request.DocumentNumber, cancellationToken);
            if (exists) throw new InvalidOperationException("A person with this document already exists in the organization.");
        }

        if (request.HomeBranchId is not null && !await db.Branches.AsNoTracking().AnyAsync(x => x.BranchId == request.HomeBranchId && x.Status == "ACTIVE", cancellationToken))
            throw new InvalidOperationException("Home branch is invalid.");

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
            Email = request.Email?.Trim(),
        };
        db.People.Add(person);
        await db.SaveChangesAsync(cancellationToken);

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
        await tx.CommitAsync(cancellationToken);

        return new MemberDetail(member.PublicId,member.MemberCode,person.FirstName,person.LastName,person.DocumentType,person.DocumentNumber,person.Phone,person.Email,member.Status,member.HomeBranchId,member.MemberId,person.RowVersion);
    }
}
