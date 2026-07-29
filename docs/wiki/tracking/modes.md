# Tracking - Modes (Esteira vs Outdoor)

## Esteira (Treadmill)

### Características
- **Sem GPS**: Velocidade e distância vêm da esteira (input manual ou simulado)
- **Timer**: JS + Nativo sincronizados
- **Distância**: Acumulada via `speedRef * time`
- **TTS**: Anúncios de passo/volta funcionam
- **Mapa**: Oculto

### Fluxo
```
Start → KeepAlive (WakeLock) → Native Timer → JS UI Loop
         ↓
    Simulated GPS (se simulateGps=true)
         ↓
    Pontos com lat/lon = 0 (sem rota no mapa)
```

### Input de Velocidade
```typescript
// Botões + / - ajustam speedRef.current (km/h)
const speedControls = (
  <div className="flex items-center gap-2">
    <Button onClick={() => setSpeedRef(s => Math.max(0, s - 0.5))}>-</Button>
    <span className="w-16 text-center">{speedRef.current.toFixed(1)}</span>
    <Button onClick={() => setSpeedRef(s => s + 0.5)}>+</Button>
  </div>
);
```

### Distância
```typescript
// A cada tick do timer nativo (1s)
distRef.current += speedRef.current / 3600; // km/h → km/s
```

---

## Outdoor (GPS)

### Características
- **GPS Ativo**: FusedLocationProvider (nativo)
- **Distância**: Haversine entre coordenadas consecutivas
- **Velocidade**: `location.speed` (m/s) × 3.6
- **Mapa**: Leaflet + OpenStreetMap (tempo real)
- **TTS**: Anúncios de passo + GPS

### Fluxo
```
Start → Permissions (GPS) → Warmup (3s) → Tracking
         ↓
    Foreground Service + WakeLock
         ↓
    Location Updates (1s) → Haversine distance
         ↓
    Points array (lat, lon, speed, alt)
         ↓
    Mapa atualiza em tempo real
```

### Warmup GPS
```typescript
// 3s antes de começar a contar distância
const doGpsWarmup = async () => {
  await startTracking();     // Inicia GPS
  await sleep(3000);         // Aguarda fix
  await stopTracking();      // Para GPS
  // Usuário confirma background location se necessário
  // Reinicia tracking definitivo
};
```

### Permissões (Android)
| Permissão | Uso |
|-----------|-----|
| `ACCESS_FINE_LOCATION` | GPS preciso (outdoor) |
| `ACCESS_COARSE_LOCATION` | GPS aproximado |
| `ACCESS_BACKGROUND_LOCATION` | GPS com app em background |
| `ACTIVITY_RECOGNITION` | Step counter |

---

## Diff Summary

| Feature | Esteira | Outdoor |
|---------|---------|---------|
| **GPS** | ❌ | ✅ FusedLocation |
| **Distância** | `speed × time` | Haversine (GPS) |
| **Velocidade** | Input manual | `location.speed` |
| **Mapa** | Oculto | Leaflet tempo real |
| **WakeLock** | KeepAlive apenas | Foreground Service + WakeLock |
| **Pontos (lat/lon)** | 0,0 | Coordenadas reais |
| **Export GPX** | ❌ (sem rota) | ✅ |
| **Export TCX** | ✅ (sem Position) | ✅ (com Position) |

---

## UI Differences

| Element | Esteira | Outdoor |
|---------|---------|---------|
| Mapa | Hidden | `flex-1 min-h-64` |
| Speed Controls | Visível | Hidden (GPS) |
| Lap Card | `flex-1` (preenche) | `flex-shrink-0` |
| Mapa Height | N/A | `min-h-64` |

---

## Simulated GPS (Dev)

```typescript
// src/lib/capacitor/tracking.ts
if (simulateGps) {
  // Gera coordenadas fictícias em espiral
  const angle = (elapsedSeconds / 30) * Math.PI * 2;
  const radius = 0.001 * (elapsedSeconds / 60); // Espiral crescente
  const lat = -22.9068 + radius * Math.cos(angle);
  const lon = -43.1729 + radius * Math.sin(angle);
  
  Tracking.addListener('locationUpdate', (loc) => {
    // Override com coordenadas simuladas
  });
}
```

---

*Última revisão: 2026-07-29*