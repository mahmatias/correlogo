# TODO — Corre Logo

## Completed This Session (2026-07-30)

- [x] **FTMS UUID fix** — `FTMS_MEASUREMENT_CHAR` corrigido `00002a63` → `00002acd`
- [x] **Strava feedback** — `showFeedback` prop no WorkoutTracker para toast de auto-save
- [x] **Refresh Token OAuth** — `authCallback` retorna `refresh_token`; nova CF `refreshAuthToken`; `gmailApi.ts` com refresh automático; `App.tsx` captura `refresh_token`
- [x] **Cloud functions deployed** — `authCallback`, `refreshAuthToken`, `healthCheck` no ar
- [x] **CI/CD GitHub Actions** — Workflow `firebase-deploy.yml` completo: build web → cap sync → assembleRelease → Firebase App Distribution. **Pipeline passou limpo** 🟢
- [x] **Secrets configurados** — 7 repository secrets no GitHub
- [x] **Keystore criado** — `android/app/keystore.jks` (alias `mykey`), backup keep em local seguro

## Pendente (1 blocker)

- [ ] **Re-authorizar Gmail 1x** — Token atual não tem `refresh_token`; expira em ~1h. Precisa autorizar Gmail de novo pelo app para capturar o `refresh_token` agora que a CF devolve ele.

## Next Phase

- [ ] Testar Strava auto-save com treino esteira (end-to-end)
- [ ] Testar APK da CI conecta na esteira e controla treino
- [ ] Validar refresh token não expira mais (esperar >1h)
