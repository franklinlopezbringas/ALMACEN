USE GymFlowDb;
GO
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
IF OBJECT_ID(N'core.ShiftHandoffs',N'U') IS NULL
BEGIN
/* Reception handoff: independent lifecycle; optional cash linkage only. */
CREATE TABLE core.ShiftHandoffs
(
    ShiftHandoffId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    FromEmployeeId BIGINT NOT NULL,
    ToEmployeeId BIGINT NULL,
    CashShiftId BIGINT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_ShiftHandoffs_Status DEFAULT ('PENDING'),
    Notes NVARCHAR(2000) NULL,
    PendingItems NVARCHAR(4000) NULL,
    HandedOffAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ShiftHandoffs_HandedOff DEFAULT SYSUTCDATETIME(),
    AcknowledgedAtUtc DATETIME2(3) NULL,
    CreatedByUserId BIGINT NOT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ShiftHandoffs_Created DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_ShiftHandoffs PRIMARY KEY (ShiftHandoffId),
    CONSTRAINT UQ_ShiftHandoffs_Org_Id UNIQUE (OrganizationId,ShiftHandoffId),
    CONSTRAINT FK_ShiftHandoffs_Branch FOREIGN KEY (OrganizationId,BranchId) REFERENCES core.Branches(OrganizationId,BranchId),
    CONSTRAINT FK_ShiftHandoffs_From FOREIGN KEY (OrganizationId,FromEmployeeId) REFERENCES core.Employees(OrganizationId,EmployeeId),
    CONSTRAINT FK_ShiftHandoffs_To FOREIGN KEY (OrganizationId,ToEmployeeId) REFERENCES core.Employees(OrganizationId,EmployeeId),
    CONSTRAINT FK_ShiftHandoffs_Cash FOREIGN KEY (OrganizationId,CashShiftId) REFERENCES finance.CashShifts(OrganizationId,CashShiftId),
    CONSTRAINT FK_ShiftHandoffs_Creator FOREIGN KEY (OrganizationId,CreatedByUserId) REFERENCES security.UserOrganizations(OrganizationId,UserId),
    CONSTRAINT CK_ShiftHandoffs_Status CHECK (Status IN ('PENDING','ACKNOWLEDGED','CANCELLED')),
    CONSTRAINT CK_ShiftHandoffs_Acknowledged CHECK ((Status='ACKNOWLEDGED' AND ToEmployeeId IS NOT NULL AND AcknowledgedAtUtc IS NOT NULL AND AcknowledgedAtUtc>=HandedOffAtUtc) OR (Status<>'ACKNOWLEDGED' AND AcknowledgedAtUtc IS NULL))
);
END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'core.ShiftHandoffs') AND name='IX_ShiftHandoffs_Inbox')
CREATE INDEX IX_ShiftHandoffs_Inbox ON core.ShiftHandoffs(OrganizationId,BranchId,Status,HandedOffAtUtc DESC) INCLUDE(FromEmployeeId,ToEmployeeId);
GO
CREATE OR ALTER TRIGGER core.TR_ShiftHandoffs_Validate
ON core.ShiftHandoffs AFTER INSERT,UPDATE,DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.ShiftHandoffId=d.ShiftHandoffId WHERE i.ShiftHandoffId IS NULL)
        THROW 51040,'Shift handoff history cannot be deleted.',1;
    IF EXISTS(SELECT 1 FROM inserted i JOIN finance.CashShifts s ON s.CashShiftId=i.CashShiftId JOIN finance.CashRegisters r ON r.CashRegisterId=s.CashRegisterId WHERE r.BranchId<>i.BranchId OR s.EmployeeId<>i.FromEmployeeId)
        THROW 51041,'Cash shift must match the handoff branch and sender.',1;
    IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.ShiftHandoffId=i.ShiftHandoffId
        WHERE d.Status<>'PENDING' OR i.Status NOT IN ('ACKNOWLEDGED','CANCELLED')
        OR i.OrganizationId<>d.OrganizationId OR i.BranchId<>d.BranchId OR i.FromEmployeeId<>d.FromEmployeeId
        OR ISNULL(i.CashShiftId,0)<>ISNULL(d.CashShiftId,0) OR i.CreatedByUserId<>d.CreatedByUserId
        OR i.CreatedAtUtc<>d.CreatedAtUtc OR i.HandedOffAtUtc<>d.HandedOffAtUtc
        OR ISNULL(i.Notes,N'')<>ISNULL(d.Notes,N'') OR ISNULL(i.PendingItems,N'')<>ISNULL(d.PendingItems,N'')
        OR (d.ToEmployeeId IS NOT NULL AND ISNULL(i.ToEmployeeId,0)<>d.ToEmployeeId))
        THROW 51042,'Delivered handoff content and terminal states are immutable.',1;
END;
GO
