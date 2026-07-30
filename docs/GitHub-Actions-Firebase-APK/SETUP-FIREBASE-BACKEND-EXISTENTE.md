# ⚡ GitHub Actions + Firebase (Backend Existente)
## Plano Simplificado Para Seu Contexto

---

## 🎯 VANTAGEM: Você Já Tem Tudo!

Já que você tem Firebase como backend:

```
✅ Firebase Console já aberto
✅ Projeto Firebase ativo
✅ Firebase Auth funcionando
✅ Firestore + Functions + Hosting
✅ Credenciais já existem
```

**O que precisamos adicionar:**
```
⚙️ Apenas GitHub Actions + App Distribution
   (Usa o mesmo Firebase que você já tem)
```

---

## 📋 REQUISITOS (MUITO SIMPLES)

- [ ] Repositório GitHub criado
- [ ] Android Studio com projeto
- [ ] Acesso a Firebase Console (seu projeto existente)
- [ ] Arquivo keystore.jks (criar se não tiver)

**Não precisa de:**
- ❌ Novo projeto no Google Cloud
- ❌ Novo Service Account (reutiliza o existente)
- ❌ Novas credenciais

---

## 🚀 PASSO-A-PASSO RÁPIDO (10 MIN)

### PASSO 1: Gerar Service Account (2 min)
```
Seu Firebase Project existente → 
  Configurações do Projeto (⚙️) → 
  Aba "Contas de Serviço" → 
  "+ Gerar chave privada" → 
  Selecione "Node.js" (salva como JSON)
```

**Resultado:** Você recebe `seu-projeto-firebase-adminsdk-xxxxx.json`

### PASSO 2: Criar/Validar Keystore (2 min)

**Se já tem keystore.jks:**
```bash
# Apenas valide se está funcional
ls -lah keystore.jks
```

**Se NÃO tem:**
```bash
keytool -genkey -v -keystore keystore.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias android-key

# Guardar a SENHA
```

### PASSO 3: Converter Keystore para Base64 (1 min)
```bash
# macOS
base64 -i keystore.jks | pbcopy

# Linux
base64 keystore.jks
```

Copiar o conteúdo gerado.

### PASSO 4: Obter Firebase App ID (1 min)
```
Firebase Console → 
  Seu Projeto → 
  Configurações → 
  Apps → 
  Seu app Android → 
  ID do App (formato: 1:123456:android:abc...)
```

### PASSO 5: Adicionar Secrets no GitHub (2 min)
```
GitHub → Seu Repo → Settings → Secrets → Actions
```

Adicione 6 secrets:

| Nome | Valor |
|------|-------|
| `FIREBASE_CREDENTIALS` | Conteúdo completo do JSON |
| `KEYSTORE_BASE64` | Keystore em Base64 (Passo 3) |
| `KEYSTORE_PASSWORD` | Senha do keystore |
| `KEY_ALIAS` | `android-key` |
| `KEY_PASSWORD` | (mesma senha do keystore) |
| `FIREBASE_APP_ID` | ID do App (Passo 4) |

### PASSO 6: Adicionar Workflow (1 min)
```
Crie: .github/workflows/firebase-deploy.yml
Copie o conteúdo do arquivo fornecido
```

### PASSO 7: Atualizar build.gradle (1 min)
```gradle
// Adicione no início
plugins {
    id 'com.google.firebase.appdistribution' version '16.0.0'
}

// Adicione no android{}
signingConfigs {
    release {
        storeFile file('keystore.jks')
        storePassword System.getenv('KEYSTORE_PASSWORD')
        keyAlias System.getenv('KEY_ALIAS')
        keyPassword System.getenv('KEY_PASSWORD')
    }
}

firebaseAppDistribution {
    serviceCredentialsFile = 'firebase-key.json'
    releaseNotesFile = 'RELEASE_NOTES.txt'
    groups = 'testers'
}
```

### PASSO 8: Criar Grupo de Testers no Firebase (1 min)
```
Firebase Console → 
  App Distribution → 
  Groups → 
  "+ Create Group" → 
  Nome: "testers" → 
  Adicionar emails dos testers
```

### PASSO 9: Fazer Push (Automático!)
```bash
git add .
git commit -m "feat: add GitHub Actions with Firebase"
git push origin main
```

**Pronto!** Workflow dispara automaticamente.

---

## 📊 MATRIZ DE COMPARAÇÃO

| Aspecto | Antes | Agora |
|---------|-------|-------|
| Atualizar app | Conectar USB + Android Studio | `git push` |
| Tempo por update | 5 minutos | 5 minutos (automático) |
| Notificar testers | Manualmente | Automático |
| Controle de versão | Manual | Automático |

---

## 🔄 FLUXO DE TRABALHO FINAL

```
Seu desenvolvimento:
  1. Código → Git
  2. git push origin main
  3. ↓
GitHub Actions (automático):
  4. Build APK
  5. Assinatura
  6. Upload para Firebase
  7. ↓
Firebase App Distribution (automático):
  8. Notifica testers
  9. ↓
Testers:
  10. Recebem email
  11. Instalam nova versão
```

---

## 🛠️ ARQUIVOS A CRIAR/MODIFICAR

```
seu-repo/
├── .github/
│   └── workflows/
│       └── firebase-deploy.yml          ← CRIAR (fornecido)
├── app/
│   └── build.gradle                      ← MODIFICAR (adicionar Firebase)
├── RELEASE_NOTES.txt                     ← CRIAR (versionamento)
├── keystore.jks                          ← JÁ EXISTE ou CRIAR
└── .gitignore                            ← ADICIONAR entradas
```

---

## 📝 EXEMPLO build.gradle COMPLETO

```gradle
plugins {
    id 'com.android.application'
    id 'com.google.firebase.appdistribution' version '16.0.0'
    id 'com.google.gms.google-services'
}

android {
    namespace 'com.seu.app'
    compileSdk 34

    defaultConfig {
        applicationId 'com.seu.app'
        minSdk 21
        targetSdk 34
        versionCode 1
        versionName '1.0.0'
    }

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
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

firebaseAppDistribution {
    serviceCredentialsFile = 'firebase-key.json'
    releaseNotesFile = 'RELEASE_NOTES.txt'
    groups = 'testers'
}

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.2.0')
    implementation 'com.google.firebase:firebase-auth'
    implementation 'com.google.firebase:firebase-firestore'
    implementation 'com.google.firebase:firebase-analytics'
    
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'com.google.android.material:material:1.9.0'
}
```

---

## 🐛 TROUBLESHOOTING ESPECÍFICO

### "Firebase App ID inválido"
```
✓ Copiar do Firebase Console
✓ Formato: 1:123456789:android:abcdefg123456
✓ Não copiar de outro lugar
```

### "Authentication failed"
```
✓ JSON do Service Account está correto?
✓ JSON não foi editado/corrompido?
✓ Secret FIREBASE_CREDENTIALS tem JSON completo?
```

### "Keystore password incorrect"
```
✓ Senha digitada corretamente no keytool?
✓ KEYSTORE_PASSWORD e KEY_PASSWORD são iguais?
✓ Sem espaços extras nos secrets?
```

### "Grupo testers não encontrado"
```
✓ Grupo "testers" foi criado no Firebase?
✓ Pelo menos 1 email foi adicionado?
✓ Grupo aparece em: App Distribution → Groups?
```

---

## ✅ VALIDAR ANTES DE FAZER PUSH

```bash
# 1. Testar build localmente
./gradlew clean build

# 2. Testar assinatura
./gradlew assembleRelease

# 3. Verificar APK foi criado
ls -lah app/build/outputs/apk/release/app-release.apk

# 4. Validar arquivo YAML
# (verificar se firebase-deploy.yml tem sintaxe correta)
```

---

## 🎯 APÓS PRIMEIRO DEPLOY BEM-SUCEDIDO

```
GitHub Actions → Actions → "Build and Deploy to Firebase"
Status: ✅ verde

Firebase Console → App Distribution → Releases
Última release: hoje (sua versão)

Email recebido pelos testers:
"A new version of app is available"
```

---

## 📚 DOCUMENTOS RELACIONADOS

**Do pacote anterior, você ainda precisa de:**
1. `firebase-deploy.yml` - Workflow (ESSENCIAL)
2. `build.gradle-snippet.txt` - Referência (ÚTIL)
3. `CHECKLIST.md` - Acompanhamento (OPCIONAL)

**Não precisa de:**
- ❌ Guia Google Cloud (já tem Firebase)
- ❌ Setup Helper script (tudo é simples)
- ❌ Parte de "Criar Service Account" (já existe)

---

## 🚀 TL;DR (Resumo Executivo)

1. **Service Account:** Firebase Console → Contas de Serviço → Gerar chave JSON ✅
2. **Keystore:** Criar ou validar `keystore.jks` ✅
3. **GitHub Secrets:** Adicionar 6 secrets ✅
4. **Código:** Adicionar `.github/workflows/firebase-deploy.yml` ✅
5. **Gradle:** Atualizar `app/build.gradle` ✅
6. **Firebase:** Criar grupo "testers" ✅
7. **Push:** `git push origin main` ✅

**Tempo total: 10-15 minutos**

---

## 🎓 O QUE MUDA NO SEU WORKFLOW

### Antes:
```
Dev faz código → Conecta celular por USB → 
  Abre Android Studio → Clica "Run" → 
  Espera 5 min → App instala
```

### Depois:
```
Dev faz código → git push → 
  GitHub Actions faz tudo → 
  (Testers recebem notificação automaticamente)
```

---

## 💡 PRÓXIMAS FEATURES (Opcional)

Depois que tiver funcionando:

1. **Notificações Slack:** Notificar time quando deploy termina
2. **Automatic versioning:** Incrementar versionCode automaticamente
3. **Staged rollout:** Liberar para % de usuários (Play Console)
4. **Performance testing:** Rodar testes antes de deploy
5. **APK analysis:** Verificar tamanho e métricas

---

## 🎯 VOCÊ ESTÁ PRONTO!

Diferença do seu setup:
- ✅ Já tem Firebase → Mais simples!
- ✅ Já tem Auth/Firestore/Functions → Reutiliza credenciais
- ✅ Apenas falta: GitHub Actions + App Distribution

**Comece pelo PASSO 1 do guia acima!**
