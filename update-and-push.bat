@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

cd /d "%~dp0"

set "DOCX_PATH=%~dp0大连家教.docx"
set "PYTHON_CMD="
set "GIT_EXE="

echo.
echo ========================================
echo 大连家教地图 - 一键更新
echo ========================================
echo.

if not exist "%DOCX_PATH%" (
  echo [错误] 找不到 Word 文档：%DOCX_PATH%
  echo 请确认文档路径是否正确。
  pause
  exit /b 1
)

where py >nul 2>nul
if %errorlevel%==0 (
  set "PYTHON_CMD=py -3"
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    set "PYTHON_CMD=python"
  )
)

if "%PYTHON_CMD%"=="" (
  echo [错误] 没找到 Python。请安装 Python，或让我帮你配置。
  pause
  exit /b 1
)

if exist "%LOCALAPPDATA%\GitHubDesktop" (
  for /f "delims=" %%G in ('dir /b /s "%LOCALAPPDATA%\GitHubDesktop\git.exe" 2^>nul') do (
    set "GIT_EXE=%%G"
  )
)

if "%GIT_EXE%"=="" (
  where git >nul 2>nul
  if %errorlevel%==0 set "GIT_EXE=git"
)

if "%GIT_EXE%"=="" (
  echo [错误] 没找到 Git。请安装 Git 或 GitHub Desktop。
  pause
  exit /b 1
)

echo [1/5] 正在从 Word 解析家教任务...
%PYTHON_CMD% scripts\parse_docx.py "%DOCX_PATH%"
if errorlevel 1 (
  echo [错误] 解析 Word 失败。
  pause
  exit /b 1
)

echo.
echo [2/5] 正在同步 GitHub 最新版本...
"%GIT_EXE%" pull --rebase origin main
if errorlevel 1 (
  echo [错误] 同步 GitHub 失败。请检查网络或 GitHub 登录状态。
  pause
  exit /b 1
)

echo.
echo [3/5] 正在检查数据变化...
"%GIT_EXE%" status --short data\tutors.js data\tutors.json > "%TEMP%\dalian_tutor_git_status.txt"
for %%A in ("%TEMP%\dalian_tutor_git_status.txt") do set "STATUS_SIZE=%%~zA"
if "%STATUS_SIZE%"=="0" (
  echo 没有检测到数据变化，不需要提交。
  del "%TEMP%\dalian_tutor_git_status.txt" >nul 2>nul
  echo.
  echo 完成。网页数据已经是最新的。
  pause
  exit /b 0
)
del "%TEMP%\dalian_tutor_git_status.txt" >nul 2>nul

echo.
echo [4/5] 正在提交更新...
"%GIT_EXE%" add data\tutors.js data\tutors.json
"%GIT_EXE%" commit -m "Update tutor listings"
if errorlevel 1 (
  echo [错误] 提交失败。
  pause
  exit /b 1
)

echo.
echo [5/5] 正在推送到 GitHub Pages...
"%GIT_EXE%" push origin main
if errorlevel 1 (
  echo [错误] 推送失败。请检查网络或 GitHub 登录状态。
  pause
  exit /b 1
)

echo.
echo ========================================
echo 更新完成！
echo GitHub Pages 通常几十秒到两分钟后生效。
echo 访问：https://jww666.github.io/dalian_tec/
echo 如果浏览器仍显示旧数据，请按 Ctrl + F5 强制刷新。
echo ========================================
echo.
pause
