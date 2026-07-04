import { useState, useEffect } from 'react';
import { Calendar, LogOut, Plus } from 'lucide-react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

declare global {
  interface Window {
    gapi: any;
  }
}

interface GoogleCalendarSync {
  isOpen: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSync: Date | null;
  eventCount: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  sync: (plans: any[]) => Promise<void>;
}

export function useGoogleCalendarSync(): GoogleCalendarSync {
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
    
    // Load gapi script dynamically
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi?.load('client', async () => {
        await window.gapi?.client.init({
          apiKey: '', // Not needed for OAuth flow
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        });
      });
    };
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const connect = async () => {
    try {
      setError(null);
      
      // Use Google Identity Services (new OAuth 2.0 flow)
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
      
      // Listen for token from popup
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
      if (err?.message?.includes('popup')) {
        setError('Popup bloqueado. Permita popups para este site.');
      } else {
        setError(err?.message || 'Erro ao conectar. Tente novamente.');
      }
    }
  };

  const disconnect = () => {
    localStorage.removeItem('google_calendar_token');
    setAccessToken(null);
    setIsConnected(false);
    setLastSync(null);
    setEventCount(0);
  };

  const sync = async (plans: any[]) => {
    if (!accessToken) {
      throw new Error('Não conectado ao Google Calendar');
    }
    
    try {
      setIsSyncing(true);
      setError(null);
      
      // Find or create "Corre Logo" calendar
      const calendarListResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
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
      
      // Create events
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
          start: {
            date: start.toISOString().split('T')[0],
          },
          end: {
            date: end.toISOString().split('T')[0],
          },
          extendedProperties: {
            private: {
              planId: plan.id,
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

  return {
    isOpen: false,
    isConnected,
    isSyncing,
    error,
    lastSync,
    eventCount,
    connect,
    disconnect,
    sync,
  };
}

export default useGoogleCalendarSync;