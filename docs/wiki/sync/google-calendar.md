# Sync - Google Calendar

## Visão Geral

Exporta planos de treino como eventos no Google Calendar (`.ics` via API).

---

## OAuth Flow

Mesma Cloud Function `authCallback` do Gmail, com state prefix `c3_`.

| Item | Valor |
|------|-------|
| Scope | `https://www.googleapis.com/auth/calendar` |
| State Prefix | `c3_` |
| Token Key | `google_calendar_token` |
| Modal | `GoogleCalendarModal.tsx` |

---

## Modal UI (GoogleCalendarModal.tsx)

```typescript
// Fluxo simplificado
const connectCalendar = async () => {
  const state = 'c3_' + crypto.randomUUID();
  sessionStorage.setItem('gcal_oauth_state', state);
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: WEB_CLIENT_ID,
    redirect_uri: 'https://correlogo.web.app/auth/google/callback',
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    include_granted_scopes: 'true',
    state,
    prompt: 'consent',
  })}`;
  
  if (isNative()) await Browser.open({ url: authUrl, windowName: '_self' });
  else window.location.href = authUrl;
};
```

---

## Deep Link Handler (App.tsx)

```typescript
// appUrlOpen listener
if (state.startsWith('c3_')) {
  if (token) {
    localStorage.setItem('google_calendar_token', token);
    setPendingOAuthToken(token);
    setShowGoogleCalendarModal(true); // Abre modal já conectado
  }
}
```

---

## Sync Logic (GoogleCalendarModal.tsx)

```typescript
const syncPlans = async () => {
  const token = localStorage.getItem('google_calendar_token');
  if (!token) return;
  
  for (const plan of plans) {
    if (plan.scheduledDate && !plan.isCompleted) {
      // Verifica se já existe (extendedProperty)
      const existing = await listEvents({ 
        privateExtendedProperty: `planId=${plan.id}` 
      });
      
      if (!existing.length) {
        await createEvent({
          summary: plan.name,
          description: formatPlanDescription(plan),
          start: { dateTime: `${plan.scheduledDate}T06:00:00` },
          end: { dateTime: `${plan.scheduledDate}T07:30:00` },
          extendedProperties: { private: { planId: plan.id } },
        });
      }
    }
  }
};
```

---

## Event Structure

```json
{
  "summary": "Treino Longo - 18km",
  "description": "Aquecimento 2km\n3x (Corrida 4km @ 5:30, Caminhada 1km)\nDesaquecimento 1km",
  "start": { "dateTime": "2026-08-15T06:00:00-03:00" },
  "end": { "dateTime": "2026-08-15T07:30:00-03:00" },
  "extendedProperties": {
    "private": { "planId": "plan-uuid-123" }
  },
  "reminders": {
    "useDefault": false,
    "overrides": [
      { "method": "popup", "minutes": 30 },
      { "method": "popup", "minutes": 1440 } // 1 dia antes
    ]
  }
}
```

---

## Cleanup Old Events

```typescript
// Remove eventos de planos deletados/completados
const cleanup = async () => {
  const allEvents = await listEvents({ privateExtendedProperty: 'planId=*' });
  for (const event of allEvents) {
    const planId = event.extendedProperties?.private?.planId;
    if (!plans.find(p => p.id === planId)) {
      await deleteEvent(event.id);
    }
  }
};
```

---

## Scopes & Consent

| Scope | Tipo | Consent Screen |
|-------|------|----------------|
| `calendar` | Sensível | Test users only |

> App em "Testing" → só test users podem autorizar.

---

## Troubleshooting

| Erro | Causa | Fix |
|------|-------|-----|
| `401` token | Expirado (1h) | Refresh via `access_type=offline` |
| `403` insufficient | Scope não autorizado | Re-authorize com `prompt=consent` |
| Evento duplicado | `planId` não único | Usar `planId` como `extendedProperty` |
| Modal não abre | `pendingOAuthToken` não setado | Verificar `setPendingOAuthToken()` |

---

*Última revisão: 2026-07-29*