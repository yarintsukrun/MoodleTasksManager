#!/usr/bin/env node
// Download your personal Moodle calendar export to fixtures/private/ for local development.
// Usage: npm run fetch-ics   (reads MOODLE_ICAL_URL from .env via `node --env-file=.env`)
//
// The URL contains a secret token that grants read access to your calendar.
// This script never prints it: every message goes through redact().
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_HOST = 'moodle.huji.ac.il';
const PATH_RE = /^\/\d{4}-\d{2}\/calendar\/export_execute\.php$/;
const TIMEOUT_MS = 30_000;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'fixtures', 'private');

const rawUrl = (process.env.MOODLE_ICAL_URL ?? '').trim();

/** Remove anything secret from a string before it is printed. */
function redact(text) {
  let s = String(text ?? '');
  if (rawUrl) s = s.split(rawUrl).join('<MOODLE_ICAL_URL>');
  return s
    .replace(/(authtoken=)[^&\s"'<>]*/gi, '$1***')
    .replace(/(userid=)[^&\s"'<>]*/gi, '$1***');
}

function fail(message) {
  console.error(redact(message));
  process.exit(1);
}

function describeError(err) {
  if (!err || typeof err !== 'object') return String(err);
  const parts = [err.name, err.message];
  if (err.cause && typeof err.cause === 'object') parts.push(`(${err.cause.code ?? err.cause.message ?? ''})`);
  return parts.filter(Boolean).join(': ');
}

function validate(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    // Do not include the TypeError — it carries the input string.
    fail('MOODLE_ICAL_URL is not a valid URL. / הכתובת ב-MOODLE_ICAL_URL אינה כתובת תקינה.');
  }
  const problems = [];
  if (url.protocol !== 'https:') problems.push('must use https');
  if (url.hostname !== ALLOWED_HOST) problems.push(`host must be ${ALLOWED_HOST}`);
  if (url.port !== '') problems.push('must not specify a port');
  if (url.username || url.password) problems.push('must not contain credentials');
  if (!PATH_RE.test(url.pathname)) problems.push('path must look like /YYYY-YY/calendar/export_execute.php');
  if (!url.searchParams.get('authtoken')) problems.push('missing authtoken parameter');
  if (problems.length > 0) {
    fail(
      `Refusing to fetch MOODLE_ICAL_URL: ${problems.join('; ')}.\n` +
        'הכתובת נדחתה: יש להשתמש בקישור "קבל כתובת יומן" מתוך Moodle → לוח שנה → ייצוא.',
    );
  }
  return url;
}

function todayInJerusalem() {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function main() {
  if (!rawUrl) {
    fail(
      [
        'MOODLE_ICAL_URL is empty.',
        '  1. Copy .env.example to .env',
        '  2. In Moodle: Calendar → Export → "Get calendar URL", paste it as MOODLE_ICAL_URL=... in .env',
        '',
        'המשתנה MOODLE_ICAL_URL ריק.',
        '  1. העתיקו את ‎.env.example‎ לקובץ ‎.env‎',
        '  2. ב-Moodle: לוח שנה ← ייצוא ← "קבל כתובת יומן", והדביקו את הקישור כ-MOODLE_ICAL_URL=... בקובץ ‎.env‎',
      ].join('\n'),
    );
  }

  const url = validate(rawUrl);

  let res;
  try {
    res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'MoodleTasksManager-dev/0.1 (local fetch-ics script)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    fail(`Fetch failed: ${describeError(err)}`);
  }

  if (res.status >= 300 && res.status < 400) {
    fail(`Moodle answered with a redirect (HTTP ${res.status}) — the token may be invalid or expired.`);
  }
  if (!res.ok) fail(`Moodle answered HTTP ${res.status} ${res.statusText}.`);

  const text = await res.text();
  if (!/^\s*BEGIN:VCALENDAR/i.test(text)) {
    fail('The response is not an iCalendar file — check that the token is still valid. / התשובה אינה קובץ יומן.');
  }

  const count = (text.match(/^BEGIN:VEVENT\s*$/gim) ?? []).length;
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, `calendar-${todayInJerusalem()}.ics`);
  await writeFile(outFile, text, 'utf8');

  console.log(`Saved ${count} events to ${relative(repoRoot, outFile)}`);
  console.log(`נשמרו ${count} אירועים.`);
}

main().catch((err) => fail(`Unexpected error: ${describeError(err)}`));
