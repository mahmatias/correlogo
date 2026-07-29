import { Calendar, LogOut, RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const REDIRECT_URI = 'https://correlogo.web.app/auth/google/callback';

interface GoogleCalendarModalProps {
  open: boolean;
  onClose: () => void;
  plans: any[];
  pendingOAuthToken?: string | null;
  onOAuthTokenConsumed?: () => void;
}

export default function GoogleCalendarModal({ open, onClose, plans, pendingOAuthToken, onOAuthTokenConsumed }: GoogleCalendarModalProps) {
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

  useEffect(() => {
    if (pendingOAuthToken && pendingOAuthToken !== accessToken) {
      localStorage.setItem('google_calendar_token', pendingOAuthToken);
      setAccessToken(pendingOAuthToken);
      setIsConnected(true);
      setLastSync(new Date());
      setError(null);
      onOAuthTokenConsumed?.();
    }
  }, [pendingOAuthToken]);

  useEffect(() => {
    if (!open) return;
    if ((window as any).google?.accounts?.oauth2) return;
    const existing = document.getElementById('google-gsi-script');
    if (existing) return;
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [open]);

  const isNative = Capacitor.isNativePlatform();

  const connect = async () => {
    try {
      setError(null);

      const state = (isNative ? 'c3_' : '') + crypto.randomUUID();
      sessionStorage.setItem('gcal_oauth_state', state);

      const redirectUri = isNative
        ? REDIRECT_URI
        : `${window.location.origin}/auth/google/callback`;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        include_granted_scopes: 'true',
        state,
        prompt: 'consent',
      })}`;

      console.log('[GCal] Redirecting to Google OAuth (native=' + isNative + ')');
      console.log('[GCal] redirect_uri=', redirectUri);

      if (isNative) {
        await Browser.open({ url: authUrl, windowName: '_self' });
      } else {
        window.location.href = authUrl;
      }

    } catch (err: any) {
      setError(err?.message || 'Erro ao conectar');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('gcal_token');
    const errorParam = params.get('gcal_error');
    const state = params.get('gcal_state');

    if (errorParam) {
      setError(`Google: ${errorParam}`);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (token && state) {
      const savedState = sessionStorage.getItem('gcal_oauth_state');
      if (savedState === state) {
        sessionStorage.removeItem('gcal_oauth_state');
        localStorage.setItem('google_calendar_token', token);
        setAccessToken(token);
        setIsConnected(true);
        setLastSync(new Date());
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const disconnect = () => {
    localStorage.removeItem('google_calendar_token');
    localStorage.removeItem('gcal_calendar_id');
    sessionStorage.removeItem('gcal_oauth_state');
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

      let calendarId = localStorage.getItem('gcal_calendar_id');

      if (calendarId) {
        const checkResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!checkResponse.ok) {
          calendarId = null;
          localStorage.removeItem('gcal_calendar_id');
        }
      }

      if (!calendarId) {
        const calendarListResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/users/me/calendarList',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const calendarList = await calendarListResponse.json();

        const targetNames = ['Corre Logo 🏃', 'Corre Logo'];
        const found = calendarList.items?.find(
          (c: any) => targetNames.includes(c.summary)
        );

        if (found) {
          calendarId = found.id;
          localStorage.setItem('gcal_calendar_id', calendarId);
        } else {
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
          if (newCal.error) {
            throw new Error(newCal.error.message);
          }
          calendarId = newCal.id;
          localStorage.setItem('gcal_calendar_id', calendarId);
        }
      }

      const plansToSync = plans.filter((p: any) => p.scheduledDate && !p.isRaceMarker);

      if (plansToSync.length === 0) {
        setError('Nenhum treino com data programada para sincronizar');
        setIsSyncing(false);
        return;
      }

      let created = 0;
      const existingResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?maxResults=2500&privateExtendedProperty=correlogo=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const existingData = await existingResponse.json();

      for (const event of existingData.items || []) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
      }

      let errors: string[] = [];

      for (const plan of plansToSync) {
        const start = new Date(plan.scheduledDate + 'T00:00:00');
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
          extendedProperties: {
            private: {
              planId: plan.id,
              correlogo: 'true',
            },
          },
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
          errors.push(`${plan.name}: ${errorData.error?.message || 'erro'}`);
          continue;
        }

        created++;
      }

      if (errors.length > 0) {
        setError(`${created} criados, ${errors.length} erros: ${errors[0]}`);
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
