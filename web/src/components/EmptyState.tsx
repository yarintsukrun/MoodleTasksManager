import type { ReactNode } from 'react';

/** Centered placeholder: emoji/icon, title, optional text and action (button/link). */
export function EmptyState({ icon = '📭', title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <h2 className="empty__title">{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
