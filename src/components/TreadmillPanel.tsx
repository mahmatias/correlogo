import { useState } from 'react';
import { BluetoothSearching, BluetoothConnected, X, RefreshCw } from 'lucide-react';
import type { TreadmillConnection } from '../lib/use-treadmill';

interface Props {
  treadmill: TreadmillConnection
}

export default function TreadmillPanel({ treadmill }: Props) {
  const [showScan, setShowScan] = useState(false);
  const { state, connected, devices, metrics, speedKmh, inclinePercent, error, scan, connect, disconnect } = treadmill;
  const isConnecting = state === 'CONNECTING';

  const handleToggleConnect = () => {
    if (connected || isConnecting) {
      disconnect();
      setShowScan(false);
    } else {
      setShowScan(!showScan);
      if (!showScan) scan();
    }
  };

  // Card read-only: valores REALMENTE reportados pela esteira (FTMS), não o alvo.
  // speedKmh/inclinePercent (alvo sobrescrito por setSpeed/setIncline) só como
  // fallback antes do primeiro frame de telemetria.
  const realSpeed = metrics?.instantSpeedKmh ?? speedKmh;
  const realIncline = metrics?.instantaneousInclinePercent ?? inclinePercent;

  return (
    <div className={`bg-bg-elevated rounded-xl p-3 space-y-3 ${!connected && !isConnecting ? 'border border-yellow-600/50' : ''}`}>
      <div className="flex items-center justify-between">
        <button
          onClick={handleToggleConnect}
          className={`flex items-center gap-2 text-sm font-medium ${connected ? 'text-green-400' : isConnecting ? 'text-yellow-400' : 'text-text-secondary'} hover:text-text-primary transition-colors`}
        >
          {connected ? <BluetoothConnected className="w-4 h-4" /> : isConnecting ? <BluetoothSearching className="w-4 h-4 animate-pulse" /> : <RefreshCw className="w-4 h-4" />}
          <span>{connected ? 'Esteira conectada' : isConnecting ? 'Conectando...' : 'Reconectar esteira'}</span>
        </button>
        {(connected || isConnecting) && (
          <button onClick={disconnect} className="text-text-secondary hover:text-red-400 transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && <p className="text-danger text-xs">{error}</p>}

      {showScan && !connected && (
        <div className="border border-border rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
          {devices.length === 0 && state === 'SCANNING' && (
            <p className="text-xs text-text-muted animate-pulse">Escaneando...</p>
          )}
          {devices.length === 0 && state === 'DISCONNECTED' && (
            <p className="text-xs text-text-muted">Nenhuma esteira encontrada</p>
          )}
          {devices.map(d => (
            <button
              key={d.address}
              onClick={() => { connect(d.address); setShowScan(false); }}
              className="w-full text-left p-2 rounded bg-bg-surface text-xs hover:bg-bg-elevated transition-colors"
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {connected && metrics && (
        <div className="flex items-stretch justify-between gap-4">
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-accent-secondary">{realSpeed.toFixed(1)}</div>
            <div className="text-[9px] text-text-muted uppercase">KM/h</div>
            <div className="text-[8px] text-text-muted">velocidade real</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-lg font-bold">{realIncline.toFixed(1)}%</div>
            <div className="text-[9px] text-text-muted uppercase">Inclinação</div>
            <div className="text-[8px] text-text-muted">inclinação real</div>
          </div>
        </div>
      )}
    </div>
  );
}