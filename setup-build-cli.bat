@echo off
chcp 65001 >nul
setlocal

:: 切到此 bat 所在目錄（creator-cli 擴充根目錄）
cd /d "%~dp0"

echo ========================================
echo  Creator CLI — 快速建置與本機 CLI 設定
echo ========================================
echo.

echo [1/4] 安裝依賴...
call npm install
if errorlevel 1 (
    echo 錯誤: npm install 失敗
    pause
    exit /b 1
)
echo.

echo [2/4] 編譯 TypeScript (source -^> dist)...
call npm run build
if errorlevel 1 (
    echo 錯誤: npm run build 失敗
    pause
    exit /b 1
)
echo.

echo [3/4] 同步 CLI 到 creator-cli-global...
call npm run sync-cli-global
if errorlevel 1 (
    echo 錯誤: sync-cli-global 失敗
    pause
    exit /b 1
)
echo.

echo [4/4] 本機全域安裝 creator-cli...
cd creator-cli-global
call npm install -g .
if errorlevel 1 (
    echo.
    echo 若出現權限錯誤，請用「以系統管理員身分執行」開 CMD 再跑此 bat，
    echo 或改在專案內用: npm run cli -- ^<子命令^>
    cd /d "%~dp0"
    pause
    exit /b 1
)
cd /d "%~dp0"
echo.

echo ========================================
echo  完成。現在可在任意目錄使用 creator-cli
echo ========================================
echo.
echo 試跑: creator-cli --help
echo.
call creator-cli --help
echo.
pause
