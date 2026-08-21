import { useEffect, useRef, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface BackContext {
  id: string;
  priority: number;
  handler: () => boolean | void; // return true se consumiu o evento
  condition?: () => boolean;
}

export function useBackHandler(onExitPrompt?: () => void) {
  const contextsRef = useRef<BackContext[]>([]);
  const lastBackRef = useRef(0);
  const exitPromptRef = useRef(onExitPrompt);
  exitPromptRef.current = onExitPrompt;

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
    if (!Capacitor.isNativePlatform()) return;

    const handleBackButton = (): void => {
      const now = Date.now();
      const activeContexts = contextsRef.current.filter(c => !c.condition || c.condition());

      // Sem contexto ativo (ou só o de exit): double-tap para sair
      const onlyExit = activeContexts.length === 1 && activeContexts[0].id === 'app-exit';
      if (activeContexts.length === 0 || onlyExit) {
        if (now - lastBackRef.current < 2000) {
          void CapApp.exitApp();
        } else {
          lastBackRef.current = now;
          exitPromptRef.current?.();
        }
        return;
      }

      // Processar contexto de maior prioridade
      const topContext = activeContexts[0];
      const result = topContext.handler();
      if (result !== false) {
        lastBackRef.current = 0; // reset double-tap timer
      }
    };

    let sub: { remove: () => void } | null = null;
    CapApp.addListener('backButton', handleBackButton).then(s => { sub = s; });

    return () => {
      sub?.remove();
    };
  }, []);

  return { register, unregister };
}
