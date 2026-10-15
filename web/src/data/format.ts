// UI-safe wrappers around @mtm/core display/logic helpers. Each one calls core and falls back
// to a local Intl-based implementation if core throws, so a core bug never blanks a screen.
import {
  TIMEZONE,
  formatDeadline,
  formatRelative,
  isDeadline,
  localParts,
  urgencyOf,
  type EventType,
  type MoodleEvent,
  type TaskState,
  type Urgency,
} from '@mtm/core';

const warned = new Set<string>();
function safe<T>(name: string, fn: () => T, fallback: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[core] ${name} failed, using fallback`, err);
    }
    return fallback();
  }
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function intlParts(instant: number) {
  const p = Object.fromEntries(partsFmt.formatToParts(instant).map((x) => [x.type, x.value]));
  const year = Number(p.year), month = Number(p.month), day = Number(p.day);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    year,
    month,
    day,
    weekday: WD[p.weekday ?? 'Sun'] ?? 0,
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    dateKey: `${year}-${pad(month)}-${pad(day)}`,
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local (Asia/Jerusalem) calendar parts; weekday 0 = Sunday. */
export const getLocalParts = (instant: number) => safe('localParts', () => localParts(instant), () => intlParts(instant));

/** "14:30" in Asia/Jerusalem. */
export const fmtTime = (instant: number) => {
  const p = getLocalParts(instant);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
};

/** "12:00–14:00" */
export const fmtTimeRange = (start: number, end: number) => `${fmtTime(start)}–${fmtTime(end)}`;

/** "יום ד׳ 15.10" */
export const fmtDate = (instant: number) => {
  const p = getLocalParts(instant);
  return `יום ${WEEKDAYS[p.weekday]} ${p.day}.${p.month}`;
};

/** Hebrew weekday short name, 0 = Sunday → "א׳". */
export const weekdayShort = (weekday: number) => WEEKDAYS[weekday] ?? '';

/** Deadline display ("יום ה׳ 16.10 · 23:59"); midnight deadlines show as 23:59 of the previous day. */
export const fmtDeadline = (instant: number) =>
  safe(
    'formatDeadline',
    () => formatDeadline(instant),
    () => {
      const p = getLocalParts(instant);
      const t = p.hour === 0 && p.minute === 0 ? instant - 60_000 : instant;
      return `${fmtDate(t)} · ${fmtTime(t)}`;
    },
  );

const rtf = new Intl.RelativeTimeFormat('he', { numeric: 'auto' });
/** Relative Hebrew time ("בעוד 2 ימים"). */
export const fmtRelative = (instant: number, now: number) =>
  safe(
    'formatRelative',
    () => formatRelative(instant, now),
    () => {
      const diff = instant - now;
      const abs = Math.abs(diff);
      if (abs < HOUR) return rtf.format(Math.round(diff / 60_000), 'minute');
      if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
      return rtf.format(Math.round(diff / DAY), 'day');
    },
  );

const DEADLINE_TYPES = new Set<EventType>(['assignment', 'quiz_close', 'forum_due', 'activity_close']);
/** True for types the user must act on before a deadline. */
export const isDeadlineType = (type: EventType) =>
  safe('isDeadline', () => isDeadline(type), () => DEADLINE_TYPES.has(type));

/** Urgency bucket for an event (overdue/today/tomorrow/this_week/later/done). */
export const getUrgency = (event: MoodleEvent, state: TaskState | undefined, now: number): Urgency =>
  safe(
    'urgencyOf',
    () => urgencyOf(event, state, now),
    () => {
      if (state?.status === 'done') return 'done';
      const at = event.isPoint ? event.start : event.end;
      if (at < now) return 'overdue';
      const today = getLocalParts(now).dateKey;
      const p = getLocalParts(at);
      const due = getLocalParts(p.hour === 0 && p.minute === 0 ? at - 60_000 : at).dateKey;
      if (due === today) return 'today';
      if (due === getLocalParts(now + DAY).dateKey) return 'tomorrow';
      return at - now < 7 * DAY ? 'this_week' : 'later';
    },
  );

export type Tone = 'danger' | 'warning' | 'success' | 'neutral';
/** Color tone per PLAN 4.2: red <24h or overdue, amber <3 days, green when done, otherwise neutral. */
export function deadlineTone(instant: number, now: number, done = false): Tone {
  if (done) return 'success';
  const left = instant - now;
  if (left < DAY) return 'danger';
  if (left < 3 * DAY) return 'warning';
  return 'neutral';
}
