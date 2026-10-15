import { describe, expect, it } from 'vitest';
import { formatDeadline, formatRelative, localParts, TIMEZONE } from '../src/index';
import { utc } from './helpers';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('localParts', () => {
  it('uses Asia/Jerusalem', () => {
    expect(TIMEZONE).toBe('Asia/Jerusalem');
  });

  it('converts summer time (UTC+3)', () => {
    expect(localParts(utc('2026-10-11T09:00:00Z'))).toEqual({
      year: 2026, month: 10, day: 11, weekday: 0, hour: 12, minute: 0, dateKey: '2026-10-11',
    });
  });

  it('handles the late-October DST change (UTC+3 → UTC+2)', () => {
    // DST ends Sunday 25.10.2026 at 02:00 local → 01:00.
    expect(localParts(utc('2026-10-24T22:59:00Z'))).toMatchObject({ dateKey: '2026-10-25', hour: 1, minute: 59 });
    expect(localParts(utc('2026-10-24T23:00:00Z'))).toMatchObject({ dateKey: '2026-10-25', hour: 1, minute: 0 });
    expect(localParts(utc('2026-10-25T10:00:00Z'))).toMatchObject({ weekday: 0, hour: 12 });
  });

  it('crosses local midnight before UTC midnight', () => {
    expect(localParts(utc('2026-10-15T21:30:00Z'))).toMatchObject({ dateKey: '2026-10-16', weekday: 5, hour: 0, minute: 30 });
    expect(localParts(utc('2026-12-31T22:00:00Z'))).toMatchObject({ dateKey: '2027-01-01', year: 2027, month: 1, day: 1, hour: 0 });
  });
});

describe('formatDeadline', () => {
  it('formats in Hebrew local time', () => {
    expect(formatDeadline(utc('2026-10-20T20:59:00Z'))).toBe("יום ג' 20.10 · 23:59");
    expect(formatDeadline(utc('2026-10-11T09:00:00Z'))).toBe("יום א' 11.10 · 12:00");
    expect(formatDeadline(utc('2026-11-07T08:05:00Z'))).toBe("יום ש' 7.11 · 10:05");
  });

  it('shows a 00:00 deadline as 23:59 of the previous day', () => {
    // Friday 16.10 00:00 local → Thursday 15.10 23:59.
    expect(formatDeadline(utc('2026-10-15T21:00:00Z'))).toBe("יום ה' 15.10 · 23:59");
    // After DST ends midnight is 22:00Z: Friday 30.10 00:00 → Thursday 29.10 23:59.
    expect(formatDeadline(utc('2026-10-29T22:00:00Z'))).toBe("יום ה' 29.10 · 23:59");
  });

  it('only treats exactly 00:00 as midnight', () => {
    expect(formatDeadline(utc('2026-10-15T21:01:00Z'))).toBe("יום ו' 16.10 · 00:01");
  });
});

describe('formatRelative', () => {
  const now = utc('2026-10-15T07:00:00Z'); // Thursday 10:00 local

  it.each([
    [now, 'עכשיו'],
    [now + 20_000, 'עכשיו'],
    [now + MIN, 'בעוד דקה'],
    [now + 5 * MIN, 'בעוד 5 דקות'],
    [now + HOUR, 'בעוד שעה'],
    [now + 2 * HOUR, 'בעוד שעתיים'],
    [now + 3 * HOUR, 'בעוד 3 שעות'],
    [now + 11 * HOUR, 'בעוד 11 שעות'],
    [now + DAY, 'מחר'],
    [now + 2 * DAY, 'בעוד יומיים'],
    [now + 4 * DAY, 'בעוד 4 ימים'],
    [now + 7 * DAY, 'בעוד שבוע'],
    [now + 14 * DAY, 'בעוד שבועיים'],
    [now + 21 * DAY, 'בעוד 3 שבועות'],
    [now + 60 * DAY, 'בעוד חודשיים'],
    [now - 10 * MIN, 'לפני 10 דקות'],
    [now - 2 * HOUR, 'לפני שעתיים'],
    [now - DAY, 'אתמול'],
    [now - 3 * DAY, 'לפני 3 ימים'],
  ])('%#: %s → %s', (instant, expected) => {
    expect(formatRelative(instant, now)).toBe(expected);
  });

  it('says "tomorrow" by calendar day, even if under 24h away', () => {
    expect(formatRelative(utc('2026-10-16T06:00:00Z'), now)).toBe('מחר'); // Fri 09:00
  });

  it('uses hours for a short span across midnight', () => {
    const lateNight = utc('2026-10-15T20:00:00Z'); // Thu 23:00
    expect(formatRelative(lateNight + 2 * HOUR, lateNight)).toBe('בעוד שעתיים');
  });
});
