/* GymFlow v1.0 - 09 Audit, Views & Operational Helpers */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE audit.AuditLogs
(
    AuditLogId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NULL,
    UserId BIGINT NULL,
    CorrelationId UNIQUEIDENTIFIER NULL,
    Action NVARCHAR(100) NOT NULL,
    EntityType NVARCHAR(80) NOT NULL,
    EntityId NVARCHAR(100) NULL,
    OccurredAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_AuditLogs_Occurred DEFAULT SYSUTCDATETIME(),
    IpAddress VARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    BeforeJson NVARCHAR(MAX) NULL,
    AfterJson NVARCHAR(MAX) NULL,
    MetadataJson NVARCHAR(MAX) NULL,
    CONSTRAINT PK_AuditLogs PRIMARY KEY (AuditLogId),
    CONSTRAINT FK_AuditLogs_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_AuditLogs_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_AuditLogs_Before CHECK (BeforeJson IS NULL OR ISJSON(BeforeJson)=1),
    CONSTRAINT CK_AuditLogs_After CHECK (AfterJson IS NULL OR ISJSON(AfterJson)=1),
    CONSTRAINT CK_AuditLogs_Metadata CHECK (MetadataJson IS NULL OR ISJSON(MetadataJson)=1)
);
GO
CREATE INDEX IX_AuditLogs_Org_Date ON audit.AuditLogs(OrganizationId, OccurredAtUtc DESC) INCLUDE(UserId, Action, EntityType, EntityId);
GO
CREATE INDEX IX_AuditLogs_Entity ON audit.AuditLogs(OrganizationId, EntityType, EntityId, OccurredAtUtc DESC);
GO

/* Read model: current receivable balance; source of truth remains allocations ledger. */
CREATE OR ALTER VIEW finance.vw_ReceivableBalances
AS
SELECT
    r.OrganizationId,
    r.ReceivableId,
    r.MemberId,
    r.MembershipId,
    r.OrderId,
    r.Description,
    r.TotalAmount,
    r.CurrencyCode,
    r.DueDate,
    r.Status,
    CAST(r.TotalAmount - ISNULL(SUM(CASE WHEN p.Status IN ('COMPLETED','PARTIALLY_REFUNDED') THEN pa.Amount ELSE 0 END),0) AS DECIMAL(19,4)) AS BalanceAmount
FROM finance.Receivables r
LEFT JOIN finance.PaymentAllocations pa
    ON pa.OrganizationId=r.OrganizationId AND pa.ReceivableId=r.ReceivableId
LEFT JOIN finance.Payments p
    ON p.OrganizationId=pa.OrganizationId AND p.PaymentId=pa.PaymentId
GROUP BY r.OrganizationId,r.ReceivableId,r.MemberId,r.MembershipId,r.OrderId,r.Description,r.TotalAmount,r.CurrencyCode,r.DueDate,r.Status;
GO

/* Read model: live points balance from ledger, for reconciliation with cached PointAccounts.CurrentBalance. */
CREATE OR ALTER VIEW loyalty.vw_PointLedgerBalances
AS
SELECT
    a.OrganizationId,
    a.PointAccountId,
    a.MemberId,
    ISNULL(SUM(CASE WHEN t.TransactionType IN ('EARN','ADJUSTMENT_IN') THEN t.Points ELSE -t.Points END),0) AS LedgerBalance
FROM loyalty.PointAccounts a
LEFT JOIN loyalty.PointTransactions t
    ON t.OrganizationId=a.OrganizationId AND t.PointAccountId=a.PointAccountId
GROUP BY a.OrganizationId,a.PointAccountId,a.MemberId;
GO

/* Read model: inventory ledger balance for reconciliation with InventoryBalances. */
CREATE OR ALTER VIEW commerce.vw_InventoryLedgerBalances
AS
SELECT
    p.OrganizationId,
    b.BranchId,
    p.ProductId,
    ISNULL(SUM(CASE
        WHEN m.MovementType IN ('PURCHASE_IN','RETURN_IN','ADJUSTMENT_IN','TRANSFER_IN') THEN m.Quantity
        ELSE -m.Quantity
    END),0) AS LedgerQuantity
FROM commerce.Products p
CROSS JOIN core.Branches b
LEFT JOIN commerce.InventoryMovements m
    ON m.OrganizationId=p.OrganizationId AND m.BranchId=b.BranchId AND m.ProductId=p.ProductId
WHERE b.OrganizationId=p.OrganizationId
GROUP BY p.OrganizationId,b.BranchId,p.ProductId;
GO

/* Guard against a common data integrity error: a reward redemption may not spend a different amount than configured at request time. */
CREATE OR ALTER TRIGGER loyalty.TR_RewardRedemptions_ValidatePoints
ON loyalty.RewardRedemptions
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        JOIN loyalty.Rewards r ON r.OrganizationId=i.OrganizationId AND r.RewardId=i.RewardId
        WHERE i.PointsSpent<>r.PointsCost
    )
        THROW 51020, 'Reward redemption points must match reward cost.', 1;
END;
GO

/* Prevent impossible membership linkage loops. */
CREATE OR ALTER TRIGGER membership.TR_Memberships_PreventSelfReference
ON membership.Memberships
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted WHERE PreviousMembershipId=MembershipId)
        THROW 51021, 'A membership cannot reference itself as the previous membership.', 1;
END;
GO
