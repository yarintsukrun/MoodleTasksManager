import { describe, expect, it } from 'vitest';
import { deriveWeeklySlots, parseIcs } from '../src/index';
import { fixture, makeEvent, utc } from './helpers';

describe('deriveWeeklySlots', () => {
  it('builds the weekly timetable from the Hebrew fixture, stable across DST', () => {
    const slots = deriveWeeklySlots(parseIcs(fixture('hebrew.ics')));
    expect(slots).toEqual([
      {
        courseId: '12345',
        courseName: 'מבוא לתכנות',
        type: 'class_session',
        weekday: 0,
        startMinute: 12 * 60,
        endMinute: 14 * 60,
        eventIds: ['900001', '900002', '900003', '900004'],
      },
      {
        courseId: '23456',
        courseName: 'אלגברה לינארית',
        type: 'class_session',
        weekday: 2,
        startMinute: 10 * 60,
        endMinute: 12 * 60,
        location: 'בניין לדוגמה 101',
        eventIds: ['900010', '900011'],
      },
      {
        courseId: '12345',
        courseName: 'מבוא לתכנות',
        type: 'online_meeting',
        weekday: 3,
        startMinute: 18 * 60,
        endMinute: 19 * 60,
        location: 'https://zoom.example.test/j/000',
        eventIds: ['900024'],
      },
    ]);
  });

  it('groups English attendance across the DST change', () => {
    const slots = deriveWeeklySlots(parseIcs(fixture('english.ics')));
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      courseId: '34567',
      weekday: 4,
      startMinute: 16 * 60,
      endMinute: 17 * 60 + 30,
      location: 'Room 7',
      eventIds: ['800005', '800006'],
    });
  });

  it('ignores point events, other types and events without a course', () => {
    const start = utc('2026-10-11T09:00:00Z');
    const slots = deriveWeeklySlots([
      makeEvent({ id: '1', type: 'class_session', start }),
      makeEvent({ id: '2', type: 'assignment', start, end: start + 3_600_000 }),
      makeEvent({ id: '3', type: 'online_meeting', start, end: start + 3_600_000, courseId: undefined }),
    ]);
    expect(slots).toEqual([]);
  });

  it('separates different times of the same course on the same day', () => {
    const a = utc('2026-10-11T06:00:00Z');
    const b = utc('2026-10-11T12:00:00Z');
    const slots = deriveWeeklySlots([
      makeEvent({ id: 'b', type: 'class_session', start: b, end: b + 3_600_000 }),
      makeEvent({ id: 'a', type: 'class_session', start: a, end: a + 3_600_000 }),
    ]);
    expect(slots.map((s) => [s.startMinute, s.eventIds])).toEqual([
      [9 * 60, ['a']],
      [15 * 60, ['b']],
    ]);
  });
});
