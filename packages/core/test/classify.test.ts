import { describe, expect, it } from 'vitest';
import { classify } from '../src/index';
import type { EventType } from '../src/types';

type Case = [summary: string, type: EventType, title: string, opts?: { description?: string; isPoint?: boolean; hasCourse?: boolean }];

const cases: Case[] = [
  // Hebrew
  ["יש להגיש את 'תרגיל 1'", 'assignment', 'תרגיל 1'],
  ['יש להגיש את ״תרגיל 1״', 'assignment', 'תרגיל 1'],
  ['יש להגיש את "תרגיל 1"', 'assignment', 'תרגיל 1'],
  ['יש להגיש את תרגיל 1', 'assignment', 'תרגיל 1'],
  ["יש להגיש את 'תרגיל 1' עם ארכה", 'assignment', 'תרגיל 1'],
  ['Essay is due (extension)', 'assignment', 'Essay'],
  ['תרגיל 1 עם ארכה', 'assignment', 'תרגיל 1'],
  ['נפתח ב בוחן אמצע', 'quiz_open', 'בוחן אמצע'],
  ['תאריך הגשה בוחן אמצע', 'quiz_close', 'בוחן אמצע'],
  ['פורום שאלות דורש התייחסות', 'forum_due', 'פורום שאלות'],
  ["המפגש 'שיעור 3' התחיל", 'online_meeting', 'שיעור 3'],
  ['המפגש שיעור 3 יתקים ב 10:00', 'online_meeting', 'שיעור 3'],
  ['שיעור בזום', 'online_meeting', 'שיעור בזום'],
  ['BBB room', 'online_meeting', 'BBB room'],
  ['סקר נפתח', 'activity_open', 'סקר'],
  ['הבחירה נפתחת', 'activity_open', 'הבחירה'],
  ['תאריך פתיחה: סקר', 'activity_open', 'סקר'],
  ['השיעור המסתעף פתוח', 'activity_open', 'השיעור המסתעף'],
  ['הסדנה מתחילה', 'activity_open', 'הסדנה'],
  ['סקר נסגר', 'activity_close', 'סקר'],
  ['הבחירה נסגרת', 'activity_close', 'הבחירה'],
  ['תאריך סגירה: סקר', 'activity_close', 'סקר'],
  ['הסקר סגור', 'activity_close', 'הסקר'],
  ['הסדנה מסתיימת', 'activity_close', 'הסדנה'],
  ['השיעור מסתיים', 'activity_close', 'השיעור'],
  ['נוכחות תלמידים', 'class_session', 'נוכחות תלמידים', { isPoint: false }],
  // English
  ['Essay is due', 'assignment', 'Essay'],
  ['Essay is due to be graded', 'other', 'Essay'],
  ['Quiz 1 opens', 'quiz_open', 'Quiz 1'],
  ['Quiz 1 closes', 'quiz_close', 'Quiz 1'],
  ['Lecture 4 starts', 'online_meeting', 'Lecture 4'],
  ['Attendance', 'class_session', 'Attendance', { isPoint: false }],
  ['Zoom: recitation', 'online_meeting', 'Zoom: recitation'],
];

describe('classify', () => {
  it.each(cases)('%s → %s', (summary, type, title, opts) => {
    expect(classify(summary, opts?.description ?? '', opts?.isPoint ?? true, opts?.hasCourse ?? true)).toEqual({
      type,
      title,
    });
  });

  it('uses the "Regular class session" description', () => {
    expect(classify('שיעור', 'Regular class session', false, true).type).toBe('class_session');
  });

  it('treats any non-point course event as a class session', () => {
    expect(classify('הרצאה', '', false, true)).toEqual({ type: 'class_session', title: 'הרצאה' });
  });

  it('falls back to personal without a course and other with one', () => {
    expect(classify('רופא שיניים', '', true, false)).toEqual({ type: 'personal', title: 'רופא שיניים' });
    expect(classify('רופא שיניים', '', false, false)).toEqual({ type: 'personal', title: 'רופא שיניים' });
    expect(classify('הודעה כללית', '', true, true)).toEqual({ type: 'other', title: 'הודעה כללית' });
  });

  it('trims and collapses whitespace', () => {
    expect(classify("  יש להגיש את  'תרגיל 5'  ", '', true, true)).toEqual({ type: 'assignment', title: 'תרגיל 5' });
  });

  it('handles an empty summary', () => {
    expect(classify('', '', true, false)).toEqual({ type: 'personal', title: '' });
  });
});
