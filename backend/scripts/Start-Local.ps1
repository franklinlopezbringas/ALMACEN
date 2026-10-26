param([switch]$ResetDemoPasswords)
$ErrorActionPreference = 'Stop'
$backend = Split-Path $PSScriptRoot -Parent
$apiProject = Join-Path $backend 'src/GymFlow.Api/GymFlow.Api.csproj'
$sdk = Join-Path $backend '.tools/dotnet/dotnet.exe'
if (-not (Test-Path -LiteralPath $sdk)) { $sdk = 'dotnet' }
if ($ResetDemoPasswords -and [string]::IsNullOrWhiteSpace($env:GYMFLOW_DEMO_PASSWORD)) {
    throw 'Set GYMFLOW_DEMO_PASSWORD in this terminal before resetting fictitious demo credentials.'
}
if ($ResetDemoPasswords) {
    # Only the canonical fictitious demo tenant; no real users or validation tenants.
    & sqlcmd -S '.\SQLEXPRESS' -E -C -b -d GymFlowDb -Q @'
SET QUOTED_IDENTIFIER ON;
UPDATE u SET PasswordHash=NULL,FailedAccessCount=0,LockoutEndUtc=NULL
FROM security.Users u
JOIN security.UserOrganizations uo ON uo.UserId=u.UserId
JOIN core.Organizations o ON o.OrganizationId=uo.OrganizationId
WHERE o.TaxId=N'DEMO-GYMFLOW-001' AND u.Email LIKE N'%@demo.gymflow.local';
'@
    if ($LASTEXITCODE -ne 0) { throw 'Demo credential reset failed.' }
}
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5080'
$env:ConnectionStrings__GymFlow = 'Server=.\SQLEXPRESS;Database=GymFlowDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;'
if ([string]::IsNullOrWhiteSpace($env:Jwt__SigningKey)) {
    $bytes = New-Object byte[] 64
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $env:Jwt__SigningKey = [Convert]::ToBase64String($bytes)
}
& $sdk run --project $apiProject -c Release --no-build --no-launch-profile
exit $LASTEXITCODE
