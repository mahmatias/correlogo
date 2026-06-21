# Registro detalhado de atividades + Exportação .FIT / .TCX / .GPX

Documento de especificação para implementação no AI Studio. Baseado na análise de 5 arquivos de exemplo gerados pelo Zepp/Amazfit GTR 3 (1 atividade indoor, 1 atividade outdoor), descrevendo exatamente o que precisa ser registrado durante o treino e como gerar arquivos compatíveis com Strava (e qualquer outro serviço que aceite TCX/FIT/GPX padrão).

---

## 1. Objetivo

Hoje o app salva apenas o resultado final do treino (`TrainingSession`: id, planId, data, segundos, distância, concluído). Isso não é suficiente para:

1. Mostrar uma tela de resumo pós-treino com gráficos (FC ao longo do tempo, pace por km, mapa da rota).
2. Permitir que o usuário reabra um treino antigo e veja os mesmos detalhes.
3. Exportar a atividade em um formato que o Strava (ou Garmin Connect, etc.) consiga importar.

Para isso, o app precisa passar a **gravar uma série temporal** (um ponto a cada 1 segundo, como o relógio Amazfit já faz) durante o treino, não só os totais.

---

## 2. O que cada formato de exportação exige (baseado nos arquivos reais analisados + especificação oficial)

Analisei 5 arquivos exportados pelo Zepp (Amazfit GTR 3): uma corrida indoor (esteira, 34 min) e uma corrida outdoor (rua, 35 min), cada uma em .FIT e .TCX, mais um .GPX da atividade outdoor. Além da análise dos arquivos, conferi o **XSD oficial da Garmin** (TrainingCenterDatabasev2.xsd) e a **documentação oficial de upload do Strava** para confirmar o que é de fato exigido pelo padrão, em vez de assumir que tudo que o Zepp exportou é obrigatório.

### 2.0 Tabela de obrigatoriedade — não confundir "presente no exemplo" com "obrigatório"

A regra de ouro confirmada na documentação oficial do Strava: **o único dado obrigatório em qualquer trackpoint/record é o horário (timestamp)**. Tudo o resto — posição, elevação, frequência cardíaca, cadência — é opcional tanto pelo padrão quanto na prática de importação do Strava.

**Por ponto/Trackpoint/Record (capturado a cada segundo):**

| Campo | TCX | GPX | FIT | Obrigatório? |
|---|---|---|---|---|
| Timestamp | `<Time>` | `<time>` | `timestamp` | **SIM — único campo realmente obrigatório** |
| Posição (lat/lon) | `<Position>` | atributos `lat`/`lon` do `<trkpt>` | `position_lat`/`position_long` | Opcional (mas sem isso não há rota no mapa — necessário para outdoor) |
| Velocidade | `<Extensions><TPX><Speed>` | `<extensions><TrackPointExtension><speed>` | `speed` | Opcional (mas sem isso o Strava recalcula a partir da distância/posição — para indoor sem GPS, é a única forma de o Strava saber o pace) |
| Distância acumulada | `<DistanceMeters>` | não existe nativamente | `distance` | Opcional |
| Altitude | `<AltitudeMeters>` | `<ele>` | `altitude` | Opcional |
| Frequência cardíaca | `<HeartRateBpm><Value>` | extensão `<hr>` | `heart_rate` | Opcional |
| Cadência | `<Cadence>` | extensão `<cad>` | `cadence` | Opcional |

**No nível do Lap/Activity/Session (resumo da atividade inteira):**

| Campo | TCX (`ActivityLap_t`, conforme XSD oficial) | Obrigatório? |
|---|---|---|
| `StartTime` (atributo do Lap) | — | **SIM** |
| `TotalTimeSeconds` | — | **SIM** |
| `DistanceMeters` | — | **SIM** |
| `Calories` | — | **SIM** (pode ser `0` se não calculado, mas o elemento precisa existir) |
| `Intensity` | enum `Active`/`Resting` | **SIM** |
| `TriggerMethod` | enum `Manual`/`Distance`/`Location`/`Time`/`HeartRate` | **SIM** |
| `AverageHeartRateBpm`, `MaximumHeartRateBpm` | — | Opcional |
| `Cadence`, `MaximumSpeed` | — | Opcional |
| `Track` (a lista de Trackpoints) | — | Opcional pelo XSD (!), mas obviamente necessário na prática se você quer uma série temporal |
| `Id` da Activity (nível acima do Lap) | `xsd:dateTime` | **SIM** |
| `Sport` (atributo da Activity) | enum `Running`/`Biking`/`Other` | **SIM** |

GPX **não tem** Lap nem totais — confirmado no XSD do GPX: é só a lista de `trkpt` dentro de `trkseg`/`trk`. Qualquer total (distância, tempo, calorias) é recalculado pelo Strava a partir dos pontos, então o app não precisa (e não tem como) incluir resumos num GPX.

### 2.0.1 Conclusão prática para a implementação

Isso simplifica bastante o trabalho do AI Studio: a função de exportação pode ser bem mais simples do que a primeira leitura dos arquivos do Zepp sugeria. Resumindo o que é realmente indispensável:

- **Por segundo:** timestamp sempre; posição quando outdoor; velocidade é altamente recomendada mesmo sendo "opcional", porque sem ela (e sem GPS, no caso indoor) o Strava não tem como saber o pace daquele trecho.
- **No resumo (Lap/Activity):** `TotalTimeSeconds`, `DistanceMeters`, `Calories` (pode mandar 0), `Intensity` (sempre `Active` serve), `TriggerMethod` (sempre `Manual` serve), `Sport` (`Running`), e o `Id`/`StartTime` em formato `xsd:dateTime` (ISO 8601 UTC, ex: `2026-06-03T00:40:55Z`).
- **Frequência cardíaca e cadência são 100% dispensáveis** para a exportação funcionar — confirmando o que já estava na seção 5 deste documento: não é necessário esperar por sensores de HR/cadência para lançar a funcionalidade de exportação.

### 2.1 Achado importante: o .TCX exportado pelo Zepp para a atividade outdoor está incorreto

O arquivo `Zepp20260614072411.tcx` e o `Zepp20260614072411.gpx` são **byte a byte idênticos** — o Zepp simplesmente gerou o mesmo conteúdo GPX e renomeou a extensão para `.tcx`. Um TCX de verdade tem uma estrutura totalmente diferente do GPX (`TrainingCenterDatabase` / `Lap` / `Track` / `Trackpoint`, e não `gpx` / `trk` / `trkseg` / `trkpt`).

**Não devemos reproduzir esse bug.** O app precisa gerar um TCX de verdade (estrutura na seção 2.3), mesmo para atividades outdoor com GPS. O TCX indoor exportado pelo Zepp (`Zepp20260602214055.tcx`), esse sim, está com a estrutura TCX correta — foi a referência usada abaixo.

### 2.2 Disponibilidade desses dados no código atual do WorkoutTracker

| Dado | Indoor (esteira) | Outdoor (rua) | Já disponível no WorkoutTracker hoje? |
|---|---|---|---|
| Timestamp (segundo a segundo) | Sim | Sim | Sim (`elapsedSeconds`) |
| Velocidade instantânea (km/h ou m/s) | Sim | Sim | Sim (`speedRef.current` / `currentSpeed`) |
| Frequência cardíaca (bpm) | Opcional | Opcional | Não — não há sensor de FC hoje |
| Cadência (passos/min) | Opcional | Opcional | Não |
| Latitude/Longitude | N/A (não existe) | Sim | Parcial — já capturado via `coords`/`path`, mas não persistido |
| Altitude (m) | N/A | Opcional | Não |
| Distância acumulada | Sim (calculada) | Sim (GPS) | Sim (`distRef.current` / `lapDistRef.current`) |

**Conclusão prática:** o app já calcula em tempo real tudo que é estritamente necessário para gerar um FIT/TCX/GPX válido para Strava (timestamp, e — embora opcionais pelo padrão — velocidade/distância e, no outdoor, GPS, que são os dados que dão sentido prático à atividade). Frequência cardíaca e cadência exigiriam um sensor (Bluetooth HR / acelerômetro) que o app não tem hoje — a exportação funciona perfeitamente sem eles, são apenas "nice to have". O app não deve bloquear a feature de exportação esperando por isso.

### 2.3 Estrutura mínima de um TCX válido (referência: TCX indoor real do Zepp + XSD oficial)

Anotações `[OBRIGATÓRIO]` / `[opcional]` conforme o `TrainingCenterDatabasev2.xsd` oficial da Garmin (não apenas o que o Zepp incluiu no exemplo):

```xml
<?xml version='1.0' encoding='UTF-8'?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Running">                       <!-- Sport: [OBRIGATÓRIO] (atributo). Enum: Running | Biking | Other -->
      <Id>2026-06-03T00:40:55Z</Id>                   <!-- [OBRIGATÓRIO]. ISO 8601 UTC -->
      <Notes>Esteira</Notes>                          <!-- [opcional] — útil para indicar indoor/outdoor -->
      <Lap StartTime="2026-06-03T00:40:55Z">          <!-- StartTime: [OBRIGATÓRIO] (atributo) -->
        <TotalTimeSeconds>2040</TotalTimeSeconds>     <!-- [OBRIGATÓRIO] -->
        <DistanceMeters>4250</DistanceMeters>         <!-- [OBRIGATÓRIO] -->
        <Calories>469</Calories>                      <!-- [OBRIGATÓRIO] — pode ser 0 se não calculado, mas o elemento precisa existir -->
        <Intensity>Active</Intensity>                 <!-- [OBRIGATÓRIO]. Enum: Active | Resting -->
        <TriggerMethod>Manual</TriggerMethod>         <!-- [OBRIGATÓRIO]. Enum: Manual | Distance | Location | Time | HeartRate -->
        <Track>                                       <!-- [opcional] pelo XSD, mas necessário na prática para ter série temporal -->
          <Trackpoint>
            <Time>2026-06-03T00:40:55Z</Time>          <!-- [OBRIGATÓRIO] — único campo realmente obrigatório por Trackpoint -->
            <!-- Para outdoor, incluir aqui ([opcional], mas necessário para ter rota no mapa): -->
            <!-- <Position><LatitudeDegrees>-22.919..</LatitudeDegrees><LongitudeDegrees>-43.174..</LongitudeDegrees></Position> -->
            <!-- <AltitudeMeters>-40.3</AltitudeMeters>  [opcional] -->
            <!-- <HeartRateBpm><Value>102</Value></HeartRateBpm>  [opcional] -->
            <!-- <Cadence>57</Cadence>  [opcional] -->
            <Extensions>                               <!-- [opcional] -->
              <ns3:TPX>
                <ns3:Speed>0.25</ns3:Speed>            <!-- [opcional], mas recomendado: m/s -->
              </ns3:TPX>
            </Extensions>
          </Trackpoint>
          <!-- ... 1 Trackpoint por segundo ... -->
        </Track>
      </Lap>
      <Creator xsi:type="Device_t">                   <!-- [opcional] -->
        <Name>Corre Logo</Name>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
```

Pontos confirmados na análise do arquivo real:
- Existe **1 único `<Lap>`** por atividade (não há múltiplos laps no export do Zepp, mesmo o treino tendo etapas diferentes — Aquecimento/Corrida/Intervalo ficam todos dentro do mesmo Lap, do início ao fim do treino).
- `DistanceMeters` no nível do `Lap` é o total da atividade — não aparece distância acumulada por `Trackpoint` na versão indoor (sem GPS, a distância vem só do total).
- `Speed` por trackpoint vai dentro de `Extensions/TPX`, em **m/s** (não km/h).
- Quando não há leitura de FC naquele segundo, o `<HeartRateBpm>` simplesmente não aparece naquele Trackpoint (omitir o campo, não enviar `0` ou `null`).

### 2.4 Estrutura mínima de um GPX válido (referência: GPX outdoor real do Zepp + schema GPX 1.1)

```xml
<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
  creator="Corre Logo" version="1.1">
  <trk>
    <name><![CDATA[Corrida ao ar livre]]></name>     <!-- [opcional] -->
    <trkseg>
      <trkpt lat="-22.91931933" lon="-43.17434866">  <!-- lat/lon: [OBRIGATÓRIO] (atributos do próprio trkpt — sem eles não há ponto) -->
        <ele>-40.3</ele>                              <!-- [opcional] -->
        <time>2026-06-14T10:24:11Z</time>             <!-- [OBRIGATÓRIO] — Strava rejeita GPX sem timestamp por ponto -->
        <extensions>                                  <!-- [opcional] -->
          <ns3:TrackPointExtension>
            <ns3:speed>0.0</ns3:speed>                <!-- [opcional] -->
            <ns3:cad>44.0</ns3:cad>                    <!-- [opcional] -->
            <ns3:hr>81</ns3:hr>                        <!-- [opcional] -->
          </ns3:TrackPointExtension>
        </extensions>
      </trkpt>
      <!-- ... 1 trkpt por segundo ... -->
    </trkseg>
  </trk>
</gpx>
```

Note que em GPX a posição (`lat`/`lon`) é o único dado realmente indispensável em cada ponto, além do tempo — sem essas três coisas o ponto não existe. Isso é coerente com a regra de negócio definida (GPX só faz sentido para outdoor).

Confirmações da análise:
- GPX **não tem conceito de Lap nem de totais** (sem `Calories`, sem `DistanceMeters` resumido) — é só a trilha de pontos. Totais (distância, tempo, calorias) ficam só no TCX/FIT, ou são recalculados pelo serviço que importar (Strava recalcula tudo a partir dos `trkpt`).
- `<ele>` (elevação) é opcional, mas presente no exemplo real.
- GPX **não existe para indoor** — sem GPS não há coordenadas, então não tem o que colocar num `trkpt`. Por isso a regra de negócio do Strava de aceitar `.gpx` só faz sentido pra outdoor (alinhado com o que você já pediu).

### 2.5 Estrutura mínima de um FIT válido

FIT é **binário**, não texto — não dá para montar com template de string como TCX/GPX. Ele é organizado em mensagens (`file_id`, `event`, `record`, `lap`, `session`, `activity`), cada uma com campos numerados conforme o FIT SDK da Garmin. A Strava declara seguir a especificação oficial do FIT SDK para arquivos de atividade — então, diferente de TCX/GPX (onde temos um XSD público fácil de checar), a obrigatoriedade exata de cada campo do FIT é definida pelo **FIT Profile** da Garmin (não é um documento único simples de citar campo a campo). Na prática, o consenso confirmado por múltiplas fontes (documentação do Strava + bibliotecas de geração de FIT amplamente usadas) é: **cada mensagem `record` precisa minimamente de `timestamp`; as mensagens `file_id`, `session` e `activity` precisam existir com seus campos centrais (tipo de arquivo, esporte, totais) para o arquivo ser reconhecido como uma atividade válida.** Os campos abaixo, confirmados como presentes nos arquivos reais do Zepp, são o que recomendo gerar — marcados como `[OBRIGATÓRIO]` os que, na minha avaliação, não podem faltar para o arquivo ser aceito como atividade válida, e `[opcional]` os que enriquecem mas não bloqueiam a importação:

**Mensagem `file_id`** (1x, início do arquivo):
- `type` = activity — `[OBRIGATÓRIO]`
- `time_created` — `[OBRIGATÓRIO]`
- `manufacturer`, `product_name` (ex: identificar como "Corre Logo") — `[opcional]`

**Mensagem `event`** (2x: início e fim):
- `timestamp`, `event = timer`, `event_type = start` (no início) / `event_type = stop_all` (no fim) — `[opcional]` (o Zepp inclui, ajuda players que usam isso para marcar início/fim, mas a sessão/lap já trazem os totais)

**Mensagem `record`** (1x por segundo — é o equivalente ao Trackpoint/trkpt):
- `timestamp` — `[OBRIGATÓRIO]` — único campo indispensável por record
- `speed` (m/s) — `[opcional]`, recomendado
- Outdoor, adicionalmente: `position_lat`, `position_long` — `[opcional]` pelo formato, mas necessário para ter rota no mapa. **Atenção:** em FIT, coordenadas são armazenadas em **semicircles**, não em graus decimais. Conversão:
  ```
  semicircles = graus_decimais * (2^31 / 180)
  graus_decimais = semicircles * (180 / 2^31)
  ```
  Confirmei essa fórmula comparando os valores do FIT outdoor com o GPX da mesma atividade — bate exatamente.
- Outdoor, adicionalmente: `altitude` / `enhanced_altitude` (metros) — `[opcional]`

**Mensagem `lap`** (1x, resumo):
- `start_time`, `timestamp` (fim), `total_elapsed_time`, `total_timer_time` (segundos) — `[OBRIGATÓRIO]`
- `total_distance` (metros) — `[OBRIGATÓRIO]`
- Outdoor: `start_position_lat/long`, `end_position_lat/long` (também em semicircles) — `[opcional]`

**Mensagem `session`** (1x, resumo geral — é o que Strava lê para mostrar tipo de esporte, totais etc.):
- `sport = running` — `[OBRIGATÓRIO]`
- **`sub_sport = treadmill`** (indoor) **ou `sub_sport = street`** (outdoor) — `[OBRIGATÓRIO]` na prática: sem isso o Strava pode classificar a atividade incorretamente (este é o campo que diferencia as duas modalidades dentro do próprio FIT)
- `total_distance`, `total_timer_time`, `total_elapsed_time` — `[OBRIGATÓRIO]`
- `total_calories` — `[opcional]` (pode mandar 0)
- `avg_heart_rate`, `max_heart_rate`, `min_heart_rate` — `[opcional]`, só se houver dado de FC
- `avg_running_cadence`, `max_running_cadence` — `[opcional]`, só se houver dado de cadência

**Mensagem `activity`** (1x, fecha o arquivo):
- `timestamp`, `total_timer_time`, `num_sessions = 1`, `type = manual` — `[OBRIGATÓRIO]`

**Biblioteca recomendada:** para gerar FIT a partir de Node.js/TypeScript (stack do projeto), usar uma biblioteca já existente em vez de implementar o protocolo binário do zero — por exemplo `fit-file-writer` ou similar disponível no npm (pesquisar "fit sdk node" ou "fit encoder npm" no momento da implementação, já que o ecossistema muda; a Garmin também disponibiliza um FIT SDK oficial em outras linguagens que pode servir de referência de campos/IDs). **Recomendação adicional:** depois de gerar o primeiro FIT real, testar fazendo upload manual no Strava (Dashboard → "+" → Upload Activity) antes de automatizar — é a forma mais rápida de confirmar que o arquivo é aceito, já que o profile completo do FIT é extenso e a validação prática vale mais do que tentar cobrir 100% da spec de antemão.

---

## 3. O que precisa mudar no app (visão geral, não é código pronto)

### 3.1 Capturar a série temporal durante o treino

No `WorkoutTracker`, o timer principal já roda a cada 1 segundo (`setInterval` de 1000ms) e já tem, a cada tick, os valores de: tempo decorrido, velocidade atual, distância acumulada, e (no modo outdoor) coordenadas GPS. Hoje esses valores são guardados só em `state`/`refs` voláteis (perdidos ao fechar a tela). A mudança necessária é, a cada tick, **acumular esses valores em um array** (em memória, durante o treino) e, ao final, persistir esse array completo junto com a sessão.

Estrutura sugerida por ponto da série (cobre indoor e outdoor com os mesmos campos, deixando lat/lon/altitude vazios quando não aplicável):

```ts
interface ActivityPoint {
  timestampSeconds: number;   // segundos desde o início do treino (não Date.now() bruto)
  speedKmh: number;
  distanceKm: number;         // distância acumulada total até este ponto
  stepIndex: number;          // qual etapa do plano estava ativa (para depois colorir o gráfico por etapa)
  lat?: number;                // só outdoor
  lon?: number;                // só outdoor
  heartRate?: number;          // só quando houver sensor de FC no futuro
  cadence?: number;            // só quando houver sensor de cadência no futuro
}
```

### 3.2 Evoluir o modelo de sessão salva

A interface `TrainingSession` atual (em `src/types.ts`) só guarda totais. Sugestão de evolução:

```ts
export interface TrainingSession {
  id: string;
  planId: string;
  planName: string;             // guardar o nome também, útil se o plano original for apagado depois
  date: string;                 // ISO 8601, igual ao Id do TCX/Activity
  mode: 'treadmill' | 'outdoor';
  trainingType: 'time' | 'distance';
  totalDurationSeconds: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  completed: boolean;
  points: ActivityPoint[];      // a série temporal completa
}
```

Pontos de atenção:
- **Tamanho:** uma sessão de 35 minutos gera ~2100 pontos. Cada ponto é um objeto pequeno (poucos números) — em JSON isso fica em torno de 100-150KB por treino longo, perfeitamente viável de salvar no Firestore (bem abaixo do limite de 1MB por documento). Para treinos muito longos (ultramaratonas de várias horas) considerar salvar `points` em um documento separado de `sessions/{sessionId}/points`, mas para o uso normal do app (corridas de até 2-3h) não deve ser necessário.
- Ao salvar, seguir o mesmo padrão de `try/catch` + cache em `localStorage` já implementado para planos/tema, para não perder o treino se o Firestore falhar no momento de salvar.

### 3.3 Tela de resumo pós-treino

Ao concluir o treino (tela "MARCAR COMO CONCLUÍDO" que já existe), antes de voltar para a lista de planos, mostrar um resumo com base nos `points` recém-capturados:
- Distância total, tempo total, pace médio (calculado, não precisa vir de sensor)
- Gráfico de velocidade/pace ao longo do tempo (dá para colorir por `stepIndex`, mostrando visualmente onde foram os intervalos de Corrida vs Intervalo)
- Outdoor: mapa com a rota percorrida (o `MapComponent` já existe e já recebe `path`; é só reaproveitá-lo no modo "somente leitura" depois do treino)

### 3.4 Tela de histórico (revisitar treinos antigos)

Uma lista de `TrainingSession` salvas, ordenada por data, abrindo para cada uma a mesma tela de resumo da seção 3.3 — já que os dados são os mesmos (`points` da sessão escolhida, em vez dos do treino que acabou de terminar).

### 3.5 Exportação (fora do escopo imediato, mas para planejar)

Com `points` salvos por sessão, a exportação se torna uma função pura: `session: TrainingSession → string (TCX/GPX) | Buffer (FIT)`, sem nenhuma dependência de UI. Pode ser implementada depois, como uma função separada chamada por um botão "Exportar" na tela de histórico/resumo, sem precisar mexer em mais nada do fluxo de treino.

Regra de negócio confirmada com o usuário: oferecer **.fit e .tcx** para atividades indoor (esteira), e **.fit, .tcx e .gpx** para atividades outdoor — já que GPX não tem sentido sem coordenadas GPS.

---

## 4. Resumo das diferenças indoor vs. outdoor (para implementação)

| | Indoor (esteira) | Outdoor (rua) |
|---|---|---|
| Formatos exportáveis | .fit, .tcx | .fit, .tcx, .gpx |
| `sub_sport` (FIT) / equivalente | `treadmill` | `street` |
| Campos de posição | Nenhum | `position_lat`/`position_long` (FIT, semicircles) ou `lat`/`lon` (TCX `<Position>`, GPX `trkpt`, graus decimais) |
| Altitude | Não se aplica | Opcional, se quiser capturar (o app não tem barômetro/GPS de altitude hoje — pode ficar de fora sem prejuízo) |
| Origem da distância/velocidade | Calculada (tempo × pace configurado na esteira) | Calculada a partir do GPS (Haversine, já implementado) |

---

## 5. Itens fora do escopo desta implementação (documentados para não gerar expectativa errada)

- **Frequência cardíaca e cadência reais:** exigem hardware (sensor BLE de FC, acelerômetro para cadência) que o app não tem. A estrutura de dados já deixa espaço para isso (`heartRate?`, `cadence?` opcionais), mas a captura em si é um projeto separado.
- **Múltiplos Laps por TCX:** os arquivos reais do Zepp sempre geram um único Lap por atividade, mesmo com etapas diferentes dentro do treino. Não há necessidade de implementar múltiplos Laps para ter paridade com o que o Zepp já exporta — manter simples (1 Lap = 1 atividade completa) é suficiente.
