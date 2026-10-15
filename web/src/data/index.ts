// Public surface of the data layer for screens/components.
export { StoreProvider, useStore, type StoreValue } from './store';
export { useVisibleEvents, useCourses, useCourseColor, useCourseColorIndex, useTaskState, useNow, type CourseInfo } from './hooks';
export { COURSE_COLOR_COUNT, COURSE_COLOR_NAMES, courseColor, courseColorStyle } from './colors';
export * from './format';
export { buildDemoIcs } from './demo';
export type { Settings, ThemePref, ImportSummary } from './types';
