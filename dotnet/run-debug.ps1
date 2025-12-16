# Скрипт для запуска проекта в режиме отладки
$ErrorActionPreference = "Stop"

# Активация dotnet
. .\activate.ps1

Write-Host "=== Запуск 1CSessionManager.Control для отладки ===" -ForegroundColor Green
Write-Host ""

# Сборка UI (если нужно)
$uiPath = "..\ui"
if (Test-Path $uiPath) {
    Write-Host "Сборка UI..." -ForegroundColor Yellow
    Push-Location $uiPath
    if (-not (Test-Path "node_modules")) {
        Write-Host "Установка зависимостей npm..." -ForegroundColor Yellow
        npm install
    }
    npm run build
    Pop-Location
    Write-Host "UI собран успешно" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Запуск сервера..." -ForegroundColor Yellow
Write-Host "Приложение будет доступно по адресу: http://localhost:5095" -ForegroundColor Cyan
Write-Host "UI будет доступен по адресу: http://localhost:5095/app/" -ForegroundColor Cyan
Write-Host ""

# Запуск Control
dotnet run --project src/1CSessionManager.Control/1CSessionManager.Control.csproj

