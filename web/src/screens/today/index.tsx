import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MoodleEvent } from '@mtm/core';
import { EmptyState, EventDrawer, Icon, TypeIcon, URGENCY_LABELS } from '../../components';
import {
  courseColorStyle,
  deadlineTone,
  fmtDeadline,
  fmtRelative,
  fmtTime,
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
const WEEKDAYS_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

/** Days since epoch of the local calendar date. */
const dayNumber = (t: number) => {
  const p = getLocalParts(t);
  return Math.round(Date.UTC(p.year, p.month - 1, p.day) / DAY);
};
const weekStartDay = (t: number) => dayNumber(t) - getLocalParts(t).weekday;
const iso = (t: number) => new Date(t).toISOString();

/** Today, laid out as the day page of a planner: date stub, the next deadline, today's classes, the week, margin notes. */
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
  const stub = <DateStub now={now} weekNo={weekNo !== undefined && weekNo >= 1 ? weekNo : undefined} />;

  if (events.length === 0)
    return (
      <div className="today today--empty">
        {stub}
        <EmptyState
          icon={<Icon name="upload" />}
          title="עוד אין נתונים"
          action={
            <Link to="/import" className="btn btn--primary">
              <Icon name="upload" aria-hidden="true" />
              ייבוא מ-Moodle
            </Link>
          }
        >
          ייבאו את קובץ היומן מ-Moodle, וכאן יופיע מה מחכה לכם.
        </EmptyState>
      </div>
    );

  const load = week.length <= 2 ? 'נמוך' : week.length <= 4 ? 'בינוני' : 'גבוה';
  const deadlinesLabel = week.length === 0 ? 'אין הגשות' : week.length === 1 ? 'הגשה אחת' : `${week.length} הגשות`;
  const nowRow = classes.findIndex((e) => now >= e.start && now < e.end);
  const nextRow = classes.findIndex((e) => e.start > now);
  const nowLineAt = nowRow >= 0 || classes.length === 0 ? -1 : nextRow === -1 ? classes.length : nextRow;

  return (
    <div className="today">
      {stub}

      <div className="today__main">
        {overdue.length > 0 && (
          <Link to="/tasks" className="today-overdue">
            <span className="today-overdue__mark" aria-hidden="true" />
            <span className="today-overdue__text">
              <strong className="num">{overdue.length === 1 ? 'משימה אחת באיחור' : `${overdue.length} משימות באיחור`}</strong>
              {overdue.length === 1 && (
                <span className="today-overdue__title">
                  {' · '}
                  <bdi>{overdue[0]!.title}</bdi>
                </span>
              )}
            </span>
            <span className="today-overdue__go">
              למשימות <span aria-hidden="true">←</span>
            </span>
          </Link>
        )}

        <section aria-labelledby="today-next-h" className="today-sec today-sec--next">
          <h2 id="today-next-h" className="today-h today-h--quiet">
            מה הבא
          </h2>
          {next ? (
            <Hero event={next} now={now} onDone={() => setStatus(next, 'done')} onOpen={() => setOpenId(next.id)} />
          ) : (
            <div className="today-hero today-hero--calm">
              <p className="today-hero__calm">אין הגשות קרובות.</p>
              <p className="today-hero__calm-sub">כשיופיע משהו חדש ב-Moodle, הוא יחכה כאן.</p>
            </div>
          )}

          {openQuizzes.length > 0 && (
            <ul role="list" className="today-open" aria-label="בחנים פתוחים עכשיו">
              {openQuizzes.map((q) => (
                <OpenLine key={q.id} event={q} now={now} onOpen={() => setOpenId(q.id)} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="today-classes-h" className="today-sec">
          <div className="today-h-row">
            <h2 id="today-classes-h" className="today-h">
              היום
            </h2>
            <span className="today-h-aside num">{classes.length === 0 ? '' : classes.length === 1 ? 'שיעור אחד' : `${classes.length} שיעורים`}</span>
          </div>
          {classes.length === 0 ? (
            <p className="today-none">אין שיעורים היום.</p>
          ) : (
            <ol role="list" className="today-tt">
              {classes.map((e, i) => (
                <ClassFragment key={e.id} showNowLine={i === nowLineAt} now={now}>
                  <ClassRow event={e} now={now} onOpen={() => setOpenId(e.id)} />
                </ClassFragment>
              ))}
              {nowLineAt === classes.length && <NowLine now={now} />}
            </ol>
          )}
        </section>
      </div>

      <aside className="today__margin" aria-label="השבוע ושינויים">
        <section aria-labelledby="today-week-h" className="today-sec">
          <div className="today-h-row">
            <h2 id="today-week-h" className="today-h">
              השבוע
            </h2>
            <span className="today-load num">
              <span className="visually-hidden">{`${deadlinesLabel} ב-7 הימים הקרובים, עומס ${load}`}</span>
              <span aria-hidden="true">{deadlinesLabel}</span>
              {week.length > 0 && (
                <>
                  <span className="today-load__tally" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, i) => (
                      <span key={i} className={i < week.length ? 'is-on' : undefined} />
                    ))}
                  </span>
                  <span aria-hidden="true">עומס {load}</span>
                </>
              )}
            </span>
          </div>
          {week.length === 0 ? (
            <p className="today-none">שבוע פנוי מהגשות. אפשר לנשום.</p>
          ) : (
            <div className="today-week">
              {weekGroups.map((items) => (
                <WeekDay key={items[0]!.id} items={items} now={now} todayKey={today.dateKey} onOpen={setOpenId} />
              ))}
            </div>
          )}
          <Link to="/tasks" className="today-more">
            לכל המשימות <span aria-hidden="true">←</span>
          </Link>
        </section>

        <ChangesCard onOpen={setOpenId} />
      </aside>

      <EventDrawer event={openEvent} onClose={() => setOpenId(null)} />
      {toast}
    </div>
  );
}

/** Planner date stub: big day number, weekday and month beside it, semester week at the far end. */
function DateStub({ now, weekNo }: { now: number; weekNo: number | undefined }) {
  const p = getLocalParts(now);
  const weekday = WEEKDAYS_FULL[p.weekday] ?? '';
  const month = MONTHS[p.month - 1] ?? '';
  return (
    <header className="today-stub">
      <h1 className="today-stub__h">
        <span className="visually-hidden">{`יום ${weekday}, ${p.day} ב${month}`}</span>
        <span className="today-stub__day" aria-hidden="true">
          {p.day}
        </span>
        <span className="today-stub__meta" aria-hidden="true">
          <span className="today-stub__weekday">יום {weekday}</span>
          <span className="today-stub__month">
            {month} <span className="num">{p.year}</span>
          </span>
        </span>
      </h1>
      {weekNo !== undefined && (
        <p className="today-stub__week">
          שבוע <span className="today-stub__week-n">{weekNo}</span> בסמסטר
        </p>
      )}
    </header>
  );
}

/** "בעוד 13 שעות" → small lead word, big numeral, medium unit. */
function RelativeBig({ text }: { text: string }) {
  const m = /^(בעוד|לפני)\s+(.+)$/.exec(text);
  const lead = m?.[1];
  const rest = m?.[2] ?? text;
  const parts = rest.split(/(\d+)/).filter(Boolean);
  const hasNum = parts.some((x) => /^\d+$/.test(x));
  return (
    <span className="rel">
      {lead && <span className="rel__lead">{lead} </span>}
      {parts.map((s, i) =>
        /^\d+$/.test(s) ? (
          <span key={i} className="rel__n">
            {s}
          </span>
        ) : (
          <span key={i} className={hasNum ? 'rel__unit' : 'rel__word'}>
            {s}
          </span>
        ),
      )}
    </span>
  );
}

function Hero({ event: e, now, onDone, onOpen }: { event: MoodleEvent; now: number; onDone: () => void; onOpen: () => void }) {
  const tone = deadlineTone(e.start, now);
  const idx = useCourseColorIndex(e.courseId);
  const urgency = getUrgency(e, undefined, now);
  const rel = fmtRelative(e.start, now);
  const course = e.courseName ?? (e.courseId ? e.courseId : 'אישי');
  return (
    <article className={`today-hero today-hero--${tone}`} style={courseColorStyle(idx)} aria-labelledby="today-hero-title">
      <p className="today-hero__kicker">
        <TypeIcon type={e.type} size={22} plain withLabel />
        {URGENCY_LABELS[urgency] !== rel && (
          <>
            <span aria-hidden="true">·</span>
            <span className="today-hero__urg">{URGENCY_LABELS[urgency]}</span>
          </>
        )}
      </p>
      <p className="today-hero__rel">
        <RelativeBig text={rel} />
      </p>
      <time className="today-hero__abs num" dateTime={iso(e.start)}>
        {fmtDeadline(e.start)}
      </time>
      <h3 id="today-hero-title" className="today-hero__title" dir="auto">
        {e.title}
      </h3>
      <p className="today-hero__course">
        <span className="today-mark" dir="auto">
          {course}
        </span>
      </p>
      <div className="today-hero__actions">
        <button type="button" className="btn btn--primary today-hero__done" onClick={onDone}>
          <Icon name="check" aria-hidden="true" />
          סמן כהוגש
        </button>
        <button type="button" className="btn today-hero__more" onClick={onOpen} aria-haspopup="dialog">
          פרטים
        </button>
      </div>
    </article>
  );
}

/** Quiet single line for an open quiz window. */
function OpenLine({ event: q, now, onOpen }: { event: MoodleEvent; now: number; onOpen: () => void }) {
  const idx = useCourseColorIndex(q.courseId);
  return (
    <li>
      <button type="button" className="today-open__row" onClick={onOpen} aria-haspopup="dialog" style={courseColorStyle(idx)}>
        <span className="today-open__state">
          <strong>פתוח עכשיו</strong> · נסגר {fmtRelative(q.start, now)}
          <span className="visually-hidden"> ({fmtDeadline(q.start)})</span>
        </span>
        <span className="today-open__what">
          <span className="today-open__title" dir="auto">
            {q.title}
          </span>
          {q.courseName && (
            <span className="today-open__course" dir="auto">
              {q.courseName}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function ClassFragment({ children, showNowLine, now }: { children: ReactNode; showNowLine: boolean; now: number }) {
  return (
    <>
      {showNowLine && <NowLine now={now} />}
      {children}
    </>
  );
}

/** Accent hairline between classes marking the current time. */
function NowLine({ now }: { now: number }) {
  return (
    <li className="today-nowline">
      <time className="today-nowline__t num" dateTime={iso(now)}>
        עכשיו {fmtTime(now)}
      </time>
    </li>
  );
}

function ClassRow({ event: e, now, onOpen }: { event: MoodleEvent; now: number; onOpen: () => void }) {
  const idx = useCourseColorIndex(e.courseId);
  const state = now >= e.end ? 'past' : now >= e.start ? 'now' : 'future';
  const sub = e.location && !/^https?:/.test(e.location) ? e.location : e.courseName ? e.title : undefined;
  return (
    <li className={`today-class today-class--${state}`} style={courseColorStyle(idx)} aria-current={state === 'now' ? 'time' : undefined}>
      <button type="button" className="today-class__btn" onClick={onOpen} aria-haspopup="dialog">
        <span className="today-class__time num">
          <time dateTime={iso(e.start)}>{fmtTime(e.start)}</time>
          <span className="visually-hidden">–</span>
          <time className="today-class__end" dateTime={iso(e.end)}>
            {fmtTime(e.end)}
          </time>
        </span>
        <span className="today-class__bar" aria-hidden="true" />
        <span className="today-class__body">
          <span className="today-class__title">
            <bdi>{e.courseName ?? e.title}</bdi>
          </span>
          <span className="today-class__sub">
            <TypeIcon type={e.type} size={16} plain />
            {sub && <span dir="auto">{sub}</span>}
          </span>
        </span>
        {state === 'now' && <span className="today-class__now">עכשיו</span>}
        {state === 'past' && <span className="visually-hidden">(הסתיים)</span>}
      </button>
    </li>
  );
}

/** One day of the week list: a date stub beside a ruled list of deadlines. */
function WeekDay({ items, now, todayKey, onOpen }: { items: MoodleEvent[]; now: number; todayKey: string; onOpen: (id: string) => void }) {
  const first = items[0]!;
  const p = getLocalParts(dueDayInstant(first.start));
  const label = dueDayLabel(first.start, now);
  const isToday = p.dateKey === todayKey;
  const isNamed = label === 'היום' || label === 'מחר';
  return (
    <div className={`today-day${isToday ? ' today-day--today' : ''}`}>
      <h3 className="today-day__stub">
        <span className="visually-hidden">{label}</span>
        <span className="today-day__n num" aria-hidden="true">
          {p.day}
        </span>
        <span className="today-day__wd" aria-hidden="true">
          {isNamed ? label : `יום ${weekdayShort(p.weekday)}`}
        </span>
      </h3>
      <ul role="list" className="today-day__list">
        {items.map((e) => (
          <WeekRow key={e.id} event={e} onOpen={() => onOpen(e.id)} />
        ))}
      </ul>
    </div>
  );
}

function WeekRow({ event: e, onOpen }: { event: MoodleEvent; onOpen: () => void }) {
  const idx = useCourseColorIndex(e.courseId);
  const course = e.courseName ?? (e.courseId ? e.courseId : 'אישי');
  return (
    <li>
      <button type="button" className="today-row" onClick={onOpen} aria-haspopup="dialog" style={courseColorStyle(idx)}>
        <span className="today-row__body">
          <span className="today-row__title" dir="auto">
            {e.title}
          </span>
          <span className="today-row__meta">
            <TypeIcon type={e.type} size={16} plain />
            <span className="today-row__course" dir="auto">
              {course}
            </span>
          </span>
        </span>
        <time className="today-row__time num" dateTime={iso(e.start)}>
          {fmtTime(dueDayInstant(e.start))}
        </time>
      </button>
    </li>
  );
}
