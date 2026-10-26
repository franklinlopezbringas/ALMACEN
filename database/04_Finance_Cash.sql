/* GymFlow v1.0 - 04 Finance, Orders & Cash */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE finance.PaymentMethods
(
    PaymentMethodId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    IsCash BIT NOT NULL CONSTRAINT DF_PaymentMethods_IsCash DEFAULT (0),
    IsOnline BIT NOT NULL CONSTRAINT DF_PaymentMethods_IsOnline DEFAULT (0),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_PaymentMethods_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_PaymentMethods PRIMARY KEY (PaymentMethodId),
    CONSTRAINT UQ_PaymentMethods_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_PaymentMethods_Org_Id UNIQUE (OrganizationId, PaymentMethodId),
    CONSTRAINT FK_PaymentMethods_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_PaymentMethods_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
);
GO

CREATE TABLE finance.Orders
(
    OrderId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Orders_PublicId DEFAULT NEWSEQUENTIALID(),
    OrderNumber NVARCHAR(40) NOT NULL,
    OrderType VARCHAR(20) NOT NULL,
    Channel VARCHAR(20) NOT NULL,
    UserId BIGINT NULL,
    MemberId BIGINT NULL,
    ProspectId BIGINT NULL,
    BranchId BIGINT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    SubtotalAmount DECIMAL(19,4) NOT NULL,
    DiscountAmount DECIMAL(19,4) NOT NULL CONSTRAINT DF_Orders_Discount DEFAULT (0),
    TaxAmount DECIMAL(19,4) NOT NULL CONSTRAINT DF_Orders_Tax DEFAULT (0),
    TotalAmount DECIMAL(19,4) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Orders_Status DEFAULT ('PENDING'),
    ExpiresAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Orders_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Orders_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),
    CONSTRAINT UQ_Orders_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Orders_Org_Number UNIQUE (OrganizationId, OrderNumber),
    CONSTRAINT UQ_Orders_Org_Id UNIQUE (OrganizationId, OrderId),
    CONSTRAINT FK_Orders_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_Orders_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_Orders_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_Orders_Prospect FOREIGN KEY (OrganizationId, ProspectId) REFERENCES crm.Prospects(OrganizationId, ProspectId),
    CONSTRAINT FK_Orders_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT CK_Orders_Type CHECK (OrderType IN ('MEMBERSHIP','STORE','MIXED','OTHER')),
    CONSTRAINT CK_Orders_Channel CHECK (Channel IN ('WEB','RECEPTION','ADMIN','API')),
    CONSTRAINT CK_Orders_Amounts CHECK (SubtotalAmount>=0 AND DiscountAmount>=0 AND TaxAmount>=0 AND TotalAmount>=0),
    CONSTRAINT CK_Orders_Total CHECK (TotalAmount=SubtotalAmount-DiscountAmount+TaxAmount),
    CONSTRAINT CK_Orders_Status CHECK (Status IN ('PENDING','PAID','PARTIALLY_PAID','CANCELLED','EXPIRED','REFUNDED'))
);
GO
CREATE INDEX IX_Orders_Org_Status_Created ON finance.Orders(OrganizationId, Status, CreatedAtUtc DESC) INCLUDE(OrderNumber, MemberId, TotalAmount);
GO

CREATE TABLE finance.OrderItems
(
    OrderItemId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    OrderId BIGINT NOT NULL,
    ItemType VARCHAR(30) NOT NULL,
    ReferenceId BIGINT NULL,
    Sku NVARCHAR(80) NULL,
    Description NVARCHAR(250) NOT NULL,
    Quantity DECIMAL(18,3) NOT NULL,
    UnitPrice DECIMAL(19,4) NOT NULL,
    DiscountAmount DECIMAL(19,4) NOT NULL CONSTRAINT DF_OrderItems_Discount DEFAULT (0),
    TaxAmount DECIMAL(19,4) NOT NULL CONSTRAINT DF_OrderItems_Tax DEFAULT (0),
    TotalAmount DECIMAL(19,4) NOT NULL,
    CONSTRAINT PK_OrderItems PRIMARY KEY (OrderItemId),
    CONSTRAINT UQ_OrderItems_Org_Id UNIQUE (OrganizationId, OrderItemId),
    CONSTRAINT FK_OrderItems_Order FOREIGN KEY (OrganizationId, OrderId) REFERENCES finance.Orders(OrganizationId, OrderId),
    CONSTRAINT CK_OrderItems_Type CHECK (ItemType IN ('PLAN_VERSION','PRODUCT','SERVICE','OTHER')),
    CONSTRAINT CK_OrderItems_Quantity CHECK (Quantity>0),
    CONSTRAINT CK_OrderItems_Amounts CHECK (UnitPrice>=0 AND DiscountAmount>=0 AND TaxAmount>=0 AND TotalAmount>=0),
    CONSTRAINT CK_OrderItems_Total CHECK (TotalAmount=(Quantity*UnitPrice)-DiscountAmount+TaxAmount)
);
GO
CREATE INDEX IX_OrderItems_Order ON finance.OrderItems(OrganizationId, OrderId);
GO

ALTER TABLE membership.Memberships
ADD CONSTRAINT FK_Memberships_SourceOrder FOREIGN KEY (OrganizationId, SourceOrderId)
REFERENCES finance.Orders(OrganizationId, OrderId);
GO

CREATE TABLE finance.PaymentAttempts
(
    PaymentAttemptId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    OrderId BIGINT NOT NULL,
    Provider NVARCHAR(80) NOT NULL,
    Amount DECIMAL(19,4) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    ProviderTransactionId NVARCHAR(150) NULL,
    Status VARCHAR(20) NOT NULL,
    FailureCode NVARCHAR(80) NULL,
    FailureMessage NVARCHAR(500) NULL,
    AttemptedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PaymentAttempts_Attempted DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PaymentAttempts PRIMARY KEY (PaymentAttemptId),
    CONSTRAINT FK_PaymentAttempts_Order FOREIGN KEY (OrganizationId, OrderId) REFERENCES finance.Orders(OrganizationId, OrderId),
    CONSTRAINT CK_PaymentAttempts_Amount CHECK (Amount>0),
    CONSTRAINT CK_PaymentAttempts_Status CHECK (Status IN ('PENDING','APPROVED','REJECTED','ERROR','CANCELLED'))
);
GO
CREATE INDEX IX_PaymentAttempts_Order_Date ON finance.PaymentAttempts(OrganizationId, OrderId, AttemptedAtUtc DESC);
GO

CREATE TABLE finance.Receivables
(
    ReceivableId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    MembershipId BIGINT NULL,
    OrderId BIGINT NULL,
    Description NVARCHAR(250) NOT NULL,
    TotalAmount DECIMAL(19,4) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    DueDate DATE NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Receivables_Status DEFAULT ('OPEN'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Receivables_Created DEFAULT SYSUTCDATETIME(),
    CreatedByUserId BIGINT NULL,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Receivables PRIMARY KEY (ReceivableId),
    CONSTRAINT UQ_Receivables_Org_Id UNIQUE (OrganizationId, ReceivableId),
    CONSTRAINT FK_Receivables_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_Receivables_Membership FOREIGN KEY (OrganizationId, MembershipId) REFERENCES membership.Memberships(OrganizationId, MembershipId),
    CONSTRAINT FK_Receivables_Order FOREIGN KEY (OrganizationId, OrderId) REFERENCES finance.Orders(OrganizationId, OrderId),
    CONSTRAINT FK_Receivables_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_Receivables_Amount CHECK (TotalAmount>0),
    CONSTRAINT CK_Receivables_Status CHECK (Status IN ('OPEN','PARTIALLY_PAID','PAID','CANCELLED','WRITTEN_OFF'))
);
GO
CREATE INDEX IX_Receivables_Org_Member_Status_Due ON finance.Receivables(OrganizationId, MemberId, Status, DueDate);
GO

CREATE TABLE finance.Payments
(
    PaymentId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Payments_PublicId DEFAULT NEWSEQUENTIALID(),
    ReceiptNumber NVARCHAR(50) NULL,
    MemberId BIGINT NULL,
    OrderId BIGINT NULL,
    BranchId BIGINT NULL,
    TotalAmount DECIMAL(19,4) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    Source VARCHAR(20) NOT NULL,
    Status VARCHAR(30) NOT NULL CONSTRAINT DF_Payments_Status DEFAULT ('COMPLETED'),
    ReceivedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Payments_Received DEFAULT SYSUTCDATETIME(),
    ReceivedByUserId BIGINT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Payments_Created DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Payments PRIMARY KEY (PaymentId),
    CONSTRAINT UQ_Payments_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Payments_Org_Id UNIQUE (OrganizationId, PaymentId),
    CONSTRAINT FK_Payments_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_Payments_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_Payments_Order FOREIGN KEY (OrganizationId, OrderId) REFERENCES finance.Orders(OrganizationId, OrderId),
    CONSTRAINT FK_Payments_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT FK_Payments_ReceivedBy FOREIGN KEY (ReceivedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_Payments_Amount CHECK (TotalAmount>0),
    CONSTRAINT CK_Payments_Source CHECK (Source IN ('WEB','RECEPTION','ADMIN','IMPORT','API')),
    CONSTRAINT CK_Payments_Status CHECK (Status IN ('COMPLETED','VOIDED','PARTIALLY_REFUNDED','REFUNDED'))
);
GO
CREATE UNIQUE INDEX UX_Payments_Org_Receipt ON finance.Payments(OrganizationId, ReceiptNumber) WHERE ReceiptNumber IS NOT NULL;
GO
CREATE INDEX IX_Payments_Org_Received ON finance.Payments(OrganizationId, ReceivedAtUtc DESC) INCLUDE(MemberId, TotalAmount, Status);
GO

CREATE TABLE finance.PaymentSplits
(
    PaymentSplitId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PaymentId BIGINT NOT NULL,
    PaymentMethodId BIGINT NOT NULL,
    Amount DECIMAL(19,4) NOT NULL,
    ExternalReference NVARCHAR(150) NULL,
    ProviderTransactionId NVARCHAR(150) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PaymentSplits_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PaymentSplits PRIMARY KEY (PaymentSplitId),
    CONSTRAINT UQ_PaymentSplits_Org_Id UNIQUE (OrganizationId, PaymentSplitId),
    CONSTRAINT FK_PaymentSplits_Payment FOREIGN KEY (OrganizationId, PaymentId) REFERENCES finance.Payments(OrganizationId, PaymentId),
    CONSTRAINT FK_PaymentSplits_Method FOREIGN KEY (OrganizationId, PaymentMethodId) REFERENCES finance.PaymentMethods(OrganizationId, PaymentMethodId),
    CONSTRAINT CK_PaymentSplits_Amount CHECK (Amount>0)
);
GO
CREATE INDEX IX_PaymentSplits_Payment ON finance.PaymentSplits(OrganizationId, PaymentId);
GO

CREATE TABLE finance.PaymentAllocations
(
    PaymentAllocationId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PaymentId BIGINT NOT NULL,
    ReceivableId BIGINT NOT NULL,
    Amount DECIMAL(19,4) NOT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PaymentAllocations_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PaymentAllocations PRIMARY KEY (PaymentAllocationId),
    CONSTRAINT UQ_PaymentAllocations_Payment_Receivable UNIQUE (PaymentId, ReceivableId),
    CONSTRAINT FK_PaymentAllocations_Payment FOREIGN KEY (OrganizationId, PaymentId) REFERENCES finance.Payments(OrganizationId, PaymentId),
    CONSTRAINT FK_PaymentAllocations_Receivable FOREIGN KEY (OrganizationId, ReceivableId) REFERENCES finance.Receivables(OrganizationId, ReceivableId),
    CONSTRAINT CK_PaymentAllocations_Amount CHECK (Amount>0)
);
GO
CREATE INDEX IX_PaymentAllocations_Receivable ON finance.PaymentAllocations(OrganizationId, ReceivableId);
GO

CREATE TABLE finance.Refunds
(
    RefundId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PaymentId BIGINT NOT NULL,
    Amount DECIMAL(19,4) NOT NULL,
    Reason NVARCHAR(500) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Refunds_Status DEFAULT ('REQUESTED'),
    RequestedByUserId BIGINT NOT NULL,
    ApprovedByUserId BIGINT NULL,
    RequestedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Refunds_Requested DEFAULT SYSUTCDATETIME(),
    ApprovedAtUtc DATETIME2(3) NULL,
    ProcessedAtUtc DATETIME2(3) NULL,
    PaymentSplitId BIGINT NULL,
    ProductReturnId BIGINT NULL,
    CONSTRAINT FK_Refunds_Split FOREIGN KEY (OrganizationId, PaymentSplitId) REFERENCES finance.PaymentSplits(OrganizationId, PaymentSplitId),
    CONSTRAINT PK_Refunds PRIMARY KEY (RefundId),
    CONSTRAINT FK_Refunds_Payment FOREIGN KEY (OrganizationId, PaymentId) REFERENCES finance.Payments(OrganizationId, PaymentId),
    CONSTRAINT FK_Refunds_RequestedBy FOREIGN KEY (RequestedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_Refunds_ApprovedBy FOREIGN KEY (ApprovedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_Refunds_Amount CHECK (Amount>0),
    CONSTRAINT CK_Refunds_Status CHECK (Status IN ('REQUESTED','APPROVED','REJECTED','PROCESSED','CANCELLED'))
);
GO

CREATE TABLE finance.PaymentReversals
(
    PaymentReversalId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PaymentId BIGINT NOT NULL,
    Reason NVARCHAR(500) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_PaymentReversals_Status DEFAULT ('REQUESTED'),
    RequestedByUserId BIGINT NOT NULL,
    ApprovedByUserId BIGINT NULL,
    RequestedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PaymentReversals_Requested DEFAULT SYSUTCDATETIME(),
    ReviewedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_PaymentReversals PRIMARY KEY (PaymentReversalId),
    CONSTRAINT FK_PaymentReversals_Payment FOREIGN KEY (OrganizationId, PaymentId) REFERENCES finance.Payments(OrganizationId, PaymentId),
    CONSTRAINT FK_PaymentReversals_RequestedBy FOREIGN KEY (RequestedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_PaymentReversals_ApprovedBy FOREIGN KEY (ApprovedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_PaymentReversals_Status CHECK (Status IN ('REQUESTED','APPROVED','REJECTED','APPLIED','CANCELLED'))
);
GO

CREATE TABLE finance.CashRegisters
(
    CashRegisterId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    Code NVARCHAR(30) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_CashRegisters_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_CashRegisters PRIMARY KEY (CashRegisterId),
    CONSTRAINT UQ_CashRegisters_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_CashRegisters_Org_Id UNIQUE (OrganizationId, CashRegisterId),
    CONSTRAINT FK_CashRegisters_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT CK_CashRegisters_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
);
GO

CREATE TABLE finance.CashShifts
(
    CashShiftId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    CashRegisterId BIGINT NOT NULL,
    EmployeeId BIGINT NOT NULL,
    OpenedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_CashShifts_Opened DEFAULT SYSUTCDATETIME(),
    OpenedByUserId BIGINT NOT NULL,
    OpeningAmount DECIMAL(19,4) NOT NULL,
    ClosedAtUtc DATETIME2(3) NULL,
    ClosedByUserId BIGINT NULL,
    ExpectedAmountAtClose DECIMAL(19,4) NULL,
    CountedAmountAtClose DECIMAL(19,4) NULL,
    DifferenceAmount DECIMAL(19,4) NULL,
    OpeningNotes NVARCHAR(500) NULL,
    ClosingNotes NVARCHAR(500) NULL,
    Status VARCHAR(30) NOT NULL CONSTRAINT DF_CashShifts_Status DEFAULT ('OPEN'),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_CashShifts PRIMARY KEY (CashShiftId),
    CONSTRAINT UQ_CashShifts_Org_Id UNIQUE (OrganizationId, CashShiftId),
    CONSTRAINT FK_CashShifts_Register FOREIGN KEY (OrganizationId, CashRegisterId) REFERENCES finance.CashRegisters(OrganizationId, CashRegisterId),
    CONSTRAINT FK_CashShifts_Employee FOREIGN KEY (OrganizationId, EmployeeId) REFERENCES core.Employees(OrganizationId, EmployeeId),
    CONSTRAINT FK_CashShifts_OpenedBy FOREIGN KEY (OpenedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_CashShifts_ClosedBy FOREIGN KEY (ClosedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_CashShifts_Opening CHECK (OpeningAmount>=0),
    CONSTRAINT CK_CashShifts_Count CHECK (CountedAmountAtClose IS NULL OR CountedAmountAtClose>=0),
    CONSTRAINT CK_CashShifts_Status CHECK (Status IN ('OPEN','CLOSED','REVIEW_REQUIRED')),
    CONSTRAINT CK_CashShifts_Close CHECK ((Status='OPEN' AND ClosedAtUtc IS NULL) OR (Status<>'OPEN' AND ClosedAtUtc IS NOT NULL))
);
GO
CREATE UNIQUE INDEX UX_CashShifts_OneOpenPerRegister ON finance.CashShifts(OrganizationId, CashRegisterId) WHERE Status='OPEN';
GO
CREATE INDEX IX_CashShifts_Org_Opened ON finance.CashShifts(OrganizationId, OpenedAtUtc DESC) INCLUDE(Status, EmployeeId, CashRegisterId);
GO

CREATE TABLE finance.CashMovements
(
    CashMovementId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    CashShiftId BIGINT NOT NULL,
    MovementType VARCHAR(30) NOT NULL,
    Amount DECIMAL(19,4) NOT NULL,
    PaymentSplitId BIGINT NULL,
    RefundId BIGINT NULL,
    Description NVARCHAR(250) NOT NULL,
    CreatedByUserId BIGINT NOT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_CashMovements_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_CashMovements PRIMARY KEY (CashMovementId),
    CONSTRAINT FK_CashMovements_Shift FOREIGN KEY (OrganizationId, CashShiftId) REFERENCES finance.CashShifts(OrganizationId, CashShiftId),
    CONSTRAINT FK_CashMovements_PaymentSplit FOREIGN KEY (OrganizationId, PaymentSplitId) REFERENCES finance.PaymentSplits(OrganizationId, PaymentSplitId),
    CONSTRAINT FK_CashMovements_Refund FOREIGN KEY (RefundId) REFERENCES finance.Refunds(RefundId),
    CONSTRAINT FK_CashMovements_User FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_CashMovements_Amount CHECK (Amount>0),
    CONSTRAINT CK_CashMovements_Type CHECK (MovementType IN ('INCOME','EXPENSE','ADJUSTMENT_IN','ADJUSTMENT_OUT','REFUND'))
);
GO
CREATE INDEX IX_CashMovements_Shift_Date ON finance.CashMovements(OrganizationId, CashShiftId, CreatedAtUtc);
GO
CREATE UNIQUE INDEX UX_CashMovements_PaymentSplit ON finance.CashMovements(OrganizationId, PaymentSplitId) WHERE PaymentSplitId IS NOT NULL;
GO
/* Enforce the documented cash-only invariant for every writer, not only the API. */
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

/* Aggregate safety: allocations and splits cannot exceed the parent amount. */
CREATE OR ALTER TRIGGER finance.TR_PaymentSplits_ValidateTotal
ON finance.PaymentSplits
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS
    (
        SELECT 1
        FROM (SELECT DISTINCT OrganizationId, PaymentId FROM inserted) i
        JOIN finance.Payments p ON p.OrganizationId=i.OrganizationId AND p.PaymentId=i.PaymentId
        CROSS APPLY (SELECT SUM(ps.Amount) AS SplitTotal FROM finance.PaymentSplits ps WHERE ps.OrganizationId=i.OrganizationId AND ps.PaymentId=i.PaymentId) s
        WHERE s.SplitTotal > p.TotalAmount
    )
        THROW 51001, 'Payment split total cannot exceed payment total.', 1;
END;
GO

CREATE OR ALTER TRIGGER finance.TR_PaymentAllocations_ValidateTotals
ON finance.PaymentAllocations
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS
    (
        SELECT 1
        FROM (SELECT DISTINCT OrganizationId, PaymentId FROM inserted) i
        JOIN finance.Payments p ON p.OrganizationId=i.OrganizationId AND p.PaymentId=i.PaymentId
        CROSS APPLY (SELECT SUM(pa.Amount) AS AllocTotal FROM finance.PaymentAllocations pa WHERE pa.OrganizationId=i.OrganizationId AND pa.PaymentId=i.PaymentId) a
        WHERE a.AllocTotal > p.TotalAmount
    )
        THROW 51002, 'Payment allocations cannot exceed payment total.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM (SELECT DISTINCT OrganizationId, ReceivableId FROM inserted) i
        JOIN finance.Receivables r ON r.OrganizationId=i.OrganizationId AND r.ReceivableId=i.ReceivableId
        CROSS APPLY (SELECT SUM(pa.Amount) AS AppliedTotal FROM finance.PaymentAllocations pa WHERE pa.OrganizationId=i.OrganizationId AND pa.ReceivableId=i.ReceivableId) a
        WHERE a.AppliedTotal > r.TotalAmount
    )
        THROW 51003, 'Applied payments cannot exceed receivable total.', 1;
END;
GO

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
GO
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

CREATE INDEX IX_Payments_Org_Order ON finance.Payments(OrganizationId,OrderId) INCLUDE(TotalAmount,Status);
GO
CREATE INDEX IX_Refunds_Payment_Status ON finance.Refunds(OrganizationId,PaymentId,Status) INCLUDE(Amount);
GO
