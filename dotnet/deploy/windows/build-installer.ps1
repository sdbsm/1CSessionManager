param(
    [string]$Configuration = "Release",
    [string]$OutDir = (Join-Path $PSScriptRoot "..\\..\\out")
)

$ErrorActionPreference = "Stop"

$dotnet = Join-Path $env:ProgramFiles "dotnet\\dotnet.exe"
if (!(Test-Path $dotnet)) { throw "dotnet.exe not found at $dotnet" }

# 1. Publish Control and Agent (using existing script)
Write-Host "Building Control and Agent..."
& (Join-Path $PSScriptRoot "publish.ps1") -Configuration $Configuration -OutDir $OutDir

# 2. Package into payload.zip
Write-Host "Packaging payload.zip..."
$installerProjectDir = Join-Path $PSScriptRoot "..\..\src\1CSessionManager.Installer"
$payloadPath = Join-Path $installerProjectDir "payload.zip"

if (Test-Path $payloadPath) { Remove-Item $payloadPath }

# Ensure we are compressing the specific folders inside OutDir
$controlDir = Join-Path $OutDir "control"
$agentDir = Join-Path $OutDir "agent"

if (!(Test-Path $controlDir) -or !(Test-Path $agentDir)) {
    throw "Build artifacts missing in $OutDir"
}

# Compress-Archive requires paths. We want the structure inside the zip to be /control/ and /agent/
# Simplest way is to compress the items inside $OutDir that match control and agent
Push-Location $OutDir
try {
    Compress-Archive -Path "control", "agent" -DestinationPath $payloadPath -Force
} finally {
    Pop-Location
}

# 3. Publish Installer
Write-Host "Building Installer..."
$installerProject = Join-Path $installerProjectDir "1CSessionManager.Installer.csproj"

# Publish into a temp dir first to avoid "Access denied" when the target exe is locked (AV/scanner/running process).
$tmpOut = Join-Path $OutDir ("_installer_tmp_" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmpOut | Out-Null

& $dotnet publish $installerProject -c $Configuration -r win-x64 --self-contained true -o $tmpOut /p:PublishSingleFile=true /p:DebugType=embedded
if ($LASTEXITCODE -ne 0) { throw "Installer publish failed with exit code $LASTEXITCODE" }

$builtInstaller = Join-Path $tmpOut "1CSessionManager.Installer.exe"
if (!(Test-Path $builtInstaller)) {
    throw "Installer build failed or file not found at $builtInstaller"
}

$finalInstaller = Join-Path $OutDir "1CSessionManager.Installer.exe"
try {
    Copy-Item -Path $builtInstaller -Destination $finalInstaller -Force
    Write-Host "Installer created at: $finalInstaller"
} catch {
    $fallback = Join-Path $OutDir ("1CSessionManager.Installer-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".exe")
    Copy-Item -Path $builtInstaller -Destination $fallback -Force
    Write-Warning "Failed to overwrite '$finalInstaller' (it may be locked). Wrote: $fallback"
    $finalInstaller = $fallback
} finally {
    try { Remove-Item -Recurse -Force $tmpOut } catch { }
}

# Cleanup payload.zip from source if desired, or keep it for debugging
# Remove-Item $payloadPath

Write-Host "Build Complete."
Write-Host "To deploy:"
Write-Host "1. Copy '$finalInstaller' to the target server."
Write-Host "2. Run it as Administrator."
