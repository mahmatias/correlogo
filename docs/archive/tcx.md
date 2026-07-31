# Especificação para Inclusão de `<DistanceMeters>` no Arquivo TCX

## Objetivo
O Strava utiliza os valores de `<DistanceMeters>` em cada `<Trackpoint>` para calcular o **pace** (ritmo) ao longo da atividade. Atualmente, seu sistema gera apenas a velocidade (`<ns3:Speed>`) e o tempo, mas não a distância acumulada por ponto. Para que o Strava exiba o pace corretamente, **cada trackpoint deve conter o elemento `<DistanceMeters>`** com a distância acumulada até aquele instante.

Este documento descreve as alterações necessárias no gerador do arquivo `.tcx` para que ele já produza os dados completos, eliminando a etapa de pós-processamento.

> **Nota:** Veja também `docs/registro-e-exportacao-atividades.md` para a especificação completa de exportação (TCX + GPX + FIT) incluindo estrutura de `TrainingSession`, captura de série temporal e indoor vs outdoor.

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

A distância em cada trackpoint é calculada a partir da velocidade (`<ns3:Speed>`, em metros por segundo) e do intervalo de tempo entre dois pontos consecutivos.

**Fórmula:**
```
distância_acumulada = distância_anterior + (velocidade_atual × Δt)
```

Onde:
- `velocidade_atual` – valor de `<ns3:Speed>` do trackpoint atual
- `Δt` – diferença em segundos entre o tempo do trackpoint atual e o anterior (`<Time>`)
- `distância_anterior` – distância acumulada até o trackpoint anterior

**Observações:**
- Para o primeiro trackpoint, a distância acumulada deve ser `0.00`
- O valor deve ser arredondado para duas casas decimais

### Exemplo prático

| Tempo (Time) | Velocidade (m/s) | Δt (s) | Incremento (m) | Distância acumulada |
|---|---|---|---|---|
| 13:12:13 | 1.39 | – | – | 0.00 |
| 13:12:14 | 1.39 | 1 | 1.39 | 1.39 |
| 13:12:15 | 1.39 | 1 | 1.39 | 2.78 |
| ... | ... | ... | ... | ... |
| 13:17:13 | 2.78 | 1 | 2.78 | 384.00 |

## Inserção no XML

O elemento `<DistanceMeters>` deve ser inserido imediatamente após `<Time>`, antes de `<Extensions>` (se existir) ou no final do `<Trackpoint>`. O elemento pertence ao namespace principal do TCX (`http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2`). Na prática, não deve ter prefixo (apenas `<DistanceMeters>`) se o namespace principal estiver declarado como `xmlns="..."` no elemento raiz.

### Pseudocódigo

```
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

- **Intervalo de tempo:** Certifique-se de que os tempos estejam em ordem crescente e que o cálculo do Δt seja feito com precisão de segundos
- **Velocidade em m/s:** O valor de `<ns3:Speed>` já está em metros por segundo. Não converta
- **Precisão:** Use ponto decimal e arredonde para duas casas (ex.: `3840.00`). O Strava aceita esse formato
- **Namespaces:** Ao gerar o XML, preserve a declaração `xmlns="..."` no elemento `<TrainingCenterDatabase>` e o prefixo `ns3:` para as extensões. O novo `<DistanceMeters>` não deve ter prefixo
- **Manutenção do `<Lap><DistanceMeters>:`** O valor total da volta já está correto e deve ser mantido. O novo elemento nos trackpoints é para dados granulares

## Conclusão

Implementando essa lógica diretamente no sistema que gera o arquivo TCX, você obtém um arquivo pronto para upload no Strava, com todos os dados necessários para o cálculo correto do pace, sem precisar de scripts adicionais.
