import { describe, it, expect } from 'vitest';
import {
  parseCronExpression,
  getExpandedValues,
  explainCron,
  getNextRuns,
  getNextRunsDetailed,
  compileCron,
  getPresets,
} from '../cron-parser';

// Даты сравниваем по локальным полям, а не по epoch: cron думает о настенных
// часах, и тест не должен зависеть от того, в каком поясе его запустили.
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function at(iso: string): Date {
  const [datePart, timePart] = iso.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mi] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mi, 0, 0);
}

function runs(expression: string, count: number, from: string): string[] {
  return getNextRuns(expression, count, at(from)).map(fmt);
}

describe('parseCronExpression', () => {
  it('parses a valid 5-field expression', () => {
    const result = parseCronExpression('*/5 * * * *');
    expect(result.minute).toBe('*/5');
    expect(result.hour).toBe('*');
    expect(result.dayOfMonth).toBe('*');
    expect(result.month).toBe('*');
    expect(result.dayOfWeek).toBe('*');
  });

  it('throws for the wrong number of fields', () => {
    expect(() => parseCronExpression('* * *')).toThrow('Expected 5 fields');
  });

  it('explains that a 6th field is probably a seconds field', () => {
    expect(() => parseCronExpression('0 0 0 1 * *')).toThrow(/seconds field/);
  });

  it('handles specific values', () => {
    const result = parseCronExpression('30 9 1 1 1');
    expect(result.dayOfMonth).toBe('1');
    expect(result.dayOfWeek).toBe('1');
  });

  it('expands @daily and friends', () => {
    expect(parseCronExpression('@daily')).toEqual(parseCronExpression('0 0 * * *'));
    expect(parseCronExpression('@weekly')).toEqual(parseCronExpression('0 0 * * 0'));
    expect(parseCronExpression('@yearly')).toEqual(parseCronExpression('0 0 1 1 *'));
  });

  it('refuses to predict @reboot instead of inventing a schedule', () => {
    expect(() => parseCronExpression('@reboot')).toThrow(/boots/);
  });
});

describe('getExpandedValues', () => {
  it('expands every minute (* * * * *)', () => {
    const result = getExpandedValues('* * * * *');
    expect(result.minutes).toHaveLength(60);
    expect(result.hours).toHaveLength(24);
    expect(result.daysOfMonth).toHaveLength(31);
    expect(result.months).toHaveLength(12);
    expect(result.daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('expands step values (*/15)', () => {
    expect(getExpandedValues('*/15 * * * *').minutes).toEqual([0, 15, 30, 45]);
  });

  it('expands ranges (1-5)', () => {
    expect(getExpandedValues('0 9 * * 1-5').daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it('expands lists (1,15)', () => {
    expect(getExpandedValues('0 0 1,15 * *').daysOfMonth).toEqual([1, 15]);
  });

  it('expands a range with a step (1-5/2)', () => {
    expect(getExpandedValues('1-5/2 * * * *').minutes).toEqual([1, 3, 5]);
  });

  it('expands start/step as "from start to the end of the field" (5/15)', () => {
    expect(getExpandedValues('5/15 * * * *').minutes).toEqual([5, 20, 35, 50]);
  });

  it('handles month names', () => {
    expect(getExpandedValues('0 0 1 jan,jun *').months).toEqual([1, 6]);
    expect(getExpandedValues('0 0 1 JUL *').months).toEqual([7]);
    expect(getExpandedValues('0 0 1 JAN-MAR *').months).toEqual([1, 2, 3]);
  });

  it('handles day names', () => {
    expect(getExpandedValues('0 9 * * mon,wed,fri').daysOfWeek).toEqual([1, 3, 5]);
    expect(getExpandedValues('0 9 * * MON-FRI').daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it('treats 7 as Sunday', () => {
    expect(getExpandedValues('0 0 * * 7').daysOfWeek).toEqual([0]);
    expect(getExpandedValues('0 0 * * 6,7').daysOfWeek).toEqual([0, 6]);
    expect(getExpandedValues('0 0 * * 5-7').daysOfWeek).toEqual([0, 5, 6]);
  });

  it('accepts "?" in the day fields as "no restriction"', () => {
    expect(getExpandedValues('0 0 ? * *').daysOfMonth).toHaveLength(31);
    expect(getExpandedValues('0 0 1 * ?').daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

// ---------------------------------------------------------------------------
// Правило объединения дня месяца и дня недели — ради него всё и затевалось.
// Ожидания здесь сверены с croniter и cron-parser, а не выведены из нашего кода.
// ---------------------------------------------------------------------------
describe('day-of-month OR day-of-week', () => {
  it('"0 0 1 * 1" runs on the 1st AND on every Monday', () => {
    // 1 марта 2026 — воскресенье. Старый код (пересечение) его пропускал.
    expect(runs('0 0 1 * 1', 6, '2026-02-27T23:58')).toEqual([
      '2026-03-01 00:00',
      '2026-03-02 00:00',
      '2026-03-09 00:00',
      '2026-03-16 00:00',
      '2026-03-23 00:00',
      '2026-03-30 00:00',
    ]);
  });

  it('"0 0 1 * 1" starts with the next Monday when the 1st is further away', () => {
    expect(runs('0 0 1 * 1', 5, '2026-01-01T00:00')).toEqual([
      '2026-01-05 00:00',
      '2026-01-12 00:00',
      '2026-01-19 00:00',
      '2026-01-26 00:00',
      '2026-02-01 00:00',
    ]);
  });

  it('"0 0 15 * 5" runs on Fridays and on the 15th', () => {
    expect(runs('0 0 15 * 5', 6, '2026-01-01T00:00')).toEqual([
      '2026-01-02 00:00', // пятница
      '2026-01-09 00:00',
      '2026-01-15 00:00', // четверг, но это 15-е число
      '2026-01-16 00:00',
      '2026-01-23 00:00',
      '2026-01-30 00:00',
    ]);
  });

  it('"0 0 1,15 * 1" merges both lists', () => {
    expect(runs('0 0 1,15 * 1', 4, '2026-06-10T12:00')).toEqual([
      '2026-06-15 00:00',
      '2026-06-22 00:00',
      '2026-06-29 00:00',
      '2026-07-01 00:00',
    ]);
  });

  it('"0 0 1 * 0-6" runs every day, because any weekday matches', () => {
    expect(runs('0 0 1 * 0-6', 4, '2026-01-01T00:00')).toEqual([
      '2026-01-02 00:00',
      '2026-01-03 00:00',
      '2026-01-04 00:00',
      '2026-01-05 00:00',
    ]);
  });

  it('keeps plain AND when only the day-of-month is restricted', () => {
    expect(runs('0 0 1 * *', 3, '2026-01-01T00:00')).toEqual([
      '2026-02-01 00:00',
      '2026-03-01 00:00',
      '2026-04-01 00:00',
    ]);
  });

  it('keeps plain AND when only the day-of-week is restricted', () => {
    expect(runs('0 0 * * 1', 3, '2026-01-01T00:00')).toEqual([
      '2026-01-05 00:00',
      '2026-01-12 00:00',
      '2026-01-19 00:00',
    ]);
  });

  it('still ANDs the month field with the union of the day fields', () => {
    // Февраль остаётся февралём: объединение действует только между полями дней.
    const result = runs('0 0 1 2 1', 5, '2026-01-01T00:00');
    expect(result.every((r) => r.slice(5, 7) === '02')).toBe(true);
    expect(result[0]).toBe('2026-02-01 00:00');
  });

  it('reports the rule it used', () => {
    expect(compileCron('0 0 1 * 1').dayRule).toBe('or');
    expect(compileCron('0 0 1 * *').dayRule).toBe('and');
    expect(compileCron('0 0 * * 1').dayRule).toBe('and');
    expect(compileCron('0 0 * * *').dayRule).toBe('and');
    expect(compileCron('0 0 ? * 1').dayRule).toBe('and');
  });

  it('flags "*/n" day fields as an implementation-dependent case', () => {
    expect(compileCron('0 0 */2 * 1').dayRuleAmbiguous).toBe(true);
    expect(compileCron('0 0 1 * 1').dayRuleAmbiguous).toBe(false);
  });
});

describe('steps, lists and ranges', () => {
  it('*/5 walks the hour in fives', () => {
    expect(runs('*/5 * * * *', 4, '2026-01-01T00:02')).toEqual([
      '2026-01-01 00:05', '2026-01-01 00:10', '2026-01-01 00:15', '2026-01-01 00:20',
    ]);
  });

  it('*/7 does not wrap the step across the hour boundary', () => {
    expect(runs('*/7 * * * *', 3, '2026-01-01T00:56')).toEqual([
      '2026-01-01 01:00', '2026-01-01 01:07', '2026-01-01 01:14',
    ]);
  });

  it('lists in two fields combine', () => {
    expect(runs('0 9,17 * * *', 4, '2026-01-01T00:00')).toEqual([
      '2026-01-01 09:00', '2026-01-01 17:00', '2026-01-02 09:00', '2026-01-02 17:00',
    ]);
  });

  it('ranges cover every value inside them', () => {
    expect(runs('10-13 * * * *', 5, '2026-01-01T00:00')).toEqual([
      '2026-01-01 00:10', '2026-01-01 00:11', '2026-01-01 00:12', '2026-01-01 00:13', '2026-01-01 01:10',
    ]);
  });

  it('range with step (1-5/2)', () => {
    expect(runs('1-5/2 * * * *', 4, '2026-01-01T00:00')).toEqual([
      '2026-01-01 00:01', '2026-01-01 00:03', '2026-01-01 00:05', '2026-01-01 01:01',
    ]);
  });

  it('hour range with step (10-16/2)', () => {
    expect(runs('0 10-16/2 * * *', 4, '2026-01-01T00:00')).toEqual([
      '2026-01-01 10:00', '2026-01-01 12:00', '2026-01-01 14:00', '2026-01-01 16:00',
    ]);
  });

  it('month names and month steps', () => {
    expect(runs('0 0 1 jan,jun *', 3, '2026-01-01T00:00')).toEqual([
      '2026-06-01 00:00', '2027-01-01 00:00', '2027-06-01 00:00',
    ]);
    expect(runs('0 0 1 */3 *', 4, '2026-01-01T00:00')).toEqual([
      '2026-04-01 00:00', '2026-07-01 00:00', '2026-10-01 00:00', '2027-01-01 00:00',
    ]);
  });

  it('day names', () => {
    expect(runs('0 9 * * MON-FRI', 6, '2026-01-01T00:00')).toEqual([
      '2026-01-01 09:00', '2026-01-02 09:00', '2026-01-05 09:00',
      '2026-01-06 09:00', '2026-01-07 09:00', '2026-01-08 09:00',
    ]);
  });

  it('7 means Sunday when picking real dates', () => {
    expect(runs('0 0 * * 7', 3, '2026-01-01T00:00')).toEqual([
      '2026-01-04 00:00', '2026-01-11 00:00', '2026-01-18 00:00',
    ]);
    expect(runs('0 0 * * 7', 3, '2026-01-01T00:00')).toEqual(runs('0 0 * * 0', 3, '2026-01-01T00:00'));
  });
});

describe('boundaries', () => {
  it('crosses the month boundary', () => {
    expect(runs('59 23 * * *', 3, '2026-01-30T12:00')).toEqual([
      '2026-01-30 23:59', '2026-01-31 23:59', '2026-02-01 23:59',
    ]);
  });

  it('crosses the year boundary', () => {
    expect(runs('59 23 31 12 *', 2, '2026-12-31T23:58')).toEqual([
      '2026-12-31 23:59', '2027-12-31 23:59',
    ]);
  });

  it('skips months that have no 31st', () => {
    expect(runs('0 0 31 * *', 6, '2026-01-01T00:00')).toEqual([
      '2026-01-31 00:00', '2026-03-31 00:00', '2026-05-31 00:00',
      '2026-07-31 00:00', '2026-08-31 00:00', '2026-10-31 00:00',
    ]);
  });

  it('finds 29 February only in leap years', () => {
    expect(runs('0 0 29 2 *', 4, '2026-01-01T00:00')).toEqual([
      '2028-02-29 00:00', '2032-02-29 00:00', '2036-02-29 00:00', '2040-02-29 00:00',
    ]);
  });

  it('handles a leap day as the starting point', () => {
    expect(runs('30 2 29 2 *', 2, '2024-02-29T02:31')).toEqual([
      '2028-02-29 02:30', '2032-02-29 02:30',
    ]);
  });

  it('knows February has 28 days in a common year', () => {
    expect(runs('0 0 28-29 2 *', 3, '2026-01-01T00:00')).toEqual([
      '2026-02-28 00:00', '2027-02-28 00:00', '2028-02-28 00:00',
    ]);
  });

  it('starts strictly after the given moment', () => {
    expect(runs('0 0 * * *', 1, '2026-01-01T00:00')).toEqual(['2026-01-02 00:00']);
    expect(runs('* * * * *', 1, '2026-01-01T00:00')).toEqual(['2026-01-01 00:01']);
  });

  it('returns strictly increasing times', () => {
    const list = getNextRuns('*/13 */5 * * *', 40, at('2026-01-01T00:00'));
    for (let i = 1; i < list.length; i++) {
      expect(list[i].getTime()).toBeGreaterThan(list[i - 1].getTime());
    }
  });
});

describe('schedules that can never fire', () => {
  it('says so instead of quietly returning nothing for 30 February', () => {
    const result = getNextRunsDetailed('0 0 30 2 *', 5, at('2026-01-01T00:00'));
    expect(result.runs).toEqual([]);
    expect(result.exhausted).toBe(true);
    expect(result.horizonYears).toBeGreaterThan(0);
  });

  it('does not mark a rare but real schedule as exhausted', () => {
    const result = getNextRunsDetailed('0 0 29 2 *', 5, at('2026-01-01T00:00'));
    expect(result.runs).toHaveLength(5);
    expect(result.exhausted).toBe(false);
  });

  it('reports 31 April as impossible too', () => {
    expect(getNextRunsDetailed('0 0 31 4 *', 1, at('2026-01-01T00:00')).exhausted).toBe(true);
  });
});

describe('rejects what it cannot compute', () => {
  const bad: Array<[string, RegExp]> = [
    ['60 * * * *', /out of range/],
    ['* 24 * * *', /out of range/],
    ['0 0 32 * *', /out of range/],
    ['0 0 0 * *', /out of range/],
    ['0 0 * 13 *', /out of range/],
    ['0 0 * * 8', /out of range/],
    ['*/0 * * * *', /positive whole number/],
    ['0 0 * * 5-1', /backwards/],
    ['0 0 * * MON#2', /"#"/],
    ['0 0 L * *', /"L"/],
    ['0 0 15W * *', /"W"/],
    ['0 0 1 FOO *', /not a valid/],
    ['0 0 1 * MONDAY', /not a valid/],
    ['0 0 1,, * *', /empty/],
    ['0 ? * * *', /only allowed in the day/],
  ];

  it.each(bad)('rejects "%s"', (expression, pattern) => {
    expect(() => getNextRuns(expression, 1, at('2026-01-01T00:00'))).toThrow(pattern);
  });
});

describe('explainCron', () => {
  it('says "or" and spells out the rule when both day fields are restricted', () => {
    const text = explainCron('0 0 1 * 1');
    expect(text).toContain('At 00:00');
    expect(text).toContain('on day-of-month 1 or on Monday');
    expect(text).toMatch(/either one matches/);
    // Регрессия: раньше здесь стояло "and", то есть прямая неправда.
    expect(text).not.toContain('day-of-month 1 and on Monday');
  });

  it('does not mention the rule when only one day field is restricted', () => {
    expect(explainCron('0 0 1 * *')).not.toMatch(/either one matches/);
    expect(explainCron('0 9 * * 1')).not.toMatch(/either one matches/);
  });

  it('warns that "*/n" day fields are read differently by different crons', () => {
    expect(explainCron('0 0 */2 * 1')).toMatch(/vixie/i);
    expect(explainCron('0 0 1 * 1')).not.toMatch(/vixie/i);
  });

  it('explains every minute', () => {
    expect(explainCron('* * * * *')).toBe('Every minute.');
  });

  it('explains a step', () => {
    expect(explainCron('*/5 * * * *')).toBe('Every 5th minute.');
  });

  it('explains a fixed time', () => {
    expect(explainCron('0 9 * * *')).toBe('At 09:00.');
  });

  it('explains a weekday range', () => {
    expect(explainCron('0 9 * * 1-5')).toBe('At 09:00 on Monday through Friday.');
  });

  it('explains month names instead of printing the raw range', () => {
    // Раньше "1-6" превращалось в "January" — тихая неправда.
    expect(explainCron('0 0 1 1-6 *')).toContain('January through June');
    expect(explainCron('0 0 1 jan,jun *')).toContain('January and June');
  });

  it('explains lists of hours without losing the minute', () => {
    expect(explainCron('30 9,17 * * *')).toBe('At minute 30 past hours 9 and 17.');
  });

  it('explains a range with a step', () => {
    expect(explainCron('15 10-16/2 * * *')).toBe('At minute 15 past every 2nd hour from 10 through 16.');
  });

  it('explains minute steps inside an hour range', () => {
    expect(explainCron('*/10 9-17 * * *')).toContain('every 10th minute');
  });

  it('reports the parse error instead of a plausible sentence', () => {
    expect(() => explainCron('0 0 * * 9')).toThrow(/out of range/);
  });
});

describe('presets', () => {
  it('returns at least 5 presets', () => {
    expect(getPresets().length).toBeGreaterThanOrEqual(5);
  });

  it('every preset parses, explains and produces runs', () => {
    for (const preset of getPresets()) {
      expect(() => parseCronExpression(preset.expression)).not.toThrow();
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(getNextRuns(preset.expression, 3, at('2026-01-01T00:00'))).toHaveLength(3);
    }
  });

  it('the preset descriptions agree with what the explainer says about the day rule', () => {
    for (const preset of getPresets()) {
      const usesOr = compileCron(preset.expression).dayRule === 'or';
      if (usesOr) expect(preset.description.toLowerCase()).toMatch(/either|or /);
    }
  });
});

// ---------------------------------------------------------------------------
// Таблица ниже сгенерирована ЧУЖИМИ библиотеками: значение попало сюда, только
// если croniter 6.2.4 (Python) и cron-parser 5.10.0 (JS) выдали одно и то же.
// Наш код в её составлении не участвовал — иначе он проверял бы сам себя.
// Скрипт: scripts/oracle-check/
// ---------------------------------------------------------------------------
const ORACLE_FIXTURES: Array<[string, string, string[]]> = [
  ['0 0 1 * 1', '2026-01-01T00:00', ['2026-01-05 00:00', '2026-01-12 00:00', '2026-01-19 00:00', '2026-01-26 00:00', '2026-02-01 00:00', '2026-02-02 00:00']],
  ['0 0 1 * 1', '2026-02-27T23:58', ['2026-03-01 00:00', '2026-03-02 00:00', '2026-03-09 00:00', '2026-03-16 00:00', '2026-03-23 00:00', '2026-03-30 00:00']],
  ['0 0 1 * 0', '2026-01-01T00:00', ['2026-01-04 00:00', '2026-01-11 00:00', '2026-01-18 00:00', '2026-01-25 00:00', '2026-02-01 00:00']],
  ['0 0 15 * 5', '2026-01-01T00:00', ['2026-01-02 00:00', '2026-01-09 00:00', '2026-01-15 00:00', '2026-01-16 00:00', '2026-01-23 00:00', '2026-01-30 00:00']],
  ['0 0 1,15 * 1', '2026-06-10T12:00', ['2026-06-15 00:00', '2026-06-22 00:00', '2026-06-29 00:00', '2026-07-01 00:00', '2026-07-06 00:00', '2026-07-13 00:00']],
  ['0 0 1-7 * 6', '2026-01-01T00:00', ['2026-01-02 00:00', '2026-01-03 00:00', '2026-01-04 00:00', '2026-01-05 00:00', '2026-01-06 00:00', '2026-01-07 00:00']],
  ['30 4 1 * 3', '2026-01-01T00:00', ['2026-01-01 04:30', '2026-01-07 04:30', '2026-01-14 04:30', '2026-01-21 04:30', '2026-01-28 04:30']],
  ['0 0 29 2 1', '2028-01-01T00:00', ['2028-02-07 00:00', '2028-02-14 00:00', '2028-02-21 00:00', '2028-02-28 00:00']],
  ['0 0 1 1 1', '2026-01-02T00:00', ['2026-01-05 00:00', '2026-01-12 00:00', '2026-01-19 00:00', '2026-01-26 00:00']],
  ['15 3 1,15 * MON', '2026-01-01T00:00', ['2026-01-01 03:15', '2026-01-05 03:15', '2026-01-12 03:15', '2026-01-15 03:15', '2026-01-19 03:15', '2026-01-26 03:15']],
  ['0 0 1 * *', '2026-01-01T00:00', ['2026-02-01 00:00', '2026-03-01 00:00', '2026-04-01 00:00', '2026-05-01 00:00', '2026-06-01 00:00']],
  ['0 0 * * 1', '2026-01-01T00:00', ['2026-01-05 00:00', '2026-01-12 00:00', '2026-01-19 00:00', '2026-01-26 00:00', '2026-02-02 00:00']],
  ['* * * * *', '2026-01-01T12:00', ['2026-01-01 12:01', '2026-01-01 12:02', '2026-01-01 12:03', '2026-01-01 12:04', '2026-01-01 12:05']],
  ['*/5 * * * *', '2026-01-01T00:02', ['2026-01-01 00:05', '2026-01-01 00:10', '2026-01-01 00:15', '2026-01-01 00:20', '2026-01-01 00:25']],
  ['*/15 * * * *', '2026-01-01T00:00', ['2026-01-01 00:15', '2026-01-01 00:30', '2026-01-01 00:45', '2026-01-01 01:00', '2026-01-01 01:15']],
  ['0 */2 * * *', '2026-01-01T00:00', ['2026-01-01 02:00', '2026-01-01 04:00', '2026-01-01 06:00', '2026-01-01 08:00', '2026-01-01 10:00']],
  ['*/7 * * * *', '2026-01-01T00:00', ['2026-01-01 00:07', '2026-01-01 00:14', '2026-01-01 00:21', '2026-01-01 00:28', '2026-01-01 00:35']],
  ['1,15 * * * *', '2026-01-01T00:00', ['2026-01-01 00:01', '2026-01-01 00:15', '2026-01-01 01:01', '2026-01-01 01:15', '2026-01-01 02:01']],
  ['0 0 1,15 * *', '2026-01-01T00:00', ['2026-01-15 00:00', '2026-02-01 00:00', '2026-02-15 00:00', '2026-03-01 00:00', '2026-03-15 00:00']],
  ['0 9,17 * * *', '2026-01-01T00:00', ['2026-01-01 09:00', '2026-01-01 17:00', '2026-01-02 09:00', '2026-01-02 17:00', '2026-01-03 09:00']],
  ['0 9 * * 1-5', '2026-01-01T00:00', ['2026-01-01 09:00', '2026-01-02 09:00', '2026-01-05 09:00', '2026-01-06 09:00', '2026-01-07 09:00', '2026-01-08 09:00']],
  ['0 0 1-5 * *', '2026-01-28T00:00', ['2026-02-01 00:00', '2026-02-02 00:00', '2026-02-03 00:00', '2026-02-04 00:00', '2026-02-05 00:00', '2026-03-01 00:00']],
  ['10-20 * * * *', '2026-01-01T00:00', ['2026-01-01 00:10', '2026-01-01 00:11', '2026-01-01 00:12', '2026-01-01 00:13', '2026-01-01 00:14']],
  ['1-5/2 * * * *', '2026-01-01T00:00', ['2026-01-01 00:01', '2026-01-01 00:03', '2026-01-01 00:05', '2026-01-01 01:01', '2026-01-01 01:03']],
  ['0 0 1-15/3 * *', '2026-01-01T00:00', ['2026-01-04 00:00', '2026-01-07 00:00', '2026-01-10 00:00', '2026-01-13 00:00', '2026-02-01 00:00', '2026-02-04 00:00']],
  ['0 10-16/2 * * *', '2026-01-01T00:00', ['2026-01-01 10:00', '2026-01-01 12:00', '2026-01-01 14:00', '2026-01-01 16:00', '2026-01-02 10:00']],
  ['5/15 * * * *', '2026-01-01T00:00', ['2026-01-01 00:05', '2026-01-01 00:20', '2026-01-01 00:35', '2026-01-01 00:50', '2026-01-01 01:05']],
  ['0 0 1/10 * *', '2026-01-01T00:00', ['2026-01-11 00:00', '2026-01-21 00:00', '2026-01-31 00:00', '2026-02-01 00:00', '2026-02-11 00:00']],
  ['0 0 1 JAN *', '2026-02-01T00:00', ['2027-01-01 00:00', '2028-01-01 00:00', '2029-01-01 00:00']],
  ['0 0 1 jan,jun *', '2026-01-01T00:00', ['2026-06-01 00:00', '2027-01-01 00:00', '2027-06-01 00:00', '2028-01-01 00:00']],
  ['0 0 1 JAN-MAR *', '2026-01-01T00:00', ['2026-02-01 00:00', '2026-03-01 00:00', '2027-01-01 00:00', '2027-02-01 00:00']],
  ['0 0 1 */3 *', '2026-01-01T00:00', ['2026-04-01 00:00', '2026-07-01 00:00', '2026-10-01 00:00', '2027-01-01 00:00', '2027-04-01 00:00']],
  ['0 9 * * MON', '2026-01-01T00:00', ['2026-01-05 09:00', '2026-01-12 09:00', '2026-01-19 09:00', '2026-01-26 09:00']],
  ['0 9 * * mon,wed,fri', '2026-01-01T00:00', ['2026-01-02 09:00', '2026-01-05 09:00', '2026-01-07 09:00', '2026-01-09 09:00', '2026-01-12 09:00']],
  ['0 9 * * MON-FRI', '2026-01-01T00:00', ['2026-01-01 09:00', '2026-01-02 09:00', '2026-01-05 09:00', '2026-01-06 09:00', '2026-01-07 09:00', '2026-01-08 09:00']],
  ['0 0 * * 7', '2026-01-01T00:00', ['2026-01-04 00:00', '2026-01-11 00:00', '2026-01-18 00:00', '2026-01-25 00:00']],
  ['0 0 * * 6,7', '2026-01-01T00:00', ['2026-01-03 00:00', '2026-01-04 00:00', '2026-01-10 00:00', '2026-01-11 00:00', '2026-01-17 00:00']],
  ['0 0 * * 5-7', '2026-01-01T00:00', ['2026-01-02 00:00', '2026-01-03 00:00', '2026-01-04 00:00', '2026-01-09 00:00', '2026-01-10 00:00', '2026-01-11 00:00']],
  ['59 23 31 12 *', '2026-12-31T23:58', ['2026-12-31 23:59', '2027-12-31 23:59', '2028-12-31 23:59']],
  ['0 0 1 1 *', '2026-06-01T00:00', ['2027-01-01 00:00', '2028-01-01 00:00', '2029-01-01 00:00']],
  ['59 23 28-31 * *', '2026-02-27T00:00', ['2026-02-28 23:59', '2026-03-28 23:59', '2026-03-29 23:59', '2026-03-30 23:59', '2026-03-31 23:59']],
  ['0 0 31 * *', '2026-01-01T00:00', ['2026-01-31 00:00', '2026-03-31 00:00', '2026-05-31 00:00', '2026-07-31 00:00', '2026-08-31 00:00', '2026-10-31 00:00']],
  ['0 0 29 2 *', '2026-01-01T00:00', ['2028-02-29 00:00', '2032-02-29 00:00', '2036-02-29 00:00', '2040-02-29 00:00']],
  ['0 0 29 * *', '2026-01-30T00:00', ['2026-03-29 00:00', '2026-04-29 00:00', '2026-05-29 00:00', '2026-06-29 00:00', '2026-07-29 00:00']],
  ['0 0 28-29 2 *', '2028-01-01T00:00', ['2028-02-28 00:00', '2028-02-29 00:00', '2029-02-28 00:00']],
  ['59 23 31 1 *', '2026-01-31T23:58', ['2026-01-31 23:59', '2027-01-31 23:59']],
  ['0 0 * * 1', '2026-12-28T00:00', ['2027-01-04 00:00', '2027-01-11 00:00', '2027-01-18 00:00', '2027-01-25 00:00']],
  ['0 0 */2 * 1', '2026-01-01T00:00', ['2026-01-03 00:00', '2026-01-05 00:00', '2026-01-07 00:00', '2026-01-09 00:00', '2026-01-11 00:00', '2026-01-12 00:00']],
  ['0 0 1 * 1-5', '2026-02-27T23:58', ['2026-03-01 00:00', '2026-03-02 00:00', '2026-03-03 00:00', '2026-03-04 00:00', '2026-03-05 00:00', '2026-03-06 00:00']],
  ['30 2 29 2 *', '2024-02-29T02:31', ['2028-02-29 02:30', '2032-02-29 02:30', '2036-02-29 02:30']],
];

describe('matches croniter and cron-parser', () => {
  it.each(ORACLE_FIXTURES)('%s from %s', (expression, from, expected) => {
    expect(runs(expression, expected.length, from)).toEqual(expected);
  });
});
