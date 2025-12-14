param(
    [string]$Configuration = "Release",
    [string]$OutDir = (Join-Path $PSScriptRoot "..\\..\\out")
)

$ErrorActionPreference = "Stop"

$dotnet = Join-Path $env:ProgramFiles "dotnet\\dotnet.exe"
if (!(Test-Path $dotnet)) { throw "dotnet.exe not found at $dotnet" }

$root = Resolve-Path (Join-Path $PSScriptRoot "..\\..")
$sln = Join-Path $root "1CSessionManager.slnx"

Write-Host "Publishing solution: $sln"
Write-Host "OutDir: $OutDir"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$controlOut = Join-Path $OutDir "control"
$agentOut = Join-Path $OutDir "agent"

# Build React UI (Vite outputs into Control wwwroot/app)
$repoRoot = Resolve-Path (Join-Path $root "..")
if (Test-Path (Join-Path $repoRoot "ui\\package.json")) {
    Write-Host "Building UI (npm run build)..."
    Push-Location (Join-Path $repoRoot "ui")
    try {
        npm install --no-audit --no-fund
        npm run build
    } finally {
        Pop-Location
    }
}

& $dotnet publish (Join-Path $root "src\\1CSessionManager.Control\\1CSessionManager.Control.csproj") -c $Configuration -o $controlOut --self-contained false
& $dotnet publish (Join-Path $root "src\\1CSessionManager.Agent\\1CSessionManager.Agent.csproj") -c $Configuration -o $agentOut --self-contained false

Write-Host "Publish completed."


