import { WorkoutPlan } from '../types';

function escapeIcal(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function formatIcalDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

export function generateIcal(plans: WorkoutPlan[], programName?: string): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Corre Logo//Treinos//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + (programName ? escapeIcal(programName) : 'Corre Logo - Treinos'),
    'X-WR-CALDESC:Planos de treino gerados pelo Corre Logo',
  ];

  const datedPlans = plans.filter(p => p.scheduledDate && !p.isRaceMarker);
  const seen = new Set<string>();

  for (const plan of datedPlans) {
    const dateStr = plan.scheduledDate!;
    if (seen.has(dateStr + plan.id)) continue; // UID único por plan.id, não por nome
    seen.add(dateStr + plan.id);

    const totalMinutes = Math.ceil(plan.steps.reduce((acc, s) => acc + (s.durationSeconds || 0), 60) / 60);
    const startIcal = formatIcalDate(dateStr);
    const desc = plan.steps.map(s => {
      const label = s.type === 'warmup' ? 'Aquecimento' : s.type === 'run' ? 'Corrida' : s.type === 'cooldown' ? 'Desaquecimento' : s.type === 'rest' ? 'Caminhada' : s.type;
      const dur = `${Math.ceil((s.durationSeconds || 0) / 60)}min`;
      const pace = s.type === 'run' && s.targetPace ? ` a ${s.targetPace}min/km` : '';
      return `${label}: ${dur}${pace}`;
    }).join('\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:plan.${plan.id}@correlogo.sytes.net`);
    lines.push(`DTSTART;VALUE=DATE:${startIcal}`);
    lines.push(`DTEND;VALUE=DATE:${startIcal}`);
    lines.push(`SUMMARY:${escapeIcal(plan.name)}`);
    lines.push(`DESCRIPTION:${escapeIcal(desc + '\\n\\nDuração total: ' + totalMinutes + 'min')}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (plan.updatedAt) {
      const modified = new Date(plan.updatedAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      lines.push(`LAST-MODIFIED:${modified}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcal(plans: WorkoutPlan[], filename?: string): void {
  const ical = generateIcal(plans);
  const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'corre-logo-treinos.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
