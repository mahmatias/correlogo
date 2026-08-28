# Sync - Strava via Gmail API

## Visão Geral

Strava **não importa treinos indoor** (sem GPS) via Health Connect.
Solução: Gmail API envia anexo TCX/GPX → `stravaupload@gotoes.org`

---

## Arquitetura

```
Workout Complete
      │
      ▼
┌─────────────────────────────────────┐
│  sendWorkoutToStravaViaEmail()      │
│  1. Generate TCX (treadmill)        │
│     or GPX (outdoor)                │
│  2. Build MIME multipart/mixed      │
│  3. Base64url encode                │
│  4. POST Gmail API users.me.send    │
└─────────────────────────────────────┘
      │
      ▼
stravaupload@gotoes.org (Strava inbox)
      │
      ▼
Strava processa anexo → Atividade criada
```

---

## gmailApi.ts

```typescript
// src/lib/gmailApi.ts

const SCOPES = 'https://www.googleapis.com/auth/gmail.send';
const TO_EMAIL = 'stravaupload@gotoes.org';
const SUBJECT = 'My Run';  // Título da atividade no Strava

export async function sendWorkoutToStravaViaEmail(
  session: TrainingSession
): Promise<GmailSendResult> {
  
  // 1. OAuth Token (cached in localStorage)
  const token = await getValidAccessToken(); // OAuth flow via Browser.open()
  
  // 2. Generate file content
  const fileContent = session.mode === 'treadmill'
    ? generateTCX(session)
    : generateGPX(session);
  
  const filename = session.mode === 'treadmill' ? 'activity.tcx' : 'activity.gpx';
  const mimeType = session.mode === 'treadmill' 
    ? 'application/vnd.garmin.tcx+xml' 
    : 'application/gpx+xml';
  
  // 3. Build MIME message
  const raw = buildMimeMessage(fileContent, filename, mimeType);
  
  // 4. Send via Gmail API
  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );
  
  if (res.status === 401) {
    clearGmailToken(); // Force re-auth
    return { success: false, error: 'Token expirado. Reconecte o Gmail.' };
  }
  
  return res.ok 
    ? { success: true } 
    : { success: false, error: await res.text() };
}
```

---

## OAuth Flow (Gmail)

### State Prefixes

| Platform | Prefix | Callback |
|----------|--------|----------|
| Web | `gm_web_` | `/?gcal_token=...&state=gm_web_...` |
| APK | `gm_` | `com.correlogo.app://oauth?token=...&state=gm_...` |

### Auth URL

```typescript
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: WEB_CLIENT_ID,
  redirect_uri: 'https://correlogo.web.app/auth/google/callback',
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/gmail.send',
  access_type: 'offline',
  prompt: 'consent',
  state: isNative ? 'gm_' + uuid() : 'gm_web_' + uuid(),
})}`;
```

---

## MIME Message Builder

```typescript
function buildMimeMessage(content: string, filename: string, mimeType: string): string {
  const boundary = 'CorreLogoBoundary_' + crypto.randomUUID().replace(/-/g, '');
  
  const parts = [
    `To: ${TO_EMAIL}`,
    `Subject: ${SUBJECT}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    'Training activity from Corre Logo',
    '',
    `--${boundary}`,
    `Content-Type: ${mimeType}; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    btoa(unescape(encodeURIComponent(content))), // UTF-8 safe
    '',
    `--${boundary}--`,
  ];
  
  return base64url(parts.join('\r\n'));
}

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

---

## TCX Generator (Treadmill)

```typescript
// src/lib/exportUtils.ts
export function generateTCX(session: TrainingSession): string {
  const startTime = new Date(session.date).toISOString();
  
  let trackPoints = '';
  session.points.forEach(p => {
    let position = '';
    if (session.mode === 'outdoor' && p.lat && p.lon) {
      position = `<Position>
        <LatitudeDegrees>${p.lat}</LatitudeDegrees>
        <LongitudeDegrees>${p.lon}</LongitudeDegrees>
        ${p.altitude ? `<AltitudeMeters>${p.altitude.toFixed(1)}</AltitudeMeters>` : ''}
      </Position>`;
    }
    
    trackPoints += `
      <Trackpoint>
        <Time>${new Date(new Date(session.date).getTime() + p.timestampSeconds * 1000).toISOString()}</Time>
        <DistanceMeters>${Math.round(p.distanceKm * 1000)}</DistanceMeters>
        ${position}
        <Extensions>
          <ns3:TPX>
            <ns3:Speed>${(p.speedKmh / 3.6).toFixed(2)}</ns3:Speed>
          </ns3:TPX>
        </Extensions>
      </Trackpoint>`;
  });
  
  return `<?xml version='1.0' encoding='UTF-8'?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Running">
      <Id>${startTime}</Id>
      <Notes>${session.mode === 'treadmill' ? 'Esteira' : 'Outdoor'}</Notes>
      <Lap StartTime="${startTime}">
        <TotalTimeSeconds>${session.totalDurationSeconds}</TotalTimeSeconds>
        <DistanceMeters>${(session.totalDistanceKm * 1000).toFixed(0)}</DistanceMeters>
        <Calories>0</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${trackPoints}
        </Track>
      </Lap>
      <Creator xsi:type="Device_t">
        <Name>Corre Logo</Name>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}
```

---

## GPX Generator (Outdoor)

```typescript
export function generateGPX(session: TrainingSession): string {
  let trackPoints = '';
  
  session.points.forEach(p => {
    if (p.lat && p.lon) {
      trackPoints += `
  <trkpt lat="${p.lat}" lon="${p.lon}">
    <ele>${(p.altitude ?? 0).toFixed(1)}</ele>
    <time>${new Date(new Date(session.date).getTime() + p.timestampSeconds * 1000).toISOString()}</time>
    <extensions>
      <ns3:TrackPointExtension>
        <ns3:speed>${(p.speedKmh / 3.6).toFixed(2)}</ns3:speed>
      </ns3:TrackPointExtension>
    </extensions>
  </trkpt>`;
    }
  });
  
  return `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
  creator="Corre Logo" version="1.1">
  <trk>
    <name><![CDATA[Corrida]]></name>
    <trkseg>${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}
```

---

## Auto-Send Integration

> **2026-08-28 (fix)**: o auto-send era fire-and-forget com `.then` **sem `.catch`** — se a promise rejeitasse (ex: token 401, rede), o status ficava órfão ('pending' vermelho) e o email era silenciosamente descartado; e o status voltava ao relatório via ref global `latestSessionIdRef.current` (frágil). Agora o **verdadeiro `sessionId`** (doc Firestore ou `local-*`) é capturado do `markAsCompleted` e o auto-send **sempre se resolve** (`.then` + `.catch`), reportando `synced`/`failed`/`pending` de volta para a sessão exata via `onGmailSyncResult(sessionId, status)`.

### 1. On Save (WorkoutTracker.tsx)

```typescript
const savedSession = await markAsCompleted(plan.id, {
  points: pointsRef.current, distanceKm: dist, timeSeconds: elapsedSeconds, mode,
});
// O id real da sessão (doc Firestore ou local-*) é criado DENTRO de markAsCompleted.
// Capturá-lo aqui permite que o upload assíncrono ao Strava reporte o status
// de volta para a sessão EXATA — nunca via ref global.
const savedSessionId = savedSession?.id ?? plan.id;
setSyncStatus('syncing');
const result = await exportWorkoutToHealthConnect(exportData);
setSyncStatus(result.success ? 'synced' : 'failed');
if (onSyncResult) onSyncResult(result.status);

const stravaSession: TrainingSession = {
  id: savedSessionId, planId: plan.id, planName: plan.name,
  planSteps: plan.steps,
  date: new Date(sessionStartTimeRef.current).toISOString(),
  mode, totalDurationSeconds: elapsedRef.current,
  totalDistanceKm: distRef.current, avgSpeedKmh: speedRef.current,
  completed: true, points: pointsRef.current ?? [],
};
// Fire-and-forget, mas SEMPRE resolve:
sendWorkoutToStravaViaEmail(stravaSession)
  .then(sr => {
    const gmailStatus: SyncStatus = sr.success ? 'synced' : (sr.error ? 'failed' : 'pending');
    if (onGmailSyncResult) onGmailSyncResult(savedSessionId, gmailStatus);
    if (sr.success) showFeedback?.('success', 'Atividade enviada ao Strava!');
    else if (sr.error && sr.error !== 'Apenas dispositivo nativo') {
      console.warn('[strava] send failed:', sr.error);
      showFeedback?.('error', `Strava: ${sr.error}`);
    }
  })
  .catch(e => {
    console.warn('[strava] auto-send rejected:', e);
    if (onGmailSyncResult) onGmailSyncResult(savedSessionId, 'failed'); // nunca deixa status órfão
  });
```

### 2. On Retry (App.tsx)

```typescript
onGmailSyncResult={(sessionId, status) => {
  // Atualiza o badge do histórico/summary da sessão `sessionId`
  // (em vez de confiar em latestSessionIdRef)
}}
```

> **Logcat**: em falha no automático, procurar `[strava] auto-send rejected:` (reject da promise) ou `[strava] send failed:` (erro tratado) — confirma se é token, rede ou formato.

---

## Token Management

```typescript
const STORAGE_KEY = 'gmail_strava_token';

interface StoredToken {
  access_token: string;
  refresh_token?: string;
}

export function getStoredToken(): StoredToken | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  // Backward compat: old plain string tokens
  try { return JSON.parse(raw); } catch { return { access_token: raw }; }
}

function storeToken(token: StoredToken) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
}

function clearGmailToken() {
  localStorage.removeItem(STORAGE_KEY);
}

// Refresh via cloud function
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://us-central1-correlogo-prod.cloudfunctions.net/refreshAuthToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.access_token;
}

// Auto-refresh on 401 with retry
async function sendMessage(token: string, raw: string) {
  let res = await fetch(..., { headers: { Authorization: `Bearer ${token}` }});
  if (res.status === 401) {
    const stored = getStoredToken();
    if (stored?.refresh_token) {
      const newToken = await refreshAccessToken(stored.refresh_token);
      storeToken({ access_token: newToken, refresh_token: stored.refresh_token });
      res = await fetch(..., { headers: { Authorization: `Bearer ${newToken}` }});
    } else {
      clearGmailToken();
      return { success: false, error: 'Token expirado. Reconecte o Gmail.' };
    }
  }
  return res.ok ? { success: true } : { success: false, error: await res.text() };
}
```

---

## Gmail API Setup (Google Cloud Console)

1. **Enable Gmail API** → APIs & Services → Library → Gmail API → Enable
2. **OAuth Consent Screen** → Add scope `https://www.googleapis.com/auth/gmail.send` (Sensitive)
3. **Credentials** → OAuth 2.0 Client ID → Web Application
   - Authorized redirect URIs: `https://correlogo.web.app/auth/google/callback`
4. **Test Users** → Add `m4hmatias@gmail.com`

---

## Troubleshooting

| Erro | Causa | Fix |
|------|-------|-----|
| `401 Unauthorized` | Token expirado | Auto-clear + re-auth |
| `403 Insufficient Permission` | Scope `gmail.send` não concedido | Re-auth com `prompt=consent` |
| `Invalid MIME` | Boundary/encoding errado | Validar `base64url` + `\r\n` |
| `Daily limit exceeded` | 100 emails/dia limite Gmail API | Rate limit / batch |
| Status órfão (`pending` eterno) no auto-sync | promise reject sem `.catch` (pré-2026-08-28) | `.catch` + `.then` sempre reportando `onGmailSyncResult(sessionId, status)` |

---

*Última revisão: 2026-08-28 (auto-send com `.catch` + status por `sessionId` real, sem ref global)*