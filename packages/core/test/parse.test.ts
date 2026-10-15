import { describe, expect, it } from 'vitest';
import { extractCourses, parseIcs } from '../src/index';
import { fixture, utc } from './helpers';

const hebrew = fixture('hebrew.ics');
const english = fixture('english.ics');

describe('parseIcs — Hebrew fixture', () => {
  const events = parseIcs(hebrew);
  const byId = new Map(events.map((e) => [e.id, e]));

  it('parses valid events and skips malformed ones', () => {
    expect(events.map((e) => e.id).sort()).toEqual(
      [
        '900001', '900002', '900003', '900004', '900010', '900011', '900020', '900021',
        '900022', '900023', '900024', '900025', '900026', '900030', '900050',
      ].sort(),
    );
    expect(byId.has('900040')).toBe(false); // invalid DTSTART
    expect(byId.has('900041')).toBe(false); // missing END:VEVENT
  });

  it('returns events sorted by start', () => {
    const starts = events.map((e) => e.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('maps all VEVENT fields of an attendance session', () => {
    expect(byId.get('900001')).toEqual({
      id: '900001',
      uid: '900001@moodle.example.test/2025-26',
      type: 'class_session',
      title: 'נוכחות תלמידים',
      rawSummary: 'נוכחות תלמידים',
      description: 'Regular class session',
      courseId: '12345',
      courseName: 'מבוא לתכנות',
      courseShortname: '12345-מבוא לתכנות',
      start: utc('2026-10-11T09:00:00Z'),
      end: utc('2026-10-11T11:00:00Z'),
      isPoint: false,
      lastModified: utc('2026-10-01T08:00:00Z'),
    });
  });

  it('extracts assignment title and unescapes the description', () => {
    const e = byId.get('900020')!;
    expect(e.type).toBe('assignment');
    expect(e.title).toBe('תרגיל 2');
    expect(e.isPoint).toBe(true);
    expect(e.description).toBe('יש להגיש קובץ PDF אחד.\nבהצלחה!');
  });

  it('handles Hebrew gershayim quotes', () => {
    expect(byId.get('900050')).toMatchObject({ type: 'assignment', title: 'תרגיל 3' });
  });

  it('classifies quiz open/close pair with the same title', () => {
    expect(byId.get('900021')).toMatchObject({ type: 'quiz_open', title: 'בוחן 1' });
    expect(byId.get('900022')).toMatchObject({ type: 'quiz_close', title: 'בוחן 1' });
  });

  it('classifies forum, meeting, activity events', () => {
    expect(byId.get('900023')).toMatchObject({ type: 'forum_due', title: 'דיון שבועי' });
    expect(byId.get('900024')).toMatchObject({
      type: 'online_meeting',
      title: 'תרגול מקוון',
      location: 'https://zoom.example.test/j/000',
    });
    expect(byId.get('900025')).toMatchObject({ type: 'activity_close', title: 'סקר אמצע סמסטר' });
    expect(byId.get('900026')).toMatchObject({ type: 'activity_open', title: 'משוב על הקורס' });
  });

  it('unfolds folded lines', () => {
    expect(byId.get('900026')!.description).toBe(
      'תיאור ארוך שמתקפל על פני כמה שורות כדי לבדוק שהפרסר מחבר שורות מקופלות כמו שצריך.',
    );
  });

  it('treats events without CATEGORIES as personal', () => {
    const e = byId.get('900030')!;
    expect(e.type).toBe('personal');
    expect(e.courseId).toBeUndefined();
    expect(e.courseName).toBeUndefined();
    expect(e.courseShortname).toBeUndefined();
  });

  it('classifies a renamed recurring lecture with duration as class_session', () => {
    expect(byId.get('900010')).toMatchObject({ type: 'class_session', title: 'הרצאה', location: 'בניין לדוגמה 101' });
  });

  it('gives the same result for CRLF line endings', () => {
    expect(parseIcs(hebrew.replace(/\n/g, '\r\n'))).toEqual(events);
  });
});

describe('parseIcs — English fixture', () => {
  const byId = new Map(parseIcs(english).map((e) => [e.id, e]));

  it('classifies English Moodle strings', () => {
    expect(byId.get('800001')).toMatchObject({ type: 'assignment', title: 'Exercise 3' });
    expect(byId.get('800002')).toMatchObject({ type: 'other', title: 'Exercise 3' });
    expect(byId.get('800003')).toMatchObject({ type: 'quiz_open', title: 'Midterm quiz' });
    expect(byId.get('800004')).toMatchObject({ type: 'quiz_close', title: 'Midterm quiz' });
    expect(byId.get('800005')).toMatchObject({ type: 'class_session', title: 'Attendance', location: 'Room 7' });
    expect(byId.get('800007')).toMatchObject({ type: 'online_meeting', title: 'Office hours' });
  });

  it('uses the whole shortname as course id when it has no leading number', () => {
    expect(byId.get('800008')).toMatchObject({
      courseId: 'SEMINAR-CS',
      courseName: 'SEMINAR-CS',
      courseShortname: 'SEMINAR-CS',
      type: 'other',
    });
  });
});

describe('parseIcs — robustness', () => {
  it('never throws on garbage', () => {
    expect(parseIcs('')).toEqual([]);
    expect(parseIcs('not an ics file at all')).toEqual([]);
    expect(parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\n:::\nEND:VEVENT\nEND:VCALENDAR')).toEqual([]);
    expect(() => parseIcs('BEGIN:VEVENT\nDTSTART;VALUE=DATE:2026\nEND:VEVENT')).not.toThrow();
  });

  it('defaults DTEND to DTSTART when missing', () => {
    const [e] = parseIcs('BEGIN:VEVENT\nUID:5@x\nSUMMARY:פגישה\nDTSTART:20261016T080000Z\nEND:VEVENT');
    expect(e).toMatchObject({ id: '5', isPoint: true, type: 'personal' });
  });
});

describe('extractCourses', () => {
  it('lists unique courses sorted by id', () => {
    expect(extractCourses(parseIcs(hebrew + english))).toEqual([
      { id: '12345', name: 'מבוא לתכנות', shortname: '12345-מבוא לתכנות' },
      { id: '23456', name: 'אלגברה לינארית', shortname: '23456-אלגברה לינארית' },
      { id: '34567', name: 'Data Structures', shortname: '34567-Data Structures' },
      { id: 'SEMINAR-CS', name: 'SEMINAR-CS', shortname: 'SEMINAR-CS' },
    ]);
  });
});
