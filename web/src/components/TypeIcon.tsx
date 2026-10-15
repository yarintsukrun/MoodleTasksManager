import type { CSSProperties } from 'react';
import type { EventType } from '@mtm/core';
import { Icon, type IconName } from './icons';

/** Hebrew label per event type. */
export const TYPE_LABELS: Record<EventType, string> = {
  assignment: 'מטלה',
  quiz_open: 'בוחן נפתח',
  quiz_close: 'בוחן נסגר',
  forum_due: 'פורום',
  class_session: 'שיעור',
  online_meeting: 'מפגש מקוון',
  activity_open: 'פעילות נפתחת',
  activity_close: 'פעילות נסגרת',
  personal: 'אירוע אישי',
  other: 'אחר',
};

export type TypeGroup = 'assignment' | 'quiz' | 'class' | 'online' | 'other';

/** Color family for a type (maps to --type-* tokens). */
export const typeGroup = (t: EventType): TypeGroup =>
  t === 'assignment' || t === 'forum_due'
    ? 'assignment'
    : t === 'quiz_open' || t === 'quiz_close'
      ? 'quiz'
      : t === 'class_session'
        ? 'class'
        : t === 'online_meeting'
          ? 'online'
          : 'other';

const ICONS: Record<EventType, IconName> = {
  assignment: 'assignment',
  quiz_open: 'quiz',
  quiz_close: 'quiz',
  forum_due: 'forum',
  class_session: 'class',
  online_meeting: 'online',
  activity_open: 'activity',
  activity_close: 'activity',
  personal: 'personal',
  other: 'other',
};

/** Type icon with accessible label (role=img). `withLabel` also shows the text; `plain` drops the tinted tile. */
export function TypeIcon({ type, size = 32, withLabel, plain }: { type: EventType; size?: number; withLabel?: boolean; plain?: boolean }) {
  const style = { '--t': `var(--type-${typeGroup(type)})`, '--ti': `${size}px` } as CSSProperties;
  const icon = (
    <span className={`type-icon${plain ? ' type-icon--plain' : ''}`} style={style} role={withLabel ? undefined : 'img'} aria-label={withLabel ? undefined : TYPE_LABELS[type]} title={TYPE_LABELS[type]}>
      <Icon name={ICONS[type]} />
    </span>
  );
  return withLabel ? (
    <span className="type-label">
      {icon}
      {TYPE_LABELS[type]}
    </span>
  ) : (
    icon
  );
}
