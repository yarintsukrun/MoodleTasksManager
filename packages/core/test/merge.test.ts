import { describe, expect, it } from 'vitest';
import { mergeEvents } from '../src/index';
import { makeEvent, utc } from './helpers';

const d = (day: number): number => utc(`2026-10-${String(day).padStart(2, '0')}T10:00:00Z`);

describe('mergeEvents', () => {
  const old = makeEvent({ id: 'old', start: d(1) }); // before fresh range → history
  const same = makeEvent({ id: 'same', start: d(12) });
  const moved = makeEvent({ id: 'moved', start: d(14) });
  const renamed = makeEvent({ id: 'renamed', start: d(16), title: 'תרגיל 1' });
  const deleted = makeEvent({ id: 'deleted', start: d(18) });
  const future = makeEvent({ id: 'future', start: d(30) }); // after fresh range → kept

  const stored = [old, same, moved, renamed, deleted, future];
  const fresh = [
    { ...same },
    { ...moved, start: d(15), end: d(15), lastModified: 1 },
    { ...renamed, title: 'תרגיל 1 (מעודכן)' },
    makeEvent({ id: 'new', start: d(20) }),
  ];

  const { events, changes } = mergeEvents(stored, fresh);

  it('reports added / time_changed / renamed / removed', () => {
    expect(changes.map((c) => [c.kind, c.eventId]).sort()).toEqual(
      [
        ['added', 'new'],
        ['removed', 'deleted'],
        ['renamed', 'renamed'],
        ['time_changed', 'moved'],
      ].sort(),
    );
    const timeChange = changes.find((c) => c.kind === 'time_changed')!;
    expect(timeChange.before?.start).toBe(d(14));
    expect(timeChange.after?.start).toBe(d(15));
    expect(changes.find((c) => c.kind === 'removed')!.before).toBe(deleted);
    expect(changes.find((c) => c.kind === 'added')!.after?.id).toBe('new');
  });

  it('keeps history outside the fresh range, drops removed events, fresh wins', () => {
    expect(events.map((e) => e.id)).toEqual(['old', 'same', 'moved', 'renamed', 'new', 'future']);
    expect(events.find((e) => e.id === 'moved')!.start).toBe(d(15));
    expect(events.find((e) => e.id === 'renamed')!.title).toBe('תרגיל 1 (מעודכן)');
  });

  it('reports both time and title changes for the same event', () => {
    const r = mergeEvents([same], [{ ...same, start: d(13), end: d(13), title: 'אחר' }]);
    expect(r.changes.map((c) => c.kind).sort()).toEqual(['renamed', 'time_changed']);
  });

  it('detects an end-only change', () => {
    const session = makeEvent({ id: 's', start: d(12), end: d(12) + 3_600_000, type: 'class_session' });
    const r = mergeEvents([session], [{ ...session, end: d(12) + 7_200_000 }]);
    expect(r.changes.map((c) => c.kind)).toEqual(['time_changed']);
  });

  it('removes nothing when the fresh import is empty', () => {
    const r = mergeEvents(stored, []);
    expect(r.changes).toEqual([]);
    expect(r.events).toHaveLength(stored.length);
  });

  it('adds everything into an empty store', () => {
    const r = mergeEvents([], fresh);
    expect(r.changes.every((c) => c.kind === 'added')).toBe(true);
    expect(r.events).toHaveLength(fresh.length);
  });
});
