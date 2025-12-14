param(
    [string]$InstallDir = "C:\\Program Files\\1CSessionManager",
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

function Assert-Admin {
    $current = [Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Запустите PowerShell от имени администратора."
    }
}

Assert-Admin

Write-Host "Installing to: $InstallDir"

# 1) Publish
& (Join-Path $PSScriptRoot "publish.ps1") -Configuration $Configuration -OutDir (Join-Path $PSScriptRoot "..\\..\\out")

$outRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..\\out")

$controlSrc = Join-Path $outRoot "control"
$agentSrc = Join-Path $outRoot "agent"

$controlDst = Join-Path $InstallDir "control"
$agentDst = Join-Path $InstallDir "agent"

New-Item -ItemType Directory -Force -Path $controlDst | Out-Null
New-Item -ItemType Directory -Force -Path $agentDst | Out-Null

Copy-Item -Path (Join-Path $controlSrc "*") -Destination $controlDst -Recurse -Force
Copy-Item -Path (Join-Path $agentSrc "*") -Destination $agentDst -Recurse -Force

$controlExe = Join-Path $controlDst "1CSessionManager.Control.exe"
$agentExe = Join-Path $agentDst "1CSessionManager.Agent.exe"

if (!(Test-Path $controlExe)) { throw "Control exe not found: $controlExe" }
if (!(Test-Path $agentExe)) { throw "Agent exe not found: $agentExe" }

# 2) Install services (LocalSystem by default)
$svcControl = "1C Session Manager Control"
$svcAgent = "1C Session Manager Agent"

sc.exe query "$svcControl" *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Service already exists: $svcControl (skipping create)"
} else {
    sc.exe create "$svcControl" binPath= "\"$controlExe\"" start= auto
    sc.exe description "$svcControl" "1C Session Manager Control API (ASP.NET Core)"
    sc.exe failure "$svcControl" reset= 86400 actions= restart/5000/restart/5000/restart/5000
}

sc.exe query "$svcAgent" *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Service already exists: $svcAgent (skipping create)"
} else {
    sc.exe create "$svcAgent" binPath= "\"$agentExe\"" start= auto
    sc.exe description "$svcAgent" "1C Session Manager Agent (RAC monitoring + enforcement)"
    sc.exe failure "$svcAgent" reset= 86400 actions= restart/5000/restart/5000/restart/5000
}

# 3) Start
sc.exe start "$svcControl" *> $null
sc.exe start "$svcAgent" *> $null

Write-Host "Done."
Write-Host "NOTE: before start, configure connection string in:"
Write-Host "  $controlDst\\appsettings.json"
Write-Host "  $agentDst\\appsettings.json"


