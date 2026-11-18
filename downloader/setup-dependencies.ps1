$ErrorActionPreference = 'Stop'

function Test-Python {
    if (-not (Get-Command python -CommandType Application -ErrorAction SilentlyContinue)) { return $false }
    & python -c 'import sys; sys.exit(sys.version_info < (3, 10))'
    return $LASTEXITCODE -eq 0
}

function Install-Package([string]$PackageId) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "Install WinGet (App Installer), then run setup again."
    }
    & winget install --source winget --exact --id $PackageId
    if ($LASTEXITCODE -ne 0) { throw "WinGet could not install $PackageId." }
    # Read the updated PATH in this session after the package installer exits.
    $env:Path = ([Environment]::GetEnvironmentVariable('Path', 'Machine'),
                 [Environment]::GetEnvironmentVariable('Path', 'User'),
                 $env:Path) -join ';'
}

if (-not (Test-Python)) { Install-Package 'Python.Python.3.13' }
if (-not (Get-Command yt-dlp -CommandType Application -ErrorAction SilentlyContinue)) { Install-Package 'yt-dlp.yt-dlp' }
if (-not (Get-Command ffmpeg -CommandType Application -ErrorAction SilentlyContinue)) { Install-Package 'Gyan.FFmpeg' }

if (-not (Test-Python) -or
    -not (Get-Command yt-dlp -CommandType Application -ErrorAction SilentlyContinue) -or
    -not (Get-Command ffmpeg -CommandType Application -ErrorAction SilentlyContinue)) {
    throw 'Python 3.10+, yt-dlp, and ffmpeg must be on PATH. Open a fresh PowerShell window and run setup again.'
}
