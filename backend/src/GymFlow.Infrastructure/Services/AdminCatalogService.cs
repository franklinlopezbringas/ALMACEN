using System.Data;
using System.Text.Json;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class AdminCatalogService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock)
{
    public async Task<PagedResult<BranchItem>> BranchesAsync(int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var q = db.Branches.AsNoTracking().Where(x => x.Status == "ACTIVE");
        var total = await q.LongCountAsync(ct);
        return new(await q.OrderBy(x => x.Name).ThenBy(x => x.BranchId).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new BranchItem(x.BranchId, x.Code, x.Name)).ToListAsync(ct), page, pageSize, total);
    }

    public async Task<PagedResult<AdminProductItem>> ProductsAsync(string? search, string? status, long? branchId, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        if (branchId is not null && !await db.Branches.AsNoTracking().AnyAsync(x => x.BranchId == branchId, ct))
            throw new KeyNotFoundException();
        var q = db.Products.AsNoTracking().Where(x => (string.IsNullOrEmpty(search) || x.Name.Contains(search) || x.Sku.Contains(search))
            && (string.IsNullOrEmpty(status) || x.Status == status));
        var total = await q.LongCountAsync(ct);
        var items = await q.OrderBy(x => x.Name).ThenBy(x => x.ProductId).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new AdminProductItem(x.PublicId, x.Sku, x.Name, x.SalePrice, x.CurrencyCode,
                branchId == null ? null : db.InventoryBalances.Where(b => b.BranchId == branchId && b.ProductId == x.ProductId)
                    .Select(b => (decimal?)b.QuantityOnHand).FirstOrDefault() ?? 0,
                x.MinimumStock, x.IsPublic, x.Status, x.RowVersion)).ToListAsync(ct);
        return new(items, page, pageSize, total);
    }

    public async Task<Guid> SaveProductAsync(Guid? id, SaveProductRequest request, long actor, CancellationToken ct)
    {
        ValidateText(request.Sku, 80); ValidateText(request.Name, 150); ValidateStatus(request.Status);
        ValidateMoney(request.Price, request.CurrencyCode);
        if (request.MinimumStock < 0 || decimal.Round(request.MinimumStock, 3) != request.MinimumStock)
            throw new ArgumentException("Minimum stock must be nonnegative with at most 3 decimal places.");
        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(ct) : null;
        var product = id is null ? new Product { OrganizationId = tenant.OrganizationId, PublicId = Guid.NewGuid() }
            : await db.Products.SingleOrDefaultAsync(x => x.PublicId == id, ct) ?? throw new KeyNotFoundException();
        var before = id is null ? null : JsonSerializer.Serialize(product);
        if (id is not null) CheckVersion(product.RowVersion, request.RowVersion);
        product.Sku = request.Sku.Trim(); product.Name = request.Name.Trim(); product.SalePrice = request.Price;
        product.CurrencyCode = request.CurrencyCode; product.MinimumStock = request.MinimumStock;
        product.Status = request.Status; product.IsPublic = request.IsPublic;
        if (id is null) db.Products.Add(product);
        else db.Entry(product).Property(x => x.Name).IsModified = true; // no-op saves still validate rowversion
        await db.SaveChangesAsync(ct);
        await AuditAsync(actor, id is null ? "PRODUCT.CREATE" : "PRODUCT.UPDATE", "Product", product.PublicId, before, JsonSerializer.Serialize(product), ct);
        if (tx is not null) await tx.CommitAsync(ct);
        return product.PublicId;
    }

    public async Task<PagedResult<AdminPlanItem>> PlansAsync(string? search, string? status, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var today = DateOnly.FromDateTime(clock.UtcNow);
        var q = db.Plans.AsNoTracking().Where(x => (string.IsNullOrEmpty(search) || x.Name.Contains(search) || x.Code.Contains(search))
            && (string.IsNullOrEmpty(status) || x.Status == status));
        var total = await q.LongCountAsync(ct);
        var items = await (from p in q.OrderBy(x => x.Name).ThenBy(x => x.PlanId).Skip((page - 1) * pageSize).Take(pageSize)
            from v in db.PlanVersions.AsNoTracking().Where(v => v.PlanId == p.PlanId && v.Status == "ACTIVE"
                && v.ValidFrom <= today && (v.ValidTo == null || v.ValidTo >= today)).OrderByDescending(v => v.VersionNumber).Take(1).DefaultIfEmpty()
            select new AdminPlanItem(p.PublicId, p.PlanId, p.Code, p.Name, p.Description, p.IsPublic, p.Status, p.RowVersion,
                v == null ? null : v.PlanVersionId, v == null ? null : v.VersionNumber,
                v == null ? null : new PlanTerms(v.Price, v.CurrencyCode, v.DurationValue, v.DurationUnit, v.FreezeDaysLimit, v.ClassReservationLimit)))
            .ToListAsync(ct);
        return new(items, page, pageSize, total);
    }

    public async Task<Guid> CreatePlanAsync(CreatePlanRequest request, long actor, CancellationToken ct)
    {
        ValidatePlan(request.Plan); ValidateTerms(request.Terms);
        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(ct) : null;
        var plan = new Plan { OrganizationId = tenant.OrganizationId, PublicId = Guid.NewGuid() };
        Apply(plan, request.Plan); db.Plans.Add(plan); await db.SaveChangesAsync(ct);
        var version = NewVersion(plan.PlanId, 1, request.Terms); db.PlanVersions.Add(version); await db.SaveChangesAsync(ct);
        await AuditAsync(actor, "PLAN.CREATE", "Plan", plan.PublicId, null, JsonSerializer.Serialize(new { plan, version }), ct);
        if (tx is not null) await tx.CommitAsync(ct);
        return plan.PublicId;
    }

    public async Task UpdatePlanAsync(Guid id, SavePlanRequest request, long actor, CancellationToken ct)
    {
        ValidatePlan(request);
        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(ct) : null;
        var plan = await db.Plans.SingleOrDefaultAsync(x => x.PublicId == id, ct) ?? throw new KeyNotFoundException();
        CheckVersion(plan.RowVersion, request.RowVersion);
        var before = JsonSerializer.Serialize(plan);
        Apply(plan, request); db.Entry(plan).Property(x => x.Name).IsModified = true;
        await db.SaveChangesAsync(ct);
        await AuditAsync(actor, "PLAN.UPDATE", "Plan", id, before, JsonSerializer.Serialize(plan), ct);
        if (tx is not null) await tx.CommitAsync(ct);
    }

    public async Task<long> PublishVersionAsync(Guid id, PublishPlanVersionRequest request, long actor, CancellationToken ct)
    {
        ValidateTerms(request.Terms);
        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : null;
        await db.AcquireAsync(tenant.OrganizationId, $"plan:{id}", ct);
        var plan = await db.Plans.SingleOrDefaultAsync(x => x.PublicId == id, ct) ?? throw new KeyNotFoundException();
        CheckVersion(plan.RowVersion, request.RowVersion);
        var previous = await db.PlanVersions.AsNoTracking().Where(x => x.PlanId == plan.PlanId).OrderByDescending(x => x.VersionNumber).FirstOrDefaultAsync(ct);
        var version = NewVersion(plan.PlanId, (previous?.VersionNumber ?? 0) + 1, request.Terms);
        db.PlanVersions.Add(version); db.Entry(plan).Property(x => x.Name).IsModified = true;
        await db.SaveChangesAsync(ct);
        // Keep existing benefit conditions on the new commercial version; no historical row is overwritten.
        if (previous is not null)
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT membership.PlanVersionBenefits(OrganizationId,PlanVersionId,PlanBenefitId,ValueText) SELECT OrganizationId,{version.PlanVersionId},PlanBenefitId,ValueText FROM membership.PlanVersionBenefits WHERE OrganizationId={tenant.OrganizationId} AND PlanVersionId={previous.PlanVersionId}", ct);
        await AuditAsync(actor, "PLAN.VERSION_PUBLISH", "Plan", id, JsonSerializer.Serialize(previous), JsonSerializer.Serialize(version), ct);
        if (tx is not null) await tx.CommitAsync(ct);
        return version.PlanVersionId;
    }

    private PlanVersion NewVersion(long planId, int number, PlanTerms terms) => new()
    {
        OrganizationId = tenant.OrganizationId, PlanId = planId, VersionNumber = number, Price = terms.Price,
        CurrencyCode = terms.CurrencyCode, DurationValue = terms.DurationValue, DurationUnit = terms.DurationUnit,
        FreezeDaysLimit = terms.FreezeDaysLimit, ClassReservationLimit = terms.ClassReservationLimit,
        ValidFrom = DateOnly.FromDateTime(clock.UtcNow), Status = "ACTIVE"
    };
    private static void Apply(Plan plan, SavePlanRequest request)
    {
        plan.Code = request.Code.Trim(); plan.Name = request.Name.Trim(); plan.Description = request.Description?.Trim();
        plan.IsPublic = request.IsPublic; plan.Status = request.Status;
    }
    private static void ValidatePlan(SavePlanRequest request)
    {
        ValidateText(request.Code, 40); ValidateText(request.Name, 120); ValidateStatus(request.Status);
        if (request.Description?.Length > 600) throw new ArgumentException("Description is too long.");
    }
    private static void ValidateText(string value, int max)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > max) throw new ArgumentException("Required text is missing or too long.");
    }
    private static void ValidateStatus(string status)
    {
        if (status is not ("ACTIVE" or "INACTIVE" or "ARCHIVED")) throw new ArgumentException("Unsupported status.");
    }
    private static void ValidateMoney(decimal amount, string currency)
    {
        if (amount < 0 || amount > 999999999999999m || decimal.Round(amount, 4) != amount
            || currency is null || currency.Length != 3 || currency.Any(c => c is < 'A' or > 'Z'))
            throw new ArgumentException("Invalid price or currency.");
    }
    private static void ValidateTerms(PlanTerms terms)
    {
        ValidateMoney(terms.Price, terms.CurrencyCode);
        if (terms.DurationValue <= 0 || terms.DurationUnit is not ("DAY" or "WEEK" or "MONTH" or "YEAR")
            || terms.FreezeDaysLimit < 0 || terms.ClassReservationLimit < 0) throw new ArgumentException("Invalid plan conditions.");
    }
    private static void CheckVersion(byte[] current, byte[]? expected)
    {
        if (expected is null || expected.Length != 8) throw new ArgumentException("RowVersion is required.");
        if (!current.SequenceEqual(expected)) throw new DbUpdateConcurrencyException();
    }
    private Task<int> AuditAsync(long actor, string action, string entity, Guid id, string? before, string after, CancellationToken ct)
        => db.Database.ExecuteSqlInterpolatedAsync($"INSERT audit.AuditLogs(OrganizationId,UserId,Action,EntityType,EntityId,BeforeJson,AfterJson) VALUES({tenant.OrganizationId},{actor},{action},{entity},{id.ToString()},{before},{after})", ct);
}
