<#
  Permanently adds the .NET install directory to the USER PATH (Windows).

  Usage:
    PS> cd dotnet
    PS> .\install-dotnet-path.ps1

  Notes:
    - Writes to the USER-level Path variable (no admin required).
    - You must open a NEW terminal after running to see PATH changes everywhere.
    - Also updates PATH for the current session.
#>

$ErrorActionPreference = "Stop"

function Get-DotnetInstallDir {
  $candidates = @()
  if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles "dotnet") }
  if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} "dotnet") }

  $dir =
    $candidates |
    Where-Object { $_ -and (Test-Path $_) } |
    Select-Object -First 1

  if (-not $dir) {
    throw "Не найден каталог dotnet. Установите .NET SDK или укажите путь вручную."
  }

  return $dir
}

function Add-ToPathIfMissing([string]$pathValue, [string]$dirToAdd) {
  $parts = ($pathValue -split ";") | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() }
  $exists = $parts | Where-Object { $_.TrimEnd("\") -ieq $dirToAdd.TrimEnd("\") } | Select-Object -First 1
  if ($exists) { return $pathValue }
  if (-not $pathValue -or -not $pathValue.Trim()) { return $dirToAdd }
  return "$dirToAdd;$pathValue"
}

$dotnetDir = Get-DotnetInstallDir

# Update current session first (so we can validate immediately)
$env:Path = Add-ToPathIfMissing -pathValue $env:Path -dirToAdd $dotnetDir

# Persist to USER PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$newUserPath = Add-ToPathIfMissing -pathValue $userPath -dirToAdd $dotnetDir

if ($newUserPath -ne $userPath) {
  [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  throw "dotnet всё ещё не доступен. Проверьте установку .NET SDK и откройте новый терминал."
}

Write-Host "OK: добавлено в USER PATH: $dotnetDir"
Write-Host "Откройте новый терминал, чтобы PATH применился везде."

