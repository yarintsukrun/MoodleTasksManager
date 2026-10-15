import type { ReactNode } from 'react';
import { courseColorStyle } from '../data';
import { Icon } from './icons';

/** Toggle filter chip (aria-pressed). Optional `colorIndex` tints it with a course color. */
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
    <button type="button" className="chip" aria-pressed={selected} onClick={onToggle} style={colorIndex !== undefined ? courseColorStyle(colorIndex) : undefined}>
      {selected && <Icon name="check" className="chip__check" />}
      {children}
    </button>
  );
}
