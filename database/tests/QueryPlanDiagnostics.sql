/* Read-only Query Store evidence for the API read workload. */
USE GymFlowDb;
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
;WITH XMLNAMESPACES(DEFAULT 'http://schemas.microsoft.com/sqlserver/2004/07/showplan'),
RecentPlans AS (
    SELECT TOP(10) p.plan_id,CONVERT(xml,p.query_plan) PlanXml,
        SUM(rs.count_executions) Executions,
        SUM(rs.avg_duration*rs.count_executions)/SUM(rs.count_executions)/1000.0 MeanDurationMs
    FROM sys.query_store_query_text qt
    JOIN sys.query_store_query q ON q.query_text_id=qt.query_text_id
    JOIN sys.query_store_plan p ON p.query_id=q.query_id
    JOIN sys.query_store_runtime_stats rs ON rs.plan_id=p.plan_id
    WHERE rs.last_execution_time>=DATEADD(minute,-30,SYSUTCDATETIME())
      AND (CHARINDEX('[core].[Members]',qt.query_sql_text)>0
        OR CHARINDEX('[training].[ClassSessions]',qt.query_sql_text)>0
        OR CHARINDEX('[finance].[vw_ReceivableBalances]',qt.query_sql_text)>0)
    GROUP BY p.plan_id,p.query_plan
    HAVING SUM(rs.count_executions)>0
    ORDER BY SUM(rs.count_executions) DESC
)
SELECT DISTINCT p.plan_id,p.Executions,CAST(p.MeanDurationMs AS decimal(18,3)) MeanDurationMs,
    p.PlanXml.exist('//MissingIndexes') HasMissingIndexSuggestion,
    p.PlanXml.exist('//Warnings/PlanAffectingConvert') HasPlanAffectingConvert,
    idx.n.value('@Schema','nvarchar(128)') SchemaName,
    idx.n.value('@Table','nvarchar(128)') TableName,
    idx.n.value('@Index','nvarchar(128)') IndexName
FROM RecentPlans p CROSS APPLY p.PlanXml.nodes('//Object[@Index]') idx(n)
ORDER BY p.Executions DESC,p.plan_id,SchemaName,TableName,IndexName;
