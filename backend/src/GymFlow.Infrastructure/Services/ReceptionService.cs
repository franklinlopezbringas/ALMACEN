using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class ReceptionService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock)
{
    private static async Task<PagedResult<T>> PageAsync<T>(IQueryable<T> q, int page, int size, CancellationToken ct)
    {
        page = Math.Max(1, page); size = Math.Clamp(size, 1, 100);
        return new(await q.Skip((page - 1) * size).Take(size).ToListAsync(ct), page, size, await q.LongCountAsync(ct));
    }
    public async Task<ReceptionContext> ContextAsync(long actor, CancellationToken ct)
    {
        var employee = await (from u in db.UserOrganizations.AsNoTracking()
            join e in db.Employees.AsNoTracking() on u.PersonId equals e.PersonId
            join p in db.People.AsNoTracking() on e.PersonId equals p.PersonId
            where u.UserId == actor && u.Status == "ACTIVE" && e.Status == "ACTIVE"
            select new { e.EmployeeId, Name = p.FirstName + " " + p.LastName }).SingleOrDefaultAsync(ct);
        var currency = await db.Organizations.AsNoTracking().Where(o => o.OrganizationId == tenant.OrganizationId).Select(o => o.DefaultCurrencyCode).SingleAsync(ct);
        return new(employee?.EmployeeId, employee?.Name, currency);
    }
    public Task<PagedResult<RegisterItem>> RegistersAsync(int page, int size, CancellationToken ct)
        => PageAsync(from r in db.CashRegisters.AsNoTracking() join b in db.Branches.AsNoTracking() on r.BranchId equals b.BranchId
            where r.Status == "ACTIVE" && b.Status == "ACTIVE" orderby r.Name, r.CashRegisterId
            select new RegisterItem(r.CashRegisterId, r.BranchId, r.Name, b.Name, db.CashShifts.Any(s => s.CashRegisterId == r.CashRegisterId && s.Status == "OPEN")), page, size, ct);
    public Task<PagedResult<MethodItem>> MethodsAsync(int page, int size, CancellationToken ct)
        => PageAsync(db.PaymentMethods.AsNoTracking().Where(m => m.Status == "ACTIVE").OrderBy(m => m.Name).ThenBy(m => m.PaymentMethodId)
            .Select(m => new MethodItem(m.PaymentMethodId, m.Code, m.Name, m.IsCash)), page, size, ct);
    public async Task<PagedResult<DebtItem>> DebtsAsync(long memberId, int page, int size, CancellationToken ct)
    {
        await RequireMemberAsync(memberId, ct);
        return await PageAsync(db.ReceivableBalances.AsNoTracking().Where(r => r.MemberId == memberId && r.Status != "CANCELLED" && r.Status != "WRITTEN_OFF" && r.BalanceAmount > 0)
            .OrderBy(r => r.DueDate).ThenBy(r => r.ReceivableId).Select(r => new DebtItem(r.ReceivableId, r.MemberId, r.Description, r.TotalAmount, r.BalanceAmount, r.CurrencyCode, r.DueDate, r.Status)), page, size, ct);
    }
    public Task<PagedResult<ShiftItem>> ShiftsAsync(long actor, int page, int size, CancellationToken ct, string? status = null)
        => PageAsync(from s in db.CashShifts.AsNoTracking() join r in db.CashRegisters.AsNoTracking() on s.CashRegisterId equals r.CashRegisterId
            where s.OpenedByUserId == actor && (status == null || s.Status == status) orderby s.OpenedAtUtc descending, s.CashShiftId descending
            select new ShiftItem(s.CashShiftId, r.BranchId, r.Name, s.Status, s.OpenedAtUtc, s.ClosedAtUtc, s.OpeningAmount,
                s.ExpectedAmountAtClose ?? s.OpeningAmount + (db.CashMovements.Where(m => m.CashShiftId == s.CashShiftId)
                    .Sum(m => (decimal?)(m.MovementType == "INCOME" || m.MovementType == "ADJUSTMENT_IN" ? m.Amount : -m.Amount)) ?? 0),
                s.CountedAmountAtClose, s.DifferenceAmount, s.OpeningNotes, s.ClosingNotes), page, size, ct);
    public async Task RequireOwnShiftAsync(long actor, long id, CancellationToken ct)
    {
        if (!await db.CashShifts.AsNoTracking().AnyAsync(s => s.CashShiftId == id && s.OpenedByUserId == actor, ct)) throw new KeyNotFoundException();
    }
    public async Task<PagedResult<MovementItem>> MovementsAsync(long actor, long id, int page, int size, CancellationToken ct)
    {
        await RequireOwnShiftAsync(actor, id, ct);
        return await PageAsync(db.CashMovements.AsNoTracking().Where(m => m.CashShiftId == id).OrderByDescending(m => m.CreatedAtUtc).ThenByDescending(m => m.CashMovementId)
            .Select(m => new MovementItem(m.CashMovementId, m.MovementType, m.Amount, m.Description, m.CreatedAtUtc)), page, size, ct);
    }
    public async Task<PagedResult<AccessItem>> AccessAsync(long? memberId, long? branchId, DateTime? fromUtc, DateTime? toUtc, int page, int size, CancellationToken ct)
    {
        if (memberId is not null) await RequireMemberAsync(memberId.Value, ct);
        if (branchId is not null && !await db.Branches.AsNoTracking().AnyAsync(b => b.BranchId == branchId, ct)) throw new KeyNotFoundException();
        var startAt = fromUtc ?? clock.UtcNow.Date; var endAt = toUtc ?? clock.UtcNow;
        if (endAt < startAt || endAt - startAt > TimeSpan.FromDays(31)) throw new ArgumentException("Select a date range of at most 31 days.");
        return await PageAsync(from a in db.AttendanceEvents.AsNoTracking()
            join m in db.Members.AsNoTracking() on a.MemberId equals m.MemberId join p in db.People.AsNoTracking() on m.PersonId equals p.PersonId
            where (memberId == null || a.MemberId == memberId) && (branchId == null || a.BranchId == branchId) && a.OccurredAtUtc >= startAt && a.OccurredAtUtc <= endAt
            orderby a.OccurredAtUtc descending, a.AttendanceEventId descending
            select new AccessItem(a.AttendanceEventId, m.MemberId, m.MemberCode, p.FirstName + " " + p.LastName, a.Result, a.ReasonCode, a.AccessMethod, a.OccurredAtUtc, a.BranchId), page, size, ct);
    }
    public async Task<PagedResult<PaymentResult>> PaymentsAsync(long memberId, int page, int size, CancellationToken ct)
    {
        await RequireMemberAsync(memberId, ct);
        return await PageAsync(db.Payments.AsNoTracking().Where(p => p.MemberId == memberId).OrderByDescending(p => p.ReceivedAtUtc).ThenByDescending(p => p.PaymentId)
            .Select(p => new PaymentResult(p.PublicId, p.PaymentId, p.ReceiptNumber, p.TotalAmount, p.CurrencyCode, p.Status, p.ReceivedAtUtc)), page, size, ct);
    }
    public async Task<ReceiptDetail> ReceiptAsync(Guid id, CancellationToken ct)
    {
        var p = await db.Payments.AsNoTracking().SingleOrDefaultAsync(p => p.PublicId == id, ct) ?? throw new KeyNotFoundException();
        var name = await (from m in db.Members.AsNoTracking() join person in db.People.AsNoTracking() on m.PersonId equals person.PersonId
            where m.MemberId == p.MemberId select person.FirstName + " " + person.LastName).SingleOrDefaultAsync(ct);
        var splits = await (from s in db.PaymentSplits.AsNoTracking() join method in db.PaymentMethods.AsNoTracking() on s.PaymentMethodId equals method.PaymentMethodId
            where s.PaymentId == p.PaymentId orderby s.PaymentSplitId select new ReceiptSplit(method.Name, method.IsCash, s.Amount, s.ExternalReference)).ToListAsync(ct);
        var lines = p.OrderId is null ? [] : await db.Database.SqlQuery<ReceiptLine>($"SELECT Description,Quantity,UnitPrice,TotalAmount FROM finance.OrderItems WHERE OrganizationId={tenant.OrganizationId} AND OrderId={p.OrderId} ORDER BY OrderItemId").ToListAsync(ct);
        return new(new(p.PublicId, p.PaymentId, p.ReceiptNumber, p.TotalAmount, p.CurrencyCode, p.Status, p.ReceivedAtUtc), name, splits, lines);
    }
    public async Task UpdateMemberAsync(Guid id, UpdateMemberRequest request, long actor, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName) || request.RowVersion is null || request.RowVersion.Length != 8) throw new ArgumentException("Name and rowversion are required.");
        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(ct) : null;
        var member = await db.Members.AsNoTracking().SingleOrDefaultAsync(m => m.PublicId == id, ct) ?? throw new KeyNotFoundException();
        var person = await db.People.SingleAsync(p => p.PersonId == member.PersonId, ct);
        if (!person.RowVersion.SequenceEqual(request.RowVersion)) throw new DbUpdateConcurrencyException();
        var before = new { person.FirstName, person.LastName, person.Phone, person.Email };
        person.FirstName = request.FirstName.Trim(); person.LastName = request.LastName.Trim(); person.Phone = request.Phone?.Trim(); person.Email = request.Email?.Trim();
        db.Entry(person).Property(p => p.FirstName).IsModified = true;
        await db.SaveChangesAsync(ct);
        await ReceptionAudit.WriteAsync(db, tenant.OrganizationId, actor, "MEMBER.UPDATE", "Member", id.ToString(), before, new { person.FirstName, person.LastName, person.Phone, person.Email }, ct);
        if (tx is not null) await tx.CommitAsync(ct);
    }
    private async Task RequireMemberAsync(long id, CancellationToken ct)
    {
        if (!await db.Members.AsNoTracking().AnyAsync(m => m.MemberId == id, ct)) throw new KeyNotFoundException();
    }
    public async Task<long> ResolveQrAsync(string credential, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(credential) || credential.Length > 200) throw new ArgumentException("Invalid QR credential.");
        var now = clock.UtcNow;
        var ids = await db.Database.SqlQuery<long>($"SELECT MemberId AS Value FROM access.AccessCredentials WHERE OrganizationId={tenant.OrganizationId} AND CredentialType='QR' AND ExternalCredentialId={credential} AND Status='ACTIVE' AND (ExpiresAtUtc IS NULL OR ExpiresAtUtc>{now})").ToListAsync(ct);
        return ids.Count == 1 ? ids[0] : throw new KeyNotFoundException();
    }
}
