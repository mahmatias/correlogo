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

### 2.2 Condições de roteamento

```typescript
// Perfil A: Iniciante com pace alvo
const isBeginnerWhoCanAlreadyRun = refPaceMinkm <= 8.5;
const hasTargetPaceForBeginnerGoal = 
    data.experienceLevel === 'beginner' && 
    data.goal.targetPace != null &&
    data.goal.targetPace < refPaceMinkm &&
    !isBeginnerWhoCanAlreadyRun;

if (hasTargetPaceForBeginnerGoal) {
    return generateBeginnerProgram(data, totalWeeks);
}

// Perfil B: Melhora de pace (qualquer nível, com targetPace)
if (data.goal.targetPace != null) {
    return generateImprovePaceProgram(data, totalWeeks);
}

// Perfil C: Padrão (distância maior ou sem pace alvo)
return generateStandardProgram(data, totalWeeks);
```

**Lógica:** 
- Se iniciante E quer aprender a correr mais rápido E ainda não consegue correr continuamente → Perfil A
- Se quer melhorar pace (qualquer nível) → Perfil B
- Caso contrário → Perfil C

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

## 4. Perfil A: Iniciante com pace alvo

### 4.1 Detecção

```typescript
const hasTargetPaceForBeginnerGoal = 
    data.experienceLevel === 'beginner' && 
    data.goal.targetPace != null &&
    data.goal.targetPace < refPaceMinkm &&
    refPaceMinkm > 8.5;
```

**Exemplo:** Cris consegue caminhar em 12:00 (refPace), quer correr em 8:00 (targetPace)
- `12 > 8` ✓
- `12 > 8.5` ✓
- → Perfil A

### 4.2 Entrada para geração

```typescript
interface ProfileAInput {
    runPace: number;        // pace alvo (min/km) — o que quer aprender
    walkPace: number;       // pace de conforto (min/km) — recuperação ativa
    totalWeeks: number;     // duração do plano
    goalDistKm: number;     // distância alvo (5km)
    daysOfWeek: number[];   // dias de treino (ex: [1, 4] para seg/qui)
}
```

**Cálculo:**
```typescript
const runPace = data.goal.targetPace;                                    // 8.0 min/km (alvo)
const walkPace = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;  // 12.0 min/km (conforto)
```

### 4.3 Tabela de progressão (16 semanas)

```
Semana | Run (min) | Walk (min) | Reps | Aquec/Desaq | Total
1      | 2         | 2          | 4x   | 5+5         | 26min
2      | 3         | 2          | 4x   | 5+5         | 27min
3      | 4         | 1.5        | 4x   | 5+5         | 30min
4*     | 3         | 1          | 4x   | 5+5         | 24min (70% do vol)
5      | 5         | 1.5        | 3x   | 5+5         | 28min
6      | 6         | 1.5        | 3x   | 5+5         | 29min
7      | 7         | 1          | 3x   | 5+5         | 30min
8*     | 8         | 1          | 2x+4 | 5+5         | 33min (transição)
9      | 10        | 1          | 2x   | 5+5         | 30min
10     | 12        | 1          | 2x   | 5+5         | 34min
11*    | 10        | 1          | 2x   | 5+5         | 30min (70% do vol)
12     | 15        | 1          | 1x+10| 5+5         | 35min
13     | 1.5km @ runPace = 12min (continuous)
14     | 2.75km @ runPace = 22min (continuous)
15     | 4.0km @ runPace = 32min (continuous)
16     | 5.0km @ runPace = 40min (continuous)

* Semanas de recuperação (×0.75 volume)
```

### 4.4 Geração de WorkoutPlan

**Para cada semana e cada dia:**

```typescript
const plans: WorkoutPlan[] = data.daysOfWeek.map((day, index) => {
    const volumeFactor = index === 0 ? 1.0 : 0.85; // 2º dia com 85% volume
    
    const steps: WorkoutStep[] = [];
    
    // Aquecimento
    steps.push(createStep('warmup', 300, walkPace));
    
    // Blocos de corrida/caminhada (semanas 1-12)
    if (!isCorridaContinua) {
        for (let r = 0; r < table.reps; r++) {
            steps.push(createStep('run', 
                Math.round(table.run * 60 * recoveryFactor * volumeFactor), 
                runPace, 'time'));
            if (r < table.reps - 1) {
                steps.push(createStep('rest', 
                    Math.round(table.rest * 60 * recoveryFactor * volumeFactor), 
                    walkPace, 'time'));
            }
        }
    }
    
    // Corrida contínua (semanas 13-16)
    else {
        const continuousFactors = [0.30, 0.55, 0.80, 1.0];
        const continuousIndex = Math.min(3, weekNum - (totalWeeks - 3));
        const dist = goalDistKm * continuousFactors[continuousIndex];
        steps.push(createStep('run', 
            Math.round(dist * runPace * 60), 
            runPace, 'distance'));
    }
    
    // Desaquecimento
    steps.push(createStep('cooldown', 300, walkPace));
    
    return {
        id: uuidv4(),
        name: `Semana ${weekNum} — Corrida/Caminhada${index > 0 ? ' (2)' : ''}`,
        steps
    };
});
```

### 4.5 Validação

- ✓ Semana 1: blocos run 8:00 + rest 12:00
- ✓ Semana 4: volume reduzido para 70%
- ✓ Semana 8: transição com blocos maiores
- ✓ Semana 12: ainda blocos, não contínuo
- ✓ Semana 13: 1.5km contínuo em 8:00 (12min)
- ✓ Semana 16: 5km contínuo em 8:00 (40min) ← objetivo atingido

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

### 9.1 Semana de recuperação

```typescript
const isRecoveryWeek = weekNum % 4 === 0 && !isCorridaContinua;
```

Recuperação apenas nas semanas 4, 8, 12 (não nas últimas 4 de corrida contínua).

### 9.2 Dias consecutivos e Intervalo

```typescript
// Não marcar Intervalo em dias consecutivos no calendário
const nextDayIsConsecutive = data.daysOfWeek[idx + 1] === data.daysOfWeek[idx] + 1;
if (nextDayIsConsecutive && count > 0) continue;  // pular se próximo dia é consecutivo
```

**Exemplo:** seg(1) e ter(2) são consecutivos → não colocar Intervalo em ambos

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

### 10.1 Exemplo Perfil A (Cris)

**Input:**
```
Pace de conforto: 12:00 min/km (caminha em 5km em 60min)
Pace alvo: 8:00 min/km (quer aprender a correr em)
Objetivo: 5km
Semanas: 16
Dias: seg (1) + qui (4)
```

**Output:**
```
Semana 1: 
  - Seg: warmup 5min (12:00) + 4x(2min run 8:00 + 2min walk 12:00) + cooldown 5min (12:00) = 26min
  - Qui: Igual com 85% volume = 22min

Semana 16:
  - Seg: warmup 5min (12:00) + 5km contínuo 8:00 + cooldown 5min (12:00) = 40min
  - Qui: Igual com 85% volume = 36min
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

- [ ] `calcVO2(v)` — fórmula quadrática
- [ ] `solveVelocity(vo2target)` — inversa quadrática
- [ ] `vToPace(v)` — conversão velocidade → pace
- [ ] Detecção de perfil (3 condições)
- [ ] `generateBeginnerProgram()` — tabela + progressão
- [ ] `generateImprovePaceProgram()` — interpolação VDOT + fases
- [ ] `generateStandardProgram()` — periodização clássica
- [ ] Verificação de dias consecutivos para Intervalo
- [ ] Semanas de recuperação (4ª semana)
- [ ] Validação de pace alvo irreal
- [ ] Exportação de JSON para validação

---

## 12. Referências

- Jack Daniels' Running Formula (2nd ed.) — base para VDOT
- Runna App — padrão de progressão para iniciantes
- Polarized Training — inspiração para distribuição de intensidade

