import { useState, type ReactNode } from 'react';
import type { EventChange, MoodleEvent } from '@mtm/core';
import { fmtDeadline, fmtTime, getLocalParts, isDeadlineType, useCourseColorIndex, courseColorStyle, useStore, useVisibleEvents } from '../../data';
import { dueDayInstant } from '../tasks/shared';

const SHOWN = 4;

/** "20.10", or "20.10 23:59" when two instants fall on the same day. */
function shortWhen(t: number, withTime: boolean, deadline: boolean): string {
  const d = deadline ? dueDayInstant(t) : t;
  const p = getLocalParts(d);
  return withTime ? `${p.day}.${p.month} ${fmtTime(d)}` : `${p.day}.${p.month}`;
}

/** One margin note: a short verb, the event name, and the dates in tabular numerals. */
function describe(c: EventChange): { verb: string; body: ReactNode } {
  const ev = (c.after ?? c.before) as MoodleEvent;
  const name = <bdi>{ev.title}</bdi>;
  switch (c.kind) {
    case 'added':
      return {
        verb: 'נוסף',
        body: (
          <>
            {name}
            {isDeadlineType(ev.type) && <span className="num"> · {fmtDeadline(ev.start)}</span>}
          </>
        ),
      };
    case 'removed':
      return { verb: 'הוסר', body: <s>{name}</s> };
    case 'renamed':
      return {
        verb: 'שם חדש',
        body: (
          <>
            <bdi>{c.before?.title ?? ''}</bdi> ← <bdi>{c.after?.title ?? ''}</bdi>
          </>
        ),
      };
    case 'time_changed': {
      const from = c.before?.start ?? 0;
      const to = c.after?.start ?? 0;
      const deadline = isDeadlineType(ev.type);
      const sameDay = shortWhen(from, false, deadline) === shortWhen(to, false, deadline);
      return {
        verb: to > from ? 'נדחה' : 'הוקדם',
        body: (
          <>
            {name}
            <span className="num">
              {' '}
              מ-<del>{shortWhen(from, sameDay, deadline)}</del> ל-<ins>{shortWhen(to, sameDay, deadline)}</ins>
            </span>
          </>
        ),
      };
    }
  }
}

function Note({ change: c, live, onOpen }: { change: EventChange; live: boolean; onOpen: () => void }) {
  const ev = (c.after ?? c.before)!;
  const idx = useCourseColorIndex(ev.courseId);
  const { verb, body } = describe(c);
  const course = ev.courseName ?? (ev.courseId ? ev.courseId : 'אישי');
  const content = (
    <>
      <span className="today-note__text">
        <strong className="today-note__verb">{verb}</strong> {body}
      </span>
      <span className="today-note__course" dir="auto">
        {course}
      </span>
    </>
  );
  return (
    <li className={`today-note today-note--${c.kind}`} style={courseColorStyle(idx)}>
      {live ? (
        <button type="button" className="today-note__row" onClick={onOpen} aria-haspopup="dialog">
          {content}
        </button>
      ) : (
        <div className="today-note__row">{content}</div>
      )}
    </li>
  );
}

/** "Changes since the last import" (added / moved / removed / renamed) as margin notes, dismissible. Hidden when empty. */
export function ChangesCard({ onOpen }: { onOpen: (id: string) => void }) {
  const { recentChanges, settings, dismissChanges } = useStore();
  const visible = useVisibleEvents();
  const [all, setAll] = useState(false);
  const hidden = new Set(settings.hiddenCourseIds);
  const changes = recentChanges.filter((c) => {
    const ev = c.after ?? c.before;
    return ev && !(ev.courseId && hidden.has(ev.courseId));
  });
  if (changes.length === 0) return null;
  const shown = all ? changes : changes.slice(0, SHOWN);

  return (
    <section aria-labelledby="today-changes-h" className="today-sec today-notes">
      <div className="today-h-row">
        <h2 id="today-changes-h" className="today-h">
          מאז הייבוא האחרון
        </h2>
        <button type="button" className="today-link-btn" onClick={dismissChanges}>
          ראיתי
        </button>
      </div>
      <ul role="list" className="today-notes__list">
        {shown.map((c) => (
          <Note
            key={`${c.kind}-${c.eventId}`}
            change={c}
            live={c.kind !== 'removed' && visible.some((e) => e.id === c.eventId)}
            onOpen={() => onOpen(c.eventId)}
          />
        ))}
      </ul>
      {changes.length > SHOWN && (
        <button type="button" className="today-link-btn today-notes__more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? 'פחות' : `עוד ${changes.length - SHOWN} שינויים`}
        </button>
      )}
    </section>
  );
}
