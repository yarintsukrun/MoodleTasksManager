// Merge a fresh Moodle import with stored history and report what changed.
import type { EventChange, MoodleEvent } from './types';

export function mergeEvents(
  stored: MoodleEvent[],
  fresh: MoodleEvent[],
): { events: MoodleEvent[]; changes: EventChange[] } {
  const storedById = new Map(stored.map((e) => [e.id, e]));
  const freshById = new Map(fresh.map((e) => [e.id, e]));
  const changes: EventChange[] = [];

  for (const after of freshById.values()) {
    const before = storedById.get(after.id);
    if (!before) {
      changes.push({ kind: 'added', eventId: after.id, after });
      continue;
    }
    if (before.start !== after.start || before.end !== after.end) {
      changes.push({ kind: 'time_changed', eventId: after.id, before, after });
    }
    if (before.title !== after.title) {
      changes.push({ kind: 'renamed', eventId: after.id, before, after });
    }
  }

  // Range the fresh export covers; stored events inside it but missing from it were deleted.
  let minStart = Infinity;
  let maxStart = -Infinity;
  for (const e of freshById.values()) {
    if (e.start < minStart) minStart = e.start;
    if (e.start > maxStart) maxStart = e.start;
  }

  const events: MoodleEvent[] = [...freshById.values()];
  for (const before of storedById.values()) {
    if (freshById.has(before.id)) continue;
    if (before.start >= minStart && before.start <= maxStart) {
      changes.push({ kind: 'removed', eventId: before.id, before });
    } else {
      events.push(before); // history outside the export window
    }
  }

  events.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  return { events, changes };
}
