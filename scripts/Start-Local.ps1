. "$PSScriptRoot/Local.Common.ps1"
Import-LocalEnvironment (Join-Path $script:RepositoryRoot 'backend/.env.local')
$dotnet = Get-LocalDotnet
$node = Get-LocalNode
$env:PATH = "$(Split-Path $node);$(Split-Path $dotnet);$env:PATH"
$logs = Join-Path $script:RepositoryRoot 'artifacts/local'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
foreach ($requiredPath in @('backend/src/GymFlow.Api/bin/Release/net10.0/GymFlow.Api.dll','frontend/node_modules/next/dist/bin/next','frontend/.env.local')) {
    if (-not (Test-Path -LiteralPath (Join-Path $script:RepositoryRoot $requiredPath))) {
        throw "Missing $requiredPath. Run scripts/Setup-Local.ps1 first."
    }
}
$services = @(
    @{ Name='backend'; Port=5080; Exe=$dotnet; Args=@('"' + (Join-Path $script:RepositoryRoot 'backend/src/GymFlow.Api/bin/Release/net10.0/GymFlow.Api.dll') + '"'); Directory=(Join-Path $script:RepositoryRoot 'backend/src/GymFlow.Api'); Health='http://127.0.0.1:5080/health/ready' }
    @{ Name='frontend'; Port=3000; Exe=$node; Args=@('node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3000'); Directory=(Join-Path $script:RepositoryRoot 'frontend'); Health='http://127.0.0.1:3000/login' }
)
foreach ($service in $services) {
    $pidFile = Join-Path $logs ($service.Name + '.pid')
    $existing = $null
    if (Test-Path -LiteralPath $pidFile) {
        $existing = Get-Process -Id ([int](Get-Content -LiteralPath $pidFile)) -ErrorAction SilentlyContinue
        if ($existing) {
            $details = Get-CimInstance Win32_Process -Filter "ProcessId=$($existing.Id)"
            $expected = if ($service.Name -eq 'backend') { 'GymFlow.Api.dll' } else { 'node_modules/next/dist/bin/next' }
            if ($details.ExecutablePath -ne $service.Exe -or $details.CommandLine -notlike "*$expected*") { $existing = $null }
        }
    }
    if (-not $existing) {
        $listener = New-Object System.Net.Sockets.TcpListener ([Net.IPAddress]::Loopback), $service.Port
        try { $listener.Start() } catch { throw "Port $($service.Port) is already in use. No unrelated process was stopped." } finally { $listener.Stop() }
        $process = Start-Process -FilePath $service.Exe -ArgumentList $service.Args -WorkingDirectory $service.Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs ($service.Name + '.stdout.log')) -RedirectStandardError (Join-Path $logs ($service.Name + '.stderr.log'))
        Set-Content -LiteralPath $pidFile -Value $process.Id
    }
    $ready = $false
    for ($attempt=0; $attempt -lt 60; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $service.Health -TimeoutSec 15
            if ($response.StatusCode -eq 200) { $ready=$true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw "$($service.Name) failed to become ready. See $logs." }
    Write-Host "$($service.Name): $($service.Health)"
}
