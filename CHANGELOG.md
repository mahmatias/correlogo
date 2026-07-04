# Changelog

## [2026-07-04c]
- **Fix logout redirect:** `onAuthStateChanged(null)` branch agora chama `finalizeAuth()` + `setShowUserProfile(false)`, liberando `checkingAuth` para exibir tela de login em vez de spinner infinito
- **Blocos de repetição no WorkoutEditor:** cada bloco tem `repeat: N` (1–99); steps dentro do bloco são duplicados N vezes na expansão ao salvar. Ex: bloco 2x [corrida, caminhada] → corrida, caminhada, corrida, caminhada. Suporta múltiplos blocos com reordenação, add/remove step por bloco

## [2026-07-04] (continuação)
## [2026-07-04b]
- **Calendário mensal expansível:** componente `MonthCalendar` com grade completa do mês, navegação < > entre meses, bolinhas de status (accent=planejado, accent-secondary=completo, amber=prova), indicador do dia atual e selecionado. Toggle v/^ abaixo da linha de semana com animação expand/collapse.
- **Export iCal:** `src/lib/ical.ts` gera arquivo .ics válido (formato RFC 5545) com VEVENT para cada plano com `scheduledDate`. Botão "Exportar para Calendário (.ics)" no menu de Planos.
- **Cores Opção 1 (acessibilidade):** selected state troca `bg-accent` por `border-2 border-accent` + `bg-bg-elevated` — bolinha programado fica visível. Barra progresso do Finalizar: `bg-accent-secondary/45` (âmbar) em vez de `bg-white opacity-20`. Light mode: accent `#C70048`, accent-secondary `#D49400`.

## [2026-07-04]
- **Gerador iniciante adaptável:** tabela runna de 16 semanas agora escala para qualquer duração (6-52 sem). `mapTableIndex` interpola linearmente os índices da tabela para N semanas; fim de plano com data de prova insere marcador 🏁 no calendário
- **Bloqueio de digitação manual no campo de data:** `onKeyDown={(e) => e.preventDefault()}` no input `type="date"` impede entrada numérica livre que causava saltos de data imprevisíveis
- **Marcador de prova no calendário:** quando `raceDate` é definida, um plano `isRaceMarker: true` é adicionado ao programa com `scheduledDate = raceDate`; a bolinha laranja (amber-500) aparece no dia no `WeekCalendar` com legenda "Prova"
- **Renderização condicional de racemarker:** `isRaceMarker` oculta botões de ação (completar, iniciar, histórico) e input de data no card do plano

## [2026-07-02]
- **Calendário de treinos:** página reformulada com layout centrado no calendário semanal
- **Novos componentes:** `WeekCalendar` (semana horizontal, 7 dias, bolinhas de status), `BottomSheet` (menu deslizante de ações de plano)
- **Saudação personalizada:** "Olá, {displayName}" extraído do perfil do usuário
- **Planos com data:** campo `scheduledDate` adicionado ao `WorkoutPlan`; planos manuais, importados e de programa ganham data automaticamente
- **Lista vinculada:** planos filtrados por dia selecionado no calendário; navegação entre semanas
- **Export JSON:** atalho removido da UI (função mantida como dead code)
- **Deploy:** `a9f80b1` → produção (correlogo.sytes.net)
- **Fixes:** completed plans sem `scheduledDate` agora mostram bolinha verde via session date; badge mostra "X restantes" quando hoje está selecionado; "Realizada em" adicionado ao SessionSummary
- **Countdown na atividade:** tempo da volta exibido de forma decrescente em etapas por tempo; distância decrescente em etapas por distância; TTS adaptado ("2:30 minutos" / "1,75km")
- **Data programada editável:** input `type="date"` em cada card de plano; mudar a data reposiciona o plano no calendário automaticamente
- **Gerador com startDate:** usuário escolhe data de início; `calculateTotalWeeks` usa `startDate` em vez de `Date.now()`; `assignScheduledDates` distribui sessões no calendário conforme `daysOfWeek`
- **Controle de carga:** iniciante com mais de 2 dias/semana ganha sessões regenerativas (caminhada 15 min + trote curto) nos dias extras
- **Onboarding:** tela de boas-vindas com Rocket + CTAs para novos usuários sem planos

## [2026-06-25]
- **UI audit — 16 itens corrigidos (P0 a P3):**
  - P0: Fontes aplicadas (Geologica em headings, IBM Plex Sans no body)
  - P0: 18x `text-gray-500` → `text-text-muted`, 5x `text-gray-600` → `text-text-secondary` no TrainingGenerator
  - P1: Cores hardcoded substituídas por tokens temáticos (`text-success`, `text-danger`, `text-warning`, `bg-bg-surface`)
  - P1: Loading states — skeleton no carregamento Firestore, `disabled` + feedback em Login/Signup
  - P1: Componente `<Modal>` extraído (backdrop centralizado, variantes dialog/alertdialog)
  - P1: Componente `<Button>` extraído (variantes primary/secondary/ghost/danger, sizes sm/md/lg)
  - P2: `text-[10px]` → `text-xs` no WorkoutTracker
  - P2: Touch targets ≥ 44px (p-2 nos botões de toggle e mapa)
  - P2: `truncate` em nomes de plano
  - P2: `text-text-muted` → `text-text-secondary` nos labels de estatísticas
  - P2: `opacity-50` → `opacity-70` em planos completos
  - P3: Animação expand/collapse com `max-h` + `opacity` + `transition-all`
  - P3: Empty states com ícone (`Clipboard`/`ClipboardList`) + CTA textual
  - P3: `alert()` substituídos por inline errors em ImportPlan e Login
  - P3: `max-w-lg` → `max-w-xl` no container principal
  - P3: `onKeyDown`/`onKeyUp` nos botões de velocidade (Enter/Space)
- **Performance:** `Promise.all` para carregar planos/sessões/settings em paralelo
- **Performance:** `limit(50)` na query de sessões
- **Performance:** Timeout de 5s nas queries Firestore com fallback para localStorage
- **Performance:** Cache localStorage para sessões (além de planos e tema já existentes)
- **Sync offline:** Dados criados enquanto offline (sessões com `local-*`) são automaticamente sincronizados ao Firestore quando a conexão volta
- **Sync offline:** Planos locais são mesclados com remotos ao reconectar
- **Segurança:** `firebase-applet-config.json` removido do git e adicionado ao `.gitignore`
- **Segurança:** Analytics removido do `init()` do Firebase (carregamento sob demanda), desbloqueando a inicialização
- **Firebase:** Logs de timing adicionados para diagnóstico (console `[timing]`)
- **Firebase:** Firestore ativado no projeto `correlogo-dev-9a96a` (estava desligado)
- **Infra:** `NODE_ENV=production` documentado em AGENTS.md com instruções de restart

## [2026-06-21]
- Infra: Migrated production hosting to AWS EC2 (Ubuntu), domain `correlogo.sytes.net`.
- Fixed: Node process was accidentally running in dev mode (missing `NODE_ENV=production`), causing `server.ts` to mount the Vite dev middleware/HMR instead of serving the static build.
- Fixed: Production build had stale Firebase config baked in because `.env` was edited after the last build; required `npm run build` + `pm2 restart` to take effect (Vite env vars are compile-time, not runtime).
- Added: PM2 process management (`correlogo`), registered with systemd so the app survives reboots.
- Added: Nginx as a reverse proxy (port 80/443 → 3000), removing the need for a port number in the public URL.
- Added: SSL certificate via Let's Encrypt/Certbot, with automatic HTTP→HTTPS redirect and renewal.
- Added: Explicit Nginx block denying access to `.env`/`.git` files, as defense-in-depth on top of Express's existing behavior.
- Security: Removed public inbound access to port 3000 from the EC2 Security Group; the app is now only reachable via 80/443 through Nginx.
- Changed: `vite.config.ts` now sets `server.allowedHosts: ['correlogo.sytes.net']` to allow the dev server to respond to that host (prevents the "Blocked request... not allowed" error).

## [2026-06-18]
- Fixed: Dark mode preference persistence (now correctly loads from Firebase or system preference).
- Fixed: Workout completion logic, including automatic confirmation prompt and state resetting.
- Fixed: Issue preventing starting a new workout after finishing one, by ensuring proper component re-initialization via the `key` prop on `WorkoutTracker` in `App.tsx`.
- Improved: State management in `WorkoutTracker.tsx` to prevent re-render errors when finishing workouts.
- Improved: Firestore integration test logging to verify data saving.
