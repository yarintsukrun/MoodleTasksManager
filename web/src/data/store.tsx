// App-wide store: Moodle events + user task state + settings, persisted to IndexedDB (idb-keyval).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { del, get, set } from 'idb-keyval';
import { mergeEvents, parseIcs, type EventChange, type EventType, type MoodleEvent, type TaskState, type TaskStatus } from '@mtm/core';
import { assignCourseColors } from './colors';
import { DEFAULT_SETTINGS, EMPTY_DATA, type ImportSummary, type PersistedData, type Settings, type ThemePref } from './types';

const STORAGE_KEY = 'mtm:data:v1';

export interface StoreValue {
  /** false until IndexedDB has been read. */
  ready: boolean;
  events: MoodleEvent[];
  taskStates: Record<string, TaskState>;
  recentChanges: EventChange[];
  settings: Settings;
  /** Last surfaced error (Hebrew), shown as a banner by the layout. */
  error: string | null;
  clearError: () => void;
  reportError: (message: string, cause?: unknown) => void;
  /** Parse + merge an .ics export. Throws an Error with a Hebrew message on failure. */
  importIcs: (text: string) => Promise<ImportSummary>;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  setEstimate: (id: string, hours: number | undefined) => void;
  setNotes: (id: string, notes: string) => void;
  setTypeOverride: (id: string, type: EventType | undefined) => void;
  setCourseColor: (courseId: string, colorIndex: number) => void;
  toggleCourseHidden: (courseId: string) => void;
  setTheme: (theme: ThemePref) => void;
  dismissChanges: () => void;
  resetAll: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function summarize(fresh: MoodleEvent[], changes: EventChange[], isFirstImport: boolean): ImportSummary {
  const byType: Partial<Record<EventType, number>> = {};
  const courses = new Map<string, { id: string; name: string; count: number }>();
  for (const e of fresh) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    if (e.courseId) {
      const c = courses.get(e.courseId) ?? { id: e.courseId, name: e.courseName ?? e.courseId, count: 0 };
      c.count++;
      courses.set(e.courseId, c);
    }
  }
  const count = (k: EventChange['kind']) => (isFirstImport ? 0 : changes.filter((c) => c.kind === k).length);
  return {
    total: fresh.length,
    courseCount: courses.size,
    courses: [...courses.values()].sort((a, b) => a.name.localeCompare(b.name, 'he')),
    byType,
    classSessions: byType.class_session ?? 0,
    assignments: byType.assignment ?? 0,
    // A quiz shows up as an open/close pair; count each quiz once.
    quizzes: Math.max(byType.quiz_close ?? 0, byType.quiz_open ?? 0),
    changes: { added: count('added'), removed: count('removed'), timeChanged: count('time_changed'), renamed: count('renamed') },
    isFirstImport,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const reportError = useCallback((message: string, cause?: unknown) => {
    if (cause) console.error(message, cause);
    setError(message);
  }, []);

  // Hydrate from IndexedDB once.
  useEffect(() => {
    let cancelled = false;
    get<PersistedData>(STORAGE_KEY)
      .then((stored) => {
        if (cancelled || !stored) return;
        setData({ ...EMPTY_DATA, ...stored, settings: { ...DEFAULT_SETTINGS, ...stored.settings } });
      })
      .catch((err) => reportError('לא ניתן לקרוא את הנתונים השמורים בדפדפן (ייתכן שמצב גלישה פרטית חוסם אחסון).', err))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [reportError]);

  // Persist on every change after hydration.
  useEffect(() => {
    if (!ready) return;
    set(STORAGE_KEY, data).catch((err) => reportError('שמירת הנתונים בדפדפן נכשלה. השינויים לא יישמרו אחרי רענון.', err));
  }, [data, ready, reportError]);

  // Apply theme preference to <html data-theme>.
  const theme = data.settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  const importIcs = useCallback(async (text: string): Promise<ImportSummary> => {
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('הקובץ אינו קובץ יומן (.ics) תקין. ודא שבחרת את הקובץ שהורד מ-Moodle.');
    let fresh: MoodleEvent[];
    try {
      fresh = parseIcs(text);
    } catch (err) {
      console.error(err);
      throw new Error(`פענוח הקובץ נכשל: ${errorText(err)}`);
    }
    if (fresh.length === 0) throw new Error('לא נמצאו אירועים בקובץ. נסה לייצא שוב עם "כל האירועים" וטווח זמן רחב יותר.');

    const prev = dataRef.current;
    const isFirstImport = prev.events.length === 0;
    let merged: { events: MoodleEvent[]; changes: EventChange[] };
    try {
      merged = mergeEvents(prev.events, fresh);
    } catch (err) {
      console.error(err);
      throw new Error(`מיזוג האירועים נכשל: ${errorText(err)}`);
    }
    const courseIds = merged.events.flatMap((e) => (e.courseId ? [e.courseId] : []));
    const next: PersistedData = {
      ...prev,
      events: merged.events,
      recentChanges: isFirstImport ? [] : merged.changes,
      settings: {
        ...prev.settings,
        courseColors: assignCourseColors(prev.settings.courseColors, courseIds),
        lastImportAt: Date.now(),
      },
    };
    dataRef.current = next;
    setData(next);
    setError(null);
    return summarize(fresh, merged.changes, isFirstImport);
  }, []);

  const patchTask = useCallback((id: string, patch: Partial<TaskState>) => {
    setData((d) => {
      const prev = d.taskStates[id] ?? { status: 'todo' as const, updatedAt: 0 };
      return { ...d, taskStates: { ...d.taskStates, [id]: { ...prev, ...patch, updatedAt: Date.now() } } };
    });
  }, []);

  const patchSettings = useCallback((fn: (s: Settings) => Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...fn(d.settings) } }));
  }, []);

  const resetAll = useCallback(async () => {
    try {
      await del(STORAGE_KEY);
    } catch (err) {
      reportError('מחיקת הנתונים מהדפדפן נכשלה.', err);
    }
    setData(EMPTY_DATA);
  }, [reportError]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      events: data.events,
      taskStates: data.taskStates,
      recentChanges: data.recentChanges,
      settings: data.settings,
      error,
      clearError: () => setError(null),
      reportError,
      importIcs,
      setTaskStatus: (id, status) => patchTask(id, { status }),
      setEstimate: (id, hours) => patchTask(id, { estimateHours: hours }),
      setNotes: (id, notes) => patchTask(id, { notes }),
      setTypeOverride: (id, type) => patchTask(id, { typeOverride: type }),
      setCourseColor: (courseId, colorIndex) =>
        patchSettings((s) => ({ courseColors: { ...s.courseColors, [courseId]: colorIndex } })),
      toggleCourseHidden: (courseId) =>
        patchSettings((s) => ({
          hiddenCourseIds: s.hiddenCourseIds.includes(courseId)
            ? s.hiddenCourseIds.filter((c) => c !== courseId)
            : [...s.hiddenCourseIds, courseId],
        })),
      setTheme: (t) => patchSettings(() => ({ theme: t })),
      dismissChanges: () => setData((d) => ({ ...d, recentChanges: [] })),
      resetAll,
    }),
    [ready, data, error, reportError, importIcs, patchTask, patchSettings, resetAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Access the store; must be inside <StoreProvider>. */
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
