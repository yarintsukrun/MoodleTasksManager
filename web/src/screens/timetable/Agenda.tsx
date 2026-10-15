import { TypeIcon } from '../../components';
import { courseColorStyle } from '../../data';
import { columnItems, type DayColumn } from './model';
import { dayName, describe, placeLabel } from './WeekGrid';

/** Chronological list of a week's sessions and deadlines, grouped by day (mobile "סדר יום"). */
export function Agenda({ columns, colors, onOpen }: { columns: DayColumn[]; colors: Record<string, number>; onOpen: (eventId: string) => void }) {
  return (
    <div className="tt-agenda">
      {columns.map((c) => {
        const items = columnItems(c);
        return (
          <section key={c.weekday} className={`tt-agenda__day${c.isToday ? ' is-today' : ''}`} aria-label={dayName(c)}>
            <h2 className="tt-agenda__head">
              {dayName(c)}
              {c.isToday && <span className="tt-agenda__today">היום</span>}
            </h2>
            {items.length === 0 ? (
              <p className="muted small">אין אירועים</p>
            ) : (
              <ul className="tt-agenda__list">
                {items.map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      className={`tt-agenda__row tt-agenda__row--${it.kind}`}
                      style={courseColorStyle(it.courseId ? colors[it.courseId] : undefined)}
                      aria-label={describe(it, c)}
                      onClick={() => onOpen(it.eventId)}
                    >
                      <span className="tt-agenda__time num">{it.timeLabel}</span>
                      <TypeIcon type={it.type} size={28} />
                      <span className="tt-agenda__text">
                        <strong dir="auto">{it.kind === 'block' ? (it.courseName ?? it.title) : it.title}</strong>
                        <span className="muted small" dir="auto">{it.kind === 'block' ? placeLabel(it.location) : (it.courseName ?? 'אישי')}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
