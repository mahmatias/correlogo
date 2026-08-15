# Roadmap - Backlog & Decisões

## Backlog Ativo (Prioridade)

| ID | Item | Esforço | Prioridade | Status |
|----|------|---------|------------|--------|
| BK-01 | Botão Nav Back fecha app em modal treino manual | Baixo | Alta | 🔴 Aberto |
| BK-02 | Foto perfil não carrega no APK (CSP) | Baixo | Média | 🟡 Testar |
| BK-03 | Outdoor HC export falha (route fallback funciona) | Médio | Alta | 🟡 Em análise |
| BK-04 | Dados PII / LGPD (export/delete) | Alto | Legal | 🔴 Aberto |
| BK-05 | Skeleton loading timeout 5s → reduzir | Baixo | Baixa | 🟢 Backlog |
| BK-06 | `favicon.ico` 404 | Trivial | Cosmético | 🟢 Backlog |

---

## Roadmap Técnico

### Q3 2026 (Jul-Set)
- [ ] **BK-01** Fix Nav Back button
- [ ] **BK-03** Fix outdoor HC export (route validation)
- [ ] **BK-04** LGPD compliance (data export/delete API)
- [ ] Migrate `localStorage` → Jetpack DataStore (native)
- [ ] Background sync via WorkManager

### Q4 2026 (Out-Dez)
- [ ] FIT export (binary format)
- [ ] Heart rate / cadence sensors (BLE)
- [ ] Social features (share treino, leaderboards)
- [ ] Apple HealthKit (iOS future)
- [ ] Widget Android (próximo treino)

### 2027+
- [ ] Multi-device sync (web + mobile + watch)
- [ ] AI coaching (Gemini integration)
- [ ] Community challenges
- [ ] Nutrition tracking

---

## Decisões Arquiteturais (ADRs)

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| ADR-001 | Capacitor over React Native | ✅ Aceito | 2026-01 |
| ADR-002 | Firebase over custom backend | ✅ Aceito | 2026-01 |
| ADR-003 | Health Connect vs Samsung Health | ✅ Aceito | 2026-07 |
| ADR-004 | Strava via Gmail API (não HC) | ✅ Aceito | 2026-07 |
| ADR-005 | Web Client ID único (web + APK) | ✅ Aceito | 2026-07 |
| ADR-006 | ActivityResultLauncher (HC perms) | ✅ Aceito | 2026-07 |
| ADR-007 | Serverless (Firebase Functions) | ✅ Aceito | 2026-07 |
| ADR-008 | Vite only (no Express) | ✅ Aceito | 2026-07 |

---

## Technical Debt

| Área | Item | Risco |
|------|------|-------|
| **App.tsx** | 1400+ linhas, multiple responsibilities | Alto - Refactor em módulos |
| **WorkoutTracker.tsx** | 900+ linhas, timer + GPS + TTS + UI | Alto - Split em hooks/components |
| **localStorage sync** | Race conditions potenciais | Médio - Migrar para DataStore |
| **Error boundaries** | Ausentes | Médio - Adicionar React Error Boundary |
| **Tests** | 0% coverage | Alto - Adicionar Vitest + Playwright |
| **TypeScript strict** | `strict: false` no tsconfig | Baixo - Habilitar gradualmente |

---

## Métricas de Sucesso (KPIs)

| Métrica | Atual | Target Q4 2026 |
|---------|-------|----------------|
| Usuários ativos/semana | ~50 | 200 |
| Sessões completadas/semana | ~30 | 150 |
| HC sync success rate | ~85% | 95% |
| Strava email delivery | 100% | 100% |
| Crash-free sessions | 99.2% | 99.9% |
| APK size | 9 MB | < 10 MB |

---

## Release Process

### Versionamento

- **Build** (`versionCode`): automático. Toda release de APK gera build nova (`GITHUB_RUN_NUMBER + 100` no CI) — é o que garante o auto-update in-app. Sem decisão manual.
- **Versão** (`versionName`): 2 partes (`X.Y`), decidida pelo tamanho da mudança:

| Mudança | Ação | Exemplo |
|---------|------|---------|
| **Minor** | Sobe o número após o ponto | `4.1` → `4.2` |
| **Major** | Sobe o número antes do ponto (zera o Y) | `4.2` → `5.0` |

### Critério Major vs Minor

| Classificação | Exemplos |
|---------------|----------|
| **Major** — quebra de fluxo visível OU entrega grande | Migração de dados; fluxo de login/auth diferente; mudança na estrutura de dados salva; requisito de Android mínimo maior; remoção de feature; **módulo novo inteiro** (ex: integração relógio/Health Connect) |
| **Minor** — todo o resto | Feature menor; bugfix; ajuste de UI; melhoria de desempenho |

> Regra prática: se o usuário final precisa aprender a usar algo novo ou se o comportamento existente muda de forma visível → **Major**. Se é uma melhoria que não exige mudança de hábito → **Minor**.

### Versionamento Atual
```
v4.1 (versionCode 158) - import de relógio via Health Connect + bump build (2026-08-15)
v3.4 (versionCode 135) - auto-update + Firebase App Distribution (2026-07-31)
v3.0 (versionCode 129) - app 3.0 (2026-07-30)
v2.2 (versionCode 19) - Strava via Gmail + HC fixes
v2.1 (versionCode 18) - HC route fallback
v2.0 (versionCode 11) - ActivityResultLauncher fix
```

---

*Última revisão: 2026-08-15*