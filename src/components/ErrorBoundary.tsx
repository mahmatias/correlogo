import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] erro não capturado:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-bg-deep p-6 text-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-16 h-16" aria-hidden="true">
            <path d="M20 65 C30 65, 45 55, 55 45 C40 48, 30 45, 25 38 C40 38, 55 30, 85 20 C75 38, 60 62, 50 75 C52 65, 48 58, 42 56 C35 64, 25 65, 20 65 Z" fill="var(--color-accent)" />
            <path d="M15 50 C25 50, 35 43, 42 37 C35 39, 28 37, 25 33 C33 33, 45 27, 55 22 C48 32, 42 42, 38 48 C39 42, 36 38, 32 37 C28 44, 20 50, 15 50 Z" fill="var(--color-accent)" opacity="0.6" />
          </svg>
          <h1 className="text-2xl font-bold text-text-primary">Algo deu errado</h1>
          <p className="text-sm text-text-secondary break-all max-w-md">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-lg bg-accent text-white font-semibold"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return (this as unknown as Props).children;
  }
}
