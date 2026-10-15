import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CourseSettingsList, Icon } from '../../components';
import { fmtDeadline, useCourses, useStore, type ThemePref } from '../../data';
import './settings.css';

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'לפי המכשיר' },
  { value: 'light', label: 'בהיר' },
  { value: 'dark', label: 'כהה' },
];

/** Settings sheet: appearance, courses (color/hide), data (re-import, delete all), privacy. */
export default function SettingsScreen() {
  const { settings, events, setTheme, resetAll } = useStore();
  const courses = useCourses();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const hiddenCount = courses.filter((c) => c.hidden).length;

  return (
    <div className="sheet">
      <header className="sheet__head">
        <h1 className="sheet__title">הגדרות</h1>
        <p className="sheet__lead">הכל נשמר מיד, ורק במכשיר הזה.</p>
      </header>

      <section className="sheet__sec" aria-labelledby="set-look">
        <h2 id="set-look" className="sheet__h2">
          מראה
        </h2>
        <div className="sheet__body">
          <div className="sheet__row">
            <div className="sheet__label">
              <span id="theme-label">ערכת צבעים</span>
              <span className="sheet__hint">״לפי המכשיר״ עובר לכהה כשהמחשב או הטלפון במצב כהה.</span>
            </div>
            <div className="segmented sheet__segmented" role="radiogroup" aria-labelledby="theme-label">
              {THEMES.map((t) => (
                <button key={t.value} type="button" role="radio" aria-checked={settings.theme === t.value} onClick={() => setTheme(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sheet__sec" aria-labelledby="set-courses">
        <h2 id="set-courses" className="sheet__h2">
          קורסים
        </h2>
        <div className="sheet__body">
          <p className="sheet__hint sheet__intro num">
            צבע לכל קורס, והסתרה של קורס שלא רלוונטי. קורס מוסתר לא מופיע באף מסך.
            {courses.length > 0 && (
              <>
                {' '}
                {courses.length} קורסים
                {hiddenCount > 0 ? `, ${hiddenCount} מוסתרים` : ''}.
              </>
            )}
          </p>
          <CourseSettingsList />
        </div>
      </section>

      <section className="sheet__sec" aria-labelledby="set-data">
        <h2 id="set-data" className="sheet__h2">
          נתונים
        </h2>
        <div className="sheet__body">
          <div className="sheet__row">
            <div className="sheet__label">
              <span>ייבוא אחרון</span>
              <span className="sheet__hint num">
                {settings.lastImportAt ? (
                  <>
                    {fmtDeadline(settings.lastImportAt)} · {events.length} אירועים שמורים
                  </>
                ) : (
                  'עדיין לא יובאו נתונים.'
                )}
              </span>
            </div>
            <Link to="/import" className="btn sheet__btn">
              <Icon name="refresh" width={18} height={18} aria-hidden="true" />
              ייבוא מחדש
            </Link>
          </div>

          <div className="sheet__danger">
            <div className="sheet__row">
              <div className="sheet__label">
                <span>מחיקת כל הנתונים</span>
                <span className="sheet__hint">מוחק מהמכשיר את האירועים, הסימונים (הוגש, הערות, הערכות זמן) וההגדרות.</span>
              </div>
              {!confirming && (
                <button type="button" className="btn btn--danger sheet__btn" onClick={() => setConfirming(true)}>
                  <Icon name="trash" width={18} height={18} aria-hidden="true" />
                  מחיקה…
                </button>
              )}
            </div>
            {confirming && (
              <div className="sheet__confirm" role="alertdialog" aria-labelledby="del-h" aria-describedby="del-d">
                <p id="del-h" className="sheet__confirm-title">
                  למחוק הכל?
                </p>
                <p id="del-d">אי אפשר לבטל את זה. כדי להמשיך להשתמש ביומן תצטרכו לייבא שוב את הקובץ מ-Moodle.</p>
                <div className="sheet__confirm-actions">
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
                    כן, למחוק הכל
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirming(false)}>
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="sheet__sec" aria-labelledby="set-privacy">
        <h2 id="set-privacy" className="sheet__h2">
          פרטיות
        </h2>
        <div className="sheet__body sheet__prose">
          <p>
            קובץ היומן, הסימונים וההגדרות נשמרים רק בדפדפן שלך, במכשיר הזה. שום דבר לא נשלח לשרת, ואין צורך בסיסמה של Moodle או בקישור הסודי ליומן.
          </p>
          <p className="sheet__hint">בדפדפן אחר או במכשיר אחר היומן יתחיל ריק, עד שתייבאו אליו את הקובץ.</p>
        </div>
      </section>
    </div>
  );
}
