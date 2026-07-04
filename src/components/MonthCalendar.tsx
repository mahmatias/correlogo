import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
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

export default function MonthCalendar({ selectedDate, onSelectDate, plannedDates, completedDates, raceDates }: Props) {
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(() => selectedDate.getMonth());
  const [viewYear, setViewYear] = useState(() => selectedDate.getFullYear());

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < startPad; i++) cells.push(null);

    for (let d = 1; d <= totalDays; d++) {
      cells.push(new Date(viewYear, viewMonth, d));
    }

    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [viewMonth, viewYear]);

  const weeks = useMemo(() => {
    const result: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const goToToday = () => {
    const now = new Date();
    setViewMonth(now.getMonth());
    setViewYear(now.getFullYear());
    onSelectDate(now);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 text-text-muted hover:text-accent transition-colors" aria-label="Mês anterior">
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-semibold text-text-primary">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1 text-text-muted hover:text-accent transition-colors" aria-label="Próximo mês">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0 text-center">
        {DAYS.map(d => (
          <div key={d} className="text-[10px] uppercase text-text-muted py-1">{d}</div>
        ))}
        {weeks.map((week, wi) => week.map((day, di) => {
          if (!day) return <div key={`e-${wi}-${di}`} />;
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
              onClick={() => { onSelectDate(day); }}
              className={`py-1.5 text-sm rounded-lg transition-colors relative border-2 ${
                isSelected
                  ? 'bg-bg-elevated border-accent text-text-primary font-bold'
                  : isToday
                    ? 'bg-bg-elevated border-transparent text-text-primary'
                    : 'text-text-secondary border-transparent hover:bg-bg-elevated'
              }`}
            >
              {day.getDate()}
              {dotColor && <div className={`w-1 h-1 rounded-full mx-auto mt-0.5 ${dotColor}`} />}
            </button>
          );
        }))}
      </div>

      <div className="flex justify-center gap-3 mt-3 text-xs text-text-muted">
        <span><span className="text-accent">●</span> Programado</span>
        <span><span className="text-accent-secondary">●</span> Realizado</span>
        <span><span className="text-amber-500">●</span> Prova</span>
      </div>

      <div className="flex justify-center mt-2">
        <button onClick={goToToday} className="text-xs text-accent hover:underline font-semibold">
          Voltar pra Data Atual
        </button>
      </div>
    </div>
  );
}
