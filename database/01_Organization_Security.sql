/* GymFlow v1.0 - 01 Organization & Security */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE core.Organizations
(
    OrganizationId BIGINT IDENTITY(1,1) NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Organizations_PublicId DEFAULT NEWSEQUENTIALID(),
    LegalName NVARCHAR(200) NOT NULL,
    TradeName NVARCHAR(150) NOT NULL,
    TaxId NVARCHAR(30) NULL,
    Phone NVARCHAR(30) NULL,
    Email NVARCHAR(320) NULL,
    DefaultCurrencyCode CHAR(3) NOT NULL CONSTRAINT DF_Organizations_Currency DEFAULT ('PEN'),
    DefaultTimeZoneId NVARCHAR(100) NOT NULL CONSTRAINT DF_Organizations_TimeZone DEFAULT (N'America/Lima'),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Organizations_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Organizations_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Organizations_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Organizations PRIMARY KEY CLUSTERED (OrganizationId),
    CONSTRAINT UQ_Organizations_PublicId UNIQUE (PublicId),
    CONSTRAINT CK_Organizations_Status CHECK (Status IN ('ACTIVE','INACTIVE','SUSPENDED')),
    CONSTRAINT CK_Organizations_Currency CHECK (DefaultCurrencyCode LIKE '[A-Z][A-Z][A-Z]')
);
GO
CREATE UNIQUE INDEX UX_Organizations_TaxId ON core.Organizations(TaxId) WHERE TaxId IS NOT NULL;
GO

CREATE TABLE core.Branches
(
    BranchId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Branches_PublicId DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(30) NOT NULL,
    Name NVARCHAR(150) NOT NULL,
    AddressLine1 NVARCHAR(250) NULL,
    AddressLine2 NVARCHAR(250) NULL,
    District NVARCHAR(120) NULL,
    City NVARCHAR(120) NULL,
    StateOrRegion NVARCHAR(120) NULL,
    CountryCode CHAR(2) NOT NULL CONSTRAINT DF_Branches_Country DEFAULT ('PE'),
    Phone NVARCHAR(30) NULL,
    Email NVARCHAR(320) NULL,
    TimeZoneId NVARCHAR(100) NOT NULL CONSTRAINT DF_Branches_TimeZone DEFAULT (N'America/Lima'),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Branches_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Branches_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Branches_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Branches PRIMARY KEY CLUSTERED (BranchId),
    CONSTRAINT UQ_Branches_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Branches_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_Branches_Org_Id UNIQUE (OrganizationId, BranchId),
    CONSTRAINT FK_Branches_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Branches_Status CHECK (Status IN ('ACTIVE','INACTIVE')),
    CONSTRAINT CK_Branches_Country CHECK (CountryCode LIKE '[A-Z][A-Z]')
);
GO
CREATE INDEX IX_Branches_Org_Status ON core.Branches(OrganizationId, Status) INCLUDE(Code, Name);
GO

CREATE TABLE core.OrganizationSettings
(
    OrganizationId BIGINT NOT NULL,
    SettingsJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_OrganizationSettings_Json DEFAULT (N'{}'),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_OrganizationSettings_Updated DEFAULT SYSUTCDATETIME(),
    UpdatedByUserId BIGINT NULL,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_OrganizationSettings PRIMARY KEY (OrganizationId),
    CONSTRAINT FK_OrganizationSettings_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_OrganizationSettings_Json CHECK (ISJSON(SettingsJson)=1)
);
GO

CREATE TABLE core.BranchBusinessHours
(
    BranchBusinessHourId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    DayOfWeek TINYINT NOT NULL,
    OpenTime TIME(0) NULL,
    CloseTime TIME(0) NULL,
    IsClosed BIT NOT NULL CONSTRAINT DF_BranchHours_IsClosed DEFAULT (0),
    CONSTRAINT PK_BranchBusinessHours PRIMARY KEY (BranchBusinessHourId),
    CONSTRAINT UQ_BranchHours_Branch_Day UNIQUE (BranchId, DayOfWeek),
    CONSTRAINT FK_BranchHours_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT CK_BranchHours_Day CHECK (DayOfWeek BETWEEN 1 AND 7),
    CONSTRAINT CK_BranchHours_Time CHECK (IsClosed=1 OR (OpenTime IS NOT NULL AND CloseTime IS NOT NULL AND CloseTime>OpenTime))
);
GO

CREATE TABLE security.Users
(
    UserId BIGINT IDENTITY(1,1) NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Users_PublicId DEFAULT NEWSEQUENTIALID(),
    Email NVARCHAR(320) NOT NULL,
    NormalizedEmail NVARCHAR(320) NOT NULL,
    PasswordHash NVARCHAR(500) NULL,
    EmailVerified BIT NOT NULL CONSTRAINT DF_Users_EmailVerified DEFAULT (0),
    FailedAccessCount INT NOT NULL CONSTRAINT DF_Users_FailedAccess DEFAULT (0),
    LockoutEndUtc DATETIME2(3) NULL,
    SecurityStamp UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Users_SecurityStamp DEFAULT NEWID(),
    Status VARCHAR(30) NOT NULL CONSTRAINT DF_Users_Status DEFAULT ('PENDING_VERIFICATION'),
    LastLoginAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Users_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Users_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (UserId),
    CONSTRAINT UQ_Users_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Users_NormalizedEmail UNIQUE (NormalizedEmail),
    CONSTRAINT CK_Users_FailedAccess CHECK (FailedAccessCount>=0),
    CONSTRAINT CK_Users_Status CHECK (Status IN ('PENDING_VERIFICATION','ACTIVE','LOCKED','DISABLED'))
);
GO

CREATE TABLE security.UserOrganizations
(
    UserOrganizationId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    UserId BIGINT NOT NULL,
    PersonId BIGINT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_UserOrganizations_Status DEFAULT ('ACTIVE'),
    JoinedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_UserOrganizations_Joined DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_UserOrganizations PRIMARY KEY (UserOrganizationId),
    CONSTRAINT UQ_UserOrganizations_Org_User UNIQUE (OrganizationId, UserId),
    CONSTRAINT UQ_UserOrganizations_Org_Id UNIQUE (OrganizationId, UserOrganizationId),
    CONSTRAINT FK_UserOrganizations_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_UserOrganizations_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_UserOrganizations_Status CHECK (Status IN ('ACTIVE','INACTIVE','SUSPENDED'))
);
GO
CREATE INDEX IX_UserOrganizations_User_Status ON security.UserOrganizations(UserId, Status) INCLUDE(OrganizationId);
GO

CREATE TABLE security.Roles
(
    RoleId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(50) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(300) NULL,
    IsSystemRole BIT NOT NULL CONSTRAINT DF_Roles_System DEFAULT (0),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Roles_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Roles_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Roles_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Roles PRIMARY KEY (RoleId),
    CONSTRAINT UQ_Roles_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_Roles_Org_Id UNIQUE (OrganizationId, RoleId),
    CONSTRAINT FK_Roles_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Roles_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
);
GO

CREATE TABLE security.Permissions
(
    PermissionId BIGINT IDENTITY(1,1) NOT NULL,
    Code NVARCHAR(100) NOT NULL,
    Name NVARCHAR(150) NOT NULL,
    Category NVARCHAR(80) NOT NULL,
    Description NVARCHAR(300) NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Permissions_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Permissions_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Permissions PRIMARY KEY (PermissionId),
    CONSTRAINT UQ_Permissions_Code UNIQUE (Code),
    CONSTRAINT CK_Permissions_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
);
GO

CREATE TABLE security.RolePermissions
(
    RoleId BIGINT NOT NULL,
    PermissionId BIGINT NOT NULL,
    GrantedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_RolePermissions_Granted DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleId) REFERENCES security.Roles(RoleId),
    CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (PermissionId) REFERENCES security.Permissions(PermissionId)
);
GO
CREATE INDEX IX_RolePermissions_Permission ON security.RolePermissions(PermissionId, RoleId);
GO

CREATE TABLE security.UserRoles
(
    OrganizationId BIGINT NOT NULL,
    UserOrganizationId BIGINT NOT NULL,
    RoleId BIGINT NOT NULL,
    AssignedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_UserRoles_Assigned DEFAULT SYSUTCDATETIME(),
    AssignedByUserId BIGINT NULL,
    CONSTRAINT PK_UserRoles PRIMARY KEY (OrganizationId, UserOrganizationId, RoleId),
    CONSTRAINT FK_UserRoles_UserOrg FOREIGN KEY (OrganizationId, UserOrganizationId) REFERENCES security.UserOrganizations(OrganizationId, UserOrganizationId),
    CONSTRAINT FK_UserRoles_Role FOREIGN KEY (OrganizationId, RoleId) REFERENCES security.Roles(OrganizationId, RoleId),
    CONSTRAINT FK_UserRoles_AssignedBy FOREIGN KEY (AssignedByUserId) REFERENCES security.Users(UserId)
);
GO
CREATE INDEX IX_UserRoles_Role ON security.UserRoles(OrganizationId, RoleId) INCLUDE(UserOrganizationId);
GO

CREATE TABLE security.UserSessions
(
    UserSessionId BIGINT IDENTITY(1,1) NOT NULL,
    UserId BIGINT NOT NULL,
    OrganizationId BIGINT NULL,
    RefreshTokenHash VARBINARY(64) NOT NULL,
    DeviceName NVARCHAR(150) NULL,
    IpAddress VARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_UserSessions_Created DEFAULT SYSUTCDATETIME(),
    ExpiresAtUtc DATETIME2(3) NOT NULL,
    RevokedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_UserSessions PRIMARY KEY (UserSessionId),
    CONSTRAINT FK_UserSessions_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_UserSessions_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_UserSessions_Expiry CHECK (ExpiresAtUtc>CreatedAtUtc)
);
GO
CREATE INDEX IX_UserSessions_User_Active ON security.UserSessions(UserId, ExpiresAtUtc) INCLUDE(RevokedAtUtc);
GO

CREATE TABLE security.EmailVerificationTokens
(
    EmailVerificationTokenId BIGINT IDENTITY(1,1) NOT NULL,
    UserId BIGINT NOT NULL,
    TokenHash VARBINARY(64) NOT NULL,
    ExpiresAtUtc DATETIME2(3) NOT NULL,
    ConsumedAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_EmailVerification_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_EmailVerificationTokens PRIMARY KEY (EmailVerificationTokenId),
    CONSTRAINT FK_EmailVerificationTokens_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId),
    CONSTRAINT UQ_EmailVerificationTokens_Hash UNIQUE (TokenHash)
);
GO

CREATE TABLE security.PasswordResetTokens
(
    PasswordResetTokenId BIGINT IDENTITY(1,1) NOT NULL,
    UserId BIGINT NOT NULL,
    TokenHash VARBINARY(64) NOT NULL,
    ExpiresAtUtc DATETIME2(3) NOT NULL,
    ConsumedAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PasswordReset_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PasswordResetTokens PRIMARY KEY (PasswordResetTokenId),
    CONSTRAINT FK_PasswordResetTokens_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId),
    CONSTRAINT UQ_PasswordResetTokens_Hash UNIQUE (TokenHash)
);
GO
