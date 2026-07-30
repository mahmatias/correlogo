import { useState } from 'react';
import { Bluetooth, BluetoothSearching, BluetoothConnected, Plus, Minus, X } from 'lucide-react';
import Button from './Button';
import type { TreadmillConnection } from '../lib/use-treadmill';

interface Props {
  treadmill: TreadmillConnection
  targetSpeedKmh?: number
  onSpeedChange?: (speed: number) => void
  onInclineChange?: (incline: number) => void
}

export default function TreadmillPanel({ treadmill, targetSpeedKmh, onSpeedChange, onInclineChange }: Props) {
  const [showScan, setShowScan] = useState(false);
  const { state, connected, devices, metrics, speedKmh, error, scan, connect, disconnect, setSpeed, setIncline } = treadmill;
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

  const handleSpeedDown = () => {
    const newSpeed = Math.max(1, speedKmh - 0.5);
    setSpeed(newSpeed);
    onSpeedChange?.(newSpeed);
  };

  const handleSpeedUp = () => {
    const newSpeed = Math.min(25, speedKmh + 0.5);
    setSpeed(newSpeed);
    onSpeedChange?.(newSpeed);
  };

  const handleInclineDown = () => {
    const newIncline = Math.max(-2, inclinePercent - 0.5);
    setIncline(newIncline);
    onInclineChange?.(newIncline);
  };

  const handleInclineUp = () => {
    const newIncline = Math.min(15, inclinePercent + 0.5);
    setIncline(newIncline);
    onInclineChange?.(newIncline);
  };

  return (
    <div className="bg-bg-elevated rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={handleToggleConnect}
          className={`flex items-center gap-2 text-sm font-medium ${connected ? 'text-green-400' : isConnecting ? 'text-yellow-400' : 'text-text-secondary'} hover:text-text-primary transition-colors`}
        >
          {connected ? <BluetoothConnected className="w-4 h-4" /> : isConnecting ? <BluetoothSearching className="w-4 h-4 animate-pulse" /> : <Bluetooth className="w-4 h-4" />}
          <span>{connected ? 'Esteira conectada' : isConnecting ? 'Conectando...' : 'Conectar esteira'}</span>
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
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-accent-secondary">{speedKmh.toFixed(1)}</div>
            <div className="text-[9px] text-text-muted uppercase">KM/h</div>
            {targetSpeedKmh !== undefined && (
              <div className="text-[8px] text-text-muted">Alvo: {targetSpeedKmh.toFixed(1)}</div>
            )}
          </div>
          <div>
            <div className="text-lg font-bold">{metrics.totalDistanceMeters ? (metrics.totalDistanceMeters / 1000).toFixed(2) : '0.00'}</div>
            <div className="text-[9px] text-text-muted uppercase">KM</div>
          </div>
          <div>
            <div className="text-lg font-bold">{inclinePercent.toFixed(1)}%</div>
            <div className="text-[9px] text-text-muted uppercase">Inclinação</div>
          </div>
        </div>
      )}

      {connected && (
        <div className="flex items-center justify-between gap-4">
          <button onClick={handleSpeedDown} className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated"><Minus size={20} /></button>
          <span className="text-sm font-semibold">{speedKmh.toFixed(1)} km/h</span>
          <button onClick={handleSpeedUp} className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated"><Plus size={20} /></button>
        </div>
      )}

      {connected && (
        <div className="flex items-center justify-between gap-4">
          <button onClick={handleInclineDown} className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated"><Minus size={20} /></button>
          <span className="text-sm font-semibold">{inclinePercent.toFixed(1)}%</span>
          <button onClick={handleInclineUp} className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated"><Plus size={20} /></button>
        </div>
      )}
    </div>
  );
}
