# 📋 CHECKLIST DE IMPLEMENTAÇÃO
## GitHub Actions + Firebase Distribution

**Projeto:** ________________  
**Data Início:** ________________  
**Responsável:** ________________

---

## FASE 1: PREPARAÇÃO (15 min)

### Google Cloud Setup
- [ ] Conta Google Cloud criada
- [ ] Novo projeto criado: "AppName-CI-CD"
- [ ] Firebase Management API ativada
- [ ] Aguardado 30 segundos após ativação

### Service Account
- [ ] Service Account "firebase-deployment" criado
- [ ] Role "Firebase Admin" atribuído
- [ ] Chave JSON gerada e baixada
- [ ] Arquivo nomeado como: `firebase-key.json`
- [ ] ⚠️ Arquivo guardado em local SEGURO

### Keystore
- [ ] Keystore.jks existe (criar ou validar existente)
- [ ] Comando executado: `keytool -genkey -v -keystore keystore.jks...`
- [ ] Senha do keystore guardada: `________________`
- [ ] Alias do keystore guardado: `________________`

### Firebase Console
- [ ] Firebase Project aberto
- [ ] App Android adicionado (se não existir)
- [ ] Firebase App ID obtido: `________________`
- [ ] Grupo "testers" criado
- [ ] Emails dos testers adicionados: 
  - [ ] Email 1: ________________
  - [ ] Email 2: ________________
  - [ ] Email 3: ________________

---

## FASE 2: CONVERSÕES (5 min)

### Base64 Conversion
- [ ] Keystore convertido para Base64
- [ ] Arquivo `keystore-base64.txt` criado
- [ ] Conteúdo copiado e guardado

### Credentials Formatting
- [ ] Firebase JSON verificado (válido)
- [ ] Conteúdo do JSON copiado e guardado
- [ ] Especial characters verificados (aspas, etc)

---

## FASE 3: GITHUB SECRETS (5 min)

### Configuração de Secrets
Acesso: `https://github.com/seu-usuario/seu-repo/settings/secrets/actions`

#### Secret 1: FIREBASE_CREDENTIALS
- [ ] Nome exato: `FIREBASE_CREDENTIALS`
- [ ] Valor: Firebase JSON completo
- [ ] Salvo com sucesso

#### Secret 2: KEYSTORE_BASE64
- [ ] Nome exato: `KEYSTORE_BASE64`
- [ ] Valor: Keystore em Base64
- [ ] Salvo com sucesso

#### Secret 3: KEYSTORE_PASSWORD
- [ ] Nome exato: `KEYSTORE_PASSWORD`
- [ ] Valor: Senha do keystore
- [ ] Salvo com sucesso

#### Secret 4: KEY_ALIAS
- [ ] Nome exato: `KEY_ALIAS`
- [ ] Valor: `android-key` (padrão)
- [ ] Salvo com sucesso

#### Secret 5: KEY_PASSWORD
- [ ] Nome exato: `KEY_PASSWORD`
- [ ] Valor: Senha do keystore (mesmo de KEYSTORE_PASSWORD)
- [ ] Salvo com sucesso

#### Secret 6: FIREBASE_APP_ID
- [ ] Nome exato: `FIREBASE_APP_ID`
- [ ] Valor: Firebase App ID (formato: 1:123456789:android:...)
- [ ] Salvo com sucesso

### Verificação de Secrets
- [ ] Total de 6 secrets criados
- [ ] Todos os nomes estão EXATOS (case-sensitive)
- [ ] Nenhum secret tem espaços extras

---

## FASE 4: CONFIGURAÇÃO DO PROJETO (10 min)

### Estrutura de Pastas
- [ ] Pasta `.github/` criada (na raiz do projeto)
- [ ] Pasta `.github/workflows/` criada
- [ ] Arquivo `.github/workflows/firebase-deploy.yml` criado
- [ ] Arquivo contém 50+ linhas de código

### Build.gradle Atualizado
- [ ] Arquivo `app/build.gradle` aberto
- [ ] Plugins adicionados:
  - [ ] `id 'com.google.firebase.appdistribution'`
  - [ ] `id 'com.google.gms.google-services'`
- [ ] Seção `signingConfigs` adicionada
- [ ] Seção `firebaseAppDistribution` adicionada
- [ ] applicationId verificado
- [ ] versionCode incrementado
- [ ] Arquivo salvo

### Release Notes
- [ ] Arquivo `RELEASE_NOTES.txt` criado na raiz
- [ ] Contém informações da versão
- [ ] Formatado com:
  - [ ] ✨ Novas funcionalidades
  - [ ] 🐛 Correções
  - [ ] ⚡ Melhorias
- [ ] Salvo com sucesso

### Keystore no Projeto
- [ ] Arquivo `keystore.jks` está na RAIZ do projeto
- [ ] Arquivo `.gitignore` contém `keystore.jks`
- [ ] Arquivo `.gitignore` contém `firebase-key.json`

---

## FASE 5: VALIDAÇÃO LOCAL (10 min)

### Testes Gradle
```bash
./gradlew clean build
```
- [ ] Comando executado com sucesso
- [ ] Zero erros no output
- [ ] Build concluído normalmente

### Testes de Assinatura
```bash
./gradlew assembleRelease
```
- [ ] Comando executado com sucesso
- [ ] APK gerado em: `app/build/outputs/apk/release/`
- [ ] Arquivo `app-release.apk` criado

### Validação de Workflow
- [ ] Arquivo `firebase-deploy.yml` revisado
- [ ] Nenhum erro de sintaxe YAML
- [ ] Todos os `${{ secrets.VARIAVEL }}` correspondem aos secrets criados

---

## FASE 6: PRIMEIRO COMMIT (5 min)

### Preparar Commit
```bash
git add .github/workflows/firebase-deploy.yml
git add app/build.gradle
git add RELEASE_NOTES.txt
git add .gitignore
git commit -m "feat: setup GitHub Actions + Firebase Distribution"
```
- [ ] Comando executado com sucesso
- [ ] Nenhum erro durante commit

### Push para GitHub
```bash
git push origin main
```
- [ ] Comando executado com sucesso
- [ ] Sem erros de autenticação
- [ ] Código chegou ao GitHub

---

## FASE 7: VERIFICAÇÃO DO WORKFLOW (5 min)

### GitHub Actions
Acesso: `https://github.com/seu-usuario/seu-repo/actions`

- [ ] Workflow "Build and Deploy to Firebase" aparece
- [ ] Status mostra progresso (amarelo) ou concluído (verde)
- [ ] ❌ Se vermelho: verificar logs

### Logs Detalhados
- [ ] Expandir cada step do workflow
- [ ] Verificar: 
  - [ ] "Checkout code" - sucesso
  - [ ] "Set up Java" - sucesso
  - [ ] "Build Release APK" - sucesso
  - [ ] "Deploy to Firebase" - sucesso
- [ ] ❌ Se falha em algum step: registrar mensagem de erro

### Firebase Console
Acesso: `https://console.firebase.google.com/projeto/app-distribution`

- [ ] Aba "Releases" mostra novo release
- [ ] APK upload realizado com sucesso
- [ ] Release notes aparecem corretamente
- [ ] Grupo "testers" está vinculado

### Notificações aos Testers
- [ ] Testers recebem email de convite (primeira vez)
- [ ] Testers recebem notificação de novo app
- [ ] Link de download funciona
- [ ] App instala corretamente no celular

---

## FASE 8: TESTES FUNCIONAIS (10 min)

### Teste 1: Fazer Alteração Simples
```bash
# Altere algo no código (ex: um string)
# Commit e push
git add .
git commit -m "test: small change to trigger workflow"
git push origin main
```
- [ ] Workflow dispara automaticamente
- [ ] Aguardar 5-10 minutos
- [ ] Nova versão aparece no Firebase
- [ ] Testers recebem notificação

### Teste 2: Workflow Manual
- [ ] GitHub → Actions → "Build and Deploy to Firebase"
- [ ] Clique em "Run workflow"
- [ ] Selecione branch "main"
- [ ] Clique "Run workflow"
- [ ] Aguardar execução
- [ ] Verificar sucesso

### Teste 3: Download no Celular
- [ ] Abrir email de notificação no celular
- [ ] Clicar em link de download
- [ ] App instala corretamente
- [ ] Versão está atualizada

---

## FASE 9: DOCUMENTAÇÃO (5 min)

### Arquivos Criados
- [ ] `plano-github-actions-firebase.md` - arquivado
- [ ] `QUICK-START.md` - compartilhado com equipe
- [ ] `build.gradle-snippet.txt` - arquivado
- [ ] `setup-helper.sh` - salvo no projeto (opcional)
- [ ] `RELEASE_NOTES.txt` - atualizado com versão

### Documentação do Projeto
- [ ] README.md atualizado com instruções de CI/CD
- [ ] CONTRIBUTING.md menciona workflow automático
- [ ] Senhas/credenciais documentadas (seguramente)

---

## FASE 10: LIMPEZA E SEGURANÇA (5 min)

### Segurança
- [ ] ❌ Nenhum secret hardcoded no código
- [ ] ❌ Nenhuma chave privada em repositório
- [ ] ✅ Todos os arquivos sensíveis em `.gitignore`:
  - [ ] keystore.jks
  - [ ] firebase-key.json
  - [ ] keystore-base64.txt
- [ ] ✅ GitHub Secrets revisados
- [ ] ❌ Credenciais NÃO estão em arquivos locais visíveis

### Backup
- [ ] [ ] Firebase-key.json salvo em cofre seguro (Vault/LastPass/etc)
- [ ] [ ] Senha do keystore documentada (seguramente)
- [ ] [ ] Arquivo keystore.jks backup criado

---

## ✅ CONCLUSÃO

- [ ] Todas as fases completadas
- [ ] Workflow funcionando 100%
- [ ] Testers recebendo atualizações
- [ ] Documentação completa

**Status Final:** ☐ Sucesso  ☐ Com Problemas  ☐ Não Iniciado

**Observações:**
```
_____________________________________________________________

_____________________________________________________________

_____________________________________________________________
```

**Assinado por:** ________________  
**Data:** ________________  

---

## 🎓 PRÓXIMOS PASSOS

- [ ] Configurar notificações Slack
- [ ] Adicionar assinatura automática de APK
- [ ] Criar ambiente de staging
- [ ] Implementar testes automatizados
- [ ] Documentar em wiki interna

---

**Backup dos Documentos:**
- Arquivo: `plano-github-actions-firebase.md`
- Arquivo: `firebase-deploy.yml`
- Arquivo: `build.gradle-snippet.txt`
- Arquivo: `QUICK-START.md`
- Arquivo: `setup-helper.sh`

✨ **Parabéns! Seu pipeline CI/CD está pronto!** ✨
