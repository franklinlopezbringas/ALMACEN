/* Run 98_InstallSchema.sql first, then run this in SQLCMD mode. */
:ON ERROR EXIT
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
GO
:r .\demo\DemoData.sql
:r .\tests\IntegrityTests.sql
