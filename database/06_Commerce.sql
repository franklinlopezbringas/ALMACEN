/* GymFlow v1.0 - 06 Commerce & Inventory */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE commerce.ProductCategories
(
    ProductCategoryId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_ProductCategories_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_ProductCategories PRIMARY KEY (ProductCategoryId),
    CONSTRAINT UQ_ProductCategories_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_ProductCategories_Org_Id UNIQUE (OrganizationId, ProductCategoryId),
    CONSTRAINT FK_ProductCategories_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId)
);
GO

CREATE TABLE commerce.Products
(
    ProductId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Products_PublicId DEFAULT NEWSEQUENTIALID(),
    ProductCategoryId BIGINT NULL,
    Sku NVARCHAR(80) NOT NULL,
    Name NVARCHAR(150) NOT NULL,
    Description NVARCHAR(600) NULL,
    SalePrice DECIMAL(19,4) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    MinimumStock DECIMAL(18,3) NOT NULL CONSTRAINT DF_Products_MinStock DEFAULT (0),
    ImageFileId BIGINT NULL,
    IsPublic BIT NOT NULL CONSTRAINT DF_Products_Public DEFAULT (1),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Products_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Products_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Products_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT UQ_Products_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Products_Org_Sku UNIQUE (OrganizationId, Sku),
    CONSTRAINT UQ_Products_Org_Id UNIQUE (OrganizationId, ProductId),
    CONSTRAINT FK_Products_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_Products_Category FOREIGN KEY (OrganizationId, ProductCategoryId) REFERENCES commerce.ProductCategories(OrganizationId, ProductCategoryId),
    CONSTRAINT FK_Products_Image FOREIGN KEY (OrganizationId, ImageFileId) REFERENCES core.Files(OrganizationId, FileId),
    CONSTRAINT CK_Products_Price CHECK (SalePrice>=0),
    CONSTRAINT CK_Products_MinStock CHECK (MinimumStock>=0),
    CONSTRAINT CK_Products_Status CHECK (Status IN ('ACTIVE','INACTIVE','ARCHIVED'))
);
GO
CREATE INDEX IX_Products_Org_Status_Name ON commerce.Products(OrganizationId, Status, Name) INCLUDE(Sku, SalePrice);
GO

CREATE TABLE commerce.InventoryBalances
(
    OrganizationId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    ProductId BIGINT NOT NULL,
    QuantityOnHand DECIMAL(18,3) NOT NULL CONSTRAINT DF_InventoryBalances_Qty DEFAULT (0),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_InventoryBalances_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_InventoryBalances PRIMARY KEY (BranchId, ProductId),
    CONSTRAINT FK_InventoryBalances_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT FK_InventoryBalances_Product FOREIGN KEY (OrganizationId, ProductId) REFERENCES commerce.Products(OrganizationId, ProductId),
    CONSTRAINT CK_InventoryBalances_Qty CHECK (QuantityOnHand>=0)
);
GO

CREATE TABLE commerce.Suppliers
(
    SupplierId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Suppliers_PublicId DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(160) NOT NULL,
    TaxId NVARCHAR(30) NULL,
    ContactName NVARCHAR(150) NULL,
    Phone NVARCHAR(30) NULL,
    Email NVARCHAR(320) NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Suppliers_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_Suppliers PRIMARY KEY (SupplierId),
    CONSTRAINT UQ_Suppliers_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Suppliers_Org_Id UNIQUE (OrganizationId, SupplierId),
    CONSTRAINT FK_Suppliers_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Suppliers_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
);
GO
CREATE UNIQUE INDEX UX_Suppliers_Org_TaxId ON commerce.Suppliers(OrganizationId, TaxId) WHERE TaxId IS NOT NULL;
GO

CREATE TABLE commerce.PurchaseOrders
(
    PurchaseOrderId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    SupplierId BIGINT NOT NULL,
    PurchaseNumber NVARCHAR(40) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    TotalAmount DECIMAL(19,4) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_PurchaseOrders_Status DEFAULT ('DRAFT'),
    OrderedAtUtc DATETIME2(3) NULL,
    ReceivedAtUtc DATETIME2(3) NULL,
    CreatedByUserId BIGINT NOT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PurchaseOrders_Created DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_PurchaseOrders PRIMARY KEY (PurchaseOrderId),
    CONSTRAINT UQ_PurchaseOrders_Org_Number UNIQUE (OrganizationId, PurchaseNumber),
    CONSTRAINT UQ_PurchaseOrders_Org_Id UNIQUE (OrganizationId, PurchaseOrderId),
    CONSTRAINT FK_PurchaseOrders_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT FK_PurchaseOrders_Supplier FOREIGN KEY (OrganizationId, SupplierId) REFERENCES commerce.Suppliers(OrganizationId, SupplierId),
    CONSTRAINT FK_PurchaseOrders_User FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_PurchaseOrders_Total CHECK (TotalAmount>=0),
    CONSTRAINT CK_PurchaseOrders_Status CHECK (Status IN ('DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'))
);
GO

CREATE TABLE commerce.PurchaseOrderItems
(
    PurchaseOrderItemId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PurchaseOrderId BIGINT NOT NULL,
    ProductId BIGINT NOT NULL,
    Quantity DECIMAL(18,3) NOT NULL,
    UnitCost DECIMAL(19,4) NOT NULL,
    TotalAmount AS (CONVERT(DECIMAL(19,4), Quantity*UnitCost)) PERSISTED,
    CONSTRAINT PK_PurchaseOrderItems PRIMARY KEY (PurchaseOrderItemId),
    CONSTRAINT UQ_PurchaseOrderItems_Org_Id UNIQUE (OrganizationId, PurchaseOrderItemId),
    CONSTRAINT FK_PurchaseOrderItems_Order FOREIGN KEY (OrganizationId, PurchaseOrderId) REFERENCES commerce.PurchaseOrders(OrganizationId, PurchaseOrderId),
    CONSTRAINT FK_PurchaseOrderItems_Product FOREIGN KEY (OrganizationId, ProductId) REFERENCES commerce.Products(OrganizationId, ProductId),
    CONSTRAINT CK_PurchaseOrderItems_Quantity CHECK (Quantity>0),
    CONSTRAINT CK_PurchaseOrderItems_Cost CHECK (UnitCost>=0)
);
GO

CREATE TABLE commerce.InventoryMovements
(
    InventoryMovementId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    ProductId BIGINT NOT NULL,
    MovementType VARCHAR(30) NOT NULL,
    Quantity DECIMAL(18,3) NOT NULL,
    OrderItemId BIGINT NULL,
    PurchaseOrderItemId BIGINT NULL,
    ReferenceText NVARCHAR(150) NULL,
    Reason NVARCHAR(300) NULL,
    CreatedByUserId BIGINT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_InventoryMovements_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_InventoryMovements PRIMARY KEY (InventoryMovementId),
    CONSTRAINT FK_InventoryMovements_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT FK_InventoryMovements_Product FOREIGN KEY (OrganizationId, ProductId) REFERENCES commerce.Products(OrganizationId, ProductId),
    CONSTRAINT FK_InventoryMovements_OrderItem FOREIGN KEY (OrganizationId, OrderItemId) REFERENCES finance.OrderItems(OrganizationId, OrderItemId),
    CONSTRAINT FK_InventoryMovements_PurchaseItem FOREIGN KEY (OrganizationId, PurchaseOrderItemId) REFERENCES commerce.PurchaseOrderItems(OrganizationId, PurchaseOrderItemId),
    CONSTRAINT FK_InventoryMovements_User FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_InventoryMovements_Qty CHECK (Quantity>0),
    CONSTRAINT CK_InventoryMovements_Type CHECK (MovementType IN ('PURCHASE_IN','SALE_OUT','RETURN_IN','RETURN_OUT','REWARD_OUT','ADJUSTMENT_IN','ADJUSTMENT_OUT','TRANSFER_IN','TRANSFER_OUT'))
);
GO
CREATE INDEX IX_InventoryMovements_Product_Date ON commerce.InventoryMovements(OrganizationId, BranchId, ProductId, CreatedAtUtc DESC);
GO

CREATE TABLE commerce.ProductReturns
(
    ProductReturnId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    OrderId BIGINT NOT NULL,
    OrderItemId BIGINT NOT NULL,
    ProductId BIGINT NOT NULL,
    Quantity DECIMAL(18,3) NOT NULL,
    Reason NVARCHAR(500) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_ProductReturns_Status DEFAULT ('REQUESTED'),
    RequestedByUserId BIGINT NOT NULL,
    ApprovedByUserId BIGINT NULL,
    RequestedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ProductReturns_Requested DEFAULT SYSUTCDATETIME(),
    ProcessedAtUtc DATETIME2(3) NULL,
    CONSTRAINT UQ_ProductReturns_Org_Id UNIQUE (OrganizationId, ProductReturnId),
    CONSTRAINT PK_ProductReturns PRIMARY KEY (ProductReturnId),
    CONSTRAINT FK_ProductReturns_Order FOREIGN KEY (OrganizationId, OrderId) REFERENCES finance.Orders(OrganizationId, OrderId),
    CONSTRAINT FK_ProductReturns_OrderItem FOREIGN KEY (OrganizationId, OrderItemId) REFERENCES finance.OrderItems(OrganizationId, OrderItemId),
    CONSTRAINT FK_ProductReturns_Product FOREIGN KEY (OrganizationId, ProductId) REFERENCES commerce.Products(OrganizationId, ProductId),
    CONSTRAINT FK_ProductReturns_RequestedBy FOREIGN KEY (RequestedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_ProductReturns_ApprovedBy FOREIGN KEY (ApprovedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_ProductReturns_Quantity CHECK (Quantity>0),
    CONSTRAINT CK_ProductReturns_Status CHECK (Status IN ('REQUESTED','APPROVED','REJECTED','PROCESSED','CANCELLED'))
);
GO

ALTER TABLE finance.Refunds ADD CONSTRAINT FK_Refunds_ProductReturn FOREIGN KEY (OrganizationId, ProductReturnId) REFERENCES commerce.ProductReturns(OrganizationId, ProductReturnId);
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
CREATE INDEX IX_ProductReturns_OrderItem_Status ON commerce.ProductReturns(OrganizationId,OrderItemId,Status) INCLUDE(Quantity);
GO
CREATE INDEX IX_Refunds_Split_Status ON finance.Refunds(OrganizationId,PaymentSplitId,Status) INCLUDE(Amount);
GO
