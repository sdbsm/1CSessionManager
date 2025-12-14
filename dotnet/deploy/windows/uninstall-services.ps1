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

foreach ($svc in @($svcAgent, $svcControl)) {
    sc.exe stop "$svc" *> $null
    sc.exe delete "$svc" *> $null
}

if (Test-Path $InstallDir) {
    Write-Host "Remove files: $InstallDir"
    Remove-Item -Recurse -Force $InstallDir
}

Write-Host "Uninstall complete."


