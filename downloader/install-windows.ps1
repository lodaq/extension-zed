param([ValidatePattern('^[a-p]{32}$')][string]$ExtensionId,
      [ValidateSet('chrome','brave')][string]$Browser)
$ErrorActionPreference = 'Stop'
$arguments = @("$PSScriptRoot\install.py")
if ($ExtensionId) { $arguments += $ExtensionId }
if ($Browser) { $arguments += @('--browser', $Browser) }
& python @arguments
if ($LASTEXITCODE -ne 0) { throw 'Downloader installation failed.' }
