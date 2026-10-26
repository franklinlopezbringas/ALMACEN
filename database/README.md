# GymFlow SQL Server database

## Installation order

Use SQLCMD mode from this directory:

```text
98_InstallSchema.sql
99_InstallDemo.sql   # demo environment only
```

`98_InstallSchema.sql` installs numbered domain scripts plus seed procedures/catalogs. `99_InstallDemo.sql` loads fictitious demo data and immediately runs integrity assertions.

Validated local invocation: `sqlcmd -S '.\SQLEXPRESS' -E -C -b -i 98_InstallSchema.sql`,
then the same command with `99_InstallDemo.sql`. Use Windows authentication.
The schema installer refuses an existing database containing tables. Preserve
populated databases and use `patches/20261015_ValidationHardening.sql` for the
additive corrections to an earlier v1 installation.

For repeatable clean-install validation without deleting `GymFlowDb`, run
`py scripts/validate_schema.py` from `../backend`. It installs the same canonical
scripts in a new `GymFlowValidation_*` database and runs demo/integrity twice.
`tests/ScaleDiagnostics.sql` accepts SQLCMD variable `DatabaseName`, refuses a
non-validation database, and rolls back its 10,000-row fixtures. The temporary
databases are intentionally retained.

## Canonical schema

During v1 design, the numbered SQL files are the schema source of truth. Do not let EF migrations silently diverge from them. After the schema has passed a clean SQL Server installation and integration suite, the team can choose a single long-term migration strategy.

## Data safety

- Demo identities are fictitious and live only under `demo/`.
- No production password is stored by SQL seed scripts.
- Financial rows are retained; reversal/refund records describe corrections.
- Heavy files do not belong in SQL Server; `core.Files` stores metadata/storage key only.
