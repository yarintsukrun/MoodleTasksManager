// Local (Asia/Jerusalem) calendar-day arithmetic on "day numbers" (days since 1970-01-01 of the local date).
// Built on getLocalParts so browser TZ never leaks in. Shared by the timetable and semester screens.
import { getLocalParts, weekdayShort } from '../../data';

const DAY = 86_400_000;
const utc = (d: number) => new Date(d * DAY);

/** Local day number of an instant. */
export const dayNum = (t: number) => {
  const p = getLocalParts(t);
  return Math.round(Date.UTC(p.year, p.month - 1, p.day) / DAY);
};
/** 0 = Sunday. */
export const dayWeekday = (d: number) => utc(d).getUTCDay();
export const sundayOf = (d: number) => d - dayWeekday(d);
/** "YYYY-MM-DD" → day number. */
export const keyToDay = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / DAY);

/** "15.10" */
export const dayLabel = (d: number) => `${utc(d).getUTCDate()}.${utc(d).getUTCMonth() + 1}`;
/** "יום ד׳ 15.10" */
export const dayLongLabel = (d: number) => `יום ${weekdayShort(dayWeekday(d))} ${dayLabel(d)}`;
/** "14–20.12" or "28.11–4.12" (inclusive). */
export const rangeLabel = (from: number, to: number) => {
  const a = utc(from);
  const b = utc(to);
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${dayLabel(to)}` : `${dayLabel(from)}–${dayLabel(to)}`;
};

/** Minutes since local midnight. */
export const minuteOf = (t: number) => {
  const p = getLocalParts(t);
  return p.hour * 60 + p.minute;
};
/** "HH:MM" for minutes since midnight. */
export const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** A 00:00-local deadline belongs to 23:59 of the previous day (same rule as core's formatDeadline). */
export const effectiveDue = (t: number) => {
  const p = getLocalParts(t);
  return p.hour === 0 && p.minute === 0 ? t - 60_000 : t;
};
