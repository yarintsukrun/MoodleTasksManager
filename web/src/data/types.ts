import type { EventChange, EventType, MoodleEvent, TaskState } from '@mtm/core';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePref;
  hiddenCourseIds: string[];
  /** courseId → palette index 0…7 */
  courseColors: Record<string, number>;
  /** epoch ms of the last successful import; undefined = never imported (→ onboarding). */
  lastImportAt?: number;
}

/** Everything persisted to IndexedDB. */
export interface PersistedData {
  version: 1;
  events: MoodleEvent[];
  taskStates: Record<string, TaskState>;
  recentChanges: EventChange[];
  settings: Settings;
}

/** Returned by importIcs — what was found in the uploaded file. */
export interface ImportSummary {
  total: number;
  courseCount: number;
  courses: { id: string; name: string; count: number }[];
  byType: Partial<Record<EventType, number>>;
  classSessions: number;
  assignments: number;
  quizzes: number;
  /** Changes vs. the previously stored data (empty on first import). */
  changes: { added: number; removed: number; timeChanged: number; renamed: number };
  isFirstImport: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', hiddenCourseIds: [], courseColors: {} };

export const EMPTY_DATA: PersistedData = {
  version: 1,
  events: [],
  taskStates: {},
  recentChanges: [],
  settings: DEFAULT_SETTINGS,
};
