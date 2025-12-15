param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

# 1. Publish binaries
Write-Host "Running publish..."
& "$PSScriptRoot\publish.ps1" -Configuration $Configuration

# 2. Find Inno Setup
$iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) {
    $iscc = "C:\Program Files\Inno Setup 6\ISCC.exe"
}
if (-not (Test-Path $iscc)) {
    throw "Inno Setup Compiler (ISCC.exe) not found. Please install Inno Setup 6."
}

# 3. Build Installer
$issPath = Join-Path $PSScriptRoot "setup.iss"
Write-Host "Compiling installer: $issPath"

& $iscc $issPath

if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup compilation failed."
}

$distDir = Join-Path $PSScriptRoot "..\..\dist"
if (Test-Path $distDir) {
    $distDir = Resolve-Path $distDir
    Write-Host "Installer created successfully in: $distDir"
} else {
    Write-Host "Installer created, but output dir not found at expected location."
}
