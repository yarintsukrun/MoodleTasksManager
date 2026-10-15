import { useEffect, useId, useRef, useState } from 'react';
import type { EventType, MoodleEvent, TaskStatus } from '@mtm/core';
import { deadlineTone, fmtDate, fmtDeadline, fmtRelative, fmtTimeRange, getUrgency, isDeadlineType, useNow, useStore } from '../data';
import { CourseBadge } from './Course';
import { Drawer } from './Drawer';
import { Icon } from './icons';
import { TYPE_LABELS, TypeIcon } from './TypeIcon';
import { UrgencyBadge } from './UrgencyBadge';

export const MOODLE_UPCOMING_URL = 'https://moodle.huji.ac.il/2025-26/calendar/view.php?view=upcoming';

const STATUSES: { value: TaskStatus; label: string; mark: string }[] = [
  { value: 'todo', label: 'לא התחלתי', mark: '☐' },
  { value: 'doing', label: 'בעבודה', mark: '◐' },
  { value: 'done', label: 'הוגש', mark: '☑' },
];

/** Full details + editing (status, estimate, notes, type override) for one event. Render inside a Drawer. */
export function EventDetails({ event }: { event: MoodleEvent }) {
  const { taskStates, events, setTaskStatus, setEstimate, setNotes, setTypeOverride } = useStore();
  const now = useNow();
  const state = taskStates[event.id];
  const original = events.find((e) => e.id === event.id) ?? event;
  const deadline = isDeadlineType(event.type);
  const done = state?.status === 'done';
  const ids = { est: useId(), notes: useId(), type: useId() };

  // Drafts commit on blur/Enter and on unmount (closing the drawer with Esc doesn't blur).
  const [estimate, setEstimateDraft] = useState(state?.estimateHours?.toString() ?? '');
  const [notes, setNotesDraft] = useState(state?.notes ?? '');
  const commit = () => {
    const n = Number.parseFloat(estimate);
    const hours = Number.isFinite(n) && n >= 0 ? n : undefined;
    if (hours !== state?.estimateHours) setEstimate(event.id, hours);
    if (notes !== (state?.notes ?? '')) setNotes(event.id, notes);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => () => commitRef.current(), []);

  const isUrl = event.location && /^https?:\/\//.test(event.location);

  return (
    <div className="details">
      <div className="row">
        <TypeIcon type={event.type} withLabel />
        <CourseBadge courseId={event.courseId} name={event.courseName} />
      </div>

      <dl className="details__meta">
        <dt>{event.isPoint ? 'מועד' : 'זמן'}</dt>
        <dd>
          <time dateTime={new Date(event.start).toISOString()}>
            {event.isPoint ? fmtDeadline(event.start) : `${fmtDate(event.start)} · ${fmtTimeRange(event.start, event.end)}`}
          </time>
        </dd>
        <dt>מתי</dt>
        <dd className="row">
          <span>{fmtRelative(event.start, now)}</span>
          {deadline && <UrgencyBadge urgency={getUrgency(event, state, now)} tone={deadlineTone(event.start, now, done)} />}
        </dd>
        {event.location && (
          <>
            <dt>מיקום</dt>
            <dd style={{ overflowWrap: 'anywhere' }}>
              {isUrl ? (
                <a href={event.location} target="_blank" rel="noreferrer">
                  {event.location}
                </a>
              ) : (
                event.location
              )}
            </dd>
          </>
        )}
      </dl>

      {event.description.trim() && <p className="details__desc">{event.description.trim()}</p>}

      {deadline && (
        <section>
          <h3 className="details__section-title">סטטוס</h3>
          <div className="segmented" role="group" aria-label="סטטוס המשימה">
            {STATUSES.map((s) => (
              <button key={s.value} type="button" aria-pressed={(state?.status ?? 'todo') === s.value} onClick={() => setTaskStatus(event.id, s.value)}>
                <span aria-hidden="true">{s.mark}</span>
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {deadline && (
        <div className="field">
          <label className="field__label" htmlFor={ids.est}>
            הערכת זמן (שעות)
          </label>
          <input
            id={ids.est}
            className="input num"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={estimate}
            placeholder="למשל 6"
            onChange={(e) => setEstimateDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            style={{ maxInlineSize: 160 }}
          />
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor={ids.notes}>
          הערות
        </label>
        <textarea id={ids.notes} className="input" value={notes} onChange={(e) => setNotesDraft(e.target.value)} onBlur={commit} />
      </div>

      <div className="field">
        <label className="field__label" htmlFor={ids.type}>
          סוג האירוע
        </label>
        <select
          id={ids.type}
          className="input"
          value={state?.typeOverride ?? original.type}
          onChange={(e) => {
            const t = e.target.value as EventType;
            setTypeOverride(event.id, t === original.type ? undefined : t);
          }}
        >
          {(Object.keys(TYPE_LABELS) as EventType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
              {t === original.type ? ' (זוהה אוטומטית)' : ''}
            </option>
          ))}
        </select>
      </div>

      <a className="btn btn--block" href={MOODLE_UPCOMING_URL} target="_blank" rel="noreferrer">
        <Icon name="external" />
        פתח ב-Moodle
      </a>
    </div>
  );
}

/** Convenience: Drawer titled with the event title, containing EventDetails. `event=null` → closed. */
export function EventDrawer({ event, onClose }: { event: MoodleEvent | null; onClose: () => void }) {
  return (
    <Drawer open={event !== null} onClose={onClose} title={event?.title ?? ''}>
      {event && <EventDetails key={event.id} event={event} />}
    </Drawer>
  );
}
