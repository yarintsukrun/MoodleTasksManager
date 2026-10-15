// Pure view-model for the timetable grid: columns of positioned blocks, deadline pins and quiz bands.
import type { EventType, MoodleEvent, WeeklySlot } from '@mtm/core';
import { isDeadlineType } from '../../data';
import { dayNum, effectiveDue, hm, minuteOf } from './dates';

/** Pin labels are this many minutes tall in the grid; nearby pins stack upward by this much. */
/** Minutes per pin label row; 24 min × 64px/h ≈ 26px, keeping pins ≥24px targets (WCAG 2.5.8). */
export const PIN_SPAN = 24;
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 21 * 60;

interface Base {
  key: string;
  courseId?: string;
  courseName?: string;
  title: string;
  type: EventType;
  /** Event opened in the drawer. */
  eventId: string;
  timeLabel: string;
}
export interface GridBlock extends Base {
  kind: 'block';
  start: number;
  end: number;
  location?: string;
  /** Overlap lane / lane count inside its cluster. */
  lane: number;
  lanes: number;
}
export interface GridPin extends Base {
  kind: 'pin';
  minute: number;
  /** Bottom edge of the label (≤ minute when stacked). */
  labelMinute: number;
}
export interface GridBand {
  key: string;
  courseId?: string;
  title: string;
  start: number;
  end: number;
}
export interface DayColumn {
  weekday: number;
  /** Local day number in "this week" mode; undefined in "regular week" mode. */
  day?: number;
  isToday: boolean;
  blocks: GridBlock[];
  pins: GridPin[];
  bands: GridBand[];
}
export interface GridModel {
  columns: DayColumn[]; // all 7 weekdays
  rangeStart: number;
  rangeEnd: number;
}

const emptyCols = (today: (w: number) => boolean, day?: (w: number) => number): DayColumn[] =>
  Array.from({ length: 7 }, (_, w) => ({ weekday: w, day: day?.(w), isToday: today(w), blocks: [], pins: [], bands: [] }));

const isPinEvent = (e: MoodleEvent) => e.isPoint || isDeadlineType(e.type);

/** Concrete events of the week starting at `sunday` (local day number). */
export function buildWeek(events: MoodleEvent[], sunday: number, today: number): GridModel {
  const cols = emptyCols((w) => sunday + w === today, (w) => sunday + w);
  const inWeek = (d: number) => d >= sunday && d < sunday + 7;
  const quizOpen = new Map<string, MoodleEvent>();
  const quizClose = new Map<string, MoodleEvent>();

  for (const e of events) {
    if (e.type === 'quiz_open') quizOpen.set(`${e.courseId}|${e.title}`, e);
    if (e.type === 'quiz_close') quizClose.set(`${e.courseId}|${e.title}`, e);
    const base = { courseId: e.courseId, courseName: e.courseName, title: e.title, type: e.type, eventId: e.id };
    if (isPinEvent(e)) {
      const at = isDeadlineType(e.type) ? effectiveDue(e.start) : e.start;
      const d = dayNum(at);
      if (!inWeek(d)) continue;
      const minute = minuteOf(at);
      cols[d - sunday]!.pins.push({ ...base, kind: 'pin', key: e.id, minute, labelMinute: minute, timeLabel: hm(minute) });
    } else {
      const d = dayNum(e.start);
      if (!inWeek(d)) continue;
      const start = minuteOf(e.start);
      const end = Math.max(start + 15, dayNum(e.end) > d ? 1440 : minuteOf(e.end));
      cols[d - sunday]!.blocks.push({ ...base, kind: 'block', key: e.id, start, end, location: e.location, lane: 0, lanes: 1, timeLabel: `${hm(start)}–${hm(end)}` });
    }
  }

  // Quiz windows: dashed band on every day between open and close, only when both fall in this week.
  for (const [k, open] of quizOpen) {
    const close = quizClose.get(k);
    if (!close || close.start <= open.start) continue;
    const closeAt = effectiveDue(close.start);
    const d0 = dayNum(open.start);
    const d1 = dayNum(closeAt);
    if (!inWeek(d0) || !inWeek(d1)) continue;
    for (let d = d0; d <= d1; d++) {
      cols[d - sunday]!.bands.push({
        key: `${k}|${d}`,
        courseId: open.courseId,
        title: open.title,
        start: d === d0 ? minuteOf(open.start) : 0,
        end: d === d1 ? minuteOf(closeAt) : 1440,
      });
    }
  }
  return finish(cols);
}

/** Recurring weekly slots (no dates). `pickEvent` chooses which concrete event a slot opens. */
export function buildRegular(slots: WeeklySlot[], todayWeekday: number, pickEvent: (ids: string[]) => string | undefined): GridModel {
  const cols = emptyCols((w) => w === todayWeekday);
  for (const s of slots) {
    const eventId = pickEvent(s.eventIds);
    if (!eventId) continue;
    cols[s.weekday]!.blocks.push({
      kind: 'block',
      key: `${s.courseId}|${s.weekday}|${s.startMinute}|${s.endMinute}`,
      courseId: s.courseId,
      courseName: s.courseName,
      title: s.courseName,
      type: s.type,
      eventId,
      start: s.startMinute,
      end: Math.max(s.startMinute + 15, s.endMinute),
      location: s.location,
      lane: 0,
      lanes: 1,
      timeLabel: `${hm(s.startMinute)}–${hm(s.endMinute)}`,
    });
  }
  return finish(cols);
}

function finish(cols: DayColumn[]): GridModel {
  let lo = DEFAULT_START;
  let hi = DEFAULT_END;
  // Only sessions stretch the visible hours; a pin like a quiz opening at 00:01 must not
  // turn the grid into a 24h column — it is drawn at the edge instead (the drawer has the exact time).
  for (const c of cols) {
    layoutLanes(c.blocks);
    for (const b of c.blocks) {
      lo = Math.min(lo, b.start);
      hi = Math.max(hi, b.end);
    }
  }
  lo = Math.floor(lo / 60) * 60;
  hi = Math.ceil(hi / 60) * 60;
  for (const c of cols) {
    c.pins
      .filter((p) => p.minute < lo + PIN_SPAN)
      .sort((a, b) => a.minute - b.minute)
      .forEach((p, i) => (p.minute = lo + PIN_SPAN * (i + 1)));
    for (const p of c.pins) p.minute = Math.min(p.minute, hi - 1);
    stackPins(c.pins);
    for (const p of c.pins) lo = Math.min(lo, p.labelMinute - PIN_SPAN);
  }
  return { columns: cols, rangeStart: Math.max(0, Math.floor(lo / 60) * 60), rangeEnd: Math.min(1440, Math.ceil(hi / 60) * 60) };
}

/** Classic calendar overlap layout: greedy lanes per cluster of transitively overlapping blocks. */
function layoutLanes(blocks: GridBlock[]) {
  blocks.sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster: GridBlock[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const close = () => {
    for (const b of cluster) b.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const b of blocks) {
    if (b.start >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = b.end;
    b.lane = lane;
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  close();
}

/** Labels sit just above their line; close pins stack upward so labels never overlap. */
function stackPins(pins: GridPin[]) {
  pins.sort((a, b) => b.minute - a.minute || a.title.localeCompare(b.title, 'he'));
  let prev = Infinity;
  for (const p of pins) {
    p.labelMinute = Math.min(p.minute, prev - PIN_SPAN);
    prev = p.labelMinute;
  }
  pins.reverse();
}

/** Weekdays to show: Sun–Thu always, Fri/Sat only when they have content. */
export const visibleColumns = (m: GridModel) =>
  m.columns.filter((c) => c.weekday < 5 || c.blocks.length > 0 || c.pins.length > 0);

/** Chronological agenda items of a column. */
export const columnItems = (c: DayColumn): (GridBlock | GridPin)[] =>
  [...c.blocks, ...c.pins].sort((a, b) => (a.kind === 'block' ? a.start : a.minute) - (b.kind === 'block' ? b.start : b.minute));

