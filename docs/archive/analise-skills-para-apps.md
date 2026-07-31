# Análise de Skills para encarte-monitor e corre-logo

> Relatório gerado em 23/06/2026 — 8 repositórios analisados
> Apps alvo: **encarte-monitor** (plataforma de inteligência de preços) e **corre-logo** (app de corrida PWA)

---

## Índice

1. [obra/superpowers](#1-obrasuperpowers)
2. [anthropics/skills](#2-anthropicsskills)
3. [mattpocock/skills](#3-mattpocockskills)
4. [garrytan/gstack](#4-garrytangstack)
5. [nextlevelbuilder/ui-ux-pro-max-skill](#5-nextlevelbuilderui-ux-pro-max-skill)
6. [Egonex-AI/Understand-Anything](#6-egonex-aiunderstand-anything)
7. [GGPrompts/ggprompts](#7-ggpromptsggprompts)
8. [GGPrompts/ggprompts/styles](#8-ggpromptsggpromptsstyles)
9. [Tabela Comparativa](#9-tabela-comparativa)
10. [Recomendações](#10-recomendações)

---

## 1. obra/superpowers

| Info | Detalhe |
|------|---------|
| **URL** | https://github.com/obra/superpowers |
| **Stars** | 237k |
| **Licença** | MIT |
| **Tipo** | Metodologia de desenvolvimento + framework de skills |
| **Suporte opencode** | ✅ Sim (`.opencode/INSTALL.md`) |
| **Instalação** | `Fetch and follow instructions from raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md` |

### O que é

Metodologia completa de desenvolvimento de software para agentes de IA. Ensina o agente a:

1. **Brainstorming** — refinar ideias antes de codificar
2. **Writing Plans** — criar planos de implementação detalhados
3. **Test-Driven Development** — RED-GREEN-REFACTOR
4. **Systematic Debugging** — debug estruturado em 4 fases
5. **Subagent-Driven Development** — múltiplos subagentes trabalhando em paralelo
6. **Code Review** — revisão por pares automatizada
7. **Git Worktrees** — branches isolados para cada tarefa

### Impacto no encarte-monitor

```
ANTES:                                                   DEPOIS:
┌─────────────────────────────────────┐                  ┌─────────────────────────────────────┐
│ "Adiciona scraping do Extra"        │                  │ /brainstorm → "Vamos pensar no      │
│ → Agente começa a codar direto      │                  │   scraping do Extra..."              │
│ → Pula testes                       │                  │ /writing-plans → Plano detalhado     │
│ → Quebra outras fontes              │                  │ TDD → Testes primeiro                │
│ → Debug caótico                     │                  │ Code Review → Antes de mergear       │
└─────────────────────────────────────┘                  └─────────────────────────────────────┘
```

**Benefícios diretos:**
- **Scraping pipeline**: TDD garante que cada novo módulo de supermercado não quebre os existentes
- **Systematic Debugging**: quando um scraper quebra (ex: site do supermercado mudou o layout), o debug é estruturado e rápido
- **Subagent-Driven Development**: pode paralelizar a implementação de múltiplos módulos de supermercado simultaneamente
- **Code Review**: catches regressions antes de ir pra produção

### Impacto no corre-logo

```
ANTES:                                                   DEPOIS:
┌─────────────────────────────────────┐                  ┌─────────────────────────────────────┐
│ "Adiciona suporte a GPS no treino"  │                  │ /brainstorm → "Quais modos de       │
│ → Coda direto, esquece edge cases   │                  │   GPS precisamos?"                   │
│ → App quebra em áreas sem sinal     │                  │ TDD → Testes de geolocalização       │
│ → Usuário perde treino              │                  │ Systematic Debugging → Fallback      │
└─────────────────────────────────────┘                  └─────────────────────────────────────┘
```

- **TDD**: testar lógica de pace/distância com dados mockados de GPS
- **Systematic Debugging**: problemas de geolocalização em dispositivos específicos
- **Writing Plans**: planejamento de novas funcionalidades (ex: integração com wearable)

### 🎨 Antes/Depois visual

```diff
! ANTES: Fluxo típico sem superpowers
  [ideia] → [codar] → [testar manualmente] → [bugs] → [debug frenético] → [commit]

! DEPOIS: Fluxo com superpowers
  [ideia] → [/brainstorm] → [design doc] → [/writing-plans] → [TDD ciclo]
  → [/subagent-driven-development] → [/requesting-code-review] → [commit seguro]
```

---

## 2. anthropics/skills

| Info | Detalhe |
|------|---------|
| **URL** | https://github.com/anthropics/skills |
| **Stars** | 154k |
| **Licença** | Apache 2.0 / Source-available (documentos) |
| **Tipo** | Repositório oficial de exemplos de skills da Anthropic |
| **Suporte opencode** | ✅ Via Claude Code Plugin Marketplace |
| **Instalação** | `/plugin marketplace add anthropics/skills` |

### O que é

Repositório oficial da Anthropic com skills de demonstração:
- **Document Skills**: criação/edição de docx, pdf, pptx, xlsx (código fonte disponível, mas não open-source)
- **Creative & Design**: arte, música, design
- **Development & Technical**: testes de web apps, geração de MCP servers
- **Enterprise & Communication**: workflows corporativos

### Impacto nos projetos

**Valor principalmente para documentação:**

| Projeto | Benefício |
|---------|-----------|
| **encarte-monitor** | Gerar relatórios de preços em PDF/docx automaticamente; exportar planilhas xlsx dos históricos |
| **corre-logo** | Gerar planos de treino em PDF para impressão; exportar histórico em xlsx |

**Porém**: as skills de documento são source-available (não open-source) e o repositório é mais educacional do que prático para estes projetos específicos.

### Verdict

📄 **Baixo impacto direto** no desenvolvimento dos apps. Útil apenas para geração de documentos/relatórios. As skills de documento podem economizar tempo na exportação de dados, mas não agregam valor ao núcleo dos produtos.

---

## 3. mattpocock/skills

| Info | Detalhe |
|------|---------|
| **URL** | https://github.com/mattpocock/skills |
| **Stars** | 143k |
| **Licença** | MIT |
| **Tipo** | Skills de engenharia de software focadas em qualidade |
| **Suporte opencode** | ✅ Via `npx skills@latest add mattpocock/skills` |
| **Instalação** | `npx skills@latest add mattpocock/skills` |

### O que é

Skills criadas por Matt Pocock (conhecido por TypeScript/Total TypeScript). Foco em engenharia real, não "vibe coding":

**Skills principais:**
- `/grill-me` / `/grill-with-docs` — entrevista detalhada antes de codar, alinhamento de expectativas
- `/tdd` — red-green-refactor loop
- `/diagnosing-bugs` — loop disciplinado de debug
- `/to-prd` — transformar conversa em PRD
- `/to-issues` — quebrar specs em issues acionáveis
- `/improve-codebase-architecture` — analisar e melhorar arquitetura
- `/domain-modeling` — construir linguagem compartilhada com `CONTEXT.md`

### Impacto no encarte-monitor

```
PROBLEMA ATUAL:
  - 10+ módulos de supermercado, cada um com scraping diferente
  - VTEX API, PDF OCR, e-commerce scraping — stacks diferentes
  - Uma mudança em um módulo pode quebrar outros
  - Código pode ficar "bola de neve" com acúmulo de módulos

SOLUÇÃO MATT POCCOCK:
  📐 /improve-codebase-architecture → Scan arquitetural + relatório HTML
  📝 /domain-modeling → CONTEXT.md com linguagem compartilhada (ex: "deparaNome", "batchUpsert")
  🧪 /tdd → Testes para cada módulo de scraping antes de adicionar novos
  🐛 /diagnosing-bugs → Debug estruturado quando um scraper quebra
```

**Antes/Depois na arquitetura:**

```diff
! ANTES: Módulos de supermercado frágeis
  Guanabara → código específico
  Mundial → código específico
  Assaí → código específico
  Prezunic → código específico
  → Mudança no Assaí pode quebrar o Prezunic
  → Ninguém sabe exatamente o que cada módulo compartilha

! DEPOIS: Arquitetura limpa com domain-modeling + TDD
  modules/
  ├── base-scraper.ts      ← Interface comum testada
  ├── guanabara/
  ├── mundial/
  ├── assai/
  └── prezunic/
  → Cada módulo herda de base-scraper
  → Testes por módulo
  → CONTEXT.md documenta linguagem compartilhada
```

### Impacto no corre-logo

```
PROBLEMA ATUAL:
  - App parou de existir como fonte (só build artifacts)
  - Precisa ser reconstruído ou ter arquitetura melhorada
  - Lógica de treino GPS pode ter edge cases não tratados

SOLUÇÃO MATT POCCOCK:
  📐 /improve-codebase-architecture → Planejar reconstrução com arquitetura sólida
  🧪 /tdd → Testar lógica de pace, distância, GPS antes de codar
  📝 /domain-modeling → CONTEXT.md com termos de domínio de corrida
  🎯 /grill-with-docs → Alinhar o que o app DEVE fazer antes de reconstruir
```

### 🎨 Antes/Depois visual do processo

```diff
! ANTES:
  "Faz uma tela de histórico" → agente codifica direto → "Não era bem isso..."
  → repete 3x → código bagunçado → "Agora preciso de mais uma feature"
  → código fica cada vez pior

! DEPOIS:
  /grill-with-docs → "O que é uma sessão? O que é um plano? O que é pace?"
  → domain-modeling atualiza CONTEXT.md
  → /to-prd → PRD aprovado
  → /tdd → Testes falham → implementação → testes passam
  → Código limpo, testado, documentado
```

---

## 4. garrytan/gstack

| Info | Detalhe |
|------|---------|
| **URL** | https://github.com/garrytan/gstack |
| **Stars** | 114k |
| **Licença** | MIT |
| **Tipo** | "Time de engenharia virtual" — 23+ especialistas em slash commands |
| **Suporte opencode** | ✅ `./setup --host opencode` |
| **Instalação** | `git clone ... ~/gstack && cd gstack && ./setup --host opencode` |

### O que é

Criado por Garry Tan (CEO do Y Combinator). Transforma o agente em um time completo:

| Comando | Cargo | Função |
|---------|-------|--------|
| `/office-hours` | YC Partner | 6 perguntas forçantes antes de codar |
| `/plan-ceo-review` | CEO | Repensa o produto, 4 modos de escopo |
| `/plan-eng-review` | Eng Manager | Diagramas, data flow, edge cases |
| `/plan-design-review` | Designer | Nota cada dimensão de 0-10, detecta AI slop |
| `/design-consultation` | Design Partner | Sistema de design completo do zero |
| `/design-shotgun` | Design Explorer | 4-6 variantes de mockup pra escolher |
| `/design-html` | Design Engineer | Mockup → HTML production-ready |
| `/review` | Staff Engineer | Encontra bugs que passam no CI |
| `/qa` | QA Lead | Testa, acha bugs, fixa com commits atômicos |
| `/qa-only` | QA Reporter | Só reporta, sem modificar código |
| `/cso` | CISO | OWASP Top 10 + STRIDE |
| `/ship` | Release Engineer | PR, testes, coverage, deploy |
| `/investigate` | Debugger | Root cause debugging sistemático |
| `/document-release` | Tech Writer | Docs atualizadas automaticamente |
| `/retro` | Eng Manager | Retrospectiva semanal |
| `/autoplan` | Review Pipeline | CEO → design → eng review automático |

### Impacto no encarte-monitor

```
ÁREAS DE ALTO IMPACTO:
```

**1. `/qa` — Teste de ponta a ponta**
```
ANTES:
  "Será que o scraping do Assaí ainda funciona?"
  → Teste manual no navegador
  → "Parece que sim... ou será que não?"

DEPOIS:
  /qa https://meusite.com
  → Abre navegador real
  → Clica em "Assaí" → verifica produtos carregados
  → Acha bug: "Preço do arroz não atualizou"
  → Fixa com commit atômico
  → Gera regression test
  → Re-verifica: "OK!"
```

**2. `/investigate` — Debug de scrapers**
```
ANTES:
  "O scraper do Guanabala parou de funcionar"
  → "Vou tentar mudar o seletor CSS"
  → Tenta 5 seletores diferentes
  → Nenhum funciona → frustração

DEPOIS:
  /investigate "scraper Guanabara retorna 0 produtos"
  → Reproduz o problema
  → Minimiza: testa requisição isolada
  → Hipótese: "Site mudou de HTML pra SPA"
  → Instrumenta: console.log no parser
  → Fixa: "Usar Cheerio + Puppeteer"
  → Regression test: "Garantir que não quebre de novo"
```

**3. `/cso` — Segurança**
```
ANTES:
  - Firebase Admin SDK keys espalhadas nos arquivos baixados
  - PPK keys sem proteção
  - client_secret.json exposto

DEPOIS:
  /cso
  → Detecta: "Firebase service account keys no Downloads/"
  → Recomenda: .gitignore + env vars + secrets manager
  → OWASP Top 10 scan no código
```

**4. `/document-release` — Documentação**
```
ANTES:
  - README desatualizado
  - Ninguém sabe como adicionar novo supermercado
  - "Pergunta no WhatsApp"

DEPOIS:
  /ship → /document-release
  → README atualizado automaticamente
  → Guia "Como adicionar um novo módulo de supermercado" gerado
  → ARCHITECTURE.md reflete o código real
```

### Impacto no corre-logo

```
ÁREAS DE ALTO IMPACTO:
```

**1. `/design-consultation` — Design system do zero**
```
ANTES:
  - Tema gemstone (ágata, turmalina, jaspe) — bonito, mas inconsistente
  - Sem design system documentado
  - Cores espalhadas em arquivos

DEPOIS:
  /design-consultation "app de corrida com tema pedras preciosas"
  → Pesquisa concorrentes (Strava, Nike Run)
  → Proposta criativa: "E se o tema mudar conforme a distância?"
  → Mockups realistas
  → DESIGN.md completo
  → Cores sistematizadas em CSS variables
```

**2. `/review` — Qualidade de código**
```
ANTES:
  - Código fonte perdido (só build artifacts)
  - Precisa reconstruir → chance de repetir erros

DEPOIS:
  /review
  → "Alert: lógica de GPS sem fallback para quando perde sinal"
  → "Auto-fixed: tempo de treino não persiste entre sessões"
  → "Warning: cache localStorage sem limite de tamanho"
```

**3. `/shotgun` + `/design-html` — Prototipação rápida**
```
ANTES:
  "Descrever a tela em palavras" → "Não era isso" → "Descrever de novo"

DEPOIS:
  /design-shotgun "tela de treino ao vivo com GPS e pace"
  → 6 variantes geradas
  → Comparação lado a lado no navegador
  → Escolhe a melhor
  → /design-html → HTML production-ready
  → "É isso que eu quero, agora integra com Firebase"
```

### 🎨 Antes/Depois: Ciclo completo com gstack

```diff
! ANTES (caótico):
  Ideia vaga → "Faz aí" → Código errado → "Não é isso"
  → "Faz de novo" → Código bagunçado → Bateu saudades do Junior

! DEPOIS (gstack):
  /office-hours → Plano aprovado
  /plan-ceo-review → Desafio premissas
  /design-shotgun → Mockup aprovado
  /autoplan → CEO + design + eng review
  → Subagente implementa
  /review → Bugs corrigidos
  /qa → Testado em navegador real
  /cso → Segurança verificada
  /ship → PR criado + docs atualizados
```

---

## 5. nextlevelbuilder/ui-ux-pro-max-skill

| Info | Detalhe |
|------|---------|
| **URL** | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |
| **Stars** | 95.6k |
| **Licença** | MIT |
| **Tipo** | Design intelligence — 67 estilos, 161 paletas, 57 fontes |
| **Suporte opencode** | ✅ Nativo (skill.json → platforms: opencode) |
| **Instalação** | `npx uipro-cli init --ai opencode` |

### O que é

Sistema completo de inteligência de design:

- **67 estilos UI**: Glassmorphism, Neumorphism, Brutalism, Bento Grid, AI-Native UI, etc.
- **161 paletas de cores**: específicas por indústria
- **57 combinações tipográficas**: com imports do Google Fonts
- **25 tipos de gráfico**: recomendação por cenário
- **99 UX guidelines**: boas práticas + anti-patterns + acessibilidade
- **161 regras de raciocínio**: geração de design system por tipo de produto
- **16 tech stacks**: React, Next.js, Vue, Flutter, SwiftUI e mais

### Impacto no encarte-monitor

**Design system recomendado:**
```
ENCARTE-MONITOR — PLATAFORMA DE PREÇOS (E-COMMERCE / DATA)

Estilo recomendado: Data-Dense Dashboard + Bento Grid
Paleta:                   #2D3436 (texto)
                          #00B894 (verde economia)
                          #FDCB6E (amarelo destaque)
                          #E17055 (laranja alerta)
                          #DFE6E9 (background card)
Tipografia:               Inter (dados) + Poppins (títulos)
Chart style:              Real-Time Monitoring + Drill-Down Analytics
Anti-patterns:            ❌ Gradientes chamativos em cards de preço
                          ❌ Animações lentas em tabelas
                          ❌ Falta de contraste em valores monetários
```

**Antes/Depois visual:**

```diff
! ANTES (design atual):
  ┌─────────────────────────────────────┐
  │  Catálogo de Promoções              │
  │  ┌─────┐ ┌─────┐ ┌─────┐           │
  │  │R$8,9│ │R$5,9│ │R$12│ ← sem      │
  │  │     │ │     │ │    │   hierarquia│
  │  │Arroz│ │Leite│ │Café│            │
  │  └─────┘ └─────┘ └─────┘           │
  │  Cores aleatórias, sem consistência │
  └─────────────────────────────────────┘

! DEPOIS (com UI/UX Pro Max):
  ┌─────────────────────────────────────┐
  │  🏷 Catálogo de Promoções           │
  │  ┌──────┐ ┌──────┐ ┌──────┐        │
  │  │R$8,90│ │R$5,49│ │R$12,90│       │
  │  │ -12% │ │ -23% │ │  -5% │        │
  │  │ Arroz│ │ Leite│ │ Café │ ← badge │
  │  │ Guan │ │ Assaí│ │ Mundial│ verde │
  │  └──────┘ └──────┘ └──────┘        │
  │  Tipografia limpa, cores semânticas  │
  │  [📊 Ver Histórico] [📬 Alertas]    │
  └─────────────────────────────────────┘
```

**Price History Chart — Antes/Depois:**

```diff
! ANTES (gráfico básico):
  Preço do Arroz:
  ████████████████ R$ 8,90
  ████████████ R$ 7,50
  ████████████████████ R$ 10,00
  (sem labels claros, sem tendência)

! DEPOIS (com recomendação de Chart):
  Preço do Arroz — Guanabara (últimos 30 dias)
  R$11 ┤
  R$10 ┤        ╱╲
  R$ 9 ┤  ╱╲  ╱  ╲╱╲
  R$ 8 ┤╱  ╲╱        ╲____  ← tendência
  R$ 7 ┤
       └──┬──┬──┬──┬──┬──┬──
         05 09 13 17 21 25 29
        📉 Média: R$ 8,90 | Mín: R$ 7,20 | Máx: R$ 10,50
        🏆 Menor preço em 30 dias!
```

### Impacto no corre-logo

**Design system recomendado:**
```
CORRE-LOGO — APP DE CORRIDA (HEALTH & WELLNESS)

Estilo recomendado: Soft UI Evolution + Organic Biophilic
Paleta primária:          #FF6B6B (energia/coral)
                          #4ECDC4 (verde natureza)
                          #FFE66D (amarelo sol)
                          #2D3436 (texto escuro)
                          #F8F9FA (fundo claro)
                          Variante dark: tons mais profundos
Tipografia:               Montserrat (títulos esportivos) + Inter (dados)
Mood:                     Energético, motivacional, orgânico
Anti-patterns:            ❌ Modo escuro agressivo (usado ao ar livre)
                          ❌ Animações pesadas (bateria)
                          ❌ Fontes ornamentadas (ilegíveis durante exercício)
```

**Antes/Depois visual do app de corrida:**

```diff
! ANTES (design atual — tema gemstone):
  ┌─────────────────────┐
  │  🏃 Treino Hoje     │
  │  ┌─────────────────┐│
  │  │ Pace: --:--     ││ ← sem destaque
  │  │ Dist: 0.0 km    ││
  │  │ Temp: 00:00     ││
  │  │ [Iniciar Treino] ││ ← botão genérico
  │  └─────────────────┘│
  │  Cores escuras,      │
  │  baixo contraste     │
  └─────────────────────┘

! DEPOIS (com UI/UX Pro Max - Soft UI Evolution):
  ┌─────────────────────┐
  │  🏃🏽‍♂️ TREINO DE HOJE  │
  │  ┌─────────────────┐│
  │  │      PACe        ││
  │  │    ★ 5:30 ★      ││ ← grande e ousado
  │  │  ─── ● ───       ││
  │  │ Dist  │ Tempo   ││
  │  │2.4 km │ 12:45   ││ ← soft shadows
  │  ├─────────────────┤│
  │  │ 🔵 [INICIAR]   ││ ← CTA vibrante
  │  │     TREINO      ││
  │  └─────────────────┘│
  │  Mapa: [═══●════]   │
  │  Modo: 🏠 Esteira  🌳 Rua │
  │  Sensação: 😊😐😰   │
  └─────────────────────┘
```

**Dashboard de histórico — Antes/Depois:**

```diff
! ANTES:
  Histórico de Treinos
  12/06 — 3km — 15min — Pace 5:00
  14/06 — 5km — 27min — Pace 5:24
  17/06 — 2km — 12min — Pace 6:00
  (lista simples, sem insights)

! DEPOIS:
  📈 SEU DESEMPENHO
  ┌─────────────────────────────────┐
  │  ╱╲    ╱╲                      │
  │ ╱  ╲  ╱  ╲  ╱╲                │
  │╱    ╲╱    ╲╱  ╲╱╲             │
  │               ╱  ╲              │
  │ Distância (km)                  │
  ├─────────────────────────────────┤
  │ 🏆 Recorde: 5km em 27min       │
  │ 📊 Média da semana: 12.4km     │
  │ 🎯 Meta: 50km/semana → 25%     │
  │ ⚡ Sequência: 5 dias seguidos  │
  ├─────────────────────────────────┤
  │ [📅 Ver Mês] [📊 Comparar]     │
  └─────────────────────────────────┘
```

---

## 6. Egonex-AI/Understand-Anything

| Info | Detalhe |
|------|---------|
| **URL** | https://github.com/Egonex-AI/Understand-Anything |
| **Stars** | 66.9k |
| **Licença** | MIT |
| **Tipo** | Knowledge graph interativo do código-fonte |
| **Suporte opencode** | ✅ `install.sh opencode` ou via plugin marketplace |
| **Instalação** | `iwr -useb https://raw.githubusercontent.com/Egonex-AI/Understand-Anything/main/install.ps1 | iex` (Windows) |

### O que é

Transforma qualquer codebase em um **grafo de conhecimento interativo**:

```
/understand         → Escaneia projeto, extrai funções/classes/deps → knowledge graph
/understand-dashboard → Dashboard visual no navegador
/understand-chat    → "Como funciona o fluxo de pagamento?"
/understand-diff    → "Qual o impacto dessa mudança?"
/understand-explain → "Explica src/auth/login.ts"
/understand-onboard → Guia de onboarding para novos devs
/understand-domain  → Extrai domínios de negócio do código
```

### Impacto no encarte-monitor

**Problema**: 10+ módulos de supermercado, cada um com lógica de scraping única. Difícil de visualizar como tudo se conecta.

```
/understand → Gera grafo de conhecimento:

                    ┌──────────────────┐
                    │  Product Catalog  │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │    Scrapers   │  │  AI Pipeline  │  │    API Routes │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                 │
    ┌────┴────┐       ┌────┴────┐       ┌────┴────┐
    ▼         ▼       ▼         ▼       ▼         ▼
  Guanab.  Mundial  Gemini   Fallback  Catalog   Admin
  Assaí    Prezunic API      Cheerio   Routes    Panel
  Extra    ZonaSul  Key1/Key2                   Routes
         ...
```

**Benefícios:**
- `/understand-chat "Como o sistema decide qual API key do Gemini usar?"` → resposta instantânea
- `/understand-diff` ao adicionar novo módulo de supermercado → "Essas 3 funções serão afetadas"
- `/understand-onboard` → novo dev aprende a arquitetura em minutos, não dias
- `/understand-explain "batchUpsert"` → explica o chunking de 250 em 250

### Impacto no corre-logo

```
Com o código-fonte parcialmente perdido, /understand pode ajudar a:
1. Documentar o que sobrou (App.tsx, evaluatePerformance.ts)
2. Planejar a reconstrução
3. Extrair domínio de negócio do JSON de plano de treino

/understand-domain no código existente:
  Domain: Treino de Corrida
    → Flow: Criação de Plano → Execução de Treino → Avaliação → Ajuste
      → Step: Usuário cria plano manualmente
      → Step: Usuário inicia treino (esteira/GPS)
      → Step: Sistema avalia performance (<80% → ajusta)
    → Entidades: Plano, Sessão, Passo, Pace, Distância
```

### 🎨 Antes/Depois: Onboarding de novo dev

```diff
! ANTES:
  "Leia o código" → "Entendeu?" → "Não" → "Leia de novo"
  → Dias perdidos tentando entender a arquitetura

! DEPOIS:
  /understand → 30 segundos
  /understand-dashboard → Grafo interativo
  "Clica no nó 'Scraper Guanabara' → vê dependências, código, explicação"
  /understand-chat "Como adicionar um novo supermercado?"
  → Resposta com arquivos específicos e ordem de implementação
  → Pronto pra contribuir em minutos
```

---

## 7. GGPrompts/ggprompts + 8. GGPrompts/ggprompts/styles

| Info | Detalhe |
|------|---------|
| **URL** | https://github.com/GGPrompts/ggprompts |
| **Stars** | 32 |
| **Licença** | Open source |
| **Tipo** | 204 sistemas de design CSS em HTML auto-contido |
| **Suporte opencode** | Uso via referência: "Look at style X and apply to my project" |

### O que é

Coleção de 204 sistemas de design CSS completos, cada um em um único arquivo HTML. Cada style guide define:

- Paleta de cores (CSS variables)
- Tipografia (Google Fonts)
- Spacing, buttons, forms, cards, alerts
- Design completo navegável

**Estilos notáveis para os projetos:**

| Estilo | Ideal para | Visual |
|--------|------------|--------|
| `geological-mineral.html` | encarte-monitor (já tem esse arquivo baixado!) | Tons terra, sóbrio, profissional |
| `data-bento.html` | encarte-monitor dashboards | Grid estilo Bento, foco em dados |
| `data-visualization.html` | encarte-monitor charts | Otimizado para gráficos |
| `coffee-shop.html` | encarte-monitor | Aconchegante, comercial |
| `cyberpunk.html` | corre-logo | Energético, esportivo |
| `aurora-borealis.html` | corre-logo | Gradientes suaves, natureza |
| `dark-folio.html` | corre-logo dark mode | Escuro refinado, esportivo |
| `neubrutalism.html` | corre-logo | Moderno, ousado |
| `barbiecore.html` | corre-logo | Vibrante, mulheres |
| `vaporwave.html` | corre-logo | Retrô-futurista |
| `editorial.html` | encarte-monitor | Limpo, revista de preços |
| `federal-night.html` | encarte-monitor admin | Sério, governamental |
| `glassmorphism.html` | ambos | Moderno, vítreo |
| `bento-grid.html` | ambos | Organizado em grid |
| `minimalism.html` | ambos | Limpo, foco no conteúdo |

### Impacto no encarte-monitor

```diff
! ANTES:
  CSS atual: Tailwind com configuração minimalista
  Sem personalidade, sem diferenciação visual
  "Parece mais um template"

! DEPOIS:
  "Look at https://github.com/GGPrompts/ggprompts/blob/main/styles/data-bento.html
   and apply that design system to my price comparison platform"
  → Sistema de design completo aplicado em segundos
  → CSS variables extraídas: --primary, --surface, --text
  → Cards de produto com sombras suaves
  → Tabelas com linhas zebradas elegantes
  → Botões com hover states refinados
```

### Impacto no corre-logo

```diff
! ANTES:
  Tema gemstone (agate, tourmaline, amethyst) — interessante, mas inconsistente
  Falta de coesão visual entre telas

! DEPOIS:
  "Look at https://github.com/GGPrompts/ggprompts/blob/main/styles/aurora-borealis.html
   and apply that design system to my running app"
  → Paleta: verdes e azuis aurora (energia natural)
  → Tipografia: Inter + Poppins (moderno, legível)
  → Botões arredondados com gradientes sutis
  → Cards de treino com glassmorphism
  → Dark mode natural (não agressivo para uso ao ar livre)
```

### 🎨 Exemplo visual: Aplicando `data-bento` no encarte-monitor

```diff
! ANTES (layout genérico):
  ┌──────────────────────────────────────┐
  │ Header                               │
  ├────────────┬────────────┬────────────┤
  │ Produto A  │ Produto B  │ Produto C  │
  │ Preço      │ Preço      │ Preço      │
  │ Mercado    │ Mercado    │ Mercado    │
  ├────────────┴────────────┴────────────┤
  │ Footer                               │
  └──────────────────────────────────────┘

! DEPOIS (data-bento grid):
  ┌──────────────────────────────────────┐
  │  🔍 encarte-monitor    [Filtros] 🎯 │
  ├────────────┬────────────┬────────────┤
  │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │
  │ │ 🏆     │ │ │ 🔥     │ │ │ 📈     │ │
  │ │R$ 8,90 │ │ │R$ 5,49 │ │ │R$12,90 │ │
  │ │ -12%   │ │ │ -23%   │ │ │  -5%   │ │ ← badges
  │ │ Arroz  │ │ │ Leite  │ │ │ Café   │ │
  │ │ ⭐•••  │ │ │ ⭐⭐⭐  │ │ │ ⭐•    │ │ ← avaliação
  │ │Guanab. │ │ │ Assaí  │ │ │Mundial │ │
  │ └────────┘ │ └────────┘ │ └────────┘ │
  ├────────────┴────────────┴────────────┤
  │ [📊 Gráfico] [📬 Alerta de Preço]    │
  └──────────────────────────────────────┘
```

---

## 9. Tabela Comparativa

| Repositório | Stars | Tipo | Impacto encarte | Impacto corre | Instalação | Prioridade |
|-------------|-------|------|-----------------|---------------|------------|------------|
| **obra/superpowers** | 237k | Metodologia dev | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Fácil | **ALTA** |
| **garrytan/gstack** | 114k | Time virtual | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Média | **ALTA** |
| **mattpocock/skills** | 143k | Engenharia real | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Fácil | **ALTA** |
| **nextlevelbuilder/ui-ux-pro-max** | 95.6k | Design system | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Fácil | **ALTA** |
| **Egonex-AI/Understand-Anything** | 66.9k | Knowledge graph | ⭐⭐⭐⭐ | ⭐⭐⭐ | Fácil | **MÉDIA** |
| **anthropics/skills** | 154k | Skills oficiais | ⭐⭐ | ⭐⭐ | Fácil | **BAIXA** |
| **GGPrompts/ggprompts** | 32 | CSS style guides | ⭐⭐⭐ | ⭐⭐⭐ | Manual | **BAIXA** |

### Legenda de Impacto

| Nível | Significado |
|-------|-------------|
| ⭐⭐⭐⭐⭐ | Transformador — muda significativamente o produto ou processo |
| ⭐⭐⭐⭐ | Alto impacto — melhorias substanciais |
| ⭐⭐⭐ | Médio impacto — benefícios notáveis |
| ⭐⭐ | Baixo impacto — útil em situações específicas |
| ⭐ | Mínimo — quase nenhum ganho |

---

## 10. Recomendações

### 🥇 Instalação imediata (todas juntas, são complementares)

| Ordem | Skill | Motivo |
|-------|-------|--------|
| 1 | **nextlevelbuilder/ui-ux-pro-max** | Design system profissional para AMBOS os apps. Resultado visual imediato. |
| 2 | **garrytan/gstack** | QA, review, segurança, deploy — ciclo completo de desenvolvimento. Ideal para o encarte-monitor que está em produção. |
| 3 | **mattpocock/skills** | TDD + domain-modeling + architecture improvement. Essencial para a saúde de longo prazo dos projetos. |
| 4 | **obra/superpowers** | Metodologia base. Funciona bem EM CONJUNTO com gstack (são filosofias complementares). |
| 5 | **Egonex-AI/Understand-Anything** | Onboarding e documentação. Use quando precisar entender ou documentar a arquitetura. |
| 6 | **GGPrompts/ggprompts** | Use como "catálogo de inspiração" — encontre um estilo e aplique com o UI/UX Pro Max. |
| 7 | **anthropics/skills** | Skills de documento (PDF/xlsx) — úteis mas não prioritárias. |

### 🎯 Recomendação específica por app

**encarte-monitor:**
```
PRIORIDADE MÁXIMA:
  1. gstack → /qa para testar scrapers, /cso para segurança, /investigate para debug
  2. UI/UX Pro Max → Data-Dense Dashboard + paleta econômica
  3. Understand-Anything → Mapear os 10+ módulos de supermercado

RESULTADO:
  - Scrapers mais estáveis (QA + debugging sistemático)
  - UI profissional de plataforma de preços
  - Arquitetura documentada e compreensível
```

**corre-logo:**
```
PRIORIDADE MÁXIMA:
  1. UI/UX Pro Max → Soft UI Evolution + paleta energética
  2. gstack → /design-consultation para reconstruir do zero com design system
  3. mattpocock/skills → TDD para lógica de GPS e pace

RESULTADO:
  - App visualmente profissional e motivacional
  - Código testado e robusto
  - Experiência mobile-first de alta qualidade
```

### Compatibilidade entre skills

```
gstack (QA, review, deploy)
  ├── Funciona BEM com → superpowers (metodologia complementar)
  ├── Funciona BEM com → mattpocock (TDD + domain-modeling)
  └── Funciona BEM com → UI/UX Pro Max (design review)

UI/UX Pro Max (design systems)
  └── Pode usar → GGPrompts (como referência de estilo)

Understand-Anything (knowledge graph)
  └── Independe dos outros — uso sob demanda
```

**Não há conflitos entre eles** — cada um opera em uma camada diferente:
- `superpowers` → **como** desenvolver
- `mattpocock` → **qualidade** do código
- `gstack` → **time virtual** completo
- `ui-ux-pro-max` → **design** dos apps
- `ggprompts` → **inspiração** visual
- `understand-anything` → **compreensão** do código
- `anthropics/skills` → **documentos**

---

## Resumo Final

```
📊 encarte-monitor + 🏃 corre-logo
         │
         ├── 🎨 UI/UX Pro Max → Design system profissional
         │    └── dashboards elegantes + UX consistente
         │
         ├── 🛠️  gstack → Time de engenharia virtual
         │    ├── /qa → Testes reais em navegador
         │    ├── /review → Code review automatizado
         │    ├── /cso → Segurança (OWASP + STRIDE)
         │    └── /ship → Deploy com qualidade
         │
         ├── 🧪 mattpocock/skills → TDD + domain-modeling
         │    └── Código testado e arquitetura limpa
         │
         ├── 🧠 superpowers → Metodologia de desenvolvimento
         │    └── Processo consistente, menos retrabalho
         │
         ├── 🔍 Understand-Anything → Knowledge graph
         │    └── Onboarding rápido, documentação viva
         │
         └── 🎨 GGPrompts → 204 estilos CSS prontos
              └── Inspiração visual para aplicar com UI/UX Pro Max

═══ RESULTADO: 2 apps profissionais, testados, seguros e bonitos ═══
```
