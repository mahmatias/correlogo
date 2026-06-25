# UI Audit Report — Corre Logo

**Data:** 25/06/2026 | **11 arquivos analisados**

---

## 🔴 Críticos (P0)

### 1. Fontes carregadas mas nunca aplicadas
`index.css:5-7` define `--font-display: Geologica`, `--font-body: IBM Plex Sans`, `--font-mono: IBM Plex Mono` no `@theme` e carrega as três famílias via Google Fonts. **Nenhum componente** usa `font-display`, `font-body` ou `font-mono`. O app renderiza em sans-serif padrão do navegador. A identidade visual Pôr-do-Sol é perdida.

**Consertar:** Adicionar `font-body` ao `<body>` (ou classe global) e `font-display` a todos os `<h1>`–`<h3>`.

**Arquivos:** `index.css:5-7`, todos os `.tsx`

### 2. TrainingGenerator — 27+ hardcoded `text-gray-500/600`
`TrainingGenerator.tsx:386-625` usa `text-gray-500` e `text-gray-600` em 27+ lugares. Em dark mode (padrão, `--bg-surface: #12122A`), `text-gray-500` (#6b7280) tem contraste extremamente baixo — formulários de configuração de treino (perfis A/B/C, prova, dias) ficam praticamente ilegíveis.

**Consertar:** Substituir por `text-text-muted` e `text-text-secondary`.

---

## 🟡 Altos (P1)

### 3. Cores hardcoded em avaliações, alerts e validações
- `SessionSummary.tsx:114`: `bg-yellow-100 p-3 rounded-lg text-yellow-800` — fundo amarelo claro dissonante em dark mode
- `ProgramReview.tsx:37`: `bg-yellow-50 border border-yellow-200 text-yellow-800`
- `Signup.tsx:75,81,88,93-95,101,110`: `text-green-500` e `text-red-500` para validação
- `MapComponent.tsx:64-67`: `bg-white` nos botões de camada do mapa — quadrados brancos brilhantes flutuando sobre fundo escuro

**Consertar:** Criar tokens `--color-success`, `--color-error`, `--color-warning-surface` em `index.css` e usá-los nos componentes.

### 4. Sem estados de carregamento
- `App.tsx:46-101`: Durante fetch de plans/sessions do Firestore, UI fica vazio → "pula" para populado. Sem skeleton/spinner.
- `Login.tsx:68, Signup.tsx:111`: Botões sem estado `disabled`/`loading` durante auth. Usuário pode clicar múltiplas vezes.

**Consertar:** Adicionar estado `loading` + skeleton placeholders + disabled state em botões.

### 5. Inconsistência de modais
Três padrões diferentes:
- `App.tsx:344,513,538`: Centralizado com backdrop preto (`p-8 rounded-3xl shadow-2xl`, `bg-opacity-50/70`)
- `SessionHistory.tsx:12`: Tela cheia (`fixed inset-0`, sem backdrop)
- `WorkoutEditor.tsx / TrainingGenerator.tsx / ProgramReview.tsx`: Renderizados inline no fluxo

### 6. Botões com padding, forma e estilo inconsistentes

| Componente | Padding | Border radius | Contexto |
|---|---|---|---|
| App.tsx "Novo Treino Manual" | `p-2` | `rounded-lg` | Primary action |
| App.tsx "Gerador Automático" | `p-2` | `rounded-lg` | Primary action |
| App.tsx "Treino Livre" | `p-3` | `rounded-lg font-semibold` | Primary action |
| WorkoutTracker "Finalizar" | `py-4` | `rounded-full` | Primary action |
| WorkoutTracker Speed +/- | `p-4` | (implícito) | Secondary action |
| Login "Entrar" / Google | `p-2` | `rounded-lg` | Primary action |
| ImportPlan "Importar" | `py-3` | `rounded-xl` | Primary action |
| WorkoutEditor "Add Step" | `p-2` | (implícito) | Secondary action |

**Consertar:** Extrair componente `<Button>` com variantes (`primary`, `secondary`, `ghost`, `danger`) e sizes (`sm`, `md`, `lg`).

---

## 🟠 Médios (P2)

### 7. `text-[10px]` na barra de objetivo e labels
`WorkoutTracker.tsx:432,446,447`: Grid de estatísticas e texto do marquee usam `text-[10px]` — abaixo do mínimo recomendado de 12px para legibilidade, especialmente em mobile.

**Consertar:** Usar `text-xs` (12px) ou criar token `text-2xs` (11px).

### 8. Touch targets abaixo de 44px
- `MapComponent.tsx:64-67`: Botões de camada com `p-1 text-xs` ≈ 20-24px de área tocável (WCAG 2.5.8)
- `App.tsx:455`: Botão toggle de complete/incomplete sem padding explícito — só o ícone (~16px)

### 9. Nomes longos de plano sem truncate
`App.tsx:459`: `<span>` do nome do plano sem `truncate`. Nomes como "Semana 12 — Build — Intervalo" quebram layout.

### 10. `text-text-muted` superutilizado para labels
`SessionSummary.tsx:80,84,88,92`: Labels de estatísticas ("Total Distância", "Total Tempo") usam `text-text-muted` — deveriam usar `text-text-secondary` para legibilidade. `App.tsx:463`: Duração do plano também usa `text-text-muted`.

### 11. Planos completos com `opacity-50` agressivo
`App.tsx:449`: `opacity-50` em planos completos dificulta leitura do nome. Melhor: `opacity-70` + checkmark accent.

---

## 🔵 Baixos (P3)

### 12. Sem animação expand/collapse
`App.tsx:492`: Seção de passos do plano aparece/desaparece instantaneamente via renderização condicional.

### 13. Empty states sem ícone nem CTA
`App.tsx:446`: "Nenhum plano carregado ainda." — só texto. `SessionHistory.tsx:19`: "Nenhuma sessão encontrada." — idem.

### 14. `alert()` nativo em vez de toast in-page
`ImportPlan.tsx:69,91,100` e `Login.tsx:54`: Usam `alert()` do navegador — dialogo sem estilo, quebra fluxo.

### 15. `max-w-lg` (512px) estreito demais em tablets
`App.tsx:287`: Container principal. Em tablets (768px+), sobra muito espaço nas laterais. Considerar `max-w-xl` ou breakpoint responsivo.

### 16. Keyboard-equiv ausente em controles de velocidade
`WorkoutTracker.tsx:473-477,487-491`: Botões de ajuste de velocidade usam `onMouseDown`/`onTouchStart` mas não têm `onKeyDown`. Inoperáveis por teclado.

---

## Plano de ação consolidado — Status da execução

### Fase 1 — Identidade Visual + Segurança ✅ (Completa)
1. ✅ Aplicar `font-display`/`font-body` (P0)
2. ✅ Substituir 27+ `text-gray-*` no TrainingGenerator
3. ✅ Criar tokens `--color-success/error/warning`
4. ✅ **Rotacionar chaves do `firebase-applet-config.json` e remover do git**
5. ✅ Versionar `firestore.rules` + `firebase.json`

### Fase 2 — Componentes + Performance ✅ (Completa)
6. ✅ Extrair `<Button>` com variantes
7. ✅ `React.lazy(SessionSummary)` + `React.lazy(MapComponent)` (~700KB)
8. ✅ Padronizar modais — componente `<Modal>` extraído
9. ✅ Adicionar `limit(50)` na query de sessões
10. ✅ Remover `@google/genai`, `@vis.gl/react-google-maps`, `motion`, `uuid`

### Fase 3 — UX + Banco de Dados ✅ (Completa)
11. ✅ Onboarding / welcome screen
12. ✅ Loading states + skeleton
13. ✅ Mapear erros Firebase para português
14. ✅ Feedback visual em falhas de save
15. ✅ `writeBatch` para deleção em lote
16. ✅ `enableIndexedDbPersistence`

### Fase 4 — Polimento ✅ (Completa)
17. ✅ Touch targets ≥ 44px
18. ✅ `text-[10px]` → `text-xs`, `truncate`, `opacity-70`
19. ✅ Empty states com ícone + CTA
20. ✅ Toast em vez de `alert()`
21. ✅ Responsivo: breakpoints tablet
22. ✅ Keyboard handlers nos controles

---

# Segurança

## 🔴 Críticos

### S1. `firebase-applet-config.json` com credenciais reais versionadas
`firebase-applet-config.json` contém chave de API, projectId, storageBucket **reais** do Firebase do projeto `zealous-arcanum-nwfkz` — e está **trackeado no git**. Qualquer pessoa com acesso ao repositório pode usar essas credenciais.

**Consertar:** Rotacionar chaves e adicionar ao `.gitignore`.

### S2. Nenhum arquivo de regras de segurança Firestore no repositório
Sem `firestore.rules`, sem `firebase.json`, sem `.firebaserc`. Não há como auditar ou versionar as regras de segurança. Dependendo das regras no console do Firebase, um cliente malicioso pode ler dados de outros usuários — o escopo `user.uid` é aplicado só no client, nunca no servidor.

**Consertar:** Extrair regras do Firebase Console e versionar em `firestore.rules`.

## 🟡 Médios

### S3. Servidor Express sem headers de segurança
`server.ts`: Sem `helmet`, sem CORS config, sem CSP/HSTS/X-Frame-Options. Nginx mitiga parcialmente em produção, mas o servidor raw não tem defesa.

### S4. Mensagens de erro do Firebase Auth vazadas para o usuário
`Login.tsx:24, Signup.tsx:42`: `err.message` é exibido diretamente. Vaza "EMAIL_EXISTS", "INVALID_PASSWORD" etc. — vetor de enumeração de contas.

**Consertar:** Mapear erros para mensagens genéricas em português.

### S5. Dados PII coletados sem uso claro
`Signup.tsx`: Gênero (com campo livre "Outros"), data de nascimento — coletados mas nunca usados na lógica do app.

### S6. Dois projetos Firebase diferentes no mesmo repositório
`.env` aponta para `correlogo-dev-9a96a` (dev). `firebase-applet-config.json` aponta para `zealous-arcanum-nwfkz` (AI Studio). Pode causar confusão sobre qual projeto está ativo em produção.

### S7. `@google/genai` e `GOOGLE_MAPS_PLATFORM_KEY` mortos
`@google/genai` instalado mas nunca importado. `process.env.GOOGLE_MAPS_PLATFORM_KEY` definido no `vite.config.ts` mas o app usa Leaflet (não Google Maps). `GEMINI_API_KEY` no `.env` vazio e nunca lido.

### S8. `dotenv` instalado mas nunca importado no servidor
`server.ts` não chama `dotenv.config()` — as variáveis `GEMINI_API_KEY` e `APP_URL` do `.env` nunca entram em `process.env` em runtime.

---

# Performance

## Bundle atual
| Asset | Tamanho | Gzip |
|---|---|---|
| `dist/assets/index-*.js` | **1.504 KB (1,47 MB)** | ~414 KB |
| `dist/assets/index-*.css` | 38 KB | ~12 KB |

## 🔴 Críticos

### P1. Nenhum lazy loading ou code splitting
`React.lazy()` não é usado em lugar nenhum. O bundle inicial contém **recharts** (~500 KB) e **leaflet** (~200 KB) mesmo que o usuário nunca veja mapa ou gráfico.

**Consertar:** `React.lazy(SessionSummary)` e `React.lazy(MapComponent)` — redução estimada de **~700 KB** no bundle inicial.

### P2. Query de sessões sem `limit()`
`App.tsx:76-77`: `getDocs(collection(sessions), orderBy('date','desc'))` — sem `limit()`. Usuário com 500 sessões baixa tudo a cada login.

**Consertar:** Adicionar `limit(50)`.

## 🟡 Médios

### P3. Dependências mortas em produção
`package.json` tem 3 dependências **nunca importadas**: `@google/genai`, `@vis.gl/react-google-maps`, `motion`. Vite deve tree-shake, mas polui `package.json`.

### P4. `uuid` substituível por `crypto.randomUUID()`
`uuidv4()` é usado em 2 arquivos. O navegador já suporta `crypto.randomUUID()`, que já é usado em `WorkoutEditor.tsx`. Remover `uuid` e `@types/uuid` elimina ~64 KB.

### P5. Sem `useCallback` / `React.memo`
- Nenhum `useCallback` em App.tsx — handlers como `markAsCompleted`, `onStop` são recriados a cada render
- Nenhum `React.memo` — `MapComponent` renderiza de novo a cada segundo durante GPS (muda `path`, `coords`)

### P6. Google Fonts carregando 3 famílias com 14 pesos
Geologica (6 pesos), IBM Plex Sans (5), IBM Plex Mono (3) — payload de fonte grande. Nenhuma é aplicada.

## 🔵 Baixos

### P7. `writeBatch` não usado em deleção em massa
`App.tsx:180-181`: Loop `for...of` com `deleteDoc` individual. Usar `writeBatch` para até 500 operações em 1 chamada.

### P8. Nenhuma persistência offline do Firestore
`firebase.ts:30`: `initializeFirestore(app, {})` sem `enableIndexedDbPersistence`. App não funciona offline — mas já tem fallback em localStorage.

### P9. `vite` em dependencies E devDependencies
`package.json:29,39`: `vite` aparece nos dois. Manter só em `devDependencies`.

---

# Banco de Dados (Firestore)

## Estrutura atual
```
users/{uid}/
  data/
    plans         ← Documento único: todos os planos como JSON array
    settings      ← { isDarkMode: boolean }
  sessions/       ← Subcoleção: um documento por treino
    {sessionId}/
      planId, planName, date, mode, totalDurationSeconds,
      totalDistanceKm, avgSpeedKmh, completed, points[]
```

## 🔴 Críticos

### D1. Nenhum índice versionado (`firestore.indexes.json`)
Nenhum arquivo de configuração de índices no repositório. A query `sessions` usa `orderBy('date', 'desc')` — sem `where()`, então não precisa de índice composto hoje. Mas se adicionar filtros (ex.: por planId), precisará. Sem versionamento, não há garantia de que índices em produção correspondem ao que o código espera.

### D2. Documento único `data/plans` — risco de contenção e tamanho
Todos os planos de treino são armazenados como um único array JSON em `users/{uid}/data/plans`. Limite de 1 MiB do Firestore. Cada operação de escrita substitui o documento inteiro (`setDoc` sem `merge`). Se dois dispositivos salvam simultaneamente, um sobrescreve o outro.

**Consertar:** Migrar para subcoleção `users/{uid}/plans/{planId}`.

### D3. Query de sessões sem `limit()` (duplicado P2)
`App.tsx:76-77`: Sem `limit()` — busca **todas** as sessões. 1.000 sessões = 1.000 document reads a cada login.

## 🟡 Médios

### D4. Loop N+1 em deleção de sessões
`App.tsx:180-181`: `for...of deleteDoc` — N chamadas de rede para N sessões. Usar `writeBatch`.

### D5. Sem persistência offline do Firestore
`firebase.ts:30`: Firestore inicializado sem `enableIndexedDbPersistence`. App não funciona offline. localStorage como fallback só cobre `plans` e `settings`, não `sessions`.

## 🔵 Baixos

### D6. Três leituras Firestore sequenciais na inicialização
`App.tsx:68,76,84`: `plans`, `sessions`, `settings` lidos em sequência. Poderiam ser paralelizados com `Promise.all`.

### D7. `setDoc` em `data/plans` sem `merge`
`App.tsx:270`: Substitui o documento inteiro. Se `data/plans` tiver outros campos no futuro, serão perdidos.

### D8. Dados podem ficar dessincronizados entre abas
Sem `onSnapshot` — todas as leituras são `getDoc`/`getDocs` únicas. Se o usuário abre duas abas, a aba 2 não vê mudanças feitas na aba 1 até recarregar.

---

# UX — Onboarding, Retenção e Completude

## 🔴 Críticos

### U1. Sem onboarding — primeiro usuário fica perdido
Após login, o usuário vê uma lista de botões técnicos ("Importar JSON", "Exportar", "Apagar Tudo") e um texto "Nenhum plano carregado ainda." sem tutorial, tour ou CTA principal destacado. O título do HTML ainda é "My Google AI Studio App".

**Consertar:** Splash/welcome com value prop, CTA principal destacado, tour opcional, título do HTML = "Corre Logo".

### U2. 15+ campos no gerador — maior carga cognitiva do app
`TrainingGenerator.tsx`: 4 páginas, ~15-20 interações para criar o primeiro plano. Jargões não explicados (VDOT, Limiar, Intervalado, Taper).

### U3. Nenhuma visão de progresso ao longo do tempo
`SessionHistory.tsx` é uma lista plana. Não há: streak semanal, total mensal, gráfico de evolução, detecção de PR, comparação com treinos anteriores.

## 🟡 Médios

### U4. Erros do Firebase expostos ao usuário (S4, duplicado)
`Login.tsx:24, Signup.tsx:42`: Mensagens técnicas em inglês ("Firebase: Error (auth/user-not-found)").

### U5. Falhas de save no Firestore silenciosas
`App.tsx:80-81,91-92,137,186,215,260,272`: Todos os erros de Firestore são `console.error()` sem feedback pro usuário. O app salva em localStorage como fallback, mas o usuário não sabe se o sync falhou.

### U6. Tela principal sobrecarregada — 7+ ações competindo
`App.tsx:399-443`: Import, Novo Treino Manual, Gerador, Exportar, Apagar, Treino Livre + a lista de planos. Sem hierarquia visual de qual ação é primária.

### U7. Sem notificações ou lembretes
Sem push notifications, sem lembretes de treino nos dias marcados, sem e-mail de check-in.

### U8. Sem gamificação
Sem badges, streaks, milestones, detecção de recorde pessoal, metas de distância semanal.

## 🔵 Baixos

### U9. Signup sem link de volta ao Login
`Signup.tsx`: Não há botão "Já tem conta? Entrar". Usuário precisa do back do navegador.

### U10. Dead link nos Termos de Serviço
`Signup.tsx:107`: `href="#"` — link morto. Risco legal.

### U11. Status de validação de senha some ao desfocar
`Signup.tsx:87`: Painel de requisitos aparece só no foco e desaparece no blur. Usuário pode submeter sem saber que a senha é inválida.

### U12. Botão "CANCELAR" com mesmo peso visual do primário
`WorkoutTracker.tsx:537-545`: "DESCARTAR RELATÓRIO" e "SALVAR RELATÓRIO" têm o mesmo estilo. Descarte acidental é fácil.

### U13. Pop-up do Google Login pode ser bloqueado
`Login.tsx:36`: `signInWithPopup` — bloqueado por alguns bloqueadores de pop-up. Sem fallback `redirect`.

### U14. Sem re-exportação de treino após fechar summary
Export TCX/GPX está no `SessionSummary`, que desaparece ao fechar. Não há como re-exportar depois sem reabrir o histórico.

### U15. "Desmarcar treino" destrói a sessão irreversivelmente
`App.tsx:202-218`: Uncomplete plan → `deleteDoc` da sessão. Sem confirmação de que é irreversível.

### U16. Treino Livre com 24h sem explicação
`App.tsx:112`: `durationSeconds: 86400` (24h) sem indicar que é um treino sem limite de tempo. Usuário pode achar que é um bug.

---

# Plano de ação consolidado

## Fase 1 — Identidade Visual + Segurança
1. Aplicar `font-display`/`font-body` (Crítico UI)
2. Substituir 27+ `text-gray-*` no TrainingGenerator
3. Criar tokens `--color-success/error/warning`
4. **Rotacionar chaves do `firebase-applet-config.json` e remover do git**
5. Versionar `firestore.rules`

## Fase 2 — Componentes + Performance
6. Extrair `<Button>` com variantes
7. `React.lazy(SessionSummary)` + `React.lazy(MapComponent)` (~700KB)
8. Padronizar modais
9. Adicionar `limit(50)` na query de sessões
10. Remover `@google/genai`, `@vis.gl/react-google-maps`, `motion`, `uuid`

## Fase 3 — UX + Banco de Dados
11. Onboarding / welcome screen
12. Loading states + skeleton
13. Mapear erros Firebase para português
14. Feedback visual em falhas de save
15. `writeBatch` para deleção em lote
16. `enableIndexedDbPersistence`

## Fase 4 — Polimento
17. Touch targets ≥ 44px
18. `text-[10px]` → `text-xs`, `truncate`, `opacity-70`
19. Empty states com ícone + CTA
20. Toast em vez de `alert()`
21. Responsivo: breakpoints tablet
22. Keyboard handlers nos controles
