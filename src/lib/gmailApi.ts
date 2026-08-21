import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { isNative } from './capacitor/platform';
import { generateTCX, generateGPX, hasGpsData } from './exportUtils';
import type { TrainingSession } from '../types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';
const REDIRECT_URI = 'https://correlogo.web.app/auth/google/callback';
const STORAGE_KEY = 'gmail_strava_token';
const STATE_PREFIX_NATIVE = 'gm_';
const STATE_PREFIX_WEB = 'gm_web_';
const REFRESH_URL = 'https://correlogo.web.app/auth/refresh';

const TO_EMAIL = 'stravaupload@gotoes.org';
const SUBJECT = 'My Run';

interface StoredToken {
  access_token: string;
  refresh_token?: string;
}

export interface GmailSendResult {
  success: boolean;
  error?: string;
}

function getStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.access_token) return parsed;
    return { access_token: raw };
  } catch {
    return null;
  }
}

function storeToken(token: StoredToken) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
}

function clearGmailToken() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isGmailConnected(): boolean {
  return getStoredToken() !== null;
}

export function disconnectGmail(): void {
  clearGmailToken();
}

export async function startGmailOAuth(): Promise<void> {
  const isNativePlatform = isNative();
  const statePrefix = isNativePlatform ? STATE_PREFIX_NATIVE : STATE_PREFIX_WEB;
  const state = encodeURIComponent(statePrefix + crypto.randomUUID());
  sessionStorage.setItem('gmail_oauth_state', state);

  const clientId = encodeURIComponent(CLIENT_ID);
  const redirectUri = encodeURIComponent(REDIRECT_URI);
  const scope = encodeURIComponent(SCOPES);

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${redirectUri}&` +
    `response_type=code&` +
    `scope=${scope}&` +
    `access_type=offline&` +
    `prompt=consent&` +
    `state=${state}`;

  console.log('[gmailApi] OAuth URL:', authUrl);
  console.log('[gmailApi] client_id:', CLIENT_ID);
  console.log('[gmailApi] redirect_uri:', REDIRECT_URI);
  console.log('[gmailApi] scope:', SCOPES);
  console.log('[gmailApi] state prefix:', statePrefix);

  if (isNativePlatform) {
    await Browser.open({ url: authUrl, windowName: '_self' });
  } else {
    window.location.href = authUrl;
  }
}

export function handleGmailCallback(url: string): string | null {
  try {
    const parsed = new URL(url);
    const state = parsed.searchParams.get('state');
    const expectedState = sessionStorage.getItem('gmail_oauth_state');
    if (state && expectedState && state === expectedState) {
      sessionStorage.removeItem('gmail_oauth_state');
    }
    const token = parsed.searchParams.get('token');
    const refreshToken = parsed.searchParams.get('refresh_token');
    if (token) {
      storeToken({ access_token: token, refresh_token: refreshToken || undefined });
    }
    return token;
  } catch {
    return null;
  }
}

export function handleGmailWebCallback(): string | null {
  try {
    const url = new URL(window.location.href);
    const state = url.searchParams.get('state');
    if (state && state.startsWith('gm_')) {
      const token = url.searchParams.get('gcal_token') || url.searchParams.get('token');
      const refreshToken = url.searchParams.get('refresh_token');
      const error = url.searchParams.get('gcal_error') || url.searchParams.get('error');
      if (token) {
        storeToken({ access_token: token, refresh_token: refreshToken || undefined });
        url.searchParams.delete('gcal_token');
        url.searchParams.delete('refresh_token');
        url.searchParams.delete('token');
        url.searchParams.delete('state');
        window.history.replaceState({}, document.title, url.pathname);
        return token;
      }
      if (error) {
        console.error('[gmailApi] OAuth error:', error);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Listen for Gmail OAuth callback via appUrlOpen. Returns an unsubscribe function. */
export function listenForGmailCallback(onToken: (token: string) => void): () => void {
  let sub: { remove: () => void } | null = null;
  CapApp.addListener('appUrlOpen', (event: { url: string }) => {
    try {
      const url = new URL(event.url);
      if (url.protocol === 'com.correlogo.app:' && url.hostname === 'oauth') {
        const state = url.searchParams.get('state');
        const expectedState = sessionStorage.getItem('gmail_oauth_state');
        if (state && expectedState && state === expectedState) {
          sessionStorage.removeItem('gmail_oauth_state');
          const token = url.searchParams.get('token');
          const refreshToken = url.searchParams.get('refresh_token');
          if (token) {
            storeToken({ access_token: token, refresh_token: refreshToken || undefined });
            onToken(token);
          }
        }
      }
    } catch {}
  }).then(s => { sub = s; });
  return () => sub?.remove();
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      console.warn('[gmailApi] refresh falhou:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  const stored = getStoredToken();
  if (!stored) {
    if (isNative()) {
      return new Promise((resolve) => {
        const unsub = listenForGmailCallback((newToken) => {
          unsub();
          resolve(newToken);
        });
        startGmailOAuth().catch(() => resolve(null));
        setTimeout(() => { unsub(); resolve(null); }, 120_000);
      });
    } else {
      startGmailOAuth().catch(() => {});
      return null;
    }
  }

  if (!stored.refresh_token) return stored.access_token;

  const newToken = await refreshAccessToken(stored.refresh_token);
  if (newToken) {
    storeToken({ ...stored, access_token: newToken });
    return newToken;
  }

  return stored.access_token;
}

function buildMimeMessage(fileContent: string, filename: string, mimeType: string): string {
  const boundary = 'CorreLogoBoundary_' + crypto.randomUUID().replace(/-/g, '');
  const body = [
    `To: ${TO_EMAIL}`,
    `Subject: ${SUBJECT}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    'Training activity from Corre Logo',
    '',
    `--${boundary}`,
    `Content-Type: ${mimeType}; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    btoa(unescape(encodeURIComponent(fileContent))),
    '',
    `--${boundary}--`,
  ].join('\r\n');
  return body;
}

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendMessage(token: string, rawMessage: string): Promise<GmailSendResult> {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64url(rawMessage) }),
    });
    if (res.ok) return { success: true };
    if (res.status === 401) {
      const stored = getStoredToken();
      if (stored?.refresh_token) {
        const newToken = await refreshAccessToken(stored.refresh_token);
        if (newToken) {
          storeToken({ ...stored, access_token: newToken });
          const retry = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${newToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw: base64url(rawMessage) }),
          });
          if (retry.ok) return { success: true };
        }
      }
      clearGmailToken();
      return { success: false, error: 'Token expirado. Reconecte o Gmail.' };
    }
    const err = await res.json();
    return { success: false, error: err.error?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendWorkoutToStravaViaEmail(session: TrainingSession): Promise<GmailSendResult> {
  const token = await getValidAccessToken();
  if (!token) return { success: false, error: 'Conecte o Gmail para enviar ao Strava.' };

  // GPX exige trkpt com lat/lon — sessões sem GPS (esteira, import do relógio)
  // vão de TCX, que aceita Trackpoint só com Time/Distance
  if (hasGpsData(session)) {
    const gpx = generateGPX(session);
    return sendMessage(token, buildMimeMessage(gpx, 'activity.gpx', 'application/gpx+xml'));
  } else {
    const tcx = generateTCX(session);
    return sendMessage(token, buildMimeMessage(tcx, 'activity.tcx', 'application/vnd.garmin.tcx+xml'));
  }
}
