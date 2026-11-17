param([Parameter(Mandatory=$true)][ValidatePattern('^[a-p]{32}$')][string]$ExtensionId,
      [ValidateSet('chrome','brave')][string]$Browser = 'chrome')
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA 'ExtensionZedDownloader'
New-Item -ItemType Directory -Path $root -Force | Out-Null
$launcher = Join-Path $root 'zed-downloader.exe'
if (-not (Test-Path -LiteralPath $launcher)) {
    Add-Type -Path "$PSScriptRoot\native-launcher.cs" -OutputAssembly $launcher -OutputType ConsoleApplication
}
& python "$PSScriptRoot\install.py" $ExtensionId --browser $Browser
if ($LASTEXITCODE -ne 0) { throw 'Downloader installation failed.' }
