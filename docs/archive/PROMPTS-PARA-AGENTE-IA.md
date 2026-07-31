# 🤖 PROMPTS PRONTOS PARA AGENTE DE IA
## Copiar e Colar Diretamente

---

## 🟢 PROMPT 1: CI/CD - GitHub Actions (Comece Aqui)

```
Vou implementar CI/CD automático para meu app Android.

Contexto:
- Backend: Firebase (Auth + Firestore + Functions)
- Objetivo: Deploy automático de APK via GitHub Actions
- Trigger: git push na branch main
- Destino: Firebase App Distribution → Testers

Documentação fornecida: GitHub-Actions-Firebase-APK.zip

Tarefas:
1. Leia ULTRA-RAPIDO.md (3 minutos) para entender o fluxo
2. Siga os 9 passos exatamente (estão numerados)
3. Use SETUP-FIREBASE-BACKEND-EXISTENTE.md para referência (já tenho Firebase)
4. Implemente cada passo conforme indicado:
   - Passo 1: Gerar Service Account no Google Cloud
   - Passo 2: Criar/validar keystore.jks
   - Passo 3: Converter keystore para Base64
   - Passo 4: Obter Firebase App ID
   - Passo 5: Adicionar 6 Secrets no GitHub
   - Passo 6: Adicionar arquivo firebase-deploy.yml em .github/workflows/
   - Passo 7: Atualizar app/build.gradle
   - Passo 8: Criar grupo "testers" no Firebase
   - Passo 9: Fazer primeiro git push

Arquivos de referência:
- firebase-deploy.yml → Copiar para .github/workflows/
- build.gradle-snippet.txt → Copiar em app/build.gradle

Resultado esperado após conclusão:
- GitHub Actions workflow dispara ao fazer git push
- APK é compilado automaticamente
- APK é assinado automaticamente
- APK é enviado ao Firebase App Distribution
- Testers recebem notificação de novo app
- Tudo funciona sem intervenção manual

Dúvidas? Consulte:
- QUICK-START.md para resumo
- ARQUITETURA-FIREBASE-COMPLETA.md para diagrama
- CHECKLIST.md para acompanhar progresso

Comece pelo ULTRA-RAPIDO.md AGORA.
```

---

## 🟢 PROMPT 2: Bluetooth FTMS (Próximo)

```
Preciso corrigir a conexão Bluetooth com esteira WiLinktech Vision ID 2592.

Contexto:
- Esteira: WiLinktech Vision (FTMS completo)
- Erro atual: "Required FTMS characteristics not found"
- Causa: Código tenta acessar características antes de descobri-las
- Status: Esteira funciona perfeitamente (confirmado com nRF Connect)

Documentação fornecida: FTMS-Bluetooth-Esteiras.zip

Tarefas:
1. Leia DIAGNOSTICO-FTMS-NRF.md para entender:
   - Por que a esteira implementa FTMS corretamente
   - Por que o erro ocorre no seu código
   - Qual é a solução (ordem de operações)

2. Compare seu código com FTMSConnectionFixed.kt:
   - Procure pela implementação de onConnectionStateChange()
   - Procure pela implementação de onServicesDiscovered()
   - Procure por enableNotifications()

3. Identifique as diferenças:
   - Seu código tenta acessar características logo após conectar?
   - Seu código aguarda onServicesDiscovered() completar?
   - Seu código aguarda 500ms antes de chamar discoverServices()?

4. Adapte seu código seguindo FTMSConnectionFixed.kt

5. Teste a conexão

Pontos críticos (NÃO IGNORE):
- discoverServices() deve ser chamado APÓS onConnectionStateChange(STATE_CONNECTED)
- Deve aguardar onServicesDiscovered() com status SUCCESS
- SÓ DEPOIS pode acessar getService() e getCharacteristic()
- O delay de 500ms é importante para estabilizar conexão

UUIDs corretos da sua esteira:
- FITNESS_MACHINE_SERVICE = "0000181e-0000-1000-8000-00805f9b34fb"
- TREADMILL_DATA = "00002acd-0000-1000-8000-00805f9b34fb"
- FITNESS_MACHINE_STATUS = "00002ada-0000-1000-8000-00805f9b34fb"
- FITNESS_MACHINE_FEATURE = "00002acc-0000-1000-8000-00805f9b34fb"
- FITNESS_MACHINE_CONTROL_PT = "00002ad9-0000-1000-8000-00805f9b34fb"

Resultado esperado:
- Conexão estabelecida
- Serviços descobertos
- Características encontradas
- Notificações habilitadas
- Dados da esteira chegando continuamente
- Erro "Required FTMS characteristics not found" desaparece

Próximo passo após funcionar:
- Use CHECKLIST-TESTES-FTMS-COMPLETO.md quando estiver com a esteira novamente
- Faça testes avançados para documentar comportamento
- Valide velocidade, inclinação, e controle

Comece lendo DIAGNOSTICO-FTMS-NRF.md AGORA.
```

---

## 🟢 PROMPT 3: Tudo Junto (Se Preferir Duas Tarefas Paralelas)

```
Tenho 2 tarefas paralelas para implementar em meu app Android:

TAREFA 1: GitHub Actions + Firebase (CI/CD)
- ZIP: GitHub-Actions-Firebase-APK.zip
- Início: ULTRA-RAPIDO.md
- Tempo: 15-20 minutos
- Status: Não iniciado

TAREFA 2: Bluetooth FTMS (Conexão com Esteira)
- ZIP: FTMS-Bluetooth-Esteiras.zip
- Início: DIAGNOSTICO-FTMS-NRF.md
- Tempo: 15 minutos
- Status: Erro "Required FTMS characteristics not found"

Prioridade de implementação:
1º lugar: TAREFA 1 (mais crítico, mais rápido)
2º lugar: TAREFA 2 (dependência menor)

Para TAREFA 1 (CI/CD):
- Siga ULTRA-RAPIDO.md passo-a-passo
- Use build.gradle-snippet.txt para Gradle config
- Copie firebase-deploy.yml para .github/workflows/
- Resultado: git push → Deploy automático

Para TAREFA 2 (Bluetooth):
- Leia DIAGNOSTICO-FTMS-NRF.md
- Use FTMSConnectionFixed.kt como referência
- Adapte seu código com a ordem correta de operações
- Resultado: Conexão FTMS funcionando

Comece pela TAREFA 1 agora.
```

---

## 🟡 PROMPT 4: Se Tiver Dúvidas Específicas em CI/CD

```
Tenho dúvida em um passo específico do CI/CD:

[DESCREVER A DÚVIDA]

Documentação relacionada:
- ULTRA-RAPIDO.md (visão geral)
- QUICK-START.md (resumo)
- SETUP-FIREBASE-BACKEND-EXISTENTE.md (meu caso específico)
- ARQUITETURA-FIREBASE-COMPLETA.md (entender integração)
- CHECKLIST.md (acompanhar progresso)
- firebase-deploy.yml (referência de workflow)
- build.gradle-snippet.txt (referência de gradle)

Contexto:
- Já tenho Firebase como backend (Auth + Firestore + Functions)
- Quero adicionar GitHub Actions + App Distribution
- Backend não precisa modificar

Consulte a documentação acima e responda:
1. Qual é o passo problemático?
2. Qual é o erro exato?
3. Qual é o valor esperado vs valor actual?
```

---

## 🟡 PROMPT 5: Se Tiver Dúvidas Específicas em Bluetooth

```
Tenho dúvida em um aspecto específico da conexão Bluetooth:

[DESCREVER A DÚVIDA]

Informações da esteira:
- Modelo: WiLinktech Vision ID 2592
- Firmware: V10.23.17
- Protocolo: FTMS (Bluetooth LE)
- Status: Funciona perfeitamente com nRF Connect

Documentação relacionada:
- DIAGNOSTICO-FTMS-NRF.md (análise do problema)
- FTMSConnectionFixed.kt (código correto)
- CHECKLIST-TESTES-FTMS-COMPLETO.md (testes avançados)

Contexto:
- Erro atual: "Required FTMS characteristics not found"
- Causa identificada: Código acessa características antes de descoberta
- Solução: Seguir ordem correta de operações

Consulte a documentação acima e responda:
1. Qual é o comportamento esperado?
2. Qual é o comportamento actual?
3. Qual é a diferença?
```

---

## 🟣 PROMPT 6: Implementação Completa Passo-a-Passo

```
Quero implementar tudo com seu suporte total.

Faça assim:

Para CI/CD (GitHub Actions):
1. Leia ULTRA-RAPIDO.md comigo (linha por linha)
2. Explique cada passo
3. Ajude a executar cada um
4. Valide o resultado

Para Bluetooth FTMS:
1. Leia DIAGNOSTICO-FTMS-NRF.md comigo
2. Compare com FTMSConnectionFixed.kt
3. Identifique exatamente o que mudar
4. Implemente as mudanças
5. Teste

Comece pelo passo 1 de CI/CD agora.

Quando eu disser "próximo", vá para o próximo passo.
```

---

## 🔵 PROMPT 7: Apenas Validação (Já Tem Código Pronto)

```
Já implementei o código mas não tenho certeza se está correto.

Estou enviando meu código.
Quero que você compare com:
- FTMSConnectionFixed.kt (para Bluetooth)
- firebase-deploy.yml (para CI/CD)

Identifique:
1. O que está certo
2. O que está errado
3. O que falta
4. O que precisa ajustar

Depois me diga exatamente o que fazer para corrigir.
```

---

## 🔴 PROMPT 8: Debug - Algo Não Está Funcionando

```
Implementei tudo mas algo não funciona.

[DESCREVER O PROBLEMA]

Informações:
- Erro recebido: [COPIAR ERRO EXATO]
- Logs: [COPIAR LOGS RELEVANTES]
- Último passo bem-sucedido: [DESCREVER]
- Passo que falhou: [DESCREVER]

Documentação:
- Estou seguindo: [QUAL ARQUIVO?]
- Estou no passo: [QUAL NÚMERO?]

Tenho acesso a:
- Código-fonte? SIM / NÃO
- Logs do app? SIM / NÃO
- Logs do GitHub Actions? SIM / NÃO
- Logs do nRF Connect? SIM / NÃO

Ajude-me a debugar:
1. Identifique o problema real
2. Sugira solução
3. Guie implementação
4. Valide funciona
```

---

## 📋 PROMPT MESTRE (Recomendado)

Copie e cole exatamente isso no seu agente de IA:

```
CONTEXTO DO PROJETO:
- App Android com Kotlin
- Backend: Firebase (Auth + Firestore + Functions + Hosting)
- Esteira: WiLinktech Vision (FTMS)
- Objetivo: CI/CD automático + Bluetooth FTMS

DUAS TAREFAS PARALELAS:

TAREFA 1 - CI/CD (GitHub Actions + Firebase)
Prioridade: ALTA
Documentação: GitHub-Actions-Firebase-APK.zip
Tempo: 15-20 minutos
Comece por: ULTRA-RAPIDO.md

TAREFA 2 - Bluetooth FTMS
Prioridade: ALTA
Documentação: FTMS-Bluetooth-Esteiras.zip
Tempo: 15 minutos
Comece por: DIAGNOSTICO-FTMS-NRF.md
Problema: "Required FTMS characteristics not found"

INSTRUÇÕES:
1. Extraia os 2 ZIPs
2. Leia LEIA-ME-PRIMEIRO.md
3. Implemente TAREFA 1 primeiro
4. Depois implemente TAREFA 2
5. Me avise quando cada uma estiver pronta

Você tem toda a documentação necessária.
Não há segredos.
Tudo está escrito e testado.

Comece agora.
```

---

## 💬 EXEMPLOS DE COMUNICAÇÃO

### Se Algo Está Confuso:
```
Não entendi o passo X de [ARQUIVO].
Pode explicar com um exemplo?
```

### Se Algo Não Funciona:
```
Fiz o passo X mas recebi esse erro: [ERRO]
O que fazer?
```

### Se Tiver Dúvida Sobre Ordem:
```
Qual é a ordem correta dos passos para implementar tudo?
Devo fazer CI/CD primeiro ou Bluetooth?
```

### Se Quiser Testar:
```
Implementei tudo. Como testo que está funcionando?
Qual é o comportamento esperado?
```

---

## ✅ CHECKLIST FINAL

Antes de enviar ao agente de IA:
- [ ] Extraiu GitHub-Actions-Firebase-APK.zip
- [ ] Extraiu FTMS-Bluetooth-Esteiras.zip
- [ ] Leu LEIA-ME-PRIMEIRO.md
- [ ] Tem os arquivos:
  - [ ] ULTRA-RAPIDO.md
  - [ ] firebase-deploy.yml
  - [ ] build.gradle-snippet.txt
  - [ ] FTMSConnectionFixed.kt
  - [ ] DIAGNOSTICO-FTMS-NRF.md
- [ ] Escolheu um dos PROMPTS acima
- [ ] Está pronto para começar

---

**Boa sorte! 🚀**
