# Integração Relógio Fitness — Design Doc

> Data: 2026-08-13
> Status: Aprovado (aguardando implementação)

## Objetivo

Integrar o Corre Logo com dispositivos fitness externos em duas frentes:

1. **FC ao vivo na esteira** via cinta cardíaca BLE (perfil padrão Bluetooth SIG 0x180D) — o caso de uso de maior valor do app: hoje não há HR confiável em treino de esteira.
2. **Histórico consolidado + insights** via leitura do Health Connect — o relógio (Amazfit GTR 3 do usuário) sincroniza para o HC através do app Zepp, e o Corre Logo lê de volta.

## Contexto confirmado (research)

- **Amazfit GTR 3**: roda Zepp OS 2.x, **não tem** Heart Rate Push (recurso Zepp OS 3.0+, exclusivo de GTR 4/GTS 4/Balance/Active/T-Rex 3+/Bip 6). FC ao vivo via BLE padrão **não é viável** com este relógio. [Certain]
- **Health Connect**: Garmin, Samsung Health, Zepp (Amazfit), Xiaomi, Fitbit e Google Fit **todos sincronizam para o HC** — uma integração cobre todas as marcas. [Certain]
- **Health Connect já tem plugin de escrita** (`HealthConnectPlugin.kt`) — falta o lado leitura.
- **`ActivityPoint.heartRate?: number` já existe** em `types.ts:83` — FC por ponto não exige migração de schema.
- **`ProfileData.dob` já existe** em `types.ts:140` — HRmax estimado deriva da idade.
- **Bug conhecido**: `HealthConnectPlugin.requestHcPermissions` com `PermissionController.createIntent()` não resolve no device do usuário (TODO pendente). Pré-requisito para qualquer leitura HC.

## Escopo

| Feature | Escopo |
|---|---|
| FC ao vivo na esteira (cinta BLE 0x180D) | ✅ |
| Análise de FC por treino + zonas (Z1–Z5) | ✅ |
| Importar treinos gravados no relógio (via HC) | ✅ |
| Sono / HRV / prontidão | ❌ fase futura |
| SDKs proprietários (Huami/Garmin/Samsung) | ❌ |
| Escrita de FC da cinta de volta para o HC | ❌ |

## Arquitetura

```
Cinta BLE (0x180D) ──┬──> HrBleService.kt (novo)
                     │       └─> HrBle Plugin (Capacitor) ──> hr-ble.ts ──> WorkoutTracker
                     │                 (FC ao vivo + zonas + TTS + gravação por ponto)

Relógio (GTR 3) ──> Zepp app ──> Health Connect ──> HealthConnectPlugin (READ) ──> health-connect.ts
                                                                                    ├──> Insights (Perfil)
                                                                                    └──> Import treinos (Histórico)
```

## Componentes

### Camada 0 — Pré-requisito: fix de permissão do Health Connect

**Problema:** `requestHcPermissions` usa `PermissionController.createRequestPermissionResultContract()` com `startActivityForResult` do Capacitor, mas o device do usuário não abre a tela de permissão.

**Ação:** depurar e corrigir o fluxo de permissão antes de qualquer leitura. Candidatos:
- Usar `activity.startActivityForResult` direto (sem o launcher do Capacitor) com callback manual
- Verificar se o HC está instalado/disponível no device (`getSdkStatus`, `isProviderAvailable`)
- Fallback para intent de configurações do HC

### Camada 1 — Leitura Health Connect

**`HealthConnectPlugin.kt`** (estende o existente):
- Novas permissões READ no `@CapacitorPlugin`:
  - `android.permission.health.READ_HEART_RATE`
  - `android.permission.health.READ_STEPS`
  - `android.permission.health.READ_TOTAL_CALORIES_BURNED`
  - `android.permission.health.READ_SLEEP`
  - `android.permission.health.READ_EXERCISE`
- Novos métodos:
  - `readWorkouts(startMs, endMs)` → lista de sessões de exercício (tipo, início/fim, duração, distância)
  - `readSleepSessions(startMs, endMs)` → sono (início/fim, duração)
  - `checkReadPermissions()` → boolean granted
  - `requestReadPermissions()` → pede as permissões READ
- Uso da API `HealthConnectClient`:
  - `readRecords(ReadRecordsRequest(...))` com `ExerciseSessionRecord::class` e `SleepSessionRecord::class`
  - `AggregateRequest` se necessário para métricas resumidas

**`src/lib/capacitor/health-connect.ts`** (estende o existente):
- `readWorkoutsFromHealthConnect(startMs, endMs)` → `WatchWorkout[]`
- `readSleepFromHealthConnect(startMs, endMs)` → `SleepSummary[]`
- Tipos `WatchWorkout`, `SleepSummary` em `types.ts`

### Camada 2 — FC ao vivo (cinta BLE)

**`HrBleService.kt`** (novo, ~150 linhas):
- Scan de dispositivos anunciando serviço **0x180D** (Heart Rate)
- Conecta, descobre serviços, habilita notify em **0x2A37** (Heart Rate Measurement)
- Parse do payload:
  - Byte 0: flags (bit 0 = 8-bit vs 16-bit, bit 1 = sensor contact, bit 3 = RR intervals)
  - Bytes seguintes: BPM (8 ou 16-bit)
  - RR intervals (opcionais) se presentes
- Callback por amostra: BPM + timestamp
- Reusa o padrão de fila GATT serializada do `TreadmillBleService` (estável após fixes error 133/keep-alive)
- **Conexão simultânea**: Android permite múltiplos GATT — esteira FTMS + cinta HR juntas. Sem conflito de escopo.

**`HrBlePlugin.kt`** (novo, Capacitor):
- `startHrScan()` → lista de dispositivos com 0x180D
- `connectHr(address)` → conecta e começa a emitir amostras
- `disconnectHr()` → desconecta
- Evento `hrSample` → `{ bpm: number, timestamp: number }`
- Permissões: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION` (mesmo padrão do `TreadmillBlePlugin`)

**`src/lib/hr-ble.ts`** (novo):
- Wrapper TS do plugin + listener do evento `hrSample`
- Interface `HrBleTransport` (mockável em testes web)

### Camada 3 — Zonas (puro, TDD)

**`src/lib/hr-zones.ts`** (novo, sem dependências):
- `estimateHrMax(dob: string | null): number | null` → `208 − 0.7 × idade` (idade de `dob`; `null` se sem `dob`)
- `hrZone(hr: number, hrMax: number): 1 | 2 | 3 | 4 | 5` → limites: Z1 50–60%, Z2 60–70%, Z3 70–80%, Z4 80–90%, Z5 90–100%
- `zoneLabel(zone): string` pt-BR (Zona 1 — Recuperação, etc.)
- `zoneColor(zone): string` (paleta Tailwind do app)

### Camada 4 — Front

**`WorkoutTracker.tsx`**:
- Card de FC ao vivo (BPM + cor de zona) quando cinta conectada
- TTS ao mudar de zona (reusa infra TTS existente, com dedupe por zona)
- Grava `heartRate` em cada `ActivityPoint` da sessão

**`SessionSummary.tsx`**:
- FC média/máx + tempo por zona (se houver dados)

**Perfil → aba "Insights"**:
- Gráfico de FC da última sessão (recharts, já no projeto)
- FC média/máx por treino (lista)

**Histórico**:
- Badge "Relógio" nos treinos importados do HC
- Dedupe por horário de início ±2min contra treinos do app

## Fluxo de dados

1. **FC ao vivo**: cinta → `HrBleService` → evento `hrSample` → `hr-ble.ts` → `WorkoutTracker` → `ActivityPoint.heartRate` → sessão salva
2. **Import**: Zepp → HC → `readWorkouts` → mapeia `ExerciseSessionRecord` → `TrainingSession` (modo `outdoor`) → Histórico com badge "Relógio"
3. **Insights**: sessões salvas + `heartRate` por ponto → gráfico FC + zonas

## Tratamento de falhas

| Situação | Ação |
|---|---|
| HC não instalado/disponível | Silencioso — aba Insights oculta, sem erro |
| Permissão HC negada | Modal "Permitir acesso ao Health Connect" com re-tentativa |
| `createIntent()` não resolve | Fallback para intent de configurações + instrução manual |
| Cinta não encontrada no scan | UI: "Conecte a cinta em modo broadcast" + botão re-scan |
| Conexão cinta cai no meio do treino | TTS aviso, gravação continua sem FC, reconnect automático |
| Relógio sem dados para importar | Empty state com ícone + CTA |
| FC fora do range plausível (0/255/sentinela) | Descarta amostra |

## Testes

- `hr-zones.test.ts` (TDD puro): estimativa HRmax, limites de zona, bordas (50/60/70/80/90%), `null` sem `dob`
- `hr-ble.test.ts`: mock do plugin (scan, connect, evento `hrSample`, disconnect)
- `health-connect-read.test.ts`: mock de `readWorkouts`/`readSleep`
- Pipeline Android: `npm test` → lint → build → `cap sync android` → `gradlew assembleDebug`

## Não-escopo (para esta versão)

- Sono / HRV / prontidão / VO2max (fase futura)
- SDKs proprietários de marca
- Escrita de FC da cinta para o Health Connect
- Leitura de FC do próprio relógio via protocolo Huami
- HR da esteira via FTMS (2AD2)

## Dependências

- Cinta cardíaca BLE padrão (para teste do usuário, ex: Helio Strap ou qualquer cinta 0x180D)
- Zepp app configurado para sincronizar GTR 3 → Health Connect
- Health Connect instalado no device (com bug de permissão corrigido na Camada 0)

## Ordem de implementação

Sequência contínua (decisão do usuário):
1. Camada 0 (fix permissão HC)
2. Camada 1 (leitura HC + import treinos)
3. Camada 3 (zonas)
4. Camada 4 (Insights + badge Histórico)
5. Camada 2 (cinta BLE — teste ao receber a cinta)
