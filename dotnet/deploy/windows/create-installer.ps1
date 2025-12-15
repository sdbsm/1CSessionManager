param(
    [string]$Configuration = "Release",
    [string]$OutDir = (Join-Path $PSScriptRoot "..\..\out")
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$installerProject = Join-Path $root "src\1CSessionManager.Installer\1CSessionManager.Installer.csproj"
$payloadPath = Join-Path $root "src\1CSessionManager.Installer\payload.zip"

# 1. Ensure artifacts exist
if (!(Test-Path (Join-Path $OutDir "agent")) -or !(Test-Path (Join-Path $OutDir "control"))) {
    Write-Warning "Artifacts not found in $OutDir. Running publish.ps1..."
    & (Join-Path $PSScriptRoot "publish.ps1") -Configuration $Configuration
}

# 2. Create payload.zip
Write-Host "Creating payload.zip from $OutDir..."
if (Test-Path $payloadPath) { Remove-Item $payloadPath }

# We want 'agent' and 'control' folders at the root of the zip.
# Compressing the *content* of OutDir.
# Note: Compress-Archive can be finicky with structures.
# We will zip the agent and control directories specifically.

$agentDir = Join-Path $OutDir "agent"
$controlDir = Join-Path $OutDir "control"

# Create a temp dir to stage the exact structure we want
$tempStage = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempStage | Out-Null
try {
    Copy-Item -Path $agentDir -Destination $tempStage -Recurse
    Copy-Item -Path $controlDir -Destination $tempStage -Recurse

    Compress-Archive -Path "$tempStage\*" -DestinationPath $payloadPath -CompressionLevel Optimal
}
finally {
    Remove-Item $tempStage -Recurse -Force -ErrorAction SilentlyContinue
}

# 3. Build Installer
Write-Host "Building Installer..."
$installerOut = Join-Path $OutDir "1CSessionManager.Installer.exe" # This will be the folder if we use -o
# We want the output to be in the root of OutDir

$dotnet = Join-Path $env:ProgramFiles "dotnet\\dotnet.exe"
if (!(Test-Path $dotnet)) { throw "dotnet.exe not found at $dotnet" }

& $dotnet publish $installerProject -c $Configuration -o $OutDir -r win-x64 --self-contained true /p:PublishSingleFile=true /p:IncludeNativeLibrariesForSelfExtract=true

# 4. Cleanup
if (Test-Path $payloadPath) { Remove-Item $payloadPath }

Write-Host "Installer created at: $(Join-Path $OutDir "1CSessionManager.Installer.exe")"
