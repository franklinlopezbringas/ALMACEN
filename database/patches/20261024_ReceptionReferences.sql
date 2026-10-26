USE GymFlowDb;
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('finance.Refunds','PaymentSplitId') IS NULL
 ALTER TABLE finance.Refunds ADD PaymentSplitId BIGINT NULL, ProductReturnId BIGINT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.key_constraints WHERE name='UQ_ProductReturns_Org_Id')
 ALTER TABLE commerce.ProductReturns ADD CONSTRAINT UQ_ProductReturns_Org_Id UNIQUE(OrganizationId,ProductReturnId);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Refunds_Split')
 ALTER TABLE finance.Refunds ADD CONSTRAINT FK_Refunds_Split FOREIGN KEY(OrganizationId,PaymentSplitId) REFERENCES finance.PaymentSplits(OrganizationId,PaymentSplitId);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Refunds_ProductReturn')
 ALTER TABLE finance.Refunds ADD CONSTRAINT FK_Refunds_ProductReturn FOREIGN KEY(OrganizationId,ProductReturnId) REFERENCES commerce.ProductReturns(OrganizationId,ProductReturnId);
IF COL_LENGTH('communication.SupportTickets','MemberId') IS NULL
 ALTER TABLE communication.SupportTickets ADD MemberId BIGINT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_SupportTickets_Member')
 ALTER TABLE communication.SupportTickets ADD CONSTRAINT FK_SupportTickets_Member FOREIGN KEY(OrganizationId,MemberId) REFERENCES core.Members(OrganizationId,MemberId);
COMMIT;
GO

CREATE OR ALTER TRIGGER finance.TR_Refunds_References
ON finance.Refunds AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN finance.PaymentSplits s ON s.OrganizationId=i.OrganizationId AND s.PaymentSplitId=i.PaymentSplitId WHERE s.PaymentId<>i.PaymentId)
  THROW 51043,'Refund split must belong to the original payment.',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN commerce.ProductReturns r ON r.OrganizationId=i.OrganizationId AND r.ProductReturnId=i.ProductReturnId JOIN finance.Payments p ON p.OrganizationId=i.OrganizationId AND p.PaymentId=i.PaymentId WHERE p.OrderId IS NULL OR p.OrderId<>r.OrderId OR i.PaymentSplitId IS NULL)
  THROW 51044,'Refund return must belong to the paid order and identify its original split.',1;
END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('commerce.ProductReturns') AND name='IX_ProductReturns_OrderItem_Status')
 CREATE INDEX IX_ProductReturns_OrderItem_Status ON commerce.ProductReturns(OrganizationId,OrderItemId,Status) INCLUDE(Quantity);
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('finance.Refunds') AND name='IX_Refunds_Split_Status')
 CREATE INDEX IX_Refunds_Split_Status ON finance.Refunds(OrganizationId,PaymentSplitId,Status) INCLUDE(Amount);
GO

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('finance.Payments') AND name='IX_Payments_Org_Order')
CREATE INDEX IX_Payments_Org_Order ON finance.Payments(OrganizationId,OrderId) INCLUDE(TotalAmount,Status);
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('finance.Refunds') AND name='IX_Refunds_Payment_Status')
CREATE INDEX IX_Refunds_Payment_Status ON finance.Refunds(OrganizationId,PaymentId,Status) INCLUDE(Amount);
GO
