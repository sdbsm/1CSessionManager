## 1C Session Manager (.NET 10)

### Что это
- **Control** (`1CSessionManager.Control`): ASP.NET Core API + раздача UI (`/app`).
- **Agent** (`1CSessionManager.Agent`): Windows Worker Service, который запускает `rac.exe`, считает сессии и (при необходимости) завершает лишние.
- **Shared**: общие сущности и `AppDbContext` (EF Core).

Сейчас обе службы рассчитаны на сценарий **«всё на одном сервере»**, но модель данных и понятие `AgentInstance` подготовлены под **несколько серверов/агентов**.

### MSSQL (обязательно)
MSSQL подключается **без хранения паролей в конфиге**:
- В `appsettings.json` задаются только **Server/Database** (без User/Password)
- **SQL login (User/Password)** задаётся через UI и хранится в **Windows Credential Manager** (DPAPI LocalMachine)

Файлы настроек:
- `dotnet/src/1CSessionManager.Control/appsettings.json` → `Database:Sql:Server`, `Database:Sql:Database`
- `dotnet/src/1CSessionManager.Agent/appsettings.json` → `Database:Sql:Server`, `Database:Sql:Database`

### Миграции
Миграции хранятся в `dotnet/src/1CSessionManager.Control/Data/Migrations`.

Для дев-сборки можно включить автоприменение миграций:
- `dotnet/src/1CSessionManager.Control/appsettings.Development.json` → `Database:AutoMigrate=true`

### Запуск в консоли (для теста)
Если в PowerShell у вас `dotnet` недоступен (приходится писать полный путь до `dotnet.exe`), активируйте PATH для текущего терминала:
- `cd dotnet`
- `. .\activate.ps1`

Чтобы добавить `dotnet` в PATH **постоянно** (на уровне пользователя Windows):
- `cd dotnet`
- `.\install-dotnet-path.ps1`
- затем **откройте новый терминал**

Дальше из папки `dotnet/`:
- `dotnet run --project src/1CSessionManager.Control`
- `dotnet run --project src/1CSessionManager.Agent`

### UI (React)
Исходники UI находятся в папке `ui/` (в корне репозитория).

Сборка UI кладёт файлы в:
- `dotnet/src/1CSessionManager.Control/wwwroot/app`

Команды (из корня репозитория):
- `cd ui`
- `npm install`
- `npm run build`

UI доступен по:
- `http://localhost:3000/app/`

Все основные настройки вводятся в UI:
- `http://localhost:3000/app/` → **Settings**

### Установка как Windows Service (рекомендуется)
Скрипты:
- `dotnet/deploy/windows/install-services.ps1`
- `dotnet/deploy/windows/uninstall-services.ps1`

Требования:
- запуск PowerShell **от имени администратора**
- установлен .NET Runtime 10 (или используйте self-contained publish позже)

### Важно про RAC
Путь к `rac.exe` и `rasHost` задаются через UI (Settings), затем Agent начинает видеть кластер/инфобазы/сессии.

### Секреты (пароли) — только через веб
- **SQL login** (MSSQL) хранится в **Windows Credential Manager** (DPAPI LocalMachine), вводится через UI.
- **API key** (для защиты `/api/*` при доступе по IP) вводится/генерируется в UI и хранится в MSSQL в защищённом виде (DPAPI LocalMachine).

`/settings.html` остаётся как резервная страница (на случай если UI не собран/сломался), но в обычной работе не нужна.


