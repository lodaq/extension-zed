# Run in an elevated Windows PowerShell session after reviewing README.md.
# Requires an administrator-installed Python 3.13+ under C:\Program Files.
# Does not modify any existing Zed installation or discard its state.
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator access is required.' }
$config = Get-Content -Raw "$PSScriptRoot\windows\config.json" | ConvertFrom-Json
$root = 'C:\Program Files\ExtensionZed'
$state = 'C:\ProgramData\ExtensionZed'
function Assert-NoReparse([string]$Path) {
    $current = [IO.Path]::GetFullPath($Path)
    while ($current) {
        $item = Get-Item -LiteralPath $current -ErrorAction SilentlyContinue
        if ($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Refusing reparse point: $current" }
        $parent = [IO.Directory]::GetParent($current)
        $current = if ($null -ne $parent) { $parent.FullName } else { $null }
    }
}
Assert-NoReparse $root
Assert-NoReparse $state
Assert-NoReparse $config.python
if ((Test-Path -LiteralPath $root) -or (Test-Path -LiteralPath $state)) { throw 'Already installed. Administrator review is required for upgrades; preserve state.' }
if (-not $config.python.StartsWith('C:\Program Files\', [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $config.python)) { throw 'Python must be installed for all users under C:\Program Files.' }
$nativeKey = 'HKLM:\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.extension_zed.limiter'
if (Test-Path $nativeKey) { throw 'Native host registration already exists. Administrator review is required.' }
$policyRoot = 'HKLM:\SOFTWARE\Policies\Google\Chrome'
if (Test-Path $policyRoot) { throw 'Existing Chrome policies require an administrator to merge restrictions. No policies were overwritten.' }
if (Get-ScheduledTask -TaskName 'ExtensionZedLimiter' -ErrorAction SilentlyContinue) { throw 'Service task already exists.' }
New-Item -ItemType Directory -Path $root, $state | Out-Null
# Use SIDs so ACLs work on non-English Windows installations.
& icacls.exe $root /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not protect program directory.' }
& icacls.exe $state /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not protect state directory.' }
Copy-Item "$PSScriptRoot\zed_limiter.py" $root
Copy-Item "$PSScriptRoot\windows\config.json" $root
Copy-Item "$PSScriptRoot\windows\com.extension_zed.limiter.json" $root
Add-Type -Path "$PSScriptRoot\native-launcher.cs" -ReferencedAssemblies 'System.Web.Extensions.dll' -OutputAssembly "$root\zed-native.exe" -OutputType ConsoleApplication
New-Item -Path $nativeKey -Force | Out-Null
Set-Item -Path $nativeKey -Value "$root\com.extension_zed.limiter.json"
New-Item -Path $policyRoot -Force | Out-Null
foreach ($property in $config.policies.PSObject.Properties) {
    if ($property.Value -is [Array]) {
        $key = Join-Path $policyRoot $property.Name
        New-Item $key -Force | Out-Null
        $index = 1
        foreach ($value in $property.Value) { New-ItemProperty $key -Name "$index" -Value $value -PropertyType String -Force | Out-Null; $index++ }
    } else {
        New-ItemProperty $policyRoot -Name $property.Name -Value ([int]$property.Value) -PropertyType DWord -Force | Out-Null
    }
}
$action = New-ScheduledTaskAction -Execute $config.python -Argument "-I `"$root\zed_limiter.py`" serve" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'ExtensionZedLimiter' -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
$scheduler = New-Object -ComObject 'Schedule.Service'
$scheduler.Connect()
$scheduler.GetFolder('\').GetTask('ExtensionZedLimiter').SetSecurityDescriptor('D:P(A;;FA;;;SY)(A;;FA;;;BA)', 0)
Start-ScheduledTask -TaskName 'ExtensionZedLimiter'
Write-Host 'Service installed. Verify mandatory policies and forced extension installation at chrome://policy before using strict mode.'
