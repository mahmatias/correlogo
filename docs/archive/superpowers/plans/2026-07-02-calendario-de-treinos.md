# Calendário de Treinos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current action-button list with a calendar-centric layout: greeting, week calendar, bottom-sheet plan menu, and date-filtered plan list.

**Architecture:** Add `scheduledDate` to `WorkoutPlan`; new `WeekCalendar` and `BottomSheet` components; restructure `App.tsx` main content area to wire them together. All plan-creation flows assign `scheduledDate = today` by default.

**Tech Stack:** React, TypeScript, Tailwind CSS, Firestore, localStorage

## Global Constraints

- No new dependencies
- Follow existing patterns: `updatePlansState` for plan mutations, `showFeedback` for toasts, `crypto.randomUUID()` for IDs
- All dates as `"YYYY-MM-DD"` strings
- Advisor style per AGENTS.md applies during review

---

### Task 1: Add `scheduledDate` + `BottomSheet` component

**Files:**
- Modify: `src/types.ts:55-64`
- Create: `src/components/BottomSheet.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `WorkoutPlan.scheduledDate?: string`, `<BottomSheet open onClose children />`

- [ ] **Step 1: Add `scheduledDate` to `WorkoutPlan`**

Edit `src/types.ts:55-64`:
```typescript
export interface WorkoutPlan {
  id: string;
  name: string;
  steps: WorkoutStep[];
  isCompleted?: boolean;
  programName?: string;
  activityName?: string;
  activityNumber?: string;
  manual?: boolean;
  scheduledDate?: string; // "YYYY-MM-DD"
}
```

- [ ] **Step 2: Create `src/components/BottomSheet.tsx`**

```tsx
import { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70"
      onClick={onClose}
    >
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-bg-surface border border-border rounded-t-2xl shadow-xl transition-transform duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/components/BottomSheet.tsx
git commit -m "feat: add scheduledDate to WorkoutPlan + BottomSheet component"
```

---

### Task 2: `WeekCalendar` component

**Files:**
- Create: `src/components/WeekCalendar.tsx`

**Interfaces:**
- Consumes: nothing (pure props)
- Produces: `<WeekCalendar selectedDate weekStart onSelectDate onWeekChange plannedDates completedDates />`

- [ ] **Step 1: Create `src/components/WeekCalendar.tsx`**

```tsx
import { useMemo } from 'react';

interface Props {
  selectedDate: Date;
  weekStart: Date;
  onSelectDate: (date: Date) => void;
  onWeekChange: (direction: -1 | 1) => void;
  plannedDates: Set<string>;
  completedDates: Set<string>;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function WeekCalendar({ selectedDate, weekStart, onSelectDate, onWeekChange, plannedDates, completedDates }: Props) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const monthLabel = `${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
  const today = new Date();

  return (
    <div>
      <div className="flex gap-1" style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {days.map((day) => {
          const dateKey = fmt(day);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const hasPlanned = plannedDates.has(dateKey);
          const hasCompleted = completedDates.has(dateKey);
          let dotColor = '';
          if (hasCompleted) dotColor = 'bg-accent-secondary';
          else if (hasPlanned) dotColor = 'bg-accent';

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={`flex-1 min-w-0 text-center py-2 rounded-lg transition-colors ${
                isSelected
                  ? 'bg-accent text-white'
                  : isToday
                    ? 'bg-bg-elevated text-text-primary'
                    : 'bg-bg-surface text-text-secondary'
              }`}
            >
              <div className="text-xs uppercase opacity-70">{DAYS[day.getDay()]}</div>
              <div className="text-sm font-semibold">{day.getDate()}</div>
              {dotColor && <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-0.5 ${dotColor}`} />}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <button className="text-xs text-accent cursor-pointer" onClick={() => onWeekChange(-1)}>‹ Semana anterior</button>
        <span className="text-xs text-text-muted">{monthLabel}</span>
        <button className="text-xs text-accent cursor-pointer" onClick={() => onWeekChange(1)}>Próxima semana ›</button>
      </div>
      <div className="flex gap-3 mt-1 text-xs text-text-muted">
        <span><span className="text-accent">●</span> Programado</span>
        <span><span className="text-accent-secondary">●</span> Realizado</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WeekCalendar.tsx
git commit -m "feat: add WeekCalendar component"
```

---

### Task 3: Refactor `App.tsx` — new layout

**Files:**
- Modify: `src/App.tsx` (major restructure of lines 517-729)

**Interfaces:**
- Consumes: `WeekCalendar`, `BottomSheet`, `WorkoutPlan.scheduledDate`, `ProfileData.displayName`
- Produces: new main page layout

- [ ] **Step 1: Add new state variables (near line 56)**

After `const [showUserProfile, setShowUserProfile] = useState(false);` add:
```typescript
const [showPlanSheet, setShowPlanSheet] = useState(false);
const today = new Date();
const getWeekStart = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0,0,0,0);
  return mon;
};
const [selectedDate, setSelectedDate] = useState<Date>(today);
const [weekStart, setWeekStart] = useState<Date>(getWeekStart(today));
```

- [ ] **Step 2: Add helper functions for date formatting (near line 24)**

After `function stripUndefined`:
```typescript
function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDateBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
```

- [ ] **Step 3: Assign `scheduledDate` in plan creation flows**

In `handleSaveManualPlan` (line 295):
```typescript
const handleSaveManualPlan = (plan: WorkoutPlan) => {
  const datedPlan = { ...plan, scheduledDate: plan.scheduledDate || formatDateKey(new Date()) };
  const updatedPlans = [...plans, datedPlan];
  updatePlansState(updatedPlans, 'Plano manual salvo!');
  setIsEditing(false);
};
```

In `startFreeTraining` (line 252): no change needed (free training starts immediately, no persistent plan)

In `handleImport` (line 290):
```typescript
const handleImport = async (newPlans: WorkoutPlan[]) => {
  const datedPlans = newPlans.map(p => ({ ...p, scheduledDate: p.scheduledDate || formatDateKey(new Date()) }));
  const updatedPlans = [...plans, ...datedPlans];
  updatePlansState(updatedPlans, 'Planos importados com sucesso!');
};
```

In `ProgramReview onConfirm` (line 603): add `scheduledDate` based on week number and raceDate or current date:
```typescript
onConfirm={(finalProgram) => {
  const raceDateStr = finalProgram.raceDate;
  const raceDate = raceDateStr ? new Date(raceDateStr) : null;
  const allPlans = finalProgram.weeks.flatMap(week => {
    const weekDate = raceDate
      ? new Date(raceDate.getTime() - (finalProgram.weeks.length - week.weekNumber) * 7 * 86400000)
      : new Date(Date.now() + (week.weekNumber - 1) * 7 * 86400000);
    return week.plans.map(p => ({
      ...p,
      scheduledDate: formatDateKey(weekDate),
    }));
  });
  updatePlansState([...plans, ...allPlans], 'Programa gerado com sucesso!');
  setProgramToReview(null);
}}
```

In the initial load (after Firestore fetch, near line 165): migrate existing plans without `scheduledDate`:
```typescript
const migratedPlans = remotePlans.map((p: WorkoutPlan) => ({
  ...p,
  scheduledDate: p.scheduledDate || formatDateKey(new Date()),
}));
// Use migratedPlans instead of remotePlans throughout
```

And similarly in the localStorage cache read (line 149-158): apply same migration.

- [ ] **Step 4: Add WeekCalendar + BottomSheet imports (near top)**

After existing imports, add:
```typescript
import WeekCalendar from './components/WeekCalendar';
import BottomSheet from './components/BottomSheet';
import { ChevronUp, Plus } from 'lucide-react';
```

- [ ] **Step 5: Compute derived data for the calendar**

Add `useMemo` blocks before the return statement:
```typescript
// Filter plans for selected date
const plansForSelectedDate = useMemo(() => {
  const key = formatDateKey(selectedDate);
  return plans.filter(p => p.scheduledDate === key);
}, [plans, selectedDate]);

// Build planned/completed date sets for the visible week
const { plannedDates, completedDates } = useMemo(() => {
  const planned = new Set<string>();
  const completed = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const key = formatDateKey(d);
    const dayPlans = plans.filter(p => p.scheduledDate === key);
    if (dayPlans.length > 0) planned.add(key);
    if (dayPlans.some(p => p.isCompleted)) completed.add(key);
  }
  return { plannedDates: planned, completedDates: completed };
}, [plans, weekStart]);

const dayPlansCount = plansForSelectedDate.length;

const greetingName = profile?.displayName || user?.displayName || 'Corredor';
```

- [ ] **Step 6: Replace the main content area (lines 517-729)**

Replace the entire block from `{!activePlan && (` to the closing of the main content div:

```tsx
{!activePlan && (
  <>
    {/* Header */}
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold text-text-primary">Corre Logo 🏃</h1>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={toggleDarkMode} aria-label={isLightMode ? 'Alternar para modo escuro' : 'Alternar para modo claro'}>
          {isLightMode ? '🌙' : '☀️'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)} aria-label="Histórico de treinos">
          <BarChart2 size={20} />
        </Button>
        <button onClick={() => setShowUserProfile(true)} className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity overflow-hidden" aria-label="Perfil do usuário">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold">{(profile?.displayName || user.email || '?')[0].toUpperCase()}</span>
          )}
        </button>
      </div>
    </div>

    {/* Greeting */}
    <div className="mb-4">
      <p className="text-lg text-text-primary">
        Olá, <strong>{greetingName}</strong>
      </p>
    </div>

    {/* Week Calendar */}
    <div className="mb-3">
      <WeekCalendar
        selectedDate={selectedDate}
        weekStart={weekStart}
        onSelectDate={setSelectedDate}
        onWeekChange={(dir) => {
          const newStart = new Date(weekStart);
          newStart.setDate(newStart.getDate() + dir * 7);
          setWeekStart(newStart);
        }}
        plannedDates={plannedDates}
        completedDates={completedDates}
      />
    </div>

    {/* Planos button + date badge */}
    <div className="flex gap-2 mb-4 flex-wrap">
      <Button onClick={() => setShowPlanSheet(true)}>
        Planos <ChevronUp size={16} className="ml-1" />
      </Button>
      <div className="px-3 py-2 rounded-full text-xs border border-border text-text-secondary">
        {formatDateBR(selectedDate)} — {dayPlansCount} {dayPlansCount === 1 ? 'treino' : 'treinos'}
      </div>
    </div>

    {/* Plan list filtered by date */}
    <div>
      <p className="text-xs text-text-muted mb-2 font-semibold uppercase tracking-wide">
        TREINOS DE {formatDateBR(selectedDate)}
      </p>
      {plansForSelectedDate.length === 0 ? (
        <div className="text-center text-text-muted py-8">
          <p>Nenhum treino programado para este dia</p>
        </div>
      ) : (
        plansForSelectedDate.map((plan, index) => (
          <div key={`${plan.id}-${index}`} className={`border border-border rounded-lg overflow-hidden mb-2 ${plan.isCompleted ? 'opacity-70' : ''}`}>
            <div className="flex justify-between items-center p-3 cursor-pointer hover:bg-bg-elevated" onClick={() => togglePlanExpansion(plan.id)}>
              <div className="flex gap-2 items-center">
                <button onClick={(e) => { e.stopPropagation(); toggleComplete(plan); }} className="p-1" aria-label={plan.isCompleted ? 'Marcar como não realizado' : 'Marcar como realizado'}>
                  {plan.isCompleted ? <CheckCircle className="text-accent-secondary" /> : <Circle className="text-text-muted" />}
                </button>
                <span className="font-medium text-text-primary truncate text-sm">{plan.activityName || plan.name || 'Plano sem nome'}</span>
              </div>
              <span className="text-xs text-text-secondary">{formatTotalDuration(calculateTotalDuration(plan))}</span>
            </div>
            <div className="flex justify-between items-center px-3 pb-3 bg-bg-surface">
              <span className="text-xs text-text-secondary">{formatTotalDuration(calculateTotalDuration(plan))}</span>
              <div className="flex gap-2 items-center">
                {plan.manual && (
                  <button className="p-1.5 text-text-muted hover:text-accent hover:bg-bg-elevated rounded-full" onClick={(e) => { e.stopPropagation(); setPlanToDelete(plan); }} aria-label="Apagar atividade">
                    <Trash2 size={18} />
                  </button>
                )}
                <button className={`p-1.5 text-accent-secondary hover:bg-bg-elevated rounded-full ${!sessions.some(s => s.planId === plan.id) ? 'opacity-30 cursor-not-allowed' : ''}`} onClick={(e) => { e.stopPropagation(); setSelectedSession(sessions.find(s => s.planId === plan.id) || null); }} disabled={!sessions.some(s => s.planId === plan.id)} aria-label="Histórico desta atividade">
                  <BarChart2 size={18} />
                </button>
                <button className={`p-1.5 text-accent hover:bg-bg-elevated rounded-full ${plan.isCompleted ? 'cursor-not-allowed opacity-30' : ''}`} onClick={(e) => { e.stopPropagation(); if (!plan.isCompleted) startWorkout(plan); }} disabled={plan.isCompleted} aria-label={plan.isCompleted ? 'Atividade já concluída' : 'Iniciar atividade'}>
                  <Play size={18} />
                </button>
              </div>
            </div>
            <div className={`overflow-y-auto transition-all duration-300 ${expandedPlanId === plan.id ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-3 border-t border-border text-text-secondary text-sm">
                <h4 className="font-semibold mb-1.5">Passos:</h4>
                <ul className="space-y-1">
                  {plan.steps.map((step, idx) => {
                    const ptType = step.type === 'warmup' ? 'Aquecimento' : step.type === 'run' ? 'Corrida' : step.type === 'cooldown' ? 'Desaquecimento' : step.type === 'rest' ? 'Descanso' : step.type;
                    return (
                      <li key={idx}>{ptType}: {formatDuration(step.durationSeconds)}min{step.targetPace ? ` @ ${(60/step.targetPace).toFixed(1)} KM/h (Ritmo ${Math.floor(step.targetPace)}'${Math.round((step.targetPace % 1) * 60)}"/km)` : ''}</li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </>
)}
```

- [ ] **Step 7: Add bottom sheet render (between plan list and planToUncomplete)**

After the plan list closing div (before `{planToUncomplete &&`):
```tsx
<BottomSheet open={showPlanSheet} onClose={() => setShowPlanSheet(false)}>
  <div className="flex flex-col gap-2">
    <Button className="w-full" onClick={() => { setShowPlanSheet(false); setIsEditing(true); }}>
      Novo Treino Manual
    </Button>
    <Button className="w-full" size="lg" onClick={() => { setShowPlanSheet(false); startFreeTraining(); }}>
      Treino Livre
    </Button>
    <Button className="w-full" onClick={() => { setShowPlanSheet(false); setShowGenerator(true); }}>
      Gerador Automático
    </Button>
    <div onClick={() => { setShowPlanSheet(false); }}>
      <ImportPlan onImport={handleImport} plans={plans} />
    </div>
    {plans.length > 0 && (
      <Button variant="danger" className="w-full mt-2" onClick={() => { setShowPlanSheet(false); setPlanToDelete({ id: 'ALL', name: 'TODOS os planos' } as WorkoutPlan); }}>
        Apagar Plano de Treino
      </Button>
    )}
  </div>
</BottomSheet>
```

- [ ] **Step 8: Remove unused imports and dead code**

Remove export JSON button code (lines 619-636). The `Download` icon import for export JSON can stay if used elsewhere, otherwise remove unused imports.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat: calendar layout with week calendar, bottom sheet, and filtered plan list"
```

---

### Task 4: Build, verify, and deploy

- [ ] **Step 1: Run build**

```bash
npm run build
```

- [ ] **Step 2: Fix any type errors**

If the build fails, fix the reported errors and rebuild.

- [ ] **Step 3: Commit and push**

```bash
git push origin main
```

- [ ] **Step 4: Deploy to production**

Via SSH: pull, build, and restart.

- [ ] **Step 5: Update CHANGELOG.md and HANDOFF.md**
