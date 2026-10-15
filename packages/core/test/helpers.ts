import englishIcs from './fixtures/english.ics?raw';
import hebrewIcs from './fixtures/hebrew.ics?raw';
import type { MoodleEvent } from '../src/types';

const FIXTURES: Record<string, string> = { 'hebrew.ics': hebrewIcs, 'english.ics': englishIcs };

export function fixture(name: string): string {
  const content = FIXTURES[name];
  if (content === undefined) throw new Error(`Unknown fixture ${name}`);
  return content;
}

export const utc = (iso: string): number => Date.parse(iso);

export function makeEvent(overrides: Partial<MoodleEvent> & { id: string; start: number }): MoodleEvent {
  const end = overrides.end ?? overrides.start;
  return {
    uid: `${overrides.id}@moodle.example.test/2025-26`,
    type: 'assignment',
    title: `Event ${overrides.id}`,
    rawSummary: `Event ${overrides.id} is due`,
    description: '',
    courseId: '12345',
    courseName: 'מבוא לתכנות',
    courseShortname: '12345-מבוא לתכנות',
    isPoint: end === overrides.start,
    lastModified: 0,
    ...overrides,
    end,
  };
}
