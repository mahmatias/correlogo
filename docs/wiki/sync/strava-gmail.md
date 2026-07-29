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

### 1. On Save (WorkoutTracker.tsx)

```typescript
const handleSaveAndSync = async () => {
  // ... HC export ...
  
  // Auto-send Strava
  const stravaSession: TrainingSession = {
    id: plan.id, planId: plan.id, planName: plan.name,
    date: new Date(sessionStartTimeRef.current).toISOString(),
    mode, totalDurationSeconds: elapsedRef.current,
    totalDistanceKm: distRef.current, avgSpeedKmh: speedRef.current,
    completed: true, points: pointsRef.current,
  };
  
  sendWorkoutToStravaViaEmail(stravaSession).then(r => {
    if (!r.success && r.error) console.warn('[Strava] send failed:', r.error);
  });
  
  onStop();
};
```

### 2. On Retry (App.tsx)

```typescript
onExportSession={async (session) => {
  const result = await exportWorkoutToHealthConnect(exportData);
  
  // Also send to Strava
  const stravaResult = await sendWorkoutToStravaViaEmail(session);
  
  if (stravaResult.success) showFeedback('success', 'Enviado ao Strava!');
  else if (stravaResult.error) showFeedback('error', `Strava: ${stravaResult.error}`);
}}
```

---

## Token Management

```typescript
const STORAGE_KEY = 'gmail_strava_token';

export function getStoredGmailToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

function clearGmailToken() {
  localStorage.removeItem(STORAGE_KEY);
}

// Auto-refresh on 401
async function sendMessage(token: string, raw: string) {
  const res = await fetch(..., { headers: { Authorization: `Bearer ${token}` }});
  if (res.status === 401) {
    clearGmailToken();
    return { success: false, error: 'Token expirado. Reconecte o Gmail.' };
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

---

*Última revisão: 2026-07-29*