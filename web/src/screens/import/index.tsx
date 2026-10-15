import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CourseSettingsList, Icon, PageHeader } from '../../components';
import { buildDemoIcs, useStore, type ImportSummary } from '../../data';

const EXPORT_URL = 'https://moodle.huji.ac.il/2026-27/calendar/export.php';
const MAX_BYTES = 20 * 1024 * 1024;

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string } | { kind: 'done'; summary: ImportSummary };

/** Onboarding / re-import: instructions, .ics upload (drag & drop or picker), demo data, import summary. */
export default function ImportScreen() {
  const { importIcs, settings } = useStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragOver, setDragOver] = useState(false);
  const hasData = settings.lastImportAt !== undefined;

  const run = async (getText: () => Promise<string>) => {
    setStatus({ kind: 'busy' });
    try {
      setStatus({ kind: 'done', summary: await importIcs(await getText()) });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(ics|ical|ifb|icalendar)$/i.test(file.name) && file.type !== 'text/calendar')
      return setStatus({ kind: 'error', message: `"${file.name}" אינו קובץ .ics. בחר את הקובץ שהורד מדף הייצוא של Moodle.` });
    if (file.size > MAX_BYTES) return setStatus({ kind: 'error', message: 'הקובץ גדול מדי (מעל 20MB).' });
    void run(() => file.text());
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  if (status.kind === 'done') return <ImportResult summary={status.summary} onContinue={() => navigate('/today')} onAgain={() => setStatus({ kind: 'idle' })} />;

  return (
    <div className="stack" style={{ maxInlineSize: 680 }}>
      <PageHeader
        title={hasData ? 'ייבוא מחדש מ-Moodle' : 'ברוכים הבאים'}
        subtitle={hasData ? 'העלה קובץ חדש כדי לעדכן את המשימות והמערכת.' : 'הופכים את יומן ה-Moodle שלך למסך "היום", מערכת שעות, רשימת משימות ומפת עומס.'}
      />

      <Card>
        <h2 style={{ marginBlockEnd: 'var(--space-4)' }}>איך מייצאים את היומן מ-Moodle</h2>
        <ol className="steps">
          <li>
            <div>
              פתח את{' '}
              <a href={EXPORT_URL} target="_blank" rel="noreferrer">
                דף ייצוא היומן ב-Moodle <Icon name="external" width={14} height={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
              </a>{' '}
              (צריך להיות מחובר ל-Moodle).
            </div>
          </li>
          <li>
            <div>
              באירועים לייצוא, בחר <strong>כל האירועים</strong>.
            </div>
          </li>
          <li>
            <div>
              בטווח הזמן, בחר <strong>אירועים מהזמן האחרון ובקרוב</strong>, או טווח מותאם כדי לקבל את כל הסמסטר.
            </div>
          </li>
          <li>
            <div>
              לחץ על <strong>ייצוא</strong>. יורד קובץ בשם <bdi className="num">icalexport.ics</bdi>.
            </div>
          </li>
          <li>
            <div>העלה את הקובץ כאן:</div>
          </li>
        </ol>
      </Card>

      <div
        className={`dropzone${dragOver ? ' dropzone--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <Icon name="upload" />
        <p>
          <strong>גרור לכאן את קובץ ה-.ics</strong>
          <br />
          <span className="muted small">או</span>
        </p>
        <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()} disabled={status.kind === 'busy'}>
          {status.kind === 'busy' ? 'מעבד…' : 'בחר קובץ'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".ics,text/calendar"
          className="visually-hidden"
          tabIndex={-1}
          aria-label="בחר קובץ יומן .ics"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <div aria-live="polite">
        {status.kind === 'error' && (
          <div className="alert" role="alert">
            {status.message}
          </div>
        )}
      </div>

      <p className="note">
        <Icon name="lock" />
        <span>הקובץ נשאר רק במכשיר הזה. הנתונים נשמרים בדפדפן שלך ולא נשלחים לשום שרת.</span>
      </p>
      <p className="note">
        <Icon name="refresh" />
        <span>כדאי לייבא מחדש מדי פעם: אירועים חדשים, מועדים שהשתנו ואירועים שהוסרו יזוהו, והסימונים שלך (הוגש, הערות) יישמרו.</span>
      </p>

      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn--ghost" onClick={() => void run(async () => buildDemoIcs())} disabled={status.kind === 'busy'}>
          <Icon name="sparkle" />
          נסה עם נתוני דמו
        </button>
      </div>
    </div>
  );
}

function ImportResult({ summary: s, onContinue, onAgain }: { summary: ImportSummary; onContinue: () => void; onAgain: () => void }) {
  const ch = s.changes;
  const changed = ch.added + ch.removed + ch.timeChanged + ch.renamed;
  return (
    <div className="stack" style={{ maxInlineSize: 680 }}>
      <PageHeader title="הייבוא הושלם" />
      <div id="import-summary" className="success-box stack" role="status" style={{ ['--stack-gap' as string]: 'var(--space-2)' }}>
        <p className="row" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>
          <Icon name="check" style={{ color: 'var(--success)' }} />
          <span className="num">
            נמצאו {s.total} אירועים ב-{s.courseCount} קורסים
          </span>
        </p>
        <p className="num">
          זיהינו {s.classSessions} מפגשי שיעור, {s.assignments} מטלות, {s.quizzes} בחנים
        </p>
        {!s.isFirstImport && (
          <p className="small num">
            {changed === 0
              ? 'אין שינויים מאז הייבוא הקודם.'
              : `מאז הייבוא הקודם: ${ch.added} חדשים, ${ch.timeChanged} מועדים שהשתנו, ${ch.renamed} שמות שהשתנו, ${ch.removed} הוסרו.`}
          </p>
        )}
      </div>

      <section className="card stack">
        <div>
          <h2>הקורסים שלך</h2>
          <p className="muted small">אפשר לשנות צבע או להסתיר קורס (למשל קורס שאינו רלוונטי).</p>
        </div>
        <CourseSettingsList />
      </section>

      <div className="row">
        <button type="button" className="btn btn--primary" onClick={onContinue} autoFocus aria-describedby="import-summary">
          זה נראה נכון, המשך
        </button>
        <button type="button" className="btn" onClick={onAgain}>
          ייבוא קובץ אחר
        </button>
      </div>
    </div>
  );
}
