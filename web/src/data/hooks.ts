// Selector hooks for screens. All derive from useStore(); core calls are guarded with fallbacks.
import { useEffect, useMemo, useState } from 'react';
import { extractCourses, type Course, type MoodleEvent, type TaskState } from '@mtm/core';
import { courseColor } from './colors';
import { useStore } from './store';

/** Events of non-hidden courses, with the user's typeOverride applied to `type`. */
export function useVisibleEvents(): MoodleEvent[] {
  const { events, taskStates, settings } = useStore();
  return useMemo(() => {
    const hidden = new Set(settings.hiddenCourseIds);
    return events
      .filter((e) => !e.courseId || !hidden.has(e.courseId))
      .map((e) => {
        const override = taskStates[e.id]?.typeOverride;
        return override && override !== e.type ? { ...e, type: override } : e;
      });
  }, [events, taskStates, settings.hiddenCourseIds]);
}

export interface CourseInfo extends Course {
  colorIndex: number | undefined;
  hidden: boolean;
}

function fallbackCourses(events: MoodleEvent[]): Course[] {
  const map = new Map<string, Course>();
  for (const e of events) {
    if (e.courseId && !map.has(e.courseId))
      map.set(e.courseId, { id: e.courseId, name: e.courseName ?? e.courseId, shortname: e.courseShortname ?? e.courseId });
  }
  return [...map.values()];
}

/** All courses found in the data (including hidden ones), sorted by Hebrew name, with color + hidden flag. */
export function useCourses(): CourseInfo[] {
  const { events, settings } = useStore();
  return useMemo(() => {
    let courses: Course[];
    try {
      courses = extractCourses(events);
    } catch (err) {
      console.warn('[core] extractCourses failed, using fallback', err);
      courses = fallbackCourses(events);
    }
    return courses
      .map((c) => ({ ...c, colorIndex: settings.courseColors[c.id], hidden: settings.hiddenCourseIds.includes(c.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [events, settings.courseColors, settings.hiddenCourseIds]);
}

/** CSS color value (`var(--course-N)`) for a course; neutral for personal/unknown. */
export function useCourseColor(courseId: string | undefined): string {
  const { settings } = useStore();
  return courseColor(courseId ? settings.courseColors[courseId] : undefined);
}

/** Palette index for a course (for courseColorStyle()); undefined for personal/unknown. */
export function useCourseColorIndex(courseId: string | undefined): number | undefined {
  const { settings } = useStore();
  return courseId ? settings.courseColors[courseId] : undefined;
}

/** The user's state for one event (undefined = untouched, i.e. 'todo'). */
export function useTaskState(id: string): TaskState | undefined {
  return useStore().taskStates[id];
}

/** Current time (epoch ms), re-rendering every intervalMs (default 60s). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
