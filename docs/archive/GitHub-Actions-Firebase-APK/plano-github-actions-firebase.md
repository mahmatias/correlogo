# Plano de Ação: GitHub Actions + Firebase Distribution
## Deploy Automático de APK Android

---

## 📋 REQUISITOS

### Software/Serviços Necessários
- ✅ Repositório GitHub (público ou privado)
- ✅ Conta Firebase com projeto ativo
- ✅ Android Studio com projeto Gradle
- ✅ Google Play Console account (para gerar credenciais)
- ✅ keystore.jks (chave assinada do app - veja seção abaixo)

### Credenciais Necessárias
- Google Play Service Account JSON
- Firebase App ID
- Keystore (chave privada)

---

## 🔐 PASSO 1: CRIAR SERVICE ACCOUNT NO GOOGLE CLOUD

### 1.1 Acessar Console Google Cloud
```
https://console.cloud.google.com/
```

### 1.2 Criar Projeto Novo
- Clique em "Select a Project" → "New Project"
- Nome: "AppName-CI-CD" (ou similar)
- Aguarde criação

### 1.3 Ativar Firebase Management API
```
1. Navegue para "APIs & Services" → "Library"
2. Pesquise "Firebase Management API"
3. Clique e ative (Enable)
4. Aguarde alguns segundos
```

### 1.4 Criar Service Account
```
1. Vá para "APIs & Services" → "Credentials"
2. Clique "+ CREATE CREDENTIALS" → "Service Account"
3. Preencha:
   - Service account name: "firebase-deployment"
   - Service account ID: auto-preenchido
   - Descrição: "GitHub Actions Firebase Deployment"
4. Clique "Create and Continue"
```

### 1.5 Conceder Permissões
```
1. Role: "Firebase Admin"
2. Clique "Continue" → "Done"
```

### 1.6 Gerar Chave JSON
```
1. Na lista de Service Accounts, clique em "firebase-deployment"
2. Aba "Keys" → "+ Add Key" → "Create new key"
3. Type: JSON
4. Clique "Create"
5. Download automático: firebase-key.json
   ⚠️ GUARDE ESTE ARQUIVO COM SEGURANÇA - É SUA CREDENCIAL!
```

---

## 🔑 PASSO 2: PREPARAR KEYSTORE (CHAVE DE ASSINATURA)

### 2.1 Se JÁ TEM keystore.jks
```bash
# Apenas envie para GitHub Secrets
# Vá para Passo 3
```

### 2.2 Se NÃO TEM keystore.jks (criar um novo)
```bash
# Execute no terminal (qualquer diretório)
keytool -genkey -v -keystore keystore.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias android-key

# Será pedido:
# - Senha do keystore: (use uma forte, ex: "MySecurePass123!")
# - Dados da chave: Nome, empresa, país, etc
# - Confirmação de chave

# Resultado: arquivo keystore.jks criado
```

**⚠️ IMPORTANTE:** Guarde a **senha do keystore** com segurança!

---

## 📱 PASSO 3: CONFIGURAR GITHUB SECRETS

### 3.1 Acessar Repositório GitHub
```
https://github.com/seu-usuario/seu-repo/settings/secrets/actions
```

### 3.2 Adicionar Secrets (clique "New repository secret")

#### Secret 1: FIREBASE_CREDENTIALS
```
Nome: FIREBASE_CREDENTIALS
Valor: Conteúdo completo do arquivo firebase-key.json (JSON inteiro)
```

#### Secret 2: KEYSTORE_BASE64
```bash
# No terminal, converter keystore.jks para Base64
base64 -i keystore.jks | pbcopy  # macOS
# ou
base64 keystore.jks > keystore.txt  # Linux

# Copiar conteúdo completo e colar em:
Nome: KEYSTORE_BASE64
Valor: (conteúdo Base64)
```

#### Secret 3: KEYSTORE_PASSWORD
```
Nome: KEYSTORE_PASSWORD
Valor: senha-do-keystore (aquela que você definiu)
```

#### Secret 4: KEY_ALIAS
```
Nome: KEY_ALIAS
Valor: android-key (ou o alias que você usou)
```

#### Secret 5: KEY_PASSWORD
```
Nome: KEY_PASSWORD
Valor: senha-do-keystore (geralmente igual ao KEYSTORE_PASSWORD)
```

#### Secret 6: FIREBASE_APP_ID
```
Nome: FIREBASE_APP_ID
Valor: Obtém em Firebase Console:
       Projeto → Configurações do Projeto → Apps → ID do App
       Formato: "1:123456789:android:abcdefg1234567"
```

---

## ⚙️ PASSO 4: CONFIGURAR build.gradle

### 4.1 Adicionar Plugin Firebase Distribution

No arquivo **build.gradle** (Module: app):

```gradle
plugins {
    id 'com.android.application'
    id 'com.google.firebase.appdistribution' version '16.0.0'  // ← ADD THIS
}

android {
    compileSdk 34
    
    defaultConfig {
        applicationId "com.example.myapp"
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    signingConfigs {
        release {
            storeFile file("keystore.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

firebaseAppDistribution {
    serviceCredentialsFile = "firebase-key.json"
    releaseNotesFile = "RELEASE_NOTES.txt"
    groups = "testers"
}
```

### 4.2 Adicionar Dependência Firebase (build.gradle no projeto raiz)

```gradle
plugins {
    id 'com.google.gms.google-services' version '4.3.15' apply false
}
```

---

## 📝 PASSO 5: CRIAR RELEASE NOTES

Crie arquivo na raiz do projeto:

**RELEASE_NOTES.txt**
```
Versão 1.0.1 - $(date +%Y-%m-%d)

✨ Novas funcionalidades:
- [Descrever novo recurso 1]
- [Descrever novo recurso 2]

🐛 Correções:
- [Bug corrigido 1]
- [Bug corrigido 2]

⚡ Melhorias:
- Performance otimizada
```

---

## 🔄 PASSO 6: CRIAR WORKFLOW GITHUB ACTIONS

### 6.1 Estrutura de Pastas
```
seu-repo/
├── .github/
│   └── workflows/
│       └── firebase-deploy.yml  ← CRIAR ESTE ARQUIVO
├── app/
├── build.gradle
└── RELEASE_NOTES.txt
```

### 6.2 Conteúdo de firebase-deploy.yml

```yaml
name: Build and Deploy to Firebase

on:
  push:
    branches:
      - main
  workflow_dispatch:  # Permite rodar manualmente

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Java
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Restore keystore
        run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > keystore.jks
          ls -lah keystore.jks

      - name: Build Release APK
        run: |
          ./gradlew assembleRelease -Pandroid.injected.signing.store.file=keystore.jks \
            -Pandroid.injected.signing.store.password="${{ secrets.KEYSTORE_PASSWORD }}" \
            -Pandroid.injected.signing.key.alias="${{ secrets.KEY_ALIAS }}" \
            -Pandroid.injected.signing.key.password="${{ secrets.KEY_PASSWORD }}"
        env:
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}

      - name: Restore Firebase credentials
        run: echo "${{ secrets.FIREBASE_CREDENTIALS }}" > firebase-key.json

      - name: Install Firebase CLI
        run: npm install -g firebase-tools

      - name: Deploy to Firebase
        run: |
          firebase appdistribution:distribute \
            app/build/outputs/apk/release/app-release.apk \
            --app="${{ secrets.FIREBASE_APP_ID }}" \
            --release-notes-file=RELEASE_NOTES.txt \
            --groups="testers" \
            --service-account-file=firebase-key.json

      - name: Cleanup
        if: always()
        run: |
          rm -f keystore.jks firebase-key.json

      - name: Notify Success
        if: success()
        run: echo "✅ Deploy realizado com sucesso!"

      - name: Notify Failure
        if: failure()
        run: echo "❌ Deploy falhou. Verificar logs."
```

---

## 👥 PASSO 7: CONFIGURAR TESTERS NO FIREBASE

### 7.1 Acessar Firebase Console
```
https://console.firebase.google.com/
Seu Projeto → App Distribution
```

### 7.2 Criar Grupo de Testers
```
1. Aba "Groups"
2. "+ Create Group"
3. Nome: "testers"
4. Adicionar emails dos testers
5. Salvar
```

### 7.3 Testers Receberão
- Email de convite para instalar o app
- Notificações quando houver nova versão
- Link de download direto

---

## ✅ PASSO 8: PRIMEIRO DEPLOY (Manual)

### 8.1 Fazer Push do Código
```bash
git add .github/workflows/firebase-deploy.yml
git add build.gradle
git add RELEASE_NOTES.txt
git commit -m "feat: add GitHub Actions Firebase distribution"
git push origin main
```

### 8.2 Verificar Execução
```
GitHub → Seu Repo → "Actions" tab
Procure por "Build and Deploy to Firebase"
Clique para ver logs em tempo real
```

### 8.3 Possíveis Problemas

**Erro: "Authentication failed"**
- ✓ Verificar Firebase Credentials no Secrets
- ✓ Verificar Firebase App ID

**Erro: "Invalid keystore"**
- ✓ Reconverter keystore.jks para Base64
- ✓ Verificar senha do keystore

**Erro: "Build failure"**
- ✓ Rodar `./gradlew build` localmente primeiro
- ✓ Verificar gradle.build syntax

---

## 🚀 PASSO 9: USAR O WORKFLOW (DAQUI EM DIANTE)

### Opção A: Push Automático (Recomendado)
```bash
# Fazer alterações no código
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# O workflow dispara automaticamente!
# Verifique em: GitHub → Actions
```

### Opção B: Disparo Manual
```
GitHub → Actions → "Build and Deploy to Firebase"
Clique "Run workflow"
Branch: main
```

---

## 📊 MONITORAMENTO

### Verificar Deployments
```
Firebase Console → App Distribution → Releases
```

### Logs do GitHub Actions
```
GitHub → Actions → Clique no workflow
Ver step-by-step dos logs
```

### Notificações aos Testers
Automáticas via Firebase App Distribution

---

## 🔧 TROUBLESHOOTING RÁPIDO

| Problema | Solução |
|----------|---------|
| Workflow não dispara | Verificar branch (deve ser `main`) |
| Build falha | Rodar `./gradlew clean build` localmente |
| Credenciais inválidas | Verificar formato JSON no Secrets |
| APK não é enviado | Verificar FIREBASE_APP_ID |
| Testers não recebem | Verificar grupo "testers" no Firebase |

---

## 📝 CHECKLIST FINAL

- [ ] Service Account criado no Google Cloud
- [ ] Firebase Key JSON baixado e salvo
- [ ] Keystore.jks criado/preparado
- [ ] Todos 6 Secrets adicionados ao GitHub
- [ ] build.gradle atualizado com Firebase plugin
- [ ] Arquivo firebase-deploy.yml criado em `.github/workflows/`
- [ ] RELEASE_NOTES.txt criado
- [ ] Grupo "testers" criado no Firebase
- [ ] Emails dos testers adicionados ao grupo
- [ ] Primeiro push realizado e workflow executado com sucesso

---

## 🎯 RESULTADO FINAL

**Fluxo Automatizado:**
```
Você faz: git push
    ↓
GitHub Actions dispara
    ↓
Android APK é compilado
    ↓
APK é enviado ao Firebase
    ↓
Testers recebem notificação
    ↓
Podem baixar/instalar novo app
```

**Tempo total:** ~5 minutos por deploy automático

---

## 📞 SUPORTE

Para questões:
- GitHub Actions: https://docs.github.com/en/actions
- Firebase Distribution: https://firebase.google.com/docs/app-distribution
- Android Gradle: https://developer.android.com/studio/build
