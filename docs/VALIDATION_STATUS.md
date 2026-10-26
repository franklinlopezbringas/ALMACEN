# Validation status — 2026-10-25

## Reception v1 closure — 2026-10-25

[Final closure report](RECEPTION_CLOSURE_REPORT.md): 53/53 backend SQL tests;
Release 0 warnings/errors; 46/46 frontend unit tests; 59 isolated E2E PASS and one
intentional desktop skip; 11/11 live E2E; 3/3 responsive runs at 375/768/1440.
126 HTTP checks PASS (54 Reception + 57 closure + 15 classes). Lint, typecheck,
production build, IntegrityTests and ReceptionClosureIntegrity PASS.

CashService remains Serializable. Targeted UPDLOCK/index access and tenant-aware
covering indexes resolve the reproduced cash/refund deadlocks. Full/partial/mixed
returns, inventory reversal, FIFO/cancellation/attendance/no-show, access exceptions,
incidents, participant-authorized messaging and independent handoff are implemented.
Only authorized schema extensions were applied: core.ShiftHandoffs (100 tables),
SupportTickets.MemberId and original split/return references on Refunds. A fresh
canonical install includes all new indexes; both validation databases created by
this closure were removed after verifying the API uses GymFlowDb.

Reception v1 is technically closed within the documented scope and ready for
commercial review. Demo data curation/external integrations remain explicit limits.
Trainer and Member development have not started. Historical validation follows.

## Reception + POS Patch — 2026-10-22

[Reception report](RECEPTION_PATCH_REPORT.md): backend 35/35 real SQL tests,
0 build warnings/errors; frontend unit 44/44; isolated E2E 59 PASS and one intentional
mobile-only skip; live E2E 9/9; responsive 3/3 with 30 screenshots. Lint, typecheck,
production build, HTTP smoke 54/54 and IntegrityTests PASS.
Atomic POS, stock/cash consistency, replay, concurrency, rollback and tenant/role
boundaries verified. Existing schema/seeds unchanged; optional demo fixture added.
Reception ready for local commercial review within the documented scope. Trainer
and Member expansion remain paused. Earlier validation records follow unchanged.


## Integration Patch — 2026-10-21

[Current integration report](INTEGRATION_PATCH_REPORT.md): IntegrityTests PASS;
Release build PASS with 0 warnings/errors; backend 25/25 PASS; HTTP smoke 52/52 PASS;
frontend unit tests 37/37, isolated E2E 39 PASS / 1 intentional skip, live E2E 8/8,
responsive 3/3 (42 screenshots). Lint, typecheck and production build PASS.
Four-role authentication/refresh, tenant isolation, audit, concurrency, plan history
and inventory ledger verified. Existing schema/seeds unchanged; optional local E2E
accounts added. Admin scope closed for local demo; other role development paused.

## Historical DB/backend v1 validation

The following record is retained as evidence of the earlier baseline.

GymFlow DB + Backend v1 passed local runtime validation on SQL Server 2025 Express
(`.\SQLEXPRESS`, Windows authentication) and .NET SDK 10.0.402 / runtime 10.0.13.
The approved modular monolith, SQL Server and tenant model are preserved.

- Canonical schema/seeds/demo and repeated demo installation: PASS.
- Clean install: PASS in `GymFlowValidation_87970f4b864c`; main `GymFlowDb` preserved.
- 99 tables, 99 PK, 202 FK, 118 UNIQUE constraints, 177 CHECK, 267 indexes, 25 rowversion columns.
- SQL integrity assertions: PASS, including after the final API/load runs.
- Restore and Release build: PASS, 0 warnings / 0 errors.
- .NET tests: 19/19 PASS, 0 skipped, against both main and clean temporary databases.
- API/SQL readiness, authentication, authorization, tenant isolation and implemented business flows: PASS.
- Each final HTTP/SQL/load run: 65 checks PASS; concurrent refresh/payment/cash/class/reward cases included.
- EF read query counts/tracking, deterministic pagination, SQL aggregations and related indexes reviewed.
- 10,000-record SQL scale diagnostic: PASS with rollback.
- k6 50 VU: 12,390 requests, 0 failures, p95 8.92 ms / p99 32.30 ms.
- k6 100 VU: 42,567 requests, 0 failures, p95 10.46 ms / p99 60.88 ms; 100 VU held for one minute.
- Static validation: 0 errors; 106 C# files and 21 API permission codes checked.

The validated API surface remains the one documented in
[`backend/API_SURFACE.md`](../backend/API_SURFACE.md). Inventory catalog/stock,
trainer assignments/progress and job enqueue/status were tested through HTTP.
Inventory mutations, full workout persistence and job execution records were
tested directly in SQL with rollback. External workers/providers and additional
routine/inventory write APIs are outside that documented v1 surface.

These local read-load measurements do not establish production capacity or
validate external integrations. Temporary databases and fictitious validation
tenants were retained; no destructive cleanup was performed.

The complete results, commands, changed-file inventory, fixes, scope and remaining
deployment considerations are in [CODEX_VALIDATION_REPORT.md](CODEX_VALIDATION_REPORT.md).
Detailed logs and k6 JSON results are under ignored `backend/artifacts/`.
