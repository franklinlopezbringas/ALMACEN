param([string]$SqlServer = '.\SQLEXPRESS07')
. "$PSScriptRoot/Local.Common.ps1"

$master = "Server=$SqlServer;Database=master;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=15;"
$database = "Server=$SqlServer;Database=GymFlowDb;Integrated Security=True;TrustServerCertificate=True;MultipleActiveResultSets=True;"
$exists = Get-LocalScalar $master "SELECT COUNT(*) FROM sys.databases WHERE name=N'GymFlowDb'"
if ($exists -eq 0) {
    Write-Host 'Creating GymFlowDb from the canonical schema...'
    Invoke-LocalSql $master (Expand-LocalSql (Join-Path $script:RepositoryRoot 'database/98_InstallSchema.sql'))
    Invoke-LocalSql $database (Expand-LocalSql (Join-Path $script:RepositoryRoot 'database/99_InstallDemo.sql'))
} else {
    if ((Get-LocalScalar $database "SELECT COUNT(*) FROM sys.tables WHERE name=N'Organizations' AND schema_id=SCHEMA_ID('core')") -eq 0) {
        throw 'GymFlowDb exists without the expected schema. Existing data was preserved; review it before installing.'
    }
    Write-Host 'Preserving the existing GymFlowDb and its data.'
}
foreach ($name in @('20261015_ValidationHardening.sql', '20261024_ReceptionReferences.sql', '20261024_ShiftHandoffs.sql')) {
    Invoke-LocalSql $database ([IO.File]::ReadAllText((Join-Path $script:RepositoryRoot "database/patches/$name")))
}
$organization = Get-LocalScalar $database "SELECT CONVERT(varchar(36),PublicId) FROM core.Organizations WHERE TaxId=N'DEMO-GYMFLOW-001'"
if (-not $organization) { throw 'The demo organization is missing. No existing business data was changed.' }
$backendEnv = Join-Path $script:RepositoryRoot 'backend/.env.local'
if (-not (Test-Path -LiteralPath $backendEnv)) {
    $jwt = New-LocalSecret
    $password = 'GymFlow!' + (New-LocalSecret).Substring(0,18)
    @(
        "ConnectionStrings__GymFlow=$database"
        "Jwt__SigningKey=$jwt"
        "GYMFLOW_DEMO_PASSWORD=$password"
        'ASPNETCORE_ENVIRONMENT=Development'
        'ASPNETCORE_URLS=http://127.0.0.1:5080'
    ) | Set-Content -LiteralPath $backendEnv -Encoding UTF8
    $artifactDirectory = Join-Path $script:RepositoryRoot 'artifacts/local'
    New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
    @(
        '# Accesos locales de demostracion'
        ''
        'Frontend: http://127.0.0.1:3000/login'
        "Organizacion: $organization"
        "Clave de las cuentas demo nuevas: $password"
        ''
        'Administrador: diego.salazar@demo.gymflow.local'
        'Recepcion: ana.torres@demo.gymflow.local'
        'Entrenador: carlos.gomez@demo.gymflow.local'
        'Socio: maria.lopez@demo.gymflow.local'
        ''
        'Solo se inicializan cuentas demo sin password; no se cambian claves existentes.'
    ) | Set-Content -LiteralPath (Join-Path $artifactDirectory 'ACCESOS.md') -Encoding UTF8
}
$frontendEnv = Join-Path $script:RepositoryRoot 'frontend/.env.local'
if (-not (Test-Path -LiteralPath $frontendEnv)) {
    $sessionSecret = New-LocalSecret
    @(
        'GYMFLOW_API_URL=http://127.0.0.1:5080'
        'APP_ORIGIN=http://127.0.0.1:3000'
        'APP_ADDITIONAL_ORIGINS=http://localhost:3000'
        "SESSION_SECRET=$sessionSecret"
        'COOKIE_SECURE=false'
        "NEXT_PUBLIC_ORGANIZATION_ID=$organization"
        'NEXT_PUBLIC_ORGANIZATION_NAME=NovaFit Gym'
    ) | Set-Content -LiteralPath $frontendEnv -Encoding UTF8
}
Write-Host "Database ready: $SqlServer / GymFlowDb. Local configuration and demo access saved in ignored files."
