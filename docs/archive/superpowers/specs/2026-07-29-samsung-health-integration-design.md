# Samsung Health Sync — Design Doc

## Objetivo

Exportar treinos concluídos no Corre Logo para o Samsung Health SDK, permitindo que o ecossistema Samsung Health → Strava receba os dados automaticamente.

## Premissas

- Uso pessoal, dispositivo Samsung Galaxy
- Samsung Health já instalado e configurado com sincronização Strava
- One-way sync apenas (Corre Logo → Samsung Health)
- Sem custos adicionais (Samsung Health SDK é gratuito)
- Sem dependência de apps de terceiros (Health Connect, Strava API)

## Arquitetura

```
WorkoutTracker.tsx (conclui treino)
       ↓
samsung-health.ts (JS interface, plugin Capacitor)
       ↓
SamsungHealthPlugin.kt (plugin Kotlin nativo)
       ↓
Samsung Health SDK (HealthDataStore, HealthDataResolver)
       ↓
Samsung Health app → Strava (sincronização existente)
```

### Fluxo de Export

1. Treino concluído em `WorkoutTracker`
2. Chama `exportWorkout(workoutData)` do plugin Samsung Health
3. Plugin conecta ao `HealthDataStore` (lazy connect)
4. Se sem permissão (Health Data Agreement):
   - Abre tela de permissão do Samsung Health SDK
   - Se usuário negar ou erro: fallback
5. Insere registro em `HealthConstants.Exercise`:
   - Duração total, distância, calorias estimadas
   - Tipo de exercício (running, treadmill)
   - Timestamp de início/fim
6. Se modo outdoor com GPS: insere registros em `HealthConstants.ExerciseTracking`:
   - Latitude, longitude, altitude, timestamp por ponto da rota
7. Desconecta do `HealthDataStore`
8. Retorna status para JS

### Tratamento de Falha

| Situação | Ação |
|---|---|
| Permissão negada | Modal: "Não foi possível enviar pro Samsung Health. Tente manualmente no histórico." |
| SDK não disponível (não Samsung) | Silencioso — sem modal, sem ícone de pendente |
| Erro de conexão | Salva como `failed`, usuário pode tentar novamente do histórico |
| Sucesso | Salva como `synced`, ícone de check verde no histórico |

### Status de Sincronização

Salvo como campo `syncStatus` no treino (Firestore + localStorage):

| Valor | Significado | Ícone |
|---|---|---|
| `synced` | Exportado com sucesso | ✓ Verde |
| `pending` | Falhou na export automática | ↑ Laranja + botão "Exportar" |
| `failed` | Erro após tentativa manual | ✗ Vermelho + botão "Tentar novamente" |

## Componentes

### Plugin Kotlin (`SamsungHealthPlugin.kt`)

Novo arquivo em `android/app/src/main/java/com/correlogo/app/`.

Métodos:
- `connect()` — lazy, conecta ao `HealthDataStore`
- `isAvailable()` — verifica se Samsung Health SDK está disponível
- `exportWorkout(call)` — recebe JSON do treino, escreve no Samsung Health
- `getHealthDataStatus()` — retorna se já autorizou

### JS Interface (`src/lib/capacitor/samsung-health.ts`)

```typescript
interface WorkoutExport {
  startTime: number;       // epoch ms
  endTime: number;         // epoch ms
  durationSeconds: number;
  distanceKm: number;
  exerciseType: 'treadmill' | 'running';
  avgSpeedKmh: number;
  route?: Array<{
    lat: number;
    lng: number;
    altitude?: number;
    timestamp: number;
  }>;
}

export async function exportWorkout(data: WorkoutExport): Promise<{ success: boolean; status: SyncStatus }>
export async function isSamsungHealthAvailable(): Promise<boolean>
export async function requestHealthPermission(): Promise<boolean>
```

### Trigger no WorkoutTracker

No efeito `isWorkoutCompleted` (linha 515 do `WorkoutTracker.tsx`):

```typescript
if (isWorkoutCompleted) {
  // ... existing stopNativeTimer, speak ...
  const exportData: WorkoutExport = {
    startTime: sessionStartTime,
    endTime: Date.now(),
    durationSeconds: elapsedSeconds,
    distanceKm: distRef.current,
    exerciseType: mode === 'treadmill' ? 'treadmill' : 'running',
    avgSpeedKmh: speedRef.current,
    route: mode === 'outdoor' ? path : undefined,
  };
  const result = await exportWorkout(exportData);
  if (!result.success && result.status === 'pending') {
    setShowPermissionModal(true);
  }
}
```

### Histórico de Treinos

Cada card de treino exibe ícone de status com ação:

- `synced`: ✓ "Sincronizado"
- `pending`: ↑ "Pendente" + botão "Exportar"
  - Ao clicar, tenta export novamente com os dados do treino salvo
- `failed`: ✗ "Falhou" + botão "Tentar novamente"

## Pré-requisitos Samsung

1. **Conta Samsung Developer** (gratuita) em `developers.samsung.com`
2. **Registrar app** no console → obter `SamsungHealthPermission` XML
3. **Incluir permissões** no `AndroidManifest.xml` para `Exercise` e `ExerciseTracking`
4. **Assinar APK** com chave de debug (dev) ou release (APK final)
5. **Samsung Health app** instalado no dispositivo (pré-instalado em Galaxy)

O SDK usa verificação por assinatura — sem registro o `HealthDataStore` não conecta.

## Dados Samsung Health

### `HealthConstants.Exercise`

| Campo | Valor |
|---|---|
| `exercise_type` | `treadmill` (3000) ou `running` (2001) |
| `start_time` | Timestamp início |
| `end_time` | Timestamp fim |
| `time_duration` | Segundos |
| `distance` | Metros |
| `calorie` | Estimado (opcional, ~0.1 * peso * km) |
| `mean_speed` | km/h |

### `HealthConstants.ExerciseTracking` (outdoor)

| Campo | Valor |
|---|---|
| `exercise_id` | ID único do treino |
| `latitude` | Coordenada |
| `longitude` | Coordenada |
| `altitude` | Metros |
| `time_offset` | Offset em ms desde start_time |

## Dependências

- `com.samsung.android.sdk.healthdata:healthdata:1.0.0` (SDK Samsung Health)
- Samsung Health app instalado no dispositivo
- Min SDK: 28 (já compatível com nosso `build.gradle`)

## Não Escopo (para esta versão)

- Import de dados do Samsung Health (passos, FC, treinos antigos)
- Sincronização automática em background (WorkManager)
- Export para outros destinos (Google Fit, Strava direto)
- Mapas de calor ou análises cross-app
