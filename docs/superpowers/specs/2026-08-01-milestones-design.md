# Milestones / Conquistas + Tab Bar — Design

## Objetivo

Adicionar **recordes pessoais (PRs) por distância** e **badges de conquista**, exibir o resultado no resumo da sessão e numa nova aba **Conquistas**, com link para a atividade de cada conquista. Em paralelo, migrar a navegação para uma **tab bar inferior** de 4 abas (Treinos / Registros / Conquistas / Perfil), tirando dark mode, histórico e perfil do header.

## Decisões aprovadas (mocks `brain-20260801-111031`)

- **Emenda 2026-08-01**: **Fix do clip do traçado no ShareCard** (RouteSVG normaliza com **pad interno de 10**, `x = 10 + ((lon-minLon)/w)*80`, `y = 10 + ((maxLat-lat)/h)*80`, `viewBox="0 0 100 100"` mantido — o traçado não toca mais as bordas) e **timeout BLE 15s** (`TreadmillBleService.kt` `delay(10000)`→`delay(15000)`; `use-treadmill.ts` `setTimeout 11000`→`16000`) **entram nesta build** (decidido pelo usuário).

- **PR = tempo ao cruzar a distância via interpolação** nos `points` (estilo Strava). Distâncias: **1, 2, 3, 4, 5, 10, 15, 21, 30, 35, 42 km**. **Ranking único** esteira + rua.
- **Badges** (IDs + rótulos PT-BR), agrupadas em 4 grupos:
  - **Corridas**: `firstRun` "1ª corrida"; `complete5k/10k/21k/42k` "Completei 5/10/21/42 km".
  - **Distância** (evolutiva, "maior distância até hoje"): `longest5/10/21/42` "Maior distância · 5/10/21/42 km".
  - **Volume**: `volume10/50/100/500/1000` "Acumulei 10/50/100/500/1000 km".
  - **Ritmo**: `pace8/7/6/5` "Ritmo ≤ 8:00 / 7:00 / 6:00 / 5:00".
- **Semântica** (decisão do usuário, 2026-08-01):
  - **Valores recomputam em delete**: `prs` por distância e `longestDistance` (cair para o próximo melhor).
  - **Badges são permanentes** (conquista ganha não sai). `totalVolumeKm` é **contador monotônico** (acumula, nunca desconta) — coerente com badges de volume permanentes.
  - **Link para a atividade**: tocar num recorde/badge abre o `SessionSummary` da sessão (`sessionId`). Se a sessão não existir mais (apagada / fora da janela de 50): toast `showFeedback('error', 'Atividade não encontrada')` e linha sem chevron.
- **Tab bar inferior** 4 abas com ícone + rótulo: **Treinos** (ícone corredor Tabler `run`, aprovado), **Registros**, **Conquistas**, **Perfil**. Header fica só o logo. Dark mode vira linha **"Tema"** no Perfil. Aba ativa usa `var(--color-accent)` (o rosa do app — o roxo `#7c3aed` dos mocks era placeholder).
- **Layout Conquistas (C)**: card de destaques no topo (recordes · badges · km totais) + lista RECORDES + grade de BADGES. Clique em recorde/badge → resumo da atividade.
- **Celebração no resumo**: bloco "Novos recordes" (🏆) + "Conquistas desbloqueadas" (🎖️) após a grade 2×2 de stats, só quando há novidade.
- **ShareCard**: pill âmbar discreta no topo só quando há PR novo (`Novo recorde: 5 km · 26:10` [+N]). Badges **não** vão no card.

## Arquitetura

```
┌────────────────────────────────────────────┐
│  UI Layer                                  │
│  App.tsx          — activeTab, tab bar,    │
│                     back, wiring           │
│  TabBar.tsx       — 4 abas (ícone Tabler)  │
│  Achievements.tsx — aba Conquistas (C)     │
│  SessionSummary   — bloco de celebração    │
│  ShareCard        — pill de recorde        │
│  UserProfile      — vira aba (linha Tema)  │
│  SessionHistory   — vira aba Registros     │
├────────────────────────────────────────────┤
│  Libs (puras, testáveis)                   │
│  records.ts       — core: crossing time,   │
│                     applySessionToRecords, │
│                     recomputeRecords,      │
│                     backfill, persist      │
└────────────────────────────────────────────┘
```

Persistência: doc Firestore `users/{uid}/data/records` (padrão `data/plans`, coberto pelo `firestore.rules` existente) + espelho localStorage `correlogo:records:{uid}`.

## Camada de dados — `src/lib/records.ts`

```ts
export const PR_DISTANCES = [1, 2, 3, 4, 5, 10, 15, 21, 30, 35, 42];

interface PrRecord { timeSeconds: number; sessionId: string; date: string; mode: 'treadmill' | 'outdoor' }
interface BadgeRecord { unlockedAt: string; sessionId: string }
interface PrResult { distKm: number; timeSeconds: number }
interface BadgeResult { id: string; label: string }

export interface Records {
  prs: Record<string, PrRecord>;                          // key = distância (ex: "5")
  longestDistance: { km: number; timeSeconds: number; sessionId: string; date: string; mode: 'treadmill'|'outdoor' } | null;
  totalVolumeKm: number;                                  // monotônico
  badges: Record<string, BadgeRecord>;                    // só cresce
  backfilled: boolean;
}
```

### `computeCrossingTime(points, distKm): number | null`
Primeiro índice `i` com `points[i].distanceKm >= distKm`; se `i === 0` → `points[0].timestampSeconds`; senão interpolação linear entre `i-1` e `i` em `timestampSeconds`. `timestampSeconds` só avança com o app correndo (pausas congelam) → tempo de movimento, correto para PR. `null` se `points.length < 2` ou distância nunca atingida.

### `applySessionToRecords(session, records): { records, newPrs, newBadges }`
Mutação em clone. Ordem:
1. **PRs** — para cada `D` em `PR_DISTANCES`: crossing = `computeCrossingTime`; se `null` e `session.totalDistanceKm >= D`, fallback **estimativa** `totalDurationSeconds * (D / totalDistanceKm)`. Atualiza `prs[D]` **só se** não existir ou `crossing < existing.timeSeconds`; quando atualiza, empurra `newPrs` (com a data da sessão).
2. **longestDistance** — se `session.totalDistanceKm` > atual, substitui (km, timeSeconds = duração total, sessionId, date, mode).
3. **totalVolumeKm** += `session.totalDistanceKm`.
4. **Badges** — desbloqueia (com `unlockedAt = session.date`, `sessionId`):
   - `firstRun` se ausente;
   - `complete{t}k` se `totalDistanceKm >= t` (t ∈ 5,10,21,42);
   - `longest{t}` se novo longest `km >= t`;
   - `volume{t}` se novo `totalVolumeKm >= t` (t ∈ 10,50,100,500,1000);
   - `pace{p}` se `avgPace = totalDurationSeconds / totalDistanceKm` (só se distância > 0) `<= p*60` (p ∈ 8,7,6,5).
   Cada desbloqueio novo entra em `newBadges` com rótulo PT-BR (`BADGE_LABELS`).

### `recomputeRecords(sessions, records): Records`
Usado **no delete** (nunca no completar). Recalcula do zero `prs` e `longestDistance` a partir das `sessions` restantes (varre todas em ordem cronológica, aplica só a lógica de PR/longest). **Não toca** em `badges` nem em `totalVolumeKm`. Mantém `backfilled`.

### `emptyRecords()` / persistência
- `readRecords(uid): Promise<Records | null>` — localStorage primeiro (instantâneo); senão `getDoc` em `users/{uid}/data/records`; `null` se ambos ausentes.
- `saveRecords(uid, records)` — `localStorage.setItem` + `setDoc(doc(db,'users',uid,'data','records'), records)` (sem merge; doc é nosso por inteiro; last-write-wins entre devices).

### Backfill (1ª execução)
Se `readRecords(uid)` retorna `null`: varre **todas** as sessões do localStorage + até 50 do Firestore em **ordem cronológica**, aplica `applySessionToRecords` para cada, seta `backfilled = true`, persiste. **Limitação conhecida (aceita)**: sessões de outros devices fora da janela de 50 não entram — ok, usuário tem poucos registros.

## Fluxos

### Completar sessão (`App.tsx:684 markAsCompleted`)
Após criar `newSession` (linha 722): `const { records, newPrs, newBadges } = applySessionToRecords(newSession, await readRecords(uid) ?? emptyRecords())`; `await saveRecords(uid, records)`. **Anexar `prResults = { newPrs, newBadges }` apenas ao `selectedSession` em memória** (`setSelectedSession({ ...newSession, prResults })`) — **não** persistir `prResults` no objeto de sessão.

> Decisão (importante): `prResults` é **transitório** (só na sessão recém-completada). Reabrir a atividade do histórico não mostra celebração nem pill no ShareCard — evita "Novo recorde" obsoleto em card antigo. Nada de prop drilling: o summary e o ShareCard leem `session.prResults`.

### Deletar sessão (2 caminhos: `uncompletePlan` App.tsx:661 e `onDeleteSession` em SessionHistory/aba Registros)
Após remover a sessão de estado + Firestore: `const records = await readRecords(uid)`; `const updated = recomputeRecords(sessionsRestantes, records)`; `await saveRecords(uid, updated)`.

## UI

### Tab bar (`TabBar.tsx` novo)
- 4 abas: **Treinos** (ícone corredor Tabler `run` embutido como SVG inline — **não** existe no lucide-react), **Registros** (lucide `list`), **Conquistas** (lucide `trophy`), **Perfil** (lucide `user`).
- Ícone 18px stroke 1.75, rótulo 8px; ativa = `var(--color-accent)`; barra `border-top` fina, fundo elevado.
- **Escondida** quando: `activePlan` (treino rodando), `selectedSession` (resumo/share modal), `showGenerator`/`programToReview`/`showGoogleCalendarModal`/etc (transientes de tela cheia).

### `App.tsx`
- Novo estado `activeTab: 'treinos' | 'registros' | 'conquistas' | 'perfil'` (default `'treinos'`). Remover `showHistory`/`showUserProfile` (viram tabs). Header (1239-1269): **só o logo** (remover dark mode, BarChart2, avatar).
- Renderização por aba: treinos = conteúdo atual da home (saudação, calendário, CTA, planos); registros = `SessionHistory` como tab; conquistas = `<Achievements>`; perfil = `UserProfile` como tab.
- **Back handler (135-141)**: se `activeTab !== 'treinos'` → volta para `'treinos'`; senão comportamento atual. Remover ações de `showHistory`/`showUserProfile`.
- `markAsCompleted` + deleções: hooks de `records` descritos acima.

### `SessionHistory.tsx` → aba Registros
Remover invólucro de modal (`fixed inset-0 z-50`, `role="dialog"`, `aria-modal`, botão "Voltar", cabeçalho "Histórico de Treinos" → "Registros"). Conteúdo da lista intacto; `onSelectSession` → `setSelectedSession` (aba continua ativa, tab bar some por causa do `selectedSession`).

### `UserProfile.tsx` → aba Perfil
Remover invólucro de modal. Adicionar seção **Preferências → linha "Tema"** com switch Escuro/Claro ligado ao `toggleDarkMode` (mover lógica de App.tsx:572; `document.documentElement.classList.toggle('light', isLight)` + persistência `correlogo:darkMode:{uid}`). Manter demais seções (conexões, atualização, salvar, sair).

### `Achievements.tsx` (novo) — aba Conquistas, layout C
Props: `{ records, sessions, onOpenSession(sessionId) }`.
- Card de destaques: n. recordes (`Object.keys(prs).length`), n. badges (`Object.keys(badges).length`), km totais (`totalVolumeKm`).
- **RECORDES**: 11 linhas (`PR_DISTANCES`); cada uma: rótulo (`5 km`), melhor tempo (`formatDuration`), data; `—` se não há. Modo (`Esteira`/`Rua`) em texto secundário. Linhas com recorde são tocáveis (chevron ›) → `onOpenSession(sessionId)`; sem registro → não tocável.
- **BADGES**: grade agrupada (Corridas / Distância / Volume / Ritmo). Desbloqueada: ícone colorido + rótulo + data; tocável → `onOpenSession`. Bloqueada: cinza + cadeado, sem ação.
- Toque resolve o `sessionId` no estado de sessões; se não achar → `showFeedback('error', 'Atividade não encontrada')`.

### `SessionSummary.tsx` — bloco de celebração
Após a grade 2×2 (linha 155), antes do "Desempenho vs Plano": se `session.prResults` com novidade, renderizar card `p-4 rounded-xl mb-6 bg-bg-surface`:
- "Novos recordes" (lucide `Trophy`, âmbar): uma linha por PR — `5 km` + `26:10` + data.
- "Conquistas desbloqueadas" (lucide `Medal`): chips âmbar com rótulos PT-BR.

### `ShareCard.tsx` — pill de recorde
Se `session.prResults?.newPrs.length > 0`: pill âmbar (`bg #241b0e`, borda `#7a5610`, texto `#f5b942`) centrada no topo do card (acima do título): `★ Novo recorde: 5 km · 26:10` e, se houver mais de um, ` · +N`. Posicionada em `position:absolute; top:~200px`, zIndex acima dos blobs.

## Testes

`src/lib/__tests__/records.test.ts` (vitest, puras — baseline atual 55/55, lint 21 pré-existentes, 0 novos):
- `computeCrossingTime`: interpolação exata entre 2 pontos conhecidos; `i===0`; `null` quando distância não atingida; `null` com `< 2` points.
- `applySessionToRecords`: PR novo vs PR pior (não sobrescreve) vs PR melhor (substitui e gera `newPrs`); fallback estimativa sem points; sessão < distância → sem PR; cada badge (firstRun 1×; complete com `>=`; longest evolutiva; volume por thresholds; pace ≤ 8/7/6/5 com `avgPace`); `newBadges` só nos desbloqueios.
- `recomputeRecords`: delete do melhor → PR cai pro próximo; `longestDistance` recua; `badges` e `totalVolumeKm` **intactos**.
- Backfill: ordenação cronológica.
- UI: `Achievements` renderiza destaques/recordes/badges; celebração no summary só com `prResults`; pill do ShareCard só com PR novo.

## Arquivos

**Novos**: `src/lib/records.ts`, `src/lib/__tests__/records.test.ts`, `src/components/TabBar.tsx`, `src/components/Achievements.tsx`.
**Modificados**: `src/App.tsx` (activeTab, header, back, hooks records), `src/components/SessionSummary.tsx` (celebração), `src/components/ShareCard.tsx` (pill), `src/components/UserProfile.tsx` (aba + Tema), `src/components/SessionHistory.tsx` (aba).

## Fora de escopo (não fazer agora)

- Figurinha Stories, Health Connect permission intent, alinhamento de deps Capacitor (TODO.md — outras frentes).
