// Demo data: a realistic fake HUJI semester as a Moodle-style .ics string, generated relative to "now"
// so it flows through the exact same importIcs() path as a real export.
// Mimics Moodle 5 export: UID "<id>@moodle.huji.ac.il/2025-26", CATEGORIES "<course#>-<name>", UTC instants,
// DTSTART == DTEND for deadlines, and only events from 5 days back onward (like "recentupcoming"/custom).

const TZ = 'Asia/Jerusalem';
const HOST = 'moodle.huji.ac.il/2025-26';
const DAY = 86_400_000;

type YMD = { y: number; m: number; d: number };

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
});
function tzParts(instant: number) {
  const p = Object.fromEntries(partsFmt.formatToParts(instant).map((x) => [x.type, Number(x.value)]));
  return { y: p.year!, m: p.month!, d: p.day!, h: p.hour! % 24, min: p.minute!, s: p.second! };
}
const offsetAt = (instant: number) => {
  const p = tzParts(instant);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(instant / 1000) * 1000;
};
/** Local Jerusalem wall time → UTC epoch ms (DST-safe). */
function local(date: YMD, hhmm: string): number {
  const [h, min] = hhmm.split(':').map(Number) as [number, number];
  const guess = Date.UTC(date.y, date.m - 1, date.d, h, min);
  return guess - offsetAt(guess - offsetAt(guess));
}
function addDays(date: YMD, n: number): YMD {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const stamp = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const fold = (line: string) => line.match(/.{1,60}/gu)?.join('\r\n ') ?? line;

interface DemoCourse {
  id: string;
  name: string;
  location: string;
  online?: boolean;
  /** weekday 0=Sun, local start/end */
  sessions: [number, string, string][];
}

const COURSES: DemoCourse[] = [
  { id: '67101', name: 'מבוא למדעי המחשב', location: 'שפרינצק 26', sessions: [[0, '10:00', '12:00'], [2, '14:00', '16:00']] },
  { id: '80131', name: 'חשבון אינפיניטסימלי 1', location: 'מתמטיקה 2', sessions: [[1, '08:30', '10:15'], [3, '08:30', '10:15']] },
  { id: '80134', name: 'אלגברה לינארית 1', location: 'קנדה 1', sessions: [[0, '14:00', '16:00'], [4, '10:00', '12:00']] },
  { id: '67528', name: 'הנדסת תוכנה', location: 'רוטברג B220', sessions: [[3, '12:00', '14:00']] },
  { id: '67504', name: 'מבני נתונים', location: 'שפרינצק 115', sessions: [[1, '12:00', '14:00'], [4, '16:00', '17:30']] },
  { id: '76955', name: 'אנגלית למתקדמים', location: 'https://huji.zoom.us/j/0000000000', online: true, sessions: [[2, '18:00', '19:30']] },
];

interface DemoEvent {
  summary: string;
  description: string;
  start: number;
  end?: number;
  course?: DemoCourse;
  location?: string;
}

/** Build the demo .ics text. `now` defaults to the current time. */
export function buildDemoIcs(now = Date.now()): string {
  const today = tzParts(now);
  const todayYmd: YMD = { y: today.y, m: today.m, d: today.d };
  const weekday = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay();
  const semStart = addDays(todayYmd, -weekday - 14); // Sunday of semester week 1 (two weeks ago)
  const WEEKS = 13;
  const at = (week: number, wd: number, hhmm: string) => local(addDays(semStart, week * 7 + wd), hhmm);
  /** Deadline "by end of <wd>" — Moodle stores it as 00:00 of the following day. */
  const midnightAfter = (week: number, wd: number) => at(week, wd + 1, '00:00');

  const [intro, calc, linear, swe, ds, english] = COURSES as [DemoCourse, DemoCourse, DemoCourse, DemoCourse, DemoCourse, DemoCourse];
  const ev: DemoEvent[] = [];

  for (let w = 0; w < WEEKS; w++) {
    for (const c of COURSES)
      for (const [wd, s, e] of c.sessions)
        ev.push(
          c.online
            ? { summary: `המפגש 'שיעור ${c.name}' התחיל`, description: 'מפגש זום שבועי. הקישור בשדה המיקום.', start: at(w, wd, s), end: at(w, wd, e), course: c, location: c.location }
            : { summary: 'נוכחות תלמידים', description: 'Regular class session', start: at(w, wd, s), end: at(w, wd, e), course: c, location: c.location },
        );

    if (w < 12)
      ev.push({ summary: `יש להגיש את 'תרגיל ${w + 1}'`, description: 'יש להגיש קובץ zip אחד עם הקוד וקובץ README.\nהגשה בזוגות.', start: midnightAfter(w, 4), course: intro });
    if (w % 2 === 0 && w < 12)
      ev.push({ summary: `יש להגיש את 'גיליון ${w / 2 + 1}'`, description: 'סריקה קריאה של הפתרון בקובץ PDF יחיד.', start: at(w + 1, 1, '12:00'), course: calc });
    if (w < 11)
      ev.push({ summary: `Homework ${w + 1} is due`, description: 'Submit a single PDF. Late submissions are not accepted.', start: midnightAfter(w, 3), course: linear });
    if (w % 2 === 1) {
      const n = (w + 1) / 2;
      ev.push({ summary: `נפתח ב בוחן שבועי ${n}`, description: 'בוחן קצר על חומר השבועיים האחרונים. 30 דקות מרגע הפתיחה.', start: at(w, 0, '09:00'), course: ds });
      ev.push({ summary: `תאריך הגשה בוחן שבועי ${n}`, description: 'בוחן קצר על חומר השבועיים האחרונים. 30 דקות מרגע הפתיחה.', start: midnightAfter(w, 2), course: ds });
      ev.push({ summary: `יש להגיש את 'תרגיל ${n}'`, description: 'תרגיל תיאורטי. יש להקליד ב-LaTeX.', start: midnightAfter(w, 2), course: ds });
    }
    if (w % 3 === 1)
      ev.push({ summary: `יש להגיש את 'פרויקט, שלב ${(w + 2) / 3}'`, description: 'הגשה דרך GitHub Classroom + קישור ל-commit ב-Moodle.', start: at(w + 1, 0, '23:55'), course: swe });
    if (w % 4 === 2)
      ev.push({ summary: `יש להגיש את 'חיבור ${(w + 2) / 4}'`, description: 'Essay, 400–500 words.', start: midnightAfter(w, 4), course: english });
  }
  ev.push({ summary: 'פורום הצגת צוותים דורש התייחסות', description: 'כל צוות מפרסם הודעה עם שמות החברים ונושא הפרויקט.', start: midnightAfter(3, 0), course: swe });
  ev.push({ summary: `יש להגיש את 'דו"ח מעבדה'`, description: 'דו"ח קצר על ניסוי הביצועים מהתרגול.', start: local(addDays(todayYmd, 2), '00:00'), course: swe });
  ev.push({ summary: 'פגישה עם יועץ אקדמי', description: 'אירוע אישי: לבדוק בחירת קורסי בחירה.', start: local(addDays(todayYmd, 1), '13:00'), end: local(addDays(todayYmd, 1), '13:30'), location: 'בניין הסטודנטים, חדר 104' });

  const modified = stamp(now - 7 * DAY);
  const lines = ['BEGIN:VCALENDAR', 'METHOD:PUBLISH', 'PRODID:-//Moodle Pty Ltd//NONSGML Moodle Version 2024100700//EN', 'VERSION:2.0'];
  ev.forEach((e, i) => {
    if ((e.end ?? e.start) < now - 5 * DAY) return; // export window: 5 days back
    lines.push(
      'BEGIN:VEVENT',
      `UID:${300000 + i}@${HOST}`,
      `SUMMARY:${esc(e.summary)}`,
      `DESCRIPTION:${esc(e.description)}`,
      'CLASS:PUBLIC',
      `LAST-MODIFIED:${modified}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end ?? e.start)}`,
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      ...(e.course ? [`CATEGORIES:${esc(`${e.course.id}-${e.course.name}`)}`] : []),
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
