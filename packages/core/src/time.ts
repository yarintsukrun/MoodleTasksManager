// Asia/Jerusalem calendar helpers built only on Intl (DST-safe, no deps).

export const TIMEZONE = 'Asia/Jerusalem';

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  dateKey: string; // YYYY-MM-DD
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

let formatter: Intl.DateTimeFormat | undefined;
function getFormatter(): Intl.DateTimeFormat {
  formatter ??= new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  return formatter;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function localParts(instant: number): LocalParts {
  const parts = getFormatter().formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  const weekday = WEEKDAYS[get('weekday')] ?? new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, weekday, hour, minute, dateKey: `${year}-${pad2(month)}-${pad2(day)}` };
}

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 of the local (Asia/Jerusalem) calendar date of an instant. */
export function localDayNumber(instant: number): number {
  const p = localParts(instant);
  return Math.round(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS);
}

/** YYYY-MM-DD for a day number produced by localDayNumber. */
export function dayNumberToKey(dayNumber: number): string {
  const d = new Date(dayNumber * DAY_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Weekday (0 = Sunday) of a day number. */
export function dayNumberWeekday(dayNumber: number): number {
  return new Date(dayNumber * DAY_MS).getUTCDay();
}

/** True when the instant is exactly 00:00 local — Moodle's "end of previous day" deadline. */
export function isLocalMidnight(instant: number): boolean {
  const p = localParts(instant);
  return p.hour === 0 && p.minute === 0 && instant % 60_000 === 0;
}

/** For display/urgency: a midnight deadline belongs to the previous local day. */
export function effectiveDeadlineInstant(instant: number): number {
  return isLocalMidnight(instant) ? instant - 60_000 : instant;
}
