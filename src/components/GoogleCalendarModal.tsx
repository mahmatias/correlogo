import { Calendar, LogOut, RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { load } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

interface GoogleCalendarModalProps {
  open: boolean;
  onClose: () => void;
  plans: any[];
}

export default function GoogleCalendarModal({ open, onClose, plans }: GoogleCalendarModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('google_calendar_token');
    if (token) {
      setAccessToken(token);
      setIsConnected(true);
    }
  }, [open]);

  const connect = async () => {
    try {
      setError(null);
      
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth / 2) - (width / 2);
      const top = window.screenY + (window.outerHeight / 2) - (height / 2);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: 'postmessage',
        response_type: 'token',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
      })}`;
      
      const popup = window.open(
        authUrl,
        'Google OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      if (!popup) {
        throw new Error('Popup bloqueado. Permita popups para este site.');
      }
      
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (!event.data?.access_token) return;
        
        popup.close();
        window.removeEventListener('message', handleMessage);
        
        const token = event.data.access_token;
        localStorage.setItem('google_calendar_token', token);
        setAccessToken(token);
        setIsConnected(true);
        setLastSync(new Date());
      };
      
      window.addEventListener('message', handleMessage);
      
    } catch (err: any) {
      setError(err?.message || 'Erro ao conectar. Tente novamente.');
    }
  };

  const disconnect = () => {
    localStorage.removeItem('google_calendar_token');
    setAccessToken(null);
    setIsConnected(false);
    setLastSync(null);
    setEventCount(0);
  };

  const sync = async () => {
    if (!accessToken) {
      setError('Não conectado ao Google Calendar');
      return;
    }
    
    try {
      setIsSyncing(true);
      setError(null);
      
      const calendarListResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const calendarList = await calendarListResponse.json();
      
      let calendarId = calendarList.items?.find(
        (c: any) => c.summary === 'Corre Logo 🏃'
      )?.id;
      
      if (!calendarId) {
        const newCalResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              summary: 'Corre Logo 🏃',
              description: 'Planos de treino do Corre Logo',
            }),
          }
        );
        const newCal = await newCalResponse.json();
        calendarId = newCal.id;
      }
      
      let created = 0;
      for (const plan of plans) {
        if (!plan.scheduledDate || plan.isRaceMarker) continue;
        
        const start = new Date(plan.scheduledDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        
        const event = {
          summary: plan.name,
          description: plan.steps
            .map((s: any) => {
              const label = s.type === 'warmup' ? 'Aquecimento' : s.type === 'run' ? 'Corrida' : s.type === 'cooldown' ? 'Desaquecimento' : s.type === 'rest' ? 'Caminhada' : s.type;
              const dur = Math.ceil((s.durationSeconds || 0) / 60);
              const pace = s.type === 'run' && s.targetPace ? ` a ${s.targetPace}min/km` : '';
              return `${label}: ${dur}min${pace}`;
            })
            .join('\n'),
          start: { date: start.toISOString().split('T')[0] },
          end: { date: end.toISOString().split('T')[0] },
          extendedProperties: { private: { planId: plan.id } },
        };
        
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(event),
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Erro ao criar evento');
        }
        
        created++;
      }
      
      setEventCount(created);
      setLastSync(new Date());
      
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-bg-surface rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Calendar size={24} className="text-accent" />
            Google Calendar
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-text-muted text-sm">
              Conecte sua conta do Google Calendar para sincronizar seus treinos automaticamente.
            </p>
            <button
              onClick={connect}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium"
            >
              <Calendar size={20} />
              Conectar conta
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Status:</span>
              <span className="text-sm text-success flex items-center gap-1">
                <CheckCircle size={14} />
                Conectado
              </span>
            </div>

            {lastSync && (
              <div className="text-xs text-text-muted">
                Última sincronização: {lastSync.toLocaleString('pt-BR')}
              </div>
            )}

            {eventCount > 0 && (
              <div className="text-sm text-text-primary">
                {eventCount} evento(s) sincronizado(s)
              </div>
            )}

            <button
              onClick={sync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 font-medium"
            >
              <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </button>

            <button
              onClick={disconnect}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-elevated text-text-muted rounded-lg hover:bg-bg-surface transition-colors text-sm"
            >
              <LogOut size={16} />
              Desconectar
            </button>

            <p className="text-xs text-text-muted text-center">
              Os treinos serão adicionados ao calendário "Corre Logo 🏃" no seu Google Calendar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}