# ⚡⚡⚡ ULTRA-RÁPIDO (3 MINUTOS)
## GitHub Actions + Firebase - Versão Supercompactada

---

## 🎯 O QUE VOCÊ PRECISA FAZER

### 1. Gerar Service Account JSON (você já tem Firebase!)
```
Firebase Console → Configurações → "Contas de Serviço"
Gerar chave privada → Node.js → Salvar JSON
```

### 2. Criar Keystore (1x apenas)
```bash
keytool -genkey -v -keystore keystore.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias android-key
# Guardar senha!
```

### 3. Converter para Base64
```bash
base64 keystore.jks | pbcopy  # macOS
# ou
base64 keystore.jks          # Linux
# Copiar output
```

### 4. GitHub Secrets (6 itens)
```
GitHub → Repo Settings → Secrets

FIREBASE_CREDENTIALS  → JSON inteiro
KEYSTORE_BASE64       → Output do base64
KEYSTORE_PASSWORD     → sua-senha
KEY_ALIAS             → android-key
KEY_PASSWORD          → sua-senha
FIREBASE_APP_ID       → Firebase Console → Apps → ID
```

### 5. Criar Arquivo: `.github/workflows/firebase-deploy.yml`
```yaml
name: Build and Deploy to Firebase

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'

      - uses: android-actions/setup-android@v3

      - run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > keystore.jks

      - run: |
          chmod +x gradlew
          ./gradlew assembleRelease -Pandroid.injected.signing.store.file=keystore.jks \
            -Pandroid.injected.signing.store.password="${{ secrets.KEYSTORE_PASSWORD }}" \
            -Pandroid.injected.signing.key.alias="${{ secrets.KEY_ALIAS }}" \
            -Pandroid.injected.signing.key.password="${{ secrets.KEY_PASSWORD }}"

      - run: echo "${{ secrets.FIREBASE_CREDENTIALS }}" > firebase-key.json

      - run: npm install -g firebase-tools

      - run: |
          firebase appdistribution:distribute \
            app/build/outputs/apk/release/app-release.apk \
            --app="${{ secrets.FIREBASE_APP_ID }}" \
            --release-notes-file=RELEASE_NOTES.txt \
            --groups="testers" \
            --service-account-file=firebase-key.json

      - run: rm -f keystore.jks firebase-key.json
```

### 6. Atualizar `app/build.gradle`
```gradle
plugins {
    id 'com.android.application'
    id 'com.google.firebase.appdistribution' version '16.0.0'  // ADD
    id 'com.google.gms.google-services'
}

android {
    // ... seu código ...
    
    signingConfigs {
        release {
            storeFile file('keystore.jks')
            storePassword System.getenv('KEYSTORE_PASSWORD')
            keyAlias System.getenv('KEY_ALIAS')
            keyPassword System.getenv('KEY_PASSWORD')
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            // ... resto ...
        }
    }
}

firebaseAppDistribution {
    serviceCredentialsFile = 'firebase-key.json'
    releaseNotesFile = 'RELEASE_NOTES.txt'
    groups = 'testers'
}
```

### 7. Criar `RELEASE_NOTES.txt`
```
Versão 1.0 - Release

✨ Features & Fixes
```

### 8. Firebase: Criar Grupo "testers"
```
Firebase Console → App Distribution → Groups
+ Create Group → "testers" → Adicionar emails
```

### 9. Fazer Push
```bash
git add .
git commit -m "feat: github actions"
git push origin main
```

**FIM!** ✅

---

## 📊 RESULTADO

```
git push
  ↓ (automático)
Compila APK
  ↓
Assina APK
  ↓
Envia ao Firebase
  ↓
Testers recebem email com novo app
```

---

## ⚠️ CHECKLIST RÁPIDO

- [ ] JSON do Firebase baixado
- [ ] keystore.jks criado
- [ ] 6 Secrets adicionados
- [ ] firebase-deploy.yml criado
- [ ] build.gradle atualizado
- [ ] RELEASE_NOTES.txt criado
- [ ] Grupo "testers" criado
- [ ] Git push realizado

---

## 🆘 SE FALHAR

| Erro | Fix |
|------|-----|
| auth failed | JSON correto nos Secrets? |
| keystore invalid | Base64 correto? |
| build failed | `./gradlew build` funciona local? |
| app not found | FIREBASE_APP_ID correto? |

---

**Pronto! Você tem CI/CD! 🚀**
