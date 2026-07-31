# Persistência de Blocos e Correções TTS

## 1. Persistir Estrutura de Blocos no Firestore

### Problema
`WorkoutEditor` usa blocos (UI com `repeat: N`) para agrupar steps, mas `expandBlocks()` achata tudo em `WorkoutStep[]` antes de salvar. Ao re-editar um plano, a estrutura de blocos é perdida — todos os steps aparecem num bloco único.

### Solução
Adicionar campo opcional `blocks` ao `WorkoutPlan`:

```typescript
// types.ts
export interface StepBlock {
  repeat: number;
  steps: WorkoutStep[];
}

// WorkoutPlan — novo campo
blocks?: StepBlock[];
```

**Save flow:**
```
WorkoutEditor.handleSave
  → onSave({ id, name, steps: expandBlocks(), blocks, manual: true })
  → Firestore doc: { id, name, steps: [...], blocks: [...], manual: true }
```

**Load flow (edit):**
```
WorkoutEditor receives initialPlan
  → if initialPlan.blocks → use them directly
  → else → create [ { repeat: 1, steps: initialPlan.steps } ]
```

**Backward compatibility:** Planos antigos sem `blocks` são convertidos para 1 bloco único no editor. Nenhuma migração necessária.

### Impacto no Firestore
- Documento `users/{uid}/data/plans` existente ganha campo `blocks` em planos salvos pelo novo editor
- `stripUndefined` já remove `undefined` automaticamente — planos sem `blocks` não serão afetados
- Tamanho do documento: blocks adiciona ~20-50 bytes por step (só `repeat` + referência ao step original)

---

## 2. TTS — Unidade de Duração

### Problema
`formatDurationTts(15)` retorna `"0:15 minutos"`. SpeechSynthesis lê o `:` como separador de hora, resultando em "0 hora e 15 minutos".

### Solução
Substituir `formatDurationTts` por `formatDurationSpeech` (já existe como dead code em `WorkoutTracker.tsx:254`).

Comportamento:
| Input | Output | Lido como |
|-------|--------|-----------|
| 15s   | "15 segundos" | "15 segundos" |
| 120s  | "2 minutos" | "2 minutos" |
| 150s  | "2 minutos e 30 segundos" | "2 minutos e 30 segundos" |

Remover `formatDurationTts` (morto).

**Arquivos afetados:** `WorkoutTracker.tsx` — linhas 289 e 312.

---

## 3. TTS — Pace vs km/h na Esteira

### Problema
Na esteira, o TTS lê "Pace 12" quando deveria ler a velocidade em km/h (unidade que o usuário ajusta no painel da esteira).

### Solução
Nas duas chamadas TTS (step change + "almost there"), condicionar por `mode`:

```
if mode === 'outdoor':
  → " Pace {targetPace}" (min/km, ex: "Pace 5")

if mode === 'treadmill':
  → " a {speed} quilômetros por hora"
  onde speed = Math.round((60 / targetPace) * 10) / 10  (1 casa decimal)
```

**Conversão:** `speedKmh = 60 / targetPace`. Exemplos:
- Pace 12 (caminhada 5 km/h) → "a 5,0 quilômetros por hora"
- Pace 5 (corrida 12 km/h) → "a 12,0 quilômetros por hora"

**1 casa decimal** porque a maioria das esteiras tem incrementos mínimos de 0,1 km/h.

**Arquivos afetados:** `WorkoutTracker.tsx` — linhas 289, 313, e remoção da `speedKmh` não utilizada na linha 286 (ou reuso).

---

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `src/types.ts` | Nova interface `StepBlock`, campo `blocks?` em `WorkoutPlan` |
| `src/components/WorkoutEditor.tsx` | Salvar `blocks` (não expandido) no `handleSave` |
| `src/components/WorkoutTracker.tsx` | `formatDurationSpeech` → substitui `formatDurationTts`; TTS condicional por `mode` com km/h |
