import { describe, expect, it } from 'vitest';
import { isDeadline, urgencyOf, weeklyLoad } from '../src/index';
import type { EventType, TaskState } from '../src/types';
import { makeEvent, utc } from './helpers';

const HOUR = 3_600_000;

describe('isDeadline', () => {
  it.each<[EventType, boolean]>([
    ['assignment', true],
    ['quiz_close', true],
    ['forum_due', true],
    ['activity_close', true],
    ['quiz_open', false],
    ['class_session', false],
    ['online_meeting', false],
    ['activity_open', false],
    ['personal', false],
    ['other', false],
  ])('%s → %s', (type, expected) => {
    expect(isDeadline(type)).toBe(expected);
  });
});

describe('urgencyOf', () => {
  const now = utc('2026-10-15T07:00:00Z'); // Thursday 15.10 10:00 local
  const at = (iso: string, type: EventType = 'assignment') => makeEvent({ id: iso, type, start: utc(iso) });
  const done: TaskState = { status: 'done', updatedAt: 0 };

  it('done status wins', () => {
    expect(urgencyOf(at('2026-10-10T10:00:00Z'), done, now)).toBe('done');
  });

  it('buckets deadlines by local date', () => {
    expect(urgencyOf(at('2026-10-14T10:00:00Z'), undefined, now)).toBe('overdue');
    expect(urgencyOf(at('2026-10-15T06:59:00Z'), undefined, now)).toBe('overdue'); // earlier today
    expect(urgencyOf(at('2026-10-15T20:59:00Z'), undefined, now)).toBe('today');
    expect(urgencyOf(at('2026-10-16T08:00:00Z'), undefined, now)).toBe('tomorrow');
    expect(urgencyOf(at('2026-10-20T08:00:00Z'), undefined, now)).toBe('this_week');
    expect(urgencyOf(at('2026-10-22T08:00:00Z'), undefined, now)).toBe('this_week'); // 7 days
    expect(urgencyOf(at('2026-10-23T08:00:00Z'), undefined, now)).toBe('later');
  });

  it('treats a 00:00 deadline as due the previous evening', () => {
    // Fri 16.10 00:00 local == Thu 23:59 → today.
    expect(urgencyOf(at('2026-10-15T21:00:00Z'), undefined, now)).toBe('today');
  });

  it('uses local date near midnight, not UTC date', () => {
    const lateNow = utc('2026-10-15T20:30:00Z'); // Thu 23:30 local
    expect(urgencyOf(at('2026-10-15T21:30:00Z'), undefined, lateNow)).toBe('tomorrow'); // Fri 00:30
  });

  it('marks past non-deadlines as done', () => {
    expect(urgencyOf(at('2026-10-14T10:00:00Z', 'quiz_open'), undefined, now)).toBe('done');
    const session = makeEvent({ id: 's', type: 'class_session', start: now - HOUR, end: now + HOUR });
    expect(urgencyOf(session, undefined, now)).toBe('today'); // still in progress
  });

  it('respects typeOverride', () => {
    const past = at('2026-10-14T10:00:00Z', 'other');
    expect(urgencyOf(past, undefined, now)).toBe('done');
    expect(urgencyOf(past, { status: 'todo', typeOverride: 'assignment', updatedAt: 0 }, now)).toBe('overdue');
    const pastDeadline = at('2026-10-14T10:00:00Z', 'assignment');
    expect(urgencyOf(pastDeadline, { status: 'doing', typeOverride: 'personal', updatedAt: 0 }, now)).toBe('done');
  });
});

describe('weeklyLoad', () => {
  const events = [
    makeEvent({ id: 'a', start: utc('2026-10-13T20:59:00Z') }), // Tue 13.10
    makeEvent({ id: 'b', start: utc('2026-10-17T12:00:00Z'), courseId: '23456' }), // Sat 17.10
    makeEvent({ id: 'c', start: utc('2026-10-17T21:00:00Z') }), // Sun 18.10 00:00 → counts as Sat 17.10
    makeEvent({ id: 'd', start: utc('2026-10-17T21:30:00Z'), type: 'quiz_close' }), // Sun 18.10 00:30
    makeEvent({ id: 'e', start: utc('2026-10-14T10:00:00Z'), type: 'quiz_open' }), // not a deadline
    makeEvent({ id: 'f', start: utc('2026-11-04T10:00:00Z'), type: 'forum_due' }),
    makeEvent({ id: 'g', start: utc('2026-12-30T10:00:00Z') }), // out of range
  ];

  it('includes every Sunday-starting week, even empty ones', () => {
    const load = weeklyLoad(events, utc('2026-10-14T10:00:00Z'), utc('2026-11-05T10:00:00Z'));
    expect(load).toEqual([
      { weekStart: '2026-10-11', deadlines: 3, byCourse: { '12345': 2, '23456': 1 }, eventIds: ['a', 'b', 'c'] },
      { weekStart: '2026-10-18', deadlines: 1, byCourse: { '12345': 1 }, eventIds: ['d'] },
      { weekStart: '2026-10-25', deadlines: 0, byCourse: {}, eventIds: [] },
      { weekStart: '2026-11-01', deadlines: 1, byCourse: { '12345': 1 }, eventIds: ['f'] },
    ]);
  });

  it('returns a single week when from and to are in the same week', () => {
    expect(weeklyLoad([], utc('2026-10-12T10:00:00Z'), utc('2026-10-13T10:00:00Z'))).toEqual([
      { weekStart: '2026-10-11', deadlines: 0, byCourse: {}, eventIds: [] },
    ]);
  });

  it('returns nothing for an inverted range', () => {
    expect(weeklyLoad(events, utc('2026-11-01T00:00:00Z'), utc('2026-10-01T00:00:00Z'))).toEqual([]);
  });
});
