USE GymFlowDb;
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
DECLARE @org bigint=(SELECT MAX(OrganizationId) FROM core.Organizations WHERE TaxId LIKE 'VA-%');
DECLARE @today date=CONVERT(date,SYSUTCDATETIME());
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
SELECT m.MemberId,m.MemberCode,p.FirstName,p.LastName,
 (SELECT TOP(1) ms.Status FROM membership.Memberships ms WHERE ms.OrganizationId=@org AND ms.MemberId=m.MemberId AND ms.StartDate<=@today AND ms.EndDate>=@today ORDER BY ms.EndDate DESC) MembershipStatus
FROM core.Members m JOIN core.People p ON p.OrganizationId=m.OrganizationId AND p.PersonId=m.PersonId
WHERE m.OrganizationId=@org ORDER BY p.LastName,p.FirstName,m.MemberId OFFSET 0 ROWS FETCH NEXT 25 ROWS ONLY;
SELECT SUM(BalanceAmount) Outstanding FROM finance.vw_ReceivableBalances WHERE OrganizationId=@org AND Status IN ('OPEN','PARTIALLY_PAID');
SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
SELECT actual_state_desc,desired_state_desc,current_storage_size_mb FROM sys.database_query_store_options;
SELECT TOP(10) SUM(rs.count_executions) Executions,
 CAST(SUM(rs.avg_duration*rs.count_executions)/NULLIF(SUM(rs.count_executions),0)/1000.0 AS decimal(18,3)) MeanDurationMs,
 CAST(SUM(rs.avg_logical_io_reads*rs.count_executions)/NULLIF(SUM(rs.count_executions),0) AS decimal(18,3)) MeanLogicalReads,
 LEFT(qt.query_sql_text,1000) QueryText
FROM sys.query_store_query_text qt JOIN sys.query_store_query q ON qt.query_text_id=q.query_text_id
JOIN sys.query_store_plan p ON p.query_id=q.query_id JOIN sys.query_store_runtime_stats rs ON rs.plan_id=p.plan_id
WHERE qt.query_sql_text LIKE '%SELECT%' AND (qt.query_sql_text LIKE '%core%Members%' OR qt.query_sql_text LIKE '%training%ClassSessions%' OR qt.query_sql_text LIKE '%vw_ReceivableBalances%')
GROUP BY qt.query_text_id,qt.query_sql_text ORDER BY SUM(rs.count_executions) DESC;
