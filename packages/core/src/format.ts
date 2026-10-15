// Hebrew display strings for instants (Asia/Jerusalem).
import { effectiveDeadlineInstant, localDayNumber, localParts } from './time';

const WEEKDAY_LETTERS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "יום ה' 16.10 · 23:59" — a 00:00 local deadline shows as 23:59 of the previous day. */
export function formatDeadline(instant: number): string {
  const p = localParts(effectiveDeadlineInstant(instant));
  return `יום ${WEEKDAY_LETTERS[p.weekday]} ${p.day}.${p.month} · ${pad2(p.hour)}:${pad2(p.minute)}`;
}

type Forms = { one: string; two: string; many: string };
const MINUTES: Forms = { one: 'דקה', two: '2 דקות', many: 'דקות' };
const HOURS: Forms = { one: 'שעה', two: 'שעתיים', many: 'שעות' };
const DAYS: Forms = { one: 'יום', two: 'יומיים', many: 'ימים' };
const WEEKS: Forms = { one: 'שבוע', two: 'שבועיים', many: 'שבועות' };
const MONTHS: Forms = { one: 'חודש', two: 'חודשיים', many: 'חודשים' };
const YEARS: Forms = { one: 'שנה', two: 'שנתיים', many: 'שנים' };

function quantity(n: number, forms: Forms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  return `${n} ${forms.many}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Natural Hebrew relative time: "בעוד 3 שעות", "מחר", "לפני יומיים". */
export function formatRelative(instant: number, now: number): string {
  const diff = instant - now;
  const future = diff >= 0;
  const abs = Math.abs(diff);
  const phrase = (q: string): string => (future ? `בעוד ${q}` : `לפני ${q}`);

  const minutes = Math.round(abs / MINUTE);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return phrase(quantity(minutes, MINUTES));

  const days = localDayNumber(instant) - localDayNumber(now);
  const hours = Math.max(1, Math.round(abs / HOUR));
  if (days === 0 || abs < 12 * HOUR) return phrase(quantity(Math.min(hours, 23), HOURS));

  const absDays = Math.abs(days);
  if (absDays === 1) return future ? 'מחר' : 'אתמול';
  if (absDays < 7) return phrase(quantity(absDays, DAYS));
  if (absDays < 30) return phrase(quantity(Math.round(absDays / 7), WEEKS));
  if (absDays < 365) return phrase(quantity(Math.max(1, Math.round(absDays / 30)), MONTHS));
  return phrase(quantity(Math.round(absDays / 365), YEARS));
}
