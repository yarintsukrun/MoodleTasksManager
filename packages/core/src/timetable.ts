// Derive the recurring weekly timetable from class sessions / online meetings.
import { localDayNumber, localParts } from './time';
import type { MoodleEvent, WeeklySlot } from './types';

const SLOT_TYPES = new Set(['class_session', 'online_meeting']);

export function deriveWeeklySlots(events: MoodleEvent[]): WeeklySlot[] {
  const groups = new Map<string, { slot: WeeklySlot; locations: Map<string, number> }>();

  for (const e of events) {
    if (e.isPoint || !SLOT_TYPES.has(e.type) || !e.courseId) continue;
    const s = localParts(e.start);
    const en = localParts(e.end);
    const startMinute = s.hour * 60 + s.minute;
    // Meetings running past local midnight are clipped to the end of the day.
    const endMinute = localDayNumber(e.end) > localDayNumber(e.start) ? 1440 : en.hour * 60 + en.minute;
    const key = `${e.courseId}|${s.weekday}|${startMinute}|${endMinute}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        slot: {
          courseId: e.courseId,
          courseName: e.courseName ?? e.courseId,
          type: e.type,
          weekday: s.weekday,
          startMinute,
          endMinute,
          eventIds: [],
        },
        locations: new Map(),
      };
      groups.set(key, group);
    }
    group.slot.eventIds.push(e.id);
    // An in-person session outranks an online meeting in the same slot.
    if (e.type === 'class_session') group.slot.type = 'class_session';
    if (e.location) group.locations.set(e.location, (group.locations.get(e.location) ?? 0) + 1);
  }

  const slots: WeeklySlot[] = [];
  for (const { slot, locations } of groups.values()) {
    let best: string | undefined;
    let bestCount = 0;
    for (const [loc, count] of locations) {
      if (count > bestCount) {
        best = loc;
        bestCount = count;
      }
    }
    if (best) slot.location = best;
    slots.push(slot);
  }

  return slots.sort(
    (a, b) =>
      a.weekday - b.weekday ||
      a.startMinute - b.startMinute ||
      a.endMinute - b.endMinute ||
      a.courseId.localeCompare(b.courseId),
  );
}
