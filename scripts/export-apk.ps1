param()

$buildGradle = "android/app/build.gradle"
$content = Get-Content $buildGradle -Raw

$versionMatch = [regex]::Match($content, 'versionName "([^"]+)"')
$version = $versionMatch.Groups[1].Value

$codeMatch = [regex]::Match($content, 'versionCode (\d+)')
$oldCode = [int]$codeMatch.Groups[1].Value
$newCode = $oldCode + 1

$apk = "android/app/build/outputs/apk/debug/app-debug.apk"
$dest = "Corre Logo v$version.apk"
Copy-Item -Path $apk -Destination $dest -Force

$content = $content -replace 'versionCode \d+', "versionCode $newCode"
Set-Content -Path $buildGradle -Value $content

Write-Host "APK exported to $dest"
Write-Host "versionCode: $oldCode -> $newCode"
