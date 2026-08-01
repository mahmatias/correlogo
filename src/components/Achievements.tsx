import { Trophy, Medal, Lock, ChevronRight } from 'lucide-react';
import type { TrainingSession } from '../types';
import { formatDistance, formatDuration } from '../types';
import { PR_DISTANCES, BADGE_LABELS, BADGE_GROUPS, type Records } from '../lib/records';

interface AchievementsProps {
  records: Records | null;
  sessions: TrainingSession[];
  onOpenSession: (sessionId: string) => void;
}

export default function Achievements({ records, sessions, onOpenSession }: AchievementsProps) {
  const prCount = Object.keys(records?.prs ?? {}).length;
  const badgeCount = Object.keys(records?.badges ?? {}).length;
  const totalKm = records?.totalVolumeKm ?? 0;

  return (
    <div className="text-text-primary">
      <h2 className="text-2xl font-bold mb-6 text-center">Conquistas</h2>

      <h3 className="font-bold mb-3">Estatísticas</h3>
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="p-3 rounded-xl bg-bg-surface border border-border text-center">
          <div className="text-2xl font-bold text-accent">{prCount}</div>
          <div className="text-xs text-text-muted">Recordes</div>
        </div>
        <div className="p-3 rounded-xl bg-bg-surface border border-border text-center">
          <div className="text-2xl font-bold text-accent">{badgeCount}</div>
          <div className="text-xs text-text-muted">Conquistas</div>
        </div>
        <div className="p-3 rounded-xl bg-bg-surface border border-border text-center">
          <div className="text-2xl font-bold text-accent">{totalKm.toFixed(1)}</div>
          <div className="text-xs text-text-muted">Km totais</div>
        </div>
      </div>

      <h3 className="font-bold mb-3">Conquistas</h3>
      <div className="space-y-4 mb-6">
        {BADGE_GROUPS.map((group) => (
          <div key={group.id}>
            <h4 className="text-sm font-semibold text-text-secondary mb-2">{group.label}</h4>
            <div className="grid grid-cols-3 gap-2">
              {group.ids.map((id) => {
                const badge = records?.badges?.[id];
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!badge}
                    onClick={() => badge && onOpenSession(badge.sessionId)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center ${
                      badge
                        ? 'bg-bg-surface border-border text-accent'
                        : 'bg-bg-elevated border-transparent text-text-muted opacity-60 cursor-default'
                    }`}
                  >
                    {badge ? <Medal size={20} /> : <Lock size={16} />}
                    <span className="text-[10px] leading-tight text-text-primary">{BADGE_LABELS[id]}</span>
                    {badge && <span className="text-[9px] text-text-muted">{new Date(badge.unlockedAt).toLocaleDateString()}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-bold mb-3">Recordes</h3>
      <div className="space-y-2 mb-6">
        {PR_DISTANCES.map((D) => {
          const pr = records?.prs?.[String(D)];
          return (
            <button
              key={D}
              type="button"
              disabled={!pr}
              onClick={() => pr && onOpenSession(pr.sessionId)}
              className={`w-full flex items-center justify-between p-3 rounded-xl bg-bg-surface border border-border text-left ${pr ? 'hover:bg-bg-elevated' : 'opacity-60 cursor-default'}`}
            >
              <span className="font-semibold">{formatDistance(D)}</span>
              {pr ? (
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{formatDuration(Math.round(pr.timeSeconds))}</span>
                  <span className="text-text-muted">{new Date(pr.date).toLocaleDateString()}</span>
                  <span className="text-xs text-text-muted">{pr.mode === 'treadmill' ? 'Esteira' : 'Rua'}</span>
                  <ChevronRight size={16} className="text-text-muted" />
                </span>
              ) : (
                <Lock size={16} className="text-text-muted" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}