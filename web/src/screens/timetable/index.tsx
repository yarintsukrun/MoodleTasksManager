import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { deriveWeeklySlots, type MoodleEvent, type WeeklySlot } from '@mtm/core';
import { Chip, EmptyState, EventDrawer, PageHeader } from '../../components';
import { useCourses, useNow, useStore, useVisibleEvents, weekdayShort } from '../../data';
import { Agenda } from './Agenda';
import { dayLabel, dayNum, dayWeekday, minuteOf, rangeLabel, sundayOf } from './dates';
import { buildRegular, buildWeek, visibleColumns, type GridModel } from './model';
import { WeekGrid } from './WeekGrid';
import './timetable.css';

type Mode = 'week' | 'regular';
const MODES: { value: Mode; label: string }[] = [
  { value: 'week', label: 'השבוע הזה' },
  { value: 'regular', label: 'שבוע רגיל' },
];
const SESSION_TYPES = new Set(['class_session', 'online_meeting']);
/**
 * Mobile swipe direction. RTL content is mirrored (PLAN 4.5 "החלקות הפוכות"): the next day sits at
 * the inline-end, so dragging the finger toward the inline-start (right in RTL) brings it in.
 * Flip to 'inline-end' for the opposite convention.
 */
const SWIPE_NEXT: 'inline-start' | 'inline-end' = 'inline-start';

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Chevron pointing toward inline-start ('start') or inline-end ('end'); mirrored in LTR via CSS. */
const Chevron = ({ to }: { to: 'start' | 'end' }) => (
  <svg className="tt-chev" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={to === 'start' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
  </svg>
);

export default function TimetableScreen() {
  const { settings } = useStore();
  const events = useVisibleEvents();
  const courses = useCourses();
  const now = useNow();
  const desktop = useMediaQuery('(min-width: 900px)');

  const today = dayNum(now);
  const thisSunday = sundayOf(today);
  const [mode, setMode] = useState<Mode>('week');
  const [sunday, setSunday] = useState(thisSunday);
  const [mobileDay, setMobileDay] = useState(() => dayWeekday(today));
  const [agenda, setAgenda] = useState(false);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const shown = useMemo(() => events.filter((e) => !e.courseId || !off.has(e.courseId)), [events, off]);
  const hasSessions = useMemo(() => events.some((e) => !e.isPoint && SESSION_TYPES.has(e.type)), [events]);

  const slots = useMemo<WeeklySlot[]>(() => {
    try {
      return deriveWeeklySlots(shown);
    } catch (err) {
      console.warn('[core] deriveWeeklySlots failed', err);
      return [];
    }
  }, [shown]);

  const pickEvent = (ids: string[]) => {
    const evs = ids.map((id) => byId.get(id)).filter((e): e is MoodleEvent => !!e).sort((a, b) => a.start - b.start);
    return (evs.find((e) => e.end >= now) ?? evs[evs.length - 1])?.id;
  };
  const build = (s: number): GridModel => (mode === 'week' ? buildWeek(shown, s, today) : buildRegular(slots, dayWeekday(today), pickEvent));
  const model = build(sunday);
  const columns = visibleColumns(model);
  const colors = settings.courseColors;
  const nowMinute = minuteOf(now);

  if (events.length === 0 || !hasSessions) {
    return (
      <>
        <PageHeader title="מערכת שעות" />
        <EmptyState
          icon="🗓️"
          title={events.length === 0 ? 'עדיין אין נתונים' : 'לא נמצאו מפגשי שיעור'}
          action={
            <Link to="/import" className="btn btn--primary">
              ייבוא מ-Moodle
            </Link>
          }
        >
          מערכת השעות נבנית אוטומטית ממפגשי הנוכחות והזום שמופיעים ביומן של Moodle. כשהקורסים שלך יפרסמו מפגשים כאלה, הם יופיעו כאן כבלוקים
          שבועיים.
        </EmptyState>
      </>
    );
  }

  // Mobile: day tabs over visible weekdays (plus the selected one, even if empty).
  const tabDays = [...new Set([...columns.map((c) => c.weekday), mobileDay])].sort((a, b) => a - b);
  const dayCol = model.columns[mobileDay]!;
  const goToday = () => {
    setSunday(thisSunday);
    setMobileDay(dayWeekday(today));
  };
  const stepWeek = (dir: 1 | -1) => setSunday((s) => s + 7 * dir);
  const stepDay = (dir: 1 | -1) => {
    if (agenda) return mode === 'week' && stepWeek(dir);
    const j = tabDays.indexOf(mobileDay) + dir;
    if (j >= 0 && j < tabDays.length) return setMobileDay(tabDays[j]!);
    if (mode === 'regular') return setMobileDay(tabDays[dir > 0 ? 0 : tabDays.length - 1]!);
    const next = visibleColumns(build(sunday + 7 * dir)).map((c) => c.weekday);
    setSunday(sunday + 7 * dir);
    setMobileDay((dir > 0 ? next[0] : next[next.length - 1]) ?? 0);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    const s = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(t.clientY - s.y)) return;
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const towardStart = rtl ? dx > 0 : dx < 0;
    stepDay(towardStart === (SWIPE_NEXT === 'inline-start') ? 1 : -1);
  };

  const weekLabel = `${rangeLabel(sunday, sunday + 6)}${sunday === thisSunday ? ' · השבוע' : ''}`;
  const visibleCourses = courses.filter((c) => !c.hidden);
  const mobileStepLabel = agenda ? 'שבוע' : 'יום';
  const weekEmpty = mode === 'week' && columns.every((c) => c.blocks.length === 0 && c.pins.length === 0);

  return (
    <div className="tt stack">
      <PageHeader
        title="מערכת שעות"
        subtitle={mode === 'week' ? <span className="num">{weekLabel}</span> : 'המפגשים הקבועים שחוזרים כל שבוע'}
      />

      <div className="tt-toolbar">
        <div className="segmented tt-modes" role="radiogroup" aria-label="תצוגה">
          {MODES.map((m) => (
            <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} onClick={() => setMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
        {desktop && mode === 'week' && (
          <div className="tt-nav" role="group" aria-label="ניווט בין שבועות">
            <button type="button" className="icon-btn" aria-label="השבוע הקודם" onClick={() => stepWeek(-1)}>
              <Chevron to="start" />
            </button>
            <button type="button" className="btn" onClick={goToday} disabled={sunday === thisSunday}>
              היום
            </button>
            <button type="button" className="icon-btn" aria-label="השבוע הבא" onClick={() => stepWeek(1)}>
              <Chevron to="end" />
            </button>
          </div>
        )}
        {!desktop && (
          <div className="segmented tt-views" role="radiogroup" aria-label="סוג תצוגה">
            <button type="button" role="radio" aria-checked={!agenda} onClick={() => setAgenda(false)}>
              יום
            </button>
            <button type="button" role="radio" aria-checked={agenda} onClick={() => setAgenda(true)}>
              סדר יום
            </button>
          </div>
        )}
      </div>

      {visibleCourses.length > 1 && (
        <div className="chip-row" role="group" aria-label="סינון קורסים">
          {visibleCourses.map((c) => (
            <Chip
              key={c.id}
              selected={!off.has(c.id)}
              colorIndex={c.colorIndex}
              onToggle={() =>
                setOff((prev) => {
                  const next = new Set(prev);
                  if (!next.delete(c.id)) next.add(c.id);
                  return next;
                })
              }
            >
              <bdi>{c.name}</bdi>
            </Chip>
          ))}
        </div>
      )}

      {weekEmpty && <p className="note">אין מפגשים או הגשות בשבוע הזה.</p>}

      {desktop ? (
        <WeekGrid model={model} columns={columns} colors={colors} nowMinute={nowMinute} onOpen={setOpenId} />
      ) : (
        <div className="tt-mobile" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="tt-daybar">
            <button type="button" className="icon-btn" aria-label={`ה${mobileStepLabel} הקודם`} onClick={() => stepDay(-1)}>
              <Chevron to="start" />
            </button>
            {agenda ? (
              <p className="tt-daybar__label num">{mode === 'week' ? weekLabel : 'שבוע רגיל'}</p>
            ) : (
              <div className="tt-daytabs" role="tablist" aria-label="ימי השבוע">
                {tabDays.map((w) => {
                  const col = model.columns[w]!;
                  return (
                    <button
                      key={w}
                      type="button"
                      role="tab"
                      aria-selected={w === mobileDay}
                      className={`tt-daytab${col.isToday ? ' is-today' : ''}`}
                      onClick={() => setMobileDay(w)}
                    >
                      <span>{weekdayShort(w)}</span>
                      {col.day !== undefined && <span className="num tt-daytab__date">{dayLabel(col.day)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <button type="button" className="icon-btn" aria-label={`ה${mobileStepLabel} הבא`} onClick={() => stepDay(1)}>
              <Chevron to="end" />
            </button>
          </div>
          {mode === 'week' && (sunday !== thisSunday || mobileDay !== dayWeekday(today)) && (
            <button type="button" className="btn btn--ghost tt-today-btn" onClick={goToday}>
              חזרה להיום
            </button>
          )}
          {agenda ? (
            <Agenda columns={columns} colors={colors} onOpen={setOpenId} />
          ) : (
            <WeekGrid model={model} columns={[dayCol]} colors={colors} nowMinute={nowMinute} onOpen={setOpenId} />
          )}
        </div>
      )}

      <EventDrawer event={openId ? (byId.get(openId) ?? null) : null} onClose={() => setOpenId(null)} />
    </div>
  );
}
