/* GymFlow v1.0 - 07 Loyalty, Promotions & Communication */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

CREATE TABLE loyalty.Promotions
(
    PromotionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Promotions_PublicId DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(150) NOT NULL,
    Description NVARCHAR(600) NULL,
    DiscountType VARCHAR(20) NOT NULL,
    DiscountValue DECIMAL(19,4) NOT NULL,
    StartsAtUtc DATETIME2(3) NOT NULL,
    EndsAtUtc DATETIME2(3) NOT NULL,
    Visibility VARCHAR(30) NOT NULL CONSTRAINT DF_Promotions_Visibility DEFAULT ('ALL'),
    RulesJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Promotions_Rules DEFAULT (N'{}'),
    UsageLimit INT NULL,
    PerUserLimit INT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Promotions_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_Promotions PRIMARY KEY (PromotionId),
    CONSTRAINT UQ_Promotions_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Promotions_Org_Id UNIQUE (OrganizationId, PromotionId),
    CONSTRAINT FK_Promotions_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Promotions_Type CHECK (DiscountType IN ('PERCENT','FIXED','BENEFIT')),
    CONSTRAINT CK_Promotions_Value CHECK (DiscountValue>=0),
    CONSTRAINT CK_Promotions_Dates CHECK (EndsAtUtc>StartsAtUtc),
    CONSTRAINT CK_Promotions_Visibility CHECK (Visibility IN ('ALL','PUBLIC_WEB','MEMBER_PORTAL','RECEPTION')),
    CONSTRAINT CK_Promotions_Rules CHECK (ISJSON(RulesJson)=1),
    CONSTRAINT CK_Promotions_Limits CHECK ((UsageLimit IS NULL OR UsageLimit>0) AND (PerUserLimit IS NULL OR PerUserLimit>0)),
    CONSTRAINT CK_Promotions_Status CHECK (Status IN ('ACTIVE','INACTIVE','EXPIRED','ARCHIVED'))
);
GO

CREATE TABLE loyalty.PromotionCodes
(
    PromotionCodeId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PromotionId BIGINT NOT NULL,
    Code NVARCHAR(60) NOT NULL,
    UsageLimit INT NULL,
    UsedCount INT NOT NULL CONSTRAINT DF_PromotionCodes_Used DEFAULT (0),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_PromotionCodes_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_PromotionCodes PRIMARY KEY (PromotionCodeId),
    CONSTRAINT UQ_PromotionCodes_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT FK_PromotionCodes_Promotion FOREIGN KEY (OrganizationId, PromotionId) REFERENCES loyalty.Promotions(OrganizationId, PromotionId),
    CONSTRAINT CK_PromotionCodes_Usage CHECK ((UsageLimit IS NULL OR UsageLimit>0) AND UsedCount>=0),
    CONSTRAINT CK_PromotionCodes_Status CHECK (Status IN ('ACTIVE','INACTIVE','EXHAUSTED'))
);
GO

CREATE TABLE loyalty.PointAccounts
(
    PointAccountId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    CurrentBalance INT NOT NULL CONSTRAINT DF_PointAccounts_Balance DEFAULT (0),
    LifetimeEarned INT NOT NULL CONSTRAINT DF_PointAccounts_Earned DEFAULT (0),
    LifetimeRedeemed INT NOT NULL CONSTRAINT DF_PointAccounts_Redeemed DEFAULT (0),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_PointAccounts PRIMARY KEY (PointAccountId),
    CONSTRAINT UQ_PointAccounts_Org_Member UNIQUE (OrganizationId, MemberId),
    CONSTRAINT UQ_PointAccounts_Org_Id UNIQUE (OrganizationId, PointAccountId),
    CONSTRAINT FK_PointAccounts_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT CK_PointAccounts_Balances CHECK (CurrentBalance>=0 AND LifetimeEarned>=0 AND LifetimeRedeemed>=0)
);
GO

CREATE TABLE loyalty.PointTransactions
(
    PointTransactionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PointAccountId BIGINT NOT NULL,
    TransactionType VARCHAR(20) NOT NULL,
    Points INT NOT NULL,
    ReasonCode NVARCHAR(60) NOT NULL,
    Description NVARCHAR(250) NULL,
    ReferenceType NVARCHAR(40) NULL,
    ReferenceId BIGINT NULL,
    ExpiresAtUtc DATETIME2(3) NULL,
    CreatedByUserId BIGINT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_PointTransactions_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PointTransactions PRIMARY KEY (PointTransactionId),
    CONSTRAINT FK_PointTransactions_Account FOREIGN KEY (OrganizationId, PointAccountId) REFERENCES loyalty.PointAccounts(OrganizationId, PointAccountId),
    CONSTRAINT FK_PointTransactions_User FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_PointTransactions_Type CHECK (TransactionType IN ('EARN','REDEEM','ADJUSTMENT_IN','ADJUSTMENT_OUT','EXPIRE')),
    CONSTRAINT CK_PointTransactions_Points CHECK (Points>0)
);
GO
CREATE INDEX IX_PointTransactions_Account_Date ON loyalty.PointTransactions(OrganizationId, PointAccountId, CreatedAtUtc DESC);
GO

CREATE TABLE loyalty.Challenges
(
    ChallengeId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Challenges_PublicId DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(150) NOT NULL,
    Description NVARCHAR(600) NULL,
    ChallengeType VARCHAR(30) NOT NULL,
    TargetValue DECIMAL(18,3) NOT NULL,
    RewardPoints INT NOT NULL CONSTRAINT DF_Challenges_Reward DEFAULT (0),
    StartsAtUtc DATETIME2(3) NOT NULL,
    EndsAtUtc DATETIME2(3) NOT NULL,
    RulesJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Challenges_Rules DEFAULT (N'{}'),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Challenges_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_Challenges PRIMARY KEY (ChallengeId),
    CONSTRAINT UQ_Challenges_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Challenges_Org_Id UNIQUE (OrganizationId, ChallengeId),
    CONSTRAINT FK_Challenges_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Challenges_Target CHECK (TargetValue>0),
    CONSTRAINT CK_Challenges_Reward CHECK (RewardPoints>=0),
    CONSTRAINT CK_Challenges_Dates CHECK (EndsAtUtc>StartsAtUtc),
    CONSTRAINT CK_Challenges_Rules CHECK (ISJSON(RulesJson)=1),
    CONSTRAINT CK_Challenges_Status CHECK (Status IN ('DRAFT','ACTIVE','COMPLETED','CANCELLED','ARCHIVED'))
);
GO

CREATE TABLE loyalty.ChallengeParticipations
(
    ChallengeParticipationId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ChallengeId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    CurrentValue DECIMAL(18,3) NOT NULL CONSTRAINT DF_ChallengeParticipations_Value DEFAULT (0),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_ChallengeParticipations_Status DEFAULT ('ACTIVE'),
    JoinedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ChallengeParticipations_Joined DEFAULT SYSUTCDATETIME(),
    CompletedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_ChallengeParticipations PRIMARY KEY (ChallengeParticipationId),
    CONSTRAINT UQ_ChallengeParticipations_Challenge_Member UNIQUE (ChallengeId, MemberId),
    CONSTRAINT FK_ChallengeParticipations_Challenge FOREIGN KEY (OrganizationId, ChallengeId) REFERENCES loyalty.Challenges(OrganizationId, ChallengeId),
    CONSTRAINT FK_ChallengeParticipations_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT CK_ChallengeParticipations_Value CHECK (CurrentValue>=0),
    CONSTRAINT CK_ChallengeParticipations_Status CHECK (Status IN ('ACTIVE','COMPLETED','FAILED','CANCELLED'))
);
GO

CREATE TABLE loyalty.Games
(
    GameId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(120) NOT NULL,
    GameType VARCHAR(30) NOT NULL,
    RulesJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Games_Rules DEFAULT (N'{}'),
    DailyPlayLimit SMALLINT NOT NULL CONSTRAINT DF_Games_DailyLimit DEFAULT (1),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Games_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_Games PRIMARY KEY (GameId),
    CONSTRAINT UQ_Games_Org_Code UNIQUE (OrganizationId, Code),
    CONSTRAINT UQ_Games_Org_Id UNIQUE (OrganizationId, GameId),
    CONSTRAINT FK_Games_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Games_Rules CHECK (ISJSON(RulesJson)=1),
    CONSTRAINT CK_Games_Limit CHECK (DailyPlayLimit>0),
    CONSTRAINT CK_Games_Status CHECK (Status IN ('ACTIVE','INACTIVE','ARCHIVED'))
);
GO

CREATE TABLE loyalty.GamePlays
(
    GamePlayId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    GameId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    PointsAwarded INT NOT NULL CONSTRAINT DF_GamePlays_Points DEFAULT (0),
    ResultJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_GamePlays_Result DEFAULT (N'{}'),
    PlayedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_GamePlays_Played DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_GamePlays PRIMARY KEY (GamePlayId),
    CONSTRAINT FK_GamePlays_Game FOREIGN KEY (OrganizationId, GameId) REFERENCES loyalty.Games(OrganizationId, GameId),
    CONSTRAINT FK_GamePlays_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT CK_GamePlays_Points CHECK (PointsAwarded>=0),
    CONSTRAINT CK_GamePlays_Result CHECK (ISJSON(ResultJson)=1)
);
GO
CREATE INDEX IX_GamePlays_Member_Date ON loyalty.GamePlays(OrganizationId, MemberId, PlayedAtUtc DESC);
GO

CREATE TABLE loyalty.Rewards
(
    RewardId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Rewards_PublicId DEFAULT NEWSEQUENTIALID(),
    ProductId BIGINT NULL,
    RewardType VARCHAR(20) NOT NULL,
    Name NVARCHAR(150) NOT NULL,
    Description NVARCHAR(500) NULL,
    PointsCost INT NOT NULL,
    StockLimit INT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Rewards_Status DEFAULT ('ACTIVE'),
    CONSTRAINT PK_Rewards PRIMARY KEY (RewardId),
    CONSTRAINT UQ_Rewards_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Rewards_Org_Id UNIQUE (OrganizationId, RewardId),
    CONSTRAINT FK_Rewards_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_Rewards_Product FOREIGN KEY (OrganizationId, ProductId) REFERENCES commerce.Products(OrganizationId, ProductId),
    CONSTRAINT CK_Rewards_Type CHECK (RewardType IN ('PRODUCT','SERVICE','DISCOUNT','BENEFIT')),
    CONSTRAINT CK_Rewards_Points CHECK (PointsCost>0),
    CONSTRAINT CK_Rewards_Stock CHECK (StockLimit IS NULL OR StockLimit>=0),
    CONSTRAINT CK_Rewards_ProductLink CHECK ((RewardType='PRODUCT' AND ProductId IS NOT NULL) OR RewardType<>'PRODUCT'),
    CONSTRAINT CK_Rewards_Status CHECK (Status IN ('ACTIVE','INACTIVE','ARCHIVED'))
);
GO

CREATE TABLE loyalty.RewardRedemptions
(
    RewardRedemptionId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    RewardId BIGINT NOT NULL,
    MemberId BIGINT NOT NULL,
    PointsSpent INT NOT NULL,
    RedemptionCode NVARCHAR(40) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_RewardRedemptions_Status DEFAULT ('PENDING'),
    RequestedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_RewardRedemptions_Requested DEFAULT SYSUTCDATETIME(),
    FulfilledAtUtc DATETIME2(3) NULL,
    FulfilledByUserId BIGINT NULL,
    CONSTRAINT PK_RewardRedemptions PRIMARY KEY (RewardRedemptionId),
    CONSTRAINT UQ_RewardRedemptions_Org_Code UNIQUE (OrganizationId, RedemptionCode),
    CONSTRAINT FK_RewardRedemptions_Reward FOREIGN KEY (OrganizationId, RewardId) REFERENCES loyalty.Rewards(OrganizationId, RewardId),
    CONSTRAINT FK_RewardRedemptions_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_RewardRedemptions_FulfilledBy FOREIGN KEY (FulfilledByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_RewardRedemptions_Points CHECK (PointsSpent>0),
    CONSTRAINT CK_RewardRedemptions_Status CHECK (Status IN ('PENDING','FULFILLED','CANCELLED','EXPIRED'))
);
GO

CREATE TABLE loyalty.Referrals
(
    ReferralId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ReferrerMemberId BIGINT NOT NULL,
    ReferredProspectId BIGINT NOT NULL,
    ReferredMemberId BIGINT NULL,
    ReferralCode NVARCHAR(40) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Referrals_Status DEFAULT ('PENDING'),
    RewardPoints INT NOT NULL CONSTRAINT DF_Referrals_Reward DEFAULT (0),
    QualifiedAtUtc DATETIME2(3) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Referrals_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Referrals PRIMARY KEY (ReferralId),
    CONSTRAINT UQ_Referrals_Org_Code UNIQUE (OrganizationId, ReferralCode),
    CONSTRAINT FK_Referrals_Referrer FOREIGN KEY (OrganizationId, ReferrerMemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT FK_Referrals_Prospect FOREIGN KEY (OrganizationId, ReferredProspectId) REFERENCES crm.Prospects(OrganizationId, ProspectId),
    CONSTRAINT FK_Referrals_Member FOREIGN KEY (OrganizationId, ReferredMemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT CK_Referrals_Reward CHECK (RewardPoints>=0),
    CONSTRAINT CK_Referrals_Status CHECK (Status IN ('PENDING','QUALIFIED','REWARDED','CANCELLED'))
);
GO

CREATE TABLE communication.Conversations
(
    ConversationId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Conversations_PublicId DEFAULT NEWSEQUENTIALID(),
    ConversationType VARCHAR(20) NOT NULL,
    Subject NVARCHAR(200) NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Conversations_Created DEFAULT SYSUTCDATETIME(),
    ClosedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_Conversations PRIMARY KEY (ConversationId),
    CONSTRAINT UQ_Conversations_PublicId UNIQUE (PublicId),
    CONSTRAINT UQ_Conversations_Org_Id UNIQUE (OrganizationId, ConversationId),
    CONSTRAINT FK_Conversations_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT CK_Conversations_Type CHECK (ConversationType IN ('MEMBER_TRAINER','MEMBER_RECEPTION','SUPPORT','INTERNAL'))
);
GO

CREATE TABLE communication.ConversationParticipants
(
    OrganizationId BIGINT NOT NULL,
    ConversationId BIGINT NOT NULL,
    UserId BIGINT NOT NULL,
    JoinedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_ConversationParticipants_Joined DEFAULT SYSUTCDATETIME(),
    LeftAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_ConversationParticipants PRIMARY KEY (ConversationId, UserId),
    CONSTRAINT FK_ConversationParticipants_Conversation FOREIGN KEY (OrganizationId, ConversationId) REFERENCES communication.Conversations(OrganizationId, ConversationId),
    CONSTRAINT FK_ConversationParticipants_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId)
);
GO

CREATE TABLE communication.Messages
(
    MessageId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    ConversationId BIGINT NOT NULL,
    SenderUserId BIGINT NOT NULL,
    Body NVARCHAR(MAX) NOT NULL,
    AttachmentFileId BIGINT NULL,
    SentAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Messages_Sent DEFAULT SYSUTCDATETIME(),
    EditedAtUtc DATETIME2(3) NULL,
    DeletedAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_Messages PRIMARY KEY (MessageId),
    CONSTRAINT FK_Messages_Conversation FOREIGN KEY (OrganizationId, ConversationId) REFERENCES communication.Conversations(OrganizationId, ConversationId),
    CONSTRAINT FK_Messages_Sender FOREIGN KEY (SenderUserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_Messages_Attachment FOREIGN KEY (OrganizationId, AttachmentFileId) REFERENCES core.Files(OrganizationId, FileId)
);
GO
CREATE INDEX IX_Messages_Conversation_Date ON communication.Messages(OrganizationId, ConversationId, SentAtUtc DESC);
GO

CREATE TABLE communication.Notifications
(
    NotificationId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    UserId BIGINT NOT NULL,
    NotificationType NVARCHAR(50) NOT NULL,
    Title NVARCHAR(180) NOT NULL,
    Body NVARCHAR(1000) NOT NULL,
    DataJson NVARCHAR(MAX) NULL,
    Channel VARCHAR(20) NOT NULL CONSTRAINT DF_Notifications_Channel DEFAULT ('IN_APP'),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Notifications_Status DEFAULT ('PENDING'),
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_Notifications_Created DEFAULT SYSUTCDATETIME(),
    SentAtUtc DATETIME2(3) NULL,
    ReadAtUtc DATETIME2(3) NULL,
    CONSTRAINT PK_Notifications PRIMARY KEY (NotificationId),
    CONSTRAINT FK_Notifications_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_Notifications_Data CHECK (DataJson IS NULL OR ISJSON(DataJson)=1),
    CONSTRAINT CK_Notifications_Channel CHECK (Channel IN ('IN_APP','EMAIL','WHATSAPP','PUSH')),
    CONSTRAINT CK_Notifications_Status CHECK (Status IN ('PENDING','SENT','FAILED','READ','CANCELLED'))
);
GO
CREATE INDEX IX_Notifications_User_Status_Date ON communication.Notifications(OrganizationId, UserId, Status, CreatedAtUtc DESC);
GO

CREATE TABLE communication.NotificationPreferences
(
    OrganizationId BIGINT NOT NULL,
    UserId BIGINT NOT NULL,
    PreferenceType NVARCHAR(50) NOT NULL,
    InAppEnabled BIT NOT NULL CONSTRAINT DF_NotificationPreferences_InApp DEFAULT (1),
    EmailEnabled BIT NOT NULL CONSTRAINT DF_NotificationPreferences_Email DEFAULT (1),
    WhatsAppEnabled BIT NOT NULL CONSTRAINT DF_NotificationPreferences_WhatsApp DEFAULT (0),
    PushEnabled BIT NOT NULL CONSTRAINT DF_NotificationPreferences_Push DEFAULT (1),
    UpdatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_NotificationPreferences_Updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_NotificationPreferences PRIMARY KEY (OrganizationId, UserId, PreferenceType),
    CONSTRAINT FK_NotificationPreferences_Organization FOREIGN KEY (OrganizationId) REFERENCES core.Organizations(OrganizationId),
    CONSTRAINT FK_NotificationPreferences_User FOREIGN KEY (UserId) REFERENCES security.Users(UserId)
);
GO

CREATE TABLE communication.SupportTickets
(
    SupportTicketId BIGINT IDENTITY(1,1) NOT NULL,
    OrganizationId BIGINT NOT NULL,
    PublicId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SupportTickets_PublicId DEFAULT NEWSEQUENTIALID(),
    ConversationId BIGINT NULL,
    CreatedByUserId BIGINT NOT NULL,
    AssignedToUserId BIGINT NULL,
    Category NVARCHAR(60) NOT NULL,
    Priority VARCHAR(20) NOT NULL CONSTRAINT DF_SupportTickets_Priority DEFAULT ('NORMAL'),
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_SupportTickets_Status DEFAULT ('OPEN'),
    Subject NVARCHAR(200) NOT NULL,
    CreatedAtUtc DATETIME2(3) NOT NULL CONSTRAINT DF_SupportTickets_Created DEFAULT SYSUTCDATETIME(),
    ClosedAtUtc DATETIME2(3) NULL,
    MemberId BIGINT NULL,
    CONSTRAINT FK_SupportTickets_Member FOREIGN KEY (OrganizationId, MemberId) REFERENCES core.Members(OrganizationId, MemberId),
    CONSTRAINT PK_SupportTickets PRIMARY KEY (SupportTicketId),
    CONSTRAINT UQ_SupportTickets_PublicId UNIQUE (PublicId),
    CONSTRAINT FK_SupportTickets_Conversation FOREIGN KEY (OrganizationId, ConversationId) REFERENCES communication.Conversations(OrganizationId, ConversationId),
    CONSTRAINT FK_SupportTickets_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES security.Users(UserId),
    CONSTRAINT FK_SupportTickets_AssignedTo FOREIGN KEY (AssignedToUserId) REFERENCES security.Users(UserId),
    CONSTRAINT CK_SupportTickets_Priority CHECK (Priority IN ('LOW','NORMAL','HIGH','URGENT')),
    CONSTRAINT CK_SupportTickets_Status CHECK (Status IN ('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED'))
);
GO
