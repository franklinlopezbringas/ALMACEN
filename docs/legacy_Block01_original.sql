/* ============================================================
   GymFlow DB - Block 01
   Organization + Identity & Security
   Target: Microsoft SQL Server
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE [master];
GO
IF DB_ID(N'GymFlowDb') IS NULL
BEGIN
    EXEC(N'CREATE DATABASE [GymFlowDb];');
END;
GO
USE [GymFlowDb];
GO

IF SCHEMA_ID(N'core') IS NULL EXEC(N'CREATE SCHEMA [core] AUTHORIZATION [dbo];');
GO
IF SCHEMA_ID(N'security') IS NULL EXEC(N'CREATE SCHEMA [security] AUTHORIZATION [dbo];');
GO
IF SCHEMA_ID(N'crm') IS NULL EXEC(N'CREATE SCHEMA [crm] AUTHORIZATION [dbo];');
GO
IF SCHEMA_ID(N'membership') IS NULL EXEC(N'CREATE SCHEMA [membership] AUTHORIZATION [dbo];');
GO
IF SCHEMA_ID(N'finance') IS NULL EXEC(N'CREATE SCHEMA [finance] AUTHORIZATION [dbo];');
GO
IF SCHEMA_ID(N'access') IS NULL EXEC(N'CREATE SCHEMA [access] AUTHORIZATION [dbo];');
GO
IF SCHEMA_ID(N'audit') IS NULL EXEC(N'CREATE SCHEMA [audit] AUTHORIZATION [dbo];');
GO

/* core.Organizations */
IF OBJECT_ID(N'core.Organizations', N'U') IS NULL
BEGIN
    CREATE TABLE core.Organizations
    (
        OrganizationId          BIGINT IDENTITY(1,1) NOT NULL,
        PublicId                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Organizations_PublicId DEFAULT NEWSEQUENTIALID(),
        LegalName               NVARCHAR(200) NOT NULL,
        TradeName               NVARCHAR(150) NOT NULL,
        TaxId                   NVARCHAR(30) NULL,
        Phone                   NVARCHAR(30) NULL,
        Email                   NVARCHAR(320) NULL,
        DefaultCurrencyCode     CHAR(3) NOT NULL CONSTRAINT DF_Organizations_Currency DEFAULT ('PEN'),
        DefaultTimeZoneId       NVARCHAR(100) NOT NULL CONSTRAINT DF_Organizations_TimeZone DEFAULT (N'America/Lima'),
        Status                  VARCHAR(20) NOT NULL CONSTRAINT DF_Organizations_Status DEFAULT ('ACTIVE'),
        CreatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_Organizations_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_Organizations_UpdatedAtUtc DEFAULT SYSUTCDATETIME(),
        RowVersion              ROWVERSION NOT NULL,
        CONSTRAINT PK_Organizations PRIMARY KEY CLUSTERED (OrganizationId),
        CONSTRAINT UQ_Organizations_PublicId UNIQUE (PublicId),
        CONSTRAINT CK_Organizations_Status CHECK (Status IN ('ACTIVE','INACTIVE','SUSPENDED')),
        CONSTRAINT CK_Organizations_Currency CHECK (DefaultCurrencyCode LIKE '[A-Z][A-Z][A-Z]')
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_Organizations_TaxId' AND object_id=OBJECT_ID(N'core.Organizations'))
BEGIN
    CREATE UNIQUE INDEX UX_Organizations_TaxId ON core.Organizations(TaxId) WHERE TaxId IS NOT NULL;
END;
GO

/* core.Branches */
IF OBJECT_ID(N'core.Branches', N'U') IS NULL
BEGIN
    CREATE TABLE core.Branches
    (
        BranchId                BIGINT IDENTITY(1,1) NOT NULL,
        OrganizationId          BIGINT NOT NULL,
        PublicId                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Branches_PublicId DEFAULT NEWSEQUENTIALID(),
        Code                    NVARCHAR(30) NOT NULL,
        Name                    NVARCHAR(150) NOT NULL,
        AddressLine1            NVARCHAR(250) NULL,
        AddressLine2            NVARCHAR(250) NULL,
        District                NVARCHAR(120) NULL,
        City                    NVARCHAR(120) NULL,
        StateOrRegion           NVARCHAR(120) NULL,
        CountryCode             CHAR(2) NOT NULL CONSTRAINT DF_Branches_CountryCode DEFAULT ('PE'),
        Phone                   NVARCHAR(30) NULL,
        Email                   NVARCHAR(320) NULL,
        TimeZoneId              NVARCHAR(100) NOT NULL CONSTRAINT DF_Branches_TimeZone DEFAULT (N'America/Lima'),
        Status                  VARCHAR(20) NOT NULL CONSTRAINT DF_Branches_Status DEFAULT ('ACTIVE'),
        CreatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_Branches_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_Branches_UpdatedAtUtc DEFAULT SYSUTCDATETIME(),
        RowVersion              ROWVERSION NOT NULL,
        CONSTRAINT PK_Branches PRIMARY KEY CLUSTERED (BranchId),
        CONSTRAINT UQ_Branches_PublicId UNIQUE (PublicId),
        CONSTRAINT UQ_Branches_Organization_Code UNIQUE (OrganizationId, Code),
        CONSTRAINT UQ_Branches_Organization_Branch UNIQUE (OrganizationId, BranchId),
        CONSTRAINT FK_Branches_Organizations FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId) ON DELETE NO ACTION,
        CONSTRAINT CK_Branches_Status CHECK (Status IN ('ACTIVE','INACTIVE')),
        CONSTRAINT CK_Branches_CountryCode CHECK (CountryCode LIKE '[A-Z][A-Z]')
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Branches_Organization_Status' AND object_id=OBJECT_ID(N'core.Branches'))
BEGIN
    CREATE INDEX IX_Branches_Organization_Status ON core.Branches(OrganizationId, Status) INCLUDE(Code, Name);
END;
GO

/* security.Users */
IF OBJECT_ID(N'security.Users', N'U') IS NULL
BEGIN
    CREATE TABLE security.Users
    (
        UserId                  BIGINT IDENTITY(1,1) NOT NULL,
        PublicId                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Users_PublicId DEFAULT NEWSEQUENTIALID(),
        Email                   NVARCHAR(320) NOT NULL,
        NormalizedEmail         NVARCHAR(320) NOT NULL,
        PasswordHash            NVARCHAR(500) NULL,
        EmailVerified           BIT NOT NULL CONSTRAINT DF_Users_EmailVerified DEFAULT (0),
        FailedAccessCount       INT NOT NULL CONSTRAINT DF_Users_FailedAccessCount DEFAULT (0),
        LockoutEndUtc           DATETIME2(3) NULL,
        SecurityStamp           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Users_SecurityStamp DEFAULT NEWID(),
        Status                  VARCHAR(30) NOT NULL CONSTRAINT DF_Users_Status DEFAULT ('PENDING_VERIFICATION'),
        LastLoginAtUtc          DATETIME2(3) NULL,
        CreatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_Users_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_Users_UpdatedAtUtc DEFAULT SYSUTCDATETIME(),
        RowVersion              ROWVERSION NOT NULL,
        CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (UserId),
        CONSTRAINT UQ_Users_PublicId UNIQUE (PublicId),
        CONSTRAINT UQ_Users_NormalizedEmail UNIQUE (NormalizedEmail),
        CONSTRAINT CK_Users_FailedAccessCount CHECK (FailedAccessCount >= 0),
        CONSTRAINT CK_Users_Status CHECK (Status IN ('PENDING_VERIFICATION','ACTIVE','LOCKED','DISABLED'))
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Users_Status' AND object_id=OBJECT_ID(N'security.Users'))
BEGIN
    CREATE INDEX IX_Users_Status ON security.Users(Status) INCLUDE(Email, EmailVerified, LastLoginAtUtc);
END;
GO

/* security.UserOrganizations */
IF OBJECT_ID(N'security.UserOrganizations', N'U') IS NULL
BEGIN
    CREATE TABLE security.UserOrganizations
    (
        UserOrganizationId      BIGINT IDENTITY(1,1) NOT NULL,
        OrganizationId          BIGINT NOT NULL,
        UserId                  BIGINT NOT NULL,
        Status                  VARCHAR(20) NOT NULL CONSTRAINT DF_UserOrganizations_Status DEFAULT ('ACTIVE'),
        JoinedAtUtc             DATETIME2(3) NOT NULL CONSTRAINT DF_UserOrganizations_JoinedAtUtc DEFAULT SYSUTCDATETIME(),
        CreatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_UserOrganizations_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        RowVersion              ROWVERSION NOT NULL,
        CONSTRAINT PK_UserOrganizations PRIMARY KEY CLUSTERED (UserOrganizationId),
        CONSTRAINT UQ_UserOrganizations_Organization_User UNIQUE (OrganizationId, UserId),
        CONSTRAINT UQ_UserOrganizations_Organization_UserOrganization UNIQUE (OrganizationId, UserOrganizationId),
        CONSTRAINT FK_UserOrganizations_Organizations FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserOrganizations_Users FOREIGN KEY (UserId) REFERENCES security.Users(UserId) ON DELETE NO ACTION,
        CONSTRAINT CK_UserOrganizations_Status CHECK (Status IN ('ACTIVE','INACTIVE','SUSPENDED'))
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_UserOrganizations_User_Status' AND object_id=OBJECT_ID(N'security.UserOrganizations'))
BEGIN
    CREATE INDEX IX_UserOrganizations_User_Status ON security.UserOrganizations(UserId, Status) INCLUDE(OrganizationId);
END;
GO

/* security.Roles */
IF OBJECT_ID(N'security.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE security.Roles
    (
        RoleId                  BIGINT IDENTITY(1,1) NOT NULL,
        OrganizationId          BIGINT NOT NULL,
        Code                    NVARCHAR(50) NOT NULL,
        Name                    NVARCHAR(100) NOT NULL,
        Description             NVARCHAR(300) NULL,
        IsSystemRole            BIT NOT NULL CONSTRAINT DF_Roles_IsSystemRole DEFAULT (0),
        Status                  VARCHAR(20) NOT NULL CONSTRAINT DF_Roles_Status DEFAULT ('ACTIVE'),
        CreatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_Roles_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_Roles_UpdatedAtUtc DEFAULT SYSUTCDATETIME(),
        RowVersion              ROWVERSION NOT NULL,
        CONSTRAINT PK_Roles PRIMARY KEY CLUSTERED (RoleId),
        CONSTRAINT UQ_Roles_Organization_Code UNIQUE (OrganizationId, Code),
        CONSTRAINT UQ_Roles_Organization_Role UNIQUE (OrganizationId, RoleId),
        CONSTRAINT FK_Roles_Organizations FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId) ON DELETE NO ACTION,
        CONSTRAINT CK_Roles_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
    );
END;
GO

/* security.Permissions */
IF OBJECT_ID(N'security.Permissions', N'U') IS NULL
BEGIN
    CREATE TABLE security.Permissions
    (
        PermissionId            BIGINT IDENTITY(1,1) NOT NULL,
        Code                    NVARCHAR(100) NOT NULL,
        Name                    NVARCHAR(150) NOT NULL,
        Category                NVARCHAR(80) NOT NULL,
        Description             NVARCHAR(300) NULL,
        Status                  VARCHAR(20) NOT NULL CONSTRAINT DF_Permissions_Status DEFAULT ('ACTIVE'),
        CreatedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_Permissions_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Permissions PRIMARY KEY CLUSTERED (PermissionId),
        CONSTRAINT UQ_Permissions_Code UNIQUE (Code),
        CONSTRAINT CK_Permissions_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
    );
END;
GO

/* security.RolePermissions */
IF OBJECT_ID(N'security.RolePermissions', N'U') IS NULL
BEGIN
    CREATE TABLE security.RolePermissions
    (
        RoleId                  BIGINT NOT NULL,
        PermissionId            BIGINT NOT NULL,
        GrantedAtUtc            DATETIME2(3) NOT NULL CONSTRAINT DF_RolePermissions_GrantedAtUtc DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_RolePermissions PRIMARY KEY CLUSTERED (RoleId, PermissionId),
        CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES security.Roles(RoleId) ON DELETE NO ACTION,
        CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES security.Permissions(PermissionId) ON DELETE NO ACTION
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_RolePermissions_Permission' AND object_id=OBJECT_ID(N'security.RolePermissions'))
BEGIN
    CREATE INDEX IX_RolePermissions_Permission ON security.RolePermissions(PermissionId, RoleId);
END;
GO

/* security.UserRoles */
IF OBJECT_ID(N'security.UserRoles', N'U') IS NULL
BEGIN
    CREATE TABLE security.UserRoles
    (
        OrganizationId          BIGINT NOT NULL,
        UserOrganizationId      BIGINT NOT NULL,
        RoleId                  BIGINT NOT NULL,
        AssignedAtUtc           DATETIME2(3) NOT NULL CONSTRAINT DF_UserRoles_AssignedAtUtc DEFAULT SYSUTCDATETIME(),
        AssignedByUserId        BIGINT NULL,
        CONSTRAINT PK_UserRoles PRIMARY KEY CLUSTERED (OrganizationId, UserOrganizationId, RoleId),
        CONSTRAINT FK_UserRoles_UserOrganizations FOREIGN KEY (OrganizationId, UserOrganizationId)
            REFERENCES security.UserOrganizations(OrganizationId, UserOrganizationId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (OrganizationId, RoleId)
            REFERENCES security.Roles(OrganizationId, RoleId) ON DELETE NO ACTION,
        CONSTRAINT FK_UserRoles_AssignedBy FOREIGN KEY (AssignedByUserId)
            REFERENCES security.Users(UserId) ON DELETE NO ACTION
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_UserRoles_Role' AND object_id=OBJECT_ID(N'security.UserRoles'))
BEGIN
    CREATE INDEX IX_UserRoles_Role ON security.UserRoles(OrganizationId, RoleId) INCLUDE(UserOrganizationId);
END;
GO

/* Verification */
SELECT s.name AS SchemaName, t.name AS TableName
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id=t.schema_id
WHERE s.name IN ('core','security')
ORDER BY s.name,t.name;
GO

PRINT 'GymFlow DB Block 01 created successfully.';
GO
