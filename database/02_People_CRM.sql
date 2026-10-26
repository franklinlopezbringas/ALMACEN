/* GymFlow v1.0 - 02 People & CRM */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE core.Files
(
    FileId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Files_PublicId DEFAULT NEWSEQUENTIALID(),
    FileType VARCHAR(30) NOT NULL,
    StorageProvider VARCHAR(30) NOT NULL,
    StorageKey NVARCHAR(500) NOT NULL,
    OriginalName NVARCHAR(260) NOT NULL,
    MimeType NVARCHAR(150) NOT NULL,
    SizeBytes BIGINT NOT NULL,
    ChecksumSha256 CHAR(64) NULL,
    UploadedByUserId BIGINT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Files_Created DEFAULT SYSUTCDATETIME(),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Files_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_Files PRIMARY KEY (FileId),
    CONSTRAINT UQ_Files_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Files_Org_Id UNIQUE (OrganizationId, FileId),
    CONSTRAINT FK_Files_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_Files_Uploader FOREIGN KEY (UploadedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_Files_Size CHECK (SizeBytes>=0),
    CONSTRAINT CK_Files_Status CHECK (Status IN ('ACTIVE','ARCHIVED','DELETED'))
);
GO
CREATE INDEX IX_Files_Org_Type_Created ON core.Files(OrganizationId, FileType, CreatedAtUtc DESC);
GO

CREATE TABLE core.People
(
    PersonId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_People_PublicId DEFAULT NEWSEQUENTIALID(),
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(150) NOT NULL,
    DocumentType VARCHAR(20) NULL,
    DocumentNumber NVARCHAR(40) NULL,
    BirthDate DATE NULL,
    Phone NVARCHAR(30) NULL,
    Email NVARCHAR(320) NULL,
    PhotoFileId BIGINT NULL,
    GenderCode VARCHAR(20) NULL,
    EmergencyContactName NVARCHAR(180) NULL,
    EmergencyContactPhone NVARCHAR(30) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_People_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_People_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_People PRIMARY KEY (PersonId),
    CONSTRAINT UQ_People_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_People_Org_Id UNIQUE (OrganizationId, PersonId),
    CONSTRAINT FK_People_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_People_Photo FOREIGN KEY (OrganizationId, PhotoFileId) REFERENCES core.Files(OrganizationId, FileId)
);
GO
CREATE UNIQUE INDEX UX_People_Org_Document ON core.People(OrganizationId, DocumentType, DocumentNumber)
WHERE DocumentNumber IS NOT NULL;
GO
CREATE INDEX IX_People_Org_Name ON core.People(OrganizationId, LastName, FirstName);
GO
CREATE INDEX IX_People_Org_Email ON core.People(OrganizationId, Email) WHERE Email IS NOT NULL;
GO

ALTER TABLE security.UserOrganizations
ADD CONSTRAINT FK_UserOrganizations_Person FOREIGN KEY (OrganizationId, PersonId)
REFERENCES core.People(OrganizationId, PersonId);
GO
CREATE UNIQUE INDEX UX_UserOrganizations_Org_Person ON security.UserOrganizations(OrganizationId, PersonId) WHERE PersonId IS NOT NULL;
GO

CREATE TABLE core.Employees
(
    EmployeeId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PersonId BIGINT NOT NULL,
    HomeBranchId BIGINT NULL,
    EmployeeCode NVARCHAR(30) NOT NULL,
    JobTitle NVARCHAR(100) NOT NULL,
    HireDate DATE NOT NULL,
    TerminationDate DATE NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Employees_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Employees_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Employees_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Employees PRIMARY KEY (EmployeeId),
    CONSTRAINT UQ_Employees_Org_Person UNIQUE (OrganizationId, PersonId),
    CONSTRAINT UQ_Employees_Org_Code UNIQUE (OrganizationId, EmployeeCode),
    CONSTRAINT UQ_Employees_Org_Id UNIQUE (OrganizationId, EmployeeId),
    CONSTRAINT FK_Employees_Person FOREIGN KEY (OrganizationId, PersonId) REFERENCES core.People(OrganizationId, PersonId),
    CONSTRAINT FK_Employees_HomeBranch FOREIGN KEY (OrganizationId, HomeBranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT CK_Employees_Status CHECK (Status IN ('ACTIVE','INACTIVE','TERMINATED')),
    CONSTRAINT CK_Employees_Dates CHECK (TerminationDate IS NULL OR TerminationDate>=HireDate)
);
GO

CREATE TABLE core.Members
(
    MemberId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Members_PublicId DEFAULT NEWSEQUENTIALID(),
    PersonId BIGINT NOT NULL,
    HomeBranchId BIGINT NULL,
    MemberCode NVARCHAR(30) NOT NULL,
    RegistrationDate DATE NOT NULL CONSTRAINT DF_Members_Registration DEFAULT CONVERT(date,SYSUTCDATETIME()),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Members_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Members_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Members_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Members PRIMARY KEY (MemberId),
    CONSTRAINT UQ_Members_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Members_Org_Person UNIQUE (OrganizationId, PersonId),
    CONSTRAINT UQ_Members_Org_Code UNIQUE (OrganizationId, MemberCode),
    CONSTRAINT UQ_Members_Org_Id UNIQUE (OrganizationId, MemberId),
    CONSTRAINT FK_Members_Person FOREIGN KEY (OrganizationId, PersonId) REFERENCES core.People(OrganizationId, PersonId),
    CONSTRAINT FK_Members_HomeBranch FOREIGN KEY (OrganizationId, HomeBranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT CK_Members_Status CHECK (Status IN ('ACTIVE','INACTIVE','BLOCKED','ARCHIVED'))
);
GO
CREATE INDEX IX_Members_Org_Status ON core.Members(OrganizationId, Status) INCLUDE(MemberCode, PersonId, HomeBranchId);
GO

CREATE TABLE crm.LeadSources
(
    LeadSourceId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_LeadSources_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_LeadSources PRIMARY KEY (LeadSourceId),
    CONSTRAINT UQ_LeadSources_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_LeadSources_Org_Id UNIQUE (OrganizationId, LeadSourceId),
    CONSTRAINT FK_LeadSources_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_LeadSources_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
);
GO

CREATE TABLE crm.Prospects
(
    ProspectId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PersonId BIGINT NOT NULL,
    LeadSourceId BIGINT NULL,
    InterestedPlanId BIGINT NULL,
    Status VARCHAR(30) NOT NULL CONSTRAINT DF_Prospects_Status DEFAULT ('NEW'),
    FirstContactAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Prospects_FirstContact DEFAULT SYSUTCDATETIME(),
    NextFollowUpAtUtc DATETIME2(3) NULL,
    ConvertedAtUtc DATETIME2(3) NULL,
    ConvertedMemberId BIGINT NULL,
    Notes NVARCHAR(1000) NULL,
    CreatedByUserId BIGINT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Prospects_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Prospects_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Prospects PRIMARY KEY (ProspectId),
    CONSTRAINT UQ_Prospects_Org_Id UNIQUE (OrganizationId, ProspectId),
    CONSTRAINT FK_Prospects_Person FOREIGN KEY (OrganizationId, PersonId) REFERENCES core.People(OrganizationId, PersonId),
    CONSTRAINT FK_Prospects_LeadSource FOREIGN KEY (OrganizationId, LeadSourceId) REFERENCES crm.LeadSources(OrganizationId, LeadSourceId),
    CONSTRAINT FK_Prospects_Member FOREIGN KEY (OrganizationId, ConvertedMemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_Prospects_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_Prospects_Status CHECK (Status IN ('NEW','CONTACTED','TRIAL_SCHEDULED','QUALIFIED','WON','LOST','ARCHIVED'))
);
GO
CREATE INDEX IX_Prospects_Org_Status_FollowUp ON crm.Prospects(OrganizationId, Status, NextFollowUpAtUtc);
GO

CREATE TABLE crm.ProspectActivities
(
    ProspectActivityId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProspectId BIGINT NOT NULL,
    ActivityType VARCHAR(30) NOT NULL,
    Notes NVARCHAR(1000) NULL,
    OccurredAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ProspectActivities_Occurred DEFAULT SYSUTCDATETIME(),
    CreatedByUserId BIGINT NULL,
    CONSTRAINT PK_ProspectActivities PRIMARY KEY (ProspectActivityId),
    CONSTRAINT FK_ProspectActivities_Prospect FOREIGN KEY (OrganizationId, ProspectId) REFERENCES crm.Prospects(OrganizationId, ProspectId),
    CONSTRAINT FK_ProspectActivities_User FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId)
);
GO
CREATE INDEX IX_ProspectActivities_Prospect_Date ON crm.ProspectActivities(OrganizationId, ProspectId, OccurredAtUtc DESC);
GO

CREATE TABLE crm.TrialVisits
(
    TrialVisitId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ProspectId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    ScheduledAtUtc DATETIME2(3) NOT NULL,
    Status VARCHAR(30) NOT NULL CONSTRAINT DF_TrialVisits_Status DEFAULT ('REQUESTED'),
    AttendedAtUtc DATETIME2(3) NULL,
    Notes NVARCHAR(500) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_TrialVisits_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_TrialVisits PRIMARY KEY (TrialVisitId),
    CONSTRAINT FK_TrialVisits_Prospect FOREIGN KEY (OrganizationId, ProspectId) REFERENCES crm.Prospects(OrganizationId, ProspectId),
    CONSTRAINT FK_TrialVisits_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT CK_TrialVisits_Status CHECK (Status IN ('REQUESTED','CONFIRMED','ATTENDED','NO_SHOW','CANCELLED','CONVERTED'))
);
GO
CREATE INDEX IX_TrialVisits_Branch_Scheduled ON crm.TrialVisits(OrganizationId, BranchId, ScheduledAtUtc, Status);
GO
