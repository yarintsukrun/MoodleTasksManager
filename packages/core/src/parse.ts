// .ics → MoodleEvent[] using ical.js. Each VEVENT is parsed in isolation so one
// malformed event never takes the whole calendar down.
import ICAL from 'ical.js';
import { classify } from './classify';
import type { Course, MoodleEvent } from './types';

type Component = InstanceType<typeof ICAL.Component>;
type Time = InstanceType<typeof ICAL.Time>;

/**
 * Split raw text into VEVENT blocks. Splitting on BEGIN lines (rather than matching
 * BEGIN…END pairs) means a VEVENT missing its END line can't swallow the next event.
 */
function extractVeventBlocks(ics: string): string[] {
  const lines = ics.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let current: string[] | undefined;
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      current = [line];
    } else if (current) {
      current.push(line);
      if (upper === 'END:VEVENT') {
        blocks.push(current.join('\r\n'));
        current = undefined;
      }
    }
  }
  return blocks;
}

function textValue(comp: Component, name: string): string | undefined {
  const prop = comp.getFirstProperty(name);
  if (!prop) return undefined;
  const values = prop.getValues().map((v) => String(v ?? ''));
  return values.join(',');
}

function timeValue(comp: Component, name: string): number | undefined {
  const value = comp.getFirstPropertyValue(name) as unknown;
  if (!value || !(value instanceof ICAL.Time)) return undefined;
  const ms = (value as Time).toUnixTime() * 1000;
  return Number.isFinite(ms) ? ms : undefined;
}

/** "67528-הנדסת תוכנה" → { id: "67528", name: "הנדסת תוכנה" }. */
export function parseCourseShortname(shortname: string): { courseId: string; courseName: string } {
  const s = shortname.trim();
  const m = /^(\d+)\s*-\s*(.*)$/.exec(s);
  if (m) {
    const id = m[1] ?? s;
    return { courseId: id, courseName: (m[2] ?? '').trim() || id };
  }
  return { courseId: s, courseName: s };
}

/** Site-wide events (semester start etc.) carry this CATEGORIES value instead of a course. Language follows the requester. */
const SITE_CATEGORY = /^(site events|אירועי מערכת|אירועי אתר)$/i;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Moodle HTML-escapes names before writing them to iCal ("Quiz 2: LLM &amp; prompting"). */
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function cleanDescription(raw: string): string {
  // ical.js already unescapes TEXT; also handle a literal "\n" left behind.
  return decodeEntities(raw.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\r\n?/g, '\n').trim());
}

function parseVevent(block: string): MoodleEvent | undefined {
  const jcal = ICAL.parse(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${block}\r\nEND:VCALENDAR\r\n`);
  const root = new ICAL.Component(jcal as unknown as ConstructorParameters<typeof ICAL.Component>[0]);
  const comp = root.getFirstSubcomponent('vevent');
  if (!comp) return undefined;

  const uid = textValue(comp, 'uid')?.trim();
  if (!uid) return undefined;
  const start = timeValue(comp, 'dtstart');
  if (start === undefined) return undefined;
  const end = timeValue(comp, 'dtend') ?? start;
  if (end < start) return undefined;

  const at = uid.indexOf('@');
  const id = at > 0 ? uid.slice(0, at) : uid;
  const rawSummary = decodeEntities((textValue(comp, 'summary') ?? '').trim());
  const description = cleanDescription(textValue(comp, 'description') ?? '');
  const location = decodeEntities(textValue(comp, 'location')?.trim() ?? '') || undefined;
  const category = textValue(comp, 'categories')?.trim() || undefined;
  const isSiteEvent = category !== undefined && SITE_CATEGORY.test(category);
  const courseShortname = isSiteEvent ? undefined : category;
  const course = courseShortname ? parseCourseShortname(courseShortname) : undefined;
  const lastModified = timeValue(comp, 'last-modified') ?? timeValue(comp, 'dtstamp') ?? 0;
  const isPoint = start === end;

  const classified = classify(rawSummary, description, isPoint, course !== undefined);
  const { title } = classified;
  // A site event is not something the user created, so it is never 'personal'.
  const type = isSiteEvent && classified.type === 'personal' ? 'other' : classified.type;

  const event: MoodleEvent = {
    id,
    uid,
    type,
    title,
    rawSummary,
    description,
    start,
    end,
    isPoint,
    lastModified,
  };
  if (location) event.location = location;
  if (course && courseShortname) {
    event.courseId = course.courseId;
    event.courseName = course.courseName;
    event.courseShortname = courseShortname;
  }
  return event;
}

export function parseIcs(ics: string): MoodleEvent[] {
  if (typeof ics !== 'string' || ics.length === 0) return [];
  const byId = new Map<string, MoodleEvent>();
  for (const block of extractVeventBlocks(ics)) {
    try {
      const event = parseVevent(block);
      if (event) byId.set(event.id, event);
    } catch {
      // Malformed VEVENT — skip it.
    }
  }
  return [...byId.values()].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

export function extractCourses(events: MoodleEvent[]): Course[] {
  const byId = new Map<string, Course>();
  for (const e of events) {
    if (!e.courseId) continue;
    byId.set(e.courseId, {
      id: e.courseId,
      name: e.courseName ?? e.courseId,
      shortname: e.courseShortname ?? e.courseId,
    });
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
