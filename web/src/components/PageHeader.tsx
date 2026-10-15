import type { ReactNode } from 'react';

/** Screen title (h1) with optional subtitle and trailing actions. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header__titles">
        <h1>{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}
