import { useState } from 'react';
import { Calendar, LogOut, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useGoogleCalendarSync } from '../hooks/useGoogleCalendarSync';
import { WorkoutPlan } from '../types';

interface GoogleCalendarSyncButtonProps {
  plans: WorkoutPlan[];
}

export default function GoogleCalendarSyncButton({ plans }: GoogleCalendarSyncButtonProps) {
  const { isConnected, isSyncing, error, lastSync, eventCount, connect, disconnect, sync } = useGoogleCalendarSync();
  const [showMenu, setShowMenu] = useState(false);

  const handleSync = async () => {
    await sync(plans);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          isConnected
            ? 'bg-success/10 text-success hover:bg-success/20'
            : 'bg-bg-elevated text-text-muted hover:bg-bg-surface'
        }`}
      >
        <Calendar size={18} />
        <span className="text-sm font-medium">
          {isConnected ? 'Google Calendar' : 'Sincronizar'}
        </span>
      </button>

      {showMenu && isConnected && (
        <div className="absolute right-0 mt-2 w-72 bg-bg-surface border border-border rounded-lg shadow-lg z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text-primary">Google Calendar</h3>
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="text-text-muted hover:text-danger transition-colors"
              title="Desconectar"
            >
              <LogOut size={16} />
            </button>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-danger/10 border border-danger/20 rounded text-danger text-sm">
              <AlertCircle size={14} className="inline mr-1" />
              {error}
            </div>
          )}

          {lastSync && (
            <div className="mb-3 text-xs text-text-muted">
              <CheckCircle size={12} className="inline mr-1 text-success" />
              Última sincronização: {lastSync.toLocaleString('pt-BR')}
            </div>
          )}

          {eventCount > 0 && (
            <div className="mb-3 text-xs text-text-muted">
              {eventCount} evento(s) sincronizado(s)
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </button>

          <p className="mt-2 text-xs text-text-muted">
            Os treinos serão adicionados ao calendário "Corre Logo 🏃" no seu Google Calendar.
          </p>
        </div>
      )}

      {!isConnected && showMenu && (
        <div className="absolute right-0 mt-2 w-64 bg-bg-surface border border-border rounded-lg shadow-lg z-50 p-4">
          <h3 className="font-semibold text-text-primary mb-2">Conectar Google Calendar</h3>
          <p className="text-sm text-text-muted mb-3">
            Sincronize seus treinos automaticamente com o Google Calendar.
          </p>
          <button
            onClick={() => {
              connect();
              setShowMenu(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Calendar size={16} />
            Conectar conta
          </button>
        </div>
      )}
    </div>
  );
}