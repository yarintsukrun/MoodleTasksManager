// Urgency buckets and weekly deadline load.
import { dayNumberToKey, dayNumberWeekday, effectiveDeadlineInstant, localDayNumber } from './time';
import type { EventType, MoodleEvent, TaskState, Urgency, WeekLoad } from './types';

const DEADLINE_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  'assignment',
  'quiz_close',
  'forum_due',
  'activity_close',
]);

export function isDeadline(type: EventType): boolean {
  return DEADLINE_TYPES.has(type);
}

export function urgencyOf(event: MoodleEvent, state: TaskState | undefined, now: number): Urgency {
  if (state?.status === 'done') return 'done';
  const type = state?.typeOverride ?? event.type;
  const deadline = isDeadline(type);

  if (deadline) {
    if (event.start < now) return 'overdue';
  } else if (event.end < now) {
    return 'done';
  }

  // A 00:00 deadline is "end of the previous day" for the user.
  const due = deadline && event.isPoint ? effectiveDeadlineInstant(event.start) : event.start;
  const days = localDayNumber(due) - localDayNumber(now);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'this_week';
  return 'later';
}

/** Deadline counts per local week (Sunday start) for every week overlapping [from, to]. */
export function weeklyLoad(events: MoodleEvent[], from: number, to: number): WeekLoad[] {
  if (!(to >= from)) return [];
  const sundayOf = (day: number): number => day - dayNumberWeekday(day);
  const firstWeek = sundayOf(localDayNumber(from));
  const lastWeek = sundayOf(localDayNumber(to));

  const weeks = new Map<number, WeekLoad>();
  for (let w = firstWeek; w <= lastWeek; w += 7) {
    weeks.set(w, { weekStart: dayNumberToKey(w), deadlines: 0, byCourse: {}, eventIds: [] });
  }

  for (const e of events) {
    if (!isDeadline(e.type)) continue;
    const due = e.isPoint ? effectiveDeadlineInstant(e.start) : e.start;
    const week = weeks.get(sundayOf(localDayNumber(due)));
    if (!week) continue;
    week.deadlines += 1;
    const course = e.courseId ?? '';
    week.byCourse[course] = (week.byCourse[course] ?? 0) + 1;
    week.eventIds.push(e.id);
  }

  return [...weeks.values()];
}
