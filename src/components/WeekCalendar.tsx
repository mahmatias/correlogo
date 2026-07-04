import { useMemo } from 'react';

interface Props {
  selectedDate: Date;
  weekStart: Date;
  onSelectDate: (date: Date) => void;
  onWeekChange: (direction: -1 | 1) => void;
  plannedDates: Set<string>;
  completedDates: Set<string>;
  raceDates?: Set<string>;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function WeekCalendar({ selectedDate, weekStart, onSelectDate, onWeekChange, plannedDates, completedDates, raceDates }: Props) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const monthLabel = `${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
  const today = new Date();

  return (
    <div>
      <div className="flex gap-1" style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {days.map((day) => {
          const dateKey = fmt(day);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const hasPlanned = plannedDates.has(dateKey);
          const hasCompleted = completedDates.has(dateKey);
          const hasRace = raceDates?.has(dateKey);
          let dotColor = '';
          if (hasRace) dotColor = 'bg-amber-500';
          else if (hasCompleted) dotColor = 'bg-accent-secondary';
          else if (hasPlanned) dotColor = 'bg-accent';

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={`flex-1 min-w-0 text-center py-2 rounded-lg transition-colors border-2 ${
                isSelected
                  ? 'bg-bg-elevated border-accent text-text-primary font-bold'
                  : isToday
                    ? 'bg-bg-elevated border-transparent text-text-primary'
                    : 'bg-bg-surface border-transparent text-text-secondary'
              }`}
            >
              <div className="text-xs uppercase opacity-70">{DAYS[day.getDay()]}</div>
              <div className="text-sm font-semibold">{day.getDate()}</div>
              {dotColor && <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-0.5 ${dotColor}`} />}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <button className="text-xs text-accent cursor-pointer" onClick={() => onWeekChange(-1)}>‹ Semana anterior</button>
        <span className="text-xs text-text-muted">{monthLabel}</span>
        <button className="text-xs text-accent cursor-pointer" onClick={() => onWeekChange(1)}>Próxima semana ›</button>
      </div>
      <div className="flex gap-3 mt-1 text-xs text-text-muted">
        <span><span className="text-accent">●</span> Programado</span>
        <span><span className="text-accent-secondary">●</span> Realizado</span>
        <span><span className="text-amber-500">●</span> Prova</span>
      </div>
    </div>
  );
}
