<#
  Adds the .NET SDK install directory to PATH for the current PowerShell session.

  Usage:
    PS> . .\activate.ps1

  Notes:
    - This affects only the current terminal session.
    - If `dotnet` is already available, the script is a no-op.
#>

$ErrorActionPreference = "Stop"

if (Get-Command dotnet -ErrorAction SilentlyContinue) {
  return
}

$candidates = @()
if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles "dotnet") }
if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} "dotnet") }

$dotnetDir =
  $candidates |
  Where-Object { $_ -and (Test-Path $_) } |
  Select-Object -First 1

if (-not $dotnetDir) {
  throw "Не найден каталог dotnet. Установите .NET SDK или укажите путь вручную."
}

$pathParts = $env:Path -split ";" | Where-Object { $_ -and $_.Trim() }
$alreadyInPath = $pathParts | Where-Object { $_.TrimEnd("\") -ieq $dotnetDir.TrimEnd("\") } | Select-Object -First 1

if (-not $alreadyInPath) {
  $env:Path = "$dotnetDir;$env:Path"
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  throw "Не удалось активировать dotnet через PATH (проверьте установку .NET SDK)."
}

