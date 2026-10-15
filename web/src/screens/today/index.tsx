import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MoodleEvent } from '@mtm/core';
import { Card, CourseBadge, EmptyState, EventDrawer, Icon, PageHeader, TypeIcon, UrgencyBadge } from '../../components';
import {
  courseColorStyle,
  deadlineTone,
  fmtDeadline,
  fmtRelative,
  fmtTime,
  fmtTimeRange,
  getLocalParts,
  getUrgency,
  isDeadlineType,
  useCourseColorIndex,
  useNow,
  useStore,
  useVisibleEvents,
  weekdayShort,
} from '../../data';
import { dueDayInstant, dueDayKey, dueDayLabel, useStatusWithUndo } from '../tasks/shared';
import { ChangesCard } from './ChangesCard';
import './today.css';

const DAY = 86_400_000;

/** Days since epoch of the local calendar date. */
const dayNumber = (t: number) => {
  const p = getLocalParts(t);
  return Math.round(Date.UTC(p.year, p.month - 1, p.day) / DAY);
};
const weekStartDay = (t: number) => dayNumber(t) - getLocalParts(t).weekday;

/** Today: what's next (hero), today's classes, this week's deadlines, open quizzes and recent changes. */
export default function TodayScreen() {
  const events = useVisibleEvents();
  const { taskStates } = useStore();
  const now = useNow(30_000);
  const { setStatus, toast } = useStatusWithUndo();
  const [openId, setOpenId] = useState<string | null>(null);
  const openEvent = openId ? events.find((e) => e.id === openId) ?? null : null;

  const data = useMemo(() => {
    const todayKey = getLocalParts(now).dateKey;
    const isDone = (e: MoodleEvent) => taskStates[e.id]?.status === 'done';
    const pending = events.filter((e) => isDeadlineType(e.type) && !isDone(e)).sort((a, b) => a.start - b.start);
    const overdue = pending.filter((e) => e.start < now);
    const upcoming = pending.filter((e) => e.start >= now);
    const week = upcoming.filter((e) => e.start < now + 7 * DAY);

    const classes = events
      .filter((e) => (e.type === 'class_session' || e.type === 'online_meeting') && getLocalParts(e.start).dateKey === todayKey)
      .sort((a, b) => a.start - b.start);

    const firstClass = events.reduce<number | undefined>((min, e) => (e.type === 'class_session' && (min === undefined || e.start < min) ? e.start : min), undefined);
    const weekNo = firstClass === undefined ? undefined : (weekStartDay(now) - weekStartDay(firstClass)) / 7 + 1;

    const closes = events.filter((e) => e.type === 'quiz_close' && e.start > now && !isDone(e));
    const openQuizzes = events
      .filter((e) => e.type === 'quiz_open' && e.start <= now)
      .flatMap((o) => {
        const close = closes.find((c) => c.courseId === o.courseId && c.title.trim() === o.title.trim());
        return close ? [close] : [];
      })
      .sort((a, b) => a.start - b.start);

    const weekGroups = new Map<string, MoodleEvent[]>();
    for (const e of week) weekGroups.set(dueDayKey(e.start), [...(weekGroups.get(dueDayKey(e.start)) ?? []), e]);

    return { overdue, next: upcoming[0], week, weekGroups: [...weekGroups.values()], classes, weekNo, openQuizzes };
  }, [events, taskStates, now]);

  const { overdue, next, week, weekGroups, classes, weekNo, openQuizzes } = data;
  const today = getLocalParts(now);
  const title = `יום ${weekdayShort(today.weekday)}, ${today.day}.${today.month}`;

  if (events.length === 0)
    return (
      <>
        <PageHeader title={title} />
        <EmptyState
          icon="📥"
          title="עוד אין נתונים"
          action={
            <Link to="/import" className="btn btn--primary">
              <Icon name="upload" />
              ייבוא מ-Moodle
            </Link>
          }
        >
          ייבאו את קובץ היומן מ-Moodle כדי לראות כאן מה הדבר הבא.
        </EmptyState>
      </>
    );

  const load = week.length <= 2 ? 'נמוך' : week.length <= 4 ? 'בינוני' : 'גבוה';

  return (
    <div className="today">
      <PageHeader title={title} subtitle={weekNo !== undefined && weekNo >= 1 ? <span className="num">שבוע {weekNo} בסמסטר</span> : undefined} />

      <div className="today__alerts">
        {overdue.length > 0 && (
          <Link to="/tasks" className="today-strip today-strip--danger">
            <Icon name="alert" aria-hidden="true" />
            <span className="today-strip__text num">
              <strong>{overdue.length} באיחור</strong>
              {overdue.length === 1 && ` · ${overdue[0]!.title}`}
            </span>
            <span className="today-strip__go">למשימות</span>
          </Link>
        )}
        {openQuizzes.map((q) => (
          <button key={q.id} type="button" className="today-strip today-strip--quiz" onClick={() => setOpenId(q.id)} aria-haspopup="dialog">
            <TypeIcon type="quiz_close" size={28} plain />
            <span className="today-strip__text">
              <strong>בוחן פתוח עכשיו</strong> · {q.title} · נסגר {fmtRelative(q.start, now)}
            </span>
            <CourseBadge courseId={q.courseId} name={q.courseName} />
          </button>
        ))}
      </div>

      <div className="today__grid">
        <div className="today__col stack">
          <section aria-labelledby="today-next-h">
            <h2 id="today-next-h" className="today__h">
              <Icon name="clock" aria-hidden="true" />
              הדבר הבא
            </h2>
            {next ? (
              <Hero event={next} now={now} onDone={() => setStatus(next, 'done')} onOpen={() => setOpenId(next.id)} />
            ) : (
              <Card className="today-hero today-hero--calm">
                <p className="today-hero__empty">אין הגשות קרובות 🎉</p>
              </Card>
            )}
          </section>

          <section aria-labelledby="today-classes-h">
            <h2 id="today-classes-h" className="today__h">
              <Icon name="class" aria-hidden="true" />
              היום
            </h2>
            {classes.length === 0 ? (
              <Card flat className="today__empty">
                אין שיעורים היום 🎉
              </Card>
            ) : (
              <ol role="list" className="today-timeline">
                {classes.map((e) => (
                  <ClassRow key={e.id} event={e} now={now} onOpen={() => setOpenId(e.id)} />
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="today__col stack">
          <section aria-labelledby="today-week-h">
            <div className="today__h-row">
              <h2 id="today-week-h" className="today__h">
                <Icon name="timetable" aria-hidden="true" />
                השבוע
              </h2>
              <span className="today-load num" aria-label={`${week.length} הגשות ב-7 הימים הקרובים, עומס ${load}`}>
                <span aria-hidden="true">{week.length} הגשות</span>
                <span className="today-load__bar" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} className={i < week.length ? 'is-on' : undefined} />
                  ))}
                </span>
                <span aria-hidden="true">עומס {load}</span>
              </span>
            </div>
            {week.length === 0 ? (
              <Card flat className="today__empty">
                אין הגשות ב-7 הימים הקרובים
              </Card>
            ) : (
              <Card flat className="today-week">
                {weekGroups.map((items) => (
                  <div key={items[0]!.id} className="today-week__day">
                    <h3 className="today-week__label">{dueDayLabel(items[0]!.start, now)}</h3>
                    <ul role="list">
                      {items.map((e) => (
                        <li key={e.id}>
                          <button type="button" className="today-week__row" onClick={() => setOpenId(e.id)} aria-haspopup="dialog">
                            <TypeIcon type={e.type} size={28} />
                            <span className="today-week__title">{e.title}</span>
                            <CourseBadge courseId={e.courseId} name={e.courseName} />
                            <time className="today-week__time num" dateTime={new Date(e.start).toISOString()}>
                              {fmtTime(dueDayInstant(e.start))}
                            </time>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Card>
            )}
            <Link to="/tasks" className="today__more">
              לכל המשימות
              <span aria-hidden="true">←</span>
            </Link>
          </section>

          <ChangesCard onOpen={setOpenId} />
        </div>
      </div>

      <EventDrawer event={openEvent} onClose={() => setOpenId(null)} />
      {toast}
    </div>
  );
}

function Hero({ event: e, now, onDone, onOpen }: { event: MoodleEvent; now: number; onDone: () => void; onOpen: () => void }) {
  const tone = deadlineTone(e.start, now);
  return (
    <Card className={`today-hero today-hero--${tone}`}>
      <div className="today-hero__top">
        <TypeIcon type={e.type} size={40} />
        <div className="today-hero__titles">
          <p className="today-hero__title">{e.title}</p>
          <CourseBadge courseId={e.courseId} name={e.courseName} />
        </div>
        <UrgencyBadge urgency={getUrgency(e, undefined, now)} tone={tone} />
      </div>
      <p className="today-hero__rel">{fmtRelative(e.start, now)}</p>
      <time className="today-hero__abs num" dateTime={new Date(e.start).toISOString()}>
        {fmtDeadline(e.start)}
      </time>
      <div className="today-hero__actions">
        <button type="button" className="btn btn--primary" onClick={onDone}>
          <Icon name="check" aria-hidden="true" />
          סמן כהוגש
        </button>
        <button type="button" className="btn" onClick={onOpen} aria-haspopup="dialog">
          פרטים
        </button>
      </div>
    </Card>
  );
}

function ClassRow({ event: e, now, onOpen }: { event: MoodleEvent; now: number; onOpen: () => void }) {
  const idx = useCourseColorIndex(e.courseId);
  const state = now >= e.end ? 'past' : now >= e.start ? 'now' : 'future';
  const range = fmtTimeRange(e.start, e.end);
  return (
    <li className={`today-class today-class--${state}`} style={courseColorStyle(idx)} aria-current={state === 'now' ? 'time' : undefined}>
      <button type="button" className="today-class__btn" onClick={onOpen} aria-haspopup="dialog">
        <time className="today-class__time num" dateTime={new Date(e.start).toISOString()}>
          {range}
        </time>
        <span className="today-class__bar" aria-hidden="true" />
        <span className="today-class__body">
          <span className="today-class__title">
            <TypeIcon type={e.type} size={20} plain />
            {e.courseName ?? e.title}
          </span>
          {(e.location || e.courseName) && <span className="today-class__sub">{e.location && !/^https?:/.test(e.location) ? e.location : e.title}</span>}
        </span>
        {state === 'now' && <span className="today-class__now">עכשיו</span>}
        {state === 'past' && <span className="visually-hidden">(הסתיים)</span>}
      </button>
    </li>
  );
}
