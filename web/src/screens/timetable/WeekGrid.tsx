import type { CSSProperties, KeyboardEvent } from 'react';
import { TYPE_LABELS, TypeIcon } from '../../components';
import { courseColorStyle, weekdayShort } from '../../data';
import { dayLabel, dayLongLabel, hm } from './dates';
import { PIN_SPAN, type DayColumn, type GridBlock, type GridModel, type GridPin } from './model';

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
  const hours = Array.from({ length: (re - rs) / 60 + 1 }, (_, i) => rs + i * 60);
  const color = (id?: string) => courseColorStyle(id ? colors[id] : undefined);

  return (
    <div className="tt-grid" style={{ '--tt-cols': columns.length, '--tt-span': re - rs } as Vars}>
      <div className="tt-grid__row tt-grid__head">
        <div aria-hidden="true" />
        {columns.map((c) => (
          <div key={c.weekday} className={`tt-grid__dayhead${c.isToday ? ' is-today' : ''}`} aria-current={c.isToday ? 'date' : undefined}>
            <span className="tt-grid__dayname">יום {weekdayShort(c.weekday)}</span>
            {c.day !== undefined && <span className="num small">{dayLabel(c.day)}</span>}
          </div>
        ))}
      </div>

      <div className="tt-grid__row tt-grid__body" onKeyDown={onArrowKey}>
        <div className="tt-grid__hours" aria-hidden="true">
          {hours.map((h) => (
            <span key={h} className="num" style={{ '--at': h - rs } as Vars}>
              {hm(h)}
            </span>
          ))}
        </div>

        {columns.map((c, ci) => (
          <div key={c.weekday} className={`tt-day${c.isToday ? ' is-today' : ''}`} role="group" aria-label={dayName(c)}>
            {c.bands.map((b) => {
              const s = Math.max(b.start, rs);
              const e = Math.min(b.end, re);
              return e > s ? (
                <div key={b.key} className="tt-band" title={`חלון בוחן: ${b.title}`} aria-hidden="true" style={{ ...color(b.courseId), '--s': s - rs, '--d': e - s } as Vars} />
              ) : null;
            })}

            {c.blocks.map((b) => (
              <button
                key={b.key}
                type="button"
                className="tt-block"
                data-nav=""
                data-col={ci}
                data-min={b.start}
                aria-label={describe(b, c)}
                onClick={() => onOpen(b.eventId)}
                style={{ ...color(b.courseId), '--s': b.start - rs, '--d': b.end - b.start, '--lane': b.lane, '--lanes': b.lanes } as Vars}
              >
                <span className="tt-block__title">
                  <TypeIcon type={b.type} size={16} plain />
                  {b.courseName ?? b.title}
                </span>
                <span className="tt-block__meta num">{b.timeLabel}</span>
                {b.location && <span className="tt-block__meta">{placeLabel(b.location)}</span>}
              </button>
            ))}

            {c.pins.map((p) => (
              <div key={p.key} className="tt-pin-line" aria-hidden="true" style={{ ...color(p.courseId), '--m': p.minute - rs } as Vars} />
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
                <span className="tt-pin__text">{p.title}</span>
              </button>
            ))}

            {c.isToday && nowMinute >= rs && nowMinute <= re && <div className="tt-now" aria-hidden="true" style={{ '--m': nowMinute - rs } as Vars} />}
          </div>
        ))}
      </div>
    </div>
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
