// Генератор набора выражений + наши ответы. Никакой сверки здесь нет —
// сверяет croniter в compare.py, чтобы наш код не проверял сам себя.
const fs = require('fs');
const path = require('path');
const { getNextRuns } = require('./cron-parser.cjs');

// Детерминированный ГПСЧ, чтобы набор был воспроизводим.
let seed = 20260822;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function int(min, max) { return min + Math.floor(rnd() * (max - min + 1)); }

function randField(min, max, names) {
  const kind = pick(['star', 'star', 'value', 'list', 'range', 'step', 'rangestep', 'startstep']);
  const v = () => {
    const n = int(min, max);
    return names && rnd() < 0.4 ? names[n - (names === MONTHS ? 1 : 0)] : String(n);
  };
  switch (kind) {
    case 'star': return '*';
    case 'value': return v();
    case 'list': {
      const n = int(2, 3);
      const out = new Set();
      for (let i = 0; i < n; i++) out.add(v());
      return Array.from(out).join(',');
    }
    case 'range': {
      const a = int(min, max);
      const b = int(a, max);
      return `${a}-${b}`;
    }
    case 'step': return `*/${int(2, Math.max(2, Math.floor((max - min) / 2)))}`;
    case 'rangestep': {
      const a = int(min, max);
      const b = int(a, max);
      return `${a}-${b}/${int(2, 5)}`;
    }
    case 'startstep': return `${int(min, max)}/${int(2, 7)}`;
  }
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Ручной набор: всё, что перечислено в задаче, плюс случаи, на которых старый код врал.
const curated = [
  '0 0 1 * 1', '0 0 1 * 0', '0 0 15 * 5', '0 0 1,15 * 1', '0 0 1-7 * 6',
  '30 4 1 * 3', '0 12 13 * 5', '0 0 */2 * 1', '0 0 1 * 1-5', '0 0 31 * 0',
  '0 0 29 2 1', '0 0 1 1 1', '15 3 1,15 * MON',
  '* * * * *', '*/5 * * * *', '*/15 * * * *', '0 */2 * * *', '*/7 * * * *',
  '1,15 * * * *', '0 0 1,15 * *', '0 9,17 * * *', '0 0 1,10,20 * *',
  '0 9 * * 1-5', '0 0 1-5 * *', '10-20 * * * *', '0 8-18 * * *',
  '1-5/2 * * * *', '0 0 1-15/3 * *', '0 10-16/2 * * *', '5/15 * * * *', '0 0 1/10 * *',
  '0 0 1 JAN *', '0 0 1 jan,jun *', '0 0 1 JAN-MAR *', '0 0 1 */3 *',
  '0 9 * * MON', '0 9 * * mon,wed,fri', '0 9 * * MON-FRI', '0 0 * * SUN',
  '0 0 * * 7', '0 0 * * 0', '0 0 * * 6,7', '0 0 * * 5-7',
  '59 23 31 12 *', '0 0 1 1 *', '59 23 28-31 * *', '0 0 31 * *', '0 0 30 * *',
  '0 0 29 2 *', '0 0 29 * *', '0 0 28-29 2 *', '0 0 1 3 *',
  '@daily', '@hourly', '@weekly', '@monthly', '@yearly',
  '0 0 * * 1#', // намеренно некорректное — проверяется отдельно
];

const bases = [
  '2026-01-01T00:00:00',
  '2026-02-27T23:58:00',
  '2025-12-31T23:59:00',
  '2028-02-28T12:00:00', // високосный год
  '2027-03-01T00:00:00',
  '2026-08-22T14:37:00',
  '2024-02-29T00:00:00',
];

const cases = [];
for (const expr of curated) cases.push(expr);
for (let i = 0; i < 600; i++) {
  const m = rnd() < 0.5 ? String(int(0, 59)) : randField(0, 59);
  const h = rnd() < 0.5 ? String(int(0, 23)) : randField(0, 23);
  const dom = randField(1, 31);
  const mon = rnd() < 0.35 ? randField(1, 12, MONTHS) : '*';
  const dow = rnd() < 0.6 ? randField(0, 6, DAYS) : '*';
  cases.push(`${m} ${h} ${dom} ${mon} ${dow}`);
}

function fmt(d) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const out = [];
for (const expr of cases) {
  for (const base of bases) {
    const [datePart, timePart] = base.split('T');
    const [y, mo, d] = datePart.split('-').map(Number);
    const [hh, mi, ss] = timePart.split(':').map(Number);
    const from = new Date(y, mo - 1, d, hh, mi, ss);
    let runs = null;
    let error = null;
    try {
      runs = getNextRuns(expr, 8, from).map(fmt);
    } catch (e) {
      error = e.message;
    }
    out.push({ expr, base, runs, error });
  }
}

fs.writeFileSync(path.join(__dirname, 'ours.json'), JSON.stringify(out, null, 0));
console.log('expressions:', cases.length, 'cases:', out.length);
