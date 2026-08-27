param(
  [string]$DriveFolder = $env:VEIL_DRIVE_FOLDER
)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not $DriveFolder) {
  if (Test-Path "$env:USERPROFILE\Google Drive") {
    $DriveFolder = Join-Path "$env:USERPROFILE\Google Drive" "VeilStudio"
  } elseif (Test-Path "$env:USERPROFILE\My Drive") {
    $DriveFolder = Join-Path "$env:USERPROFILE\My Drive" "VeilStudio"
  } else {
    $DriveFolder = Join-Path $env:USERPROFILE "VeilStudio"
  }
}

$env:VEIL_DRIVE_FOLDER = $DriveFolder
Write-Host "Installing Veil Studio (private local app)..."
if (-not (Test-Path "node_modules")) { npm install }
npm run build

foreach ($dir in @("inbox", "inbox\processed", "outbox", "library", "app")) {
  New-Item -ItemType Directory -Force -Path (Join-Path $DriveFolder $dir) | Out-Null
}

Copy-Item "scripts\windows\Launch-VeilStudio.bat" (Join-Path $DriveFolder "app\Launch-VeilStudio.bat") -Force
Copy-Item "lib\inbox.ts" -ErrorAction SilentlyContinue | Out-Null
$readmeSrc = Join-Path $DriveFolder "README-FOR-AI.md"
if (-not (Test-Path $readmeSrc)) {
  Copy-Item "scripts\README-FOR-AI.md" $readmeSrc -ErrorAction SilentlyContinue
}

$exe = Get-ChildItem -Path "dist" -Filter "Veil Studio*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($exe) {
  Copy-Item $exe.FullName (Join-Path $DriveFolder "app\Veil Studio.exe") -Force
  Write-Host "Copied .exe into $DriveFolder\app"
}

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut((Join-Path $env:USERPROFILE "Desktop\Veil Studio.lnk"))
$shortcut.TargetPath = (Join-Path (Get-Location) "scripts\windows\Launch-VeilStudio.bat")
$shortcut.WorkingDirectory = (Get-Location)
$shortcut.Save()

Write-Host ""
Write-Host "Installed."
Write-Host "  Launch: Desktop\Veil Studio.lnk  or  $DriveFolder\app\Launch-VeilStudio.bat"
Write-Host "  AI / Drive inbox: $DriveFolder\inbox"
Write-Host "  Google Drive does not run .exe in the cloud. Keep this PC on; Drive syncs outbox back to AI."
