import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventType, MoodleEvent, TaskState, Urgency } from '@mtm/core';
import { Card, Chip, CourseBadge, CourseDot, EmptyState, EventDrawer, Icon, PageHeader, TypeIcon, URGENCY_LABELS, UrgencyBadge } from '../../components';
import { deadlineTone, fmtDate, fmtDeadline, fmtRelative, fmtTime, getLocalParts, getUrgency, isDeadlineType, useCourses, useNow, useStore, useVisibleEvents } from '../../data';
import { StatusToggle, NEXT_STATUS, useSessionState, useStatusWithUndo } from './shared';
import './tasks.css';

type TypeFilter = 'assignment' | 'quiz' | 'forum' | 'other';
const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'assignment', label: 'מטלות' },
  { value: 'quiz', label: 'בחנים' },
  { value: 'forum', label: 'פורומים' },
  { value: 'other', label: 'אחר' },
];
const typeFilterOf = (t: EventType): TypeFilter =>
  t === 'assignment' ? 'assignment' : t === 'quiz_close' || t === 'quiz_open' ? 'quiz' : t === 'forum_due' ? 'forum' : 'other';

const GROUPS: Urgency[] = ['overdue', 'today', 'tomorrow', 'this_week', 'later', 'done'];

interface Filters {
  courses: string[];
  types: TypeFilter[];
  query: string;
  showQuizOpen: boolean;
}
const NO_FILTERS: Filters = { courses: [], types: [], query: '', showQuizOpen: false };

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

interface Item {
  event: MoodleEvent;
  state: TaskState | undefined;
  urgency: Urgency;
  /** Start of the open window (matching quiz/activity "opens" event), shown on the closing row. */
  opensAt?: number;
}

const OPENER: Partial<Record<EventType, EventType>> = { quiz_close: 'quiz_open', activity_close: 'activity_open' };
const pairKey = (e: MoodleEvent) => `${e.courseId ?? ''}|${e.title.trim()}`;

/** Tasks: every deadline grouped by urgency, with status toggles, filters and search. */
export default function TasksScreen() {
  const events = useVisibleEvents();
  const courses = useCourses();
  const { taskStates } = useStore();
  const now = useNow(30_000);
  const { setStatus, toast } = useStatusWithUndo();
  const [filters, setFilters] = useSessionState<Filters>('mtm.tasks.filters', NO_FILTERS);
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // All tasks (before filters): deadline types, plus upcoming quiz openings when requested.
  const all = useMemo<Item[]>(() => {
    const opens = new Map<string, number>();
    for (const e of events) if (e.type === 'quiz_open' || e.type === 'activity_open') opens.set(`${e.type}|${pairKey(e)}`, e.start);
    return events
      .filter((e) => isDeadlineType(e.type) || (filters.showQuizOpen && e.type === 'quiz_open' && e.end >= now))
      .map((event) => {
        const opener = OPENER[event.type];
        return {
          event,
          state: taskStates[event.id],
          urgency: getUrgency(event, taskStates[event.id], now),
          opensAt: opener ? opens.get(`${opener}|${pairKey(event)}`) : undefined,
        };
      });
  }, [events, taskStates, now, filters.showQuizOpen]);

  const q = filters.query.trim().toLowerCase();
  const shown = all.filter(
    ({ event: e }) =>
      (filters.courses.length === 0 || (e.courseId !== undefined && filters.courses.includes(e.courseId))) &&
      (filters.types.length === 0 || filters.types.includes(typeFilterOf(e.type))) &&
      (!q || `${e.title} ${e.courseName ?? ''}`.toLowerCase().includes(q)),
  );

  const groups = GROUPS.map((urgency) => {
    const items = shown.filter((i) => i.urgency === urgency).sort((a, b) => a.event.start - b.event.start);
    if (urgency === 'done') items.reverse();
    return { urgency, items };
  }).filter((g) => g.items.length > 0);

  const open = all.filter((i) => i.urgency !== 'done' && isDeadlineType(i.event.type));
  const overdueCount = open.filter((i) => i.urgency === 'overdue').length;
  const taskCourses = courses.filter((c) => !c.hidden && all.some((i) => i.event.courseId === c.id));
  const filtered = filters.courses.length + filters.types.length > 0 || q !== '';
  const openEvent = openId ? events.find((e) => e.id === openId) ?? null : null;

  if (!events.some((e) => isDeadlineType(e.type)))
    return (
      <>
        <PageHeader title="משימות" />
        <EmptyState
          icon="✅"
          title="אין משימות"
          action={
            <Link to="/import" className="btn">
              <Icon name="upload" />
              ייבוא מ-Moodle
            </Link>
          }
        >
          לא נמצאו מטלות, בחנים או פורומים עם מועד הגשה. אם זה לא נראה נכון, נסו לייבא שוב.
        </EmptyState>
      </>
    );

  return (
    <div className="tasks">
      <PageHeader
        title="משימות"
        subtitle={
          <span className="num">
            {open.length} פתוחות{overdueCount > 0 && ` · ${overdueCount} באיחור`}
          </span>
        }
      />

      <div className="tasks__layout">
        <div className="tasks__main stack">
          <section className="tasks__filters card card--flat" aria-label="סינון משימות">
            <input
                type="search"
                className="input tasks__search"
                placeholder="חיפוש לפי שם או קורס"
                aria-label="חיפוש משימות"
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              />
            {taskCourses.length > 1 && (
              <div className="chip-row" role="group" aria-label="סינון לפי קורס">
                {taskCourses.map((c) => (
                  <Chip key={c.id} colorIndex={c.colorIndex} selected={filters.courses.includes(c.id)} onToggle={() => setFilters((f) => ({ ...f, courses: toggle(f.courses, c.id) }))}>
                    <CourseDot courseId={c.id} />
                    <bdi>{c.name}</bdi>
                  </Chip>
                ))}
              </div>
            )}
            <div className="chip-row" role="group" aria-label="סינון לפי סוג">
              {TYPE_FILTERS.map((t) => (
                <Chip key={t.value} selected={filters.types.includes(t.value)} onToggle={() => setFilters((f) => ({ ...f, types: toggle(f.types, t.value) }))}>
                  {t.label}
                </Chip>
              ))}
            </div>
            <div className="row tasks__filter-foot">
              <label className="switch small">
                <input type="checkbox" checked={filters.showQuizOpen} onChange={(e) => setFilters((f) => ({ ...f, showQuizOpen: e.target.checked }))} />
                הצג גם פתיחת בחנים
              </label>
              {filtered && (
                <button type="button" className="btn btn--ghost small" onClick={() => setFilters((f) => ({ ...NO_FILTERS, showQuizOpen: f.showQuizOpen }))}>
                  <Icon name="close" />
                  נקה סינון
                </button>
              )}
            </div>
          </section>

          {groups.length === 0 ? (
            <EmptyState icon="🔍" title="לא נמצאו משימות לסינון הזה" />
          ) : (
            groups.map(({ urgency, items }) => {
              const collapsible = urgency === 'done';
              const expanded = !collapsible || showDone || q !== '';
              const headId = `tasks-g-${urgency}`;
              return (
                <section key={urgency} className={`tasks__group tasks__group--${urgency}`} aria-labelledby={headId}>
                  <h2 id={headId} className="tasks__group-head">
                    {collapsible ? (
                      <button type="button" className="tasks__group-toggle" aria-expanded={expanded} onClick={() => setShowDone((v) => !v)}>
                        <span className="tasks__chevron" aria-hidden="true" />
                        {URGENCY_LABELS[urgency]}
                        <span className="tasks__count num">{items.length}</span>
                      </button>
                    ) : (
                      <>
                        {URGENCY_LABELS[urgency]}
                        <span className="tasks__count num">{items.length}</span>
                      </>
                    )}
                  </h2>
                  {expanded && (
                    <ul role="list" className="tasks__list">
                      {items.map((item) => (
                        <TaskRow
                          key={item.event.id}
                          item={item}
                          now={now}
                          onCycle={() => setStatus(item.event, NEXT_STATUS[item.state?.status ?? 'todo'])}
                          onOpen={() => setOpenId(item.event.id)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>

        <aside className="tasks__aside" aria-label="סיכום">
          <Card className="tasks__summary stack">
            <h2>סיכום</h2>
            <dl className="tasks__summary-urgency">
              {GROUPS.filter((u) => u !== 'done').map((u) => (
                <div key={u}>
                  <dt>{URGENCY_LABELS[u]}</dt>
                  <dd className="num">{open.filter((i) => i.urgency === u).length}</dd>
                </div>
              ))}
            </dl>
            {taskCourses.length > 0 && (
              <>
                <h3 className="muted small">פתוחות לפי קורס</h3>
                <ul role="list" className="tasks__summary-courses">
                  {taskCourses.map((c) => {
                    const left = open.filter((i) => i.event.courseId === c.id).length;
                    const total = all.filter((i) => i.event.courseId === c.id && isDeadlineType(i.event.type)).length;
                    const selected = filters.courses.includes(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${c.name}: ${left} פתוחות מתוך ${total}. סינון לפי הקורס`}
                          onClick={() => setFilters((f) => ({ ...f, courses: toggle(f.courses, c.id) }))}
                        >
                          <CourseDot courseId={c.id} />
                          <span className="tasks__summary-name" dir="auto">
                            {c.name}
                          </span>
                          <span className="num muted">
                            {left}/{total}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>
        </aside>
      </div>

      <EventDrawer event={openEvent} onClose={() => setOpenId(null)} />
      {toast}
    </div>
  );
}

function TaskRow({ item, now, onCycle, onOpen }: { item: Item; now: number; onCycle: () => void; onOpen: () => void }) {
  const { event: e, state, urgency, opensAt } = item;
  const done = urgency === 'done';
  const actionable = isDeadlineType(e.type);
  const hours = state?.estimateHours;
  return (
    <li className={`task-row${done ? ' task-row--done' : ''}`}>
      {actionable ? <StatusToggle status={state?.status ?? 'todo'} title={e.title} onCycle={onCycle} /> : <span className="task-row__spacer" aria-hidden="true" />}
      <button type="button" className="task-row__main" onClick={onOpen} aria-haspopup="dialog">
        <TypeIcon type={e.type} size={32} />
        <span className="task-row__body">
          <span className="task-row__title">
            {e.type === 'quiz_open' && <span className="task-row__tag">נפתח</span>}
            <bdi>{e.title}</bdi>
          </span>
          <span className="task-row__meta">
            <CourseBadge courseId={e.courseId} name={e.courseName} />
            {!done && opensAt !== undefined && opensAt < e.start && <WindowTag opensAt={opensAt} now={now} />}
            {hours !== undefined && (
              <span className="task-row__estimate num" aria-label={`הערכה: ${hours} שעות`}>
                <Icon name="clock" aria-hidden="true" />
                {hours} ש׳
              </span>
            )}
          </span>
        </span>
        <span className="task-row__when">
          {done ? (
            <UrgencyBadge urgency="done" />
          ) : (
            <UrgencyBadge urgency={urgency} tone={actionable ? deadlineTone(e.start, now) : 'neutral'} label={fmtRelative(e.start, now)} />
          )}
          <time className="task-row__abs" dateTime={new Date(e.start).toISOString()}>
            {fmtDeadline(e.start)}
          </time>
        </span>
      </button>
    </li>
  );
}

/** Open/close window of a quiz or lab, shown on its closing row so the pair reads as one window. */
function WindowTag({ opensAt, now }: { opensAt: number; now: number }) {
  const open = opensAt <= now;
  return (
    <span className={`task-row__window${open ? ' task-row__window--open' : ''}`}>
      <span className="task-row__window-dot" aria-hidden="true" />
      {open ? (
        <>
          <strong>פתוח עכשיו</strong>{' '}
          <span className="num">
            מ-{getLocalParts(opensAt).day}.{getLocalParts(opensAt).month}
          </span>
        </>
      ) : (
        <span className="num">
          נפתח {fmtDate(opensAt)} · {fmtTime(opensAt)}
        </span>
      )}
    </span>
  );
}
