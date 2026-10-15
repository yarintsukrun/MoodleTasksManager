// Public API of @mtm/core. Signatures are the contract with the web app;
// implementations live in sibling modules.
export type * from './types';

export { TIMEZONE } from './time';

/**
 * parseIcs(ics): Parse a raw .ics string into classified events. Never throws on unknown/malformed VEVENTs — skips them.
 * extractCourses(events): unique courses found in events' CATEGORIES.
 */
export { parseIcs, extractCourses } from './parse';

/** classify(summary, description, isPoint, hasCourse): Classify a single SUMMARY/duration (Hebrew + English Moodle strings). Exposed for tests and manual overrides. */
export { classify } from './classify';

/** mergeEvents(stored, fresh): Merge a fresh import with stored events (keeps history Moodle no longer returns) and report changes. */
export { mergeEvents } from './merge';

/** deriveWeeklySlots(events): Derive the recurring weekly timetable from class_session / online_meeting events. */
export { deriveWeeklySlots } from './timetable';

/**
 * urgencyOf(event, state, now): urgency bucket by local (Asia/Jerusalem) date.
 * isDeadline(type): True for types the user must act on before a deadline (assignment, quiz_close, forum_due, activity_close).
 * weeklyLoad(events, from, to): deadline counts per Sunday-starting local week, every week in range.
 */
export { urgencyOf, isDeadline, weeklyLoad } from './load';

/**
 * formatDeadline(instant): Display a deadline instant in Asia/Jerusalem, Hebrew.
 * A deadline at exactly 00:00 local is shown as 23:59 of the previous day ("יום ה' 16.10 · 23:59").
 * formatRelative(instant, now): Relative Hebrew time: "בעוד 2 ימים", "בעוד 3 שעות", "לפני יום".
 */
export { formatDeadline, formatRelative } from './format';

/** localParts(instant): Local (Asia/Jerusalem) calendar parts for an instant. weekday: 0 = Sunday. */
export { localParts } from './time';
