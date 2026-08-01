import { useEffect, useCallback } from 'react';

const PHOTO_KEY = (sessionId: string) => `correlogo:share-photo:${sessionId}`;
const STATE_KEY = (sessionId: string) => `correlogo:share-state:${sessionId}`;

interface ShareState {
  cardIndex: number;
  showStats: Record<string, boolean>;
  gradientId: string;
  tab: 'cards' | 'stickers';
  stickerMap: boolean;
}

export function usePhotoPersistence(sessionId: string | undefined) {
  const savePhoto = useCallback((photoUrl: string | null) => {
    if (!sessionId) return;
    if (photoUrl) {
      localStorage.setItem(PHOTO_KEY(sessionId), photoUrl);
    } else {
      localStorage.removeItem(PHOTO_KEY(sessionId));
    }
  }, [sessionId]);

  const getPhoto = useCallback((): string | null => {
    if (!sessionId) return null;
    return localStorage.getItem(PHOTO_KEY(sessionId));
  }, [sessionId]);

  const clearPhoto = useCallback(() => {
    if (!sessionId) return;
    localStorage.removeItem(PHOTO_KEY(sessionId));
  }, [sessionId]);

  const saveState = useCallback((state: ShareState) => {
    if (!sessionId) return;
    sessionStorage.setItem(STATE_KEY(sessionId), JSON.stringify(state));
  }, [sessionId]);

  const getState = useCallback((): ShareState | null => {
    if (!sessionId) return null;
    try {
      const stored = sessionStorage.getItem(STATE_KEY(sessionId));
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [sessionId]);

  const clearState = useCallback(() => {
    if (!sessionId) return;
    sessionStorage.removeItem(STATE_KEY(sessionId));
  }, [sessionId]);

  const clearAll = useCallback(() => {
    if (!sessionId) return;
    localStorage.removeItem(PHOTO_KEY(sessionId));
    sessionStorage.removeItem(STATE_KEY(sessionId));
  }, [sessionId]);

  return {
    savePhoto,
    getPhoto,
    clearPhoto,
    saveState,
    getState,
    clearState,
    clearAll,
  };
}