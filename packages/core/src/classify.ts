// SUMMARY-based classification of Moodle calendar events (Hebrew + English langpacks).
// Order matters: more specific patterns come first. See docs/PLAN.md §1.4.
import type { EventType } from './types';

// Quote characters Moodle / Hebrew langpacks / editors may wrap names in.
const Q = `['"״׳“”‘’]`;

type Rule = { re: RegExp; type: EventType };

const rule = (re: RegExp, type: EventType): Rule => ({ re, type });

/** Assignment / quiz / forum / meeting strings with an explicit activity name. */
const SPECIFIC_RULES: Rule[] = [
  // English teacher-only grading reminder — must precede "is due".
  rule(/^(.+?) is due to be graded$/i, 'other'),
  // Extensions → assignment.
  rule(/^(.+?) is due \(extension\)$/i, 'assignment'),
  rule(/^(.+?) עם ארכה$/, 'assignment'),
  rule(/^(.+?) extension$/i, 'assignment'),
  // Assignment due.
  rule(new RegExp(`^יש להגיש את\\s*${Q}(.+)${Q}\\s*$`), 'assignment'),
  rule(/^יש להגיש את\s+(.+)$/, 'assignment'),
  rule(/^(.+?) is due$/i, 'assignment'),
  // Quiz window.
  rule(/^נפתח ב\s*(.+)$/, 'quiz_open'),
  rule(/^תאריך הגשה:?\s*(.+)$/, 'quiz_close'),
  // Forum.
  rule(/^(.+?) דורש התייחסות$/, 'forum_due'),
  // Online meetings (BBB / Zoom).
  rule(new RegExp(`^המפגש\\s*${Q}(.+)${Q}\\s*התחיל$`), 'online_meeting'),
  rule(/^המפגש (.+?) התחיל$/, 'online_meeting'),
  rule(/^המפגש (.+?) יתקי?ים ב/, 'online_meeting'),
];

const ENGLISH_WINDOW_RULES: Rule[] = [
  rule(/^(.+?) opens$/i, 'quiz_open'),
  rule(/^(.+?) closes$/i, 'quiz_close'),
  rule(/^(.+?) starts$/i, 'online_meeting'),
];

const ACTIVITY_RULES: Rule[] = [
  rule(/^תאריך פתיחה:?\s*(.+)$/, 'activity_open'),
  rule(/^תאריך סגירה:?\s*(.+)$/, 'activity_close'),
  rule(/^(.+?) נפתח(?:ת|ו)?$/, 'activity_open'),
  rule(/^(.+?) פתוח(?:ה)?$/, 'activity_open'),
  rule(/^(.+?) מתחיל(?:ה)?$/, 'activity_open'),
  rule(/^(.+?) נסגר(?:ת|ו)?$/, 'activity_close'),
  rule(/^(.+?) סגור(?:ה)?$/, 'activity_close'),
  rule(/^(.+?) מסתיי?(?:ם|מת)$/, 'activity_close'),
];

const ATTENDANCE_RE = /^(?:נוכחות תלמידים|נוכחות|attendance)$/i;
const REGULAR_SESSION_RE = /regular class session/i;
const ONLINE_RE = /זום|zoom|bbb|bigbluebutton/i;
const QUOTES_RE = new RegExp(`^${Q}+|${Q}+$`, 'g');

function cleanTitle(s: string): string {
  return s.trim().replace(QUOTES_RE, '').trim();
}

function match(rules: Rule[], summary: string): { type: EventType; title: string } | undefined {
  for (const { re, type } of rules) {
    const m = re.exec(summary);
    if (m) {
      const title = cleanTitle(m[1] ?? '');
      return { type, title: title || summary };
    }
  }
  return undefined;
}

export function classify(
  summary: string,
  description: string,
  isPoint: boolean,
  hasCourse: boolean,
): { type: EventType; title: string } {
  const s = (summary ?? '').replace(/\s+/g, ' ').trim();
  const d = description ?? '';

  const specific = match(SPECIFIC_RULES, s);
  if (specific) {
    // "<assignment summary> עם ארכה" → reuse the inner assignment's clean title.
    if (specific.type === 'assignment' && specific.title !== s) {
      const inner = match(SPECIFIC_RULES, specific.title);
      if (inner?.type === 'assignment') return inner;
    }
    return specific;
  }

  if (ATTENDANCE_RE.test(s) || REGULAR_SESSION_RE.test(d)) {
    return { type: 'class_session', title: s };
  }

  const english = match(ENGLISH_WINDOW_RULES, s);
  if (english) return english;

  if (ONLINE_RE.test(s)) return { type: 'online_meeting', title: s };

  // A course event with a duration is a class meeting (lecturers rename attendance
  // activities, e.g. "הרצאה"); generic open/close wording only applies to points.
  if (!isPoint && hasCourse) return { type: 'class_session', title: s };

  const activity = match(ACTIVITY_RULES, s);
  if (activity) return activity;

  if (!hasCourse) return { type: 'personal', title: s };
  return { type: 'other', title: s };
}
