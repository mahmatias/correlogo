Conteúdo do arquivo especificacao_tcx.md
markdown
# Especificação para Inclusão de `<DistanceMeters>` no Arquivo TCX

## Objetivo
O Strava utiliza os valores de `<DistanceMeters>` em cada `<Trackpoint>` para calcular o **pace** (ritmo) ao longo da atividade. Atualmente, seu sistema gera apenas a velocidade (`<ns3:Speed>`) e o tempo, mas não a distância acumulada por ponto. Para que o Strava exiba o pace corretamente, **cada trackpoint deve conter o elemento `<DistanceMeters>`** com a distância acumulada até aquele instante.

Este documento descreve as alterações necessárias no gerador do arquivo `.tcx` para que ele já produza os dados completos, eliminando a etapa de pós‑processamento.

---

## Estrutura Original do Trackpoint (exemplo)
```xml
<Trackpoint>
  <Time>2026-06-22T13:12:13.140Z</Time>
  <Extensions>
    <ns3:TPX>
      <ns3:Speed>1.39</ns3:Speed>
    </ns3:TPX>
  </Extensions>
</Trackpoint>
```
## Estrutura Desejada
```xml
<Trackpoint>
  <Time>2026-06-22T13:12:13.140Z</Time>
  <DistanceMeters>0.00</DistanceMeters>   <!-- novo elemento -->
  <Extensions>
    <ns3:TPX>
      <ns3:Speed>1.39</ns3:Speed>
    </ns3:TPX>
  </Extensions>
</Trackpoint>
```

## Cálculo da Distância Acumulada
A distância em cada trackpoint é calculada a partir da velocidade (<ns3:Speed>, em metros por segundo) e do intervalo de tempo entre dois pontos consecutivos.

Fórmula
``` text
distância_acumulada = distância_anterior + (velocidade_atual * Δt)
```
onde:

velocidade_atual – valor de <ns3:Speed> do trackpoint atual.

Δt – diferença em segundos entre o tempo do trackpoint atual e o anterior (<Time>).

distância_anterior – distância acumulada até o trackpoint anterior.

Observações:

Para o primeiro trackpoint, a distância acumulada deve ser 0.00 (não há deslocamento antes dele).

O valor deve ser arredondado para duas casas decimais (ex.: 1.39).

Exemplo prático
Tempo (Time)	Velocidade (m/s)	Δt (s)	Incremento (m)	Distância acumulada
13:12:13	1.39	–	–	0.00
13:12:14	1.39	1	1.39	1.39
13:12:15	1.39	1	1.39	2.78
...	...	...	...	...
13:17:13	2.78	1	2.78	384.00 (exemplo)
Inserção no XML
Posicionamento
O elemento <DistanceMeters> deve ser inserido imediatamente após <Time>, antes de <Extensions> (se existir) ou no final do <Trackpoint>.

Namespace
O elemento pertence ao namespace principal do TCX:

``` text
http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2
```
Portanto, deve ser criado com o mesmo namespace do resto do documento. Na prática, não deve ter prefixo (apenas <DistanceMeters>) se o namespace principal estiver declarado como xmlns="..." no elemento raiz.

Código‑exemplo (pseudocódigo)
``` text
para cada trackpoint na lista de trackpoints:
    tempo_atual = converter(Time)
    velocidade = obter(Speed)
    
    se for o primeiro trackpoint:
        distancia_acumulada = 0.0
    senão:
        delta_t = (tempo_atual - tempo_anterior).total_seconds()
        distancia_acumulada += velocidade * delta_t
    
    criar_elemento('DistanceMeters', namespace_principal)
    definir_texto(distancia_acumulada com 2 casas decimais)
    inserir_após_Time(trackpoint, elemento)
    
    tempo_anterior = tempo_atual
```
## Considerações Importantes
Intervalo de tempo: Certifique‑se de que os tempos estejam em ordem crescente e que o cálculo do Δt seja feito com precisão de segundos (pode haver frações, embora no exemplo sejam segundos inteiros).

Velocidade em m/s: O valor de <ns3:Speed> já está em metros por segundo. Não converta.

Precisão: Use ponto decimal e arredonde para duas casas (ex.: 3840.00). O Strava aceita esse formato.

Manutenção do <Lap><DistanceMeters>: O valor total da volta (<Lap><DistanceMeters>) já está correto e deve ser mantido. O novo elemento nos trackpoints é para dados granulares.

Namespaces: Ao gerar o XML, preserve a declaração xmlns="..." no elemento <TrainingCenterDatabase> e o prefixo ns3: para as extensões. O novo <DistanceMeters> não deve ter prefixo.

Exemplo de Saída Final (trecho)
```xml
<Trackpoint>
  <Time>2026-06-22T13:12:13.140Z</Time>
  <DistanceMeters>0.00</DistanceMeters>
  <Extensions>
    <ns3:TPX>
      <ns3:Speed>1.39</ns3:Speed>
    </ns3:TPX>
  </Extensions>
</Trackpoint>
<Trackpoint>
  <Time>2026-06-22T13:12:14.140Z</Time>
  <DistanceMeters>1.39</DistanceMeters>
  <Extensions>
    <ns3:TPX>
      <ns3:Speed>1.39</ns3:Speed>
    </ns3:TPX>
  </Extensions>
</Trackpoint>
```
## Conclusão
Implementando essa lógica diretamente no sistema que gera o arquivo TCX, você obtém um arquivo pronto para upload no Strava, com todos os dados necessários para o cálculo correto do pace, sem precisar de scripts adicionais.

Caso seu sistema gere o arquivo em formato JSON ou outro intermediário, a mesma lógica de cálculo deve ser aplicada antes da serialização final para TCX.
