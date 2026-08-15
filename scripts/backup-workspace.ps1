# =============================================================
# backup-workspace.ps1
# Gera um ZIP com tudo que NÃO está no repositório GitHub e é
# necessário para reconstruir o ambiente após formatar o Windows.
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\backup-workspace.ps1
# Saída: <Destino>\correlogo-backup-YYYYMMDD-HHmmss.zip
# =============================================================

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$destDir  = Join-Path $repoRoot 'backup'
$destDir  = Read-Host "Pasta de destino do backup (ENTER = $destDir)"
if ([string]::IsNullOrWhiteSpace($destDir)) { $destDir = Join-Path $repoRoot 'backup' }

$stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
$workDir  = Join-Path $env:TEMP "correlogo-backup-$stamp"
$zipPath  = Join-Path $destDir "correlogo-backup-$stamp.zip"

Write-Host "`n=== Backup do ambiente Corre Logo ===" -ForegroundColor Cyan
Write-Host "Work dir: $workDir"
Write-Host "ZIP final: $zipPath`n" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

function Copy-Tree($src, $relDest) {
  if (Test-Path $src) {
    $target = Join-Path $workDir $relDest
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -Recurse -Force -Path $src -Destination $target
    Write-Host "  + $relDest"
  } else {
    Write-Host "  - $relDest (não encontrado, ignorado)" -ForegroundColor DarkGray
  }
}

function Copy-File($src, $relDest) {
  if (Test-Path $src) {
    $target = Join-Path $workDir $relDest
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -Force -Path $src -Destination $target
    Write-Host "  + $relDest"
  } else {
    Write-Host "  - $relDest (não encontrado, ignorado)" -ForegroundColor DarkGray
  }
}

# -------------------------------------------------------------
# 1) Secrets do projeto (ignorados pelo .gitignore)
# -------------------------------------------------------------
Write-Host "`n[1/4] Secrets do projeto (Firebase + signing)" -ForegroundColor Yellow
Copy-File (Join-Path $repoRoot '.env')            'project/.env'
Copy-File (Join-Path $repoRoot '.env.apk')        'project/.env.apk'
Copy-File (Join-Path $repoRoot '.env.dev')        'project/.env.dev'
Copy-File (Join-Path $repoRoot '.env.example')    'project/.env.example'
Copy-File (Join-Path $repoRoot 'functions\.env')  'project/functions.env'
Copy-File (Join-Path $repoRoot 'android\app\google-services.json') 'project/android-app-google-services.json'
Copy-File (Join-Path $repoRoot 'android\app\keystore.jks')         'project/android-app-keystore.jks'
Copy-File (Join-Path $repoRoot 'android\keystore.jks')             'project/android-keystore.jks'
Copy-File (Join-Path $repoRoot 'opencode.json')   'project/opencode.json'
Copy-Tree  (Join-Path $repoRoot '.superpowers')   'project/.superpowers'
Copy-File (Join-Path $repoRoot 'app-release-v139.apk') 'project/app-release-v139.apk'

# -------------------------------------------------------------
# 2) Configs do usuário (git, ssh, gh, firebase, npm)
# -------------------------------------------------------------
Write-Host "`n[2/4] Configs do usuário" -ForegroundColor Yellow
$user = $env:USERPROFILE

Copy-Tree (Join-Path $user '.ssh')                 'user/.ssh'
Copy-File (Join-Path $user '.git-credentials')     'user/.git-credentials'
Copy-File (Join-Path $user '.gitconfig')           'user/.gitconfig'
Copy-File (Join-Path $user '.npmrc')               'user/.npmrc'
Copy-File (Join-Path $user 'AppData\Roaming\GitHub CLI\hosts.yml') 'user/gh-hosts.yml'
Copy-File (Join-Path $user '.config\configstore\firebase-tools.json') 'user/firebase-tools.json'

# -------------------------------------------------------------
# 3) Configs do opencode (global + skills + binários)
# -------------------------------------------------------------
Write-Host "`n[3/4] Configs do opencode" -ForegroundColor Yellow
Copy-File (Join-Path $user '.config\opencode\opencode.jsonc')   'opencode/opencode.jsonc'
Copy-File (Join-Path $user '.config\opencode\package.json')     'opencode/package.json'
Copy-File (Join-Path $user '.config\opencode\package-lock.json') 'opencode/package-lock.json'
Copy-Tree  (Join-Path $user '.config\opencode\skills\gstack')   'opencode/skills-gstack'
Copy-Tree  (Join-Path $user '.agents\skills')                   'opencode/agents-skills'
Copy-Tree  (Join-Path $user '.opencode\skills')                 'opencode/opencode-skills'
Copy-File (Join-Path $user '.cache\opencode\models.json')       'opencode/models.json'
Copy-File (Join-Path $user '.cache\opencode\bin\rg.exe')        'opencode/bin/rg.exe'

# -------------------------------------------------------------
# 4) Manifesto do ambiente (versões e paths)
# -------------------------------------------------------------
Write-Host "`n[4/4] Manifesto do ambiente" -ForegroundColor Yellow
$manifest = @()
$manifest += "GENERATED_AT=$stamp"
$manifest += "OS=Windows"
$manifest += ""
$manifest += "NODE_VERSION=$(node --version 2>$null)"
$manifest += "NPM_VERSION=$(npm --version 2>$null)"
$manifest += "NODE_PATH=$((Get-Command node -ErrorAction SilentlyContinue).Source)"
$manifest += "NPM_PREFIX=$(npm config get prefix 2>$null)"
$manifest += ""
$manifest += "GIT_VERSION=$(git --version 2>$null)"
$manifest += "GH_VERSION=$(gh --version 2>$null | Select-Object -First 1)"
$manifest += "FIREBASE_VERSION=$(firebase --version 2>$null)"
$manifest += ""
$manifest += "JAVA_HOME=$env:JAVA_HOME"
$manifest += "JAVA_REAL_JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
$manifest += "ANDROID_HOME=$env:ANDROID_HOME"
$manifest += "ANDROID_SDK_ROOT=$env:ANDROID_SDK_ROOT"
$manifest += ""
$manifest += "GIT_REMOTE_ORIGIN=$(git -C $repoRoot remote get-url origin 2>$null)"
$manifest += "GIT_BRANCH=$(git -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null)"
$manifest += "GIT_HEAD=$(git -C $repoRoot rev-parse HEAD 2>$null)"
$manifest += ""
$manifest += "NPM_GLOBAL_PACKAGES:"
$manifest += $(npm ls -g --depth=0 2>$null | Select-Object -Skip 1)
$manifest | Set-Content -Encoding UTF8 (Join-Path $workDir 'env-manifest.txt')
Write-Host "  + env-manifest.txt"

# -------------------------------------------------------------
# ZIP
# -------------------------------------------------------------
Write-Host "`nCompactando..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Compress-Archive -Path (Join-Path $workDir '*') -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $workDir

Write-Host "`n=== Backup concluído ===" -ForegroundColor Green
Write-Host "ZIP: $zipPath ($([math]::Round((Get-Item $zipPath).Length/1KB,1)) KB)"
Write-Host "`nIMPORTANTE: copie este ZIP para fora deste computador" -ForegroundColor Red
Write-Host "(pendrive / nuvem). Ele contém segredos de produção." -ForegroundColor Red
