# GymFlow Backend

Target: .NET 10 / ASP.NET Core 10 / EF Core 10 / SQL Server.

## Required environment values
- `ConnectionStrings__GymFlow`
- `Jwt__SigningKey` (minimum 32 characters; use a generated secret)
- Optional Development-only: `GYMFLOW_DEMO_PASSWORD`

## Local commands
```bash
dotnet restore GymFlow.sln
dotnet build GymFlow.sln -c Release
dotnet test GymFlow.sln -c Release
dotnet run --project src/GymFlow.Api/GymFlow.Api.csproj
```

OpenAPI is exposed in Development at `/openapi/v1.json`. Health endpoints are `/health/live` and `/health/ready`.

The SQL schema is intentionally managed by the numbered scripts in `../database` during this design stage. Do not create competing EF migrations until the database is validated from scratch.

## Validated local SQL Server environment

Use `sqlcmd -S '.\SQLEXPRESS' -E -C -b`. Development configuration targets
`Server=.\SQLEXPRESS;Database=GymFlowDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;`.
The project pins SDK 10.0.402. In the validated workspace it is installed under
`.tools/dotnet`; prepend that directory to `PATH` if the system SDK differs.

From this directory, in PowerShell:

```powershell
$env:PATH = "$PWD\.tools\dotnet;$env:PATH"
$env:GYMFLOW_TEST_CONNECTION = 'Server=.\SQLEXPRESS;Database=GymFlowDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;'
dotnet restore GymFlow.sln
dotnet build GymFlow.sln -c Release
dotnet test GymFlow.sln -c Release
py tests/integration_api.py --load --vus 50
py tests/integration_api.py --load --vus 100 --keep-api
```

The SQL-backed .NET tests require `GYMFLOW_TEST_CONNECTION`; without it they are
explicitly skipped. The API runner uses fictitious tenants and ephemeral secrets,
leaves its test fixtures in `GymFlowDb`, and records results under ignored `artifacts/`.
It needs the portable k6 executable under `.tools/k6/k6-v2.3.0-windows-amd64/k6.exe`
for load profiles. Stop only its API with `scripts/Stop-ValidationApi.ps1`.

For an interactive local launch use `scripts/Start-Local.ps1`. It generates a JWT
key in memory when none is supplied and binds to `http://127.0.0.1:5080`.
Set `GYMFLOW_DEMO_PASSWORD` in your terminal before using `-ResetDemoPasswords`
if you need fresh credentials for the fictitious canonical demo accounts. No
validation password or signing key is stored in source.

`py scripts/validate_schema.py` applies the additive hardening patch to the existing
main database and validates the official installers in a new `GymFlowValidation_*`
database, including repeat demo installation. It never drops an existing database.
Do not rerun `98_InstallSchema.sql` against a populated main database; it now fails
early to protect that database.

See [API_SURFACE.md](API_SURFACE.md) for the implemented v1 boundaries and
[the validation report](../docs/CODEX_VALIDATION_REPORT.md) for measured results.
