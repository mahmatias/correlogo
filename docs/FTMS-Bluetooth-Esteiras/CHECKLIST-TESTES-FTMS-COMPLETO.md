# 🔬 CHECKLIST DE TESTES FTMS - Esteira WiLinktech Vision
## Aproveite ao Máximo o Tempo Com a Esteira

**Tempo estimado: 30-45 minutos**
**Apps necessários: nRF Connect**
**Resultado: Documentação completa para seu app**

---

## 📋 SEÇÃO 1: VALIDAÇÃO DE CONEXÃO (5 min)

### 1.1 Identificação do Dispositivo
```
[ ] Device Name: _____________________
[ ] MAC Address: _____________________
[ ] Firmware Version: __________________
[ ] Model Number: _____________________
[ ] Serial Number: _____________________

nRF Connect → Características → Device Information
Ler cada campo e anotar
```

### 1.2 Qualidade de Sinal
```
[ ] RSSI em diferentes locais:
    - Ao lado da esteira: _____ dBm
    - 1 metro de distância: _____ dBm
    - 2 metros de distância: _____ dBm
    - 3 metros de distância: _____ dBm
    - Outra sala: _____ dBm

nRF Connect → Ler RSSI a cada metro
Ruim: -100 dBm | Bom: -40 a -60 dBm | Excelente: -30 dBm
```

### 1.3 Estabilidade de Conexão
```
[ ] Tempo para conectar: _____ segundos
[ ] Desconexões inesperadas: SIM [ ] NÃO [ ]
[ ] Se SIM, depois de quanto tempo? _____ segundos
[ ] Connection parameters:
    - Interval: _____ ms
    - Latency: _____ 
    - Timeout: _____ ms
```

---

## 📊 SEÇÃO 2: VALIDAÇÃO DE DADOS (10 min)

### 2.1 Características Essenciais
```
[ ] Fitness Machine Feature (0x2ACC):
    Valor hexadecimal: __________________
    Características suportadas:
    [ ] Total Distance
    [ ] Inclination
    [ ] Pace
    [ ] Expended Energy
    [ ] Heart Rate
    [ ] Metabolic Equivalent
    [ ] Elapsed Time
    [ ] Remaining Time

[ ] Supported Speed Range (0x2AD4):
    Min Speed: _____ km/h
    Max Speed: _____ km/h
    Increment: _____ km/h

[ ] Supported Inclination Range (0x2AD5):
    Min: _____ %
    Max: _____ %
    Increment: _____ %

[ ] Supported Power Range (0x2AD8):
    Min: _____ W
    Max: _____ W
    Increment: _____ W
```

### 2.2 Dados em Tempo Real (Esteira Parada)
```
Conectar, habilitar notificações de Treadmill Data (0x2ACD)
Esteira PARADA por 10 segundos, anotar valores:

[ ] Speed: _____ km/h
[ ] Distance: _____ m
[ ] Inclination: _____ %
[ ] Ramp Angle: _____ °
[ ] Energy: _____ kcal
[ ] Heart Rate: _____ bpm
[ ] MET: _____
[ ] Elapsed Time: _____ s

Frequência de notificações: Uma a cada _____ segundos
```

### 2.3 Dados em Tempo Real (Esteira em Movimento)
```
CAMINHAR/CORRER na esteira por 30 segundos em velocidade constante

Velocidade configurada: _____ km/h
Inclinação: _____ %

Valores recebidos nas notificações:
[ ] Speed variável? SIM [ ] NÃO [ ]
    - Valor min observado: _____ km/h
    - Valor max observado: _____ km/h
    - Mais frequente: _____ km/h
    - Lag percepto (display x BLE): _____ segundos

[ ] Distance incrementando? SIM [ ] NÃO [ ]
    - Incremento por notificação: _____ metros
    - Consistência: SIM [ ] NÃO [ ]

[ ] Energy incrementando? SIM [ ] NÃO [ ]
    - Valor total: _____ kcal
    - Incremento por minuto: _____ kcal/min

[ ] Heart Rate dados? SIM [ ] NÃO [ ]
    - Valores recebidos: _____ bpm (ou 0?)
    - Precisa sensor BLE externo? SIM [ ] NÃO [ ]

[ ] MET dados? SIM [ ] NÃO [ ]
    - Calculado automaticamente? SIM [ ] NÃO [ ]
    - Valor observado: _____
```

---

## 🎮 SEÇÃO 3: CONTROLE DA ESTEIRA (15 min)

### 3.1 Fitness Machine Control Point (0x2AD9)

**IMPORTANTE:** Escrever valores em hexadecimal
nRF Connect → Characteristics → 0x2AD9 → Write Value

#### Teste A: Iniciar Treino
```
Enviar valor: 01 00
(Start Fitness Machine)

[ ] Esteira respondeu? SIM [ ] NÃO [ ]
[ ] Iniciou automaticamente? SIM [ ] NÃO [ ]
[ ] Ficou em espera? SIM [ ] NÃO [ ]
[ ] Erro recebido? SIM [ ] NÃO [ ]
    Mensagem de erro: __________________
```

#### Teste B: Parar Treino
```
Antes: Esteira LIGADA/MOVIMENTANDO

Enviar valor: 01 01
(Stop Fitness Machine)

[ ] Esteira parou? SIM [ ] NÃO [ ]
[ ] Tempo para parar: _____ segundos
[ ] Retornou posição inicial? SIM [ ] NÃO [ ]
```

#### Teste C: Alterar Velocidade
```
Método 1: Start with Speed
Valor: 02 50 00 00 00
(Iniciar com velocidade 5.0 km/h = 0x50 em hex)

[ ] Aceitou o comando? SIM [ ] NÃO [ ]
[ ] Esteira iniciou em 5.0 km/h? SIM [ ] NÃO [ ]
[ ] Acelerou gradualmente? SIM [ ] NÃO [ ]
    Tempo de aceleração: _____ segundos

Método 2: Set Target Speed (esteira já rodando)
Esteira rodando em 5 km/h
Enviar valor: 02 78 00 00 00
(Set target speed para 12.0 km/h = 0x78)

[ ] Esteira acelerou? SIM [ ] NÃO [ ]
[ ] Valor final: _____ km/h
[ ] Smooth acceleration? SIM [ ] NÃO [ ]
```

#### Teste D: Alterar Inclinação
```
Esteira com velocidade constante

Enviar valor: 03 0A 00 00 00
(Set inclination para 2.6% = 0x0A)

[ ] Inclinação mudou? SIM [ ] NÃO [ ]
[ ] Valor final: _____ %
[ ] Tempo de mudança: _____ segundos
[ ] Atualizou em notificações? SIM [ ] NÃO [ ]
    Lag observado: _____ segundos
```

#### Teste E: Reset Dados
```
Esteira com dados acumulados

Enviar valor: 01 03
(Reset All Data)

[ ] Reset funcionou? SIM [ ] NÃO [ ]
[ ] Distance zerou? SIM [ ] NÃO [ ]
[ ] Energy zerou? SIM [ ] NÃO [ ]
[ ] Time zerou? SIM [ ] NÃO [ ]
[ ] Speed zerou? SIM [ ] NÃO [ ]
```

### 3.2 Fitness Machine Status (0x2ADA)
```
Habilitar notificações de 0x2ADA
Executar algumas operações (iniciar, parar, trocar velocidade)

[ ] Recebendo status? SIM [ ] NÃO [ ]
[ ] Frequency das notificações: Uma a cada _____ segundos
[ ] Estados observados:
    [ ] Idle (parado)
    [ ] In Progress (em movimento)
    [ ] Paused (pausado)
    [ ] Machine Fault (erro)
    
Valores observados: __________________
```

---

## 🔧 SEÇÃO 4: TESTES AVANÇADOS (10 min)

### 4.1 Performance de Notificações
```
Habilitar notificações de Treadmill Data (0x2ACD)
Esteira PARADA

[ ] Frequência das notificações: Uma a cada _____ ms
[ ] Variação: Consistente [ ] Inconsistente [ ]
[ ] Latência típica: _____ ms
[ ] Picos de latência: _____ ms

Agora MOVIMENTANDO a esteira
[ ] Frequência muda? SIM [ ] NÃO [ ]
    Nova frequência: Uma a cada _____ ms
[ ] Dados mais atualizados? SIM [ ] NÃO [ ]
```

### 4.2 Descoberta de Serviços
```
Desconectar completamente
Reconectar do zero

[ ] Tempo total para estar pronto: _____ segundos
[ ] Breakdown:
    - Conectar: _____ segundos
    - Descobrir serviços: _____ segundos
    - Ler características: _____ segundos

Repetir 3 vezes:
Tentativa 1: _____ s | Tentativa 2: _____ s | Tentativa 3: _____ s
Tempo médio: _____ s
```

### 4.3 Resilência
```
Deixar conectado por 5 minutos sem fazer nada

[ ] Ainda conectado? SIM [ ] NÃO [ ]
[ ] Notificações ainda chegando? SIM [ ] NÃO [ ]
[ ] Qualidade do sinal mudou?
    Inicial: _____ dBm → Final: _____ dBm

Tentar desconectar abruptamente (retirar nRF Connect)
[ ] Esteira percebeu desconexão? SIM [ ] NÃO [ ]
[ ] Continuou operando? SIM [ ] NÃO [ ]

Reconectar
[ ] Reconectou automaticamente? SIM [ ] NÃO [ ]
[ ] Tempo para reconectar: _____ segundos
[ ] Dados retomados? SIM [ ] NÃO [ ]
```

---

## 🎯 SEÇÃO 5: COMPORTAMENTOS ESPECIAIS (5 min)

### 5.1 Características Proprietárias
```
Serviço: 00010203-0405-0607-0809-0a0b0c0d1912
Characteristic: 00010203-0405-0607-0809-0a0b0c0d2b12

[ ] Consegue ler? SIM [ ] NÃO [ ]
Valor: __________________

[ ] O que é? (Pesquisar se possível)
__________________________________________

Serviço: 0000fff0-0000-1000-8000-00805f9b34fb
Characteristics: 0000fff1 até 0000fff5

[ ] Consegue ler/escrever? SIM [ ] NÃO [ ]
[ ] Relacionado a FTMS? SIM [ ] NÃO [ ]
[ ] Pode ser usado para controle alternativo? SIM [ ] NÃO [ ]

Notas: __________________________________________
```

### 5.2 Comportamentos Observados
```
Descreva qualquer comportamento inusitado:

[ ] Resets inesperados? __________________
[ ] Valores fora do range? __________________
[ ] Lags notáveis? __________________
[ ] Conexão instável em algum cenário? __________________
[ ] Características que não respondem? __________________
[ ] Limitações observadas? __________________

Notas adicionais:
_________________________________________________
_________________________________________________
```

---

## 📸 SEÇÃO 6: DOCUMENTAÇÃO EXTRA

### 6.1 Screenshots para Coletar
```
[ ] Service 0x181e com todas as características (screenshot completo)
[ ] Fitness Machine Feature leitura (0x2ACC)
[ ] Speed Range (0x2AD4)
[ ] Inclination Range (0x2AD5)
[ ] Treadmill Data notificação (0x2ACD)
[ ] Control Point escrita bem-sucedida (0x2AD9)
[ ] Training Status (0x2AD3)
[ ] Valores de RSSI em diferentes distâncias
```

### 6.2 Logs para Salvar
```
[ ] Exportar log completo de conexão (nRF Connect → Export)
[ ] Salvar timestamp de cada teste
[ ] Anotar hora exata do teste (alguns bugs são time-specific)
[ ] Anotar versão do firmware (V10.23.17)
```

---

## 🚨 SEÇÃO 7: TESTES DE ERRO (Se Tiver Tempo)

### 7.1 Limites de Velocidade
```
Velocidade mínima + 1 km/h:
Enviar: Velocidade = (Min Speed + 1) = _____ km/h
[ ] Aceitou? SIM [ ] NÃO [ ]

Velocidade máxima + 1 km/h:
Enviar: Velocidade = (Max Speed + 1) = _____ km/h
[ ] Rejeitou? SIM [ ] NÃO [ ]
[ ] Ficou em max? SIM [ ] NÃO [ ]
[ ] Erro gerado? SIM [ ] NÃO [ ]
```

### 7.2 Limites de Inclinação
```
Inclinação mínima - 1:
Enviar: _____ %
[ ] Rejeitou? SIM [ ] NÃO [ ]

Inclinação máxima + 1:
Enviar: _____ %
[ ] Rejeitou? SIM [ ] NÃO [ ]
[ ] Ficou em max? SIM [ ] NÃO [ ]
```

### 7.3 Cenários Edge
```
[ ] Iniciar + Parar rapidamente (< 1 segundo):
    Resultado: __________________

[ ] Múltiplos comandos de velocidade seguidos:
    Resultado: __________________

[ ] Control Point enquanto desconectando:
    Resultado: __________________

[ ] Habilitar notificações enquanto recebendo:
    Resultado: __________________
```

---

## 📝 RESUMO EXECUTIVO

Após completar TUDO, preencha:

### Compatibilidade FTMS
- [x] Implementa FTMS: **SIM**
- [ ] Suporta todos os controles: SIM [ ] NÃO [ ]
- [ ] Dados confiáveis: SIM [ ] NÃO [ ]
- [ ] Performance aceitável: SIM [ ] NÃO [ ]

### Pontos Críticos para Seu App
1. __________________________________________
2. __________________________________________
3. __________________________________________

### Quirks/Comportamentos Especiais
1. __________________________________________
2. __________________________________________
3. __________________________________________

### Recomendações para App
- Valor mínimo de delay entre comandos: _____ ms
- Polling rate recomendado: _____ ms
- Timeout de desconexão: _____ s
- Retry strategy: __________________

---

## 🎯 CHECKLIST FINAL

Antes de sair da esteira:
- [ ] Todos os testes foram executados
- [ ] Valores anotados
- [ ] Screenshots tirados
- [ ] Logs exportados
- [ ] Documentação preenchida
- [ ] Comportamentos estranhos descritos
- [ ] Esteira deixada em estado seguro (desligada)

**Tempo total gasto:** _____ minutos
**Data do teste:** ___________________
**Versão firmware:** V10.23.17

---

## 💡 COMO USAR ESTES DADOS

Com estas informações você pode:

1. **Validar seu código:**
   - Sabe exatamente o que esperar

2. **Criar testes unitários:**
   - Values esperados dos dados

3. **Ajustar timeouts:**
   - Baseado em performance real

4. **Handle edge cases:**
   - Sabe os limites da esteira

5. **Documentar para usuários:**
   - Quais recursos funcionam

6. **Debugar remotamente:**
   - Sabe qual comportamento é normal

---

**Boa sorte! Estes dados serão ouro para seu desenvolvimento! 🚀**
