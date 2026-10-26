# GymFlow DB + Backend v1

## Objective
A professional client-demo foundation that can evolve into a real gym SaaS without rebuilding the core.

## Architecture
- SQL Server 2025-ready relational database, tenant-aware through `OrganizationId`.
- ASP.NET Core 10 modular monolith.
- EF Core 10 SQL Server provider.
- Stateless API; JWT access tokens + rotating refresh sessions.
- Permission-based authorization in addition to roles.
- Files are stored outside SQL Server; only metadata/storage keys live in `core.Files`.
- Heavy work is represented by `automation.Jobs` and processed outside request/response paths.
- SQL connection pooling is left to `Microsoft.Data.SqlClient`; DbContext pooling is intentionally not used because the DbContext depends on request-scoped tenant state.

## Main DB domains
`core`, `security`, `crm`, `membership`, `finance`, `access`, `training`, `commerce`, `loyalty`, `communication`, `legal`, `automation`, `ai`, `audit`.

## Non-negotiable rules
1. Tenant-owned data must carry and enforce `OrganizationId`.
2. Financial records are not hard-deleted.
3. Plan versions preserve historic prices; memberships snapshot contracted price.
4. One payment may have multiple payment splits; only cash splits create cash movements.
5. Receivable balance is derived from allocations, not a manually maintained balance column.
6. Attendance denied attempts may be logged, but reports count only allowed/authorized-exception entries.
7. Biometrics are represented by external credential IDs; no fingerprint image is stored in GymFlow.
8. Audit logs are append-oriented.
9. Large list APIs must paginate; default 25, maximum 100.
10. Long-running RPA/AI/report work goes to jobs/workers.

## Source of truth
For this design stage the numbered SQL files are the canonical schema. EF Core mappings must match them. Do not create EF migrations that silently change the schema until the SQL installation and integrity tests pass on a real SQL Server instance.
