import { List, Trophy, User } from 'lucide-react';
import type { ReactNode } from 'react';

export type TabId = 'treinos' | 'registros' | 'conquistas' | 'perfil';

function RunIcon({ size = 18, strokeWidth = 1.75 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 4a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
      <path d="M4 17l5 1l.75 -1.5" />
      <path d="M15 21l0 -4l-4 -3l1 -6" />
      <path d="M7 12l0 -3l5 -1l3 3l3 1" />
    </svg>
  );
}

const TABS: { id: TabId; label: string; renderIcon: (s: number) => ReactNode }[] = [
  { id: 'treinos', label: 'Treinos', renderIcon: (s) => <RunIcon size={s} /> },
  { id: 'registros', label: 'Registros', renderIcon: (s) => <List size={s} /> },
  { id: 'conquistas', label: 'Conquistas', renderIcon: (s) => <Trophy size={s} /> },
  { id: 'perfil', label: 'Perfil', renderIcon: (s) => <User size={s} /> },
];

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 mx-auto w-full max-w-xl border-t border-border bg-bg-surface/95 backdrop-blur">
      <div className="grid grid-cols-4">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`flex flex-col items-center gap-1.5 py-4 ${isActive ? 'text-accent' : 'text-text-muted'}`}
            >
              {t.renderIcon(27)}
              <span className="text-[12px] font-semibold tracking-wide">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
