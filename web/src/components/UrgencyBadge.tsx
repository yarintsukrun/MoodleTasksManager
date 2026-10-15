import type { Urgency } from '@mtm/core';
import type { Tone } from '../data';
import { Icon, type IconName } from './icons';

export const URGENCY_LABELS: Record<Urgency, string> = {
  overdue: 'באיחור',
  today: 'היום',
  tomorrow: 'מחר',
  this_week: 'השבוע',
  later: 'בהמשך',
  done: 'הוגש',
};

const DEFAULT_TONE: Record<Urgency, Tone> = {
  overdue: 'danger',
  today: 'danger',
  tomorrow: 'warning',
  this_week: 'neutral',
  later: 'neutral',
  done: 'success',
};
const TONE_ICON: Record<Tone, IconName> = { danger: 'alert', warning: 'clock', success: 'check', neutral: 'clock' };

/** Urgency pill (text + icon + color). `tone` overrides the default color (e.g. from deadlineTone()); `label` overrides the text. */
export function UrgencyBadge({ urgency, tone, label }: { urgency: Urgency; tone?: Tone; label?: string }) {
  const t = tone ?? DEFAULT_TONE[urgency];
  return (
    <span className={`urgency urgency--${t}`}>
      <Icon name={TONE_ICON[t]} />
      {label ?? URGENCY_LABELS[urgency]}
    </span>
  );
}
