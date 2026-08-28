@echo off
setlocal
cd /d "%~dp0\..\.."
if not defined VEIL_DRIVE_FOLDER (
  if exist "%USERPROFILE%\Google Drive" set "VEIL_DRIVE_FOLDER=%USERPROFILE%\Google Drive\VeilStudio"
  if exist "%USERPROFILE%\My Drive" set "VEIL_DRIVE_FOLDER=%USERPROFILE%\My Drive\VeilStudio"
)
if not defined VEIL_DRIVE_FOLDER set "VEIL_DRIVE_FOLDER=%USERPROFILE%\VeilStudio"
if not exist node_modules (
  echo Installing...
  call npm install
)
if not exist .next (
  echo Building...
  call npm run build
)
echo Launching Veil Studio
echo Drive folder: %VEIL_DRIVE_FOLDER%
echo Drop JSON requests in %VEIL_DRIVE_FOLDER%\inbox
node scripts\launch.mjs
