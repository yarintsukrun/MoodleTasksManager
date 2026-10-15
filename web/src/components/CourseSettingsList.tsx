import { COURSE_COLOR_COUNT, COURSE_COLOR_NAMES, courseColorStyle, useCourses, useStore } from '../data';
import { Icon } from './icons';

/** Course list with palette color picker + "show" toggle (used by onboarding and settings). */
export function CourseSettingsList() {
  const courses = useCourses();
  const { setCourseColor, toggleCourseHidden } = useStore();
  if (courses.length === 0) return <p className="muted">אין קורסים עדיין.</p>;
  return (
    <ul className="course-list">
      {courses.map((c) => (
        <li key={c.id} className={c.hidden ? 'course-list__hidden' : undefined}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="row">
              <span className="course-dot" style={{ ...courseColorStyle(c.colorIndex), ['--dot' as string]: '14px' }} aria-hidden="true" />
              <strong>{c.name}</strong>
              <span className="muted small num">{c.id}</span>
            </span>
            <label className="switch small">
              <input type="checkbox" checked={!c.hidden} onChange={() => toggleCourseHidden(c.id)} />
              הצג
            </label>
          </div>
          <div className="swatches" role="radiogroup" aria-label={`צבע עבור ${c.name}`}>
            {Array.from({ length: COURSE_COLOR_COUNT }, (_, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                className="swatch"
                aria-checked={c.colorIndex === i}
                aria-label={COURSE_COLOR_NAMES[i]}
                style={courseColorStyle(i)}
                onClick={() => setCourseColor(c.id, i)}
              >
                <span>{c.colorIndex === i && <Icon name="check" width={16} height={16} strokeWidth={3} />}</span>
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
