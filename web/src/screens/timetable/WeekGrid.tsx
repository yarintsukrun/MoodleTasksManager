import type { CSSProperties, KeyboardEvent } from 'react';
import { TYPE_LABELS, TypeIcon } from '../../components';
import { courseColorStyle, weekdayShort } from '../../data';
import { dayLongLabel, dayOfMonth, hm } from './dates';
import { PIN_SPAN, type DayColumn, type GridBand, type GridBlock, type GridModel, type GridPin } from './model';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

export const dayName = (c: DayColumn) => (c.day !== undefined ? dayLongLabel(c.day) : `יום ${weekdayShort(c.weekday)}`);
const isUrl = (s: string) => /^https?:\/\//i.test(s);
export const placeLabel = (loc?: string) => (loc ? (isUrl(loc) ? 'מקוון (קישור)' : loc) : undefined);

/** Full Hebrew description for screen readers: "הנדסת תוכנה, שיעור, יום ד׳ 15.10 12:00–14:00, חדר 3". */
export function describe(item: GridBlock | GridPin, col: DayColumn): string {
  const course = item.courseName ?? 'אישי';
  const what = item.kind === 'pin' || item.title !== item.courseName ? `${TYPE_LABELS[item.type]}: ${item.title}` : TYPE_LABELS[item.type];
  const place = item.kind === 'block' ? placeLabel(item.location) : undefined;
  return [course, what, `${dayName(col)} ${item.timeLabel}`, place].filter(Boolean).join(', ');
}

const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/** Date stub for a column head: big day number + small weekday (or big weekday letter in "regular week"). */
export function DateStub({ col, compact = false }: { col: DayColumn; compact?: boolean }) {
  return (
    <span className={`tt-stub${compact ? ' tt-stub--compact' : ''}`}>
      <span className="tt-stub__num num">{col.day !== undefined ? dayOfMonth(col.day) : weekdayShort(col.weekday)}</span>
      <span className="tt-stub__meta">
        <span className="tt-stub__wd">{col.day !== undefined ? (compact ? weekdayShort(col.weekday) : `יום ${weekdayShort(col.weekday)}`) : compact ? '' : WEEKDAY_NAMES[col.weekday]}</span>
        {col.isToday && <span className="tt-stub__today">היום</span>}
      </span>
    </span>
  );
}

interface Props {
  model: GridModel;
  columns: DayColumn[];
  colors: Record<string, number>;
  /** Minutes since local midnight, drawn on the today column. */
  nowMinute: number;
  onOpen: (eventId: string) => void;
}

/** CSS-grid week view. Columns follow document direction (RTL: Sunday on the right). */
export function WeekGrid({ model, columns, colors, nowMinute, onOpen }: Props) {
  const { rangeStart: rs, rangeEnd: re } = model;
  const hours = Array.from({ length: (re - rs) / 60 }, (_, i) => rs + i * 60);
  const color = (id?: string) => courseColorStyle(id ? colors[id] : undefined);
  const showNow = columns.some((c) => c.isToday) && nowMinute >= rs && nowMinute <= re;

  return (
    <div className="tt-grid" style={{ '--tt-cols': columns.length, '--tt-span': re - rs } as Vars}>
      <div className="tt-grid__row tt-grid__head">
        <div className="tt-grid__corner" aria-hidden="true" />
        {columns.map((c) => (
          <div key={c.weekday} className={`tt-grid__dayhead${c.isToday ? ' is-today' : ''}`} aria-current={c.isToday ? 'date' : undefined}>
            <DateStub col={c} />
          </div>
        ))}
      </div>

      <div className="tt-grid__row tt-grid__body" onKeyDown={onArrowKey}>
        <div className="tt-rules" aria-hidden="true">
          {hours.map((h) => (
            <span key={h} className={`tt-rule${h === rs ? ' tt-rule--first' : ''}`} style={{ '--at': h - rs } as Vars} />
          ))}
          {hours.map((h) => (
            <span key={`${h}h`} className="tt-rule tt-rule--half" style={{ '--at': h - rs + 30 } as Vars} />
          ))}
        </div>

        <div className="tt-grid__hours" aria-hidden="true">
          {hours.map((h) => (
            <span key={h} className={`tt-hour num${showNow && nowMinute > h - 12 && nowMinute < h + 22 ? ' is-covered' : ''}`} style={{ '--at': h - rs } as Vars}>
              {hm(h)}
            </span>
          ))}
          {showNow && (
            <span className="tt-now-label num" style={{ '--m': nowMinute - rs } as Vars}>
              {hm(nowMinute)}
            </span>
          )}
        </div>

        {columns.map((c, ci) => (
          <div
            key={c.weekday}
            className={`tt-day${c.isToday ? ' is-today' : ''}`}
            role="group"
            aria-label={dayName(c)}
            style={{ '--nb': mergeBands(c.bands, rs, re) ? 1 : 0 } as Vars}
          >
            {(() => {
              const band = mergeBands(c.bands, rs, re);
              return band ? (
                <div
                  className="tt-band"
                  title={`חלון בוחן פתוח: ${band.titles.join(', ')}`}
                  aria-hidden="true"
                  style={{ ...color(band.courseId), '--s': band.start - rs, '--d': band.end - band.start } as Vars}
                />
              ) : null;
            })()}

            {c.blocks.map((b) => (
              <button
                key={b.key}
                type="button"
                className={`tt-block${b.end - b.start < 60 ? ' tt-block--short' : ''}`}
                data-nav=""
                data-col={ci}
                data-min={b.start}
                aria-label={describe(b, c)}
                onClick={() => onOpen(b.eventId)}
                style={{ ...color(b.courseId), '--s': b.start - rs, '--d': b.end - b.start, '--lane': b.lane, '--lanes': b.lanes } as Vars}
              >
                <span className="tt-block__name" dir="auto">
                  {b.courseName ?? b.title}
                </span>
                <span className="tt-block__meta num">{b.timeLabel}</span>
                {b.location && (
                  <span className="tt-block__meta tt-block__place" dir="auto">
                    {placeLabel(b.location)}
                  </span>
                )}
              </button>
            ))}

            {c.pins.map((p) => (
              <div
                key={p.key}
                className="tt-pin-line"
                aria-hidden="true"
                style={{ ...color(p.courseId), '--m': p.minute - rs, '--lift': p.minute - p.labelMinute } as Vars}
              />
            ))}
            {c.pins.map((p) => (
              <button
                key={p.key}
                type="button"
                className="tt-pin"
                data-nav=""
                data-col={ci}
                data-min={p.minute}
                aria-label={describe(p, c)}
                onClick={() => onOpen(p.eventId)}
                style={{ ...color(p.courseId), '--lm': p.labelMinute - rs - PIN_SPAN, '--ps': PIN_SPAN } as Vars}
              >
                <TypeIcon type={p.type} size={14} plain />
                <span className="tt-pin__time num">{p.timeLabel}</span>
                <span className="tt-pin__text" dir="auto">
                  {p.title}
                </span>
              </button>
            ))}

            {c.isToday && showNow && <div className="tt-now" aria-hidden="true" style={{ '--m': nowMinute - rs } as Vars} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * All open quiz windows of a day as one quiet strip (union of their spans, clipped to the visible hours).
 * Course colour when they share a course, neutral ink otherwise; long windows would otherwise turn the grid into a barcode.
 */
function mergeBands(bands: GridBand[], rs: number, re: number) {
  const live = bands.filter((b) => Math.min(b.end, re) > Math.max(b.start, rs));
  if (live.length === 0) return undefined;
  const courses = new Set(live.map((b) => b.courseId));
  return {
    start: Math.max(rs, Math.min(...live.map((b) => b.start))),
    end: Math.min(re, Math.max(...live.map((b) => b.end))),
    courseId: courses.size === 1 ? live[0]!.courseId : undefined,
    titles: [...new Set(live.map((b) => b.title))],
  };
}

/** Printed-timetable key: what the marks on the grid mean (so colour is never the only cue). */
export function GridLegend({ datesOnly = true }: { datesOnly?: boolean }) {
  return (
    <p className="tt-legend" aria-hidden="true">
      <span className="tt-legend__item">
        <span className="tt-legend__mark tt-legend__mark--block" />
        שיעור או מפגש
      </span>
      {datesOnly && (
        <>
          <span className="tt-legend__item">
            <span className="tt-legend__mark tt-legend__mark--pin" />
            הגשה או מועד
          </span>
          <span className="tt-legend__item">
            <span className="tt-legend__mark tt-legend__mark--band" />
            חלון בוחן פתוח
          </span>
        </>
      )}
      <span className="tt-legend__item">
        <span className="tt-legend__mark tt-legend__mark--now" />
        עכשיו
      </span>
    </p>
  );
}

/** Arrow keys move focus between grid items: ↑/↓ within a day, ←/→ to the visually adjacent day. */
function onArrowKey(e: KeyboardEvent<HTMLDivElement>) {
  const cur = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
  if (!cur || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-nav]')].map((el) => ({ el, col: Number(el.dataset.col), min: Number(el.dataset.min) }));
  const col = Number(cur.dataset.col);
  const min = Number(cur.dataset.min);
  const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
  let target: HTMLElement | undefined;

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const same = items.filter((i) => i.col === col).sort((a, b) => a.min - b.min);
    const idx = same.findIndex((i) => i.el === cur);
    target = same[idx + (e.key === 'ArrowDown' ? 1 : -1)]?.el;
  } else {
    const step = (e.key === 'ArrowLeft') === rtl ? 1 : -1;
    for (let c = col + step; !target && items.some((i) => (step > 0 ? i.col >= c : i.col <= c)); c += step) {
      const inCol = items.filter((i) => i.col === c);
      target = inCol.sort((a, b) => Math.abs(a.min - min) - Math.abs(b.min - min))[0]?.el;
    }
  }
  if (target) {
    e.preventDefault();
    target.focus();
  }
}
