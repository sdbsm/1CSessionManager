; Inno Setup Script for 1C Session Manager
; Компиляция: Inno Setup Compiler

#define MyAppName "1C Session Manager"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Your Company"
#define MyAppURL "https://github.com/your-repo"

[Setup]
AppId={{A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={commonpf64}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=installer
OutputBaseFilename=1C-Session-Manager-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "installservice"; Description: "Установить как службу Windows"; GroupDescription: "Дополнительно:"; Flags: checkedonce

[Files]
; Основной файл сервера
Source: "server.js"; DestDir: "{app}"; Flags: ignoreversion
; Конфигурационные файлы
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "tsconfig.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "vite.config.ts"; DestDir: "{app}"; Flags: ignoreversion
Source: "index.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "index.tsx"; DestDir: "{app}"; Flags: ignoreversion
Source: "types.ts"; DestDir: "{app}"; Flags: ignoreversion
Source: "metadata.json"; DestDir: "{app}"; Flags: ignoreversion
; Скрипты управления службой
Source: "install_service.cjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall_service.cjs"; DestDir: "{app}"; Flags: ignoreversion
; Компоненты приложения
Source: "components\*"; DestDir: "{app}\components"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "pages\*"; DestDir: "{app}\pages"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "services\*"; DestDir: "{app}\services"; Flags: ignoreversion recursesubdirs createallsubdirs
; Папка с фронтендом (если есть)
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
; Зависимости Node.js
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
; Документация
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "WINDOWS_DEPLOYMENT.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "http://localhost:3000"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://localhost:3000"; Tasks: desktopicon

[Run]
; Установка и запуск службы после распаковки
Filename: "{cmd}"; Parameters: "/C node install_service.cjs > ""{app}\install_log.txt"" 2>&1"; WorkingDir: "{app}"; StatusMsg: "Установка службы Windows..."; Flags: waituntilterminated; Tasks: installservice

[UninstallRun]
; Удаление службы перед удалением файлов
Filename: "{cmd}"; Parameters: "/C node uninstall_service.cjs"; WorkingDir: "{app}"; Flags: runhidden
