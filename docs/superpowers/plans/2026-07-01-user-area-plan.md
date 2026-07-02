# User Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a User Profile modal with editable personal data and unit preferences.

**Architecture:** New `UserProfile` modal component + Firestore `users/{uid}/data/profile` document + extended `users/{uid}/data/settings`. Triggered from a `User` icon button in the app header.

**Tech Stack:** React, Firebase Auth, Firestore, Tailwind CSS, lucide-react

## Global Constraints
- No new dependencies
- Follow existing patterns: `setDoc` with `merge: true`, `showFeedback` for toasts, localStorage cache keys `correlogo:profile:{uid}`
- All numeric weights stored internally as `kg`, converted for display per user preference
- City field max 20 chars
- State select uses UF abbreviations (AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO)

---

### Task 1: Add Profile and Settings types

**Files:**
- Modify: `src/types.ts` (append before EOF)

**Interfaces:**
- Produces: `ProfileData`, `SettingsData` types used by Tasks 2-4

- [ ] **Add types to `src/types.ts`**

```typescript
export interface ProfileData {
  displayName: string;
  dob: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  photoURL: string | null;
  weightInKg: number | null;
  updatedAt?: number;
}

export interface SettingsData {
  isDarkMode: boolean;
  distanceUnit: 'km' | 'mi';
  paceUnit: 'per_km' | 'per_mi';
  weightUnit: 'kg' | 'lb';
}

export const BRAZILIAN_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO'
] as const;

export const GENDER_OPTIONS = [
  'masculino','feminino','nao-binario','agenero','prefiro-nao-informar','outro'
] as const;
```

- [ ] **Commit**

```
git add src/types.ts
git commit -m "feat: add ProfileData, SettingsData types and constants"
```

---

### Task 2: Create UserProfile component

**Files:**
- Create: `src/components/UserProfile.tsx`

**Interfaces:**
- Consumes: `ProfileData`, `SettingsData` from types.ts; `getAuth`, `getDb` from firebase.ts; `showFeedback` prop
- Produces: Rendered modal with form, save logic

- [ ] **Create `src/components/UserProfile.tsx`**

Props:
```typescript
interface UserProfileProps {
  open: boolean;
  onClose: () => void;
  user: User;
  initialProfile: ProfileData | null;
  initialSettings: SettingsData | null;
  showFeedback: (type: 'success' | 'error', message: string) => void;
  onSaved: (profile: ProfileData, settings: SettingsData) => void;
}
```

Component structure:
- Wraps content in `<Modal open onClose title="Perfil">`
- Local state for form fields (name, day/month/year for DOB, gender, city, state, weight, distanceUnit, paceUnit, weightUnit)
- `useEffect` to populate form from `initialProfile`/`initialSettings` when modal opens
- Avatar section: if `user.photoURL` exists, show `<img>`; else show initials (first char of displayName) in a circle div
- Form fields:
  - Nome: `<input type="text">`
  - Data de Nascimento: 3 selects (dia 1-31, mês 1-12, ano 1900-2026)
  - Gênero: `<select>` with `GENDER_OPTIONS`
  - Cidade: `<input type="text" maxLength={20}>`
  - Estado: `<select>` with `BRAZILIAN_STATES` + empty option
  - Peso: `<input type="number" step="0.1">` + unit label (kg/lb)
  - Unidades: three `<select>`s for distanceUnit, paceUnit, weightUnit
- Save handler:
  - Convert weight to kg if unit is lb: `weightInKg = weightUnit === 'lb' ? weight / 2.20462 : weight`
  - Build new profile doc: const profile = { displayName, dob: `${year}-${month}-${day}`, gender, city, state, photoURL: user.photoURL || null, weightInKg, updatedAt: Date.now() }
  - Build new settings doc: { isDarkMode: existing, distanceUnit, paceUnit, weightUnit }
  - `setDoc(doc(db, 'users', user.uid, 'data', 'profile'), profile, { merge: true })`
  - `setDoc(doc(db, 'users', user.uid, 'data', 'settings'), settings, { merge: true })`
  - `updateProfile(user, { displayName })` (import `updateProfile` from firebase/auth)
  - Cache in localStorage: `localStorage.setItem(\`correlogo:profile:${user.uid}\`, JSON.stringify(profile))` and same for settings
  - `showFeedback('success', 'Perfil salvo')`
  - `onSaved(profile, settings)`
  - `onClose()`
  - On error: `showFeedback('error', 'Erro ao salvar perfil')`
- Weight display conversion:
  - On modal open: if `initialProfile.weightInKg` is set, display value = `initialSettings.weightUnit === 'lb' ? (weightInKg * 2.20462).toFixed(1) : weightInKg`
  - When user changes weightUnit select (e.g. lb → kg): re-calc display value from the internal kg value stored in local state
  - Save: read the display value from the input, convert to kg if unit is lb: `const weightInKg = weightUnit === 'lb' ? parseFloat(weightInput) / 2.20462 : parseFloat(weightInput)`

- [ ] **Commit**

```
git add src/components/UserProfile.tsx
git commit -m "feat: create UserProfile modal component"
```

---

### Task 3: Integrate UserProfile into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Add import for `UserProfile` and types**

```typescript
import UserProfile from './components/UserProfile';
import { ProfileData, SettingsData, GENDER_OPTIONS, BRAZILIAN_STATES } from './types';
```

- [ ] **Add state variables**

```typescript
const [showUserProfile, setShowUserProfile] = useState(false);
const [profile, setProfile] = useState<ProfileData | null>(null);
const [settings, setSettings] = useState<SettingsData | null>(null);
```

- [ ] **Add Firebase reads in the initialization block** (alongside existing plans/sessions read, around line 129-133)

Add `getDoc(doc(db, 'users', user.uid, 'data', 'profile'))` to the `firestorePromise` array. Destructure as `profileDoc`.

After existing settings handling (around line 176):
```typescript
if (profileDoc.exists()) {
  setProfile(profileDoc.data() as ProfileData);
  localStorage.setItem(`correlogo:profile:${user.uid}`, JSON.stringify(profileDoc.data()));
}
```

Also load settings into the new settings state:
```typescript
if (settingsDoc.exists()) {
  const settingsData = settingsDoc.data();
  setSettings({
    isDarkMode: settingsData.isDarkMode ?? false,
    distanceUnit: (settingsData as any).distanceUnit || 'km',
    paceUnit: (settingsData as any).paceUnit || 'per_km',
    weightUnit: (settingsData as any).weightUnit || 'kg',
  });
}
```

- [ ] **Add onSaved handler**

```typescript
const handleProfileSaved = (newProfile: ProfileData, newSettings: SettingsData) => {
  setProfile(newProfile);
  setSettings(newSettings);
};
```

- [ ] **Add User button in the header** (around line 484, before the history button)

```typescript
<Button
  variant="ghost"
  size="sm"
  onClick={() => setShowUserProfile(true)}
  aria-label="Perfil do usuário"
>
  <UserIcon size={20} />
</Button>
```

Add `import { User as UserIcon } from 'lucide-react';` to the existing lucide-react import line.

- [ ] **Add UserProfile modal** (before the closing `</main>`)

```typescript
{showUserProfile && (
  <UserProfile
    open={showUserProfile}
    onClose={() => setShowUserProfile(false)}
    user={user!}
    initialProfile={profile}
    initialSettings={settings}
    showFeedback={showFeedback}
    onSaved={handleProfileSaved}
  />
)}
```

- [ ] **Build and verify**

```
npm run build
```

- [ ] **Commit**

```
git add src/App.tsx
git commit -m "feat: integrate UserProfile into App header and initialization"
```

---

### Task 4: Persist profile data at signup

**Files:**
- Modify: `src/components/Signup.tsx`

- [ ] **After creating user, save profile doc**

After line 51 (`const userCredential = await createUserWithEmailAndPassword(auth, email, password);`) and after `updateProfile(...)`, add:

```typescript
const profileData: ProfileData = {
  displayName: `${name} ${surname}`,
  dob: dob || null,
  gender: gender === 'Outro' ? otherGender || null : gender || null,
  city: null,
  state: null,
  photoURL: null,
  weightInKg: null,
  updatedAt: Date.now(),
};
await setDoc(doc(getDb(), 'users', userCredential.user.uid, 'data', 'profile'), profileData);
```

Add imports:
```typescript
import { getDb } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ProfileData } from '../types';
```

- [ ] **Build and verify**

```
npm run build
```

- [ ] **Commit**

```
git add src/components/Signup.tsx
git commit -m "feat: persist profile data to Firestore on signup"
```
