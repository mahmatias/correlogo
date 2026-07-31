# Build — Auto-Update In-App

## Visão Geral

Sistema de atualização customizado que substitui Firebase App Tester. Distribui APK via GitHub Releases com manifest JSON.

---

## Fluxo

```
CI (push to main):
  build APK → atualiza GitHub Release "latest"
  → publica: app-release.apk + update-manifest.json

App (on auth):
  fetch(update-manifest.json) → compara versionCode
  → se > current → mostra modal "Atualização disponível"
  → "Baixar" → download → Filesystem.writeFile(cache)
  → ApkInstaller → FileProvider → Intent → Package Installer
```

## update-manifest.json

URL: `https://github.com/mahmatias/correlogo/releases/download/latest/update-manifest.json`

```json
{
  "versionCode": 135,
  "versionName": "3.4",
  "downloadUrl": "https://github.com/mahmatias/correlogo/releases/download/latest/app-release.apk"
}
```

- `versionCode` = `GITHUB_RUN_NUMBER + 100`
- `versionName` = extraído do `build.gradle`

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `src/lib/update-checker.ts` | Core: fetch, comparar, download + install |
| `src/lib/capacitor/apk-installer.ts` | Wrapper Capacitor |
| `android/.../ApkInstallerPlugin.kt` | Plugin nativo (FileProvider + Intent) |
| `src/components/UpdatePrompt.tsx` | Modal de atualização |
| `src/components/UserProfile.tsx` | Botão "Verificar atualizações" |
| `src/App.tsx` | Auto-check on mount (linhas 344-356) |
| `.github/workflows/firebase-deploy.yml` | CI que publica APK + manifest |

## Trigger Points

| Trigger | Local | Comportamento |
|---------|-------|---------------|
| Auto (on auth) | `App.tsx` | `useEffect` → `checkForUpdate()` → modal |
| Manual | `UserProfile.tsx` | Botão → abre o **mesmo modal** (`onUpdateAvailable`) |
| CI | `firebase-deploy.yml` | Push to main → build → publica Release `latest` |

> **v3.2+**: o app pré-checa `canInstallApk()` antes de baixar; se "instalar apps desconhecidos" estiver desligado, mostra a tela de permissão (`ApkInstallerPlugin.openInstallSettings`) em vez de baixar à toa. O APK baixado é validado pelo magic `UEsD` (ZIP) antes de instalar.

## Bugfix Conhecido

`gh release delete latest -y` deletava o release antes de recriar. Se o `create` falhasse, o manifest ficava 404. **Fix:** usar `gh release upload latest --clobber` (sobrescreve assets sem deletar). Step tem `if: always()`.

## Segurança

- `downloadUrl` hardcoded para GitHub Releases (HTTPS)
- Sem verificação de assinatura — Android Package Installer faz a validação
- URL do manifest é compile-time constant
