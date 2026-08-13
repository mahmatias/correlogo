# Integração Relógio Fitness (Health Connect + Cinta BLE) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Dar FC ao vivo na esteira via cinta cardíaca BLE (0x180D), análise de FC por treino com zonas Z1–Z5, e importar treinos gravados no relógio (Amazfit GTR 3) lendo o Health Connect.

**Architecture:** Dados puros e testáveis em `src/lib/hr-zones.ts`/`src/lib/hr-summary.ts` (cálculo de zonas) e `src/lib/watch-import.ts` (dedupe/mapeamento de import). Leitura HC nativa no `HealthConnectPlugin.kt` (READ) com fix de permissão na Camada 0. Cinta BLE em `HrBleService.kt`+`HrBlePlugin.kt` (espelho do padrão GATT estável do `TreadmillBleService`), transportes `hr-ble.ts` (Mock/Native) e hook `useHrBelt`. UI em `WorkoutTracker` (card FC + TTS por zona + gravação por ponto), `SessionSummary` (média/máx + tempo por zona + gráfico), `SessionHistory` (badge "Relógio" + import) e `UserProfile` (aba Insights).

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind v4, vitest, Firebase (Firestore), lucide-react, recharts (já no projeto), Capacitor, Android Health Connect SDK (`androidx.health.connect`), Kotlin BLE.

## Global Constraints

- Commits frequentes com `[skip ci]` no subject (repo usa CI firewall que gera release a partir de push em `main`).
- Baseline: `npm test` com todos os testes existentes PASS; `npm run lint` (= `tsc --noEmit`) com erros pré-existentes que **não devem aumentar**.
- Comandos: testes `npm test` (= `vitest run`), lint `npm run lint`, build `npm run build` (= `vite build`).
- **Nunca** copiar `.env.dev` para `.env`. Antes de `npm run build`: `Copy-Item -Path ".env.apk" -Destination ".env" -Force`.
- Antes de `gradlew`: `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"`.
- Sem deps novas (`crypto.randomUUID()` não é usado aqui; recharts e lucide-react já existem). **Não** instalar plugins.
- Não commitar `app-release-v*.apk` untracked na raiz nem `.env`.
- Spec: `docs/superpowers/specs/2026-08-13-relogio-fitness-integration-design.md`.
- **Ordem de implementação (decisão do usuário):** Camada 0 (fix permissão HC) → Camada 1 (leitura HC + import) → Camada 3 (zonas) → Camada 4 (Insights + badge) → Camada 2 (cinta BLE). Sequência contínua, sem pausa.
- **Desvio documentado (spec contraditória):** a Camada 1 da spec lista `readSleepSessions`/`readSleepFromHealthConnect`/`SleepSummary`, mas a tabela **Escopo** da própria spec marca Sono/HRV/prontidão como "❌ fase futura". A tabela Escopo prevalece — **não** implementar leitura de sono nesta build. (A decisão ficou para o usuário revisar.)
- **Correção de spec:** a spec diz "flags byte 0, bit 3 = RR intervals". No padrão Bluetooth SIG, RR-Interval é o bit 4 (0x10); além disso RR **não** está no escopo — o `HrBleService` parseia apenas BPM (8 ou 16-bit via bit 0) e ignora RR. Sem divergência funcional, apenas precisão de protocolo.
- **Desvio técnico (descoberto na Task 1):** no Capacitor 7.x o hook de activity result de baixo nível é `protected void handleOnActivityResult(int, int, Intent)` (deprecated) — **não existe** `Plugin.onActivityResult` para override. Além disso, o `Bridge.onActivityResult` roteia o resultado para o plugin via `getPluginWithRequestCode(requestCode)`, que só resolve request codes declarados em `@CapacitorPlugin(requestCodes=[...])`. Portanto a Task 1 usa: `requestCodes = [9301]` na annotation + `@Deprecated override fun handleOnActivityResult(...)` (com literal 9301 no body — Kotlin não resolve `const val` do companion dentro da annotation).
- **Desvio técnico (descoberto na Task 2):** no `androidx.health.connect:connect-client:1.1.0`, `AggregateRequest` fica em `androidx.health.connect.client.request.AggregateRequest` (o plano inicial dizia `.aggregate.AggregateRequest`, que não existe nessa versão). O import foi corrigido no código.
- Semântica de dados: `TrainingSession.source` é opcional (`'app' | 'watch'`, ausente = app) — backward-compatible, sem migração. `WatchWorkout` é um tipo novo somente de leitura.
- Kotlin: arquivos nativos permitidos são os do package `com/correlogo/app/` (plugin custom). `HrBleService.kt` e `HrBlePlugin.kt` são novos; `HealthConnectPlugin.kt`, `MainActivity.java` e `AndroidManifest.xml` são editados. Nada mais em `android/`.
- Validação nativa é build-time (`cap sync` + `gradlew assembleDebug`); testes de device (permissão HC real, cinta real) são responsabilidade do usuário após instalar o APK.

---

### Task 1: Camada 0 — Fix do fluxo de permissão do Health Connect

**Files:**
- Modify: `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt:86-113`

**Interfaces:**
- Produces: método `requestHcPermissions(call)` que (a) verifica `ensureClient()` antes de lançar o intent, (b) lança o intent via `activity.startActivityForResult(intent, HC_PERMISSION_REQUEST_CODE)` com callback em `onActivityResult` (em vez do launcher do Capacitor), e (c) tem fallback para a tela de racional de permissões do HC quando o intent falha. A Task 2 reutiliza o mesmo padrão para as permissões READ.

**Contexto do bug:** no device do usuário a tela de permissão do HC não abre. O código atual (linhas 86–104) chama `startActivityForResult(call, intent, ...)` do Capacitor sem try/catch e sem verificar `ensureClient()`; se o intent falhar silenciosamente (SDK do HC indisponível/device sem o app do HC), o `call` nunca resolve e o `hcLoading` do Perfil fica travado.

- [x] **Step 1: Editar o plugin — constantes e helper de lançamento**

Em `HealthConnectPlugin.kt`, adicione no companion object (após `private const val TAG`):

```kotlin
        private const val HC_PERMISSION_REQUEST_CODE = 9301
```

Adicione o campo pendente junto aos demais (após `private val permContract`):

```kotlin
    private var pendingPermissionCall: PluginCall? = null
```

- [x] **Step 2: Reescrever `requestHcPermissions`**

Substitua o corpo de `requestHcPermissions` (linhas 86–104) por:

```kotlin
    @PluginMethod
    fun requestHcPermissions(call: PluginCall) {
        val a = activity
        if (a == null || !ensureClient()) {
            Log.w(TAG, "requestHcPermissions: activity/sdk unavailable")
            call.resolve(JSObject().apply { put("granted", false) })
            return
        }

        val permissions = setOf(
            HealthPermission.getWritePermission(ExerciseSessionRecord::class),
            HealthPermission.getWritePermission(DistanceRecord::class)
        )
        launchPermissionIntent(a, call, permissions)
    }
```

- [x] **Step 3: Adicionar helper `launchPermissionIntent` + `onActivityResult` + fallback**

Adicione logo após `requestHcPermissions` (antes de `handleHcPermissionResult`):

```kotlin
    @Suppress("DEPRECATION")
    private fun launchPermissionIntent(a: android.app.Activity, call: PluginCall, permissions: Set<String>) {
        val intent = try {
            permContract.createIntent(a, permissions)
        } catch (e: Exception) {
            Log.e(TAG, "createIntent failed — falling back to HC rationale", e)
            openHcRationale(call)
            return
        }
        pendingPermissionCall = call
        a.runOnUiThread {
            try {
                Log.d(TAG, "Opening HC permissions page for package=${a.packageName}")
                a.startActivityForResult(intent, HC_PERMISSION_REQUEST_CODE)
            } catch (e: Exception) {
                Log.e(TAG, "startActivityForResult failed — falling back to HC rationale", e)
                pendingPermissionCall = null
                openHcRationale(call)
            }
        }
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != HC_PERMISSION_REQUEST_CODE) return
        val call = pendingPermissionCall ?: return
        pendingPermissionCall = null
        val grantedPerms = permContract.parseResult(resultCode, data)
        val writePerm = HealthPermission.getWritePermission(ExerciseSessionRecord::class)
        val granted = writePerm in grantedPerms
        Log.d(TAG, "Permission result: WRITE_EXERCISE granted=$granted (${grantedPerms.size} total)")
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    private fun openHcRationale(call: PluginCall) {
        try {
            val intent = Intent("androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE")
                .setPackage("com.google.android.apps.healthdata")
            activity?.startActivity(intent)
            Log.d(TAG, "Opened HC rationale as fallback")
        } catch (e: Exception) {
            Log.w(TAG, "No HC rationale activity available", e)
        }
        call.resolve(JSObject().apply { put("granted", false) })
    }
```

- [x] **Step 4: Remover o callback antigo**

Remova o método `@ActivityCallback fun handleHcPermissionResult(call, result)` (linhas 106–113) e o import de `androidx.activity.result.ActivityResult` se ficar sem uso (o import também era usado apenas por ele). Mantenha `startActivityForResult`? Não é mais usado — o import de `com.getcapacitor.annotation.ActivityCallback` também pode sair se nada mais o usar.

- [x] **Step 5: Validar build nativo**

```powershell
Copy-Item -Path ".env.apk" -Destination ".env" -Force
npm run build
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd android
gradlew assembleDebug
cd ..
```

Expected: build Vite sem erros; `[info] Found N Capacitor plugins for android`; `assembleDebug` OK (sem erros de Kotlin/import).

- [x] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt
git commit -m "fix(healthconnect): permission flow via direct startActivityForResult + HC rationale fallback [skip ci]"
```

> **Validação de device (usuário):** instalar o APK debug e tocar em Perfil → Conectar Health Connect. Deve abrir a tela de permissão do HC (ou a tela de racional como fallback). Se continuar falhando, anotar o `logcat` (`CorreLogo-HC`) e voltar para a Task 1.

---

### Task 2: Camada 1 — Leitura do Health Connect (READ)

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml` (novas permissões READ)
- Modify: `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt` (métodos READ)
- Modify: `src/lib/capacitor/health-connect.ts` (wrapper TS)
- Modify: `src/types.ts` (`WatchWorkout`, `TrainingSession.source`)

**Interfaces:**
- Consumes: `launchPermissionIntent`/`HC_PERMISSION_REQUEST_CODE` da Task 1, `permContract`, `ensureClient`.
- Produces:
  - Plugin Kotlin: `checkReadPermissions() → { granted: boolean }`, `requestReadPermissions() → { granted: boolean }`, `readWorkouts({ startMs, endMs }) → { workouts: WatchWorkout[] }`.
  - `WatchWorkout` (types.ts): `{ id: string; exerciseType: 'running' | 'treadmill'; startTimeMs: number; endTimeMs: number; durationSeconds: number; distanceKm: number }`.
  - `TrainingSession.source?: 'app' | 'watch'` (types.ts).
  - `readWorkoutsFromHealthConnect(startMs, endMs): Promise<WatchWorkout[]>`, `checkReadHealthPermissions(): Promise<boolean | null>`, `requestReadHealthPermission(): Promise<boolean>`.

- [x] **Step 1: AndroidManifest — permissões READ**

Em `AndroidManifest.xml`, logo após as permissões WRITE (linhas 93–94), adicione:

```xml
    <uses-permission android:name="android.permission.health.READ_EXERCISE" />
    <uses-permission android:name="android.permission.health.READ_HEART_RATE" />
    <uses-permission android:name="android.permission.health.READ_STEPS" />
    <uses-permission android:name="android.permission.health.READ_TOTAL_CALORIES_BURNED" />
    <uses-permission android:name="android.permission.health.READ_SLEEP" />
```

(Declaradas conforme a Camada 1 da spec; `READ_SLEEP` fica declarada mesmo com a leitura de sono adiada — ver Global Constraints.)

- [x] **Step 2: Plugin Kotlin — imports**

Em `HealthConnectPlugin.kt`, adicione aos imports:

```kotlin
import androidx.health.connect.client.aggregate.AggregateRequest
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Duration
import org.json.JSONArray
```

- [x] **Step 3: Plugin Kotlin — métodos READ**

Adicione ao final da classe `HealthConnectPlugin` (após `buildRoute`, antes do fecho `}`):

```kotlin
    private val readPermissionSet: Set<String> by lazy {
        setOf(
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)
        )
    }

    @PluginMethod
    fun checkReadPermissions(call: PluginCall) {
        if (!ensureClient()) {
            call.resolve(JSObject().apply { put("granted", false) })
            return
        }
        val c = client!!
        scope.launch {
            try {
                val granted = c.permissionController.getGrantedPermissions()
                val readPerm = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
                call.resolve(JSObject().apply { put("granted", readPerm in granted) })
            } catch (e: Exception) {
                Log.e(TAG, "checkReadPermissions error", e)
                call.resolve(JSObject().apply { put("granted", false) })
            }
        }
    }

    @PluginMethod
    fun requestReadPermissions(call: PluginCall) {
        val a = activity
        if (a == null || !ensureClient()) {
            call.resolve(JSObject().apply { put("granted", false) })
            return
        }
        launchPermissionIntent(a, call, readPermissionSet)
    }

    @PluginMethod
    fun readWorkouts(call: PluginCall) {
        val startMs = call.getLong("startMs") ?: 0L
        val endMs = call.getLong("endMs") ?: 0L
        if (!ensureClient()) {
            call.resolve(JSObject().apply { put("workouts", JSONArray()) })
            return
        }
        val c = client!!
        scope.launch {
            try {
                val request = ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(
                        Instant.ofEpochMilli(startMs),
                        Instant.ofEpochMilli(endMs)
                    )
                )
                val sessions = c.readRecords(request).records
                    .sortedByDescending { it.startTime }
                    .take(50)
                val workouts = JSONArray()
                for (s in sessions) {
                    val type = s.exerciseType
                    if (type != ExerciseSessionRecord.EXERCISE_TYPE_RUNNING &&
                        type != ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL
                    ) continue
                    val duration = Duration.between(s.startTime, s.endTime).seconds
                    val agg = c.aggregate(
                        AggregateRequest(
                            metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                            timeRangeFilter = TimeRangeFilter.between(s.startTime, s.endTime)
                        )
                    )
                    val distanceKm = (agg[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: 0.0) / 1000.0
                    val w = JSObject().apply {
                        put("id", s.metadata.id)
                        put(
                            "exerciseType",
                            if (type == ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL) "treadmill" else "running"
                        )
                        put("startTimeMs", s.startTime.toEpochMilli())
                        put("endTimeMs", s.endTime.toEpochMilli())
                        put("durationSeconds", duration)
                        put("distanceKm", distanceKm)
                    }
                    workouts.put(w)
                }
                Log.d(TAG, "readWorkouts: ${workouts.length()} workouts")
                call.resolve(JSObject().apply { put("workouts", workouts) })
            } catch (e: Exception) {
                Log.e(TAG, "readWorkouts error", e)
                call.reject("Read failed: ${e.message}")
            }
        }
    }
```

> `take(50)` evita leitura ilimitada (mesma regra de `limit(50)` do repo). `s.metadata.id` é o id estável do registro no HC — usado como chave de dedupe na Task 5.

- [x] **Step 4: types.ts — `WatchWorkout` e `TrainingSession.source`**

Em `src/types.ts`, adicione logo após a interface `ActivityPoint`:

```ts
export interface WatchWorkout {
  id: string;
  exerciseType: 'running' | 'treadmill';
  startTimeMs: number;
  endTimeMs: number;
  durationSeconds: number;
  distanceKm: number;
}
```

E dentro de `TrainingSession`, após `prResults?: PrResults;`:

```ts
  source?: 'app' | 'watch';
```

- [x] **Step 5: Wrapper TS — `health-connect.ts`**

Em `src/lib/capacitor/health-connect.ts`, atualize a interface do plugin e adicione as funções (mantendo as existentes):

```ts
import type { WatchWorkout } from '../../types';

interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  checkHcPermissions(): Promise<{ granted: boolean }>;
  requestHcPermissions(): Promise<{ granted: boolean }>;
  checkReadPermissions(): Promise<{ granted: boolean }>;
  requestReadPermissions(): Promise<{ granted: boolean }>;
  readWorkouts(options: { startMs: number; endMs: number }): Promise<{ workouts: WatchWorkout[] }>;
  exportWorkout(options: { workout: WorkoutExport }): Promise<{ success: boolean }>;
}
```

E ao final do arquivo:

```ts
export async function checkReadHealthPermissions(): Promise<boolean | null> {
  if (!isNative()) return null;
  try { return (await HealthConnect.checkReadPermissions()).granted; }
  catch { return null; }
}

export async function requestReadHealthPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await HealthConnect.requestReadPermissions()).granted; }
  catch { return false; }
}

export async function readWorkoutsFromHealthConnect(startMs: number, endMs: number): Promise<WatchWorkout[]> {
  if (!isNative()) return [];
  try {
    const available = await isHealthConnectAvailable();
    if (!available) return [];
    const res = await HealthConnect.readWorkouts({ startMs, endMs });
    return (res.workouts || []) as WatchWorkout[];
  } catch (e) {
    console.warn('[health-connect] readWorkouts failed:', e);
    return [];
  }
}
```

- [x] **Step 6: Validar lint + build nativo**

Run: `npm run lint`
Expected: SÓ os erros pré-existentes (0 novos).

```powershell
Copy-Item -Path ".env.apk" -Destination ".env" -Force
npm run build
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd android
gradlew assembleDebug
cd ..
```

Expected: build e APK OK.

- [x] **Step 7: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt src/lib/capacitor/health-connect.ts src/types.ts
git commit -m "feat(healthconnect): read workouts API with READ permissions [skip ci]"
```

---

### Task 3: Camada 3 — Zonas de FC (puro, TDD)

**Files:**
- Create: `src/lib/hr-zones.ts`
- Create: `src/lib/hr-summary.ts`
- Test: `src/lib/__tests__/hr-zones.test.ts`

**Interfaces:**
- Produces:
  - `estimateHrMax(dob: string | null): number | null` → `Math.round(208 - 0.7 * age)`; `null` sem `dob`/data inválida/idade ≤ 0.
  - `hrZone(hr: number, hrMax: number): 1 | 2 | 3 | 4 | 5 | null` — limites: Z1 50–60%, Z2 60–70%, Z3 70–80%, Z4 80–90%, Z5 90–100%; `< 50%` cai em Z1, `> 100%` em Z5; `null` para entradas não-finites/≤ 0.
  - `zoneLabel(zone: HrZone): string` (pt-BR), `zoneColor(zone: HrZone): string` (hex).
  - `computeHrSummary(points: ActivityPoint[], hrMax: number): HrSummary | null` — `{ avgHr, maxHr, minHr, samples, timeByZone: Record<1|2|3|4|5, number> }` (tempo em segundos, ponderado por delta de `timestampSeconds` entre amostras, delta clampado em 10s).

- [x] **Step 1: Escrever o teste (failing)**

Crie `src/lib/__tests__/hr-zones.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { estimateHrMax, hrZone, zoneLabel, zoneColor } from '../hr-zones';
import { computeHrSummary } from '../hr-summary';
import type { ActivityPoint } from '../../types';

function point(ts: number, hr?: number): ActivityPoint {
  return { timestampSeconds: ts, speedKmh: 10, distanceKm: 0, stepIndex: 0, heartRate: hr };
}

describe('estimateHrMax', () => {
  it('estima pela fórmula 208 - 0.7*idade', () => {
    // 1990-01-01 → 36 anos → 208 - 0.7*36 = 182.8 → 183
    expect(estimateHrMax('1990-01-01')).toBe(183);
  });
  it('retorna null sem dob', () => {
    expect(estimateHrMax(null)).toBeNull();
  });
  it('retorna null com data inválida', () => {
    expect(estimateHrMax('abc')).toBeNull();
  });
});

describe('hrZone', () => {
  it('mapeia as bordas exatas (hrMax=200)', () => {
    expect(hrZone(99, 200)).toBe(1);   // < 50%
    expect(hrZone(100, 200)).toBe(1);  // = 50% → Z1
    expect(hrZone(119, 200)).toBe(1);  // < 60%
    expect(hrZone(120, 200)).toBe(2);  // = 60% → Z2
    expect(hrZone(139, 200)).toBe(2);
    expect(hrZone(140, 200)).toBe(3);  // = 70% → Z3
    expect(hrZone(159, 200)).toBe(3);
    expect(hrZone(160, 200)).toBe(4);  // = 80% → Z4
    expect(hrZone(179, 200)).toBe(4);
    expect(hrZone(180, 200)).toBe(5);  // = 90% → Z5
    expect(hrZone(200, 200)).toBe(5);  // = 100%
  });
  it('retorna null para entradas inválidas', () => {
    expect(hrZone(0, 200)).toBeNull();
    expect(hrZone(150, 0)).toBeNull();
    expect(hrZone(NaN, 200)).toBeNull();
  });
});

describe('zoneLabel / zoneColor', () => {
  it('retorna label pt-BR e cor hex para cada zona', () => {
    expect(zoneLabel(1)).toBe('Zona 1 — Recuperação');
    expect(zoneLabel(5)).toBe('Zona 5 — Máximo');
    expect(zoneColor(4)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('computeHrSummary', () => {
  it('retorna null sem amostras válidas', () => {
    expect(computeHrSummary([point(0), point(1, 0), point(2, 255)], 200)).toBeNull();
  });
  it('calcula média/máx/mín e descarta sentinelas (0/255)', () => {
    const s = computeHrSummary([point(0, 150), point(1, 170), point(2, 0), point(3, 255), point(4, 130)], 200)!;
    expect(s.avgHr).toBe(150); // (150+170+130)/3
    expect(s.maxHr).toBe(170);
    expect(s.minHr).toBe(130);
    expect(s.samples).toBe(3);
  });
  it('distribui tempo por zona usando deltas', () => {
    // hrMax=200: 150→75%→Z3, 170→85%→Z4
    const s = computeHrSummary([point(0, 150), point(10, 150), point(20, 170), point(35, 170)], 200)!;
    expect(s.timeByZone[3]).toBeCloseTo(10, 6); // deltas 10 (ts0→10)
    expect(s.timeByZone[4]).toBeCloseTo(20, 6); // deltas 10 + 10 (ts10→20, ts20→35)
  });
  it('limita delta a 10s para não inflar pausas', () => {
    const s = computeHrSummary([point(0, 150), point(100, 150)], 200)!;
    expect(s.timeByZone[3]).toBeCloseTo(10, 6);
  });
});
```

- [x] **Step 2: Rodar o teste (verificar falha)**

Run: `npm test`
Expected: FAIL — `Cannot find module '../hr-zones'` / `../hr-summary`.

- [x] **Step 3: Implementação mínima**

Crie `src/lib/hr-zones.ts`:

```ts
export type HrZone = 1 | 2 | 3 | 4 | 5;

export function estimateHrMax(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  if (age <= 0) return null;
  return Math.round(208 - 0.7 * age);
}

export function hrZone(hr: number, hrMax: number): HrZone | null {
  if (!Number.isFinite(hr) || !Number.isFinite(hrMax) || hrMax <= 0 || hr <= 0) return null;
  const pct = (hr / hrMax) * 100;
  if (pct < 60) return 1;
  if (pct < 70) return 2;
  if (pct < 80) return 3;
  if (pct < 90) return 4;
  return 5;
}

export const ZONE_LABELS: Record<HrZone, string> = {
  1: 'Zona 1 — Recuperação',
  2: 'Zona 2 — Resistência',
  3: 'Zona 3 — Aeróbico',
  4: 'Zona 4 — Limiar',
  5: 'Zona 5 — Máximo',
};

export const ZONE_COLORS: Record<HrZone, string> = {
  1: '#3b82f6', // azul
  2: '#22c55e', // verde
  3: '#eab308', // amarelo
  4: '#f97316', // laranja
  5: '#ef4444', // vermelho
};

export function zoneLabel(zone: HrZone): string {
  return ZONE_LABELS[zone];
}

export function zoneColor(zone: HrZone): string {
  return ZONE_COLORS[zone];
}
```

Crie `src/lib/hr-summary.ts`:

```ts
import type { ActivityPoint } from '../types';
import { hrZone, type HrZone } from './hr-zones';

export interface HrSummary {
  avgHr: number;
  maxHr: number;
  minHr: number;
  samples: number;
  timeByZone: Record<HrZone, number>;
}

const VALID_MIN = 30;
const VALID_MAX = 240;
const MAX_DELTA_SECONDS = 10;

export function computeHrSummary(points: ActivityPoint[], hrMax: number): HrSummary | null {
  const samples: Array<{ ts: number; hr: number }> = [];
  for (const p of points) {
    if (p.heartRate && p.heartRate >= VALID_MIN && p.heartRate <= VALID_MAX) {
      samples.push({ ts: p.timestampSeconds, hr: p.heartRate });
    }
  }
  if (samples.length === 0) return null;

  const hrs = samples.map(s => s.hr);
  const avgHr = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
  const maxHr = Math.max(...hrs);
  const minHr = Math.min(...hrs);

  const timeByZone: Record<HrZone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let i = 1; i < samples.length; i++) {
    const delta = Math.min(samples[i].ts - samples[i - 1].ts, MAX_DELTA_SECONDS);
    if (delta <= 0) continue;
    const zone = hrZone(samples[i].hr, hrMax);
    if (zone) timeByZone[zone] += delta;
  }

  return { avgHr, maxHr, minHr, samples: samples.length, timeByZone };
}
```

- [x] **Step 4: Rodar os testes (verificar pass)**

Run: `npm test`
Expected: PASS (novos + baseline).

- [x] **Step 5: Commit**

```bash
git add src/lib/hr-zones.ts src/lib/hr-summary.ts src/lib/__tests__/hr-zones.test.ts
git commit -m "feat(hr-zones): hrMax estimate, zone mapping, labels/colors and hr summary [skip ci]"
```

---

### Task 4: Camada 4 — Bloco de FC no `SessionSummary`

**Files:**
- Modify: `src/components/SessionSummary.tsx` — imports (linha 1), cálculo após `estimatedKcal` (~51), JSX após o bloco "Variação de Pace" (~336, antes do bloco de Elevação).

**Interfaces:**
- Consumes: `estimateHrMax`, `computeHrSummary`, `zoneLabel`, `zoneColor` (de `../lib/hr-zones` / `../lib/hr-summary`), `profile?.dob` (já recebido via props), `session.points[].heartRate`.
- Produces: bloco "Frequência Cardíaca" renderizado **só** quando há amostras válidas de FC: média/máx/mín, gráfico de linha (recharts) FC × tempo, chips de tempo por zona.

- [x] **Step 1: Imports**

Em `src/components/SessionSummary.tsx`, adicione `Heart` ao import de `lucide-react` (linha 1):

```ts
import { MapPin, Clock, ArrowLeft, BarChart2, Table, Download, CheckCircle, XCircle, Share2, X, Trophy, Medal, Flame, Heart } from 'lucide-react';
```

E logo após o import de `../lib/calories` (linha 12):

```ts
import { estimateHrMax } from '../lib/hr-zones';
import { zoneColor, zoneLabel } from '../lib/hr-zones';
import { computeHrSummary } from '../lib/hr-summary';
```

- [x] **Step 2: Cálculo**

Após `const estimatedKcal = calculateKcal(session, weightKg);` (linha 51), adicione:

```ts
  const hrMax = estimateHrMax(profile?.dob ?? null);
  const hrSummary = hrMax ? computeHrSummary(session.points || [], hrMax) : null;
  const hrPoints = (session.points || [])
    .filter(p => p.heartRate)
    .map(p => ({ timeSeconds: p.timestampSeconds, heartRate: p.heartRate! }));
```

- [x] **Step 3: JSX do bloco de FC**

Encontre o fecho do bloco "Variação de Pace" (o `)}` na linha ~336) e insira **entre** ele e o bloco de Elevação (`{session.mode === 'outdoor' && ...`):

```tsx
        {hrSummary && (
            <div className="p-4 rounded-xl mb-6 bg-bg-surface">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Heart className="text-danger" size={18} /> Frequência Cardíaca
                </h3>
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-bg-elevated text-center">
                        <div className="text-[10px] text-text-muted uppercase">Média</div>
                        <div className="text-lg font-bold">{Math.round(hrSummary.avgHr)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-elevated text-center">
                        <div className="text-[10px] text-text-muted uppercase">Máx</div>
                        <div className="text-lg font-bold text-danger">{hrSummary.maxHr}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-elevated text-center">
                        <div className="text-[10px] text-text-muted uppercase">Mín</div>
                        <div className="text-lg font-bold">{hrSummary.minHr}</div>
                    </div>
                </div>
                {hrPoints.length > 1 && (
                    <div className="relative h-40 min-h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={hrPoints}>
                                <XAxis dataKey="timeSeconds" tickFormatter={(t) => {
                                    const minutes = Math.floor(t / 60);
                                    const seconds = Math.floor(t % 60);
                                    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                                }} />
                                <YAxis domain={['auto', 'auto']} tickFormatter={(v) => String(v)} />
                                <Tooltip labelFormatter={() => ''} formatter={(value: number) => [`${value} bpm`, 'FC']} />
                                <Line type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                    {([1, 2, 3, 4, 5] as const).map(z => {
                        const secs = hrSummary.timeByZone[z];
                        if (secs <= 0) return null;
                        return (
                            <span key={z} className="px-2 py-1 rounded-full text-xs font-medium bg-bg-elevated" style={{ color: zoneColor(z) }}>
                                {zoneLabel(z)} · {formatDuration(Math.round(secs))}
                            </span>
                        );
                    })}
                </div>
            </div>
        )}
```

- [x] **Step 4: Validar typecheck**

Run: `npm run lint`
Expected: SÓ os erros pré-existentes.

- [x] **Step 5: Commit**

```bash
git add src/components/SessionSummary.tsx
git commit -m "feat(summary): heart rate block with avg/max/min, chart and time by zone [skip ci]"
```

---

### Task 5: Camada 4 — Import de treinos do relógio (Histórico + badge)

**Files:**
- Create: `src/lib/watch-import.ts`
- Test: `src/lib/__tests__/health-connect-read.test.ts`
- Modify: `src/components/SessionHistory.tsx` — Props, header, badge, empty state
- Modify: `src/App.tsx` — imports, estado, handler, render do `SessionHistory`

**Interfaces:**
- Consumes: `WatchWorkout`, `TrainingSession.source` (Task 2), `readWorkoutsFromHealthConnect`, `checkReadHealthPermissions`, `requestReadHealthPermission` (Task 2), `Modal`/`Button`/`showFeedback`.
- Produces:
  - `dedupeImportedWorkouts(existing: TrainingSession[], workouts: WatchWorkout[]): WatchWorkout[]` — exclui por id (`watch-${w.id}`) e por horário de início ±2min contra `existing`.
  - `watchWorkoutToSession(w: WatchWorkout): TrainingSession` — id `watch-${w.id}`, `planId: 'watch-import'`, `planName: 'Treino do relógio'`, `mode: 'outdoor'`, `source: 'watch'`, `points: []`.
  - Props `onImportWorkouts?`/`importingWatch?` em `SessionHistory`; badge "Relógio" nas cards; handler `handleImportWatchWorkouts` em `App`.

- [x] **Step 1: Escrever o teste (failing)**

Crie `src/lib/__tests__/health-connect-read.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dedupeImportedWorkouts, watchWorkoutToSession } from '../watch-import';
import type { TrainingSession, WatchWorkout } from '../../types';

const wk = (over: Partial<WatchWorkout> = {}): WatchWorkout => ({
  id: 'hc-1', exerciseType: 'running', startTimeMs: 1_000_000, endTimeMs: 2_000_000,
  durationSeconds: 1000, distanceKm: 3.1, ...over,
});

const session = (over: Partial<TrainingSession> = {}): TrainingSession => ({
  id: 's1', planId: 'p1', planName: 'Treino', date: new Date(1_000_000).toISOString(),
  mode: 'outdoor', totalDurationSeconds: 1000, totalDistanceKm: 3.1,
  avgSpeedKmh: 10, completed: true, points: [], ...over,
});

describe('watchWorkoutToSession', () => {
  it('mapeia para TrainingSession outdoor com source watch', () => {
    const s = watchWorkoutToSession(wk({ id: 'abc' }));
    expect(s.id).toBe('watch-abc');
    expect(s.mode).toBe('outdoor');
    expect(s.source).toBe('watch');
    expect(s.planName).toBe('Treino do relógio');
    expect(s.planId).toBe('watch-import');
    expect(s.totalDistanceKm).toBe(3.1);
    expect(s.totalDurationSeconds).toBe(1000);
  });
});

describe('dedupeImportedWorkouts', () => {
  it('exclui treino já importado pelo id', () => {
    const existing = [session({ id: 'watch-hc-1' })];
    expect(dedupeImportedWorkouts(existing, [wk({ id: 'hc-1' })])).toHaveLength(0);
  });
  it('exclui por horário de início ±2min', () => {
    const existing = [session({ date: new Date(1_000_000 + 120_000).toISOString() })];
    expect(dedupeImportedWorkouts(existing, [wk()])).toHaveLength(0);

    const near = [session({ date: new Date(1_000_000 + 119_000).toISOString() })];
    expect(dedupeImportedWorkouts(near, [wk()])).toHaveLength(0);
  });
  it('mantém treino sem conflito', () => {
    const existing = [session({ date: new Date(999_999_999_999).toISOString() })];
    expect(dedupeImportedWorkouts(existing, [wk({ id: 'hc-9' })])).toHaveLength(1);
  });
});
```

- [x] **Step 2: Rodar o teste (verificar falha)**

Run: `npm test`
Expected: FAIL — `Cannot find module '../watch-import'`.

- [x] **Step 3: Implementação mínima**

Crie `src/lib/watch-import.ts`:

```ts
import type { TrainingSession, WatchWorkout } from '../types';

const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

export function dedupeImportedWorkouts(existing: TrainingSession[], workouts: WatchWorkout[]): WatchWorkout[] {
  return workouts.filter(w => {
    if (existing.some(s => s.id === `watch-${w.id}`)) return false;
    const wStart = w.startTimeMs;
    return !existing.some(s => {
      const sStart = new Date(s.date).getTime();
      return Math.abs(sStart - wStart) <= DEDUPE_WINDOW_MS;
    });
  });
}

export function watchWorkoutToSession(w: WatchWorkout): TrainingSession {
  const durationSeconds = w.durationSeconds;
  return {
    id: `watch-${w.id}`,
    planId: 'watch-import',
    planName: 'Treino do relógio',
    date: new Date(w.startTimeMs).toISOString(),
    mode: 'outdoor',
    totalDurationSeconds: durationSeconds,
    totalDistanceKm: w.distanceKm,
    avgSpeedKmh: durationSeconds > 0 ? w.distanceKm / (durationSeconds / 3600) : 0,
    completed: true,
    points: [],
    source: 'watch',
  };
}
```

- [x] **Step 4: Rodar os testes (verificar pass)**

Run: `npm test`
Expected: PASS.

- [x] **Step 5: `SessionHistory` — Props, header com import, badge, empty state**

Em `src/components/SessionHistory.tsx`:

(a) Adicione ao import da linha 1 os ícones e o helper:

```ts
import { Calendar, ClipboardList, Trash2, CheckCircle2, Mail, Play, AlertTriangle, Watch, RefreshCw } from 'lucide-react';
import { isNative } from '../lib/capacitor/platform';
```

(b) Adicione à interface `Props` (após `onExportSession`):

```ts
  onImportWorkouts?: () => void;
  importingWatch?: boolean;
```

E à assinatura (linha 32):

```ts
export default function SessionHistory({ sessions, onSelectSession, onDeleteSession, onExportSession, onImportWorkouts, importingWatch }: Props) {
```

(c) Substitua o cabeçalho (linha 48) por:

```tsx
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-center">Registros</h2>
            {isNative() && onImportWorkouts && (
                <button
                    onClick={onImportWorkouts}
                    disabled={importingWatch}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-sm font-bold disabled:opacity-50"
                >
                    <RefreshCw size={16} className={importingWatch ? 'animate-spin' : ''} />
                    Importar relógio
                </button>
            )}
        </div>
```

(d) Atualize o empty state (linhas 52–54):

```tsx
              <p>Nenhuma sessão encontrada.</p>
              <p className="text-sm mt-1">Complete um treino ou importe do seu relógio.</p>
```

(e) Adicione o badge "Relógio" na card. Na linha do `{session.planName}` (66), troque o `onClick` mantendo o texto e adicione o badge ao lado — substitua o bloco da linha 64–68 por:

```tsx
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold cursor-pointer hover:text-accent-secondary"
                          onClick={() => onSelectSession(session)}>{session.planName}</span>
                        <span className="flex items-center gap-2">
                          {session.source === 'watch' && (
                            <span className="text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-bg-elevated text-accent-secondary">
                              <Watch size={10} /> Relógio
                            </span>
                          )}
                          <span className="text-sm text-text-muted">{new Date(session.date).toLocaleDateString()}</span>
                        </span>
                      </div>
```

- [x] **Step 6: `App.tsx` — imports, estado, handler, props**

Em `src/App.tsx`:

(a) Adicione ao import de `./types` (linha 10) o tipo novo:

```ts
import { WorkoutPlan, formatDuration, formatTotalDuration, TrainingSession, getStepDurationSeconds, ActivityPoint, TrainingProgram, ProfileData, SettingsData, PrResults, WatchWorkout } from './types';
```

Adicione ao import de `./lib/capacitor/health-connect` (linha 37):

```ts
import { exportWorkoutToHealthConnect, readWorkoutsFromHealthConnect, checkReadHealthPermissions, requestReadHealthPermission } from './lib/capacitor/health-connect';
```

Adicione após o import de `./lib/records` (linha 31):

```ts
import { dedupeImportedWorkouts, watchWorkoutToSession } from './lib/watch-import';
```

(b) Adicione junto aos demais estados (após `activeTab`, linha 108):

```ts
  const [importingWatch, setImportingWatch] = useState(false);
```

(c) Adicione o handler após `handleProfileSaved` (linha 873):

```ts
  const handleImportWatchWorkouts = async () => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) {
      showFeedback('error', 'Importar do relógio só funciona no app Android.');
      return;
    }
    const granted = await checkReadHealthPermissions();
    if (granted === false) {
      const ok = await requestReadHealthPermission();
      if (!ok) {
        showFeedback('error', 'Permissão negada. Autorize o Health Connect no Perfil.');
        return;
      }
    }
    setImportingWatch(true);
    try {
      const now = Date.now();
      const workouts = await readWorkoutsFromHealthConnect(now - 30 * 24 * 60 * 60 * 1000, now);
      const toAdd = dedupeImportedWorkouts(sessions, workouts);
      if (toAdd.length === 0) {
        showFeedback('success', 'Nenhum treino novo para importar.');
        return;
      }
      const newSessions = toAdd.map(w => watchWorkoutToSession(w));
      const updated = [...newSessions, ...sessions];
      setSessions(updated);
      localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
      for (const s of newSessions) {
        setDoc(doc(getDb(), 'users', user.uid, 'sessions', s.id), stripUndefined(s)).catch(() => {});
      }
      showFeedback('success', `${toAdd.length} treino${toAdd.length > 1 ? 's' : ''} importado${toAdd.length > 1 ? 's' : ''} do relógio!`);
    } catch (e) {
      console.error('[import] Erro ao importar treinos:', e);
      showFeedback('error', 'Falha ao importar treinos do Health Connect.');
    } finally {
      setImportingWatch(false);
    }
  };
```

(d) Passe as props novas no render do `SessionHistory` (após `onExportSession`, linha 1516):

```tsx
                    onImportWorkouts={handleImportWatchWorkouts}
                    importingWatch={importingWatch}
```

- [x] **Step 7: Validar typecheck + testes**

Run: `npm test`
Expected: PASS.

Run: `npm run lint`
Expected: SÓ os erros pré-existentes.

- [x] **Step 8: Commit**

```bash
git add src/lib/watch-import.ts src/lib/__tests__/health-connect-read.test.ts src/components/SessionHistory.tsx src/App.tsx
git commit -m "feat(import): import watch workouts from Health Connect with dedupe and Relogio badge [skip ci]"
```

---

### Task 6: Camada 4 — Aba Insights no Perfil

**Files:**
- Modify: `src/components/UserProfile.tsx` — Props, imports, cálculo, JSX (entre "Conexões" e o card de atualização)
- Modify: `src/App.tsx` — passar `sessions` ao `UserProfile`

**Interfaces:**
- Consumes: `estimateHrMax`, `computeHrSummary` (Task 3), `TrainingSession` (types), recharts (já no projeto).
- Produces: prop `sessions: TrainingSession[]` em `UserProfileProps`; seção "Insights" com empty state, gráfico da última sessão com FC e lista das últimas 10 (média/máx por treino).

- [x] **Step 1: Imports**

Em `src/components/UserProfile.tsx`, adicione `Heart` ao import de `lucide-react` (linha 4):

```ts
import { ShieldCheck, ShieldOff, RefreshCw, Mail, Download, Bell, BellOff, Heart } from 'lucide-react';
```

Adicione após o import de `./lib/notifications` (linha 13):

```ts
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { estimateHrMax, zoneColor, zoneLabel } from '../lib/hr-zones';
import { computeHrSummary } from '../lib/hr-summary';
```

E adicione `TrainingSession` ao import de `../types` (linha 6):

```ts
import { ProfileData, SettingsData, BRAZILIAN_STATES, GENDER_OPTIONS, WorkoutPlan, TrainingSession } from '../types';
```

- [x] **Step 2: Props**

Adicione a `UserProfileProps` (após `plans: WorkoutPlan[];`):

```ts
  sessions: TrainingSession[];
```

E à assinatura (após `plans,`):

```ts
  sessions,
```

- [x] **Step 3: Cálculo**

Adicione após `const remindersEnabled = ...` (linha 56):

```ts
  const hrMaxInsights = estimateHrMax(initialProfile?.dob ?? null);
  const sessionsWithHr = (sessions || [])
    .filter(s => (s.points || []).some(p => p.heartRate))
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastHrSession = sessionsWithHr[0] ?? null;
  const lastHrSummary = lastHrSession && hrMaxInsights ? computeHrSummary(lastHrSession.points, hrMaxInsights) : null;
  const lastHrPoints = lastHrSession
    ? lastHrSession.points.filter(p => p.heartRate).map(p => ({ timeSeconds: p.timestampSeconds, heartRate: p.heartRate! }))
    : [];
```

- [x] **Step 4: JSX da seção Insights**

Encontre o fecho do bloco "Conexões" (o `</div>` após o card do Health Connect, ~linha 432) e insira **entre** ele e o card "Atualização do app" (linha 434):

```tsx
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-secondary mb-2">Insights</h3>
        <div className="p-3 rounded-lg border border-border">
          {sessionsWithHr.length === 0 ? (
            <div className="text-center py-6 text-text-muted">
              <Heart size={28} className="mx-auto mb-2 opacity-60" />
              <p className="text-sm">Ainda sem dados de frequência cardíaca.</p>
              <p className="text-xs mt-1">Conecte sua cinta cardíaca no treino ou importe treinos do relógio.</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-text-primary mb-2">
                Última sessão com FC: <strong>{lastHrSession?.planName}</strong>
                {lastHrSummary && (
                  <span className="text-text-muted ml-2">
                    média {Math.round(lastHrSummary.avgHr)} · máx {lastHrSummary.maxHr} bpm
                  </span>
                )}
              </div>
              {lastHrPoints.length > 1 && (
                <div className="relative h-32 min-h-[128px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lastHrPoints}>
                      <XAxis dataKey="timeSeconds" tick={false} />
                      <YAxis domain={['auto', 'auto']} tickFormatter={(v) => String(v)} width={28} />
                      <Tooltip formatter={(value: number) => [`${value} bpm`, 'FC']} labelFormatter={() => ''} />
                      <Line type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {lastHrSummary && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {([1, 2, 3, 4, 5] as const).map(z => {
                    const secs = lastHrSummary!.timeByZone[z];
                    if (secs <= 0) return null;
                    return (
                      <span key={z} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-bg-elevated" style={{ color: zoneColor(z) }}>
                        {zoneLabel(z)}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 space-y-1">
                {sessionsWithHr.slice(0, 10).map(s => {
                  const sum = hrMaxInsights ? computeHrSummary(s.points, hrMaxInsights) : null;
                  return (
                    <div key={s.id} className="flex justify-between items-center text-xs">
                      <span className="text-text-primary">{new Date(s.date).toLocaleDateString()} · {s.planName}</span>
                      <span className="text-text-muted">{sum ? `${Math.round(sum.avgHr)} / ${sum.maxHr} bpm` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
```

- [x] **Step 5: `App.tsx` — passar `sessions`**

No render do `UserProfile` (linha 1588), adicione após `plans={plans}`:

```tsx
                    sessions={sessions}
```

- [x] **Step 6: Validar typecheck**

Run: `npm run lint`
Expected: SÓ os erros pré-existentes.

- [x] **Step 7: Commit**

```bash
git add src/components/UserProfile.tsx src/App.tsx
git commit -m "feat(profile): Insights tab with last HR chart and per-workout avg/max [skip ci]"
```

---

### Task 7: Camada 2 — Cinta cardíaca BLE (0x180D)

**Files:**
- Create: `android/app/src/main/java/com/correlogo/app/HrBleService.kt`
- Create: `android/app/src/main/java/com/correlogo/app/HrBlePlugin.kt`
- Modify: `android/app/src/main/java/com/correlogo/app/MainActivity.java:14-20`
- Create: `src/lib/hr-ble.ts`
- Create: `src/lib/use-hr-belt.ts`
- Test: `src/lib/__tests__/hr-ble.test.ts`
- Modify: `src/components/WorkoutTracker.tsx` (card FC, TTS por zona, gravação por ponto)
- Modify: `src/App.tsx` (`useHrBelt` + props `profile`/`hrBelt`)

**Interfaces:**
- Produces (Kotlin):
  - `HrBleService(context)` — `state: HrState (Disconnected/Connecting/Ready)`, `startScan(onDeviceFound)`, `connect(address)`, `disconnect()`; callbacks `onSample(bpm: Int, timestamp: Long)`, `onStateChange`, `onDisconnect`, `onError`.
  - `HrBlePlugin` — `initHr()`, `startHrScan()`, `connectHr({ address })`, `disconnectHr()`, `requestHrBlePermissions()`, eventos `hrSample`/`hrScanResult`/`hrState`/`hrError`.
- Produces (TS):
  - `HrSample { bpm, timestamp }`, `HrDevice { name, address }`, `HrBleTransport { scan, connect, disconnect, onSample, onDisconnect, onError }`, `MockHrTransport`, `NativeHrTransport`, `createHrTransport()`.
  - `useHrBelt(): HrBeltConnection` = `{ state: 'DISCONNECTED'|'SCANNING'|'CONNECTING'|'CONNECTED', connected, devices, bpm, error, scan, connect, disconnect }`.
- Consumes: `WorkoutTracker` ganha props `profile?: ProfileData | null` e `hrBelt: HrBeltConnection`; grava `ActivityPoint.heartRate` em todos os pontos.

- [x] **Step 1: Escrever o teste (failing) — transporte mock**

Crie `src/lib/__tests__/hr-ble.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { MockHrTransport } from '../hr-ble';

describe('MockHrTransport', () => {
  it('emite uma cinta durante o scan', async () => {
    const t = new MockHrTransport();
    const device = await new Promise<any>(resolve => t.scan(d => resolve(d)));
    expect(device.name).toContain('Cinta Simulada');
    expect(device.address).toBe('00:11:22:33:44:66');
  });

  it('emite amostras com bpm válido após connect', async () => {
    const t = new MockHrTransport();
    const sample = await new Promise<any>(resolve => {
      t.onSample(s => resolve(s));
      t.connect('00:11:22:33:44:66');
    });
    expect(sample.bpm).toBeGreaterThan(0);
    expect(sample.bpm).toBeLessThan(240);
    expect(typeof sample.timestamp).toBe('number');
  });

  it('dispara listeners de disconnect', async () => {
    const t = new MockHrTransport();
    await t.connect('00:11:22:33:44:66');
    const spy = vi.fn();
    t.onDisconnect(spy);
    await t.disconnect();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('cleanup remove listeners', () => {
    const t = new MockHrTransport();
    const spy = vi.fn();
    const cleanup = t.onSample(spy);
    cleanup();
    expect((t as any).sampleListeners.length).toBe(0);
  });
});
```

- [x] **Step 2: Rodar o teste (verificar falha)**

Run: `npm test`
Expected: FAIL — `Cannot find module '../hr-ble'`.

- [x] **Step 3: Implementação TS — `hr-ble.ts`**

Crie `src/lib/hr-ble.ts`:

```ts
import { registerPlugin } from '@capacitor/core';
import { isNative } from './capacitor/platform';

export interface HrSample {
  bpm: number;
  timestamp: number;
}

export interface HrDevice {
  name: string;
  address: string;
}

export interface HrBleTransport {
  scan(onDevice: (device: HrDevice) => void): Promise<void>;
  connect(address: string): Promise<void>;
  disconnect(): Promise<void>;
  onSample(cb: (sample: HrSample) => void): () => void;
  onDisconnect(cb: () => void): () => void;
  onError(cb: (error: string) => void): () => void;
}

interface HrBlePlugin {
  initHr(): Promise<void>;
  startHrScan(): Promise<void>;
  connectHr(options: { address: string }): Promise<void>;
  disconnectHr(): Promise<void>;
  requestHrBlePermissions(): Promise<{ bluetooth: string }>;
  addListener(eventName: string, callback: (data: any) => void): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

const HrPlugin = registerPlugin<HrBlePlugin>('HrBle');

export class MockHrTransport implements HrBleTransport {
  private sampleListeners: Array<(s: HrSample) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  private errorListeners: Array<(msg: string) => void> = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private bpm = 115;

  async scan(onDevice: (device: HrDevice) => void): Promise<void> {
    setTimeout(() => onDevice({ name: 'Cinta Simulada (HR)', address: '00:11:22:33:44:66' }), 100);
  }

  async connect(_address: string): Promise<void> {
    this.interval = setInterval(() => {
      this.bpm = Math.max(90, Math.min(165, this.bpm + Math.floor(Math.random() * 5) - 2));
      const sample: HrSample = { bpm: this.bpm, timestamp: Date.now() };
      this.sampleListeners.forEach(cb => cb(sample));
    }, 1000);
  }

  async disconnect(): Promise<void> {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    this.disconnectListeners.forEach(cb => cb());
  }

  onSample(cb: (s: HrSample) => void): () => void {
    this.sampleListeners.push(cb);
    return () => { this.sampleListeners = this.sampleListeners.filter(l => l !== cb); };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => { this.disconnectListeners = this.disconnectListeners.filter(l => l !== cb); };
  }

  onError(cb: (msg: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => { this.errorListeners = this.errorListeners.filter(l => l !== cb); };
  }
}

export class NativeHrTransport implements HrBleTransport {
  private sampleListeners: Array<(s: HrSample) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  private errorListeners: Array<(msg: string) => void> = [];
  private activeListeners: Array<{ remove: () => void }> = [];
  private initPromise: Promise<void> | null = null;
  private destroyed = false;

  private init(): Promise<void> {
    if (!isNative()) {
      this.fireError('BLE not available on this platform');
      return Promise.resolve();
    }
    if (!this.initPromise) {
      this.initPromise = HrPlugin.initHr().catch((err: any) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  private async ensureInitialized(): Promise<void> {
    if (!isNative()) throw new Error('BLE not available on this platform');
    await this.init();
    this.setupGlobalListeners();
  }

  async scan(onDevice: (device: HrDevice) => void): Promise<void> {
    await this.ensureInitialized();

    const scanHandle = await HrPlugin.addListener('hrScanResult', (d: any) => {
      if (d.name && d.address) onDevice({ name: d.name, address: d.address });
    });
    const errorHandle = await HrPlugin.addListener('hrError', (d: any) => {
      this.fireError(d.message || 'Erro BLE');
    });

    try {
      await HrPlugin.startHrScan();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Permissão')) {
        const perm = await HrPlugin.requestHrBlePermissions().catch(() => ({ bluetooth: 'denied' }));
        if (perm.bluetooth === 'granted') {
          await HrPlugin.startHrScan();
          return;
        }
      }
      scanHandle.remove();
      errorHandle.remove();
      this.fireError(msg);
      throw err;
    }
  }

  async connect(address: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout de conexão'));
      }, 30000);

      let stateHandle: { remove: () => void } | null = null;
      let errorHandle: { remove: () => void } | null = null;

      const cleanup = () => {
        clearTimeout(timeout);
        stateHandle?.remove();
        errorHandle?.remove();
      };

      HrPlugin.addListener('hrState', (d: any) => {
        if (d.state === 'CONNECTED') {
          cleanup();
          resolve();
        } else if (d.state === 'DISCONNECTED') {
          cleanup();
          reject(new Error('Conexão falhou'));
        }
      }).then(h => { stateHandle = h; });

      HrPlugin.addListener('hrError', (d: any) => {
        cleanup();
        reject(new Error(d.message || 'Erro na conexão'));
      }).then(h => { errorHandle = h; });

      HrPlugin.connectHr({ address }).catch((err: any) => {
        cleanup();
        reject(err);
      });
    });
  }

  async disconnect(): Promise<void> {
    this.destroyed = true;
    this.sampleListeners = [];
    this.disconnectListeners = [];
    this.errorListeners = [];
    try {
      await HrPlugin.removeAllListeners();
      await HrPlugin.disconnectHr();
    } catch {}
  }

  onSample(cb: (s: HrSample) => void): () => void {
    this.sampleListeners.push(cb);
    return () => { this.sampleListeners = this.sampleListeners.filter(l => l !== cb); };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => { this.disconnectListeners = this.disconnectListeners.filter(l => l !== cb); };
  }

  onError(cb: (msg: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => { this.errorListeners = this.errorListeners.filter(l => l !== cb); };
  }

  private setupGlobalListeners(): void {
    if (this.destroyed || this.activeListeners.length > 0) return;

    HrPlugin.addListener('hrSample', (d: any) => {
      const bpm = Number(d.bpm);
      const timestamp = Number(d.timestamp);
      if (Number.isFinite(bpm) && bpm > 0) {
        this.sampleListeners.forEach(cb => cb({ bpm, timestamp }));
      }
    }).then(h => this.activeListeners.push(h));

    HrPlugin.addListener('hrState', (d: any) => {
      if (d.state === 'DISCONNECTED') {
        this.disconnectListeners.forEach(cb => cb());
      }
    }).then(h => this.activeListeners.push(h));

    HrPlugin.addListener('hrError', (d: any) => {
      this.fireError(d.message || 'Erro BLE');
    }).then(h => this.activeListeners.push(h));
  }

  private fireError(msg: string): void {
    this.errorListeners.forEach(cb => cb(msg));
  }
}

export function createHrTransport(): HrBleTransport {
  return isNative() ? new NativeHrTransport() : new MockHrTransport();
}
```

- [x] **Step 4: Implementação TS — hook `useHrBelt`**

Crie `src/lib/use-hr-belt.ts`:

```ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { HrBleTransport, HrDevice, HrSample } from './hr-ble';
import { createHrTransport } from './hr-ble';

export type HrBeltState = 'DISCONNECTED' | 'SCANNING' | 'CONNECTING' | 'CONNECTED';

export interface HrBeltConnection {
  state: HrBeltState;
  connected: boolean;
  devices: HrDevice[];
  bpm: number | null;
  error: string | null;
  scan: () => Promise<void>;
  connect: (address: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useHrBelt(): HrBeltConnection {
  const [state, setState] = useState<HrBeltState>('DISCONNECTED');
  const [devices, setDevices] = useState<HrDevice[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const transportRef = useRef<HrBleTransport | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);

  const ensureTransport = useCallback(() => {
    if (transportRef.current) return transportRef.current;
    const transport = createHrTransport();
    transportRef.current = transport;
    const c1 = transport.onSample((s: HrSample) => setBpm(s.bpm));
    const c2 = transport.onDisconnect(() => {
      setState('DISCONNECTED');
      setBpm(null);
    });
    const c3 = transport.onError((msg) => setError(msg));
    cleanupsRef.current = [c1, c2, c3];
    return transport;
  }, []);

  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearScanTimeout = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearScanTimeout();
    transportRef.current?.disconnect();
    cleanupsRef.current.forEach(fn => fn());
  }, [clearScanTimeout]);

  const scan = useCallback(async () => {
    setDevices([]);
    setError(null);
    setState('SCANNING');
    clearScanTimeout();
    scanTimeoutRef.current = setTimeout(() => setState('DISCONNECTED'), 16000);
    try {
      await ensureTransport().scan((device) => {
        setDevices(prev => {
          if (prev.find(d => d.address === device.address)) return prev;
          return [...prev, device];
        });
      });
    } catch (err: any) {
      clearScanTimeout();
      setError(err.message);
      setState('DISCONNECTED');
    }
  }, [ensureTransport, clearScanTimeout]);

  const connect = useCallback(async (address: string) => {
    clearScanTimeout();
    setError(null);
    setState('CONNECTING');
    try {
      await ensureTransport().connect(address);
      setState('CONNECTED');
    } catch (err: any) {
      setError(err.message);
      setState('DISCONNECTED');
    }
  }, [ensureTransport, clearScanTimeout]);

  const disconnect = useCallback(async () => {
    clearScanTimeout();
    await ensureTransport().disconnect();
    setState('DISCONNECTED');
    setDevices([]);
    setBpm(null);
    setError(null);
  }, [ensureTransport, clearScanTimeout]);

  return {
    state,
    connected: state === 'CONNECTED',
    devices,
    bpm,
    error,
    scan,
    connect,
    disconnect,
  };
}
```

- [x] **Step 5: Rodar os testes (verificar pass)**

Run: `npm test`
Expected: PASS (novos + baseline).

- [x] **Step 6: Kotlin — `HrBleService.kt`**

Crie `android/app/src/main/java/com/correlogo/app/HrBleService.kt`:

```kotlin
package com.correlogo.app

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.UUID
import kotlinx.coroutines.*

class HrBleService(private val context: Context) {

    companion object {
        private const val TAG = "CorreLogo-HR"
        val HR_SERVICE_UUID: UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        val HR_MEASUREMENT_CHAR: UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        val CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private const val VALID_MIN_BPM = 30
        private const val VALID_MAX_BPM = 240
    }

    sealed class HrState {
        object Disconnected : HrState()
        object Connecting : HrState()
        object Ready : HrState()
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var gatt: BluetoothGatt? = null
    private var hrChar: BluetoothGattCharacteristic? = null
    private var _state: HrState = HrState.Disconnected
    val state: HrState get() = _state
    private val handler = Handler(Looper.getMainLooper())
    private var connectionTimeoutRunnable: Runnable? = null
    private var discoveryTimeoutRunnable: Runnable? = null

    var onSample: ((bpm: Int, timestamp: Long) -> Unit)? = null
    var onStateChange: ((HrState) -> Unit)? = null
    var onDisconnect: (() -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    connectionTimeoutRunnable?.let { handler.removeCallbacks(it) }
                    connectionTimeoutRunnable = null
                    _state = HrState.Connecting
                    onStateChange?.invoke(state)
                    handler.post { gatt.discoverServices() }
                    discoveryTimeoutRunnable = Runnable {
                        if (state is HrState.Connecting) {
                            Log.e(TAG, "Service discovery timeout (5s)")
                            onError?.invoke("Falha ao descobrir serviços após 5s")
                            cleanup()
                        }
                    }
                    handler.postDelayed(discoveryTimeoutRunnable!!, 5000)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    Log.d(TAG, "HR device disconnected")
                    cleanup()
                    onDisconnect?.invoke()
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            discoveryTimeoutRunnable?.let { handler.removeCallbacks(it) }
            discoveryTimeoutRunnable = null

            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.e(TAG, "Service discovery failed: $status")
                onError?.invoke("Service discovery failed")
                gatt.disconnect()
                return
            }
            val service = gatt.getService(HR_SERVICE_UUID) ?: run {
                Log.e(TAG, "Heart Rate service not found")
                onError?.invoke("Heart Rate service not found on device")
                gatt.disconnect()
                return
            }
            val char = service.getCharacteristic(HR_MEASUREMENT_CHAR) ?: run {
                Log.e(TAG, "Heart Rate Measurement characteristic not found")
                onError?.invoke("Heart Rate Measurement characteristic not found")
                gatt.disconnect()
                return
            }
            hrChar = char
            gatt.setCharacteristicNotification(char, true)
            val desc = char.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_DESCRIPTOR)
            desc?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            handler.postDelayed({ desc?.let { gatt.writeDescriptor(it) } }, 100)
        }

        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.w(TAG, "Descriptor write failed: $status")
                onError?.invoke("Notification enable failed")
                return
            }
            _state = HrState.Ready
            onStateChange?.invoke(state)
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
        ) {
            if (characteristic.uuid != HR_MEASUREMENT_CHAR) return
            val bpm = parseHeartRate(value) ?: return
            onSample?.invoke(bpm, System.currentTimeMillis())
        }
    }

    private fun parseHeartRate(value: ByteArray): Int? {
        if (value.isEmpty()) return null
        val flags = value[0].toInt() and 0xFF
        var offset = 1
        val is16Bit = (flags and 0x01) != 0
        val bpm = if (is16Bit) {
            if (value.size < offset + 2) return null
            (value[offset].toInt() and 0xFF) or ((value[offset + 1].toInt() and 0xFF) shl 8)
        } else {
            if (value.size < offset + 1) return null
            value[offset].toInt() and 0xFF
        }
        if (bpm < VALID_MIN_BPM || bpm > VALID_MAX_BPM) return null
        return bpm
    }

    fun startScan(onDeviceFound: (name: String, address: String) -> Unit) {
        scope.launch {
            try {
                val adapter = BluetoothAdapter.getDefaultAdapter()
                if (adapter == null || !adapter.isEnabled) {
                    onError?.invoke("Bluetooth not enabled")
                    return@launch
                }
                val leScanner = adapter.bluetoothLeScanner ?: run {
                    onError?.invoke("BLE not supported")
                    return@launch
                }
                val scanCallback = object : android.bluetooth.le.ScanCallback() {
                    override fun onScanResult(callbackType: Int, result: android.bluetooth.le.ScanResult?) {
                        val device = result?.device ?: return
                        val name = device.name ?: return
                        if (name.isNotEmpty()) {
                            onDeviceFound(name, device.address)
                        }
                    }
                    override fun onScanFailed(errorCode: Int) {
                        onError?.invoke("Scan failed: $errorCode")
                    }
                }
                val scanSettings = android.bluetooth.le.ScanSettings.Builder()
                    .setScanMode(android.bluetooth.le.ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build()
                val scanFilter = android.bluetooth.le.ScanFilter.Builder()
                    .setServiceUuid(android.os.ParcelUuid(HR_SERVICE_UUID))
                    .build()
                leScanner.startScan(listOf(scanFilter), scanSettings, scanCallback)
                delay(15000)
                leScanner.stopScan(scanCallback)
            } catch (e: Exception) {
                Log.e(TAG, "Scan error", e)
                onError?.invoke("Scan error: ${e.message}")
            }
        }
    }

    fun connect(address: String) {
        if (state !is HrState.Disconnected) {
            Log.w(TAG, "Already connecting/connected")
            return
        }
        _state = HrState.Connecting
        onStateChange?.invoke(state)

        val device = BluetoothAdapter.getDefaultAdapter()?.getRemoteDevice(address) ?: run {
            onError?.invoke("Device not found: $address")
            _state = HrState.Disconnected
            onStateChange?.invoke(state)
            return
        }

        connectionTimeoutRunnable = Runnable {
            if (state is HrState.Connecting) {
                Log.e(TAG, "Connection timeout (10s)")
                onError?.invoke("Conexão expirada após 10s")
                cleanup()
            }
        }
        handler.postDelayed(connectionTimeoutRunnable!!, 10000)

        gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    fun disconnect() {
        connectionTimeoutRunnable?.let { handler.removeCallbacks(it) }
        connectionTimeoutRunnable = null
        discoveryTimeoutRunnable?.let { handler.removeCallbacks(it) }
        discoveryTimeoutRunnable = null
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        hrChar = null
        _state = HrState.Disconnected
        onStateChange?.invoke(state)
    }

    private fun cleanup() {
        connectionTimeoutRunnable?.let { handler.removeCallbacks(it) }
        connectionTimeoutRunnable = null
        discoveryTimeoutRunnable?.let { handler.removeCallbacks(it) }
        discoveryTimeoutRunnable = null
        gatt?.close()
        gatt = null
        hrChar = null
        _state = HrState.Disconnected
        onStateChange?.invoke(state)
    }
}
```

- [x] **Step 7: Kotlin — `HrBlePlugin.kt`**

Crie `android/app/src/main/java/com/correlogo/app/HrBlePlugin.kt`:

```kotlin
package com.correlogo.app

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission

@CapacitorPlugin(
    name = "HrBle",
    permissions = [
        Permission(
            strings = [
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ],
            alias = "bluetooth",
        ),
    ],
)
class HrBlePlugin : Plugin() {

    companion object {
        private const val TAG = "CorreLogo-HR-Plugin"
        private const val BLE_PERMISSION_REQUEST_CODE = 9202
    }

    private var hrService: HrBleService? = null
    private var pendingBlePermCall: PluginCall? = null

    override fun load() {
        super.load()
        Log.d(TAG, "HrBlePlugin loaded")
    }

    private fun ensureService(): HrBleService? {
        if (hrService != null) return hrService
        val ctx = context ?: return null
        hrService = HrBleService(ctx).also { service ->
            service.onSample = { bpm, ts ->
                notifyListeners("hrSample", JSObject().apply { put("bpm", bpm); put("timestamp", ts) })
            }
            service.onStateChange = { state ->
                val stateStr = when (state) {
                    is HrBleService.HrState.Disconnected -> "DISCONNECTED"
                    is HrBleService.HrState.Connecting -> "CONNECTING"
                    is HrBleService.HrState.Ready -> "CONNECTED"
                }
                notifyListeners("hrState", JSObject().apply { put("state", stateStr) })
            }
            service.onDisconnect = {
                notifyListeners("hrState", JSObject().apply { put("state", "DISCONNECTED") })
            }
            service.onError = { msg ->
                notifyListeners("hrError", JSObject().apply { put("message", msg) })
            }
        }
        return hrService
    }

    @PluginMethod
    fun initHr(call: PluginCall) {
        try {
            val adapter = BluetoothAdapter.getDefaultAdapter()
            if (adapter == null) {
                call.reject("Bluetooth not supported")
                return
            }
            if (!adapter.isEnabled) {
                val enableBtIntent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
                startActivityForResult(call, enableBtIntent, "handleBtEnableResult")
                return
            }
            ensureService()
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "initHr error", e)
            call.reject("Init failed: ${e.message}")
        }
    }

    @PluginMethod
    fun startHrScan(call: PluginCall) {
        if (!checkBlePermissions()) {
            call.reject("Permissão Bluetooth não concedida")
            return
        }
        val service = ensureService() ?: run {
            call.reject("Service not initialized")
            return
        }
        try {
            service.startScan { name, address ->
                notifyListeners("hrScanResult", JSObject().apply { put("name", name); put("address", address) })
            }
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "startHrScan error", e)
            call.reject("Scan failed: ${e.message}")
        }
    }

    @PluginMethod
    fun connectHr(call: PluginCall) {
        val address = call.getString("address") ?: run {
            call.reject("address required")
            return
        }
        val service = ensureService() ?: run {
            call.reject("Service not initialized")
            return
        }
        try {
            service.connect(address)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "connectHr error", e)
            call.reject("Connect failed: ${e.message}")
        }
    }

    @PluginMethod
    fun disconnectHr(call: PluginCall) {
        val service = hrService ?: run {
            call.resolve()
            return
        }
        service.disconnect()
        call.resolve()
    }

    @PluginMethod
    fun requestHrBlePermissions(call: PluginCall) {
        val ctx = context ?: run { call.reject("No context"); return }
        val toRequest = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val scan = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN)
            val connect = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)
            if (scan != PackageManager.PERMISSION_GRANTED) toRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            if (connect != PackageManager.PERMISSION_GRANTED) toRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            val location = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
            if (location != PackageManager.PERMISSION_GRANTED) toRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (toRequest.isEmpty()) {
            call.resolve(JSObject().apply { put("bluetooth", "granted") })
            return
        }
        pendingBlePermCall = call
        pluginRequestPermissions(toRequest.toTypedArray(), BLE_PERMISSION_REQUEST_CODE)
    }

    @Suppress("DEPRECATION")
    override fun handleRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != BLE_PERMISSION_REQUEST_CODE) return
        val call = pendingBlePermCall ?: return
        pendingBlePermCall = null
        call.resolve(JSObject().apply { put("bluetooth", if (checkBlePermissions()) "granted" else "denied") })
    }

    @ActivityCallback
    fun handleBtEnableResult(call: PluginCall, result: androidx.activity.result.ActivityResult) {
        if (result.resultCode == android.app.Activity.RESULT_OK) {
            ensureService()
            call.resolve()
        } else {
            call.reject("Bluetooth not enabled")
        }
    }

    private fun checkBlePermissions(): Boolean {
        val ctx = context ?: return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val scan = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN)
            val connect = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)
            return scan == PackageManager.PERMISSION_GRANTED && connect == PackageManager.PERMISSION_GRANTED
        } else {
            val location = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
            return location == PackageManager.PERMISSION_GRANTED
        }
    }
}
```

- [x] **Step 8: Kotlin — registrar no `MainActivity`**

Em `MainActivity.java`, após a linha 18 (`registerPlugin(TreadmillBlePlugin.class);`), adicione:

```java
        registerPlugin(HrBlePlugin.class);
```

- [x] **Step 9: Validar build nativo**

```powershell
Copy-Item -Path ".env.apk" -Destination ".env" -Force
npm run build
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd android
gradlew assembleDebug
cd ..
```

Expected: build Vite sem erros; `[info] Found N Capacitor plugins for android` (os plugins custom continuam os mesmos); `assembleDebug` OK.

- [x] **Step 10: `WorkoutTracker` — card FC + TTS por zona + gravação por ponto**

Em `src/components/WorkoutTracker.tsx`:

(a) Imports — adicione após o import de `TreadmillConnection` (linha 12):

```ts
import type { HrBeltConnection } from '../lib/use-hr-belt';
import { estimateHrMax, hrZone, zoneColor, zoneLabel, type HrZone } from '../lib/hr-zones';
import type { ProfileData } from '../types';
import { Heart, RefreshCw } from 'lucide-react';
```

E no import de `lucide-react` (linha 2), remova `Heart`/`RefreshCw` se já estiverem lá (não estão — o import acima os adiciona; mantenha o import da linha 2 intacto e use o novo import).

(b) Props — adicione à interface `Props` (após `treadmill: TreadmillConnection;`):

```ts
  profile?: ProfileData | null;
  hrBelt: HrBeltConnection;
```

E à assinatura (linha 35):

```ts
export default function WorkoutTracker({ plan, onStop, mode, markAsCompleted, totalWorkoutTime, isFreeTraining, simulateGps, onSyncResult, showFeedback, treadmill, profile, hrBelt }: Props) {
```

(c) Cálculo + refs — adicione após `const speak = (text: string, force = false) => {...}` (linha 482):

```ts
  const hrMax = estimateHrMax(profile?.dob ?? null);
  const liveHr = hrBelt.connected && hrBelt.bpm ? hrBelt.bpm : null;
  const zone = liveHr && hrMax ? hrZone(liveHr, hrMax) : null;

  const heartRateRef = useRef<number | null>(null);
  useEffect(() => {
    heartRateRef.current = hrBelt.connected ? hrBelt.bpm : null;
  }, [hrBelt.connected, hrBelt.bpm]);

  const lastAnnouncedZoneRef = useRef<HrZone | null>(null);
  useEffect(() => {
    if (!hrBelt.connected) return;
    if (zone == null) return;
    if (lastAnnouncedZoneRef.current !== zone) {
      lastAnnouncedZoneRef.current = zone;
      speak(`Você está na ${zoneLabel(zone)}.`, true);
    }
  }, [zone, hrBelt.connected]);
```

(d) Gravação por ponto — nos **três** locais onde `newPoint` é criado (no listener do timer nativo ~252–265, no branch nativo do intervalo ~327–340, e no branch não-nativo ~371–386), adicione logo após o bloco `if (coordsRef.current) {...}`:

```ts
      if (heartRateRef.current) newPoint.heartRate = heartRateRef.current;
```

(e) Card de FC — insira logo após o fecho da grade de 3 colunas (o `</div>` da linha 800, antes do comentário `{/* Marquee`):

```tsx
        {/* Heart rate card */}
        <div className="flex-shrink-0 mt-2">
          <div className="w-full px-3 py-2 bg-bg-surface border border-border rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart size={16} className={hrBelt.connected ? 'text-danger' : 'text-text-muted'} />
              <span className="text-xs text-text-muted uppercase">FC</span>
              {hrBelt.connected && zone && (
                <span className="text-[10px] font-medium" style={{ color: zoneColor(zone) }}>{zoneLabel(zone)}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold" style={{ color: hrBelt.connected && zone ? zoneColor(zone) : 'inherit' }}>
                {liveHr ?? '—'}
              </div>
              {hrBelt.connected && (
                <button onClick={() => hrBelt.disconnect()} className="text-[10px] text-text-muted underline">Desconectar</button>
              )}
            </div>
          </div>
          {mode === 'treadmill' && !hrBelt.connected && (
            <div className="mt-1">
              {hrBelt.state === 'SCANNING' ? (
                <button className="w-full py-1.5 rounded-lg bg-bg-elevated text-text-muted text-xs font-medium flex items-center justify-center gap-1" disabled>
                  <RefreshCw size={12} className="animate-spin" /> Procurando cinta…
                </button>
              ) : hrBelt.devices.length === 0 ? (
                <button onClick={() => hrBelt.scan()} className="w-full py-1.5 rounded-lg bg-bg-elevated text-text-primary text-xs font-medium">
                  Conectar cinta cardíaca
                </button>
              ) : (
                <div className="space-y-1">
                  <p className="text-[10px] text-text-muted">Conecte a cinta em modo broadcast:</p>
                  {hrBelt.devices.map(d => (
                    <button key={d.address} onClick={() => hrBelt.connect(d.address)} className="w-full py-1.5 rounded-lg bg-accent text-white text-xs font-medium">
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
```

- [x] **Step 11: `App.tsx` — hook e props**

Em `src/App.tsx`:

(a) Adicione ao import de `./lib/use-treadmill` (linha 28) não é preciso mexer; adicione novo import após ele:

```ts
import { useHrBelt } from './lib/use-hr-belt';
```

(b) Após `const treadmill = useTreadmill();` (linha 83), adicione:

```ts
  const hrBelt = useHrBelt();
```

(c) No render do `WorkoutTracker` (linhas 1192–1201), adicione após `treadmill={treadmill}`:

```tsx
                  profile={profile}
                  hrBelt={hrBelt}
```

- [x] **Step 12: Validar typecheck + testes**

Run: `npm test`
Expected: PASS (inclui `hr-ble.test.ts`).

Run: `npm run lint`
Expected: SÓ os erros pré-existentes.

- [x] **Step 13: Commit**

```bash
git add src/lib/hr-ble.ts src/lib/use-hr-belt.ts src/lib/__tests__/hr-ble.test.ts src/components/WorkoutTracker.tsx src/App.tsx android/app/src/main/java/com/correlogo/app/HrBleService.kt android/app/src/main/java/com/correlogo/app/HrBlePlugin.kt android/app/src/main/java/com/correlogo/app/MainActivity.java
git commit -m "feat(hr-ble): heart rate belt BLE with live card, zone TTS and per-point recording [skip ci]"
```

---

### Task 8: Validação completa + docs + commit final

**Files:**
- Modify: `CHANGELOG.md`, `HANDOFF.md`, `TODO.md`, `docs/superpowers/specs/2026-08-13-relogio-fitness-integration-design.md` (status), `docs/superpowers/plans/2026-08-13-relogio-fitness-integration.md` (marcar steps concluídos).

**Interfaces:**
- Consumes: tudo.

- [x] **Step 1: Suíte completa**

```powershell
npm test
npm run lint
```

Expected: todos PASS; lint com exatamente os mesmos erros pré-existentes (0 novos).

- [x] **Step 2: Build web + Capacitor + APK**

```powershell
Copy-Item -Path ".env.apk" -Destination ".env" -Force
npm run build
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd android
gradlew assembleDebug
cd ..
```

Expected: build Vite sem erros; `[info] Found N Capacitor plugins for android`; APK debug gerado.

- [x] **Step 3: Atualizar docs**

- `CHANGELOG.md`: entrada para a integração com relógio fitness — FC ao vivo via cinta BLE (0x180D), zonas Z1–Z5 com TTS, bloco de FC no resumo, Insights no Perfil, import de treinos do Health Connect com badge "Relógio" e dedupe ±2min, fix do fluxo de permissão do HC.
- `HANDOFF.md`: descrever o que foi feito (Tasks 1–7), contexto técnico (padrão GATT espelhado do TreadmillBleService; transporte Mock/Native; wrapper HC com READ; desvio do sono e correção do flag RR), impacto na aplicação, e itens para validação em device (permissão HC real; cinta real quando chegar).
- `TODO.md`: marcar "Fix permissão Health Connect" como concluído (era pendente); adicionar se necessário a tarefa "validar cinta cardíaca real quando o hardware chegar" e "validar import via Health Connect no device".
- Spec: mudar status para "Implementado (aguardando validação em device)" e anotar os 2 desvios aprovados (sono adiado; flag RR corrigido).
- Plan: marcar todos os checkboxes `- [x]` → `- [x]` desta plan.

- [x] **Step 4: Commit final**

```bash
git status
git diff --stat
git add -A
git commit -m "feat(relogio-fitness): HR zones, watch import, insights and HR belt BLE [skip ci]"
```

Confirme que `app-release-v*.apk` (untracked na raiz) **não** foi commitado.

---

## Self-Review

**Cobertura do spec:**
- Camada 0 (fix de permissão HC: `createIntent` com `startActivityForResult` direto + fallback de racional) → Task 1. ✅
- Camada 1 (permissões READ no manifest, `checkReadPermissions`/`requestReadPermissions`/`readWorkouts` no plugin; `readWorkoutsFromHealthConnect`/`checkReadHealthPermissions`/`requestReadHealthPermission` no wrapper; `WatchWorkout` em types) → Task 2. ✅
- Camada 3 (`estimateHrMax` 208−0.7×idade, `hrZone` limites Z1–Z5, `zoneLabel`/`zoneColor`) → Task 3. ✅
- Camada 4 — SessionSummary (FC média/máx/mín + tempo por zona + gráfico recharts) → Task 4. ✅
- Camada 4 — Histórico (badge "Relógio", import com dedupe ±2min, empty state com CTA) → Task 5. ✅
- Camada 4 — Perfil → Insights (gráfico última sessão + média/máx por treino + empty state) → Task 6. ✅
- Camada 2 (scan 0x180D, notify 0x2A37, parse flags 8/16-bit com range válido, `hrSample` evento, permissões BLE, conexão simultânea com a esteira, UI card + TTS zona + `ActivityPoint.heartRate`) → Task 7. ✅
- Tratamento de falhas (HC indisponível → silent/`[]`; permissão negada → toast + re-tentativa via `requestReadHealthPermission`; cinta não encontrada → "Conecte a cinta em modo broadcast" + re-scan; FC fora do range → descarta amostra; relógio sem dados → empty state "Nenhum treino novo para importar") → Tasks 2, 5, 7. ✅
- Testes do spec (`hr-zones.test.ts` TDD, `hr-ble.test.ts` mock, `health-connect-read.test.ts` mock/derivação) → Tasks 3, 7, 5. ✅
- Não-escopo (SDKs proprietários, escrita de FC para HC, FTMS 2AD2, sono) → não implementado. ✅

**Desvios documentados (sinalizados ao usuário):**
- `readSleepSessions`/`readSleepFromHealthConnect`/`SleepSummary` da Camada 1 **não** foram implementados — a tabela Escopo da própria spec marca sono como "❌ fase futura" (Global Constraints). [Certain]
- O `HrBleService` parseia só BPM (o flag de RR é o bit 4/0x10 na spec Bluetooth SIG, não "bit 3" como escrito no spec; RR está fora de escopo). [Certain]
- A "modal de re-tentativa" de permissão HC foi implementada como re-request nativo (`requestReadHealthPermission` abre a própria tela do HC) + toast de orientação, sem novo componente Modal. [Certain]

**Placeholders:** nenhum "TBD"/"implement later" — todo código está inline. ✅

**Consistência de tipos:**
- `WatchWorkout` (types.ts) idêntico entre Kotlin (`readWorkouts`), wrapper TS e `watch-import.ts`. ✅
- `TrainingSession.source?: 'app' | 'watch'` criado na Task 2 e consumido só na Task 5. ✅
- `estimateHrMax`/`hrZone`/`zoneLabel`/`zoneColor` (hr-zones) e `computeHrSummary` (hr-summary) usados nas Tasks 4, 6 e 7 com a mesma assinatura. ✅
- `HrBeltConnection` (use-hr-belt) e `HrBleTransport` (hr-ble) com os mesmos nomes de campo entre hook, transportes e `WorkoutTracker`. ✅
- IDs de plugin: `HealthConnect` (readWorkouts/checkReadPermissions/requestReadPermissions) e `HrBle` (startHrScan/connectHr/disconnectHr/initHr/requestHrBlePermissions + listeners `hrSample`/`hrScanResult`/`hrState`/`hrError`) consistentes entre Kotlin e TS. ✅
