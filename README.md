# GymFlow — Database + Backend v1 client-demo foundation

Scope of this package: **database and backend only**. Frontend is intentionally excluded until the persistence/API foundation is validated.

## Structure

```text
GymFlow_Final/
├── database/                 SQL Server schema, seeds, demo and integrity tests
├── backend/                  .NET 10 ASP.NET Core modular-monolith API
├── docs/                     architecture, DER and validation notes
└── CODEX_EXECUTION.md        exact execution/validation brief for Codex
```

## Definition of done

The package becomes `validated v1` only after a clean environment can:

1. Create `GymFlowDb` from zero using `database/98_InstallSchema.sql`.
2. Load `database/99_InstallDemo.sql` and pass all SQL integrity assertions.
3. Restore/build the .NET solution in Release with no warnings/errors.
4. Pass automated tests.
5. Start the API and pass health checks.
6. Demonstrate tenant isolation and permissions.
7. Demonstrate mixed/partial payments, cash-only drawer effects, membership/access, trainer progress, class capacity/waitlist and GymPoints redemption.
8. Pass the included load-test smoke profile and record latency/error results.

## Architectural position

GymFlow v1 is a stateless modular monolith, not a microservices system. SQL Server is the transactional source of truth. Long-running reports/RPA/AI operations use durable jobs. This is deliberate: professional scalability without demo-era infrastructure bloat.
