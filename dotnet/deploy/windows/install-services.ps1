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

function Stop-ServiceSafe([string]$ServiceName, [int]$TimeoutSeconds = 30) {
    if (-not (Test-ServiceExists $ServiceName)) { return }
    $state = Get-ServiceState $ServiceName
    if ($state -eq "STOPPED") { return }
    sc.exe stop "$ServiceName" *> $null
    [void](Wait-ServiceState $ServiceName "STOPPED" $TimeoutSeconds)
}

function Start-ServiceSafe([string]$ServiceName, [int]$TimeoutSeconds = 30) {
    if (-not (Test-ServiceExists $ServiceName)) { return }
    sc.exe start "$ServiceName" *> $null
    [void](Wait-ServiceState $ServiceName "RUNNING" $TimeoutSeconds)
}

Assert-Admin

Write-Host "Installing to: $InstallDir"

# Services
$svcControl = "1C Session Manager Control"
$svcAgent = "1C Session Manager Agent"

# 1) Publish
& (Join-Path $PSScriptRoot "publish.ps1") -Configuration $Configuration -OutDir (Join-Path $PSScriptRoot "..\\..\\out")

$outRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..\\out")

$controlSrc = Join-Path $outRoot "control"
$agentSrc = Join-Path $outRoot "agent"

$controlDst = Join-Path $InstallDir "control"
$agentDst = Join-Path $InstallDir "agent"

New-Item -ItemType Directory -Force -Path $controlDst | Out-Null
New-Item -ItemType Directory -Force -Path $agentDst | Out-Null

# 1.5) Stop services (avoid locked binaries during upgrade)
Stop-ServiceSafe $svcControl -TimeoutSeconds 30
Stop-ServiceSafe $svcAgent -TimeoutSeconds 30

# 1.6) Preserve user configs (do not overwrite appsettings.json on upgrade)
$controlAppsettingsPath = Join-Path $controlDst "appsettings.json"
$agentAppsettingsPath = Join-Path $agentDst "appsettings.json"

# Backup ALL appsettings*.json (upgrade-safe)
$controlAppsettingsBackup = @{}
$agentAppsettingsBackup = @{}
Get-ChildItem -Path $controlDst -Filter "appsettings*.json" -File -ErrorAction SilentlyContinue | ForEach-Object {
    try { $controlAppsettingsBackup[$_.Name] = Get-Content -Raw -Path $_.FullName } catch { }
}
Get-ChildItem -Path $agentDst -Filter "appsettings*.json" -File -ErrorAction SilentlyContinue | ForEach-Object {
    try { $agentAppsettingsBackup[$_.Name] = Get-Content -Raw -Path $_.FullName } catch { }
}

# Copy binaries/assets, but never overwrite appsettings*.json
Copy-Item -Path (Join-Path $controlSrc "*") -Destination $controlDst -Recurse -Force -Exclude "appsettings*.json"
Copy-Item -Path (Join-Path $agentSrc "*") -Destination $agentDst -Recurse -Force -Exclude "appsettings*.json"

# Restore or seed configs
foreach ($name in $controlAppsettingsBackup.Keys) {
    try { Set-Content -Path (Join-Path $controlDst $name) -Value $controlAppsettingsBackup[$name] -Encoding UTF8 } catch { }
}
if ($controlAppsettingsBackup.Count -eq 0) {
    Get-ChildItem -Path $controlSrc -Filter "appsettings*.json" -File -ErrorAction SilentlyContinue | ForEach-Object {
        try { Copy-Item -Path $_.FullName -Destination (Join-Path $controlDst $_.Name) -Force } catch { }
    }
}

foreach ($name in $agentAppsettingsBackup.Keys) {
    try { Set-Content -Path (Join-Path $agentDst $name) -Value $agentAppsettingsBackup[$name] -Encoding UTF8 } catch { }
}
if ($agentAppsettingsBackup.Count -eq 0) {
    Get-ChildItem -Path $agentSrc -Filter "appsettings*.json" -File -ErrorAction SilentlyContinue | ForEach-Object {
        try { Copy-Item -Path $_.FullName -Destination (Join-Path $agentDst $_.Name) -Force } catch { }
    }
}

$controlExe = Join-Path $controlDst "1CSessionManager.Control.exe"
$agentExe = Join-Path $agentDst "1CSessionManager.Agent.exe"

if (!(Test-Path $controlExe)) { throw "Control exe not found: $controlExe" }
if (!(Test-Path $agentExe)) { throw "Agent exe not found: $agentExe" }

# 2) Install services (LocalSystem by default)
if (Test-ServiceExists $svcControl) {
    Write-Host "Service already exists: $svcControl (updating config)"
} else {
    sc.exe create "$svcControl" binPath= "\"$controlExe\"" start= auto | Out-Null
}
sc.exe config "$svcControl" binPath= "\"$controlExe\"" start= auto | Out-Null
sc.exe description "$svcControl" "1C Session Manager Control API (ASP.NET Core)" | Out-Null
sc.exe failure "$svcControl" reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null

if (Test-ServiceExists $svcAgent) {
    Write-Host "Service already exists: $svcAgent (updating config)"
} else {
    sc.exe create "$svcAgent" binPath= "\"$agentExe\"" start= auto | Out-Null
}
sc.exe config "$svcAgent" binPath= "\"$agentExe\"" start= auto | Out-Null
sc.exe description "$svcAgent" "1C Session Manager Agent (RAC monitoring + enforcement)" | Out-Null
sc.exe failure "$svcAgent" reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null

# 3) Start
Start-ServiceSafe $svcControl -TimeoutSeconds 30
Start-ServiceSafe $svcAgent -TimeoutSeconds 30

Write-Host "Done."
Write-Host "NOTE: before start, configure connection string in:"
Write-Host "  $controlDst\\appsettings.json"
Write-Host "  $agentDst\\appsettings.json"


