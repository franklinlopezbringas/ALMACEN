$ErrorActionPreference = 'Stop'
$script:RepositoryRoot = Split-Path $PSScriptRoot -Parent

function Import-LocalEnvironment([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Missing local configuration: $Path. Run scripts/Initialize-Local.ps1 first." }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
        }
    }
}

function New-LocalSecret {
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}

function Expand-LocalSql([string]$Path) {
    $text = [IO.File]::ReadAllText($Path)
    return [regex]::Replace($text, '(?m)^:r\s+(.+)\r?$', {
        param($match)
        $relative = $match.Groups[1].Value.Trim().Trim('"')
        Expand-LocalSql (Join-Path (Join-Path $script:RepositoryRoot 'database') $relative)
    })
}

function Invoke-LocalSql([string]$ConnectionString, [string]$Sql) {
    $connection = New-Object System.Data.SqlClient.SqlConnection $ConnectionString
    try {
        $connection.Open()
        $sqlText = [regex]::Replace($Sql, '(?m)^:ON ERROR EXIT\s*$', '')
        foreach ($batch in [regex]::Split($sqlText, '(?im)^\s*GO\s*(?:--[^\r\n]*)?\r?$')) {
            if ([string]::IsNullOrWhiteSpace($batch)) { continue }
            $command = $connection.CreateCommand()
            $command.CommandTimeout = 180
            $command.CommandText = $batch
            try { [void]$command.ExecuteNonQuery() } finally { $command.Dispose() }
        }
    } finally { $connection.Dispose() }
}

function Get-LocalScalar([string]$ConnectionString, [string]$Sql) {
    $connection = New-Object System.Data.SqlClient.SqlConnection $ConnectionString
    try {
        $connection.Open()
        $command = $connection.CreateCommand()
        $command.CommandText = $Sql
        try { return $command.ExecuteScalar() } finally { $command.Dispose() }
    } finally { $connection.Dispose() }
}

function Get-LocalDotnet {
    $portable = Join-Path $script:RepositoryRoot 'backend/.tools/dotnet/dotnet.exe'
    if (Test-Path -LiteralPath $portable) { return $portable }
    return (Get-Command dotnet -ErrorAction Stop).Source
}

function Get-LocalNode {
    $marker = Join-Path $script:RepositoryRoot '.tools/node-path.txt'
    if (Test-Path -LiteralPath $marker) {
        $portable = Join-Path ((Get-Content -LiteralPath $marker -Raw).Trim()) 'node.exe'
        if (Test-Path -LiteralPath $portable) { return $portable }
    }
    return (Get-Command node -ErrorAction Stop).Source
}
