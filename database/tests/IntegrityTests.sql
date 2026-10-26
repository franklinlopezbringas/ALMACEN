/* GymFlow v1.0 - Integrity smoke tests. Run after DemoData.sql. */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

DECLARE @Errors TABLE(TestName NVARCHAR(150), Detail NVARCHAR(500));

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1)
    INSERT INTO @Errors VALUES(N'Foreign keys',N'A foreign key is disabled or untrusted.');
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1)
    INSERT INTO @Errors VALUES(N'CHECK constraints',N'A CHECK constraint is disabled or untrusted.');
IF EXISTS (SELECT 1 FROM training.ClassSessions s CROSS APPLY
    (SELECT COUNT(*) n FROM training.ClassReservations r WHERE r.OrganizationId=s.OrganizationId AND r.ClassSessionId=s.ClassSessionId AND r.Status IN ('CONFIRMED','ATTENDED')) r
    WHERE r.n>s.Capacity)
    INSERT INTO @Errors VALUES(N'Class capacity',N'Confirmed/attended reservations exceed session capacity.');
IF EXISTS (SELECT 1 FROM training.ClassReservations WHERE Status='WAITLISTED'
    GROUP BY OrganizationId,ClassSessionId,WaitlistPosition HAVING COUNT(*)>1)
    INSERT INTO @Errors VALUES(N'Waitlist',N'Duplicate active waitlist positions.');

IF EXISTS (SELECT 1 FROM finance.vw_ReceivableBalances WHERE BalanceAmount<0)
    INSERT INTO @Errors VALUES(N'Receivable balance',N'A receivable has a negative computed balance.');

IF EXISTS (
    SELECT 1 FROM finance.Payments p
    CROSS APPLY (SELECT ISNULL(SUM(Amount),0) SplitTotal FROM finance.PaymentSplits s WHERE s.OrganizationId=p.OrganizationId AND s.PaymentId=p.PaymentId) x
    WHERE p.Status IN ('COMPLETED','PARTIALLY_REFUNDED','REFUNDED') AND x.SplitTotal<>p.TotalAmount)
    INSERT INTO @Errors VALUES(N'Payment splits',N'A completed payment does not reconcile to its payment splits.');

IF EXISTS (
    SELECT 1 FROM finance.PaymentAllocations pa
    JOIN finance.Payments p ON p.OrganizationId=pa.OrganizationId AND p.PaymentId=pa.PaymentId
    GROUP BY pa.OrganizationId,pa.PaymentId,p.TotalAmount
    HAVING SUM(pa.Amount)>p.TotalAmount)
    INSERT INTO @Errors VALUES(N'Payment allocations',N'Payment allocations exceed payment total.');

IF EXISTS (
    SELECT 1 FROM finance.CashMovements cm
    JOIN finance.PaymentSplits ps ON ps.OrganizationId=cm.OrganizationId AND ps.PaymentSplitId=cm.PaymentSplitId
    JOIN finance.PaymentMethods pm ON pm.OrganizationId=ps.OrganizationId AND pm.PaymentMethodId=ps.PaymentMethodId
    WHERE cm.PaymentSplitId IS NOT NULL AND pm.IsCash=0)
    INSERT INTO @Errors VALUES(N'Cash isolation',N'Cash movement references a non-cash payment split.');

IF EXISTS (
    SELECT 1 FROM membership.Memberships m
    WHERE m.EndDate<m.StartDate OR m.ContractedPrice<0)
    INSERT INTO @Errors VALUES(N'Membership validity',N'Invalid membership dates or contracted price.');

IF EXISTS (
    SELECT 1 FROM loyalty.PointAccounts a
    JOIN loyalty.vw_PointLedgerBalances v ON v.OrganizationId=a.OrganizationId AND v.PointAccountId=a.PointAccountId
    WHERE a.CurrentBalance<>v.LedgerBalance)
    INSERT INTO @Errors VALUES(N'Points reconciliation',N'Cached point balance differs from ledger.');

IF EXISTS (
    SELECT 1 FROM commerce.InventoryBalances b
    JOIN commerce.vw_InventoryLedgerBalances v ON v.OrganizationId=b.OrganizationId AND v.BranchId=b.BranchId AND v.ProductId=b.ProductId
    WHERE b.QuantityOnHand<>v.LedgerQuantity)
    INSERT INTO @Errors VALUES(N'Inventory reconciliation',N'Cached inventory balance differs from movement ledger.');

IF EXISTS (SELECT CashRegisterId FROM finance.CashShifts WHERE Status='OPEN' GROUP BY OrganizationId,CashRegisterId HAVING COUNT(*)>1)
    INSERT INTO @Errors VALUES(N'Cash shifts',N'More than one open shift exists for the same cash register.');

IF EXISTS (SELECT 1 FROM core.Members m LEFT JOIN core.People p ON p.OrganizationId=m.OrganizationId AND p.PersonId=m.PersonId WHERE p.PersonId IS NULL)
    INSERT INTO @Errors VALUES(N'Member person FK',N'Orphan member detected.');

IF EXISTS (SELECT 1 FROM training.ClassReservations r LEFT JOIN training.ClassSessions s ON s.OrganizationId=r.OrganizationId AND s.ClassSessionId=r.ClassSessionId WHERE s.ClassSessionId IS NULL)
    INSERT INTO @Errors VALUES(N'Class reservation FK',N'Orphan class reservation detected.');

IF EXISTS (SELECT 1 FROM @Errors)
BEGIN
    SELECT * FROM @Errors;
    THROW 51999, 'GymFlow integrity tests failed.', 1;
END;

SELECT N'PASS' AS Result, N'All GymFlow integrity smoke tests passed.' AS Detail;
GO
