// Semester — "year at a glance" spread of the planner.
// A quiet load chart (one column per week, one mark per deadline, coloured like highlighter ticks),
// margin notes on the busy weeks, the chosen week as a ruled list, and per-course progress.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { isDeadline, weeklyLoad, type MoodleEvent, type TaskState, type WeekLoad } from '@mtm/core';
import { EmptyState, EventDrawer, PageHeader, TYPE_LABELS } from '../../components';
import { courseColorStyle, useCourses, useNow, useStore, useVisibleEvents } from '../../data';
import { dayLabel, dayLongLabel, dayNum, effectiveDue, hm, keyToDay, minuteOf, rangeLabel, sundayOf } from '../timetable/dates';
import './semester.css';

interface Mark {
  id: string;
  quiz: boolean;
  done: boolean;
  color: CSSProperties;
  course: string;
}

interface Week extends WeekLoad {
  n: number;
  sunday: number;
  label: string;
  quizzes: number;
  done: number;
  busy: boolean;
  /** Most deadlines falling on one day, and that day. */
  peak: { day: number; count: number };
  marks: Mark[];
}

interface CourseRow {
  key: string;
  name: string;
  color: CSSProperties;
  total: number;
  done: number;
  overdue: number;
  next?: MoodleEvent;
}

const PERSONAL = 'אישי';
const isDone = (states: Record<string, TaskState>, id: string) => states[id]?.status === 'done';
const dueDay = (e: MoodleEvent) => dayNum(effectiveDue(e.start));

/** "5 הגשות ו-2 בחנים" — natural Hebrew counts. */
function countPhrase(subs: number, quizzes: number) {
  const parts: string[] = [];
  if (subs) parts.push(subs === 1 ? 'הגשה אחת' : `${subs} הגשות`);
  if (quizzes) parts.push(quizzes === 1 ? 'בוחן אחד' : `${quizzes} בחנים`);
  if (parts.length < 2) return parts[0] ?? 'אין הגשות';
  // Hebrew "and" attaches to the word; a hyphen only before a numeral ("ו-2 בחנים", "ובוחן אחד").
  return `${parts[0]} ו${/^\d/.test(parts[1]!) ? '-' : ''}${parts[1]}`;
}

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
/** Month name to print under a week column: the month that begins inside it (or the first column's month). */
function monthOf(sunday: number, first: boolean): string | undefined {
  for (let d = sunday; d < sunday + 7; d++) {
    const date = new Date(d * 86_400_000);
    if (date.getUTCDate() === 1) return MONTHS[date.getUTCMonth()];
  }
  return first ? MONTHS[new Date(sunday * 86_400_000).getUTCMonth()] : undefined;
}

const HE_COUNT = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה'];

export default function SemesterScreen() {
  const events = useVisibleEvents();
  const { taskStates } = useStore();
  const courses = useCourses();
  const now = useNow();
  const thisSunday = sundayOf(dayNum(now));
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  const colorOf = useMemo(() => {
    const m = new Map(courses.map((c) => [c.id, c.colorIndex]));
    return (courseId?: string) => courseColorStyle(courseId ? m.get(courseId) : undefined);
  }, [courses]);
  // Stable stacking order: courses alphabetically (as in settings), personal last.
  const courseOrder = useMemo(() => new Map(courses.map((c, i) => [c.id, i])), [courses]);

  const weeks = useMemo<Week[]>(() => {
    // The semester spans the deadlines (not recurring classes that run on into the summer),
    // stretched back to today when today falls before the first one.
    const times = events.filter((e) => isDeadline(e.type)).map((e) => e.start);
    if (times.length === 0) return [];
    const last = Math.max(...times);
    const today = thisSunday * 86_400_000;
    const first = today <= last ? Math.min(today, ...times) : Math.min(...times);
    let loads: WeekLoad[] = [];
    try {
      loads = weeklyLoad(events, first, last);
    } catch (err) {
      console.warn('[core] weeklyLoad failed', err);
    }
    const counts = loads.map((w) => w.deadlines);
    const mean = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
    const sd = Math.sqrt(counts.reduce((a, b) => a + (b - mean) ** 2, 0) / (counts.length || 1));
    return loads.map((w, i) => {
      const sunday = keyToDay(w.weekStart);
      const list = w.eventIds.map((id) => byId.get(id)).filter((e): e is MoodleEvent => !!e);
      list.sort(
        (a, b) =>
          (courseOrder.get(a.courseId ?? '') ?? 999) - (courseOrder.get(b.courseId ?? '') ?? 999) ||
          Number(a.type === 'quiz_close') - Number(b.type === 'quiz_close') ||
          a.start - b.start,
      );
      const perDay = new Map<number, number>();
      for (const e of list) perDay.set(dueDay(e), (perDay.get(dueDay(e)) ?? 0) + 1);
      let peak = { day: sunday, count: 0 };
      for (const [day, count] of perDay) if (count > peak.count) peak = { day, count };
      return {
        ...w,
        n: i + 1,
        sunday,
        label: rangeLabel(sunday, sunday + 6),
        quizzes: list.filter((e) => e.type === 'quiz_close').length,
        done: list.filter((e) => isDone(taskStates, e.id)).length,
        busy: w.deadlines >= 4 || (w.deadlines >= 2 && w.deadlines >= mean + sd),
        peak,
        marks: list.map((e) => ({
          id: e.id,
          quiz: e.type === 'quiz_close',
          done: isDone(taskStates, e.id),
          color: colorOf(e.courseId),
          course: e.courseName ?? PERSONAL,
        })),
      };
    });
  }, [events, byId, taskStates, colorOf, courseOrder, thisSunday]);

  const courseRows = useMemo<CourseRow[]>(() => {
    const rows = new Map<string, CourseRow>();
    for (const e of events) {
      if (!isDeadline(e.type)) continue;
      const key = e.courseId ?? PERSONAL;
      const row = rows.get(key) ?? { key, name: e.courseName ?? PERSONAL, color: colorOf(e.courseId), total: 0, done: 0, overdue: 0 };
      row.total++;
      const done = isDone(taskStates, e.id);
      if (done) row.done++;
      else if (e.start < now) row.overdue++;
      else if (!row.next || e.start < row.next.start) row.next = e;
      rows.set(key, row);
    }
    return [...rows.values()].sort(
      (a, b) => (courseOrder.get(a.key) ?? 999) - (courseOrder.get(b.key) ?? 999) || a.name.localeCompare(b.name, 'he'),
    );
  }, [events, taskStates, now, colorOf, courseOrder]);

  const hasCurrent = weeks.some((w) => w.sunday === thisSunday);
  const fallbackSunday = hasCurrent ? thisSunday : (weeks.find((w) => w.sunday > thisSunday) ?? weeks[weeks.length - 1])?.sunday;
  const selSunday = selected ?? fallbackSunday;
  const selIndex = weeks.findIndex((w) => w.sunday === selSunday);
  const sel = weeks[selIndex];
  const notes = weeks.filter((w) => w.busy && w.sunday >= thisSunday).slice(0, 4);
  const noteNo = new Map(notes.map((w, i) => [w.sunday, i + 1]));
  const maxCount = Math.max(5, ...weeks.map((w) => w.deadlines));

  // Bring the current week into view inside the chart's own scroller (never scrolls the page).
  useEffect(() => {
    const plot = plotRef.current;
    const cur = plot?.querySelector<HTMLElement>('.is-current');
    if (!plot || !cur || plot.scrollWidth <= plot.clientWidth) return;
    const p = plot.getBoundingClientRect();
    const c = cur.getBoundingClientRect();
    plot.scrollLeft += c.left + c.width / 2 - (p.left + p.width / 2);
  }, [weeks.length]);

  if (weeks.length === 0)
    return (
      <>
        <PageHeader title="סמסטר" />
        <EmptyState icon={null} title="אין עדיין נתונים">
          אחרי ייבוא היומן מ-Moodle יופיע כאן עומס ההגשות לאורך הסמסטר, שבוע אחרי שבוע.
        </EmptyState>
      </>
    );

  const totals = weeks.reduce((a, w) => ({ all: a.all + w.deadlines, done: a.done + w.done }), { all: 0, done: 0 });

  const note = (w: Week) => {
    const head = countPhrase(w.deadlines - w.quizzes, w.quizzes);
    const peak = w.peak.count >= 3 ? ` ${HE_COUNT[w.peak.count] ?? w.peak.count} מהן ב${dayLongLabel(w.peak.day)}.` : '';
    const tail =
      w.sunday === thisSunday
        ? w.done
          ? ` כבר הגשת ${w.done}, נשארו ${w.deadlines - w.done}.`
          : ' זה השבוע — כדאי לפנות זמן כבר היום.'
        : w.sunday === thisSunday + 7
          ? ' זה בשבוע הבא — כדאי להתחיל כבר עכשיו.'
          : ' כדאי להתחיל מוקדם.';
    return `${head}.${peak}${tail}`;
  };

  const ariaWeek = (w: Week) =>
    [
      `שבוע ${w.n}, ${w.label}`,
      w.deadlines ? countPhrase(w.deadlines - w.quizzes, w.quizzes) : 'אין הגשות',
      w.done ? `${w.done} הוגשו` : '',
      w.busy ? 'שבוע עמוס' : '',
      w.sunday === thisSunday ? 'השבוע' : '',
    ]
      .filter(Boolean)
      .join(', ');

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // RTL: ArrowLeft moves forward in time.
    const step = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
    const target = step !== undefined ? selIndex + step : e.key === 'Home' ? 0 : e.key === 'End' ? weeks.length - 1 : -1;
    if (target < 0 || target >= weeks.length) return;
    e.preventDefault();
    setSelected(weeks[target]!.sunday);
    plotRef.current?.querySelectorAll<HTMLButtonElement>('.sem-col')[target]?.focus();
  };

  const grouped = new Map<string, MoodleEvent[]>();
  if (sel)
    for (const m of sel.marks) {
      const e = byId.get(m.id);
      if (e) grouped.set(m.course, [...(grouped.get(m.course) ?? []), e]);
    }

  const legendCourses = courseRows.map((r) => ({ key: r.key, name: r.name, color: r.color }));

  return (
    <div className="sem">
      <PageHeader
        title="סמסטר"
        subtitle={
          <span className="num">
            {weeks.length} שבועות · {totals.all} הגשות ובחנים · {totals.done} כבר הוגשו
          </span>
        }
      />

      <section className="sem-chart" aria-labelledby="sem-chart-h">
        <div className="sem-section-head">
          <h2 id="sem-chart-h">עומס לפי שבוע</h2>
          <p className="sem-hint">כל סימון הוא הגשה אחת. בחרו שבוע כדי לראות מה יש בו.</p>
        </div>

        <div
          className="sem-plot"
          ref={plotRef}
          role="group"
          aria-labelledby="sem-chart-h"
          aria-describedby="sem-legend"
          onKeyDown={onKey}
          style={{ '--max': maxCount } as CSSProperties}
        >
          {weeks.map((w) => {
            const current = w.sunday === thisSunday;
            const past = w.sunday < thisSunday;
            const no = noteNo.get(w.sunday);
            return (
              <button
                key={w.weekStart}
                type="button"
                className={`sem-col${current ? ' is-current' : ''}${past ? ' is-past' : ''}${w.busy ? ' is-busy' : ''}`}
                aria-pressed={w.sunday === selSunday}
                aria-label={ariaWeek(w)}
                onClick={() => setSelected(w.sunday)}
              >
                <span className="sem-col__bar" aria-hidden="true">
                  {current && <span className="sem-ribbon" />}
                  {w.marks.map((m) => (
                    <span key={m.id} className={`sem-mark${m.quiz ? ' sem-mark--quiz' : ''}${m.done ? ' is-done' : ''}`} style={m.color} />
                  ))}
                  {w.deadlines > 0 && (
                    <span className="sem-col__count num">
                      {w.deadlines}
                      {no && <sup className="sem-fn">{no}</sup>}
                    </span>
                  )}
                </span>
                <span className="sem-col__n num" aria-hidden="true">
                  {w.n}
                </span>
                <span className="sem-col__date num" aria-hidden="true">
                  <span className="sem-col__range sem-range">{w.label}</span>
                  <span className="sem-col__start">{dayLabel(w.sunday)}</span>
                </span>
                <span className="sem-col__month" aria-hidden="true">
                  {monthOf(w.sunday, w.n === 1)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="sem-legend" id="sem-legend">
          <ul className="sem-legend__courses">
            {legendCourses.map((c) => (
              <li key={c.key} style={c.color}>
                <span className="sem-mark" aria-hidden="true" />
                <bdi>{c.name}</bdi>
              </li>
            ))}
          </ul>
          <ul className="sem-legend__keys">
            <li>
              <span className="sem-mark" aria-hidden="true" /> הגשה
            </li>
            <li>
              <span className="sem-mark sem-mark--quiz" aria-hidden="true" /> בוחן
            </li>
            <li>
              <span className="sem-mark is-done" aria-hidden="true" /> כבר הוגש
            </li>
            <li>
              <span className="sem-ribbon sem-ribbon--key" aria-hidden="true" /> השבוע
            </li>
          </ul>
        </div>
      </section>

      <div className="sem-spread">
        {sel && (
          <section className="sem-week" aria-labelledby="sem-week-h" aria-live="polite">
            <header className="sem-week__head">
              <span className="sem-week__stub" aria-hidden="true">
                <span className="sem-label">שבוע</span>
                <span className="sem-week__no num">{sel.n}</span>
              </span>
              <div className="sem-week__titles">
                <h2 id="sem-week-h">
                  <span className="visually-hidden">שבוע {sel.n}, </span>
                  <span className="sem-range num">{sel.label}</span>
                </h2>
                <p className="sem-week__sum num">
                  {sel.deadlines ? countPhrase(sel.deadlines - sel.quizzes, sel.quizzes) : 'שבוע שקט, אין הגשות'}
                  {sel.done > 0 && ` · ${sel.done === sel.deadlines ? 'הכול הוגש' : `${sel.done} כבר הוגשו`}`}
                  {sel.sunday === thisSunday && <span className="sem-now"> · השבוע</span>}
                </p>
              </div>
              <div className="sem-week__nav">
                <button type="button" className="sem-step" disabled={selIndex <= 0} onClick={() => setSelected(weeks[selIndex - 1]!.sunday)}>
                  שבוע קודם
                </button>
                <button
                  type="button"
                  className="sem-step"
                  disabled={selIndex >= weeks.length - 1}
                  onClick={() => setSelected(weeks[selIndex + 1]!.sunday)}
                >
                  שבוע הבא
                </button>
              </div>
            </header>

            {grouped.size === 0 ? (
              <p className="sem-quiet">אין כאן הגשות. זה שבוע טוב להתקדם במשהו שמחכה בהמשך.</p>
            ) : (
              [...grouped].map(([course, list]) => (
                <div key={course} className="sem-group" style={colorOf(list[0]?.courseId)}>
                  <h3 className="sem-group__name">
                    <bdi>{course}</bdi>
                  </h3>
                  <ul className="sem-list">
                    {list
                      .slice()
                      .sort((a, b) => a.start - b.start)
                      .map((e) => {
                        const done = isDone(taskStates, e.id);
                        const due = effectiveDue(e.start);
                        const late = !done && e.start < now;
                        return (
                          <li key={e.id}>
                            <button type="button" className={`sem-row${done ? ' is-done' : ''}`} onClick={() => setOpenId(e.id)}>
                              <span className="sem-row__when num">
                                {dayLongLabel(dayNum(due))}
                                <span className="sem-row__time">{hm(minuteOf(due))}</span>
                              </span>
                              <span className="sem-row__title" dir="auto">
                                {e.title}
                              </span>
                              <span className="sem-row__meta">
                                {TYPE_LABELS[e.type]}
                                {done && <span className="sem-row__done"> · הוגש</span>}
                                {late && <span className="sem-row__late"> · עבר המועד</span>}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))
            )}
          </section>
        )}

        <aside className="sem-margin" aria-labelledby="sem-margin-h">
          <h2 id="sem-margin-h" className="sem-label">
            שבועות עמוסים בהמשך
          </h2>
          {notes.length === 0 ? (
            <p className="sem-quiet">עד סוף הסמסטר אין שבוע שבולט בעומס. העומס מתפזר יפה.</p>
          ) : (
            <ol className="sem-notes">
              {notes.map((w, i) => (
                <li key={w.weekStart}>
                  <button type="button" className="sem-note" aria-pressed={w.sunday === selSunday} onClick={() => setSelected(w.sunday)}>
                    <span className="sem-note__no num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="sem-note__body">
                      <strong className="num">
                        שבוע {w.n} · <span className="sem-range">{w.label}</span>
                      </strong>
                      <span>{note(w)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      <section className="sem-progress" aria-labelledby="sem-progress-h">
        <div className="sem-section-head">
          <h2 id="sem-progress-h">התקדמות לפי קורס</h2>
          <p className="sem-hint">מסומן כ"הוגש" רק מה שסימנת בעצמך.</p>
        </div>
        <ul className="sem-courses">
          {courseRows.map((r) => {
            const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <li key={r.key} className="sem-course" style={r.color}>
                <span className="sem-course__name">
                  <bdi>{r.name}</bdi>
                </span>
                <span className="sem-course__count num">
                  <b>{r.done}</b> מתוך {r.total} הוגשו
                  {r.overdue > 0 && <span className="sem-course__late"> · {r.overdue} עבר המועד</span>}
                </span>
                <span
                  className="sem-course__rule"
                  role="progressbar"
                  aria-label={`התקדמות ב${r.name}`}
                  aria-valuemin={0}
                  aria-valuemax={r.total}
                  aria-valuenow={r.done}
                  aria-valuetext={`${r.done} מתוך ${r.total}`}
                >
                  <span style={{ inlineSize: `${pct}%` }} />
                </span>
                <span className="sem-course__next">
                  {r.next ? (
                    <button type="button" className="sem-link" onClick={() => setOpenId(r.next!.id)}>
                      <span className="sem-label">הבא</span>
                      <span dir="auto" className="sem-course__next-title">
                        {r.next.title}
                      </span>
                      <span className="num muted"> · {dayLongLabel(dueDay(r.next))}</span>
                    </button>
                  ) : (
                    <span className="muted">{r.done === r.total ? 'הכול הוגש' : 'אין הגשות קרובות'}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <EventDrawer event={openId ? (byId.get(openId) ?? null) : null} onClose={() => setOpenId(null)} />
    </div>
  );
}
