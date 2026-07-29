# Tracking - GPS & Distance Calculation

## Visão Geral

GPS só roda no modo **outdoor**. Esteira usa velocidade configurada pelo usuário.

---

## Outdoor - GPS Tracking

### Native Plugin: TrackingPlugin.kt

```kotlin
// FusedLocationProviderClient
val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY)
    .setIntervalMillis(3000)
    .setMinUpdateIntervalMillis(1000)
    .build()

fusedLocationClient.requestLocationUpdates(locationRequest, callback, Looper.getMainLooper())
```

### Callback → JS Bridge

```kotlin
// TrackingPlugin.kt
private val locationCallback = object : LocationCallback() {
    override fun onLocationResult(result: LocationResult) {
        result.locations.lastOrNull()?.let { loc ->
            notifyListeners("locationUpdate", JSObject().apply {
                put("latitude", loc.latitude)
                put("longitude", loc.longitude)
                put("altitude", loc.altitude)
                put("accuracy", loc.accuracy)
                put("speed", loc.speed) // m/s
                put("timestamp", System.currentTimeMillis())
            })
        }
    }
}
```

### JS Listener (WorkoutTracker)

```typescript
// tracking.ts
Tracking.addListener('locationUpdate', (data: LocationData) => {
  if (isPausedRef.current) return; // Não acumula se pausado
  
  const coord: Coord = { lat: data.latitude, lng: data.longitude };
  coordsRef.current = coord;
  pathRef.current = [...pathRef.current, coord];
  
  // Cálculo de distância incremental
  if (lastCoordRef.current) {
    const d = haversine(lastCoordRef.current, coord);
    if (d > 0.001 && !isPausedRef.current) {
      distRef.current += d;
    }
  }
  lastCoordRef.current = coord;
});
```

---

## Distance Calculation

### Haversine Formula

```typescript
// tracking.ts
export function haversine(a: Coord, b: Coord): number {
  const R = 6371; // km
  const dLat = deg2rad(b.lat - a.lat);
  const dLon = deg2rad(b.lng - a.lng);
  const lat1 = deg2rad(a.lat);
  const lat2 = deg2rad(b.lat);
  
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

### Incremental vs Recalc

| Método | Descrição | Problema |
|--------|-----------|----------|
| **Incremental** (atual) | `dist += delta` a cada GPS update | Acumula erro se GPS ruidoso |
| **Recalc full** | `dist = sum(haversine(p[i], p[i+1]))` | Preciso mas custa CPU |

> Atual: incremental com filtro `d > 0.001km` (1m) para ignorar ruído.

---

## Treadmill - Velocidade Configurada

### User Input (Speed Controls)

```tsx
// WorkoutTracker.tsx
const [speedKmh, setSpeedKmh] = useState(8); // default 8 km/h

<Button onClick={() => setSpeedKmh(s => Math.min(20, s + 0.5))}>+</Button>
<Button onClick={() => setSpeedKmh(s => Math.max(1, s - 0.5))}>-</Button>
```

### Distance Calculation

```typescript
// WorkoutTracker.tsx
const dPerSec = speedKmh / 3600; // km/s
distRef.current += dPerSec * deltaTime; // Incremental
```

> Sem GPS, distância = velocidade × tempo. Pace = 60 / speed (min/km).

---

## Speed Calculation

### Outdoor (GPS)

```typescript
const speedKmh = loc.speed * 3.6; // m/s → km/h
// Suavizado via média móvel de 3 pontos
```

### Treadmill

```typescript
const speedKmh = speedKmhState; // User input
```

---

## Pause Handling

```typescript
// tracking.ts
const handlePosition = (loc) => {
  if (isPausedRef.current) return; // Para distância
  // ... calcula delta
};

// Map continua atualizando coords/path durante pausa
```

---

## GPS Warmup & Permissions

### Flow

```
Start Outdoor Workout
    │
    ▼
checkLocationPermission() → Request ACCESS_FINE_LOCATION
    │
    ├─ Granted (Foreground) ──▶ showBackgroundModal()
    │                              │
    │                              ├─ "Abrir Configurações" → App Settings
    │                              └─ "Já ativei" → checkBackgroundPermission()
    │
    └─ Denied ──▶ Toast "Permissão necessária"
```

### Background Permission Modal

```tsx
// WorkoutTracker.tsx
const [showBackgroundModal, setShowBackgroundModal] = useState(false);

useEffect(() => {
  if (grantedForeground && !backgroundGranted) {
    setShowBackgroundModal(true);
  }
}, [grantedForeground]);

// Modal com botão "Abrir Configurações" → Tracking.openAppSettings()
```

---

## Accuracy & Filtering

| Filtro | Valor | Propósito |
|--------|-------|-----------|
| `accuracy` | < 50m | Ignora GPS ruim |
| `delta distance` | > 1m | Ignora ruído parado |
| `speed` | < 30 km/h | Ignora outliers (carro) |
| `interval` | 3s | Balance bateria/precisão |

---

## Map Rendering (Leaflet)

```typescript
// MapComponent.tsx
<MapContainer center={coords} zoom={15}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  {path.length > 1 && <Polyline positions={path} color="#FF6B35" weight={4} />}
  <Marker position={coords} icon={runnerIcon} />
</MapContainer>
```

---

## Battery Optimization

| Técnica | Impacto |
|---------|---------|
| `PRIORITY_HIGH_ACCURACY` só outdoor | ~30% menos GPS |
| `interval=3s`, `minInterval=1s` | Balance preciso |
| `WakeLock` só durante treino | Evita CPU sleep |
| Foreground Service | Mantém GPS ativo em background |

---

*Última revisão: 2026-07-29*