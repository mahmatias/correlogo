# Gerador de Treinos — Documentação Técnica Completa

## 1. Visão Geral

O módulo `TrainingGenerator.tsx` implementa um gerador de planos de treino personalizados baseado em 3 perfis de usuário detectados automaticamente:

- **Perfil A:** Iniciante aprendendo a correr em um pace alvo mais rápido
- **Perfil B:** Corredor melhorando seu pace na mesma distância
- **Perfil C:** Corredor expandindo distância (ou sem objetivo de pace específico)

---

## 2. Detecção de Perfil

### 2.1 Cálculo do pace de referência

```typescript
const refPaceMinkm = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;
```

Exemplo: 5km em 34:59 (2099s) → `(2099/60) / 5 = 6.997 ≈ 7:00 min/km`

### 2.2 Condições de roteamento (atuais)

```typescript
// Perfil A: Iniciante (Runna Couch-to-5K)
if (data.experienceLevel === 'beginner') {
    return generateBeginnerProgram(data, totalWeeks);
}

// Perfil B: Melhora de pace (qualquer nível, com targetPace)
const refPaceMinkm = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;
if (data.goal.targetPace != null && refPaceMinkm - data.goal.targetPace > 0.15) {
    return generateImprovePaceProgram(data, totalWeeks);
}

// Perfil C: Padrão (qualquer outro caso)
return generateStandardProgram(data, totalWeeks);
```

**Lógica (simplificada em 2026-06-25):**
- Se `experienceLevel === 'beginner'` → Runna Couch-to-5K (independente de targetPace)
- Se tem targetPace e diferença > 15s/km → improve pace (interpolação VDOT)
- Caso contrário → periodização padrão VDOT fixo

---

## 3. Fórmula VDOT (Jack Daniels)

### 3.1 Conversão de velocidade

```typescript
// Entrada: pace em min/km
// Saída: velocidade em m/min
const paceToVelocity = (paceMinKm: number) => 1000 / paceMinKm;

// Exemplo: pace 7:00 → v = 1000 / 7 = 142.86 m/min
```

### 3.2 Cálculo de VO2

```typescript
const calcVO2 = (v: number) => -4.60 + 0.182258 * v + 0.000104 * v * v;

// Exemplo: v = 142.86 → VO2 = -4.60 + 0.182258*142.86 + 0.000104*142.86²
//                              = -4.60 + 26.06 + 2.12 = 23.58 ml/kg/min
```

### 3.3 Cálculo de percentual VO2max

```typescript
const T = data.referenceRace.timeSeconds / 60; // duração em minutos
const percentVO2max = 0.8 
    + 0.1894393 * Math.exp(-0.012778 * T)
    + 0.2989558 * Math.exp(-0.1932605 * T);

// Exemplo: T = 34.98 min → %VO2max = 0.8 + 0.1894393*e^(-0.4474) + 0.2989558*e^(-5.371)
//                                    = 0.8 + 0.1207 + 0.0022 = 0.9229 ≈ 92.29%
```

### 3.4 Cálculo de VDOT

```typescript
const VDOT = VO2 / percentVO2max;

// Exemplo: 23.58 / 0.9229 = 25.56 VDOT (valor que representa a capacidade aeróbica)
```

### 3.5 Cálculo de paces por zona

```typescript
// Inverter a fórmula para encontrar velocidade dado um VO2 alvo
const solveVelocity = (vo2target: number) => {
    const a = 0.000104;
    const b = 0.182258;
    const c = -4.60 - vo2target;
    // Resolver: a*v² + b*v + c = 0
    return (-b + Math.sqrt(b*b - 4*a*c)) / (2*a);
};

const vToPace = (v: number) => 1000 / v;

// Paces por zona (% VDOT):
const paceE = vToPace(solveVelocity(VDOT * 0.65));   // Easy: 65%
const paceT = vToPace(solveVelocity(VDOT * 0.88));   // Threshold: 88%
const paceI = vToPace(solveVelocity(VDOT * 0.975));  // Interval: 97.5%

// Exemplo VDOT 25.56:
// paceE (65% × 25.56 = 16.61) → v = 131.2 m/min → 7.62 min/km (7:37)
// paceT (88% × 25.56 = 22.49) → v = 177.7 m/min → 5.63 min/km (5:38)
// paceI (97.5% × 25.56 = 24.92) → v = 194.1 m/min → 5.15 min/km (5:09)
```

---

## 4. Perfil A: Runna Couch-to-5K (Iniciante)

### 4.1 Detecção

```typescript
if (data.experienceLevel === 'beginner') {
    return generateBeginnerProgram(data, totalWeeks);
}
```

**Qualquer usuário que se declara iniciante** recebe o plano Runna Couch-to-5K — independentemente de ter ou não targetPace. (Simplificado em relação à implementação anterior que exigia `refPaceMinkm > 8.5` e `targetPace < refPaceMinkm`.)

### 4.2 Entrada para geração

```typescript
const comfortPace = Math.max(6, (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm);
const runPace = data.goal.targetPace ?? comfortPace;
const walkPace = Math.max(comfortPace, 12);  // walk pace mínimo 12 min/km
const maxW = Math.min(totalWeeks, 16);
```

- `runPace` = pace alvo (ou pace de conforto se não informado)
- `walkPace` = pace de caminhada, mínimo de 12 min/km para evitar recuperação muito rápida
- O plano é limitado a 16 semanas (Runna tem 16 semanas; se usuário marcar mais, trunca)

### 4.3 Tabela Runna Couch-to-5K (16 semanas, 2 dias/semana)

```
Semana | Dia 1 (primário)                                          | Dia 2 (secundário)
1      | 3min run + 2min walk ×3                                  | 2.5/1.5/3/2/2.5/1.5/3/2/1 min run/walk
2      | 2min run + 1min walk ×6                                  | 4/1.5/4/1.5/4/1.5 min run/walk ×3
3      | 1/0.5/3/1/1/0.5/3/1/1/0.5/3/1/1 min run/walk            | 1.5/1/5/1.5/1.5/1/5/1.5 min run/walk
4*     | 2.5/1/3/1/2.5/1/3/1 min run/walk  (recuperação)         | 1/0.5/5/1.5/1/0.5/5/1.5 min run/walk
5      | 6/1.5/1/0.5/6 min run/walk                               | 1/0.5/3/1/1/0.5/3/1/1/0.5/3/1/1 min run/walk
6      | 3/1/4/1/3/1/4/1 min run/walk                             | 7/1.5/1/0.5/7 min run/walk
7      | 8/1.5/8/1.5 min run/walk                                 | 3/1/5/1/3/1/5/1 min run/walk
8*     | 0.75km + 1min walk + 0.25km + 0.5min walk + 0.75km      | 0.75km + 1min walk + 0.75km (transição p/ distância)
9      | 1.75km contínuo                                           | 1.25km + 1min walk + 1.25km
10     | 2.25km contínuo                                           | 1.5km + 1min walk + 1.5km
11*    | 2.75km contínuo (recuperação)                             | 1.75km + 1min walk + 1.75km
12*    | 0.75km + 0.5min walk + 1.5km + 1min walk + 0.75km        | 2.5km contínuo (recuperação)
13     | 3.5km contínuo                                            | 2km + 1min walk + 0.25km + 0.5min walk + 2km
14     | 4km contínuo                                              | 3.75km contínuo
15*    | 2.5km + 1min walk + 2.5km (recuperação)                  | 4.25km contínuo
16     | 1.25km + 0.5min walk + 2.5km + 1min walk + 1.25km        | **5km contínuo** 🎯
```

Notas:
- Até semana 7: treinos baseados em **tempo** (minutos)
- Semana 8-16: treinos baseados em **distância** (km) com pace alvo
- Semanas de recuperação marcadas com `*`: volume reduzido
- Dias ímpares (primário) têm fator 1.0, dias pares (secundário) fator 0.85 de volume

### 4.4 Geração de WorkoutPlan

```typescript
const plans: WorkoutPlan[] = sessions.map((steps, si) => {
    const planSteps: WorkoutStep[] = [];
    
    // Aquecimento (5 min)
    planSteps.push(createStep('warmup', 300, walkPace));
    
    // Blocos da Runna table
    for (const s of steps) {
        if (s.t === 'run') {
            const seconds = s.min 
                ? Math.round(s.min * 60 * volumeFactor) 
                : Math.round((s.km! / runPace) * 60);
            planSteps.push(createStep('run', seconds, runPace, s.min ? 'time' : 'distance'));
        } else {
            const seconds = Math.round(s.min! * 60 * volumeFactor);
            planSteps.push(createStep('rest', seconds, walkPace, 'time'));
        }
    }
    
    // Desaquecimento (5 min)
    planSteps.push(createStep('cooldown', 300, walkPace));
    
    return { id: uuidv4(), name: `Semana ${i + 1} — Corrida/Caminhada${si > 0 ? ' (2)' : ''}`, steps };
});
```

### 4.5 Validação

- ✓ Semana 1: blocos run (runPace) + walk (≥12 min/km)
- ✓ Semana 8: transição tempo→distância
- ✓ Semana 12-16: corrida contínua (km, não minutos)
- ✓ Semana 16 Dia 2: 5km contínuo em runPace ← objetivo

---

## 5. Perfil B: Melhora de pace

### 5.1 Detecção

```typescript
if (data.goal.targetPace != null) {
    return generateImprovePaceProgram(data, totalWeeks);
}
```

**Exemplo:** Márcio corre em 7:00, quer chegar em 6:00
- `targetPace = 6` → Perfil B

### 5.2 Cálculo de VDOT alvo

```typescript
// VDOT atual
const T = (data.referenceRace.timeSeconds / 60);
const v = (data.referenceRace.distanceKm * 1000) / T;
const VO2current = calcVO2(v);
const percentVO2max = 0.8 + 0.1894393*Math.exp(-0.012778*T) + 0.2989558*Math.exp(-0.1932605*T);
const vdotCurrent = VO2current / percentVO2max;

// VDOT alvo a partir do pace alvo
const vTarget = 1000 / data.goal.targetPace;  // pace alvo → velocidade
const vo2Target = calcVO2(vTarget);
const vdotTarget = vo2Target / 0.975;  // 97.5% é a zona de prova 5K

// Exemplo: pace 7:00 → VDOT 25.6, pace 6:00 → VDOT 29.4
```

### 5.3 Divisão de fases

```typescript
// Proporções baseadas no objetivo (5K neste exemplo)
const baseW = 0.2;    // 20% das semanas
const buildW = 0.4;   // 40% das semanas
const peakW = 0.3;    // 30% das semanas
const taperW = 0.1;   // 10% das semanas

// Com 16 semanas:
// Base: 3 semanas (1-3)
// Build: 6 semanas (4-9)
// Peak: 5 semanas (10-14)
// Taper: 2 semanas (15-16)
```

### 5.4 Interpolação de VDOT por semana

```typescript
for (let i = 0; i < totalWeeks; i++) {
    // Interpolar linearmente entre VDOT atual e alvo
    const progress = totalWeeks > 1 ? i / (totalWeeks - 1) : 1;
    const vdotWeek = vdotCurrent + (vdotTarget - vdotCurrent) * progress;
    
    // Calcular paces para a semana
    const paceE = vToPace(solveVelocity(vdotWeek * 0.65));
    const paceT = vToPace(solveVelocity(vdotWeek * 0.88));
    const paceI = vToPace(solveVelocity(vdotWeek * 0.975));
    
    // Exemplo com 16 semanas (VDOT 25.6 → 29.4):
    // Semana 0: VDOT 25.6 → paceE 9:12, paceI 6:49
    // Semana 8: VDOT 27.5 → paceE 8:41, paceI 6:25
    // Semana 15: VDOT 29.4 → paceE 8:13, paceI 6:00
}
```

### 5.5 Distribuição de intensidade

```typescript
// Base: apenas Easy (E)
// Build: Easy + Threshold (T) — 1 sessão T por semana
// Peak: Easy + Interval (I) — até 2 sessões I por semana + 1 T
// Taper: Easy + 1 T curto (sem I)

// Para 2 dias/semana (seg + qui):
// Semana 5 (Build, par): Intervalo (seg) + Long Run (qui)
// Semana 6 (Build, ímpar): Limiar (seg) + Long Run (qui)
// Alternância continua em Peak...
```

### 5.6 Estrutura de sessão de Intervalo

```typescript
const intervalSession = {
    warmup: 5min @ paceE,
    [4x: (4min @ paceI) + (2min @ paceE)],  // 4 repetições
    cooldown: 5min @ paceE
};

// Total: 5 + 4*(4+2) + 5 = 35min
```

### 5.7 Validação

- ✓ Base (semanas 1-3): sem Intervalo
- ✓ Build (semanas 4-9): 1-2 Intervalo/semana, alternância I/Limiar para 2 dias
- ✓ Peak (semanas 10-14): até 2 Intervalo/semana
- ✓ Taper (semanas 15-16): sem Intervalo
- ✓ Paces decrescem de 9:12 (sem 1) para 8:13 (sem 16)

---

## 6. Perfil C: Periodização normal VDOT

### 6.1 Detecção

```typescript
// Qualquer caso que não seja Perfil A ou B
return generateStandardProgram(data, totalWeeks);
```

### 6.2 Lógica

- Usar VDOT fixo (não interpolar)
- Distribuição clássica: Base → Build → Peak → Taper
- Proporções variam por objetivo (5K/10K/21K/42K/none)
- Progressão de volume: +10% por semana, ×0.75 em semanas de recuperação

---

## 7. Parâmetros e constantes globais

```typescript
const WARMUP_COOLDOWN_DURATION = 300;  // 5 minutos em segundos
const RECOVERY_FACTOR = 0.75;          // semana de recuperação = 75% volume
const TAPER_FACTOR = 0.8;              // Taper reduz volume a 80%
const MAX_WEEKLY_VOLUME = 36000;       // 600 minutos máximo por semana

const VDOT_ZONES = {
    easy: 0.65,        // 65% VO2max
    threshold: 0.88,   // 88% VO2max
    interval: 0.975    // 97.5% VO2max
};

const BEGINNER_PACE_THRESHOLD = 8.5;   // Acima disto não consegue correr continuamente
const TARGET_PACE_IMPROVEMENT = 0.75;  // máximo 45s/km a cada 8 semanas
```

---

## 8. Estrutura de dados retornada

```typescript
interface TrainingProgram {
    id: string;
    name: string;
    goal: Goal;
    experienceLevel: string;
    referenceRace: { distanceKm: number, timeSeconds: number };
    daysOfWeek: number[];
    mode: 'road' | 'treadmill' | 'both';
    raceDate: number;  // timestamp
    weeks: ProgramWeek[];
    createdAt: number;
}

interface ProgramWeek {
    weekNumber: number;
    phase: 'base' | 'build' | 'peak' | 'taper';
    isRecoveryWeek: boolean;
    plans: WorkoutPlan[];  // Um plano para cada dia da semana
}

interface WorkoutPlan {
    id: string;
    name: string;  // Ex: "Semana 5 — Build — Intervalo"
    programName: string;
    steps: WorkoutStep[];
}

interface WorkoutStep {
    type: 'warmup' | 'cooldown' | 'run' | 'rest' | 'interval';
    durationSeconds: number;
    targetPace: number;  // min/km
    basis?: 'time' | 'distance';  // Como interpretar durationSeconds
}
```

---

## 9. Casos especiais e validações

### 9.1 Semana de recuperação (Perfis B/C)

```typescript
const isRecoveryWeek = (i + 1) % 4 === 0 && (phase === 'build' || phase === 'peak');
```

A cada 4 semanas (apenas nas fases Build e Peak), volume reduzido para 75% (×0.75). No Perfil A (Runna), as semanas de recuperação são embutidas na tabela (semanas 4, 8, 11, 12, 15).

### 9.2 Dias consecutivos e Intervalo (Perfis B/C apenas)

```typescript
// Não marcar Intervalo em dias consecutivos no calendário
const nextDayIsConsecutive = data.daysOfWeek[idx + 1] === data.daysOfWeek[idx] + 1;
if (nextDayIsConsecutive && count > 0) continue;
```

**Exemplo:** seg(1) e ter(2) são consecutivos → não colocar Intervalo em ambos.
No Perfil A (Runna) não há conceito de Intervalo/Limiar — todos os treinos são corrida fácil (runPace) + caminhada.

### 9.3 Validação de pace alvo irreal (Perfil B)

```typescript
const isPaceGoalUnrealistic = () => {
    if (!data.goal.targetPace) return false;
    const currentPace = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;
    const improvement = currentPace - data.goal.targetPace;
    const weeks = totalWeeks || 16;
    const maxImprovement = (weeks / 8) * 0.75;  // máximo 45s/km a cada 8 semanas
    return improvement > maxImprovement;
};
```

Avisar se alguém quer melhorar 1 min/km em 8 semanas (muito agressivo).

---

## 10. Exemplos práticos

### 10.1 Exemplo Perfil A — Runna Couch-to-5K (Cris)

**Input:**
```
Pace de conforto: 12:00 min/km (caminha 5km em 60min)
Pace alvo: 8:00 min/km (quer aprender a correr)
Semanas: 16
Dias: seg (1) + qui (4)
```

**Cálculos:**
```
runPace = 8:00 min/km (targetPace)
walkPace = max(12:00, 12:00) = 12:00 min/km
```

**Output:**
```
Semana 1: 
  Seg: warmup 5min (12:00) + 3/2/3/2/3/2 min run/walk (8:00/12:00) + cooldown 5min (12:00) = 26min
  Qui: mesmo padrão com 85% volume ≈ 20min

Semana 8 (transição distância):
  Seg: warmup + 0.75km run + 1min walk + 0.25km run + 0.5min walk + 0.75km run + cooldown ≈ 23min
  Qui: warmup + 0.75km run + 1min walk + 0.75km run + cooldown ≈ 20min

Semana 16:
  Seg: warmup + 1.25km + 0.5min walk + 2.5km + 1min walk + 1.25km + cooldown ≈ 42min
  Qui: **warmup + 5km contínuo (8:00) + cooldown = 50min** 🏆
```

### 10.2 Exemplo Perfil B (Márcio)

**Input:**
```
Pace atual: 7:00 min/km (5km em 35min)
Pace alvo: 6:00 min/km
Objetivo: 5km
Semanas: 16
Dias: seg (1) + qui (4)
```

**Cálculos intermediários:**
```
VDOT atual: 25.6
VDOT alvo: 29.4

Semana 1:
  paceE = vToPace(solveVelocity(25.6 * 0.65)) = 9:12
  paceI = vToPace(solveVelocity(25.6 * 0.975)) = 6:49

Semana 16:
  paceE = vToPace(solveVelocity(29.4 * 0.65)) = 8:13
  paceI = vToPace(solveVelocity(29.4 * 0.975)) = 6:00 ← objetivo
```

**Output:**
```
Semana 1: Base - Fácil (seg) + Base - Long Run (qui)
  Seg: 30min @ 9:12 pace
  Qui: 42min @ 9:12 pace

Semana 5: Build - Intervalo (seg) + Build - Long Run (qui)
  Seg: 4x(4min @ 6:42) + recuperação ativa = 35min
  Qui: 42min @ 8:30 pace

Semana 16: Taper - Fácil (seg) + Taper - Long Run (qui)
  Seg: 25min @ 8:13 pace
  Qui: 30min @ 8:13 pace
```

---

## 11. Checklist de implementação

- [x] `calcVO2(v)` — fórmula quadrática
- [x] `solveVelocity(vo2target)` — inversa quadrática
- [x] `vToPace(v)` — conversão velocidade → pace
- [x] Detecção de perfil (3 condições)
- [x] `generateBeginnerProgram()` — tabela Runna Couch-to-5K (16 sem, tempo→distância)
- [x] `generateImprovePaceProgram()` — interpolação VDOT + fases
- [x] `generateStandardProgram()` — periodização clássica
- [x] Easy pace com teto de refPace + 2 min/km
- [x] Walk pace mínimo 12 min/km (iniciantes)
- [x] Verificação de dias consecutivos para Intervalo
- [x] Semanas de recuperação (a cada 4 sem)
- [x] Validação de pace alvo irreal
- [x] Exportação de JSON para validação

---

## 12. Referências

- Jack Daniels' Running Formula (2nd ed.) — base para VDOT
- Runna App Couch-to-5K — estrutura de progressão para iniciantes (tempo → distância em 16 semanas)
- Polarized Training — inspiração para distribuição de intensidade

