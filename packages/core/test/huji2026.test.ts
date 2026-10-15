import { describe, expect, it } from 'vitest';
import { deriveWeeklySlots, extractCourses, parseIcs } from '../src/index';

// Shapes seen in a real HUJI 2026-27 export (names and texts replaced).
const vevent = (lines: string) => `BEGIN:VEVENT\r\n${lines.trim().split('\n').map((l) => l.trim()).join('\r\n')}\r\nCLASS:PUBLIC\r\nDTSTAMP:20261015T075122Z\r\nEND:VEVENT`;
const ics = [
  'BEGIN:VCALENDAR',
  'METHOD:PUBLISH',
  'PRODID:-//Moodle Pty Ltd//NONSGML Moodle Version 2026042004//EN',
  'VERSION:2.0',
  vevent(`UID:1@moodle.huji.ac.il/2026-27
    SUMMARY:Start of semester 1
    LAST-MODIFIED:19700101T000000Z
    DTSTART:20261010T210000Z
    DTEND:20261010T210000Z
    CATEGORIES:Site events`),
  vevent(`UID:2@moodle.huji.ac.il/2026-27
    SUMMARY:תחילת סמסטר ב'
    LAST-MODIFIED:19700101T000000Z
    DTSTART:20270306T220000Z
    DTEND:20270306T220000Z
    CATEGORIES:אירועי מערכת`),
  vevent(`UID:24950@moodle.huji.ac.il/2026-27
    SUMMARY:Quiz 2: Foo &amp\\; bar opens
    DESCRIPTION:8 questions\\, one point each &lt\\;b&gt\\;.\\n
    LAST-MODIFIED:20260914T160436Z
    DTSTART:20261013T210100Z
    DTEND:20261013T210100Z
    CATEGORIES:11111-קורס א`),
  vevent(`UID:24961@moodle.huji.ac.il/2026-27
    SUMMARY:Quiz 2: Foo &amp\\; bar closes
    LAST-MODIFIED:20260914T160436Z
    DTSTART:20261021T205500Z
    DTEND:20261021T205500Z
    CATEGORIES:11111-קורס א`),
  vevent(`UID:28228@moodle.huji.ac.il/2026-27
    SUMMARY:Lab 1 site is due
    LAST-MODIFIED:20261014T075804Z
    DTSTART:20261015T205500Z
    DTEND:20261015T205500Z
    CATEGORIES:11111-קורס א`),
  // Renamed attendance activity, sessions with odd seconds, across the DST change (25.10.2026).
  vevent(`UID:44325@moodle.huji.ac.il/2026-27
    SUMMARY:Lecture Attendance
    DESCRIPTION:Regular class session\\n
    LAST-MODIFIED:20261007T135338Z
    DTSTART:20261019T144546Z
    DTEND:20261019T164546Z
    CATEGORIES:22222-קורס ב`),
  vevent(`UID:44331@moodle.huji.ac.il/2026-27
    SUMMARY:Lecture Attendance
    DESCRIPTION:Regular class session
    LAST-MODIFIED:20261007T135339Z
    DTSTART:20261026T154546Z
    DTEND:20261026T174546Z
    CATEGORIES:22222-קורס ב`),
  'END:VCALENDAR',
].join('\r\n');

describe('HUJI 2026-27 export shapes', () => {
  const events = parseIcs(ics);
  const byId = new Map(events.map((e) => [e.id, e]));

  it('decodes HTML entities Moodle leaves in names and descriptions', () => {
    expect(byId.get('24950')).toMatchObject({ type: 'quiz_open', title: 'Quiz 2: Foo & bar', rawSummary: 'Quiz 2: Foo & bar opens' });
    expect(byId.get('24950')?.description).toBe('8 questions, one point each <b>.');
    expect(byId.get('24961')).toMatchObject({ type: 'quiz_close', title: 'Quiz 2: Foo & bar' });
  });

  it('treats site events (English or Hebrew category) as course-less, not personal', () => {
    for (const id of ['1', '2']) {
      expect(byId.get(id)?.courseId).toBeUndefined();
      expect(byId.get(id)?.type).toBe('other');
    }
    expect(extractCourses(events).map((c) => c.id).sort()).toEqual(['11111', '22222']);
  });

  it('classifies "X is due" as an assignment', () => {
    expect(byId.get('28228')).toMatchObject({ type: 'assignment', title: 'Lab 1 site', courseId: '11111' });
  });

  it('builds one weekly slot from renamed attendance sessions across DST', () => {
    expect(byId.get('44325')?.type).toBe('class_session');
    const slots = deriveWeeklySlots(events);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ courseId: '22222', weekday: 1, startMinute: 17 * 60 + 45, endMinute: 19 * 60 + 45 });
    expect(slots[0]?.eventIds.sort()).toEqual(['44325', '44331']);
  });
});
