. "$PSScriptRoot/Local.Common.ps1"
foreach ($name in @('frontend','backend')) {
    $pidFile = Join-Path $script:RepositoryRoot "artifacts/local/$name.pid"
    if (-not (Test-Path -LiteralPath $pidFile)) { continue }
    $serviceProcessId = [int](Get-Content -LiteralPath $pidFile)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$serviceProcessId" -ErrorAction SilentlyContinue
    if ($process) {
        $expected = if ($name -eq 'backend') { 'GymFlow.Api.dll' } else { 'node_modules/next/dist/bin/next' }
        if ($process.CommandLine -notlike "*$expected*" -or $process.ExecutablePath -notlike "$script:RepositoryRoot\*") {
            throw "PID $serviceProcessId does not match this repository's $name. It was left running."
        }
        & taskkill.exe /PID $serviceProcessId /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Unable to stop $name (PID $serviceProcessId)." }
        Write-Host "Stopped $name (PID $serviceProcessId)."
    }
    Remove-Item -LiteralPath $pidFile
}
