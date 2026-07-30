# Design: 5 Melhorias no Corre Logo

## 1. APK Export Automatizado

**Objetivo:** Ao gerar o APK de debug, copiá-lo para a raiz do projeto com nome padronizado e incrementar o versionCode automaticamente.

**Comportamento:**
- Extrair `versionName` do `android/app/build.gradle` (ex: `"1.0"`)
- Copiar `android/app/build/outputs/apk/debug/app-debug.apk` → `./"Corre Logo v{versionName}.apk"`
- Incrementar `versionCode` em 1 a cada export

**Arquivos afetados:**
- `android/app/build.gradle` — ler versionName, incrementar versionCode
- `package.json` — adicionar script `build:apk` que orquestra o pipeline completo

---

## 2. Reagendamento de Treinos (Cascata)

**Objetivo:** Dois modos de reagendamento no modal existente.

**Fluxo atual:**
- Botão "Reagendar" → modal com `<input type="date">` → `handleDateChange()` altera só aquele plano

**Fluxo novo:**
- Modal com duas opções:
  - **"Reagendar apenas este"** — move só o treino selecionado (comportamento atual, inalterado)
  - **"Reagendar este e seguintes"** — calcula delta `novaData - dataAntiga` e aplica o mesmo offset para todos os planos do **mesmo programa** (`generatedFromProgramId`) com `scheduledDate >= dataAntiga`
- Planos avulsos (sem `generatedFromProgramId` ou com programa diferente) não são afetados

**Detalhes:**
- O modal ganha um segundo botão de ação, ambos visíveis
- `handleDateChange` refatorado para:
  - Aceitar parâmetro `mode: 'single' | 'cascade'`
  - Em `cascade`: filtrar `plans` por `p.generatedFromProgramId === targetPlan.generatedFromProgramId && p.scheduledDate >= targetDate` e aplicar offset a cada um
  - Disparar `updatePlansState` uma vez com o array completo modificado

**Arquivos afetados:**
- `src/App.tsx` — modal de reagendamento, `handleDateChange`

---

## 3. Áudio Ducking — Restauro Confiável do Volume

**Problema:** Música reduz para ~20% durante TTS, mas nem sempre retorna a 100% após `abandonFocus()`. Quando retorna, leva até 10s.

**Causa raiz suspeita:** `setWillPauseWhenDucked(false)` instrui o sistema a não gerenciar o restauro do volume. O app depende exclusivamente do timer `setTimeout` para chamar `abandonFocus()`, mas o Android nem sempre propaga essa chamada corretamente.

**Solução:**
- Manter `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` (reduz volume, não pausa)
- Mudar `setWillPauseWhenDucked(false)` → `**true**` — o sistema assume a responsabilidade de restaurar o volume no `abandonFocus()`
- Reduzir timer de `max(2000, text.length * 90)` para `**max(500, text.length * 60)**` — volume volta mais rápido após TTS curto

**Arquivos afetados:**
- `android/app/src/main/java/com/correlogo/app/AudioFocusPlugin.kt` — `setWillPauseWhenDucked(true)`
- `src/lib/capacitor/voice.ts` — reduzir timer

---

## 4. Loading — Tela Limpa com Logo + Spinner

**Problema:** Dois skeletons idênticos com retângulos `animate-pulse` pulsando parecem "fantasmas" e não comunicam claramente que o app está carregando.

**Solução:**
- Substituir ambos os skeletons (auth check e data load) por uma tela centralizada com:
  - Logo da seta-rastro (SVG inline, já criado) em tamanho grande (~w-16 h-16)
  - Texto "Corre Logo" logo abaixo
  - Um spinner circular animado (SVG animado ou componente CSS)
  - Cor de fundo `bg-bg-deep`
- Mesma tela para ambos os estados — distinção desnecessária para o usuário

**Arquivos afetados:**
- `src/App.tsx` — substituir os dois blocos de skeleton

---

## 5. Foto do Perfil Google — CSP no Capacitor WebView

**Problema:** `user.photoURL` (`https://lh3.googleusercontent.com/...`) não carrega intermitentemente no APK. O server.ts já permite o domínio no CSP, mas o Capacitor WebView em `file://` não aplica esse CSP — falta a meta tag no HTML.

**Solução:**
- Adicionar `<meta http-equiv="Content-Security-Policy">` no `<head>` do `index.html` com:
  - `img-src 'self' data: https://lh3.googleusercontent.com`
  - `default-src 'self'`

**Arquivos afetados:**
- `index.html` — adicionar CSP meta tag

---

## Prioridade de Implementação

1. **Loading (4)** — mais visível, impacto imediato na primeira impressão
2. **Foto perfil (5)** — simples, bug visual óbvio
3. **APK export (1)** — facilita ciclo de desenvolvimento
4. **Reagendamento (2)** — funcionalidade nova, maior complexidade
5. **Áudio ducking (3)** — requer rebuild + instalação para testar
