# OmniFlow installer - Windows PowerShell.
# Storage policy: keep runtime + data OFF the system (C:) drive when possible.
#   1) OF_INSTALL_DIR / OF_HOME env override (highest priority)
#   2) first non-system fixed drive with >= 1GB free, e.g. D:\OmniFlow
#   3) fallback %LOCALAPPDATA%\OmniFlow (only when the machine has a single drive)
# Skills are installed as NTFS junctions (no copies, single source, upgrade-in-place).
Set-ExecutionPolicy -Scope Process Bypass
$ErrorActionPreference = "Stop"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$BinDir = if ($env:OF_BIN_DIR) { $env:OF_BIN_DIR } else { Join-Path $InstallDir "bin" }

function Fail([string]$msg) { Write-Error "OmniFlow install: $msg"; exit 1 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js >= 18 is required." }

# --- choose install/data root: non-C drive preferred ---
if ($env:OF_INSTALL_DIR) {
  $InstallDir = $env:OF_INSTALL_DIR
} else {
  $systemDrive = $env:SystemDrive.TrimEnd('\', ':') + ':'
  $candidates = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
    Where-Object { $_.DeviceID -ne $systemDrive -and $_.FreeSpace -gt 1GB } |
    Sort-Object FreeSpace -Descending
  if ($candidates) {
    $InstallDir = Join-Path ($candidates[0].DeviceID + "\") "OmniFlow"
  } else {
    $InstallDir = Join-Path $env:LOCALAPPDATA "OmniFlow"
  }
}
$BinDir = Join-Path $InstallDir "bin"
New-Item -ItemType Directory -Force -Path $InstallDir, $BinDir | Out-Null

foreach ($item in @("bin", "lib", "studio", "skills", "docs")) {
  $src = Join-Path $Here $item
  if (Test-Path $src) {
    Remove-Item -Recurse -Force -Path (Join-Path $InstallDir $item) -ErrorAction SilentlyContinue
    Copy-Item -Recurse -Force -Path $src -Destination $InstallDir
  }
}
foreach ($item in @("package.json", "README.md", "LICENSE", "install.sh")) {
  $src = Join-Path $Here $item
  if (Test-Path $src) { Copy-Item -Force -Path $src -Destination $InstallDir }
}

# --- bundled skill: NTFS junctions (single source, zero duplication) ---
$skillSource = Join-Path $InstallDir "skills\omni-flow"
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
foreach ($target in @(
  (Join-Path $HOME ".zcode\skills\omni-flow"),
  (Join-Path $HOME ".claude\skills\omni-flow"),
  (Join-Path $CodexHome "skills\omni-flow"))) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  if (Test-Path $target) { Remove-Item -Recurse -Force $target }
  try {
    New-Item -ItemType Junction -Path $target -Value $skillSource | Out-Null
  } catch {
    Copy-Item -Recurse -Force -Path $skillSource -Destination $target
  }
}

# --- CLI launcher: of.cmd pins OF_HOME to the install dir (keeps data off C:) ---
$ofCmd = Join-Path $BinDir "of.cmd"
@"
@echo off
set "OF_HOME=$InstallDir"
node "$InstallDir\bin\of.mjs" %*
"@ | Set-Content -Path $ofCmd -Encoding ASCII

$version = (Get-Content (Join-Path $InstallDir "package.json") | ConvertFrom-Json).version
Write-Host "OmniFlow $version installed at $InstallDir (data stays in this folder)"
Write-Host "CLI: $ofCmd  ->  add '$BinDir' to PATH"
Write-Host "Skills (junctions -> $skillSource): ~/.zcode, ~/.claude, $CodexHome"
Write-Host 'MCP (optional): {"mcpServers":{"omni-flow":{"command":"node","args":["<install-dir>\bin\of.mjs","mcp"]}}}'
$env:OF_HOME = $InstallDir
node (Join-Path $InstallDir "bin\of.mjs") --version
