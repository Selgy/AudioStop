@echo off
chcp 65001 > nul

echo =====================================
echo   AudioStop - Build Installer
echo =====================================
echo.

REM Check if NSIS is installed
set "MAKENSIS="
where makensis >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "MAKENSIS=makensis"
) else (
    if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
        set "MAKENSIS=C:\Program Files (x86)\NSIS\makensis.exe"
    ) else if exist "C:\Program Files\NSIS\makensis.exe" (
        set "MAKENSIS=C:\Program Files\NSIS\makensis.exe"
    ) else (
        echo [ERROR] NSIS not found!
        echo Please install NSIS from: https://nsis.sourceforge.io/Download
        echo.
        pause
        exit /b 1
    )
)
echo Found NSIS at: %MAKENSIS%

echo [1/4] Cleaning previous builds...
if exist "dist" rmdir /s /q "dist"

echo [2/4] Building Python executable...
cd /d "%~dp0src"
if not exist "audio_control_server.py" (
    echo [ERROR] audio_control_server.py not found in src folder!
    cd /d "%~dp0"
    pause
    exit /b 1
)
pyinstaller --onefile --noconsole --hidden-import=websockets --hidden-import=pycaw --hidden-import=comtypes --hidden-import=psutil --add-data "icon.ico;." --icon=icon.ico audio_control_server.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python build failed!
    cd /d "%~dp0"
    pause
    exit /b 1
)
cd /d "%~dp0"

echo [3/4] Building CEP extension...
call yarn build:cep
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] CEP build failed!
    pause
    exit /b 1
)

echo [4/4] Creating installer...
REM Copy Python executable to dist/cep/exec
if not exist "dist\cep\exec" mkdir "dist\cep\exec"
copy "src\dist\audio_control_server.exe" "dist\cep\exec\audio_control_server.exe" /Y

REM Build NSIS installer
"%MAKENSIS%" /DVERSION=2.0.0 installer.nsi
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Installer creation failed!
    pause
    exit /b 1
)

echo.
echo =====================================
echo   ✅ Build completed successfully!
echo =====================================
echo.
echo Installer created: AudioStop-2.0.0-Setup.exe
echo.
pause

