# =============================================================
# restore-workspace.ps1
# Restaura o ambiente Corre Logo a partir do ZIP gerado por
# backup-workspace.ps1, numa instalação limpa do Windows.
#
# Pré-requisitos (instalados antes de rodar este script):
#   - Git for Windows, Node.js LTS, JDK 21 (Eclipse Adoptium),
#     Android SDK (Android Studio), opencode, firebase-tools
#   - Repositório clonado em D:\corre-logo
#   - As funções loadEnv/installEnv abaixo assumem permissão de
#     administrador para definir variáveis de ambiente do usuário.
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\restore-workspace.ps1 -ZipPath "D:\backup\correlogo-backup-20260814-211555.zip"
# =============================================================

param(
  [Parameter(Mandatory=$true)]
  [string]$ZipPath,

  [string]$RepoRoot = 'D:\corre-logo'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ZipPath)) { throw "ZIP não encontrado: $ZipPath" }
if (-not (Test-Path (Join-Path $RepoRoot '.git'))) { throw "Repositório não clonado em $RepoRoot" }

$user = $env:USERPROFILE
$tmp  = Join-Path $env:TEMP "correlogo-restore"
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Write-Host "`n=== Restaurando ambiente Corre Logo ===`n" -ForegroundColor Cyan
Expand-Archive -Path $ZipPath -DestinationPath $tmp -Force
Write-Host "ZIP extraído em $tmp`n"

# -------------------------------------------------------------
# 1) Secrets do projeto
# -------------------------------------------------------------
Write-Host "[1/5] Secrets do projeto" -ForegroundColor Yellow
$p = Join-Path $tmp 'project'
if (Test-Path (Join-Path $p '.env'))        { Copy-Item (Join-Path $p '.env')        $RepoRoot; Write-Host "  + .env" }
if (Test-Path (Join-Path $p '.env.apk'))    { Copy-Item (Join-Path $p '.env.apk')    $RepoRoot; Write-Host "  + .env.apk" }
if (Test-Path (Join-Path $p '.env.dev'))    { Copy-Item (Join-Path $p '.env.dev')    $RepoRoot; Write-Host "  + .env.dev" }
if (Test-Path (Join-Path $p '.env.example')){ Copy-Item (Join-Path $p '.env.example') $RepoRoot; Write-Host "  + .env.example" }
if (Test-Path (Join-Path $p 'functions.env')){ New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot 'functions') | Out-Null; Copy-Item (Join-Path $p 'functions.env') (Join-Path $RepoRoot 'functions\.env'); Write-Host "  + functions\.env" }
if (Test-Path (Join-Path $p 'android-app-google-services.json')) { Copy-Item (Join-Path $p 'android-app-google-services.json') (Join-Path $RepoRoot 'android\app\google-services.json'); Write-Host "  + android/app/google-services.json" }
if (Test-Path (Join-Path $p 'android-app-keystore.jks')) { Copy-Item (Join-Path $p 'android-app-keystore.jks') (Join-Path $RepoRoot 'android\app\keystore.jks'); Write-Host "  + android/app/keystore.jks" }
if (Test-Path (Join-Path $p 'android-keystore.jks')) { Copy-Item (Join-Path $p 'android-keystore.jks') (Join-Path $RepoRoot 'android\keystore.jks'); Write-Host "  + android/keystore.jks" }
if (Test-Path (Join-Path $p 'opencode.json')) { Copy-Item (Join-Path $p 'opencode.json') $RepoRoot; Write-Host "  + opencode.json" }

# -------------------------------------------------------------
# 2) Configs do usuário (ssh, git, gh, firebase, npm)
# -------------------------------------------------------------
Write-Host "`n[2/5] Configs do usuário" -ForegroundColor Yellow
$u = Join-Path $tmp 'user'
if (Test-Path (Join-Path $u '.ssh')) { Copy-Item -Recurse -Force (Join-Path $u '.ssh') $user; Write-Host "  + .ssh (chaves + known_hosts)" }
if (Test-Path (Join-Path $u '.git-credentials')) { Copy-Item (Join-Path $u '.git-credentials') $user; Write-Host "  + .git-credentials" }
if (Test-Path (Join-Path $u '.gitconfig')) { Copy-Item (Join-Path $u '.gitconfig') $user; Write-Host "  + .gitconfig" }
if (Test-Path (Join-Path $u '.npmrc')) { Copy-Item (Join-Path $u '.npmrc') $user; Write-Host "  + .npmrc" }
if (Test-Path (Join-Path $u 'gh-hosts.yml')) {
  $ghDir = Join-Path $user 'AppData\Roaming\GitHub CLI'
  New-Item -ItemType Directory -Force -Path $ghDir | Out-Null
  Copy-Item (Join-Path $u 'gh-hosts.yml') (Join-Path $ghDir 'hosts.yml'); Write-Host "  + GitHub CLI/hosts.yml"
}
if (Test-Path (Join-Path $u 'firebase-tools.json')) {
  $cs = Join-Path $user '.config\configstore'
  New-Item -ItemType Directory -Force -Path $cs | Out-Null
  Copy-Item (Join-Path $u 'firebase-tools.json') (Join-Path $cs 'firebase-tools.json'); Write-Host "  + configstore/firebase-tools.json"
}

# -------------------------------------------------------------
# 3) Configs do opencode (global + skills + binários)
# -------------------------------------------------------------
Write-Host "`n[3/5] Configs do opencode" -ForegroundColor Yellow
$o = Join-Path $tmp 'opencode'
if (Test-Path (Join-Path $o 'opencode.jsonc')) {
  $ocDir = Join-Path $user '.config\opencode'
  New-Item -ItemType Directory -Force -Path $ocDir | Out-Null
  Copy-Item (Join-Path $o 'opencode.jsonc') (Join-Path $ocDir 'opencode.jsonc'); Write-Host "  + .config/opencode/opencode.jsonc"
}
if (Test-Path (Join-Path $o 'package.json')) { Copy-Item (Join-Path $o 'package.json') (Join-Path $user '.config\opencode\'); Write-Host "  + .config/opencode/package.json" }
if (Test-Path (Join-Path $o 'package-lock.json')) { Copy-Item (Join-Path $o 'package-lock.json') (Join-Path $user '.config\opencode\'); Write-Host "  + .config/opencode/package-lock.json" }
if (Test-Path (Join-Path $o 'skills-gstack')) {
  $gs = Join-Path $user '.config\opencode\skills\gstack'
  New-Item -ItemType Directory -Force -Path (Split-Path $gs -Parent) | Out-Null
  Copy-Item -Recurse -Force (Join-Path $o 'skills-gstack') $gs; Write-Host "  + skills/gstack (inclui node_modules - re-execute npm install se necessário)"
}
if (Test-Path (Join-Path $o 'agents-skills')) { Copy-Item -Recurse -Force (Join-Path $o 'agents-skills') (Join-Path $user '.agents\skills'); Write-Host "  + .agents/skills" }
if (Test-Path (Join-Path $o 'opencode-skills')) { Copy-Item -Recurse -Force (Join-Path $o 'opencode-skills') (Join-Path $user '.opencode\skills'); Write-Host "  + .opencode/skills" }
if (Test-Path (Join-Path $o 'models.json')) {
  $cache = Join-Path $user '.cache\opencode'
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  Copy-Item (Join-Path $o 'models.json') (Join-Path $cache 'models.json'); Write-Host "  + .cache/opencode/models.json"
}
if (Test-Path (Join-Path $o 'bin\rg.exe')) {
  $bin = Join-Path $user '.cache\opencode\bin'
  New-Item -ItemType Directory -Force -Path $bin | Out-Null
  Copy-Item (Join-Path $o 'bin\rg.exe') (Join-Path $bin 'rg.exe'); Write-Host "  + .cache/opencode/bin/rg.exe"
}

# -------------------------------------------------------------
# 4) Variáveis de ambiente do usuário
# -------------------------------------------------------------
Write-Host "`n[4/5] Variáveis de ambiente (usuário)" -ForegroundColor Yellow
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot', 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\' + $env:USERNAME + '\AppData\Local\Android\Sdk', 'User')
$current = [Environment]::GetEnvironmentVariable('Path', 'User')
$addPaths = @(
  'C:\Program Files\nodejs',
  'C:\Program Files\Git\cmd',
  'C:\Users\' + $env:USERNAME + '\AppData\Roaming\npm',
  'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin',
  'C:\Users\' + $env:USERNAME + '\AppData\Local\Android\Sdk\platform-tools',
  'C:\Users\' + $env:USERNAME + '\AppData\Local\Android\Sdk\cmdline-tools\latest\bin'
)
foreach ($p in $addPaths) {
  if ($current -notlike "*$p*") { $current = "$current;$p" }
}
[Environment]::SetEnvironmentVariable('Path', $current, 'User')
Write-Host "  + JAVA_HOME -> jdk-21.0.12.8-hotspot"
Write-Host "  + ANDROID_HOME + PATH atualizados (reabra o terminal para valer)"

# -------------------------------------------------------------
# 5) Verificação final
# -------------------------------------------------------------
Write-Host "`n[5/5] Verificação (abra um terminal NOVO)" -ForegroundColor Yellow
Write-Host "  node -v  => $(node --version 2>$null)"
Write-Host "  git --version => $(git --version 2>$null)"
Write-Host "  java -version => (JDK 21 esperado)"
Write-Host "  gh auth status => (conta mahmatias)"

Write-Host "`n=== Próximos passos manuais ===" -ForegroundColor Green
Write-Host "  1) cd $RepoRoot"
Write-Host "  2) npm ci --legacy-peer-deps"
Write-Host "  3) Copy-Item .env.apk .env -Force"
Write-Host "  4) npm test"
Write-Host "  5) npm run build"
Write-Host "  6) npx cap sync android"
Write-Host "  7) gradle assembleDebug (ver AGENTS.md sobre JAVA_HOME)"

Remove-Item -Recurse -Force $tmp
