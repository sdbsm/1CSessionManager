
# Инструкция по сборке и установке 1C Session Manager

Данная инструкция описывает процесс создания единого установочного файла `setup.exe` для Windows Server.

## Предварительные требования для разработчика
Для сборки инсталлятора на вашем компьютере должны быть установлены:
1. **Node.js** (для сборки проекта).
2. **Inno Setup** (скачать с [jrsoftware.org](https://jrsoftware.org/isdl.php)).

---

## Этап 1: Подготовка файлов проекта

Выполните эти действия на машине разработчика, чтобы подготовить "чистую" версию для сборки.

1. **Сборка Frontend (React):**
   Откройте терминал в папке проекта и выполните:
   ```bash
   npm install
   npm run build
   ```
   После этого появится папка `dist`. **Переименуйте её в `public`**. Если папка `public` уже есть, замените её содержимое.

2. **Подготовка Backend зависимостей:**
   В корне проекта (где лежат `server.js` и `package.json`) выполните установку библиотек для production.
   **ВАЖНО:** Обязательно установите `iconv-lite` для корректной работы с русской консолью 1С.
   ```bash
   npm install express body-parser node-windows cors iconv-lite --production
   ```
   *Это создаст папку `node_modules` со всеми необходимыми библиотеками.*

---

## Этап 2: Компиляция Setup.exe

Теперь мы упакуем все файлы (сервер, фронтенд, библиотеки) в один `.exe`.

1. **Создайте файл конфигурации Inno Setup:**
   В корне проекта создайте текстовый файл с именем `setup.iss`.
   Откройте его в Блокноте и вставьте следующий код:

   ```ini
   [Setup]
   AppName=1C Session Manager
   AppVersion=1.0
   DefaultDirName={commonpf64}\1C Session Manager
   DefaultGroupName=1C Session Manager
   OutputDir=.
   OutputBaseFilename=1CManager_Setup
   Compression=lzma2
   SolidCompression=yes
   PrivilegesRequired=admin
   ArchitecturesInstallIn64BitMode=x64

   [Files]
   ; Основной файл сервера
   Source: "server.js"; DestDir: "{app}"; Flags: ignoreversion
   ; Скрипты управления службой
   Source: "install_service.js"; DestDir: "{app}"; Flags: ignoreversion
   Source: "uninstall_service.js"; DestDir: "{app}"; Flags: ignoreversion
   ; Папка с фронтендом
   Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs
   ; Зависимости Node.js
   Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

   [Run]
   ; Установка и запуск службы после распаковки
   Filename: "{cmd}"; Parameters: "/C node install_service.js"; WorkingDir: "{app}"; Flags: runhidden

   [UninstallRun]
   ; Удаление службы перед удалением файлов
   Filename: "{cmd}"; Parameters: "/C node uninstall_service.js"; WorkingDir: "{app}"; Flags: runhidden
   ```

2. **ВАЖНО: Проверка структуры папок**
   Перед нажатием "Compile" убедитесь, что в папке с `setup.iss` существуют:
   *  Файл `server.js`
   *  Папка `public` (результат билда фронтенда)
   *  Папка `node_modules` (результат npm install)
   *  **Убедитесь, что вы установили iconv-lite**

3. **Запустите компиляцию:**
   * Откройте установленный **Inno Setup Compiler**.
   * Нажмите `File -> Open` и выберите файл `setup.iss`.
   * Нажмите кнопку **Compile**.

4. **Результат:**
   В папке проекта появится файл **`1CManager_Setup.exe`**.

---

## Этап 3: Установка на Windows Server (У Клиента)

Теперь у вас есть один файл. Перенесите его на целевой Windows Server.

### Требования к серверу:
* На сервере должен быть установлен **Node.js**.
* Установлена платформа 1С и запущена служба RAS (порт 1545).

### Настройка после установки:
1. Запустите `1CManager_Setup.exe` от имени Администратора.
2. Откройте браузер `http://localhost:3000` и перейдите в **Настройки**.
3. Укажите путь к `rac.exe` (например, `C:\Program Files\1cv8\...\bin\rac.exe`). Кавычки ставить не нужно.
4. Нажмите "Проверить соединение".

Если вы видите ошибку "RAC Executable not found", проверьте, что файл реально существует по этому пути.
