# Visual Identity — Paleta Pôr-do-Sol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Mineral palette with Pôr-do-Sol and refactor theme from prop drilling to CSS Variables.

**Architecture:** CSS Variables in `:root` (dark, default) and `.light` (light override). Components stop receiving `isDarkMode` as a prop and use fixed Tailwind classes instead. The toggle adds/removes `.light` on `<html>`.

**Tech Stack:** Tailwind CSS v4, React 19, TypeScript

## Global Constraints

- Keep all existing Tailwind class names (`bg-bg-deep`, `text-text-primary`, etc.) — only change their hex values
- Do NOT remove or rename any component files
- All `isDarkMode` props must be removed from component interfaces
- The existing Firestore persistence for theme preference must work after migration (stored boolean inverts CSS class logic)
- Uncommitted `package.json` and `opencode.json` must NOT be included in commits

---

### Task 1: Update `src/index.css` with Pôr-do-Sol palette

**Files:**
- Modify: `src/index.css` (entire file)

- [ ] **Replace the Mineral @theme block with Pôr-do-Sol palette + CSS variables**

Replace the entire content of `src/index.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Geologica:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
@import "tailwindcss";

@theme {
  --font-display: "Geologica", sans-serif;
  --font-body: "IBM Plex Sans", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;

  /* SUNSET PALETTE — Shared accent colors */
  --color-accent: #FF006E;
  --color-accent-secondary: #FFBE0B;
  --color-accent-tertiary: #7209B7;

  /* DARK MODE (default) */
  --color-bg-deep: #0A0A14;
  --color-bg-surface: #12122A;
  --color-bg-elevated: #1C1C40;
  --color-border: #2A2A50;

  --color-text-primary: #F0ECF5;
  --color-text-secondary: #B0A8C8;
  --color-text-muted: #7A7490;
}

@layer base {
  :root {
    --bg-deep: #0A0A14;
    --bg-surface: #12122A;
    --bg-elevated: #1C1C40;
    --border: #2A2A50;
    --text-primary: #F0ECF5;
    --text-secondary: #B0A8C8;
    --text-muted: #7A7490;
  }

  .light {
    --bg-deep: #F8F4F0;
    --bg-surface: #FFFFFF;
    --bg-elevated: #F0ECE8;
    --border: #D4CFC8;
    --text-primary: #1A1826;
    --text-secondary: #5A5470;
    --text-muted: #8A8498;
  }

  body {
    background-color: var(--bg-deep);
    color: var(--text-primary);
  }
}

@layer utilities {
  .animate-marquee {
    animation: marquee 10s linear infinite;
  }
}

@keyframes marquee {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
```

- [ ] **Commit Task 1**

```bash
git add src/index.css
git commit -m "feat: replace Mineral palette with Po^r-do-Sol CSS variables"
```

---

### Task 2: Refactor `App.tsx` — remove isDarkMode prop drilling, switch to CSS class toggle

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `<div className="min-h-screen">` (no more `isDarkMode ? ... : ...`)
- Produces: toggle function that toggles `.light` class on `<html>`
- Produces: No more `isDarkMode={isDarkMode}` props passed to children

- [ ] **Change the theme toggle logic at line 111**

Replace the `toggleDarkMode` function:

```tsx
const toggleDarkMode = async () => {
  const html = document.documentElement;
  const isLight = html.classList.toggle('light');
  if (user) {
    localStorage.setItem(`correlogo:darkMode:${user.uid}`, String(!isLight));
    try {
      await setDoc(doc(getDb(), 'users', user.uid, 'data', 'settings'), { isDarkMode: !isLight }, { merge: true });
    } catch (e) {
      console.error("Erro ao salvar preferência de tema no Firestore:", e);
    }
  }
};
```

- [ ] **Update initialization to apply `.light` class on load (around line 52-93)**

After `setIsDarkMode` calls, add:

```tsx
document.documentElement.classList.toggle('light', !isDarkMode);
```

Replace each instance where `isDarkMode` is set with the class toggle applied immediately after. For example, in the auth callback, after line 57:

```tsx
document.documentElement.classList.toggle('light', !isDarkMode);
```

And after line 91:

```tsx
document.documentElement.classList.toggle('light', !isDarkMode);
```

- [ ] **Remove the outer div ternary at line 266**

Replace:
```tsx
<div className={`min-h-screen ${isDarkMode ? 'dark bg-bg-deep' : 'bg-agate-cream'}`}>
```
With:
```tsx
<div className="min-h-screen">
```

- [ ] **Replace all App.tsx ternary classes with fixed classes** (lines 297-517)

Map of changes (all in App.tsx):

| Line | Old ternary | New fixed class |
|------|-------------|-----------------|
| 297 | `isDarkMode ? 'text-text-primary' : 'text-obsidian'` | `text-text-primary` |
| 301 | `isDarkMode ? 'bg-bg-mantle text-citrine' : 'bg-agate-band text-obsidian'` | `bg-elevated text-accent-secondary` |
| 307 | `isDarkMode ? 'bg-bg-mantle text-jasper-red' : 'bg-agate-band text-jasper-red'` | `bg-elevated text-accent` (use #E63946 for danger) |
| 313 | `isDarkMode ? 'bg-bg-mantle text-citrine' : 'bg-agate-band text-obsidian'` | `bg-elevated text-accent-secondary` |
| 315 | `isDarkMode ? '☀️' : '🌙'` | Keep emoji toggle as-is |
| 323 | `isDarkMode ? 'bg-bg-bedrock border border-bg-shale' : 'bg-selenite'` | `bg-surface border border-border` |
| 324 | `isDarkMode ? 'text-text-primary' : 'text-obsidian'` | `text-text-primary` |
| 328 | `isDarkMode ? 'text-text-secondary' : 'text-text-muted'` | `text-text-secondary` |
| 330 | nested ternary with isDarkMode | `bg-surface` (selected: `bg-accent text-white`) |
| 331 | nested ternary with isDarkMode | `bg-surface` (selected: `bg-accent text-white`) |
| 336 | `isDarkMode ? 'bg-bg-shale text-text-primary' : 'bg-agate-band text-obsidian'` | `bg-elevated text-text-primary` |
| 378 | `isDarkMode ? 'bg-bg-bedrock border-bg-shale' : 'bg-selenite border-agate-band'` | `bg-surface border border-border` |
| 419 | `isDarkMode ? 'text-text-muted' : 'text-text-muted'` | `text-text-muted` |
| 422 | `isDarkMode ? 'border-bg-shale' : 'border-agate-band'` | `border border-border` |
| 424 | `isDarkMode ? 'hover:bg-bg-mantle' : 'hover:bg-agate-cream'` | `hover:bg-elevated` |
| 429 | `isDarkMode ? 'text-text-muted' : 'text-agate-band'` | `text-text-muted` |
| 431 | `isDarkMode ? 'text-agate-cream' : 'text-obsidian'` | `text-text-primary` |
| 434 | `isDarkMode ? 'bg-bg-bedrock' : 'bg-selenite'` | `bg-surface` |
| 435 | `isDarkMode ? 'text-text-muted' : 'text-agate-band'` | `text-text-muted` |
| 454 | `isDarkMode ? 'border-bg-shale text-text-secondary' : 'border-agate-band text-text-muted'` | `border border-border text-text-secondary` |
| 474 | `isDarkMode ? 'bg-bg-bedrock border border-bg-shale' : 'bg-selenite'` | `bg-surface border border-border` |
| 475 | `isDarkMode ? 'text-text-primary' : 'text-obsidian'` | `text-text-primary` |
| 476 | `isDarkMode ? 'text-text-secondary' : 'text-text-muted'` | `text-text-secondary` |
| 489 | `isDarkMode ? 'bg-bg-shale' : 'bg-agate-band'` | `bg-elevated` |
| 499 | `isDarkMode ? 'bg-bg-bedrock border border-bg-shale' : 'bg-selenite'` | `bg-surface border border-border` |
| 500 | `isDarkMode ? 'text-text-primary' : 'text-obsidian'` | `text-text-primary` |
| 501 | `isDarkMode ? 'text-text-secondary' : 'text-text-muted'` | `text-text-secondary` |
| 513 | `isDarkMode ? 'bg-bg-shale' : 'bg-agate-band'` | `bg-elevated` |

- [ ] **Remove all `isDarkMode={isDarkMode}` props** from child components (lines 277, 285, 356)

- [ ] **Commit Task 2**

```bash
git add src/App.tsx
git commit -m "refactor: replace isDarkMode prop drilling with CSS class toggle"
```

---

### Task 3: Refactor `WorkoutTracker.tsx` — remove isDarkMode prop

**Files:**
- Modify: `src/components/WorkoutTracker.tsx`

**Interfaces:**
- Consumes: no longer receives `isDarkMode` from App.tsx
- Produces: uses fixed Tailwind classes from the CSS variables

- [ ] **Remove `isDarkMode` from Props interface** (lines 6-19)

Remove `isDarkMode: boolean;` from the interface.

- [ ] **Remove `isDarkMode` from destructuring** (line 21)

Change `{ plan, onStop, mode, isDarkMode, markAsCompleted, totalWorkoutTime }` to `{ plan, onStop, mode, markAsCompleted, totalWorkoutTime }`.

- [ ] **Replace all ternary classes with fixed classes** (lines 384-506)

| Line | Old | New |
|------|-----|-----|
| 384 | `isDarkMode ? 'bg-bg-deep text-text-primary' : 'bg-agate-cream text-obsidian'` | `bg-bg-deep text-text-primary` |
| 386 | `isDarkMode ? 'bg-bg-deep' : 'bg-agate-cream'` | `bg-bg-deep` |
| 389 | `isDarkMode ? 'text-text-secondary' : 'text-text-muted'` | `text-text-secondary` |
| 390 | `isDarkMode ? 'text-tourmaline' : 'text-tourmaline-deep'` | `text-accent-secondary` |
| 394 | `isDarkMode ? 'text-text-secondary' : 'text-text-muted'` | `text-text-secondary` |
| 398 | same | `text-text-secondary` |
| 402 | same | `text-text-secondary` |
| 427 | same | `text-text-secondary` |
| 429 | same | `text-text-secondary` |
| 482 | `isDarkMode ? 'bg-agate-cream text-obsidian' : 'bg-bg-shale text-selenite'` | `bg-elevated text-text-primary` |
| 488 | `isDarkMode ? 'bg-bg-bedrock border border-bg-shale' : 'bg-selenite'` | `bg-surface border border-border` |
| 489 | `isDarkMode ? 'text-text-primary' : 'text-text-primary'` | `text-text-primary` (already same) |

Also remove the `isDarkMode` prop from `MapComponent` usage on line 422:
```tsx
<MapComponent coords={coords} path={path} />
```

- [ ] **Commit Task 3**

```bash
git add src/components/WorkoutTracker.tsx
git commit -m "refactor: remove isDarkMode prop from WorkoutTracker"
```

---

### Task 4: Refactor `SessionHistory.tsx` — remove isDarkMode prop

**Files:**
- Modify: `src/components/SessionHistory.tsx`

- [ ] **Remove `isDarkMode` from Props interface** (line 8)
- [ ] **Remove `isDarkMode` from destructuring** (line 11)
- [ ] **Replace ternaries** (lines 13, 26)

| Line | Old | New |
|------|-----|-----|
| 13 | `isDarkMode ? 'bg-bg-deep' : 'bg-agate-cream'` | `bg-bg-deep` |
| 26 | `isDarkMode ? 'bg-bg-bedrock' : 'bg-selenite'` | `bg-surface` |

- [ ] **Commit Task 4**

```bash
git add src/components/SessionHistory.tsx
git commit -m "refactor: remove isDarkMode prop from SessionHistory"
```

---

### Task 5: Refactor `SessionSummary.tsx` — remove isDarkMode prop

**Files:**
- Modify: `src/components/SessionSummary.tsx`

- [ ] **Remove `isDarkMode` from Props interface** (line 14)
- [ ] **Remove `isDarkMode` from destructuring** (line 17)
- [ ] **Replace ternaries** (lines 59, 75, 80, 84, 88, 92, 99, 126)

| Line | Old | New |
|------|-----|-----|
| 59 | `isDarkMode ? 'bg-bg-deep' : 'bg-agate-cream'` | `bg-bg-deep` |
| 75 | `isDarkMode={isDarkMode}` on MapComponent | Remove prop |
| 80,84,88,92,99,126 | `isDarkMode ? 'bg-bg-bedrock' : 'bg-selenite'` | `bg-surface` |

- [ ] **Commit Task 5**

```bash
git add src/components/SessionSummary.tsx
git commit -m "refactor: remove isDarkMode prop from SessionSummary"
```

---

### Task 6: Refactor `MapComponent.tsx` — remove isDarkMode prop, use CSS class instead

**Files:**
- Modify: `src/components/MapComponent.tsx`

- [ ] **Remove `isDarkMode` from function signature** (line 46)

Change to:
```tsx
export default function MapComponent({ coords, path }: { coords: { lat: number; lng: number } | null, path: { lat: number; lng: number }[] }) {
```

- [ ] **Replace isDarkMode-dependent logic** (lines 47-51, 72)

Change the `useState` and `useEffect` for `layerType` to check the document class:
```tsx
const [layerType, setLayerType] = useState<'light' | 'dark' | 'satellite'>(
  document.documentElement.classList.contains('light') ? 'light' : 'dark'
);

useEffect(() => {
  const observer = new MutationObserver(() => {
    setLayerType(document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}, []);
```

Change the `color` prop in Polyline (line 72):
```tsx
color={document.documentElement.classList.contains('light') ? '#1A1826' : '#FFBE0B'}
```
But this also needs to react to changes. Better to use `layerType`:
```tsx
color={layerType === 'light' ? '#1A1826' : '#FFBE0B'}
```

- [ ] **Commit Task 6**

```bash
git add src/components/MapComponent.tsx
git commit -m "refactor: remove isDarkMode prop from MapComponent, observe CSS class"
```

---

### Task 7: Refactor `Login.tsx` — use Pôr-do-Sol theme colors

**Files:**
- Modify: `src/components/Login.tsx`

- [ ] **Replace the form element classes** (line 61)

Change from:
```tsx
<form onSubmit={handleLogin} className="max-w-md mx-auto p-4 border rounded bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
```
To:
```tsx
<form onSubmit={handleLogin} className="max-w-md mx-auto p-4 border rounded bg-surface border-border text-text-primary">
```

- [ ] **Replace the heading** (line 62)

Change `text-xl mb-4` to: (keep, just add the theme heading style)
```tsx
<h2 className="text-xl mb-4 font-display font-bold">Login</h2>
```

- [ ] **Replace inputs** (lines 63-64)

Change from:
```tsx
<input className="border p-2 mb-2 w-full rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100" ... />
```
To:
```tsx
<input className="input" ... />
```

But we need to add `.input` styling. Instead, use explicit classes:
```tsx
<input className="border p-2 mb-2 w-full rounded bg-surface border-border text-text-primary" ... />
```

- [ ] **Replace buttons** (lines 66-67)

From `bg-blue-500 text-white` to `bg-accent text-white`.

From `bg-red-500 text-white` to `bg-accent text-white`.

From `text-blue-500` to `text-accent-tertiary`.

From `text-gray-500` to `text-text-muted`.

- [ ] **Commit Task 7**

```bash
git add src/components/Login.tsx
git commit -m "refactor: apply Po^r-do-Sol theme to Login component"
```

---

### Task 8: Refactor `Signup.tsx` — use Pôr-do-Sol theme colors

**Files:**
- Modify: `src/components/Signup.tsx`

- [ ] **Replace the input classes variable** (line 46)

Change from:
```tsx
const inputClass = "border p-2 mb-2 w-full rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100";
```
To:
```tsx
const inputClass = "border p-2 mb-2 w-full rounded bg-surface border-border text-text-primary";
```

- [ ] **Replace the form element** (line 50)

From:
```tsx
<form ... className="max-w-md mx-auto p-4 border rounded bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
```
To:
```tsx
<form ... className="max-w-md mx-auto p-4 border rounded bg-surface border-border text-text-primary">
```

- [ ] **Replace buttons and links** (lines 82, 95, 99)

Line 82: `bg-gray-100 dark:bg-gray-800 rounded` → `bg-elevated rounded`
Line 95: `text-blue-500 underline` → `text-accent-tertiary underline`
Line 99: `bg-blue-500 text-white` → `bg-accent text-white`

- [ ] **Commit Task 8**

```bash
git add src/components/Signup.tsx
git commit -m "refactor: apply Po^r-do-Sol theme to Signup component"
```

---

### Task 9: Refactor `ImportPlan.tsx` — add dark mode support

**Files:**
- Modify: `src/components/ImportPlan.tsx`

- [ ] **Replace hardcoded gray classes** (lines 115-116, 122)

Line 115: `bg-gray-100 py-3 rounded-lg hover:bg-gray-200 transition text-gray-700`
→ `bg-elevated py-3 rounded-lg hover:bg-surface transition text-text-primary border border-border`

Line 122: `text-center text-sm text-gray-600 my-4 font-semibold`
→ `text-center text-sm text-text-secondary my-4 font-semibold`

- [ ] **Commit Task 9**

```bash
git add src/components/ImportPlan.tsx
git commit -m "refactor: add dark mode support to ImportPlan with Po^r-do-Sol theme"
```

---

### Task 10: Run lint and verify

- [ ] **Run the TypeScript checker**

```bash
npm run lint
```

- [ ] **Build the project to verify no errors**

```bash
npm run build
```

- [ ] **Push to GitHub**

```bash
git push origin main
```
