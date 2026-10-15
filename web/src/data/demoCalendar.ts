// Demo data: an anonymized copy of a real HUJI 2026-27 Moodle export (77 events, 3 courses —
// weekly lectures, lab open/close windows, quizzes, assignments). Course names and descriptions
// are replaced; structure, times and quirks (misspelled attendance names, &amp; entities,
// "67315_1"-style section codes) are kept so the demo shows exactly what a real student sees.
import { localParts } from '@mtm/core';
import demoCalendar from './demo-calendar.ics?raw';

/** The export was taken on this day; the demo is shifted so that day lands in the current week. */
const EXPORTED_AT = Date.UTC(2026, 9, 15, 7, 40);
const WEEK = 7 * 86_400_000;

/** Israel UTC offset (ms) at an instant — used to keep local wall-clock times across DST. */
function offsetAt(instant: number): number {
  const p = localParts(instant);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(instant / 60_000) * 60_000;
}

const toIcsTime = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Build the demo .ics text, moved by whole weeks so "today" in the demo is today. */
export function buildDemoIcs(now = Date.now()): string {
  const weeks = Math.round((now - EXPORTED_AT) / WEEK);
  if (weeks === 0) return demoCalendar;
  return demoCalendar.replace(/^(DTSTART|DTEND):(\d{8}T\d{6}Z)$/gm, (_, key: string, v: string) => {
    const t = Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(9, 11), +v.slice(11, 13), +v.slice(13, 15));
    const moved = t + weeks * WEEK;
    return `${key}:${toIcsTime(moved + offsetAt(t) - offsetAt(moved))}`;
  });
}
