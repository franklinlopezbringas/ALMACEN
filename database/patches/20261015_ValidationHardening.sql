USE GymFlowDb;
GO
SET QUOTED_IDENTIFIER ON;
GO
IF OBJECT_ID(N'finance.FK_Payments_Organization', N'F') IS NULL
ALTER TABLE finance.Payments ADD CONSTRAINT FK_Payments_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId);
GO
IF OBJECT_ID(N'training.FK_Exercises_Organization', N'F') IS NULL
ALTER TABLE training.Exercises ADD CONSTRAINT FK_Exercises_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId);
GO
IF OBJECT_ID(N'training.FK_WorkoutTemplates_Organization', N'F') IS NULL
ALTER TABLE training.WorkoutTemplates ADD CONSTRAINT FK_WorkoutTemplates_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId);
GO
IF OBJECT_ID(N'commerce.FK_Products_Organization', N'F') IS NULL
ALTER TABLE commerce.Products ADD CONSTRAINT FK_Products_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId);
GO
IF OBJECT_ID(N'loyalty.FK_Rewards_Organization', N'F') IS NULL
ALTER TABLE loyalty.Rewards ADD CONSTRAINT FK_Rewards_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId);
GO
IF OBJECT_ID(N'automation.FK_Jobs_Organization', N'F') IS NULL
ALTER TABLE automation.Jobs ADD CONSTRAINT FK_Jobs_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'finance.CashMovements') AND name=N'UX_CashMovements_PaymentSplit')
CREATE UNIQUE INDEX UX_CashMovements_PaymentSplit ON finance.CashMovements(OrganizationId, PaymentSplitId) WHERE PaymentSplitId IS NOT NULL;
GO
CREATE OR ALTER TRIGGER finance.TR_CashMovements_Validate
ON finance.CashMovements AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i JOIN finance.PaymentSplits s ON s.PaymentSplitId=i.PaymentSplitId
        JOIN finance.PaymentMethods m ON m.PaymentMethodId=s.PaymentMethodId
        WHERE m.IsCash=0 OR i.Amount<>s.Amount OR i.MovementType<>'INCOME')
        THROW 51004, 'Cash movements must match a cash payment split.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN finance.Refunds r ON r.RefundId=i.RefundId WHERE r.OrganizationId<>i.OrganizationId)
        THROW 51005, 'Refund and cash movement must belong to the same organization.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN finance.CashShifts s WITH (UPDLOCK,HOLDLOCK)
        ON s.CashShiftId=i.CashShiftId WHERE s.Status<>'OPEN')
        THROW 51006, 'Cash shift must be open.', 1;
END;
GO
