param([string]$SqlServer = '.\SQLEXPRESS07')
. "$PSScriptRoot/Local.Common.ps1"
Set-Location $script:RepositoryRoot
New-Item -ItemType Directory -Path '.tools','artifacts/local' -Force | Out-Null

$dotnetPath = Join-Path $script:RepositoryRoot 'backend/.tools/dotnet/dotnet.exe'
if (-not (Test-Path -LiteralPath $dotnetPath)) {
    Invoke-WebRequest -UseBasicParsing 'https://dot.net/v1/dotnet-install.ps1' -OutFile '.tools/dotnet-install.ps1'
    & ./.tools/dotnet-install.ps1 -Version 10.0.402 -InstallDir 'backend/.tools/dotnet' -NoPath
    if (-not (Test-Path -LiteralPath $dotnetPath)) { throw 'The local .NET SDK installation failed.' }
}
$nodeDirectory = Join-Path $script:RepositoryRoot '.tools/node-v24.22.1-win-x64'
$nodePath = Join-Path $nodeDirectory 'node.exe'
if (-not (Test-Path -LiteralPath $nodePath)) {
    $distribution = 'https://nodejs.org/dist/v24.22.1'
    $archiveName = 'node-v24.22.1-win-x64.zip'
    $archivePath = Join-Path $script:RepositoryRoot ".tools/$archiveName"
    $checksums = (Invoke-WebRequest -UseBasicParsing "$distribution/SHASUMS256.txt").Content
    $checksumLine = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith(" $archiveName") } | Select-Object -First 1).Trim()
    if (-not $checksumLine) { throw 'The official Node.js checksum was not found.' }
    Invoke-WebRequest -UseBasicParsing "$distribution/$archiveName" -OutFile $archivePath
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne ($checksumLine -split '\s+')[0]) {
        throw 'The downloaded Node.js archive failed checksum validation.'
    }
    Expand-Archive -LiteralPath $archivePath -DestinationPath '.tools' -Force
}
Set-Content -LiteralPath '.tools/node-path.txt' -Value $nodeDirectory
$env:PATH = "$nodeDirectory;$(Split-Path $dotnetPath);$env:PATH"
if (-not (Test-Path -LiteralPath '.tools/pnpm/node_modules/pnpm/bin/pnpm.mjs')) {
    & (Join-Path $nodeDirectory 'npm.cmd') install --prefix .tools/pnpm --no-audit --no-fund pnpm@12.14.0
    if ($LASTEXITCODE -ne 0) { throw 'Local pnpm installation failed.' }
}
& "$PSScriptRoot/Initialize-Local.ps1" -SqlServer $SqlServer
Push-Location (Join-Path $script:RepositoryRoot 'backend')
try {
    & $dotnetPath restore GymFlow.sln --packages .tools/nuget
    if ($LASTEXITCODE -ne 0) { throw 'NuGet restore failed.' }
    & $dotnetPath build GymFlow.sln -c Release --no-restore -p:UseSharedCompilation=false -nodeReuse:false -m:1
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
} finally { Pop-Location }
Push-Location (Join-Path $script:RepositoryRoot 'frontend')
try {
    & ./run-pnpm.cmd install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
} finally { Pop-Location }
Write-Host 'Setup complete. Run: powershell -ExecutionPolicy Bypass -File scripts/Start-Local.ps1'
