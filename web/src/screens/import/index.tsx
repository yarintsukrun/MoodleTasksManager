import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CourseSettingsList, Icon } from '../../components';
import { buildDemoIcs, useStore, type ImportSummary } from '../../data';
import './import.css';

const EXPORT_URL = 'https://moodle.huji.ac.il/2026-27/calendar/export.php';
const MAX_BYTES = 20 * 1024 * 1024;

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string } | { kind: 'done'; summary: ImportSummary };

/** Hebrew count phrase: "קורס אחד" / "3 קורסים". */
const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

/** Hebrew "and": ו-5 (hyphen before digits), ובוחן אחד. */
const and = (phrase: string) => (/^\d/.test(phrase) ? `ו-${phrase}` : `ו${phrase}`);

/** Onboarding / re-import: how-to + .ics upload (drag & drop or picker), demo calendar, import summary. */
export default function ImportScreen() {
  const { importIcs, settings } = useStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragOver, setDragOver] = useState(false);
  const hasData = settings.lastImportAt !== undefined;
  const busy = status.kind === 'busy';

  const run = async (getText: () => Promise<string>) => {
    setStatus({ kind: 'busy' });
    try {
      setStatus({ kind: 'done', summary: await importIcs(await getText()) });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(ics|ical|ifb|icalendar)$/i.test(file.name) && file.type !== 'text/calendar')
      return setStatus({
        kind: 'error',
        message: `"${file.name}" אינו קובץ ‎.ics. צריך את הקובץ שיורד מדף הייצוא של Moodle.`,
      });
    if (file.size > MAX_BYTES)
      return setStatus({
        kind: 'error',
        message: 'הקובץ גדול מדי (יותר מ-20MB). זה כנראה לא קובץ היומן.',
      });
    void run(() => file.text());
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  if (status.kind === 'done')
    return <ImportResult summary={status.summary} onContinue={() => navigate('/today')} onAgain={() => setStatus({ kind: 'idle' })} />;

  return (
    <div className="onb">
      <header className="onb__head">
        <p className="onb__kicker">{hasData ? 'עדכון היומן' : 'יומן הסטודנט'}</p>
        <h1 className="onb__title">{hasData ? 'ייבוא מחדש מ-Moodle' : 'כל הסמסטר שלך, מסודר על דף אחד'}</h1>
        <p className="onb__lead">
          {hasData
            ? 'מעלים קובץ חדש ומקבלים את המועדים העדכניים. מה שסימנת (הוגש, הערות, הערכות זמן) נשאר כמו שהוא.'
            : 'מעלים את קובץ היומן מ-Moodle ומקבלים מערכת שעות, רשימת משימות ומפת עומס לכל הסמסטר.'}{' '}
          <span className="onb__lead-quiet">הקובץ נשאר במכשיר הזה ולא נשלח לשום שרת.</span>
        </p>
        {!hasData && (
          <button type="button" className="onb__jump" onClick={() => document.getElementById('onb-demo-btn')?.focus()}>
            רק רוצים להציץ? יש יומן לדוגמה
          </button>
        )}
      </header>

      <div className="onb__paths">
        <section className="onb__upload" aria-labelledby="onb-upload-h">
          <h2 id="onb-upload-h" className="onb__h2">
            העלאת קובץ מ-Moodle
          </h2>
          <p className="onb__sub">חמש דקות, פעם אחת בסמסטר. אחר כך מספיק לייבא מחדש מדי פעם.</p>

          <ol className="onb-steps">
            <li>
              <p>
                פותחים את{' '}
                <a href={EXPORT_URL} target="_blank" rel="noreferrer">
                  דף ייצוא היומן ב-Moodle
                  <Icon name="external" width={14} height={14} className="onb__ext" aria-hidden="true" />
                  <span className="visually-hidden"> (נפתח בחלון חדש)</span>
                </a>
                . צריך להיות מחוברים ל-Moodle.
              </p>
            </li>
            <li>
              <p>
                באירועים לייצוא בוחרים <strong>כל האירועים</strong>.
              </p>
            </li>
            <li>
              <p>
                בטווח הזמן בוחרים <strong>אירועים מהזמן האחרון ובקרוב</strong>, או טווח מותאם שמכסה את כל הסמסטר.
              </p>
            </li>
            <li>
              <p>
                לוחצים <strong>ייצוא</strong>, ויורד קובץ בשם <bdi className="onb__file">icalexport.ics</bdi>.
              </p>
            </li>
            <li>
              <div className="onb-steps__body">
                <p>מעלים אותו כאן:</p>
                <div
                  className={`onb-drop${dragOver ? ' onb-drop--over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <p className="onb-drop__text">
                    <strong>גוררים את הקובץ לתוך המסגרת</strong>
                    <span className="onb-drop__or">או בוחרים אותו מהמחשב</span>
                  </p>
                  <button type="button" className="btn btn--primary onb-drop__btn" onClick={() => inputRef.current?.click()} disabled={busy}>
                    <Icon name="upload" width={18} height={18} aria-hidden="true" />
                    {busy ? 'קורא את הקובץ…' : 'בחירת קובץ'}
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".ics,text/calendar"
                    className="visually-hidden"
                    tabIndex={-1}
                    aria-label="בחירת קובץ יומן ‎.ics"
                    onChange={(e) => {
                      handleFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </div>
                <div aria-live="polite" className="onb__live">
                  {status.kind === 'error' && (
                    <p className="onb__error" role="alert">
                      <Icon name="alert" width={18} height={18} aria-hidden="true" />
                      <span>{status.message}</span>
                    </p>
                  )}
                </div>
              </div>
            </li>
          </ol>
        </section>

        <aside className="onb__demo" aria-labelledby="onb-demo-h">
          <h2 id="onb-demo-h" className="onb__h2">
            הצצה עם יומן לדוגמה
          </h2>
          <p>
            למרצים, לחברים ולמי שרוצה לראות לפני שמעלים: סמסטר אמיתי מהאוניברסיטה העברית, בלי פרטים מזהים. התאריכים מוזזים כך שהוא מתחיל מהשבוע
            הנוכחי.
          </p>
          <dl className="onb-facts">
            <div>
              <dt>קורסים</dt>
              <dd className="num">3</dd>
            </div>
            <div>
              <dt>אירועים</dt>
              <dd className="num">77</dd>
            </div>
          </dl>
          <button id="onb-demo-btn" type="button" className="btn onb__demo-btn" onClick={() => void run(async () => buildDemoIcs())} disabled={busy}>
            {busy ? 'טוען…' : 'פתיחת היומן לדוגמה'}
            <span aria-hidden="true" className="onb__arrow">
              ←
            </span>
          </button>
          {hasData && <p className="onb__fine">היומן לדוגמה יחליף את הנתונים שכבר יש כאן.</p>}
        </aside>
      </div>

      <footer className="onb__foot">
        <p>
          <Icon name="lock" width={16} height={16} aria-hidden="true" />
          <span>
            <strong>פרטיות.</strong> הנתונים נשמרים רק בדפדפן שלך. אין הרשמה, אין סיסמה ואין שרת.
          </span>
        </p>
        <p>
          <Icon name="refresh" width={16} height={16} aria-hidden="true" />
          <span>
            <strong>עדכונים.</strong> בייבוא מחדש מזהים אירועים חדשים, מועדים שזזו ואירועים שהוסרו, והסימונים שלך נשמרים.
          </span>
        </p>
      </footer>
    </div>
  );
}

function ImportResult({ summary: s, onContinue, onAgain }: { summary: ImportSummary; onContinue: () => void; onAgain: () => void }) {
  const ch = s.changes;
  const changed = ch.added + ch.removed + ch.timeChanged + ch.renamed;
  const sessions = count(s.classSessions, 'מפגש שיעור אחד', 'מפגשי שיעור');
  const assignments = count(s.assignments, 'מטלה אחת', 'מטלות');
  const quizzes = count(s.quizzes, 'בוחן אחד', 'בחנים');
  const inCourses = s.courseCount === 1 ? 'בקורס אחד' : `ב-${s.courseCount} קורסים`;
  return (
    <div className="onb onb--result">
      <header className="onb__head">
        <p className="onb__kicker">{s.isFirstImport ? 'הייבוא הושלם' : 'ייבוא מחדש'}</p>
        <h1 className="onb__title">{s.isFirstImport ? 'היומן שלך מוכן' : 'היומן עודכן'}</h1>
        <div id="import-summary" role="status" className="onb__summary">
          <p className="onb__lead num">
            מצאנו {count(s.total, 'אירוע אחד', 'אירועים')} {inCourses}: {sessions}, {assignments} {and(quizzes)}.
          </p>
          {!s.isFirstImport && (
            <p className="onb__changes num">
              {changed === 0
                ? 'אין שינויים מאז הייבוא הקודם.'
                : `מאז הייבוא הקודם: ${ch.added} חדשים, ${ch.timeChanged} מועדים שזזו, ${ch.renamed} שמות שהשתנו, ${ch.removed} הוסרו.`}
            </p>
          )}
        </div>
      </header>

      <section className="onb__courses" aria-labelledby="onb-courses-h">
        <div className="onb__courses-head">
          <h2 id="onb-courses-h" className="onb__h2">
            הקורסים
          </h2>
          <p className="onb__sub">אפשר לבחור צבע לכל קורס ולהסתיר קורס שלא רלוונטי. גם אחר כך, בהגדרות.</p>
        </div>
        <CourseSettingsList />
      </section>

      <div className="onb__actions">
        <button type="button" className="btn btn--primary" onClick={onContinue} autoFocus aria-describedby="import-summary">
          המשך ליומן
          <span aria-hidden="true" className="onb__arrow">
            ←
          </span>
        </button>
        <button type="button" className="btn btn--ghost" onClick={onAgain}>
          ייבוא קובץ אחר
        </button>
      </div>
    </div>
  );
}
