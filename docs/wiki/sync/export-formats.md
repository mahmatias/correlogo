# Sync - Export Formats (TCX/GPX/FIT)

## Visão Geral

| Atividade | Formatos | Rota (GPX) |
|-----------|----------|------------|
| Esteira | TCX, FIT | ❌ |
| Outdoor | TCX, GPX, FIT | ✅ |

---

## TCX Generator (src/lib/exportUtils.ts)

```typescript
export const generateTCX = (session: TrainingSession): string => {
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
};
```

### TCX Indoor vs Outdoor

| Campo | Indoor | Outdoor |
|-------|--------|---------|
| `<Position>` | Omitido | Incluído |
| `<AltitudeMeters>` | Omitido | Se disponível |
| `<Extensions><Speed>` | ✅ | ✅ |
| `<Notes>` | "Esteira" | "Outdoor" |

---

## GPX Generator (src/lib/exportUtils.ts)

```typescript
export const generateGPX = (session: TrainingSession): string => {
  let trackPoints = '';
  
  session.points.forEach(p => {
    if (p.lat !== undefined && p.lon !== undefined) {
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
};
```

> **Nota**: GPX só gera pontos com `lat/lon` válidos. Indoor não gera GPX.

---

## FIT Format (Future)

```typescript
// TODO: Implementar com fit-file-writer ou similar
// Formato binário - não template string
// Requer biblioteca: fit-file-writer, fit-parser, ou Garmin FIT SDK

interface FITMessages {
  file_id: { type: 'activity'; time_created: number; };
  event: [{ timestamp: number; event: 'timer'; event_type: 'start' }, ...];
  record: [{ timestamp: number; speed: number; position_lat?: number; position_long?: number; ... }, ...];
  lap: { start_time: number; total_elapsed_time: number; total_distance: number; ... };
  session: { sport: 'running'; sub_sport: 'treadmill' | 'street'; total_distance: number; ... };
  activity: { timestamp: number; total_timer_time: number; num_sessions: 1; type: 'manual'; };
}
```

### Library Options

| Lib | Tipo | Status |
|-----|------|--------|
| `fit-file-writer` | JS/TS | Manutenção baixa |
| `garmin-fit-sdk` | Java/Python | Oficial, complexo |
| Custom binary writer | Manual | Controle total |

---

## Save on Android (Capacitor Filesystem)

```typescript
// src/components/SessionSummary.tsx
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const saveFile = async (content: string, filename: string, mimeType: string) => {
  if (isNative()) {
    await Filesystem.writeFile({
      path: `Download/CorreLogo/${filename}`,
      data: content,
      directory: Directory.ExternalStorage,
      encoding: Encoding.UTF8,
    });
    showFeedback('success', `Arquivo salvo em Download/CorreLogo/${filename}`);
  } else {
    // Web: blob + <a download>
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
};
```

---

## Android Permissions (Export)

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
                 android:maxSdkVersion="28" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
                 android:maxSdkVersion="32" />
<!-- Android 10+ usa MediaStore / Scoped Storage -->
```

---

## MIME Types

| Format | Extension | MIME Type |
|--------|-----------|-----------|
| TCX | `.tcx` | `application/vnd.garmin.tcx+xml` |
| GPX | `.gpx` | `application/gpx+xml` |
| FIT | `.fit` | `application/vnd.garmin.fit` |

---

## Testing Checklist

| Teste | Indoor | Outdoor |
|-------|--------|---------|
| TCX válido (xmllint) | ✅ | ✅ |
| GPX válido (xmllint) | N/A | ✅ |
| Importa no Strava | ✅ (sem rota) | ✅ (com rota) |
| Importa no Garmin Connect | ✅ | ✅ |
| Distância total bate | ✅ | ✅ |
| Pace por km bate | ✅ | ✅ |
| Elevação (se houver) | N/A | ✅ |

---

*Última revisão: 2026-07-29*