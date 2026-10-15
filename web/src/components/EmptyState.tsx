import type { ReactNode } from 'react';

/**
 * Quiet placeholder: a short title, optional sentence and action (button/link), aligned to the text column.
 * `icon` accepts an <Icon/> element; strings (emoji) are ignored by design — no emoji in UI chrome.
 */
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  const showIcon = icon !== undefined && icon !== null && typeof icon !== 'string';
  return (
    <div className="empty">
      {showIcon && (
        <div className="empty__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="empty__title">{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
