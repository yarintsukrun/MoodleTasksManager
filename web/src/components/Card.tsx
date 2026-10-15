import type { HTMLAttributes, ReactNode } from 'react';

/** Surface container. `onClick` makes it a full-width <button> card; Flat paper sheet with a 1px rule (`flat` kept for API compatibility). */
export function Card({
  children,
  className = '',
  flat,
  onClick,
  ...rest
}: { children: ReactNode; flat?: boolean; onClick?: () => void } & Omit<HTMLAttributes<HTMLElement>, 'onClick'>) {
  const cls = `card${flat ? ' card--flat' : ''}${onClick ? ' card--interactive' : ''} ${className}`.trim();
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} {...rest}>
      {children}
    </button>
  ) : (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
