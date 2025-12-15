param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

# 1. Publish artifacts
Write-Host "Publishing artifacts..."
& "$PSScriptRoot\publish.ps1" -Configuration $Configuration

# 2. Find Inno Setup Compiler
$iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (!(Test-Path $iscc)) {
    throw "Inno Setup Compiler (ISCC.exe) not found at $iscc. Please install Inno Setup 6."
}

# 3. Compile Installer
$issFile = Join-Path $PSScriptRoot "setup.iss"
Write-Host "Compiling Inno Setup script: $issFile"

& $iscc $issFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Installer built successfully!" -ForegroundColor Green
    $distDir = Resolve-Path (Join-Path $PSScriptRoot "..\..\dist")
    Write-Host "Installer is located at: $distDir"
} else {
    Write-Error "Inno Setup compilation failed with exit code $LASTEXITCODE"
}
