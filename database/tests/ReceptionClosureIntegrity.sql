USE GymFlowDb;
GO
SET NOCOUNT ON;
IF OBJECT_ID('core.ShiftHandoffs','U') IS NULL THROW 51100,'Missing ShiftHandoffs.',1;
IF COL_LENGTH('communication.SupportTickets','MemberId') IS NULL THROW 51101,'Missing incident member reference.',1;
IF EXISTS(SELECT 1 FROM sys.foreign_keys WHERE parent_object_id IN(OBJECT_ID('core.ShiftHandoffs'),OBJECT_ID('finance.Refunds'),OBJECT_ID('communication.SupportTickets')) AND (is_disabled=1 OR is_not_trusted=1)) THROW 51102,'Untrusted closure foreign key.',1;
IF EXISTS(SELECT 1 FROM core.ShiftHandoffs h JOIN finance.CashShifts s ON s.OrganizationId=h.OrganizationId AND s.CashShiftId=h.CashShiftId JOIN finance.CashRegisters r ON r.OrganizationId=s.OrganizationId AND r.CashRegisterId=s.CashRegisterId WHERE h.BranchId<>r.BranchId OR h.FromEmployeeId<>s.EmployeeId) THROW 51103,'Handoff cash context mismatch.',1;
IF EXISTS(SELECT 1 FROM finance.Refunds f JOIN finance.PaymentSplits s ON s.OrganizationId=f.OrganizationId AND s.PaymentSplitId=f.PaymentSplitId WHERE f.PaymentId<>s.PaymentId) THROW 51104,'Refund original split mismatch.',1;
IF EXISTS(SELECT 1 FROM finance.Refunds f JOIN finance.PaymentSplits s ON s.OrganizationId=f.OrganizationId AND s.PaymentSplitId=f.PaymentSplitId WHERE f.Status='PROCESSED' GROUP BY f.OrganizationId,f.PaymentSplitId,s.Amount HAVING SUM(f.Amount)>s.Amount) THROW 51105,'Refund exceeds original medium.',1;
IF EXISTS(SELECT 1 FROM finance.CashMovements c JOIN finance.Refunds f ON f.OrganizationId=c.OrganizationId AND f.RefundId=c.RefundId JOIN finance.PaymentSplits s ON s.OrganizationId=f.OrganizationId AND s.PaymentSplitId=f.PaymentSplitId JOIN finance.PaymentMethods m ON m.OrganizationId=s.OrganizationId AND m.PaymentMethodId=s.PaymentMethodId WHERE m.IsCash=0 OR c.MovementType<>'REFUND' OR c.Amount<>f.Amount) THROW 51106,'Invalid physical refund movement.',1;
IF EXISTS(SELECT 1 FROM commerce.ProductReturns r JOIN finance.OrderItems i ON i.OrganizationId=r.OrganizationId AND i.OrderItemId=r.OrderItemId WHERE r.Status IN('REQUESTED','APPROVED','PROCESSED') GROUP BY r.OrganizationId,r.OrderItemId,i.Quantity HAVING SUM(r.Quantity)>i.Quantity) THROW 51107,'Returned quantity exceeds sold quantity.',1;
IF EXISTS(SELECT 1 FROM finance.Refunds f JOIN finance.Payments p ON p.OrganizationId=f.OrganizationId AND p.PaymentId=f.PaymentId JOIN commerce.ProductReturns r ON r.OrganizationId=f.OrganizationId AND r.ProductReturnId=f.ProductReturnId WHERE p.OrderId IS NULL OR p.OrderId<>r.OrderId) THROW 51108,'Refund belongs to another order.',1;
IF EXISTS(SELECT 1 FROM commerce.ProductReturns r JOIN finance.OrderItems i ON i.OrganizationId=r.OrganizationId AND i.OrderItemId=r.OrderItemId WHERE r.OrderId<>i.OrderId OR r.ProductId<>i.ReferenceId OR i.ItemType<>'PRODUCT') THROW 51109,'Return does not identify original product/order.',1;
PRINT 'Reception closure integrity: PASS';
GO
