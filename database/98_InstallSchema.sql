/* Run with SQLCMD mode enabled in SSMS, from the database folder. */
:ON ERROR EXIT
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO
/* This installer is for an empty database. Never disturb an existing installation. */
IF DB_ID(N'GymFlowDb') IS NOT NULL
    EXEC(N'IF EXISTS (SELECT 1 FROM GymFlowDb.sys.tables WHERE is_ms_shipped=0)
        THROW 51000, ''GymFlowDb already has tables. Use an additive upgrade script.'', 1;');
GO
:r .\00_CreateDatabase.sql
:r .\01_Organization_Security.sql
:r .\02_People_CRM.sql
:r .\03_Membership.sql
:r .\04_Finance_Cash.sql
:r .\05_Access_Training.sql
:r .\06_Commerce.sql
:r .\07_Loyalty_Communication.sql
:r .\08_Automation_AI.sql
:r .\09_Audit.sql
:r .\seeds\01_GlobalPermissions.sql
:r .\seeds\02_OrganizationDefaults.sql
:r .\seeds\03_ReferenceCatalogs.sql
