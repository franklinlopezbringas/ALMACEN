/* SQLCMD -v DatabaseName=GymFlowValidation_xxx. All added data rolls back. */
USE [$(DatabaseName)];
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
IF DB_NAME() NOT LIKE 'GymFlowValidation[_]%' THROW 51990,'Use only the temporary validation database.',1;
BEGIN TRANSACTION;
DECLARE @org bigint=(SELECT OrganizationId FROM core.Organizations WHERE TaxId=N'DEMO-GYMFLOW-001');
DECLARE @branch bigint=(SELECT MIN(BranchId) FROM core.Branches WHERE OrganizationId=@org);
DECLARE @version bigint=(SELECT MIN(PlanVersionId) FROM membership.PlanVersions WHERE OrganizationId=@org);
DECLARE @shift bigint=(SELECT MIN(CashShiftId) FROM finance.CashShifts WHERE OrganizationId=@org AND Status='OPEN');
DECLARE @actor bigint=(SELECT MIN(UserId) FROM security.UserOrganizations WHERE OrganizationId=@org);
DECLARE @people TABLE(PersonId bigint PRIMARY KEY);
DECLARE @members TABLE(MemberId bigint PRIMARY KEY);
INSERT core.People(OrganizationId,FirstName,LastName)
OUTPUT inserted.PersonId INTO @people
SELECT TOP(10000) @org,CONCAT(N'Scale-',ROW_NUMBER() OVER(ORDER BY a.object_id,b.object_id)),N'Query Validation'
FROM sys.all_objects a CROSS JOIN sys.all_objects b;
INSERT core.Members(OrganizationId,PersonId,HomeBranchId,MemberCode)
OUTPUT inserted.MemberId INTO @members
SELECT @org,PersonId,@branch,CONCAT('SCALE-',PersonId) FROM @people;
INSERT membership.Memberships(OrganizationId,MemberId,PlanVersionId,HomeBranchId,StartDate,EndDate,ContractedPrice,CurrencyCode,Status,Origin)
SELECT @org,MemberId,@version,@branch,CONVERT(date,SYSUTCDATETIME()),DATEADD(day,30,CONVERT(date,SYSUTCDATETIME())),120,'PEN','ACTIVE','MIGRATION' FROM @members;
INSERT finance.Receivables(OrganizationId,MemberId,Description,TotalAmount,CurrencyCode,DueDate)
SELECT @org,MemberId,'Scale validation',120,'PEN',CONVERT(date,SYSUTCDATETIME()) FROM @members;
INSERT finance.CashMovements(OrganizationId,CashShiftId,MovementType,Amount,Description,CreatedByUserId)
SELECT @org,@shift,'ADJUSTMENT_IN',1,'Scale validation',@actor FROM @members;
DECLARE @today date=CONVERT(date,SYSUTCDATETIME());
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
SELECT COUNT_BIG(*) MemberCount FROM core.Members WHERE OrganizationId=@org;
SELECT m.MemberId,p.FirstName,p.LastName,
 (SELECT TOP(1) ms.Status FROM membership.Memberships ms WHERE ms.OrganizationId=@org AND ms.MemberId=m.MemberId AND ms.StartDate<=@today AND ms.EndDate>=@today ORDER BY ms.EndDate DESC) MembershipStatus
FROM core.Members m JOIN core.People p ON p.OrganizationId=m.OrganizationId AND p.PersonId=m.PersonId
WHERE m.OrganizationId=@org ORDER BY p.LastName,p.FirstName,m.MemberId OFFSET 9900 ROWS FETCH NEXT 25 ROWS ONLY;
SELECT SUM(BalanceAmount) Outstanding FROM finance.vw_ReceivableBalances WHERE OrganizationId=@org AND Status IN ('OPEN','PARTIALLY_PAID');
SELECT SUM(CASE WHEN MovementType IN ('INCOME','ADJUSTMENT_IN') THEN Amount ELSE -Amount END) NetMovements
FROM finance.CashMovements WHERE OrganizationId=@org AND CashShiftId=@shift;
SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
IF (SELECT COUNT(*) FROM @members)<>10000 THROW 51991,'Scale fixture count mismatch.',1;
ROLLBACK;
SELECT 'PASS' Result,'10000 members, memberships, receivables and cash movements; queries executed, data rolled back.' Detail;
