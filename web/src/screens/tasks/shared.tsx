// Helpers shared by the Tasks and Today screens: due-day math, status toggle, "marked done" undo toast.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { MoodleEvent, TaskStatus } from '@mtm/core';
import { Icon } from '../../components';
import { fmtDate, getLocalParts, useStore } from '../../data';
import './shared.css';

const DAY = 86_400_000;

/** Instant used for the due *day*: a 00:00 local deadline belongs to the previous day. */
export function dueDayInstant(instant: number): number {
  const p = getLocalParts(instant);
  return p.hour === 0 && p.minute === 0 ? instant - 60_000 : instant;
}

/** Local YYYY-MM-DD of the due day. */
export const dueDayKey = (instant: number) => getLocalParts(dueDayInstant(instant)).dateKey;

/** "היום" / "מחר" / "יום ה׳ 16.10" for a due instant. */
export function dueDayLabel(instant: number, now: number): string {
  const key = dueDayKey(instant);
  if (key === getLocalParts(now).dateKey) return 'היום';
  if (key === getLocalParts(now + DAY).dateKey) return 'מחר';
  return fmtDate(dueDayInstant(instant));
}

export const STATUS_LABELS: Record<TaskStatus, string> = { todo: 'לא התחלתי', doing: 'בעבודה', done: 'הוגש' };
export const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'done', done: 'todo' };

/** Round status button cycling todo → doing → done. Shape (empty / half / check) carries meaning, not just color. */
export function StatusToggle({ status, title, onCycle }: { status: TaskStatus; title: string; onCycle: () => void }) {
  const next = NEXT_STATUS[status];
  return (
    <button
      type="button"
      className={`status-toggle status-toggle--${status}`}
      aria-pressed={status === 'done' ? true : status === 'doing' ? 'mixed' : false}
      aria-label={`${title}: ${STATUS_LABELS[status]}. לחיצה תסמן "${STATUS_LABELS[next]}"`}
      title={`${STATUS_LABELS[status]} (לחיצה: ${STATUS_LABELS[next]})`}
      onClick={onCycle}
    >
      <span className="status-toggle__mark" aria-hidden="true">
        {status === 'done' && <Icon name="check" />}
      </span>
    </button>
  );
}

interface Pending {
  id: string;
  title: string;
  prev: TaskStatus;
}

/** Status setter that shows an undo toast whenever a task becomes "done". Render `toast` once in the screen. */
export function useStatusWithUndo(): { setStatus: (e: MoodleEvent, status: TaskStatus) => void; toast: ReactNode } {
  const { taskStates, setTaskStatus } = useStore();
  const [pending, setPending] = useState<Pending | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!pending || paused) return;
    const t = setTimeout(() => setPending(null), 6000);
    return () => clearTimeout(t);
  }, [pending, paused]);

  const setStatus = useCallback(
    (e: MoodleEvent, status: TaskStatus) => {
      const prev = taskStates[e.id]?.status ?? 'todo';
      setTaskStatus(e.id, status);
      setPending(status === 'done' && prev !== 'done' ? { id: e.id, title: e.title, prev } : null);
    },
    [taskStates, setTaskStatus],
  );

  const undo = () => {
    if (pending) setTaskStatus(pending.id, pending.prev);
    setPending(null);
    setPaused(false);
  };

  const toast = (
    <div className="undo-toast-region" role="status" aria-live="polite">
      {pending && (
        <div
          className="undo-toast"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <Icon name="check" className="undo-toast__icon" />
          <span className="undo-toast__text">
            סומן כהוגש: <strong>{pending.title}</strong>
          </span>
          <button type="button" className="undo-toast__btn" onClick={undo}>
            ביטול
          </button>
          <button type="button" className="icon-btn undo-toast__close" aria-label="סגור הודעה" onClick={() => setPending(null)}>
            <Icon name="close" />
          </button>
        </div>
      )}
    </div>
  );

  return { setStatus, toast };
}

/** Read/write a JSON value in sessionStorage; storage failures are ignored. */
export function useSessionState<T extends object>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? { ...initial, ...(JSON.parse(raw) as T) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode / quota — filters just won't persist */
    }
  }, [key, value]);
  return [value, setValue];
}
