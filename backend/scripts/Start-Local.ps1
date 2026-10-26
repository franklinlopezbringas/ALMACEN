param([switch]$ResetDemoPasswords)
$ErrorActionPreference = 'Stop'
$backend = Split-Path $PSScriptRoot -Parent
$apiProject = Join-Path $backend 'src/GymFlow.Api/GymFlow.Api.csproj'
. (Join-Path (Split-Path $backend -Parent) 'scripts/Local.Common.ps1')
$localEnvironment = Join-Path $backend '.env.local'
if (Test-Path -LiteralPath $localEnvironment) { Import-LocalEnvironment $localEnvironment }
$sdk = Join-Path $backend '.tools/dotnet/dotnet.exe'
if (-not (Test-Path -LiteralPath $sdk)) { $sdk = 'dotnet' }
if ($ResetDemoPasswords -and [string]::IsNullOrWhiteSpace($env:GYMFLOW_DEMO_PASSWORD)) {
    throw 'Set GYMFLOW_DEMO_PASSWORD in this terminal before resetting fictitious demo credentials.'
}
if ($ResetDemoPasswords) {
    # Only the canonical fictitious demo tenant; no real users or validation tenants.
    if ([string]::IsNullOrWhiteSpace($env:ConnectionStrings__GymFlow)) { throw 'Configure ConnectionStrings__GymFlow before resetting demo passwords.' }
    Invoke-LocalSql $env:ConnectionStrings__GymFlow @'
SET QUOTED_IDENTIFIER ON;
UPDATE u SET PasswordHash=NULL,FailedAccessCount=0,LockoutEndUtc=NULL
FROM security.Users u
JOIN security.UserOrganizations uo ON uo.UserId=u.UserId
JOIN core.Organizations o ON o.OrganizationId=uo.OrganizationId
WHERE o.TaxId=N'DEMO-GYMFLOW-001' AND u.Email LIKE N'%@demo.gymflow.local';
'@
}
$env:ASPNETCORE_ENVIRONMENT = 'Development'
if ([string]::IsNullOrWhiteSpace($env:ASPNETCORE_URLS)) { $env:ASPNETCORE_URLS = 'http://127.0.0.1:5080' }
if ([string]::IsNullOrWhiteSpace($env:ConnectionStrings__GymFlow)) {
    throw 'Run scripts/Initialize-Local.ps1 or set ConnectionStrings__GymFlow to your SQL Server instance.'
}
if ([string]::IsNullOrWhiteSpace($env:Jwt__SigningKey)) {
    $bytes = New-Object byte[] 64
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $env:Jwt__SigningKey = [Convert]::ToBase64String($bytes)
}
& $sdk run --project $apiProject -c Release --no-build --no-launch-profile
exit $LASTEXITCODE
