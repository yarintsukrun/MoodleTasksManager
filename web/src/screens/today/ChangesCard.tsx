import { useState } from 'react';
import type { EventChange, MoodleEvent } from '@mtm/core';
import { Card, CourseBadge, Icon, type IconName } from '../../components';
import { fmtDeadline, fmtTime, getLocalParts, isDeadlineType, useStore, useVisibleEvents } from '../../data';
import { dueDayInstant } from '../tasks/shared';

const SHOWN = 4;

/** "20.10", or "20.10 23:59" when two instants fall on the same day. */
function shortWhen(t: number, withTime: boolean, deadline: boolean): string {
  const d = deadline ? dueDayInstant(t) : t;
  const p = getLocalParts(d);
  return withTime ? `${p.day}.${p.month} ${fmtTime(d)}` : `${p.day}.${p.month}`;
}

function describe(c: EventChange): { icon: IconName; text: string } {
  const ev = (c.after ?? c.before) as MoodleEvent;
  const name = `"${ev.title}"`;
  switch (c.kind) {
    case 'added':
      return { icon: 'sparkle', text: `נוסף ${name}${isDeadlineType(ev.type) ? ` · ${fmtDeadline(ev.start)}` : ''}` };
    case 'removed':
      return { icon: 'trash', text: `הוסר ${name}` };
    case 'renamed':
      return { icon: 'other', text: `"${c.before?.title ?? ''}" נקרא עכשיו "${c.after?.title ?? ''}"` };
    case 'time_changed': {
      const from = c.before?.start ?? 0;
      const to = c.after?.start ?? 0;
      const deadline = isDeadlineType(ev.type);
      const sameDay = shortWhen(from, false, deadline) === shortWhen(to, false, deadline);
      const verb = to > from ? 'נדחה' : 'הוקדם';
      return { icon: 'clock', text: `${name} ${verb} מ-${shortWhen(from, sameDay, deadline)} ל-${shortWhen(to, sameDay, deadline)}${to > from && deadline ? ' 🎉' : ''}` };
    }
  }
}

/** "Changes since the last import" (added / moved / removed / renamed), dismissible. Hidden when empty. */
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
    <section aria-labelledby="today-changes-h">
      <div className="today__h-row">
        <h2 id="today-changes-h" className="today__h">
          <Icon name="alert" aria-hidden="true" />
          שינויים מאז הייבוא האחרון
        </h2>
        <button type="button" className="btn btn--ghost small" onClick={dismissChanges}>
          <Icon name="check" aria-hidden="true" />
          ראיתי
        </button>
      </div>
      <Card flat className="today-changes">
        <ul role="list">
          {shown.map((c) => {
            const { icon, text } = describe(c);
            const ev = (c.after ?? c.before)!;
            const live = c.kind !== 'removed' && visible.some((e) => e.id === c.eventId);
            const body = (
              <>
                <Icon name={icon} aria-hidden="true" className="today-changes__icon" />
                <span className="today-changes__text">{text}</span>
                <CourseBadge courseId={ev.courseId} name={ev.courseName} />
              </>
            );
            return (
              <li key={`${c.kind}-${c.eventId}`} className={`today-changes__item today-changes__item--${c.kind}`}>
                {live ? (
                  <button type="button" className="today-changes__row" onClick={() => onOpen(c.eventId)} aria-haspopup="dialog">
                    {body}
                  </button>
                ) : (
                  <div className="today-changes__row">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
        {changes.length > SHOWN && (
          <button type="button" className="btn btn--ghost btn--block small" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? 'הצג פחות' : `הצג את כל ${changes.length} השינויים`}
          </button>
        )}
      </Card>
    </section>
  );
}
