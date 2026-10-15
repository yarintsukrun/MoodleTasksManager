import type { CSSProperties } from 'react';

export const COURSE_COLOR_COUNT = 8;
export const COURSE_COLOR_NAMES = ['כחול', 'ירוק', 'סגול', 'כתום', 'ורוד', 'טורקיז', 'חרדל', 'ליים'];

/** CSS color value for a palette index (undefined → neutral). */
export const courseColor = (index: number | undefined): string =>
  index === undefined ? 'var(--course-none)' : `var(--course-${index % COURSE_COLOR_COUNT})`;

/** Inline style that sets --c / --c-soft, consumed by .chip, .course-dot, .course-badge, .swatch etc. */
export const courseColorStyle = (index: number | undefined): CSSProperties => {
  const key = index === undefined ? 'none' : String(index % COURSE_COLOR_COUNT);
  return { '--c': `var(--course-${key})`, '--c-soft': `var(--course-${key}-soft)` } as CSSProperties;
};

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/**
 * Deterministically assign palette indices to courses that don't have one yet.
 * Starts from hash(courseId) and probes for an unused color, so new courses avoid existing ones while any are free.
 */
export function assignCourseColors(existing: Record<string, number>, courseIds: string[]): Record<string, number> {
  const result = { ...existing };
  const fresh = [...new Set(courseIds)].filter((id) => result[id] === undefined).sort();
  for (const id of fresh) {
    const used = new Set(Object.values(result));
    const start = hash(id) % COURSE_COLOR_COUNT;
    let pick = start;
    for (let i = 0; i < COURSE_COLOR_COUNT; i++) {
      const c = (start + i) % COURSE_COLOR_COUNT;
      if (!used.has(c)) {
        pick = c;
        break;
      }
    }
    result[id] = pick;
  }
  return result;
}
