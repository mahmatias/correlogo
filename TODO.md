# TODO — Corre Logo

> Arquivo persistente de tarefas.
> Pendentes organizados por prioridade. Concluídos organizados por data.

---

## Pendentes

### Alta
- [ ] Função de Repetição na criação manual de treino
- [ ] Os geradores Standard/ImprovePace também devem escalar duração mínima (clampedWeeks do iniciante)

### Média
- [ ] Onboarding para novos usuários (vazio do calendário sem planos) — perdido na refatoração
- [ ] S5. Dados PII (gênero, data nascimento) — coletados mas nunca usados
- [ ] S8. dotenv não importado no server.ts
- [ ] P5. Sem useCallback / React.memo
- [ ] P9. vite em dependencies E devDependencies
- [ ] D1. firestore.indexes.json não versionado
- [ ] D2. Documento único data/plans — migrar para subcoleção
- [ ] D7. setDoc sem merge sobrescreve documento
- [ ] D8. Sem onSnapshot — abas dessincronizadas
- [ ] U2. Gerador com 15+ campos — simplificar
- [ ] U3. Visão de progresso (streak, evolução, PRs)
- [ ] U10. Link morto nos Termos de Serviço
- [ ] U14. Re-exportação de treino após fechar summary

### Baixa
- [ ] Áudio Ducking Android: é possível?

---

## Concluídos

### 2026-07-04 — Kotlin TrackingPlugin (foreground GPS + step counter)
- ✅ Android `TrackingService.kt` — foreground service com GPS (FusedLocationProviderClient, 3s interval) + step counter (TYPE_STEP_COUNTER)
- ✅ Android `TrackingPlugin.kt` — Capacitor plugin (startTracking, stopTracking, getStepCount) com declarações de permissão
- ✅ `MainActivity.java` registra TrackingPlugin via `registerPlugin(TrackingPlugin.class)`
- ✅ Kotlin suporte + play-services-location adicionados ao build.gradle

### 2026-07-04 — Correções no gerador, data editing, marcador de prova
- ✅ Data editável: bloqueio de digitação manual (`onKeyDown e.preventDefault`) no input date
- ✅ Gerador iniciante: remove cap de 16 semanas; `mapTableIndex` interpola a tabela runna para qualquer duração (6-52 sem); fim do plano com data de prova insere marcador 🏁
- ✅ Marcador de prova no calendário: `isRaceMarker` no `WorkoutPlan`, bolinha amber-500 no `WeekCalendar`, legenda "Prova"
- ✅ Renderização condicional: `isRaceMarker` oculta botões de ação, duração e input de data

### 2026-07-02 — Calendário de Treinos + Fixes
- ✅ Calendário semanal horizontal (WeekCalendar) com navegação entre semanas
- ✅ BottomSheet para ações de plano (Novo Treino Manual, Treino Livre, Gerador Automático, Carregar/Substituir, Apagar)
- ✅ `scheduledDate` adicionado ao WorkoutPlan; datas atribuídas automaticamente em todos os fluxos de criação
- ✅ Lista de treinos vinculada ao dia selecionado no calendário
- ✅ Saudação personalizada ("Olá, {nome}")
- ✅ Export JSON removido da UI (atalho)
- ✅ Fix: completed plans sem `scheduledDate` aparecem com bolinha verde via `TrainingSession.date`
- ✅ Badge "X restantes" quando hoje está selecionado (total de planos incompletos)
- ✅ "Realizada em DD/MM/AAAA às HH:MM:SS" no SessionSummary
- ✅ Data programada editável (input date em cada card de plano)
- ✅ Gerador com startDate + distribuição automática de scheduledDate no calendário
- ✅ Controle de carga: sessões regenerativas para iniciante em dias excedentes a daysOfWeek
- ✅ Onboarding para novos usuários (tela de boas-vindas com CTAs)
- ✅ Deploy para produção (`a9f80b1`)

### 2026-07-01 — Google Auth + CSP
- ✅ Testar modo GPS com localização em movimento mock
- ✅ Sessões de análise pós treino, origem das informações
- ✅ Continuar como treino livre após objetivo

### 2026-06-25 — Pendências do audit
- ✅ React.lazy(SessionSummary) + MapComponent com Suspense
- ✅ Remover @google/genai, @vis.gl/react-google-maps, motion, uuid
- ✅ Substituir uuidv4() por crypto.randomUUID()
- ✅ Criar firestore.rules + firebase.json versionados
- ✅ writeBatch para deleção em lote (em vez de for...of deleteDoc)
- ✅ enableIndexedDbPersistence no firebase.ts
- ✅ Mapear erros Firebase Auth para português (Login/Signup)
- ✅ Feedback visual (toast) em falhas de save
- ✅ Onboarding / welcome screen
- ✅ Adicionar auth/missing-password ao mapa de erros pt-BR
- ✅ Corrigir feedback "salvo" ao deletar plano
- ✅ Adicionar opção de deletar atividades no histórico

### 2026-06-25 — Correções e features (pré-audit)
- ✅ Identidade visual Pôr-do-Sol (paleta, CSS variables, Geologica + IBM Plex Sans)
- ✅ Acessibilidade (aria-labels, focus-visible, roles ARIA)
- ✅ Perfil A substituído por Runna Couch-to-5K (16 semanas, 2 treinos/semana)
- ✅ Perfis B/C: teto pace Easy = refPace + 2
- ✅ Walk pace mínimo 12 min/km
- ✅ Anúncios de voz ("Caminhada", "quase lá" só em corrida)
- ✅ Treino Livre (step único 24h, isFreeTraining)
- ✅ Delete individual com flag manual
- ✅ SSH + git remoto configurado
- ✅ Cache localStorage + Promise.all + limit(50) + timeout 5s
- ✅ Sync offline→online automático
- ✅ Analytics sob demanda + timing logs
- ✅ Firestore ativado no correloco-dev-9a96a
- ✅ firebase-applet-config.json removido do git
- ✅ Componente Button (variants primary/secondary/ghost/danger, sizes sm/md/lg)
- ✅ Componente Modal (dialog/alertdialog)
- ✅ Skeleton loading (animate-pulse + bg-bg-elevated)
- ✅ Empty states com ícone + CTA
- ✅ Toast em vez de alert()
- ✅ Touch targets ≥ 44px
- ✅ text-[10px] → text-xs, truncate, opacity-70
- ✅ max-w-lg → max-w-xl
- ✅ Keyboard handlers nos controles
- ✅ Animação expand/collapse com transition

### 2026-06-25 — Fixes S3, S7, U9, U12, U13, U15
- ✅ S3. Servidor Express com helmet (CSP/HSTS/X-Frame-Options)
- ✅ S7. GOOGLE_MAPS_PLATFORM_KEY removido do vite.config.ts (morto)
- ✅ U9. Signup com link "Já tem conta? Entrar"
- ✅ U12. Botão DESCARTAR com estilo secundário (bg-bg-elevated + border)
- ✅ U13. Google Login com fallback signInWithRedirect se popup for bloqueado
- ✅ U15. Aviso explícito de "apagado permanentemente" no modal de uncomplete
