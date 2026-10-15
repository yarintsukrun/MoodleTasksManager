import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { EventType, MoodleEvent, TaskState, TaskStatus, Urgency } from '@mtm/core';
import { Chip, CourseDot, EmptyState, EventDrawer, Icon, PageHeader, TYPE_LABELS, URGENCY_LABELS } from '../../components';
import { courseColorStyle, fmtDate, fmtRelative, fmtTime, getLocalParts, getUrgency, isDeadlineType, useCourses, useNow, useStore, useVisibleEvents, weekdayShort } from '../../data';
import { StatusToggle, NEXT_STATUS, dueDayInstant, useSessionState, useStatusWithUndo } from './shared';
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

/** Short type word for the meta line (the row already says it is a deadline). */
const ROW_TYPE: Partial<Record<EventType, string>> = {
  assignment: 'מטלה',
  quiz_close: 'בוחן',
  quiz_open: 'פתיחת בוחן',
  forum_due: 'פורום',
  activity_close: 'פעילות',
};

const GROUPS: Urgency[] = ['overdue', 'today', 'tomorrow', 'this_week', 'later', 'done'];
const OPEN_GROUPS = GROUPS.filter((u) => u !== 'done');

/** How long a just-ticked row stays in place (tick + strike settle) before it moves to "הוגש". */
const SETTLE_MS = 650;

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
const shortDate = (instant: number) => {
  const p = getLocalParts(instant);
  return `${weekdayShort(p.weekday)} ${p.day}.${p.month}`;
};
const rowId = (id: string) => `task-${id}`;

/** Tasks: a ruled to-do page. Deadlines grouped by urgency, tick-box status, filters and search, per-course tally in the margin. */
export default function TasksScreen() {
  const events = useVisibleEvents();
  const courses = useCourses();
  const { taskStates } = useStore();
  const now = useNow(30_000);
  const { setStatus, toast, focusUndo } = useStatusWithUndo();
  const [filters, setFilters] = useSessionState<Filters>('mtm.tasks.filters', NO_FILTERS);
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Rows just marked done keep their old group for a moment so the tick is seen before they move.
  const [settling, setSettling] = useState<Record<string, Urgency>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

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

  const cycle = useCallback(
    (item: Item) => {
      const next: TaskStatus = NEXT_STATUS[item.state?.status ?? 'todo'];
      const id = item.event.id;
      setStatus(item.event, next);
      if (next !== 'done' || item.urgency === 'done') return;
      setSettling((s) => ({ ...s, [id]: item.urgency }));
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          // The row is about to leave this group: if it holds focus, hand it to the undo button.
          if (document.getElementById(rowId(id))?.contains(document.activeElement)) focusUndo();
          setSettling(({ [id]: _gone, ...rest }) => rest);
        }, SETTLE_MS),
      );
    },
    [setStatus, focusUndo],
  );

  const q = filters.query.trim().toLowerCase();
  const shown = all.filter(
    ({ event: e }) =>
      (filters.courses.length === 0 || (e.courseId !== undefined && filters.courses.includes(e.courseId))) &&
      (filters.types.length === 0 || filters.types.includes(typeFilterOf(e.type))) &&
      (!q || `${e.title} ${e.courseName ?? ''}`.toLowerCase().includes(q)),
  );

  const groups = GROUPS.map((urgency) => {
    const items = shown
      .filter((i) => (i.urgency === 'done' ? settling[i.event.id] ?? 'done' : i.urgency) === urgency)
      .sort((a, b) => a.event.start - b.event.start);
    if (urgency === 'done') items.reverse();
    return { urgency, items };
  }).filter((g) => g.items.length > 0);

  const open = all.filter((i) => i.urgency !== 'done' && isDeadlineType(i.event.type));
  const overdueCount = open.filter((i) => i.urgency === 'overdue').length;
  const taskCourses = courses.filter((c) => !c.hidden && all.some((i) => i.event.courseId === c.id));
  const filtered = filters.courses.length + filters.types.length > 0 || q !== '';
  const openEvent = openId ? events.find((e) => e.id === openId) ?? null : null;
  const clearFilters = () => setFilters((f) => ({ ...NO_FILTERS, showQuizOpen: f.showQuizOpen }));
  const toggleCourse = (id: string) => setFilters((f) => ({ ...f, courses: toggle(f.courses, id) }));

  if (!events.some((e) => isDeadlineType(e.type)))
    return (
      <>
        <PageHeader title="משימות" />
        <EmptyState
          icon={<Icon name="tasks" />}
          title="אין משימות"
          action={
            <Link to="/import" className="btn">
              <Icon name="upload" />
              ייבוא מ-Moodle
            </Link>
          }
        >
          לא מצאנו מטלות, בחנים או פורומים עם מועד הגשה. אם זה נראה לא נכון, כדאי לייבא שוב.
        </EmptyState>
      </>
    );

  return (
    <div className="tasks">
      <PageHeader
        title="משימות"
        subtitle={
          <span className="tasks__tally num">
            {open.length === 0 ? 'הכל הוגש' : `${open.length} פתוחות`}
            {overdueCount > 0 && <span className="tasks__tally-late"> · {overdueCount} באיחור</span>}
          </span>
        }
      />

      <div className="tasks__layout">
        <div className="tasks__main">
          <section className="tasks__filters" aria-label="סינון משימות">
            <div className="tasks__filter-line">
              <label className="tasks__search">
                <svg className="tasks__search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="10.5" cy="10.5" r="6" />
                  <path d="M15 15l5 5" />
                </svg>
                <span className="visually-hidden">חיפוש משימות</span>
                <input
                  type="search"
                  className="tasks__search-input"
                  placeholder="חיפוש לפי שם או קורס"
                  value={filters.query}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                />
              </label>
              <div className="tasks__types" role="group" aria-label="סינון לפי סוג">
                <button type="button" className="tasks__type" aria-pressed={filters.types.length === 0} onClick={() => setFilters((f) => ({ ...f, types: [] }))}>
                  הכל
                </button>
                {TYPE_FILTERS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className="tasks__type"
                    aria-pressed={filters.types.includes(t.value)}
                    onClick={() => setFilters((f) => ({ ...f, types: toggle(f.types, t.value) }))}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {taskCourses.length > 1 && (
              <div className="chip-row tasks__courses" role="group" aria-label="סינון לפי קורס">
                {taskCourses.map((c) => (
                  <Chip key={c.id} colorIndex={c.colorIndex} selected={filters.courses.includes(c.id)} onToggle={() => toggleCourse(c.id)}>
                    <bdi>{c.name}</bdi>
                  </Chip>
                ))}
              </div>
            )}

            <div className="tasks__filter-foot">
              <label className="switch tasks__switch">
                <input type="checkbox" checked={filters.showQuizOpen} onChange={(e) => setFilters((f) => ({ ...f, showQuizOpen: e.target.checked }))} />
                להציג גם מתי בחנים נפתחים
              </label>
              {filtered && (
                <span className="tasks__filter-status">
                  <span className="num" role="status">
                    מוצגות {shown.length} מתוך {all.length}
                  </span>
                  <button type="button" className="tasks__text-btn" onClick={clearFilters}>
                    ניקוי סינון
                  </button>
                </span>
              )}
            </div>
          </section>

          {groups.length === 0 ? (
            <div className="tasks__none">
              <p>אין משימות שמתאימות לסינון הזה.</p>
              {filtered && (
                <button type="button" className="tasks__text-btn" onClick={clearFilters}>
                  ניקוי סינון
                </button>
              )}
            </div>
          ) : (
            groups.map(({ urgency, items }) => {
              const collapsible = urgency === 'done';
              const expanded = !collapsible || showDone || q !== '';
              const headId = `tasks-g-${urgency}`;
              const stub = urgency === 'today' ? now : urgency === 'tomorrow' ? now + 86_400_000 : undefined;
              const label = (
                <>
                  <span className="tasks__group-name">{URGENCY_LABELS[urgency]}</span>
                  <span className="tasks__count num" aria-label={`${items.length} משימות`}>
                    {items.length}
                  </span>
                </>
              );
              return (
                <section key={urgency} className={`tasks__group tasks__group--${urgency}`} aria-labelledby={headId}>
                  <h2 id={headId} className="tasks__group-head">
                    {collapsible ? (
                      <button type="button" className="tasks__group-toggle" aria-expanded={expanded} onClick={() => setShowDone((v) => !v)}>
                        <span className="tasks__chevron" aria-hidden="true" />
                        {label}
                        <span className="tasks__group-hint">{expanded ? 'הסתרה' : 'הצגה'}</span>
                      </button>
                    ) : (
                      label
                    )}
                    {stub !== undefined && <span className="tasks__group-date num">{fmtDate(stub)}</span>}
                  </h2>
                  {expanded && (
                    <ul role="list" className="tasks__list">
                      {items.map((item) => (
                        <TaskRow key={item.event.id} item={item} group={urgency} now={now} onCycle={() => cycle(item)} onOpen={() => setOpenId(item.event.id)} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>

        <aside className="tasks__margin" aria-label="סיכום בשוליים">
          <h2 className="tasks__margin-head">מה פתוח</h2>
          <dl className="tasks__leaders">
            {OPEN_GROUPS.map((u) => {
              const n = open.filter((i) => i.urgency === u).length;
              return (
                <div key={u} className={u === 'overdue' && n > 0 ? 'is-late' : n === 0 ? 'is-zero' : undefined}>
                  <dt>{URGENCY_LABELS[u]}</dt>
                  <dd className="num">{n}</dd>
                </div>
              );
            })}
          </dl>

          {taskCourses.length > 0 && (
            <>
              <h2 className="tasks__margin-head">לפי קורס</h2>
              <ul role="list" className="tasks__by-course">
                {taskCourses.map((c) => {
                  const left = open.filter((i) => i.event.courseId === c.id).length;
                  const total = all.filter((i) => i.event.courseId === c.id && isDeadlineType(i.event.type)).length;
                  const selected = filters.courses.includes(c.id);
                  return (
                    <li key={c.id} style={courseColorStyle(c.colorIndex)}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${c.name}: ${left} פתוחות מתוך ${total}. סינון לפי הקורס`}
                        onClick={() => toggleCourse(c.id)}
                      >
                        <span className="tasks__by-course-line">
                          <CourseDot courseId={c.id} size={8} />
                          <span className="tasks__by-course-name" dir="auto">
                            {c.name}
                          </span>
                          <span className="tasks__by-course-num num">
                            {left}
                            <span className="tasks__by-course-of">/{total}</span>
                          </span>
                        </span>
                        <span className="tasks__by-course-bar" aria-hidden="true">
                          <span style={{ inlineSize: `${total ? ((total - left) / total) * 100 : 0}%` } as CSSProperties} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="tasks__margin-note">הקו מראה כמה כבר הוגש. לחיצה על קורס מסננת את הרשימה.</p>
            </>
          )}
        </aside>
      </div>

      <EventDrawer event={openEvent} onClose={() => setOpenId(null)} />
      {toast}
    </div>
  );
}

function TaskRow({ item, group, now, onCycle, onOpen }: { item: Item; group: Urgency; now: number; onCycle: () => void; onOpen: () => void }) {
  const { event: e, state, urgency, opensAt } = item;
  const done = urgency === 'done';
  const actionable = isDeadlineType(e.type);
  const hours = state?.estimateHours;
  const due = dueDayInstant(e.start);
  // Today/tomorrow already say the day in the heading; elsewhere the date leads the time.
  const showDate = group !== 'today' && group !== 'tomorrow';
  const typeWord = ROW_TYPE[e.type] ?? TYPE_LABELS[e.type];
  return (
    <li id={rowId(e.id)} className={`task-row${done ? ' task-row--done' : ''}${done && group !== 'done' ? ' task-row--settling' : ''}`}>
      {actionable ? <StatusToggle status={state?.status ?? 'todo'} title={e.title} onCycle={onCycle} /> : <span className="task-row__spacer" aria-hidden="true" />}
      <button type="button" className="task-row__main" onClick={onOpen} aria-haspopup="dialog">
        <span className="task-row__body">
          <span className="task-row__title" dir="auto">
            {e.title}
          </span>
          <span className="task-row__meta">
            <span className="task-row__course">
              <CourseDot courseId={e.courseId} size={8} />
              <span className="task-row__course-name" dir="auto">
                {e.courseName ?? 'אישי'}
              </span>
            </span>
            <span className="task-row__type">{typeWord}</span>
            {hours !== undefined && <span className="task-row__estimate num">הערכה: {hours} ש׳</span>}
          </span>
          {!done && opensAt !== undefined && opensAt < e.start && <WindowLine opensAt={opensAt} closesAt={e.start} now={now} />}
        </span>
        <span className="task-row__due">
          <time className="task-row__when num" dateTime={new Date(e.start).toISOString()}>
            {showDate && <span className="task-row__date">{shortDate(due)}</span>}
            <span className="task-row__time">{fmtTime(due)}</span>
          </time>
          {!done && <span className={`task-row__rel${urgency === 'overdue' ? ' task-row__rel--late' : ''}`}>{fmtRelative(e.start, now)}</span>}
        </span>
      </button>
    </li>
  );
}

/** Quiet open/close window of a quiz or lab, on its closing row: "פתוח מ-11.10 · נסגר בעוד 3 ימים". */
function WindowLine({ opensAt, closesAt, now }: { opensAt: number; closesAt: number; now: number }) {
  const isOpen = opensAt <= now;
  const p = getLocalParts(opensAt);
  return (
    <span className={`task-row__window${isOpen ? ' task-row__window--open' : ''}`}>
      <span className="task-row__window-mark" aria-hidden="true" />
      <span className="num">
        {isOpen ? `פתוח מ-${p.day}.${p.month} · נסגר ${fmtRelative(closesAt, now)}` : `ייפתח ביום ${shortDate(opensAt)} · ${fmtTime(opensAt)}`}
      </span>
    </span>
  );
}
