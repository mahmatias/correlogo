# TODO — Corre Logo

> Arquivo persistente de tarefas. Atualizado manualmente a cada novo item adicionado.
> Novos itens sempre no topo (mais recente primeiro).

---

## 2026-06-25 — Pendências do audit (todas concluídas)

### Feito
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

## 2026-06-25 — Correções e features (pré-audit)

### Feito
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

---

## Pendentes (não-audit)

### Média Prioridade
- [ ] S3. Servidor Express sem helmet/CSP/HSTS
- [ ] S5. Dados PII (gênero, data nascimento) — coletados mas nunca usados
- [ ] S7. GOOGLE_MAPS_PLATFORM_KEY morto no vite.config.ts
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
- [ ] U9. Signup sem link "Já tem conta? Entrar"
- [ ] U10. Link morto nos Termos de Serviço
- [ ] U12. Botão CANCELAR com mesmo peso visual do primário
- [ ] U13. Google Login com popup (pode ser bloqueado) — fallback redirect
- [ ] U14. Re-exportação de treino após fechar summary
- [ ] U15. "Desmarcar" destrói sessão sem aviso
