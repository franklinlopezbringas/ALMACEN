/* GymFlow v1.0 - 05 Access, Trainers, Workouts & Classes */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE access.Devices
(
    DeviceId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(120) NOT NULL,
    DeviceType VARCHAR(30) NOT NULL,
    Provider NVARCHAR(100) NULL,
    ExternalDeviceId NVARCHAR(150) NULL,
    LastSeenAtUtc DATETIME2(3) NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Devices_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_Devices PRIMARY KEY (DeviceId),
    CONSTRAINT UQ_Devices_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_Devices_Org_Id UNIQUE (OrganizationId, DeviceId),
    CONSTRAINT FK_Devices_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT CK_Devices_Type CHECK (DeviceType IN ('QR_READER','BIOMETRIC','PRINTER','PAYMENT_TERMINAL','OTHER')),
    CONSTRAINT CK_Devices_Status CHECK (Status IN ('ACTIVE','OFFLINE','MAINTENANCE','INACTIVE'))
);
GO

CREATE TABLE access.AccessCredentials
(
    AccessCredentialId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    CredentialType VARCHAR(20) NOT NULL,
    ExternalCredentialId NVARCHAR(200) NOT NULL,
    Provider NVARCHAR(100) NULL,
    IssuedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_AccessCredentials_Issued DEFAULT SYSUTCDATETIME(),
    ExpiresAtUtc DATETIME2(3) NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_AccessCredentials_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_AccessCredentials PRIMARY KEY (AccessCredentialId),
    CONSTRAINT UQ_AccessCredentials_Org_External UNIQUE (OrganizationId, CredentialType, ExternalCredentialId),
    CONSTRAINT FK_AccessCredentials_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT CK_AccessCredentials_Type CHECK (CredentialType IN ('QR','BIOMETRIC','CARD','PIN')),
    CONSTRAINT CK_AccessCredentials_Status CHECK (Status IN ('ACTIVE','REVOKED','EXPIRED'))
);
GO

CREATE TABLE access.AccessExceptions
(
    AccessExceptionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    Reason NVARCHAR(500) NOT NULL,
    ValidFromUtc DATETIME2(3) NOT NULL,
    ValidToUtc DATETIME2(3) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_AccessExceptions_Status DEFAULT ('REQUESTED'),
    RequestedByUserId BIGINT NOT NULL,
    ReviewedByUserId BIGINT NULL,
    RequestedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_AccessExceptions_Requested DEFAULT SYSUTCDATETIME(),
    ReviewedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_AccessExceptions PRIMARY KEY (AccessExceptionId),
    CONSTRAINT UQ_AccessExceptions_Org_Id UNIQUE (OrganizationId, AccessExceptionId),
    CONSTRAINT FK_AccessExceptions_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_AccessExceptions_RequestedBy FOREIGN KEY (RequestedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_AccessExceptions_ReviewedBy FOREIGN KEY (ReviewedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_AccessExceptions_Dates CHECK (ValidToUtc>ValidFromUtc),
    CONSTRAINT CK_AccessExceptions_Status CHECK (Status IN ('REQUESTED','APPROVED','REJECTED','REVOKED','EXPIRED'))
);
GO

CREATE TABLE access.AttendanceEvents
(
    AttendanceEventId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    EventType VARCHAR(10) NOT NULL,
    AccessMethod VARCHAR(20) NOT NULL,
    Result VARCHAR(20) NOT NULL,
    OccurredAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_AttendanceEvents_Occurred DEFAULT SYSUTCDATETIME(),
    AccessExceptionId BIGINT NULL,
    DeviceId BIGINT NULL,
    RegisteredByUserId BIGINT NULL,
    ReasonCode NVARCHAR(50) NULL,
    CONSTRAINT PK_AttendanceEvents PRIMARY KEY (AttendanceEventId),
    CONSTRAINT FK_AttendanceEvents_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT FK_AttendanceEvents_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_AttendanceEvents_Exception FOREIGN KEY (OrganizationId, AccessExceptionId) REFERENCES access.AccessExceptions(OrganizationId, AccessExceptionId),
    CONSTRAINT FK_AttendanceEvents_Device FOREIGN KEY (OrganizationId, DeviceId) REFERENCES access.Devices(OrganizationId, DeviceId),
    CONSTRAINT FK_AttendanceEvents_User FOREIGN KEY (RegisteredByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_AttendanceEvents_Type CHECK (EventType IN ('ENTRY','EXIT')),
    CONSTRAINT CK_AttendanceEvents_Method CHECK (AccessMethod IN ('QR','BIOMETRIC','CARD','MANUAL')),
    CONSTRAINT CK_AttendanceEvents_Result CHECK (Result IN ('ALLOWED','DENIED','EXCEPTION'))
);
GO
CREATE INDEX IX_AttendanceEvents_Member_Date ON access.AttendanceEvents(OrganizationId, MemberId, OccurredAtUtc DESC) INCLUDE(EventType, Result, BranchId);
GO
CREATE INDEX IX_AttendanceEvents_Branch_Date ON access.AttendanceEvents(OrganizationId, BranchId, OccurredAtUtc DESC) INCLUDE(MemberId, EventType, Result);
GO

CREATE TABLE training.TrainerProfiles
(
    TrainerProfileId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    EmployeeId BIGINT NOT NULL,
    ExperienceYears SMALLINT NULL,
    Modality VARCHAR(20) NOT NULL CONSTRAINT DF_TrainerProfiles_Modality DEFAULT ('BOTH'),
    Bio NVARCHAR(1000) NULL,
    CertificationSummary NVARCHAR(500) NULL,
    Languages NVARCHAR(250) NULL,
    IsPublic BIT NOT NULL CONSTRAINT DF_TrainerProfiles_Public DEFAULT (1),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_TrainerProfiles_Status DEFAULT ('ACTIVE'),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_TrainerProfiles PRIMARY KEY (TrainerProfileId),
    CONSTRAINT UQ_TrainerProfiles_Org_Employee UNIQUE (OrganizationId, EmployeeId),
    CONSTRAINT UQ_TrainerProfiles_Org_Id UNIQUE (OrganizationId, TrainerProfileId),
    CONSTRAINT FK_TrainerProfiles_Employee FOREIGN KEY (OrganizationId, EmployeeId) REFERENCES core.Employees(OrganizationId, EmployeeId),
    CONSTRAINT CK_TrainerProfiles_Experience CHECK (ExperienceYears IS NULL OR ExperienceYears>=0),
    CONSTRAINT CK_TrainerProfiles_Modality CHECK (Modality IN ('PERSONAL','GROUP','BOTH')),
    CONSTRAINT CK_TrainerProfiles_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
);
GO

CREATE TABLE training.TrainerSpecialties
(
    TrainerSpecialtyId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_TrainerSpecialties_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_TrainerSpecialties PRIMARY KEY (TrainerSpecialtyId),
    CONSTRAINT UQ_TrainerSpecialties_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_TrainerSpecialties_Org_Id UNIQUE (OrganizationId, TrainerSpecialtyId),
    CONSTRAINT FK_TrainerSpecialties_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId)
);
GO

CREATE TABLE training.TrainerSpecialtyLinks
(
    OrganizationId BIGINT NOT NULL,
    TrainerProfileId BIGINT NOT NULL,
    TrainerSpecialtyId BIGINT NOT NULL,
    CONSTRAINT PK_TrainerSpecialtyLinks PRIMARY KEY (TrainerProfileId, TrainerSpecialtyId),
    CONSTRAINT FK_TrainerSpecialtyLinks_Trainer FOREIGN KEY (OrganizationId, TrainerProfileId) REFERENCES training.TrainerProfiles(OrganizationId, TrainerProfileId),
    CONSTRAINT FK_TrainerSpecialtyLinks_Specialty FOREIGN KEY (OrganizationId, TrainerSpecialtyId) REFERENCES training.TrainerSpecialties(OrganizationId, TrainerSpecialtyId)
);
GO

CREATE TABLE training.TrainerMemberAssignments
(
    TrainerMemberAssignmentId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    TrainerProfileId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    AssignedFrom DATE NOT NULL,
    AssignedTo DATE NULL,
    IsPrimary BIT NOT NULL CONSTRAINT DF_TrainerMemberAssignments_Primary DEFAULT (1),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_TrainerMemberAssignments_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_TrainerMemberAssignments_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_TrainerMemberAssignments PRIMARY KEY (TrainerMemberAssignmentId),
    CONSTRAINT FK_TrainerMemberAssignments_Trainer FOREIGN KEY (OrganizationId, TrainerProfileId) REFERENCES training.TrainerProfiles(OrganizationId, TrainerProfileId),
    CONSTRAINT FK_TrainerMemberAssignments_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT CK_TrainerMemberAssignments_Dates CHECK (AssignedTo IS NULL OR AssignedTo>=AssignedFrom),
    CONSTRAINT CK_TrainerMemberAssignments_Status CHECK (Status IN ('ACTIVE','ENDED','CANCELLED'))
);
GO
CREATE UNIQUE INDEX UX_TrainerMemberAssignments_PrimaryActive ON training.TrainerMemberAssignments(OrganizationId, MemberId) WHERE IsPrimary=1 AND Status='ACTIVE';
GO

CREATE TABLE training.MuscleGroups
(
    MuscleGroupId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_MuscleGroups PRIMARY KEY (MuscleGroupId),
    CONSTRAINT UQ_MuscleGroups_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_MuscleGroups_Org_Id UNIQUE (OrganizationId, MuscleGroupId),
    CONSTRAINT FK_MuscleGroups_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId)
);
GO

CREATE TABLE training.Exercises
(
    ExerciseId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Exercises_PublicId DEFAULT NEWSEQUENTIALID(),
    MuscleGroupId BIGINT NULL,
    Name NVARCHAR(150) NOT NULL,
    Equipment NVARCHAR(150) NULL,
    Level VARCHAR(20) NULL,
    Instructions NVARCHAR(1500) NULL,
    MediaFileId BIGINT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Exercises_Status DEFAULT ('ACTIVE'),
    CreatedByUserId BIGINT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Exercises_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Exercises PRIMARY KEY (ExerciseId),
    CONSTRAINT UQ_Exercises_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Exercises_Org_Id UNIQUE (OrganizationId, ExerciseId),
    CONSTRAINT FK_Exercises_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_Exercises_MuscleGroup FOREIGN KEY (OrganizationId, MuscleGroupId) REFERENCES training.MuscleGroups(OrganizationId, MuscleGroupId),
    CONSTRAINT FK_Exercises_Media FOREIGN KEY (OrganizationId, MediaFileId) REFERENCES core.Files(OrganizationId, FileId),
    CONSTRAINT FK_Exercises_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_Exercises_Level CHECK (Level IS NULL OR Level IN ('BEGINNER','INTERMEDIATE','ADVANCED')),
    CONSTRAINT CK_Exercises_Status CHECK (Status IN ('ACTIVE','INACTIVE'))
);
GO
CREATE INDEX IX_Exercises_Org_Name ON training.Exercises(OrganizationId, Name);
GO

CREATE TABLE training.WorkoutTemplates
(
    WorkoutTemplateId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_WorkoutTemplates_PublicId DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(150) NOT NULL,
    Description NVARCHAR(600) NULL,
    DurationWeeks SMALLINT NULL,
    Level VARCHAR(20) NULL,
    CreatedByTrainerProfileId BIGINT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_WorkoutTemplates_Status DEFAULT ('ACTIVE'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_WorkoutTemplates_Created DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_WorkoutTemplates PRIMARY KEY (WorkoutTemplateId),
    CONSTRAINT UQ_WorkoutTemplates_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_WorkoutTemplates_Org_Id UNIQUE (OrganizationId, WorkoutTemplateId),
    CONSTRAINT FK_WorkoutTemplates_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_WorkoutTemplates_Trainer FOREIGN KEY (OrganizationId, CreatedByTrainerProfileId) REFERENCES training.TrainerProfiles(OrganizationId, TrainerProfileId),
    CONSTRAINT CK_WorkoutTemplates_Duration CHECK (DurationWeeks IS NULL OR DurationWeeks>0),
    CONSTRAINT CK_WorkoutTemplates_Status CHECK (Status IN ('ACTIVE','INACTIVE','ARCHIVED'))
);
GO

CREATE TABLE training.WorkoutTemplateDays
(
    WorkoutTemplateDayId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    WorkoutTemplateId BIGINT NOT NULL,
    DayNumber SMALLINT NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT PK_WorkoutTemplateDays PRIMARY KEY (WorkoutTemplateDayId),
    CONSTRAINT UQ_WorkoutTemplateDays_Template_Day UNIQUE (WorkoutTemplateId, DayNumber),
    CONSTRAINT UQ_WorkoutTemplateDays_Org_Id UNIQUE (OrganizationId, WorkoutTemplateDayId),
    CONSTRAINT FK_WorkoutTemplateDays_Template FOREIGN KEY (OrganizationId, WorkoutTemplateId) REFERENCES training.WorkoutTemplates(OrganizationId, WorkoutTemplateId),
    CONSTRAINT CK_WorkoutTemplateDays_Day CHECK (DayNumber>0)
);
GO

CREATE TABLE training.WorkoutTemplateExercises
(
    WorkoutTemplateExerciseId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    WorkoutTemplateDayId BIGINT NOT NULL,
    ExerciseId BIGINT NOT NULL,
    SortOrder SMALLINT NOT NULL,
    Sets SMALLINT NULL,
    Repetitions NVARCHAR(30) NULL,
    RestSeconds SMALLINT NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT PK_WorkoutTemplateExercises PRIMARY KEY (WorkoutTemplateExerciseId),
    CONSTRAINT UQ_WorkoutTemplateExercises_Org_Id UNIQUE (OrganizationId, WorkoutTemplateExerciseId),
    CONSTRAINT FK_WorkoutTemplateExercises_Day FOREIGN KEY (OrganizationId, WorkoutTemplateDayId) REFERENCES training.WorkoutTemplateDays(OrganizationId, WorkoutTemplateDayId),
    CONSTRAINT FK_WorkoutTemplateExercises_Exercise FOREIGN KEY (OrganizationId, ExerciseId) REFERENCES training.Exercises(OrganizationId, ExerciseId),
    CONSTRAINT CK_WorkoutTemplateExercises_Sort CHECK (SortOrder>0),
    CONSTRAINT CK_WorkoutTemplateExercises_Sets CHECK (Sets IS NULL OR Sets>0),
    CONSTRAINT CK_WorkoutTemplateExercises_Rest CHECK (RestSeconds IS NULL OR RestSeconds>=0)
);
GO

CREATE TABLE training.WorkoutAssignments
(
    WorkoutAssignmentId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    WorkoutTemplateId BIGINT NOT NULL,
    TrainerProfileId BIGINT NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_WorkoutAssignments_Status DEFAULT ('ACTIVE'),
    Notes NVARCHAR(500) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_WorkoutAssignments_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_WorkoutAssignments PRIMARY KEY (WorkoutAssignmentId),
    CONSTRAINT UQ_WorkoutAssignments_Org_Id UNIQUE (OrganizationId, WorkoutAssignmentId),
    CONSTRAINT FK_WorkoutAssignments_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_WorkoutAssignments_Template FOREIGN KEY (OrganizationId, WorkoutTemplateId) REFERENCES training.WorkoutTemplates(OrganizationId, WorkoutTemplateId),
    CONSTRAINT FK_WorkoutAssignments_Trainer FOREIGN KEY (OrganizationId, TrainerProfileId) REFERENCES training.TrainerProfiles(OrganizationId, TrainerProfileId),
    CONSTRAINT CK_WorkoutAssignments_Dates CHECK (EndDate IS NULL OR EndDate>=StartDate),
    CONSTRAINT CK_WorkoutAssignments_Status CHECK (Status IN ('ACTIVE','COMPLETED','CANCELLED'))
);
GO

CREATE TABLE training.WorkoutSessions
(
    WorkoutSessionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    WorkoutAssignmentId BIGINT NOT NULL,
    WorkoutTemplateDayId BIGINT NOT NULL,
    StartedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_WorkoutSessions_Started DEFAULT SYSUTCDATETIME(),
    CompletedAtUtc DATETIME2(3) NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_WorkoutSessions_Status DEFAULT ('IN_PROGRESS'),
    CONSTRAINT PK_WorkoutSessions PRIMARY KEY (WorkoutSessionId),
    CONSTRAINT UQ_WorkoutSessions_Org_Id UNIQUE (OrganizationId, WorkoutSessionId),
    CONSTRAINT FK_WorkoutSessions_Assignment FOREIGN KEY (OrganizationId, WorkoutAssignmentId) REFERENCES training.WorkoutAssignments(OrganizationId, WorkoutAssignmentId),
    CONSTRAINT FK_WorkoutSessions_Day FOREIGN KEY (OrganizationId, WorkoutTemplateDayId) REFERENCES training.WorkoutTemplateDays(OrganizationId, WorkoutTemplateDayId),
    CONSTRAINT CK_WorkoutSessions_Status CHECK (Status IN ('IN_PROGRESS','COMPLETED','ABANDONED'))
);
GO

CREATE TABLE training.ExerciseCompletions
(
    ExerciseCompletionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    WorkoutSessionId BIGINT NOT NULL,
    WorkoutTemplateExerciseId BIGINT NOT NULL,
    CompletedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ExerciseCompletions_Completed DEFAULT SYSUTCDATETIME(),
    ActualSets SMALLINT NULL,
    ActualRepetitions NVARCHAR(30) NULL,
    Notes NVARCHAR(300) NULL,
    CONSTRAINT PK_ExerciseCompletions PRIMARY KEY (ExerciseCompletionId),
    CONSTRAINT UQ_ExerciseCompletions_Session_Exercise UNIQUE (WorkoutSessionId, WorkoutTemplateExerciseId),
    CONSTRAINT FK_ExerciseCompletions_Session FOREIGN KEY (OrganizationId, WorkoutSessionId) REFERENCES training.WorkoutSessions(OrganizationId, WorkoutSessionId),
    CONSTRAINT FK_ExerciseCompletions_TemplateExercise FOREIGN KEY (OrganizationId, WorkoutTemplateExerciseId) REFERENCES training.WorkoutTemplateExercises(OrganizationId, WorkoutTemplateExerciseId)
);
GO

CREATE TABLE training.Assessments
(
    AssessmentId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    TrainerProfileId BIGINT NOT NULL,
    AssessedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Assessments_Assessed DEFAULT SYSUTCDATETIME(),
    MetricsJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Assessments_Metrics DEFAULT (N'{}'),
    VisibleNotes NVARCHAR(1000) NULL,
    PrivateNotes NVARCHAR(1000) NULL,
    CONSTRAINT PK_Assessments PRIMARY KEY (AssessmentId),
    CONSTRAINT FK_Assessments_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_Assessments_Trainer FOREIGN KEY (OrganizationId, TrainerProfileId) REFERENCES training.TrainerProfiles(OrganizationId, TrainerProfileId),
    CONSTRAINT CK_Assessments_Metrics CHECK (ISJSON(MetricsJson)=1)
);
GO

CREATE TABLE training.ProgressReviews
(
    ProgressReviewId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    TrainerProfileId BIGINT NOT NULL,
    Rating VARCHAR(30) NOT NULL,
    ProgressPercentage DECIMAL(5,2) NULL,
    VisibleComment NVARCHAR(1000) NULL,
    PrivateNote NVARCHAR(1000) NULL,
    Achievements NVARCHAR(700) NULL,
    NextGoal NVARCHAR(700) NULL,
    ReviewedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ProgressReviews_Reviewed DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ProgressReviews PRIMARY KEY (ProgressReviewId),
    CONSTRAINT FK_ProgressReviews_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_ProgressReviews_Trainer FOREIGN KEY (OrganizationId, TrainerProfileId) REFERENCES training.TrainerProfiles(OrganizationId, TrainerProfileId),
    CONSTRAINT CK_ProgressReviews_Rating CHECK (Rating IN ('NEEDS_ATTENTION','SLOW_PROGRESS','EXPECTED_PROGRESS','GOOD_PROGRESS','GOAL_REACHED')),
    CONSTRAINT CK_ProgressReviews_Percentage CHECK (ProgressPercentage IS NULL OR ProgressPercentage BETWEEN 0 AND 100)
);
GO
CREATE INDEX IX_ProgressReviews_Member_Date ON training.ProgressReviews(OrganizationId, MemberId, ReviewedAtUtc DESC);
GO

CREATE TABLE training.Classes
(
    ClassId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Classes_PublicId DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(120) NOT NULL,
    Description NVARCHAR(600) NULL,
    DefaultCapacity SMALLINT NOT NULL,
    DurationMinutes SMALLINT NOT NULL,
    IsPublic BIT NOT NULL CONSTRAINT DF_Classes_Public DEFAULT (1),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Classes_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_Classes PRIMARY KEY (ClassId),
    CONSTRAINT UQ_Classes_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Classes_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_Classes_Org_Id UNIQUE (OrganizationId, ClassId),
    CONSTRAINT FK_Classes_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Classes_Capacity CHECK (DefaultCapacity>0),
    CONSTRAINT CK_Classes_Duration CHECK (DurationMinutes>0),
    CONSTRAINT CK_Classes_Status CHECK (Status IN ('ACTIVE','INACTIVE','ARCHIVED'))
);
GO

CREATE TABLE training.ClassSessions
(
    ClassSessionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ClassId BIGINT NOT NULL,
    BranchId BIGINT NOT NULL,
    TrainerProfileId BIGINT NULL,
    RoomName NVARCHAR(100) NULL,
    StartsAtUtc DATETIME2(3) NOT NULL,
    EndsAtUtc DATETIME2(3) NOT NULL,
    Capacity SMALLINT NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_ClassSessions_Status DEFAULT ('SCHEDULED'),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_ClassSessions PRIMARY KEY (ClassSessionId),
    CONSTRAINT UQ_ClassSessions_Org_Id UNIQUE (OrganizationId, ClassSessionId),
    CONSTRAINT FK_ClassSessions_Class FOREIGN KEY (OrganizationId, ClassId) REFERENCES training.Classes(OrganizationId, ClassId),
    CONSTRAINT FK_ClassSessions_Branch FOREIGN KEY (OrganizationId, BranchId) REFERENCES core.Branches(OrganizationId, BranchId),
    CONSTRAINT FK_ClassSessions_Trainer FOREIGN KEY (OrganizationId, TrainerProfileId) REFERENCES training.TrainerProfiles(OrganizationId, TrainerProfileId),
    CONSTRAINT CK_ClassSessions_Dates CHECK (EndsAtUtc>StartsAtUtc),
    CONSTRAINT CK_ClassSessions_Capacity CHECK (Capacity>0),
    CONSTRAINT CK_ClassSessions_Status CHECK (Status IN ('SCHEDULED','OPEN','COMPLETED','CANCELLED'))
);
GO
CREATE INDEX IX_ClassSessions_Branch_Start ON training.ClassSessions(OrganizationId, BranchId, StartsAtUtc) INCLUDE(ClassId, Capacity, Status);
GO

CREATE TABLE training.ClassReservations
(
    ClassReservationId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ClassSessionId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_ClassReservations_Status DEFAULT ('CONFIRMED'),
    WaitlistPosition INT NULL,
    Source VARCHAR(20) NOT NULL CONSTRAINT DF_ClassReservations_Source DEFAULT ('MEMBER_APP'),
    ReservedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ClassReservations_Reserved DEFAULT SYSUTCDATETIME(),
    CancelledAtUtc DATETIME2(3) NULL,
    AttendedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_ClassReservations PRIMARY KEY (ClassReservationId),
    CONSTRAINT UQ_ClassReservations_Session_Member UNIQUE (ClassSessionId, MemberId),
    CONSTRAINT FK_ClassReservations_Session FOREIGN KEY (OrganizationId, ClassSessionId) REFERENCES training.ClassSessions(OrganizationId, ClassSessionId),
    CONSTRAINT FK_ClassReservations_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT CK_ClassReservations_Status CHECK (Status IN ('CONFIRMED','WAITLISTED','CANCELLED','ATTENDED','NO_SHOW')),
    CONSTRAINT CK_ClassReservations_Source CHECK (Source IN ('MEMBER_APP','RECEPTION','ADMIN','WALK_IN')),
    CONSTRAINT CK_ClassReservations_Waitlist CHECK ((Status='WAITLISTED' AND WaitlistPosition IS NOT NULL AND WaitlistPosition>0) OR Status<>'WAITLISTED')
);
GO
CREATE INDEX IX_ClassReservations_Session_Status ON training.ClassReservations(OrganizationId, ClassSessionId, Status) INCLUDE(MemberId, WaitlistPosition);
GO
