/** GPS Simulator — gera coordenadas realistas para teste de corrida ao ar livre */

interface SimOptions {
  originLat?: number;
  originLng?: number;
  onPosition: (pos: GeolocationPosition) => void;
  onError?: (err: GeolocationPositionError) => void;
}

export function startGpsSimulation({ originLat = -15.7975, originLng = -47.8919, onPosition, onError }: SimOptions) {
  let lat = originLat;
  let lng = originLng;
  let heading = Math.random() * 2 * Math.PI; // direção inicial aleatória
  let stopped = false;
  let stopTimer = 0;
  const MIN_SPEED_KMH = 4;
  const MAX_SPEED_KMH = 12;

  const tick = () => {
    // Simula paradas esporádicas (semáforo)
    if (stopped) {
      stopTimer--;
      if (stopTimer <= 0) stopped = false;
      emitPosition(lat, lng, 0);
      return;
    }
    if (Math.random() < 0.005) {
      stopped = true;
      stopTimer = Math.floor(Math.random() * 5) + 3; // 3-7s parado
      emitPosition(lat, lng, 0);
      return;
    }

    // Pequenas variações de direção (desvios de rota)
    heading += (Math.random() - 0.5) * 0.15;

    // Velocidade variável entre corrida e caminhada
    const speedKmh = MIN_SPEED_KMH + Math.random() * (MAX_SPEED_KMH - MIN_SPEED_KMH);
    const speedKmPerSec = speedKmh / 3600;

    // Avança na direção atual
    const dLat = speedKmPerSec * Math.cos(heading) / 111.32;
    const dLng = speedKmPerSec * Math.sin(heading) / (111.32 * Math.cos(lat * Math.PI / 180));
    lat += dLat;
    lng += dLng;

    // Ruído GPS (±3-7 metros)
    const noiseLat = ((Math.random() - 0.5) * 0.00007) / 111.32;
    const noiseLng = ((Math.random() - 0.5) * 0.00007) / (111.32 * Math.cos(lat * Math.PI / 180));

    emitPosition(lat + noiseLat, lng + noiseLng, speedKmh);
  };

  const emitPosition = (latitude: number, longitude: number, speedKmh: number) => {
    onPosition({
      coords: {
        latitude,
        longitude,
        accuracy: 5 + Math.random() * 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: heading * (180 / Math.PI),
        speed: speedKmh / 3.6,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);
  };

  const intervalId = setInterval(tick, 1000);

  return () => clearInterval(intervalId);
}
