param(
    [string]$InstallDir = "C:\\Program Files\\1CSessionManager"
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
    $current = [Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Запустите PowerShell от имени администратора."
    }
}

Assert-Admin

$svcControl = "1C Session Manager Control"
$svcAgent = "1C Session Manager Agent"

function Test-ServiceExists([string]$ServiceName) {
    sc.exe query "$ServiceName" *> $null
    return ($LASTEXITCODE -eq 0)
}

function Get-ServiceState([string]$ServiceName) {
    $out = (sc.exe query "$ServiceName" 2>$null) | Out-String
    if (-not $out) { return $null }
    $m = [regex]::Match($out, 'STATE\s*:\s*\d+\s+(\w+)', 'IgnoreCase')
    if ($m.Success) { return $m.Groups[1].Value.ToUpperInvariant() }
    return $null
}

function Wait-ServiceState([string]$ServiceName, [string]$DesiredState, [int]$TimeoutSeconds = 30) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $desired = $DesiredState.ToUpperInvariant()
    while ([DateTime]::UtcNow -lt $deadline) {
        $state = Get-ServiceState $ServiceName
        if ($state -eq $desired) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

foreach ($svc in @($svcAgent, $svcControl)) {
    if (Test-ServiceExists $svc) {
        sc.exe stop "$svc" *> $null
        [void](Wait-ServiceState $svc "STOPPED" 30)
        sc.exe delete "$svc" *> $null
    }
}

if (Test-Path $InstallDir) {
    Write-Host "Remove files: $InstallDir"
    Remove-Item -Recurse -Force $InstallDir
}

Write-Host "Uninstall complete."


