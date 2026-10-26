# Codex execution brief — GymFlow DB + Backend

Work only on `database/` and `backend/`. Do not create frontend code.

## Goals
- Make every numbered SQL script execute successfully from an empty SQL Server 2025 instance.
- Make the .NET 10 solution restore, compile and pass tests.
- Preserve tenant isolation, financial history and the modular-monolith architecture.
- Do not add microservices, Kafka, Kubernetes or unrelated infrastructure.

## Required workflow
1. Read `docs/ARCHITECTURE.md` and all numbered SQL files before editing.
2. Start SQL Server 2025 Developer locally/containerized.
3. Run `database/98_InstallSchema.sql` in SQLCMD mode from the `database` directory.
4. Run `database/99_InstallDemo.sql`.
5. If SQL fails, fix the smallest root cause. Do not rename/remove business concepts without documenting the reason.
6. Recreate the database from scratch and rerun both installer scripts after each schema correction.
7. Restore/build/test `backend/GymFlow.sln` with .NET 10 SDK 10.0.402 (or a newer supported .NET 10 patch SDK).
8. Fix compiler/analyzer warnings; warnings are errors by design.
9. Set secrets only through environment variables/user-secrets. Never commit a password, JWT key or production connection string.
10. Run API and verify `/health/live`, `/health/ready`, and the OpenAPI document.
11. Seed demo passwords with `GYMFLOW_DEMO_PASSWORD` only in Development.
12. Test login and authorization for all four roles.
13. Verify an Organization A token cannot read or write Organization B records. Add integration tests for this.
14. Verify mixed payment: S/40 cash + S/80 Yape on S/120 total; cash movement must equal only S/40.
15. Verify partial payment: S/50 on S/120 receivable; remaining balance must be S/70.
16. Verify check-in rejects no-membership users unless a currently approved exception exists.
17. Verify class capacity under concurrent reservations; overflow must go to waitlist, never exceed capacity.
18. Run `backend/load-tests/gymflow-smoke.js` with k6 at the supplied stages.
19. Run `python scripts_static_validate.py` and require zero static errors.
20. Record build/test/load results in `docs/CODEX_VALIDATION_REPORT.md` with exact commands, versions and failures/fixes.

## Architecture constraints
- Keep ASP.NET Core as one modular stateless API for v1.
- Keep SQL Server as the transactional source of truth.
- Keep `OrganizationId` checks in both database relationships and backend queries.
- No DbContext pooling while request-scoped tenant state is captured by query filters.
- SQL client connection pooling is expected and should remain enabled.
- Paginate collection endpoints; cap page size at 100.
- Use `AsNoTracking()` for read-only queries.
- Use transactions for membership creation, payments/cash, reservations and inventory mutations.
- Prefer optimistic concurrency (`rowversion`) for editable critical records.
- Do not cache financial/cash/inventory truth without an explicit invalidation/reconciliation strategy.
- Background jobs must be used for long reports, RPA, bulk notifications and AI document processing.

## Completion gate
Do not label the DB/backend complete until a clean clone can: create the DB from zero, seed demo data, pass SQL integrity checks, build in Release with zero warnings/errors, pass tests, start the API, and pass tenant/security/payment/concurrency smoke tests.
