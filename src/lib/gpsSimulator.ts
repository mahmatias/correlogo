/** GPS Simulator — trajeto retangular 500m × 1km com velocidade variável */

const DEG_LAT_KM = 111.32;
const DEG_LNG_KM = DEG_LAT_KM * Math.cos(-15.7975 * Math.PI / 180); // ~107.1

interface SimOptions {
  originLat?: number;
  originLng?: number;
  onPosition: (pos: GeolocationPosition) => void;
}

export function startGpsSimulation({ originLat = -15.7975, originLng = -47.8919, onPosition }: SimOptions) {
  // Deslocamentos em km → graus
  const dLat = (km: number) => km / DEG_LAT_KM;
  const dLng = (km: number) => km / DEG_LNG_KM;

  // Vértices do retângulo: norte 500m, leste 1km, sul 500m, oeste 1km
  const pts: [number, number][] = [
    [originLat,                       originLng],
    [originLat + dLat(0.5),          originLng],
    [originLat + dLat(0.5),          originLng + dLng(1)],
    [originLat,                       originLng + dLng(1)],
  ];

  const segLenKm = [0.5, 1.0, 0.5, 1.0];
  let segIdx = 0;
  let segProg = 0; // km percorridos no segmento atual
  let stopSecs = 0;

  const interpolate = (speedKmh: number) => {
    const a = pts[segIdx];
    const b = pts[(segIdx + 1) % pts.length];
    const frac = segLenKm[segIdx] > 0 ? segProg / segLenKm[segIdx] : 0;

    const lat = a[0] + (b[0] - a[0]) * frac;
    const lng = a[1] + (b[1] - a[1]) * frac;

    // Ruído GPS ±2m
    const noiseLat = (Math.random() - 0.5) * 3.6e-5;
    const noiseLng = (Math.random() - 0.5) * 3.6e-5;

    // Altitude simulada: 1000m base + variação suave
    const altitude = 1000 + 15 * Math.sin(segProg / segLenKm[segIdx] * Math.PI);

    onPosition({
      coords: {
        latitude: lat + noiseLat,
        longitude: lng + noiseLng,
        accuracy: 4 + Math.random() * 6,
        altitude: altitude,
        altitudeAccuracy: 5 + Math.random() * 10,
        heading: null,
        speed: speedKmh / 3.6,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);
  };

  const tick = () => {
    if (stopSecs > 0) { stopSecs--; interpolate(0); return; }
    if (Math.random() < 0.003) { stopSecs = 3 + Math.floor(Math.random() * 5); return; }

    // Velocidade: seno suave entre 6 e 11 km/h
    const speedKmh = 6 + 5 * (0.5 + 0.5 * Math.sin(Date.now() / 10000));
    segProg += speedKmh / 3600;

    if (segProg >= segLenKm[segIdx]) {
      segProg = segLenKm[segIdx];
      interpolate(speedKmh);
      segIdx = (segIdx + 1) % pts.length;
      segProg = 0;
    } else {
      interpolate(speedKmh);
    }
  };

  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
