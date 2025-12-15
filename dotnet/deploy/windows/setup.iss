[Setup]
AppId={{E6805174-88A9-497B-9E32-1C3D88377755}
AppName=1C Session Manager
AppVersion=1.0.0
AppPublisher=Andrew
DefaultDirName={autopf}\1CSessionManager
DefaultGroupName=1C Session Manager
OutputBaseFilename=1CSessionManagerSetup
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
OutputDir=..\..\dist
DisableProgramGroupPage=yes

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "install_service"; Description: "Установить и запустить как службу Windows"; GroupDescription: "Дополнительные задачи:"; Flags: unchecked

[Dirs]
Name: "{app}\control"
Name: "{app}\agent"

[Files]
; Control
Source: "..\..\out\control\*"; DestDir: "{app}\control"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "appsettings*.json"
Source: "..\..\out\control\appsettings.json"; DestDir: "{app}\control"; Flags: onlyifdoesntexist
; Agent
Source: "..\..\out\agent\*"; DestDir: "{app}\agent"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "appsettings*.json"
Source: "..\..\out\agent\appsettings.json"; DestDir: "{app}\agent"; Flags: onlyifdoesntexist

[Run]
; Install Services if task selected
Filename: "{sys}\sc.exe"; Parameters: "create ""1C Session Manager Control"" binPath= ""\""{app}\control\1CSessionManager.Control.exe\"""" start= auto"; Flags: runhidden; Tasks: install_service; Check: ServiceNotExists('1C Session Manager Control')
Filename: "{sys}\sc.exe"; Parameters: "config ""1C Session Manager Control"" binPath= ""\""{app}\control\1CSessionManager.Control.exe\"""" start= auto"; Flags: runhidden; Tasks: install_service
Filename: "{sys}\sc.exe"; Parameters: "description ""1C Session Manager Control"" ""1C Session Manager Control API (ASP.NET Core)"""; Flags: runhidden; Tasks: install_service
Filename: "{sys}\sc.exe"; Parameters: "failure ""1C Session Manager Control"" reset= 86400 actions= restart/5000/restart/5000/restart/5000"; Flags: runhidden; Tasks: install_service

Filename: "{sys}\sc.exe"; Parameters: "create ""1C Session Manager Agent"" binPath= ""\""{app}\agent\1CSessionManager.Agent.exe\"""" start= auto"; Flags: runhidden; Tasks: install_service; Check: ServiceNotExists('1C Session Manager Agent')
Filename: "{sys}\sc.exe"; Parameters: "config ""1C Session Manager Agent"" binPath= ""\""{app}\agent\1CSessionManager.Agent.exe\"""" start= auto"; Flags: runhidden; Tasks: install_service
Filename: "{sys}\sc.exe"; Parameters: "description ""1C Session Manager Agent"" ""1C Session Manager Agent (RAC monitoring + enforcement)"""; Flags: runhidden; Tasks: install_service
Filename: "{sys}\sc.exe"; Parameters: "failure ""1C Session Manager Agent"" reset= 86400 actions= restart/5000/restart/5000/restart/5000"; Flags: runhidden; Tasks: install_service

; Start Services
Filename: "{sys}\sc.exe"; Parameters: "start ""1C Session Manager Control"""; Flags: runhidden; Tasks: install_service
Filename: "{sys}\sc.exe"; Parameters: "start ""1C Session Manager Agent"""; Flags: runhidden; Tasks: install_service

[UninstallRun]
; Stop and Delete Services
Filename: "{sys}\sc.exe"; Parameters: "stop ""1C Session Manager Control"""; Flags: runhidden; RunOnceId: "StopControl"
Filename: "{sys}\sc.exe"; Parameters: "stop ""1C Session Manager Agent"""; Flags: runhidden; RunOnceId: "StopAgent"
Filename: "{sys}\timeout.exe"; Parameters: "/t 5"; Flags: runhidden; RunOnceId: "WaitStop"
Filename: "{sys}\sc.exe"; Parameters: "delete ""1C Session Manager Control"""; Flags: runhidden; RunOnceId: "DeleteControl"
Filename: "{sys}\sc.exe"; Parameters: "delete ""1C Session Manager Agent"""; Flags: runhidden; RunOnceId: "DeleteAgent"

[Code]
var
  ControlConfigBackup: AnsiString;
  AgentConfigBackup: AnsiString;

function ServiceNotExists(ServiceName: String): Boolean;
var
  ResultCode: Integer;
begin
  Exec('sc.exe', 'query "' + ServiceName + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := (ResultCode <> 0);
end;

procedure StopServices;
var
  ResultCode: Integer;
begin
  Exec('sc.exe', 'stop "1C Session Manager Control"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('sc.exe', 'stop "1C Session Manager Agent"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(2000);
end;

function GetUninstallString(): String;
var
  sUnInstPath: String;
  sUnInstPathKey: String;
begin
  sUnInstPath := '';
  sUnInstPathKey := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#SetupSetting("AppId")}_is1';
  if RegQueryStringValue(HKLM, sUnInstPathKey, 'UninstallString', sUnInstPath) then
    Result := sUnInstPath
  else
    Result := '';
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  sUnInstallString: String;
  ResultCode: Integer;
begin
  Result := '';
  sUnInstallString := GetUninstallString();
  if sUnInstallString <> '' then
  begin
    // Old version found.
    // 1. Backup configs
    if FileExists(ExpandConstant('{app}\control\appsettings.json')) then
    begin
        LoadStringFromFile(ExpandConstant('{app}\control\appsettings.json'), ControlConfigBackup);
    end;
    if FileExists(ExpandConstant('{app}\agent\appsettings.json')) then
    begin
        LoadStringFromFile(ExpandConstant('{app}\agent\appsettings.json'), AgentConfigBackup);
    end;

    // 2. Run Uninstaller
    sUnInstallString := RemoveQuotes(sUnInstallString);
    if Exec(sUnInstallString, '/SILENT /NORESTART /SUPPRESSMSGBOXES', '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then
    begin
       // Uninstall successful - wait a bit for file release
       Sleep(2000);
    end
    else
    begin
       Result := 'Не удалось удалить предыдущую версию. Пожалуйста, удалите её вручную.';
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    StopServices;
  end;
  
  if CurStep = ssPostInstall then
  begin
    if Length(ControlConfigBackup) > 0 then
    begin
       SaveStringToFile(ExpandConstant('{app}\control\appsettings.json'), ControlConfigBackup, False);
    end;
    if Length(AgentConfigBackup) > 0 then
    begin
       SaveStringToFile(ExpandConstant('{app}\agent\appsettings.json'), AgentConfigBackup, False);
    end;
  end;
end;
