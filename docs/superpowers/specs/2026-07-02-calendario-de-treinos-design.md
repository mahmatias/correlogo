# Calendário de Treinos — Design

**Data:** 2026-07-02
**Status:** Aprovado

## Objetivo

Substituir a página inicial atual (lista de botões + planos) por um layout centrado no calendário semanal, com saudação personalizada, bottom sheet de ações e lista de treinos vinculada ao dia selecionado.

## Layout

```
[Title]  [Dark Mode] [History] [Avatar]
Olá, [Primeiro] [Segundo Nome]
[  Seg  Ter  Qua  Qui  Sex  Sáb  Dom  ]  ← semana horizontal (largura total, padding 1rem)
[ 29   30   01   02   03   04   05    ]  ← dia selecionado destacado
  ● programado  ● realizado
[ Planos ▲ ]  [02/07 — 3 treinos ]
TREINOS DE 02/07/2026
[ ┌─○ Corrida Leve 5km ─── 30min ─┐ ]  ← pendente (círculo vazio)
[ │ ▶ Iniciar  📊  🗑              │ ]
[ └────────────────────────────────┘ ]
[ ┌─✓ Intervalado 400m ─ Concluído ┐ ]  ← concluído (check verde, opaco)
[ └────────────────────────────────┘ ]
[ ┌─○ Longão 10km ─────── 60min ─┐ ]  ← expandido (mostra steps)
[ │ Passos:                       │ ]
[ │ • Aquecimento: 5min           │ ]
[ │ • Corrida: 50min @ 10 KM/h    │ ]
[ └────────────────────────────────┘ ]
```

### Header
- **Ordem:** Title → Dark Mode → History → Avatar (inalterado)
- Avatar abre modal de perfil (existente)

### Saudação
- "Olá, **{profile.displayName}**" — usa o nome completo salvo no perfil
- Se `displayName` não existir, mostra "Olá, Corredor!"

### Calendário Semanal (WeekCalendar)
- **Scroll horizontal** com 7 dias, cada um com `flex: 1 0 14.28%`
- **Padding lateral** de `1rem` (igual ao resto do conteúdo)
- Dia atual selecionado por default (highlight: cor primária, texto branco)
- Bolinha inferior:
  - Azul (`#6366f1`): há treino(s) programado(s) no dia
  - Verde (`#10b981`): treino(s) já realizado(s) no dia
  - Sem bolinha: dia sem treinos
- Navegação: "‹ Semana anterior" / "Próxima semana ›" + label "Julho 2026"
- Ao mudar de semana, seleciona o dia equivalente (ou o primeiro dia da semana)
- Os 7 dias ocupam 100% da largura (`flex: 1 0 14.28%`) sem necessidade de scroll horizontal em telas >320px. Overflow-x: auto apenas como fallback para dispositivos muito estreitos.

### Botão Planos + Bottom Sheet
- "Planos ▲" — botão arredondado que abre bottom sheet
- Badge ao lado: "{data} — {N} treinos" (contagem do dia selecionado)
- **Bottom Sheet** (componente reutilizável):
  - Sobe de baixo com overlay escuro
  - Fecha ao tocar no overlay ou selecionar uma opção
  - Opções:
    1. Novo Treino Manual → abre `WorkoutEditor`
    2. Treino Livre → inicia `startFreeTraining()`
    3. Gerador Automático → abre `TrainingGenerator`
    4. Carregar / Substituir Plano de Treino → `ImportPlan`
    5. Apagar Plano de Treino → modal de confirmação
  - Ordem das opções segue a prioridade de uso

### Lista de Treinos (vinculada ao calendário)
- Título: "TREINOS DE {DD/MM/AAAA}"
- Filtrada pelo dia selecionado no calendário
- Estado inicial: treinos **não realizados** do dia
- Navegação para dias anteriores → mostra treinos do passado (incluindo realizados)
- Cada item:
  - Círculo vazio (`○`): pendente, clica para marcar como realizado
  - Check verde (`✓`): já realizado, opacidade reduzida
  - Nome do plano + duração total
  - Botões de ação: ▶ Iniciar, 📊 Histórico, 🗑 Excluir
  - Expande/colapsa para mostrar steps (comportamento existente via `expandedPlanId`)
- Se não há treinos no dia: mensagem "Nenhum treino programado para este dia"

## Dados

### WorkoutPlan — novo campo
```typescript
export interface WorkoutPlan {
  // ... campos existentes
  scheduledDate?: string; // "YYYY-MM-DD" — nova
}
```

- **Planos de programa** (TrainingProgram): ganham `scheduledDate` baseado no número da semana + `raceDate` ou data de criação
- **Planos manuais:** `scheduledDate` default = data de criação (hoje)
- **Importação JSON:** respeita `scheduledDate` se presente no JSON; se ausente, usa data do import
- **Planos existentes sem `scheduledDate`:** na primeira carga, todo plano sem `scheduledDate` recebe a data atual (today). Sem migração complexa — o usuário pode ajustar depois.

### Fontes do calendário
A semana exibida busca:
1. `WorkoutPlan[]` com `scheduledDate` dentro da semana
2. `TrainingSession[]` com `date` dentro da semana (para marcar realizados)

### Persistência
- `scheduledDate` é salvo no Firestore (`users/{uid}/data/plans`) e localStorage (`correlogo:plans:{uid}`)
- Mesmo padrão `setDoc` com `merge: true` dos campos existentes

## Componentes Novos

### `WeekCalendar.tsx`
- Props: `selectedDate: Date | null`, `onSelectDate: (date: Date) => void`, `weekStart: Date`, `onWeekChange: (direction: -1 | 1) => void`, `plannedDates: Set<string>`, `completedDates: Set<string>`
- Renderiza 7 dias da semana, destaca selecionado, bolinhas de status
- Navegação ← →

### `BottomSheet.tsx`
- Props: `open: boolean`, `onClose: () => void`, `children: ReactNode`
- Overlay + painel que desliza de baixo, animação CSS transition (`translateY`)
- Fecha ao clicar no overlay
- Largura máxima 480px centralizada em desktop

## Mudanças em Componentes Existentes

### `App.tsx`
- Estado novo: `selectedDate: Date`, `weekStart: Date`
- `useEffect` para migrar planos existentes sem `scheduledDate` (uma vez)
- Novo `useMemo` para filtrar `plans` por `scheduledDate === formatted(selectedDate)`
- Novo `useMemo` para `plannedDates` e `completedDates` (sets de strings "YYYY-MM-DD" para a semana)
- Substitui o bloco de ações atual (linhas 611-648) por: saudação → `WeekCalendar` → botão Planos + `BottomSheet` → lista filtrada
- Export JSON: remove o `<Button>` (atalho), função `handleExportJson` mantida como dead code
- Estado `showPlanSheet: boolean` para controlar bottom sheet
- Funções existentes (`startFreeTraining`, `setIsEditing`, `setShowGenerator`, `handleImport`, `setPlanToDelete`) chamadas diretamente do bottom sheet

### `WorkoutPlan type` (`src/types.ts`)
- Adicionar campo `scheduledDate?: string`

## Comportamentos

| Ação | Resultado |
|------|-----------|
| Clicar em "Planos ▲" | Bottom sheet abre com as 5 opções |
| Selecionar opção no bottom sheet | Executa ação + fecha bottom sheet |
| Clicar em dia no calendário | Filtra lista abaixo, destaca dia |
| Clicar em círculo vazio | Marca plano como realizado |
| Clicar em ▶ Iniciar | Abre modal de configuração de treino (existente) |
| Navegar semana ← → | Muda semana, mantém dia equivalente se possível |
| Scroll horizontal no calendário | Rolagem suave entre os 7 dias (sem scroll infinito) |

## Fora de Escopo (MVP)
- Arrastar planos entre dias no calendário
- Criar novo plano diretamente do calendário (clicar em dia vazio)
- Visão mensal
- Fuso horário (usa UTC/local do dispositivo)
- Upload de foto de perfil (já anotado como dívida técnica)
- Equipamentos, mais preferências, editar email/senha (dívida técnica)
