$ErrorActionPreference = 'Stop'
$backend = Split-Path $PSScriptRoot -Parent
$pidFile = Join-Path $backend 'artifacts/api.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { return }
$apiProcessId = [int](Get-Content -LiteralPath $pidFile)
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $apiProcessId"
$assembly = Join-Path $backend 'src/GymFlow.Api/bin/Release/net10.0/GymFlow.Api.dll'
if ($process -and $process.CommandLine.Contains($assembly)) {
    Stop-Process -Id $apiProcessId
} elseif ($process) {
    throw 'PID belongs to another process; it was not stopped.'
}
