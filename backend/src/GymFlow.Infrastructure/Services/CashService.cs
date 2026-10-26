using System.Data;
using GymFlow.Application.Abstractions;
using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Domain.Entities;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class CashService(GymFlowDbContext db, ICurrentTenant tenant, IClock clock) : ICashService
{
    public async Task<CashShiftResult> OpenAsync(OpenCashShiftRequest request, long actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        if (request.OpeningAmount < 0) throw new ArgumentOutOfRangeException(nameof(request));

        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken) : null;
        await db.AcquireAsync(tenant.OrganizationId, $"register:{request.CashRegisterId}", cancellationToken);
        var register = await db.CashRegisters.AsNoTracking()
            .SingleOrDefaultAsync(x => x.CashRegisterId == request.CashRegisterId && x.Status == "ACTIVE", cancellationToken)
            ?? throw new InvalidOperationException("Cash register is invalid or inactive.");

        var employeeExists = await db.Employees.AsNoTracking()
            .AnyAsync(x => x.EmployeeId == request.EmployeeId && x.Status == "ACTIVE", cancellationToken);
        if (!employeeExists) throw new InvalidOperationException("Employee is invalid or inactive.");

        // Preserve SERIALIZABLE. Reserve the target range for update before inserting.
        // The filtered unique index both enforces one OPEN shift and avoids scanning the date index.
        var alreadyOpen = await db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM finance.CashShifts WITH (UPDLOCK, INDEX(UX_CashShifts_OneOpenPerRegister)) WHERE OrganizationId={tenant.OrganizationId} AND CashRegisterId={register.CashRegisterId} AND Status='OPEN'").SingleAsync(cancellationToken);
        if (alreadyOpen != 0)
            throw new InvalidOperationException("This cash register already has an open shift.");

        var shift = new CashShift
        {
            OrganizationId = tenant.OrganizationId,
            CashRegisterId = register.CashRegisterId,
            EmployeeId = request.EmployeeId,
            OpenedAtUtc = clock.UtcNow,
            OpenedByUserId = actorUserId,
            OpeningAmount = request.OpeningAmount,
            OpeningNotes = request.OpeningNotes?.Trim(),
            Status = "OPEN"
        };
        db.CashShifts.Add(shift);
        await db.SaveChangesAsync(cancellationToken);
        await ReceptionAudit.WriteAsync(db, tenant.OrganizationId, actorUserId, shift.Status == "OPEN" ? "CASH.OPEN" : "CASH.CLOSE", "CashShift", shift.CashShiftId.ToString(System.Globalization.CultureInfo.InvariantCulture), null, ToResult(shift), cancellationToken);
        if (tx is not null) await tx.CommitAsync(cancellationToken);
        return ToResult(shift);
    }

    public async Task<CashShiftResult> CloseAsync(long cashShiftId, CloseCashShiftRequest request, long actorUserId, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("Tenant is required.");
        if (request.CountedAmount < 0) throw new ArgumentOutOfRangeException(nameof(request));

        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken) : null;
        await db.AcquireAsync(tenant.OrganizationId, $"cash:{cashShiftId}", cancellationToken);
        var shift = await db.CashShifts.SingleOrDefaultAsync(x => x.CashShiftId == cashShiftId && x.Status == "OPEN", cancellationToken)
            ?? throw new InvalidOperationException("Cash shift is not open.");

        // Seek the current drawer's ledger range; SERIALIZABLE must not scan unrelated tenants.
        var movementTotal = await db.Database.SqlQuery<decimal>($"SELECT COALESCE(SUM(CASE WHEN MovementType IN ('INCOME','ADJUSTMENT_IN') THEN Amount WHEN MovementType IN ('EXPENSE','ADJUSTMENT_OUT','REFUND') THEN -Amount ELSE 0 END),0) AS Value FROM finance.CashMovements WITH (INDEX(IX_CashMovements_Shift_Date)) WHERE OrganizationId={tenant.OrganizationId} AND CashShiftId={cashShiftId}").SingleAsync(cancellationToken);

        var expected = shift.OpeningAmount + movementTotal;

        var difference = request.CountedAmount - expected;
        shift.ExpectedAmountAtClose = expected;
        shift.CountedAmountAtClose = request.CountedAmount;
        shift.DifferenceAmount = difference;
        shift.ClosingNotes = request.ClosingNotes?.Trim();
        shift.ClosedAtUtc = clock.UtcNow;
        shift.ClosedByUserId = actorUserId;
        shift.Status = Math.Abs(difference) <= 0.01m ? "CLOSED" : "REVIEW_REQUIRED";

        await db.SaveChangesAsync(cancellationToken);
        await ReceptionAudit.WriteAsync(db, tenant.OrganizationId, actorUserId, shift.Status == "OPEN" ? "CASH.OPEN" : "CASH.CLOSE", "CashShift", shift.CashShiftId.ToString(System.Globalization.CultureInfo.InvariantCulture), null, ToResult(shift), cancellationToken);
        if (tx is not null) await tx.CommitAsync(cancellationToken);
        return ToResult(shift);
    }

    private static CashShiftResult ToResult(CashShift shift) => new(
        shift.CashShiftId,
        shift.Status,
        shift.OpeningAmount,
        shift.ExpectedAmountAtClose,
        shift.CountedAmountAtClose,
        shift.DifferenceAmount);
}
