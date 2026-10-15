import { useMemo, useState, type CSSProperties } from 'react';
import { weeklyLoad, type MoodleEvent, type WeekLoad } from '@mtm/core';
import { CourseBadge, EmptyState, EventDrawer, PageHeader, TypeIcon } from '../../components';
import { fmtDeadline, useNow, useStore, useVisibleEvents } from '../../data';
import { dayNum, keyToDay, rangeLabel, sundayOf } from '../timetable/dates';
import './semester.css';

interface Week extends WeekLoad {
  n: number;
  sunday: number;
  label: string;
  quizzes: number;
  level: number;
  busy: boolean;
}

const LEVELS = ['0', '1', '2', '3', '4+'];

export default function SemesterScreen() {
  const events = useVisibleEvents();
  const { taskStates } = useStore();
  const now = useNow();
  const thisSunday = sundayOf(dayNum(now));
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const [openId, setOpenId] = useState<string | null>(null);

  const weeks = useMemo<Week[]>(() => {
    if (events.length === 0) return [];
    const times = events.map((e) => e.start);
    let loads: WeekLoad[] = [];
    try {
      loads = weeklyLoad(events, Math.min(...times), Math.max(...times));
    } catch (err) {
      console.warn('[core] weeklyLoad failed', err);
    }
    const counts = loads.map((w) => w.deadlines);
    const mean = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
    const sd = Math.sqrt(counts.reduce((a, b) => a + (b - mean) ** 2, 0) / (counts.length || 1));
    return loads.map((w, i) => {
      const sunday = keyToDay(w.weekStart);
      return {
        ...w,
        n: i + 1,
        sunday,
        label: rangeLabel(sunday, sunday + 6),
        quizzes: w.eventIds.filter((id) => byId.get(id)?.type === 'quiz_close').length,
        level: Math.min(4, w.deadlines),
        busy: w.deadlines >= 4 || (w.deadlines >= 2 && w.deadlines >= mean + sd),
      };
    });
  }, [events, byId]);

  const [selected, setSelected] = useState<number | null>(null);
  const sel = weeks.find((w) => w.sunday === (selected ?? thisSunday));
  const busyAhead = weeks.filter((w) => w.busy && w.sunday >= thisSunday).slice(0, 3);

  if (weeks.length === 0)
    return (
      <>
        <PageHeader title="סמסטר" />
        <EmptyState icon="📊" title="אין עדיין נתונים">
          אחרי ייבוא היומן מ-Moodle תופיע כאן מפת העומס של הסמסטר.
        </EmptyState>
      </>
    );

  const insight = (w: Week) => {
    const subs = w.deadlines - w.quizzes;
    const parts = [subs && `${subs} הגשות`, w.quizzes && `${w.quizzes} בחנים`].filter(Boolean).join(' ו-');
    return `שבוע ${w.n} (${w.label}): ${parts} — כדאי להקדים`;
  };

  const grouped = new Map<string, MoodleEvent[]>();
  for (const id of sel?.eventIds ?? []) {
    const e = byId.get(id);
    if (!e) continue;
    const k = e.courseName ?? 'אישי';
    grouped.set(k, [...(grouped.get(k) ?? []), e]);
  }

  return (
    <div className="sem stack">
      <PageHeader title="סמסטר" subtitle="מפת עומס ההגשות לאורך הסמסטר" />

      <section className="card stack">
        <h2 id="heat-h">עומס לפי שבוע</h2>
        <div className="sem-heat" role="group" aria-labelledby="heat-h">
          {weeks.map((w) => (
            <button
              key={w.weekStart}
              type="button"
              className={`sem-cell${w.sunday === thisSunday ? ' is-current' : ''}${w.busy ? ' is-busy' : ''}`}
              style={{ '--lvl': w.level } as CSSProperties}
              data-level={w.level}
              aria-pressed={sel?.sunday === w.sunday}
              aria-label={`שבוע ${w.n}, ${w.label}, ${w.deadlines} דדליינים${w.busy ? ', שבוע עמוס' : ''}${w.sunday === thisSunday ? ', השבוע' : ''}`}
              onClick={() => setSelected(w.sunday)}
            >
              <span className="sem-cell__box num">
                {w.deadlines}
                {w.busy && <span aria-hidden="true">!</span>}
              </span>
              <span className="sem-cell__n num">{w.n}</span>
              <span className="sem-cell__date num">{w.label}</span>
            </button>
          ))}
        </div>
        <div className="sem-legend small muted" aria-hidden="true">
          <span>דדליינים בשבוע:</span>
          {LEVELS.map((l, i) => (
            <span key={l} className="sem-legend__item">
              <span className="sem-cell__box" data-level={i} />
              {l}
            </span>
          ))}
          <span>! = שבוע עמוס</span>
        </div>
        {busyAhead.length > 0 && (
          <ul className="sem-insights">
            {busyAhead.map((w) => (
              <li key={w.weekStart}>⚠️ {insight(w)}</li>
            ))}
          </ul>
        )}
      </section>

      {sel && (
        <section className="card stack" aria-live="polite">
          <h2 className="num">
            שבוע {sel.n} · {sel.label}
          </h2>
          {grouped.size === 0 ? (
            <p className="muted">אין הגשות בשבוע הזה.</p>
          ) : (
            [...grouped].map(([course, list]) => (
              <div key={course} className="stack sem-group">
                <CourseBadge courseId={list[0]?.courseId} name={course} />
                <ul className="sem-list">
                  {list
                    .sort((a, b) => a.start - b.start)
                    .map((e) => (
                      <li key={e.id}>
                        <button type="button" className="sem-row" onClick={() => setOpenId(e.id)}>
                          <TypeIcon type={e.type} size={28} />
                          <span className="sem-row__title">{e.title}</span>
                          <span className="muted small num">{fmtDeadline(e.start)}</span>
                          {taskStates[e.id]?.status === 'done' && <span className="sem-done">✓ הוגש</span>}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}

      <EventDrawer event={openId ? (byId.get(openId) ?? null) : null} onClose={() => setOpenId(null)} />
    </div>
  );
}
