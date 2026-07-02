# TODO — Corre Logo

> Arquivo persistente de tarefas.
> Pendentes organizados por prioridade. Concluídos organizados por data.

---

## Pendentes

### Alta
- [ ] Função de Repetição na criação manual de treino
- [ ] Painel deslizante de steps do treino: garantir texto totalmente visível ou scroll vertical interno

### Média
- [ ] Calendário de Treinos
- [ ] Área do Usuário (perfil, configurações)
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
- [ ] U6. Tela principal com 7+ ações — hierarquia visual
- [ ] U10. Link morto nos Termos de Serviço
- [ ] U14. Re-exportação de treino após fechar summary

### Baixa
- [ ] Áudio Ducking Android: é possível?

---

## Concluídos

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
