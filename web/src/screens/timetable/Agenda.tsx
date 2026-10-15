import { TYPE_LABELS } from '../../components';
import { courseColorStyle } from '../../data';
import { columnItems, type DayColumn } from './model';
import { DateStub, dayName, describe, placeLabel } from './WeekGrid';

/** Chronological list of a week's sessions and deadlines, grouped by day (mobile "סדר יום"). */
export function Agenda({ columns, colors, onOpen }: { columns: DayColumn[]; colors: Record<string, number>; onOpen: (eventId: string) => void }) {
  return (
    <div className="tt-agenda">
      {columns.map((c) => {
        const items = columnItems(c);
        return (
          <section key={c.weekday} className={`tt-agenda__day${c.isToday ? ' is-today' : ''}`} aria-label={dayName(c)}>
            <h2 className="tt-agenda__head">
              <DateStub col={c} />
            </h2>
            {items.length === 0 ? (
              <p className="tt-agenda__empty">אין שיעורים או הגשות</p>
            ) : (
              <ul className="tt-agenda__list">
                {items.map((it) => {
                  const meta =
                    it.kind === 'block'
                      ? [TYPE_LABELS[it.type], placeLabel(it.location)]
                      : [TYPE_LABELS[it.type], it.courseName ?? 'אישי'];
                  return (
                    <li key={it.key}>
                      <button
                        type="button"
                        className={`tt-agenda__row tt-agenda__row--${it.kind}`}
                        style={courseColorStyle(it.courseId ? colors[it.courseId] : undefined)}
                        aria-label={describe(it, c)}
                        onClick={() => onOpen(it.eventId)}
                      >
                        <span className="tt-agenda__time num">
                          {it.kind === 'block' ? (
                            <>
                              <span>{it.timeLabel.split('–')[0]}</span>
                              <span className="tt-agenda__until">{it.timeLabel.split('–')[1]}</span>
                            </>
                          ) : (
                            <span>{it.timeLabel}</span>
                          )}
                        </span>
                        <span className="tt-agenda__text">
                          <span className="tt-agenda__title" dir="auto">
                            {it.kind === 'block' ? (it.courseName ?? it.title) : it.title}
                          </span>
                          <span className="tt-agenda__meta">
                            {meta.filter(Boolean).map((m, i) => (
                              <span key={i} dir="auto">
                                {m}
                              </span>
                            ))}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
