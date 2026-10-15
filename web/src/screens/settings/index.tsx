import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CourseSettingsList, Icon, PageHeader } from '../../components';
import { fmtDeadline, useStore, type ThemePref } from '../../data';

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'אוטומטי' },
  { value: 'light', label: 'בהיר' },
  { value: 'dark', label: 'כהה' },
];

/** Settings: theme, courses (color/hide), re-import, delete all data, privacy note. */
export default function SettingsScreen() {
  const { settings, events, setTheme, resetAll } = useStore();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="stack" style={{ maxInlineSize: 720 }}>
      <PageHeader title="הגדרות" />

      <section className="card stack">
        <h2 id="theme-h">ערכת נושא</h2>
        <div className="segmented" role="radiogroup" aria-labelledby="theme-h">
          {THEMES.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={settings.theme === t.value} onClick={() => setTheme(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <div>
          <h2>קורסים</h2>
          <p className="muted small">צבע לכל קורס, והסתרה של קורסים שלא רלוונטיים (הם לא יופיעו במסכים).</p>
        </div>
        <CourseSettingsList />
      </section>

      <section className="card stack">
        <div>
          <h2>נתונים</h2>
          <p className="muted small num">
            {settings.lastImportAt ? `ייבוא אחרון: ${fmtDeadline(settings.lastImportAt)} · ${events.length} אירועים שמורים` : 'עדיין לא יובאו נתונים.'}
          </p>
        </div>
        <Link to="/import" className="btn">
          <Icon name="refresh" />
          ייבוא מחדש מ-Moodle
        </Link>
        {!confirming ? (
          <button type="button" className="btn btn--danger" onClick={() => setConfirming(true)}>
            <Icon name="trash" />
            מחק את כל הנתונים
          </button>
        ) : (
          <div className="alert stack" role="alertdialog" aria-labelledby="del-h" style={{ ['--stack-gap' as string]: 'var(--space-3)' }}>
            <p id="del-h">
              <strong>למחוק הכל?</strong> כל האירועים, הסימונים (הוגש, הערות, הערכות זמן) וההגדרות יימחקו מהמכשיר הזה. אי אפשר לבטל.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn btn--danger-solid"
                autoFocus
                onClick={async () => {
                  await resetAll();
                  setConfirming(false);
                  navigate('/import');
                }}
              >
                כן, מחק הכל
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                ביטול
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="note">
        <Icon name="lock" />
        <span>
          פרטיות: כל הנתונים (קובץ היומן, הסימונים וההגדרות) נשמרים רק בדפדפן שלך, במכשיר הזה. שום דבר לא נשלח לשרת, ואין צורך בסיסמה או בקישור
          הסודי של Moodle.
        </span>
      </p>
    </div>
  );
}
