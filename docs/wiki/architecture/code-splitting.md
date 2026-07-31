# Architecture — Code Splitting & Lazy Loading

## Visão Geral

Componentes pesados (recharts + leaflet ≈ 700 KB) são lazy-loadados com `React.lazy()` + `<Suspense>` para reduzir bundle inicial.

---

## Componentes Lazy-Loaded

| Componente | Arquivo | Bundle Size | Biblioteca |
|-----------|---------|-------------|------------|
| `SessionSummary` | `SessionSummary.tsx` | ~500 KB | recharts (gráficos), ShareCard utils |
| `MapComponent` | `MapComponent.tsx` | ~200 KB | leaflet, leaflet-routing-machine |

## Padrão

```typescript
// src/App.tsx
const SessionSummary = React.lazy(() => import('./components/SessionSummary'));
const MapComponent = React.lazy(() => import('./components/MapComponent'));
```

```tsx
<Suspense fallback={
  <div className="animate-pulse bg-bg-elevated h-64 rounded-lg" />
}>
  {showSummary && <SessionSummary ... />}
</Suspense>
```

### Critério de Desempate

- Lazy-load apenas componentes que (a) dependem de bibliotecas pesadas E (b) não são críticos para o paint inicial
- `React.lazy` + `Suspense` em vez de `React.Lazy` + `ErrorBoundary` (sem necessidade de error boundary específico)
- Fallback: `animate-pulse` skeleton ou texto "Carregando…"

## Locais

- `src/App.tsx` — `const SessionSummary = React.lazy(...)` e `<Suspense>` wrapping as chamadas
- `src/components/SessionSummary.tsx` — `const MapComponent = React.lazy(...)` (lazy aninhado)
