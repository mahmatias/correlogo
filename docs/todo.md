# TODO — Corre Logo

## Completed This Session (2026-07-30)

- [x] **ShareCard system** — 3 variantes de card (Gradiente, Vidro, Mapa) 1080×1920 para Instagram Stories
- [x] **Compartilhar flow** — botão no SessionSummary → modal estilo + stats → preview → PNG capture → share sheet nativa
- [x] **Deps installed** — `dom-to-image-more`, `@capacitor/share` (com `--legacy-peer-deps`)
- [x] **Push vazio** (`cc97584`) enviado para `main` para disparar CI e testar autoupdate
- [x] **Build web passou** limpo ✅

## Pendente

- [ ] **Testar Compartilhar em device real** — validar que `dom-to-image-more` captura o card corretamente e `@capacitor/share` abre o share sheet
- [ ] **Mapa variante C** — validar SVG polyline com dados GPS reais (start/end markers, fidelidade do path)
- [ ] **Re-authorizar Gmail 1x** — Token atual não tem `refresh_token`; expira em ~1h. Precisa autorizar Gmail de novo pelo app para capturar o `refresh_token` agora que a CF devolve ele.
- [ ] **Testar CI rodou e gerou versionCode novo** — verificar GitHub Actions após push `cc97584`

## Next Phase

- [ ] Testar autoupdate in-app (APK atualizado)
- [ ] Testar Strava auto-save com treino esteira (end-to-end)
- [ ] Validar refresh token não expira mais (esperar >1h)
