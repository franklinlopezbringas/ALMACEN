/* GymFlow v1.0 - 08 Automation, RPA, Documents & AI */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE automation.Automations
(
    AutomationId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Automations_PublicId DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(60) NOT NULL,
    Name NVARCHAR(150) NOT NULL,
    AutomationType VARCHAR(30) NOT NULL,
    ConfigurationJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Automations_Config DEFAULT (N'{}'),
    IsEnabled BIT NOT NULL CONSTRAINT DF_Automations_Enabled DEFAULT (1),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Automations_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Automations_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Automations PRIMARY KEY (AutomationId),
    CONSTRAINT UQ_Automations_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Automations_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_Automations_Org_Id UNIQUE (OrganizationId, AutomationId),
    CONSTRAINT FK_Automations_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Automations_Type CHECK (AutomationType IN ('SCHEDULED','EVENT','MANUAL','RPA')),
    CONSTRAINT CK_Automations_Config CHECK (ISJSON(ConfigurationJson)=1)
);
GO

CREATE TABLE automation.Jobs
(
    JobId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Jobs_PublicId DEFAULT NEWSEQUENTIALID(),
    AutomationId BIGINT NULL,
    JobType NVARCHAR(60) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Jobs_Payload DEFAULT (N'{}'),
    Priority TINYINT NOT NULL CONSTRAINT DF_Jobs_Priority DEFAULT (5),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Jobs_Status DEFAULT ('PENDING'),
    AvailableAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Jobs_Available DEFAULT SYSUTCDATETIME(),
    Attempts SMALLINT NOT NULL CONSTRAINT DF_Jobs_Attempts DEFAULT (0),
    MaxAttempts SMALLINT NOT NULL CONSTRAINT DF_Jobs_MaxAttempts DEFAULT (3),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Jobs_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Jobs_Updated DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Jobs PRIMARY KEY (JobId),
    CONSTRAINT UQ_Jobs_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Jobs_Org_Id UNIQUE (OrganizationId, JobId),
    CONSTRAINT FK_Jobs_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_Jobs_Automation FOREIGN KEY (OrganizationId, AutomationId) REFERENCES automation.Automations(OrganizationId, AutomationId),
    CONSTRAINT CK_Jobs_Payload CHECK (ISJSON(PayloadJson)=1),
    CONSTRAINT CK_Jobs_Priority CHECK (Priority BETWEEN 1 AND 10),
    CONSTRAINT CK_Jobs_Attempts CHECK (Attempts>=0 AND MaxAttempts>0 AND Attempts<=MaxAttempts),
    CONSTRAINT CK_Jobs_Status CHECK (Status IN ('PENDING','QUEUED','RUNNING','COMPLETED','OBSERVED','FAILED','RETRY','CANCELLED'))
);
GO
CREATE INDEX IX_Jobs_Queue ON automation.Jobs(Status, AvailableAtUtc, Priority) INCLUDE(OrganizationId, JobType, Attempts, MaxAttempts);
GO

CREATE TABLE automation.Executions
(
    ExecutionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    JobId BIGINT NOT NULL,
    WorkerId NVARCHAR(120) NULL,
    StartedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Executions_Started DEFAULT SYSUTCDATETIME(),
    FinishedAtUtc DATETIME2(3) NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Executions_Status DEFAULT ('RUNNING'),
    ResultJson NVARCHAR(MAX) NULL,
    ErrorCode NVARCHAR(80) NULL,
    ErrorMessage NVARCHAR(2000) NULL,
    CONSTRAINT PK_Executions PRIMARY KEY (ExecutionId),
    CONSTRAINT UQ_Executions_Org_Id UNIQUE (OrganizationId, ExecutionId),
    CONSTRAINT FK_Executions_Job FOREIGN KEY (OrganizationId, JobId) REFERENCES automation.Jobs(OrganizationId, JobId),
    CONSTRAINT CK_Executions_Result CHECK (ResultJson IS NULL OR ISJSON(ResultJson)=1),
    CONSTRAINT CK_Executions_Status CHECK (Status IN ('RUNNING','COMPLETED','OBSERVED','FAILED','CANCELLED'))
);
GO
CREATE INDEX IX_Executions_Job_Date ON automation.Executions(OrganizationId, JobId, StartedAtUtc DESC);
GO

CREATE TABLE automation.ExecutionLogs
(
    ExecutionLogId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ExecutionId BIGINT NOT NULL,
    LogLevel VARCHAR(10) NOT NULL,
    Message NVARCHAR(2000) NOT NULL,
    DataJson NVARCHAR(MAX) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ExecutionLogs_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ExecutionLogs PRIMARY KEY (ExecutionLogId),
    CONSTRAINT FK_ExecutionLogs_Execution FOREIGN KEY (OrganizationId, ExecutionId) REFERENCES automation.Executions(OrganizationId, ExecutionId),
    CONSTRAINT CK_ExecutionLogs_Level CHECK (LogLevel IN ('TRACE','DEBUG','INFO','WARN','ERROR')),
    CONSTRAINT CK_ExecutionLogs_Data CHECK (DataJson IS NULL OR ISJSON(DataJson)=1)
);
GO
CREATE INDEX IX_ExecutionLogs_Execution_Date ON automation.ExecutionLogs(OrganizationId, ExecutionId, CreatedAtUtc);
GO

CREATE TABLE ai.Documents
(
    DocumentId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AiDocuments_PublicId DEFAULT NEWSEQUENTIALID(),
    FileId BIGINT NOT NULL,
    DocumentType VARCHAR(40) NOT NULL,
    RelatedEntityType NVARCHAR(50) NULL,
    RelatedEntityId BIGINT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_AiDocuments_Status DEFAULT ('PENDING'),
    UploadedByUserId BIGINT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_AiDocuments_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_AiDocuments PRIMARY KEY (DocumentId),
    CONSTRAINT UQ_AiDocuments_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_AiDocuments_Org_Id UNIQUE (OrganizationId, DocumentId),
    CONSTRAINT FK_AiDocuments_File FOREIGN KEY (OrganizationId, FileId) REFERENCES core.Files(OrganizationId, FileId),
    CONSTRAINT FK_AiDocuments_User FOREIGN KEY (UploadedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_AiDocuments_Status CHECK (Status IN ('PENDING','PROCESSING','PROCESSED','REVIEW_REQUIRED','FAILED','ARCHIVED'))
);
GO

CREATE TABLE ai.DocumentProcessings
(
    DocumentProcessingId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    DocumentId BIGINT NOT NULL,
    Processor NVARCHAR(100) NOT NULL,
    ModelName NVARCHAR(150) NULL,
    ResultJson NVARCHAR(MAX) NULL,
    Confidence DECIMAL(5,4) NULL,
    RequiresReview BIT NOT NULL CONSTRAINT DF_DocumentProcessings_Review DEFAULT (0),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_DocumentProcessings_Status DEFAULT ('PROCESSING'),
    StartedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_DocumentProcessings_Started DEFAULT SYSUTCDATETIME(),
    FinishedAtUtc DATETIME2(3) NULL,
    ErrorMessage NVARCHAR(2000) NULL,
    CONSTRAINT PK_DocumentProcessings PRIMARY KEY (DocumentProcessingId),
    CONSTRAINT FK_DocumentProcessings_Document FOREIGN KEY (OrganizationId, DocumentId) REFERENCES ai.Documents(OrganizationId, DocumentId),
    CONSTRAINT CK_DocumentProcessings_Result CHECK (ResultJson IS NULL OR ISJSON(ResultJson)=1),
    CONSTRAINT CK_DocumentProcessings_Confidence CHECK (Confidence IS NULL OR Confidence BETWEEN 0 AND 1),
    CONSTRAINT CK_DocumentProcessings_Status CHECK (Status IN ('PROCESSING','PROCESSED','REVIEW_REQUIRED','FAILED'))
);
GO

CREATE TABLE ai.AiConversations
(
    AiConversationId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AiConversations_PublicId DEFAULT NEWSEQUENTIALID(),
    UserId BIGINT NOT NULL,
    ContextType VARCHAR(30) NOT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_AiConversations_Created DEFAULT SYSUTCDATETIME(),
    ClosedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_AiConversations PRIMARY KEY (AiConversationId),
    CONSTRAINT UQ_AiConversations_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_AiConversations_Org_Id UNIQUE (OrganizationId, AiConversationId),
    CONSTRAINT FK_AiConversations_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_AiConversations_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_AiConversations_Context CHECK (ContextType IN ('ADMIN','TRAINER','MEMBER','SUPPORT'))
);
GO

CREATE TABLE ai.AiMessages
(
    AiMessageId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    AiConversationId BIGINT NOT NULL,
    Role VARCHAR(20) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    MetadataJson NVARCHAR(MAX) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_AiMessages_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_AiMessages PRIMARY KEY (AiMessageId),
    CONSTRAINT FK_AiMessages_Conversation FOREIGN KEY (OrganizationId, AiConversationId) REFERENCES ai.AiConversations(OrganizationId, AiConversationId),
    CONSTRAINT CK_AiMessages_Role CHECK (Role IN ('USER','ASSISTANT','SYSTEM','TOOL')),
    CONSTRAINT CK_AiMessages_Metadata CHECK (MetadataJson IS NULL OR ISJSON(MetadataJson)=1)
);
GO
CREATE INDEX IX_AiMessages_Conversation_Date ON ai.AiMessages(OrganizationId, AiConversationId, CreatedAtUtc);
GO

CREATE TABLE ai.AiActions
(
    AiActionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    AiConversationId BIGINT NOT NULL,
    RequestedByUserId BIGINT NOT NULL,
    ActionType NVARCHAR(80) NOT NULL,
    TargetEntityType NVARCHAR(50) NULL,
    TargetEntityId BIGINT NULL,
    ParametersJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_AiActions_Params DEFAULT (N'{}'),
    RiskLevel VARCHAR(10) NOT NULL CONSTRAINT DF_AiActions_Risk DEFAULT ('LOW'),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_AiActions_Status DEFAULT ('PROPOSED'),
    ApprovedByUserId BIGINT NULL,
    ProposedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_AiActions_Proposed DEFAULT SYSUTCDATETIME(),
    ApprovedAtUtc DATETIME2(3) NULL,
    ExecutedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_AiActions PRIMARY KEY (AiActionId),
    CONSTRAINT FK_AiActions_Conversation FOREIGN KEY (OrganizationId, AiConversationId) REFERENCES ai.AiConversations(OrganizationId, AiConversationId),
    CONSTRAINT FK_AiActions_RequestedBy FOREIGN KEY (RequestedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_AiActions_ApprovedBy FOREIGN KEY (ApprovedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_AiActions_Params CHECK (ISJSON(ParametersJson)=1),
    CONSTRAINT CK_AiActions_Risk CHECK (RiskLevel IN ('LOW','MEDIUM','HIGH')),
    CONSTRAINT CK_AiActions_Status CHECK (Status IN ('PROPOSED','APPROVED','REJECTED','EXECUTED','FAILED','CANCELLED'))
);
GO
