import { useEffect, useRef, useCallback } from 'react';

interface BackContext {
  id: string;
  priority: number;
  handler: () => boolean | void; // return true se consumiu o evento
  condition?: () => boolean;
}

export function useBackHandler() {
  const contextsRef = useRef<BackContext[]>([]);
  const lastBackRef = useRef(0);

  const register = useCallback((
    id: string,
    priority: number,
    handler: () => boolean | void,
    condition?: () => boolean
  ) => {
    contextsRef.current = [
      ...contextsRef.current.filter(c => c.id !== id),
      { id, priority, handler, condition }
    ].sort((a, b) => b.priority - a.priority);

    return () => {
      contextsRef.current = contextsRef.current.filter(c => c.id !== id);
    };
  }, []);

  const unregister = useCallback((id: string) => {
    contextsRef.current = contextsRef.current.filter(c => c.id !== id);
  }, []);

  useEffect(() => {
    let listenerAdded = false;

    const handleBackButton = () => {
      const now = Date.now();
      const activeContexts = contextsRef.current.filter(c => !c.condition || c.condition());

      // Verificar double-tap para sair (prioridade mais baixa)
      const exitContext = activeContexts.find(c => c.id === 'app-exit');
      if (activeContexts.length === 0 || (activeContexts.length === 1 && exitContext)) {
        if (now - lastBackRef.current < 2000) {
          if (window.CapacitorApp?.exitApp) {
            window.CapacitorApp.exitApp();
          }
        } else {
          lastBackRef.current = now;
          // Toast será mostrado pelo contexto de exit
          if (exitContext) exitContext.handler();
        }
        return true;
      }

      // Processar contexto de maior prioridade
      const topContext = activeContexts[0];
      if (topContext) {
        const result = topContext.handler();
        if (result !== false) {
          lastBackRef.current = 0; // reset double-tap timer
          return true;
        }
      }

      return false;
    };

    // @ts-ignore - Capacitor global
    if (window.CapacitorApp?.addListener) {
      // @ts-ignore
      window.CapacitorApp.addListener('backButton', handleBackButton);
      listenerAdded = true;
    }

    return () => {
      if (listenerAdded) {
        // @ts-ignore
        window.CapacitorApp.removeListener('backButton', handleBackButton);
      }
    };
  }, []);

  return { register, unregister };
}

// Tipos globais para Capacitor
declare global {
  interface Window {
    CapacitorApp?: {
      addListener: (event: 'backButton', handler: () => void) => Promise<{ remove: () => void }>;
      removeListener: (event: 'backButton', handler: () => void) => void;
      exitApp: () => void;
    };
  }
}