using System.Text.Json;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class AutomationService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : IAutomationService
{
    public async Task<JobResult> EnqueueAsync(EnqueueJobRequest request, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        if (string.IsNullOrWhiteSpace(request.JobType)) throw new ArgumentException("Job type is required.");
        if (request.Priority is < 1 or > 10) throw new ArgumentOutOfRangeException(nameof(request));
        try { using var json = JsonDocument.Parse(request.PayloadJson); }
        catch (JsonException ex) { throw new ArgumentException("PayloadJson must contain valid JSON.", nameof(request), ex); }

        var now = clock.UtcNow;
        var job = new AutomationJob
        {
            OrganizationId = tenant.OrganizationId,
            PublicId = Guid.NewGuid(),
            JobType = request.JobType.Trim().ToUpperInvariant(),
            PayloadJson = request.PayloadJson,
            Priority = request.Priority,
            Status = "PENDING",
            AvailableAtUtc = request.AvailableAtUtc is null || request.AvailableAtUtc < now ? now : request.AvailableAtUtc.Value,
            Attempts = 0,
            MaxAttempts = 3,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        db.AutomationJobs.Add(job);
        await db.SaveChangesAsync(cancellationToken);
        return ToResult(job);
    }

    public async Task<JobResult?> GetAsync(Guid publicId, CancellationToken cancellationToken)
    {
        return await db.AutomationJobs.AsNoTracking().Where(x => x.PublicId == publicId)
            .Select(x => new JobResult(x.PublicId, x.JobId, x.JobType, x.Status, x.Priority, x.AvailableAtUtc, x.Attempts, x.MaxAttempts))
            .SingleOrDefaultAsync(cancellationToken);
    }

    private static JobResult ToResult(AutomationJob job) => new(job.PublicId, job.JobId, job.JobType, job.Status, job.Priority, job.AvailableAtUtc, job.Attempts, job.MaxAttempts);
}
