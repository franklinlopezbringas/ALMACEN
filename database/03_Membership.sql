/* GymFlow v1.0 - 03 Membership & Legal */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE membership.Plans
(
    PlanId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Plans_PublicId DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(120) NOT NULL,
    Description NVARCHAR(600) NULL,
    IsPublic BIT NOT NULL CONSTRAINT DF_Plans_IsPublic DEFAULT (1),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Plans_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Plans_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Plans_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Plans PRIMARY KEY (PlanId),
    CONSTRAINT UQ_Plans_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Plans_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_Plans_Org_Id UNIQUE (OrganizationId, PlanId),
    CONSTRAINT FK_Plans_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Plans_Status CHECK (Status IN ('ACTIVE','INACTIVE','ARCHIVED'))
);
GO

ALTER TABLE crm.Prospects
ADD CONSTRAINT FK_Prospects_InterestedPlan FOREIGN KEY (OrganizationId, InterestedPlanId)
REFERENCES membership.Plans(OrganizationId, PlanId);
GO

CREATE TABLE membership.PlanVersions
(
    PlanVersionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PlanId BIGINT NOT NULL,
    VersionNumber INT NOT NULL,
    Price DECIMAL(19,4) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    DurationValue INT NOT NULL,
    DurationUnit VARCHAR(10) NOT NULL,
    FreezeDaysLimit INT NOT NULL CONSTRAINT DF_PlanVersions_FreezeLimit DEFAULT (0),
    ClassReservationLimit INT NULL,
    ValidFrom DATE NOT NULL,
    ValidTo DATE NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_PlanVersions_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PlanVersions_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PlanVersions PRIMARY KEY (PlanVersionId),
    CONSTRAINT UQ_PlanVersions_Plan_Version UNIQUE (PlanId, VersionNumber),
    CONSTRAINT UQ_PlanVersions_Org_Id UNIQUE (OrganizationId, PlanVersionId),
    CONSTRAINT FK_PlanVersions_Plan FOREIGN KEY (OrganizationId, PlanId) REFERENCES membership.Plans(OrganizationId, PlanId),
    CONSTRAINT CK_PlanVersions_Price CHECK (Price>=0),
    CONSTRAINT CK_PlanVersions_DurationValue CHECK (DurationValue>0),
    CONSTRAINT CK_PlanVersions_DurationUnit CHECK (DurationUnit IN ('DAY','WEEK','MONTH','YEAR')),
    CONSTRAINT CK_PlanVersions_Freeze CHECK (FreezeDaysLimit>=0),
    CONSTRAINT CK_PlanVersions_Dates CHECK (ValidTo IS NULL OR ValidTo>=ValidFrom),
    CONSTRAINT CK_PlanVersions_Status CHECK (Status IN ('ACTIVE','INACTIVE','ARCHIVED'))
);
GO
CREATE INDEX IX_PlanVersions_Org_Status ON membership.PlanVersions(OrganizationId, Status, ValidFrom DESC);
GO

CREATE TABLE membership.PlanBenefits
(
    PlanBenefitId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(50) NOT NULL,
    Name NVARCHAR(120) NOT NULL,
    Description NVARCHAR(400) NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_PlanBenefits_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_PlanBenefits PRIMARY KEY (PlanBenefitId),
    CONSTRAINT UQ_PlanBenefits_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_PlanBenefits_Org_Id UNIQUE (OrganizationId, PlanBenefitId),
    CONSTRAINT FK_PlanBenefits_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId)
);
GO

CREATE TABLE membership.PlanVersionBenefits
(
    OrganizationId BIGINT NOT NULL,
    PlanVersionId BIGINT NOT NULL,
    PlanBenefitId BIGINT NOT NULL,
    ValueText NVARCHAR(200) NULL,
    CONSTRAINT PK_PlanVersionBenefits PRIMARY KEY (PlanVersionId, PlanBenefitId),
    CONSTRAINT FK_PlanVersionBenefits_Version FOREIGN KEY (OrganizationId, PlanVersionId) REFERENCES membership.PlanVersions(OrganizationId, PlanVersionId),
    CONSTRAINT FK_PlanVersionBenefits_Benefit FOREIGN KEY (OrganizationId, PlanBenefitId) REFERENCES membership.PlanBenefits(OrganizationId, PlanBenefitId)
);
GO

CREATE TABLE membership.Memberships
(
    MembershipId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Memberships_PublicId DEFAULT NEWSEQUENTIALID(),
    MemberId BIGINT NOT NULL,
    PlanVersionId BIGINT NOT NULL,
    HomeBranchId BIGINT NULL,
    PreviousMembershipId BIGINT NULL,
    SourceOrderId BIGINT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    ContractedPrice DECIMAL(19,4) NOT NULL,
    CurrencyCode CHAR(3) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Memberships_Status DEFAULT ('PENDING'),
    Origin VARCHAR(20) NOT NULL CONSTRAINT DF_Memberships_Origin DEFAULT ('RECEPTION'),
    CreatedByUserId BIGINT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Memberships_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Memberships_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Memberships PRIMARY KEY (MembershipId),
    CONSTRAINT UQ_Memberships_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Memberships_Org_Id UNIQUE (OrganizationId, MembershipId),
    CONSTRAINT FK_Memberships_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_Memberships_PlanVersion FOREIGN KEY (OrganizationId, PlanVersionId) REFERENCES membership.PlanVersions(OrganizationId, PlanVersionId),
    CONSTRAINT FK_Memberships_Branch FOREIGN KEY (OrganizationId, HomeBranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT FK_Memberships_Previous FOREIGN KEY (OrganizationId, PreviousMembershipId) REFERENCES membership.Memberships(OrganizationId, MembershipId),
    CONSTRAINT FK_Memberships_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_Memberships_Dates CHECK (EndDate>=StartDate),
    CONSTRAINT CK_Memberships_Price CHECK (ContractedPrice>=0),
    CONSTRAINT CK_Memberships_Status CHECK (Status IN ('PENDING','ACTIVE','FROZEN','EXPIRED','CANCELLED')),
    CONSTRAINT CK_Memberships_Origin CHECK (Origin IN ('WEB','RECEPTION','ADMIN','PROMOTION','MIGRATION'))
);
GO
CREATE INDEX IX_Memberships_Org_Status_EndDate ON membership.Memberships(OrganizationId, Status, EndDate) INCLUDE(MemberId, PlanVersionId);
GO
CREATE INDEX IX_Memberships_Org_Member_Dates ON membership.Memberships(OrganizationId, MemberId, StartDate DESC, EndDate DESC);
GO

CREATE TABLE membership.MembershipFreezes
(
    MembershipFreezeId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    MembershipId BIGINT NOT NULL,
    RequestedFrom DATE NOT NULL,
    RequestedTo DATE NOT NULL,
    EffectiveFrom DATE NULL,
    EffectiveTo DATE NULL,
    Reason NVARCHAR(500) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_MembershipFreezes_Status DEFAULT ('REQUESTED'),
    RequestedByUserId BIGINT NULL,
    ReviewedByUserId BIGINT NULL,
    RequestedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_MembershipFreezes_Requested DEFAULT SYSUTCDATETIME(),
    ReviewedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_MembershipFreezes PRIMARY KEY (MembershipFreezeId),
    CONSTRAINT FK_MembershipFreezes_Membership FOREIGN KEY (OrganizationId, MembershipId) REFERENCES membership.Memberships(OrganizationId, MembershipId),
    CONSTRAINT FK_MembershipFreezes_RequestedBy FOREIGN KEY (RequestedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_MembershipFreezes_ReviewedBy FOREIGN KEY (ReviewedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_MembershipFreezes_RequestedDates CHECK (RequestedTo>=RequestedFrom),
    CONSTRAINT CK_MembershipFreezes_EffectiveDates CHECK (EffectiveTo IS NULL OR EffectiveFrom IS NOT NULL AND EffectiveTo>=EffectiveFrom),
    CONSTRAINT CK_MembershipFreezes_Status CHECK (Status IN ('REQUESTED','APPROVED','REJECTED','CANCELLED','COMPLETED'))
);
GO

CREATE TABLE legal.LegalDocuments
(
    LegalDocumentId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(50) NOT NULL,
    DocumentType VARCHAR(30) NOT NULL,
    Name NVARCHAR(150) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_LegalDocuments_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_LegalDocuments PRIMARY KEY (LegalDocumentId),
    CONSTRAINT UQ_LegalDocuments_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_LegalDocuments_Org_Id UNIQUE (OrganizationId, LegalDocumentId),
    CONSTRAINT FK_LegalDocuments_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId)
);
GO

CREATE TABLE legal.LegalDocumentVersions
(
    LegalDocumentVersionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    LegalDocumentId BIGINT NOT NULL,
    Version NVARCHAR(30) NOT NULL,
    Content NVARCHAR(MAX) NULL,
    FileId BIGINT NULL,
    PublishedAtUtc DATETIME2(3) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_LegalDocumentVersions_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_LegalDocumentVersions PRIMARY KEY (LegalDocumentVersionId),
    CONSTRAINT UQ_LegalDocumentVersions_Doc_Version UNIQUE (LegalDocumentId, Version),
    CONSTRAINT UQ_LegalDocumentVersions_Org_Id UNIQUE (OrganizationId, LegalDocumentVersionId),
    CONSTRAINT FK_LegalDocumentVersions_Document FOREIGN KEY (OrganizationId, LegalDocumentId) REFERENCES legal.LegalDocuments(OrganizationId, LegalDocumentId),
    CONSTRAINT FK_LegalDocumentVersions_File FOREIGN KEY (OrganizationId, FileId) REFERENCES core.Files(OrganizationId, FileId),
    CONSTRAINT CK_LegalDocumentVersions_Content CHECK (Content IS NOT NULL OR FileId IS NOT NULL)
);
GO

CREATE TABLE legal.UserConsents
(
    UserConsentId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    UserId BIGINT NOT NULL,
    LegalDocumentVersionId BIGINT NOT NULL,
    Accepted BIT NOT NULL,
    AcceptedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_UserConsents_AcceptedAt DEFAULT SYSUTCDATETIME(),
    IpAddress VARCHAR(45) NULL,
    CONSTRAINT PK_UserConsents PRIMARY KEY (UserConsentId),
    CONSTRAINT UQ_UserConsents_User_Version UNIQUE (UserId, LegalDocumentVersionId),
    CONSTRAINT FK_UserConsents_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_UserConsents_Version FOREIGN KEY (OrganizationId, LegalDocumentVersionId) REFERENCES legal.LegalDocumentVersions(OrganizationId, LegalDocumentVersionId)
);
GO
