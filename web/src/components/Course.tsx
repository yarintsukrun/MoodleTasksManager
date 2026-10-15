import { courseColorStyle, useCourseColorIndex } from '../data';

/** Small colored circle for a course (decorative; pair with the course name). */
export function CourseDot({ courseId, size = 10 }: { courseId: string | undefined; size?: number }) {
  const idx = useCourseColorIndex(courseId);
  return <span className="course-dot" aria-hidden="true" style={{ ...courseColorStyle(idx), ['--dot' as string]: `${size}px` }} />;
}

/** Pill with course color dot + name. Personal events (no courseId) render as "אישי". */
export function CourseBadge({ courseId, name }: { courseId: string | undefined; name?: string }) {
  const idx = useCourseColorIndex(courseId);
  const label = name ?? (courseId ? courseId : 'אישי');
  return (
    <span className="course-badge" style={courseColorStyle(idx)} title={label}>
      <span className="course-dot" aria-hidden="true" />
      <span className="course-badge__name" dir="auto">
        {label}
      </span>
    </span>
  );
}
