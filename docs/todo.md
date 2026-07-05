# TODO

## Concluído — 2026-07-05

- **Fix OAuth invalid_client:** adicionado `VITE_GOOGLE_CLIENT_ID` ao `.env` do servidor (estava ausente, Google rejeitava client_id vazio)
- **Fix OAuth bad request:** `redirect_uri` no GET `/auth/google/callback` hardcoded `http://localhost:3000` → corrigido para usar `APP_URL` (Google exige match exato com a auth request do frontend)
- **Deploy:** rebuild + PM2 restart

## Concluído — 2026-07-04b

- Calendário mensal expansível (MonthCalendar) com grid, navegação, dots, toggle v/^
- Export iCal (.ics) com download button no BottomSheet de Planos
- "Reagendar" movido para modal no card expandido (agenda existentes + novos)
- Bloqueio de digitação manual no input date
- Escala de iniciante para 6-52 semanas (mapTableIndex linear)
- Marcador de prova (🏁, bolinha amber, oculta ações)
- Light mode corrigido com --color-* overrides

## Pendente

- Scaling de duração mínima para geradores Standard e ImprovePace (como já feito no Beginner)
- Skeleton loading visível até 5s — considerar reduzir timeout
- favicon.ico 404 cosmético
- Adicionar `GOOGLE_CLIENT_SECRET` ao `.env` do servidor (está presente, verificar se é o mesmo do Google Cloud Console)
