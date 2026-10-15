// Shared contract between @mtm/core and the web app.
// Changing a type here is a cross-package change — coordinate before editing.

export type EventType =
  | 'assignment' // מטלה – "יש להגיש את 'X'" / "X is due"
  | 'quiz_open' // "נפתח ב X" / "X opens"
  | 'quiz_close' // "תאריך הגשה X" / "X closes"
  | 'forum_due' // "X דורש התייחסות"
  | 'class_session' // Attendance session / recurring weekly meeting with duration
  | 'online_meeting' // Zoom / BBB
  | 'activity_open' // other activities opening (choice, feedback, scorm, lesson…)
  | 'activity_close' // other activities closing
  | 'personal' // user event (no CATEGORIES)
  | 'other';

/** A Moodle calendar event after parsing + classification. All instants are epoch ms (UTC). */
export interface MoodleEvent {
  /** Moodle event id, from UID "<id>@host/path". Stable key. */
  id: string;
  uid: string;
  type: EventType;
  /** Clean title — the activity name extracted from the SUMMARY pattern (e.g. "תרגיל 2"). */
  title: string;
  rawSummary: string;
  description: string;
  location?: string;
  /** Course number parsed from CATEGORIES "67528-הנדסת תוכנה" → "67528". Undefined for personal/site events. */
  courseId?: string;
  courseName?: string;
  /** Raw CATEGORIES value. */
  courseShortname?: string;
  start: number;
  end: number;
  /** DTSTART === DTEND → a deadline/point-in-time event. */
  isPoint: boolean;
  lastModified: number;
}

export interface Course {
  id: string;
  name: string;
  shortname: string;
}

/** A recurring weekly slot in the timetable, derived from class_session / online_meeting events. */
export interface WeeklySlot {
  courseId: string;
  courseName: string;
  type: EventType;
  /** 0 = Sunday … 6 = Saturday, in Asia/Jerusalem. */
  weekday: number;
  /** Minutes since local midnight (Asia/Jerusalem). */
  startMinute: number;
  endMinute: number;
  location?: string;
  /** Ids of the concrete events that make up this slot. */
  eventIds: string[];
}

/** Things the user decides — never comes from Moodle. Keyed by MoodleEvent.id. */
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface TaskState {
  status: TaskStatus;
  estimateHours?: number;
  notes?: string;
  typeOverride?: EventType;
  updatedAt: number;
}

/** Result of diffing a fresh import against what we stored before. */
export interface EventChange {
  kind: 'added' | 'removed' | 'time_changed' | 'renamed';
  eventId: string;
  before?: MoodleEvent;
  after?: MoodleEvent;
}

export type Urgency = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'done';

export interface WeekLoad {
  /** Local date (YYYY-MM-DD) of the Sunday starting the week. */
  weekStart: string;
  /** Deadline-type events (assignment, quiz_close, forum_due, activity_close) due that week. */
  deadlines: number;
  byCourse: Record<string, number>;
  eventIds: string[];
}
