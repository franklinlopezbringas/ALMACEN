/* GymFlow v1.0 - 00 Create Database & Schemas */
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
USE [master];
GO
IF DB_ID(N'GymFlowDb') IS NULL
BEGIN
    CREATE DATABASE [GymFlowDb];
END;
GO
ALTER DATABASE [GymFlowDb] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO
USE [GymFlowDb];
GO

DECLARE @schemas TABLE (SchemaName sysname);
INSERT INTO @schemas VALUES
(N'core'),(N'security'),(N'crm'),(N'membership'),(N'finance'),(N'access'),
(N'training'),(N'commerce'),(N'loyalty'),(N'communication'),(N'legal'),
(N'automation'),(N'ai'),(N'audit');

DECLARE @schema sysname;
DECLARE schema_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT SchemaName FROM @schemas;
OPEN schema_cursor;
FETCH NEXT FROM schema_cursor INTO @schema;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF SCHEMA_ID(@schema) IS NULL
        EXEC(N'CREATE SCHEMA [' + @schema + N'] AUTHORIZATION [dbo];');
    FETCH NEXT FROM schema_cursor INTO @schema;
END
CLOSE schema_cursor;
DEALLOCATE schema_cursor;
GO
