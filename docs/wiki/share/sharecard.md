# ShareCard — Compartilhar Atividade (Instagram Stories)

Sistema de cards 1080×1920 (Instagram Stories) gerados no cliente, capturados como PNG via `dom-to-image-more` e compartilhados via native share sheet ou Instagram Stories intent.

---

## Visão Geral

| Componente | Responsabilidade |
|------------|------------------|
| `ShareCard.tsx` | 4 variantes de card (React, 1080×1920 fixo) |
| `shareCard.ts` | `captureCard()` (PNG 2× DPI) + `shareImage()` (native/Insta) |
| `SessionSummary.tsx` | Modal: seletor variante + stats + preview + botão share |

---

## Variantes (CardVariant)

```typescript
type CardVariant = 'a' | 'b' | 'c' | 'd';
```

| ID | Nome | Uso | Fundo | Stats |
|----|------|-----|-------|-------|
| `a` | **Gradiente** | Compartilhamento direto | Gradiente purple→pink→orange | Grandes, centralizados (`text-7xl`) |
| `b` | **Vidro** | Compartilhamento direto | Radial escuro + painel glassmorphism | Médios (`text-6xl`) |
| `c` | **Mapa** | Outdoor com rota | Grid + gradiente + **SVG rota atrás do overlay** | Bottom sheet (`text-5xl`) |
| `d` | **Foto** | Overlay em foto da galeria | Transparente + `bg-black/30` vignette | **Maiores** (`text-8xl`), drop-shadow |

> **Variant D ("Foto")**: sem fundo próprio — feita para o usuário abrir no Instagram Stories, escolher uma foto da galeria e colar o card por cima. Texto gigante + drop-shadow garante legibilidade sobre qualquer foto.

---

## Stats Selecionáveis

O usuário marca/desmarca antes de gerar:

| Key | Label | Padrão |
|-----|-------|--------|
| `distance` | Distância | ✅ |
| `duration` | Duração | ✅ |
| `pace` | Pace | ✅ |
| `speed` | Velocidade | ❌ |
| `date` | Data | ✅ |
| `mode` | Tipo (Esteira/Rua) | ✅ |
| `name` | Nome do treino | ✅ |
| `logo` | Logo "CORRE LOGO" | ✅ |

---

## Pipeline de Captura

```
User clica "Compartilhar"
        │
        ▼
Modal abre → User escolhe variante + stats
        │
        ▼
Hidden element (fixed, left: -9999px) renderiza <ShareCard variant={...} />
        │
        ▼
captureCard(ref) → dom-to-image-more.toBlob()
  - width: 1080*2, height: 1920*2  (2× DPI)
  - style: { width: '1080px', height: '1920px', transform: 'scale(2)', transformOrigin: '0 0' }
  - quality: 1.0
        │
        ▼
Blob PNG (2160×3840 → downscale implícito no share)
        │
        ▼
shareImage(blob, target)
  - target: 'native' | 'instagram-stories'
  - Native: Filesystem.writeFile(Cache) → Capacitor Share.share({ files: [uri] })
  - Instagram Stories: mesmo fluxo, dialogTitle "Compartilhar no Instagram Stories"
  - Web: navigator.share() ou download <a>
```

---

## Qualidade de Imagem (2× DPI)

`dom-to-image-more` renderiza em **2160×3840** internamente (scale=2), depois o browser downscaleia para 1080×1920 no blob PNG. Resultado: texto nítido, sem serrilhados, mesmo em telas retina.

```typescript
// shareCard.ts
export async function captureCard(element: HTMLElement): Promise<Blob> {
  const scale = 2;
  return domtoimage.toBlob(element, {
    width: 1080 * scale,
    height: 1920 * scale,
    style: {
      width: '1080px',
      height: '1920px',
      transform: `scale(${scale})`,
      transformOrigin: '0 0',
    },
    cacheBust: true,
    quality: 1.0,
  });
}
```

---

## Instagram Stories Sharing

No Android nativo, `shareImage(blob, 'instagram-stories')` usa o mesmo `Capacitor Share.share()` mas com `dialogTitle: "Compartilhar no Instagram Stories"`. O Android mostra o seletor de apps; se o Instagram estiver instalado, a opção "Instagram Stories" aparece e abre direto no editor de Stories com a imagem pré-carregada.

> **Nota**: Não há intent direto "abrir Instagram Stories" via Capacitor Share — o Share sheet do Android lista o Instagram se ele declarar suporte a `ACTION_SEND` com `image/*`. O título customizado só orienta o usuário.

No web: tenta `navigator.share({ files: [file] })`; fallback = download.

---

## Z-Index Fix (Variant C — Mapa)

Problema: SVG da rota (`RouteSVG`) renderizava por cima dos stats.

Solução: camadas explícitas no JSX:

```tsx
// Variant C (Mapa)
<div className="relative ...">
  {/* 1. Grid lines */}
  <svg className="absolute inset-0 opacity-[0.04]" ... />
  
  {/* 2. Route SVG — z-index 0 (implícito) */}
  <RouteSVG session={session} style={{ zIndex: 0 }} />
  
  {/* 3. Gradient overlay — cobre a rota */}
  <div className="absolute inset-0" style={{
    background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)'
  }} />
  
  {/* 4. Stats container — z-10 (por cima do overlay) */}
  <div className="absolute bottom-0 left-0 right-0 ... z-10">
    {statLines.map(...)}
  </div>
</div>
```

---

## Integração no SessionSummary

```tsx
// SessionSummary.tsx
const [cardVariant, setCardVariant] = useState<CardVariant>('a');
const [showStats, setShowStats] = useState({ distance: true, duration: true, ... });
const [shareTarget, setShareTarget] = useState<'native' | 'instagram-stories'>('native');
const cardCaptureRef = useRef<HTMLDivElement>(null);

// Hidden full-size para capture
<div ref={cardCaptureRef} style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
  <ShareCard data={extractCardData(session)} variant={cardVariant} showStats={showStats} session={session} />
</div>

// Preview escalado (200px width)
<div className="w-[200px]" style={{ aspectRatio: '9/16' }}>
  <div style={{ transform: `scale(${200 / 1080})`, transformOrigin: 'top left' }}>
    <ShareCard data={...} variant={cardVariant} showStats={showStats} session={session} />
  </div>
</div>

// Botão share
<button onClick={async () => {
  const blob = await captureCard(cardCaptureRef.current!);
  await shareImage(blob, 'corre-logo-card.png', shareTarget);
}}>
  <Share2 /> Compartilhar
</button>

// Seletor de alvo
<div className="flex gap-2">
  {SHARE_TARGETS.map(t => (
    <button key={t.id} onClick={() => setShareTarget(t.id)} className={...}>
      {t.id === 'native' ? <Share2 /> : <Instagram />}
      {t.label}
    </button>
  ))}
</div>
```

---

## Dependências

| Package | Versão | Uso |
|---------|--------|-----|
| `dom-to-image-more` | ^3.10.2 | Capture DOM → PNG blob |
| `@capacitor/share` | ^7.0.4 | Native share sheet (Android/iOS) |
| `@capacitor/filesystem` | ^7.0.0 | Save blob to cache before share |

---

## Build & Deploy

- Web build: `npm run build` ✅
- Android: `npx cap sync android` → `gradlew assembleRelease` (CI)
- CI workflow: `.github/workflows/firebase-deploy.yml` roda `npm run build` → `npx cap sync android` → `assembleRelease` → upload APK + `update-manifest.json` to GitHub Release `latest`

---

## Test Checklist

| Cenário | Esperado |
|---------|----------|
| Variant A + share nativo | Card gradiente abre no share sheet Android |
| Variant B + share nativo | Card glassmorphism abre no share sheet |
| Variant C (outdoor) + share | Mapa com rota por baixo, stats legíveis no bottom |
| Variant D + Instagram Stories | Abre Instagram Stories com card transparente pronto pra foto |
| Variant D + share nativo | Card transparente salvo na galeria / enviado por WhatsApp etc. |
| Stats desmarcados | Não aparecem no card nem no preview |
| Preview no modal | Escala 200/1080, aspect-ratio 9:16 mantido |

---

*Última atualização: 2026-07-30*