import type { ReactNode } from 'react';
import { courseColorStyle } from '../data';
import { Icon } from './icons';

/** Toggle filter chip (aria-pressed) — the only pill shape in the UI. Optional `colorIndex` marks it with a course colour (dot → highlighter when selected). */
export function Chip({
  selected,
  onToggle,
  children,
  colorIndex,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  colorIndex?: number;
}) {
  return (
    <button type="button" className={colorIndex !== undefined ? 'chip chip--course' : 'chip'} aria-pressed={selected} onClick={onToggle} style={colorIndex !== undefined ? courseColorStyle(colorIndex) : undefined}>
      {selected && <Icon name="check" className="chip__check" />}
      {children}
    </button>
  );
}
