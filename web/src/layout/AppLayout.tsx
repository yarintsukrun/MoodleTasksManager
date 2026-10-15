import { useEffect, useRef } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary, Icon, type IconName } from '../components';
import { useStore } from '../data';

export const NAV_ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: '/today', label: 'היום', icon: 'today' },
  { to: '/timetable', label: 'מערכת שעות', icon: 'timetable' },
  { to: '/tasks', label: 'משימות', icon: 'tasks' },
  { to: '/semester', label: 'סמסטר', icon: 'semester' },
  { to: '/settings', label: 'הגדרות', icon: 'settings' },
];

const NO_DATA_ALLOWED = ['/import', '/settings'];

/** App shell: nav (bottom on mobile / side ≥900px), global error banner, routed screen. */
export function AppLayout() {
  const { ready, settings, error, clearError } = useStore();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const hasData = settings.lastImportAt !== undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!ready)
    return (
      <div className="app-loading" role="status">
        טוען…
      </div>
    );
  if (!hasData && !NO_DATA_ALLOWED.includes(pathname)) return <Navigate to="/import" replace />;

  return (
    <div className={hasData ? "app app--nav" : "app"}>
      <button type="button" className="skip-link" onClick={() => mainRef.current?.focus()}>
        דלג לתוכן
      </button>
      {hasData && (
        <nav className="app-nav" aria-label="ניווט ראשי">
          <div className="app-nav__brand">
            <Icon name="check" width={24} height={24} />
            משימות Moodle
          </div>
          <ul className="app-nav__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className="app-nav__link">
                  <span className="app-nav__icon">
                    <Icon name={item.icon} />
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <main ref={mainRef} id="main" tabIndex={-1} className="app-main" style={{ outline: 'none' }}>
        {error && (
          <div className="app-banner" role="alert">
            <Icon name="alert" />
            <p className="app-banner__text">{error}</p>
            <button type="button" className="icon-btn" onClick={clearError} aria-label="סגור הודעה">
              <Icon name="close" />
            </button>
          </div>
        )}
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
