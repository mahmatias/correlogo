# ⚡ QUICK START - GitHub Actions + Firebase (5 Minutos)

## 🎯 Resumo Executivo

Este documento resume em passos práticos como configurar deploy automático.

---

## ✅ PRÉ-REQUISITOS (Confirmar que você TEM)

- [ ] Repositório GitHub criado
- [ ] Conta Firebase com projeto ativo
- [ ] Android Studio com projeto Android
- [ ] Acesso a Google Cloud Console
- [ ] Terminal/Shell disponível

---

## 📋 PASSO-A-PASSO RÁPIDO

### PASSO 1: Criar Keystore (1 min)
```bash
# Se NÃO tiver keystore.jks, execute:
keytool -genkey -v -keystore keystore.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias android-key

# Responda as perguntas (qualquer resposta serve)
# GUARDE A SENHA!
```

### PASSO 2: Gerar Firebase Credentials (2 min)
```
1. Acesse: https://console.cloud.google.com/
2. Crie projeto novo: "AppName-CI-CD"
3. Vá para "APIs & Services" → "Library"
4. Ative "Firebase Management API"
5. Vá para "Credentials" → "+ CREATE CREDENTIALS"
6. Escolha "Service Account"
7. Nome: "firebase-deployment"
8. Role: "Firebase Admin"
9. Crie chave JSON e baixe
```

### PASSO 3: Preparar Keystore Base64 (1 min)
```bash
# Converter keystore para Base64
base64 keystore.jks > keystore-base64.txt

# Copiar conteúdo do arquivo
cat keystore-base64.txt
# (guarde o conteúdo)
```

### PASSO 4: Adicionar GitHub Secrets (1 min)
```
GitHub → Settings → Secrets and variables → Actions
Adicione 6 secrets:

1. FIREBASE_CREDENTIALS
   Valor: Conteúdo do arquivo JSON baixado

2. KEYSTORE_BASE64
   Valor: Conteúdo do keystore-base64.txt

3. KEYSTORE_PASSWORD
   Valor: Senha que você digitou no keytool

4. KEY_ALIAS
   Valor: android-key

5. KEY_PASSWORD
   Valor: (mesma senha do keystore)

6. FIREBASE_APP_ID
   Valor: ID do app (Firebase Console → Configurações)
```

### PASSO 5: Criar Arquivo Workflow (1 min)
```
1. Crie pasta: .github/workflows/
2. Crie arquivo: firebase-deploy.yml
3. Copie conteúdo do arquivo firebase-deploy.yml (arquivo fornecido)
4. Commit e push
```

### PASSO 6: Atualizar build.gradle (1 min)
```
1. Abra app/build.gradle
2. Adicione ao topo:
   id 'com.google.firebase.appdistribution' version '16.0.0'
   id 'com.google.gms.google-services' version '4.3.15'

3. Adicione signingConfigs (veja arquivo build.gradle-snippet.txt)
4. Adicione firebaseAppDistribution config
5. Commit e push
```

### PASSO 7: Criar Release Notes
```
1. Crie arquivo na raiz: RELEASE_NOTES.txt

Conteúdo:
---
Versão 1.0 - Primeira release

✨ Features:
- App funcional

🐛 Bugfixes:
- N/A
---
```

### PASSO 8: Configurar Testers (1 min)
```
1. Firebase Console → App Distribution → Groups
2. "+ Create Group"
3. Nome: "testers"
4. Adicione emails dos testers
5. Salve
```

### PASSO 9: Primeiro Deploy (Automático)
```bash
# Fazer push do código
git add .
git commit -m "feat: setup github actions"
git push origin main

# Workflow dispara automaticamente!
# Verifique em: GitHub → Actions
```

---

## 🚀 USAR DAQUI EM DIANTE

Apenas faça:
```bash
git add .
git commit -m "sua mensagem"
git push origin main
```

**Pronto!** O app será automaticamente:
- ✅ Compilado
- ✅ Assinado
- ✅ Enviado ao Firebase
- ✅ Testers receberão notificação

---

## ⚠️ ERROS COMUNS

| Erro | Solução |
|------|---------|
| "authentication_failed" | Verificar Firebase Credentials JSON |
| "invalid_keystore" | Reconverter keystore.jks para Base64 |
| "build_failure" | Testar `./gradlew build` localmente |
| "app not found" | Verificar FIREBASE_APP_ID |

---

## 📊 TEMPO TOTAL

- Setup inicial: **~15 minutos**
- Cada deploy depois: **~5 minutos** (automático)

---

## 📚 DOCUMENTOS FORNECIDOS

1. **plano-github-actions-firebase.md** - Guia completo detalhado
2. **firebase-deploy.yml** - Workflow pronto para usar
3. **build.gradle-snippet.txt** - Configurações Gradle
4. **QUICK-START.md** - Este arquivo

---

## 🎓 Próximos Passos (Opcional)

- [ ] Configurar notificações Slack para deployments
- [ ] Adicionar testes automatizados
- [ ] Criar ambiente staging/production
- [ ] Configurar aprovações antes de deploy

---

## ✨ Você está pronto! Comece pelo PASSO 1.
