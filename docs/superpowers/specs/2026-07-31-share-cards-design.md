# Share Cards / Adesivos — Design

## Objetivo
Substituir a tela de compartilhamento atual (variantes `a/b/c/d` + modal em `SessionSummary.tsx`) por uma nova tela de **Cartões e Adesivos** com 4 cards de proporções aprovadas via mock, edição inline, compartilhamento (Story/WhatsApp/Mais) e **salvar na Galeria**.

## Decisões aprovadas (mock `mockups/share-cards.html`)

- **Canvas**: 1080×1920. **Área útil do story**: y 350–1650 (margens 350 topo / 270 base).
- **4 cards**:
  - **Card 1 — Stats + Pace**: título + logo, traçado, blocos de pace (por km até 5 km; **agrupados por 5 km** em corridas longas), grid 2×3 stats com colunas **esquerda/centro/direita** (títulos 32px, 1.5× do original).
  - **Card 2 — Stats à esquerda**: traçado grande + coluna de 3 stats à esquerda.
  - **Card 3 — Stats embaixo**: traçado grande + row de 3 stats na base.
  - **Card 4 — Mapa real**: mapa quadrado **816×816** (−15%) com tiles **CARTO `dark_all`**, traçado por cima e row de stats na base. Ordem de camadas: **fundo < mapa < logo**.
- **Logo uniforme** (todos os cards): swoosh `#FF006E` (o mesmo da Load screen, `src/App.tsx:958`) + CORRE + LOGO — as **três linhas com a mesma largura total** (60px; CORRE 15px/0.16em, LOGO 16px/0.30em, fluxo de bloco, sem flex/aspect-ratio).
- **Gradiente**: 6 presets — (a) rosa/roxo, (b) azul oceano, (c) verde lima, (d) fogo, (e) neon escuro, (f) minimal preto/branco.
- **Foto de fundo**: substitui o gradiente nos cards 1–3 via `@capacitor/camera` (Photo Picker). Card 4 (mapa) não aceita foto.
- **Stats selecionáveis por card** (chips): Distância, Pace, Tempo, Velocidade, Data, Modo, Logo, Nome — refluem nos slots do layout ao desligar.
- **Aba Cartões** (default): carrossel horizontal + bolinhas; CTA "Toque no cartão para editar"; **painel de edição inline colapsável** abaixo do preview; botões **Story · WhatsApp · Mais** (linha 1) e **Salvar no dispositivo** (linha 2) → **Galeria**.
- **Aba Adesivos**: seleção de info + toggle de mapa; **Salvar** = PNG **transparente**; **Copiar**.
- O **bloco de pace** do card 1 é opcional (desligável como as demais stats).

## Arquitetura (em camadas)

```
┌──────────────────────────────────────────────────────┐
│  UI Layer                                            │
│  ShareScreen.tsx (substitui modal em SessionSummary) │
│  ├─ Aba Cartões: Carousel + EditPanel + ShareActions │
│  ├─ Aba Adesivos: StickerEditor                       │
│  ├─ ShareCard.tsx (4 variantes novas)                │
│  └─ CardMap.tsx (mapa do card 4)                     │
├──────────────────────────────────────────────────────┤
│  Libs (puras, testáveis)                             │
│  splits.ts      — pace por km / bloco de 5km         │
│  gradients.ts   — GRADIENT_PRESETS (6)               │
│  card-map.ts    — projeção Web Mercator + tiles      │
│  shareCard.ts   — captura, story, copiar (evoluído)  │
├──────────────────────────────────────────────────────┤
│  Native (SocialSharePlugin.kt)                       │
│  saveToGallery  — MediaStore + MediaScannerConnection │
│  shareToWhatsApp— intent package com.whatsapp        │
│  (mantidos) shareToInstagram · copyImageToClipboard   │
└──────────────────────────────────────────────────────┘
```

## Camada 1: `src/lib/splits.ts`

Funções puras para derivar blocos de pace de `session.points` (usa `ActivityPoint.distanceKm`, cumulativa — funciona em esteira, sem lat/lon).

- **`pacePerKm(points: ActivityPoint[], maxBlocks = 10): PaceBlock[]`** — Bucketiza por km inteiro de `distanceKm`. Para cada km: pace médio (segundos/km) dos pontos da faixa. `PaceBlock = { label: string; paceSeconds: number | null }`.
- **`pacePerGroup(points, groupKm = 5): PaceBlock[]`** — Agrupa os km em blocos de 5 km (corridas > 5 km): label `"1-5"`, `"6-10"`, etc.; pace = média dos km do grupo. O bloco final parcial entra como está (ex: `"21"` em maratona).
- **Regra de escolha** (UI): `totalDistanceKm <= 5` → `pacePerKm`; senão → `pacePerGroup`.
- **Fallback**: sem `points` → um único bloco com `totalDurationSeconds / totalDistanceKm` (comportamento atual).
- Barras do mock: altura ∝ pace (mais lento = mais alto, min 20%).

Testáveis sem mock — `expect(pacePerKm(fakePoints, 5)[0].paceSeconds).toBeCloseTo(...)`.

## Camada 2: `src/lib/card-map.ts`

Mapa do card 4 **sem Leaflet** (decisão de arquitetura — captura com dom-to-image de um Leaflet é frágil).

- **`computeMapView(points: {lat,lon}[], size: number, fit: number): MapView`** — Projeção Web Mercator (validada no mock e por teste numérico): `zoom` auto para caber o bbox em `fit` px, origem `(ox, oy)` centrando o traçado no box. `MapView = { zoom, ox, oy, size }`.
- **`tilesFor(view): { x, y, z, left, top }[]`** — Grid de tiles cobrindo o box (256px, `dark_all`). Sem sobreposição desnecessária.
- **`routeToSvg(points, view): string`** — `d` do polyline + coordenadas dos marcadores verde (início) / vermelho (fim), no espaço do box.
- Constante `TILE_URL = 'https://{abcd}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'`.
- **Captura**: **spike validado** (2026-07-31) — dom-to-image-more `fetch`a os tiles (CARTO envia `Access-Control-Allow-Origin: *`) e o canvas sai **not-tainted** com os tiles presentes. Nenhuma lib externa além das já usadas.

## Camada 3: `src/components/ShareCard.tsx` (variantes novas)

Estrutura por variante conforme o mock (posições absolutas 1080×1920):

- **Card 1** (`variant === 'a'`): `.logo` (60px, bloco uniforme), `.title` (esq., 720px), `.route` (SVG), `.pacebox` (título "PACE POR KM" + barras), `.stats` (grid 2×3, `text-align` por coluna via `nth-child`).
- **Card 2** (`'b'`): `.route` grande + `.statcol` (coluna esquerda, 3 stats).
- **Card 3** (`'c'`): `.route` grande + `.statrow` (base).
- **Card 4** (`'d'`): `<CardMap>` (tiles `dark_all` + traçado + marcadores) + `.statrow` (base). Logo acima do mapa (`z-index`).
- Props: `data: ShareCardData`, `variant`, `showStats`, `session`, `gradient`, `splits: PaceBlock[]`, `photoUrl?`.
- `extractCardData` mantido; adicionar `extractSplits(session)` que escolhe `pacePerKm`/`pacePerGroup`.

## Camada 4: `src/components/ShareScreen.tsx`

Substitui o modal atual (disparado por `setShowShareModal(true)` em `SessionSummary.tsx:456`).

- **Abas**: `Cartões` / `Adesivos`.
- **Aba Cartões**:
  - Carrossel horizontal (`scroll-snap`) dos 4 cards + bolinhas de navegação + CTA "Toque no cartão para editar".
  - **EditPanel inline** (colapsável, aberto ao tocar no cartão): chips toggleáveis de stats; thumbnails dos 6 presets de gradiente; botão "Foto de fundo" (`@capacitor/camera`) quando o card aceita foto.
  - **ShareActions**: `Story` → `shareToInstagramStories(blob, 'background')` (fallback share sheet); `WhatsApp` → `shareToWhatsApp` nativo (fallback sheet); `Mais` → `Share.share`; `Salvar no dispositivo` → `saveToGallery` (PNG/JPG).
  - Re-render do preview e re-captura ao editar (debounce) — evita `setState` em cascata durante montagem (AGENTS.md).
- **Aba Adesivos**:
  - Seleção de info (mesmos chips) + toggle **Mapa** (in/out).
  - `Salvar` → PNG **transparente** (card com `background: transparent`, como a variante `d` atual); `Copiar` → `copyCardToClipboard`.
- Reutiliza `captureCard` (`src/lib/shareCard.ts:29`, dom-to-image scale 2). Componentes re-inicializados com `key` (card id) por depender de `useEffect` de montagem.

## Camada 5: Native — `SocialSharePlugin.kt`

- **`saveToGallery({ data, filename, mimeType }): Promise<{ uri: string }>`** — Insere em `MediaStore.Images` (`Pictures/CorreLogo`) com `RELATIVE_PATH`, seguido de `MediaScannerConnection.scanFile`. Retorna `content://` URI.
- **`shareToWhatsApp({ imagePath }): Promise<void>`** — `Intent(ACTION_SEND)` com `setPackage("com.whatsapp")`, `EXTRA_STREAM` + `FLAG_GRANT_READ_URI_PERMISSION`. `ActivityNotFoundException` → resolve no fallback da camada UI (share sheet).
- Mantidos: `shareToInstagram` e `copyImageToClipboard`.
- Caminho permitido: `android/app/src/main/java/com/correlogo/app/` (regra 3 do AGENTS.md).

## Camada 6: Dependências

- **`@capacitor/camera@^7`** — Photo Picker (sem `READ_MEDIA_IMAGES`). Compatível com core 7.
- **Não** instalar `@capacitor/share` adicional (já existe); **não** subir `@capacitor/app`/`@capacitor/browser` para 8 (landmine do TODO).
- Pipeline ao instalar: `npm install` → `npx cap sync android` → `npm run build` → `gradlew assembleDebug` (com `JAVA_HOME` em `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`).

## Workflow

```
SessionSummary → "Compartilhar" → ShareScreen (substitui modal atual)
                                        │
                    ┌───────────────────┴──────────────────┐
                    ▼ Cartões                              ▼ Adesivos
        ┌─────────────────────────┐            ┌────────────────────────┐
        │ Carrossel (4 cards)     │            │ Chips de info          │
        │ Toque → EditPanel inline│            │ Toggle Mapa            │
        │  • chips de stats       │            └───────────┬────────────┘
        │  • presets gradiente    │                        ▼
        │  • foto (cards 1–3)     │              [Salvar PNG transparente]
        └───────────┬─────────────┘              [Copiar]
                    ▼
        Story · WhatsApp · Mais · Salvar na Galeria
        (WhatsApp ausente → share sheet)
```

## Testes

- **Vitest** (`splits.ts`): bucketing por km; agrupamento 5 km; esteira (sem lat/lon); fallback sem points; bloco final parcial.
- **Vitest** (`card-map.ts`): projeção (pontos dentro do box, invariantes de Web Mercator); grid de tiles cobre o box sem falhas (coords ≥ 0, z ≥ 0).
- **Spike documentado**: CORS dos tiles na captura (validado; registrar no CHANGELOG).
- **Build**: `Copy-Item .env.apk .env -Force` → `npm run build` && `npx cap sync android` && `gradlew assembleDebug`. `npm test` verde.

## Considerações

- **Captura com tiles**: `cacheBust: true` já ativo em `captureCard`. Se a captura do card 4 falhar (rede/tile), **fallback**: capturar o card sem tiles (fundo `#15151f` + traçado) — nunca bloquear o compartilhamento.
- **Instagram**: story usa `shareToInstagramStories` já existente; a área útil (y 350–1650) garante que UI do IG não cubra o conteúdo.
- **Pace de longas**: `pacePerGroup` evita 42 barras; a UI esconde o bloco de pace se `showStats.pace === false`.
- **Performance**: pré-capturar o card visível do carrossel (avoid capturar todos ao abrir); captura é async e roda com loader.
- **AGENTS.md**: usar `Button`/`Modal`/`showFeedback`; estado sem `setState` em cascata; `crypto.randomUUID()` (sem `uuid`); Firestore não é tocado por esta feature.
