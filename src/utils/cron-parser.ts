// Разбор cron-выражений и вычисление ближайших запусков.
//
// Файл переписан из-за одной ошибки, которая заставляла интерфейс уверенно
// показывать неправду: если ОДНОВРЕМЕННО ограничены поле дня месяца (3-е) и
// поле дня недели (5-е), настоящий cron запускает задачу, когда совпало ЛЮБОЕ
// из двух условий (объединение), а не оба сразу. Старый код всегда брал
// пересечение, поэтому "0 0 1 * 1" показывался как "первое число, если это
// понедельник" вместо "каждое первое число И каждый понедельник".
//
// Второй принцип этого файла: лучше честная ошибка, чем правдоподобный ответ.
// Всё, что мы не умеем разобрать (L, W, #, обратные диапазоны, значения вне
// границ), приводит к явной ошибке, а не к молчаливому "как-нибудь разберём".

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

interface FieldSpec {
  label: string;
  min: number;
  /** Максимум, который разрешено написать в выражении. */
  max: number;
  /** Максимум при раскрытии '*': для дня недели 7 — это то же воскресенье, что и 0. */
  wildcardMax: number;
  names?: Record<string, number>;
  /** '?' (синтаксис Quartz) допустим только в полях дня и означает "без ограничения". */
  allowQuestion: boolean;
}

const FIELD_SPECS: Record<keyof CronFields, FieldSpec> = {
  minute: { label: 'minute', min: 0, max: 59, wildcardMax: 59, allowQuestion: false },
  hour: { label: 'hour', min: 0, max: 23, wildcardMax: 23, allowQuestion: false },
  dayOfMonth: { label: 'day-of-month', min: 1, max: 31, wildcardMax: 31, allowQuestion: true },
  month: { label: 'month', min: 1, max: 12, wildcardMax: 12, names: MONTH_MAP, allowQuestion: false },
  // Верхняя граница дня недели — 7, как LAST_DOW в vixie cron: "1/2" должно
  // дойти до 7, а 7 потом становится воскресеньем (см. ниже в parseField).
  dayOfWeek: { label: 'day-of-week', min: 0, max: 7, wildcardMax: 7, names: DAY_MAP, allowQuestion: true },
};

/** Псевдонимы вида @daily: пользователи вставляют их из реальных crontab. */
const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

// Поле "без ограничения": только '*' и '?'. Поле со звёздочкой и шагом (*/2)
// считается ограниченным — так же его понимают croniter, cron-parser и croner,
// это проверено сверкой, см. scripts/oracle-check.
function isUnrestricted(field: string): boolean {
  const f = field.trim();
  return f === '*' || f === '?';
}

function fail(message: string): never {
  throw new Error(message);
}

/**
 * Один токен-значение: число или трёхбуквенное имя (JAN, MON).
 * Всё остальное — ошибка с объяснением, а не догадка. Раньше parseInt('MON#2')
 * молча возвращал 1, и расписание "второй понедельник месяца" показывалось как
 * "каждый понедельник".
 */
function parseValueToken(token: string, spec: FieldSpec): number {
  const raw = token.trim();
  const t = raw.toLowerCase();

  if (t === '') fail(`Field "${spec.label}": empty value in "${spec.label}" list`);
  if (t.includes('#')) {
    fail(`Field "${spec.label}": "${raw}" uses the "#" (nth weekday) extension, which standard cron does not support`);
  }
  // Проверка только на точные формы "L" и "5L": иначе под неё попадало имя
  // месяца JUL, и "0 0 1 JUL *" отвергалось как неподдерживаемое расширение.
  if (t === 'l' || /^\d+l$/.test(t)) {
    fail(`Field "${spec.label}": "${raw}" uses the "L" (last) extension, which standard cron does not support`);
  }
  if (/^\d+w$/.test(t) || t === 'w') {
    fail(`Field "${spec.label}": "${raw}" uses the "W" (nearest weekday) extension, which standard cron does not support`);
  }

  let value: number;
  if (spec.names && Object.prototype.hasOwnProperty.call(spec.names, t)) {
    value = spec.names[t];
  } else if (/^\d+$/.test(t)) {
    value = parseInt(t, 10);
  } else {
    const hint = spec.names ? ` (expected a number or a name like ${Object.keys(spec.names)[0].toUpperCase()})` : '';
    fail(`Field "${spec.label}": "${raw}" is not a valid value${hint}`);
  }

  if (value < spec.min || value > spec.max) {
    fail(`Field "${spec.label}": ${raw} is out of range (${spec.min}-${spec.max})`);
  }
  return value;
}

/**
 * Раскрывает поле в отсортированный список значений.
 * Возвращает именно множество допустимых значений — совпадения по нему
 * проверяются точным сравнением, без арифметики "через раз".
 */
function parseField(field: string, spec: FieldSpec): number[] {
  const source = field.trim();
  if (source === '') fail(`Field "${spec.label}" is empty`);
  if (source === '?' && !spec.allowQuestion) {
    fail(`Field "${spec.label}": "?" is only allowed in the day-of-month and day-of-week fields`);
  }

  const values = new Set<number>();

  for (const part of source.split(',')) {
    const chunk = part.trim();
    if (chunk === '') fail(`Field "${spec.label}": empty item in list "${source}"`);

    let rangeStr = chunk;
    let step = 1;

    const slash = chunk.indexOf('/');
    if (slash !== -1) {
      rangeStr = chunk.slice(0, slash).trim();
      const stepStr = chunk.slice(slash + 1).trim();
      if (!/^\d+$/.test(stepStr) || parseInt(stepStr, 10) === 0) {
        fail(`Field "${spec.label}": step "${stepStr || ''}" in "${chunk}" must be a positive whole number`);
      }
      step = parseInt(stepStr, 10);
      if (rangeStr === '') fail(`Field "${spec.label}": "${chunk}" has no range before "/"`);
    }

    let start: number;
    let end: number;

    if (rangeStr === '*' || (rangeStr === '?' && spec.allowQuestion)) {
      start = spec.min;
      end = spec.wildcardMax;
    } else {
      const dash = rangeStr.indexOf('-');
      if (dash > 0) {
        start = parseValueToken(rangeStr.slice(0, dash), spec);
        end = parseValueToken(rangeStr.slice(dash + 1), spec);
        // Обратные диапазоны ("5-1") настоящий cron отвергает. Молча угадывать,
        // имел ли пользователь в виду перенос через край, мы не имеем права.
        if (start > end) {
          fail(`Field "${spec.label}": range "${rangeStr}" runs backwards; standard cron rejects reversed ranges`);
        }
      } else {
        start = parseValueToken(rangeStr, spec);
        // "5/15" в cron значит "от 5 до конца поля с шагом 15", а одиночное
        // "5" без шага — ровно одно значение.
        end = slash === -1 ? start : spec.wildcardMax;
      }
    }

    for (let i = start; i <= end; i += step) values.add(i);
  }

  // 7 — тоже воскресенье. Без этого "0 0 * * 7" не совпадал бы никогда,
  // потому что Date.getDay() возвращает только 0..6.
  if (spec.label === 'day-of-week' && values.has(7)) {
    values.delete(7);
    values.add(0);
  }

  return Array.from(values).sort((a, b) => a - b);
}

export function parseCronExpression(expression: string): CronFields {
  const trimmed = expression.trim();
  if (trimmed === '') fail('Expected 5 fields, got 0');

  if (trimmed.startsWith('@')) {
    const macro = trimmed.toLowerCase();
    if (macro === '@reboot') {
      fail('"@reboot" runs once when the machine boots; there is no schedule to predict');
    }
    const expanded = MACROS[macro];
    if (!expanded) fail(`Unknown macro "${trimmed}"`);
    return parseCronExpression(expanded);
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    const extra = parts.length === 6
      ? ' (6 fields usually means a seconds field, which standard cron does not have)'
      : '';
    fail(`Expected 5 fields, got ${parts.length}${extra}`);
  }
  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

export function getExpandedValues(expression: string): {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
} {
  const fields = parseCronExpression(expression);
  return {
    minutes: parseField(fields.minute, FIELD_SPECS.minute),
    hours: parseField(fields.hour, FIELD_SPECS.hour),
    daysOfMonth: parseField(fields.dayOfMonth, FIELD_SPECS.dayOfMonth),
    months: parseField(fields.month, FIELD_SPECS.month),
    daysOfWeek: parseField(fields.dayOfWeek, FIELD_SPECS.dayOfWeek),
  };
}

/** 'or' — сработало правило объединения дня месяца и дня недели. */
export type DayRule = 'and' | 'or';

export interface CompiledCron {
  fields: CronFields;
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
  sortedMinutes: number[];
  sortedHours: number[];
  dayRule: DayRule;
  // true, если объединение включилось из-за поля дня, начинающегося со
  // звёздочки. Демоны vixie/ISC в этом случае берут пересечение: они смотрят
  // только на первый символ поля. У croniter для этого есть отдельный флаг
  // implement_cron_bug со ссылкой на https://crontab.guru/cron-bug.html.
  // По умолчанию все три сверяемые библиотеки берут объединение — и мы тоже,
  // но интерфейс обязан предупредить, что на живом сервере может быть иначе.
  dayRuleAmbiguous: boolean;
}

export function compileCron(expression: string): CompiledCron {
  const fields = parseCronExpression(expression);
  const minutes = parseField(fields.minute, FIELD_SPECS.minute);
  const hours = parseField(fields.hour, FIELD_SPECS.hour);
  const daysOfMonth = parseField(fields.dayOfMonth, FIELD_SPECS.dayOfMonth);
  const months = parseField(fields.month, FIELD_SPECS.month);
  const daysOfWeek = parseField(fields.dayOfWeek, FIELD_SPECS.dayOfWeek);

  const domRestricted = !isUnrestricted(fields.dayOfMonth);
  const dowRestricted = !isUnrestricted(fields.dayOfWeek);
  const dayRule: DayRule = domRestricted && dowRestricted ? 'or' : 'and';

  const dayRuleAmbiguous = dayRule === 'or'
    && (fields.dayOfMonth.trim().startsWith('*') || fields.dayOfWeek.trim().startsWith('*'));

  return {
    fields,
    minutes: new Set(minutes),
    hours: new Set(hours),
    daysOfMonth: new Set(daysOfMonth),
    months: new Set(months),
    daysOfWeek: new Set(daysOfWeek),
    sortedMinutes: minutes,
    sortedHours: hours,
    dayRule,
    dayRuleAmbiguous,
  };
}

/** День недели по календарной дате, без привязки к часовому поясу. */
function dayOfWeekOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function daysInMonth(year: number, month: number): number {
  // Нулевой день следующего месяца — последний день текущего; правило
  // високосного года считает сам календарь, а не мы.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
   Совпадает ли календарный день. Здесь и живёт то самое правило cron.
 */
function dayMatches(c: CompiledCron, year: number, month: number, day: number): boolean {
  const domHit = c.daysOfMonth.has(day);
  const dowHit = c.daysOfWeek.has(dayOfWeekOf(year, month, day));
  return c.dayRule === 'or' ? domHit || dowHit : domHit && dowHit;
}

/** Насколько далеко вперёд ищем: 29 февраля повторяется раз в 4 года. */
export const HORIZON_YEARS = 60;

export interface NextRunsResult {
  runs: Date[];
  requested: number;
  /** true — поиск упёрся в горизонт, а не набрал нужное количество запусков. */
  exhausted: boolean;
  horizonYears: number;
  dayRule: DayRule;
  dayRuleAmbiguous: boolean;
}

export function getNextRunsDetailed(
  expression: string,
  count: number = 5,
  from?: Date,
): NextRunsResult {
  const compiled = compileCron(expression);
  const start = from ? new Date(from) : new Date();

  // Ближайший кандидат — следующая целая минута: минута, которая уже идёт,
  // считается прошедшей.
  const after = new Date(start);
  after.setSeconds(0, 0);
  after.setMinutes(after.getMinutes() + 1);
  const afterMs = after.getTime();

  const runs: Date[] = [];
  let year = after.getFullYear();
  let month = after.getMonth() + 1;
  let day = after.getDate();
  const lastYear = year + HORIZON_YEARS;
  let exhausted = false;

  while (runs.length < count) {
    if (year > lastYear) {
      exhausted = true;
      break;
    }

    if (!compiled.months.has(month)) {
      // Целый месяц мимо — перепрыгиваем его, иначе "0 0 29 2 *" пришлось бы
      // перебирать по дню на протяжении десятилетий.
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      day = 1;
      continue;
    }

    if (dayMatches(compiled, year, month, day)) {
      for (const hour of compiled.sortedHours) {
        for (const minute of compiled.sortedMinutes) {
          const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
          if (candidate.getTime() < afterMs) continue;
          // Перевод часов может отобразить несуществующее локальное время на
          // уже выданное — не показываем один и тот же момент дважды.
          if (runs.length > 0 && candidate.getTime() <= runs[runs.length - 1].getTime()) continue;
          runs.push(candidate);
          if (runs.length >= count) break;
        }
        if (runs.length >= count) break;
      }
      if (runs.length >= count) break;
    }

    day += 1;
    if (day > daysInMonth(year, month)) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  return {
    runs,
    requested: count,
    exhausted,
    horizonYears: HORIZON_YEARS,
    dayRule: compiled.dayRule,
    dayRuleAmbiguous: compiled.dayRuleAmbiguous,
  };
}

export function getNextRuns(expression: string, count: number = 5, from?: Date): Date[] {
  return getNextRunsDetailed(expression, count, from).runs;
}

// ---------------------------------------------------------------------------
// Словесное объяснение
// ---------------------------------------------------------------------------

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function joinHuman(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function nameOf(value: number, spec: FieldSpec): string {
  if (spec.label === 'month') return MONTH_NAMES[value];
  if (spec.label === 'day-of-week') return DAY_NAMES[value % 7];
  return String(value);
}

/** У месяца и дня недели есть имена, поэтому слово-единица к ним не приписывается. */
function isNamedField(spec: FieldSpec): boolean {
  return spec.names !== undefined;
}

/**
 * Описывает один элемент списка: 5, 1-5, 1-5/2, star/2, 5/15.
 * Каждая ветка соответствует ровно той ветке parseField, которая это значение
 * раскрывает, — объяснение и расчёт не должны расходиться.
 */
function describeChunk(chunk: string, spec: FieldSpec, unit: string): string {
  const slash = chunk.indexOf('/');
  const rangeStr = slash === -1 ? chunk : chunk.slice(0, slash);
  const step = slash === -1 ? 1 : parseInt(chunk.slice(slash + 1), 10);
  const stepWord = step === 1 ? `every ${unit}` : `every ${ordinal(step)} ${unit}`;

  if (rangeStr === '*' || rangeStr === '?') return stepWord;

  const dash = rangeStr.indexOf('-');
  if (dash > 0) {
    const from = nameOf(parseValueToken(rangeStr.slice(0, dash), spec), spec);
    const to = nameOf(parseValueToken(rangeStr.slice(dash + 1), spec), spec);
    if (step === 1) {
      return isNamedField(spec) ? `${from} through ${to}` : `${stepWord} from ${from} through ${to}`;
    }
    return `${stepWord} from ${from} through ${to}`;
  }

  const value = parseValueToken(rangeStr, spec);
  if (slash === -1) return isNamedField(spec) ? nameOf(value, spec) : `${unit} ${value}`;
  return `${stepWord} from ${nameOf(value, spec)} through ${nameOf(spec.wildcardMax, spec)}`;
}

function describeFieldValue(field: string, spec: FieldSpec, unit: string, unitPlural: string): string {
  const chunks = field.trim().split(',').map((c) => c.trim());

  // Список одних только простых значений читается лучше без повтора единицы:
  // "hours 9 and 17", а не "hour 9 and hour 17".
  if (chunks.length > 1 && chunks.every((c) => /^\w+$/.test(c) && !c.includes('*'))) {
    const names = chunks.map((c) => nameOf(parseValueToken(c, spec), spec));
    return isNamedField(spec) ? joinHuman(names) : `${unitPlural} ${joinHuman(names)}`;
  }

  return joinHuman(chunks.map((chunk) => describeChunk(chunk, spec, unit)));
}

function isSingleValue(field: string): boolean {
  const f = field.trim();
  return /^\d+$/.test(f);
}

export interface CronExplanation {
  /** Одно предложение о том, когда задача запускается. */
  summary: string;
  /** Оговорки, без которых summary был бы неполной правдой. */
  notes: string[];
}

export function explainCronDetailed(expression: string): CronExplanation {
  const compiled = compileCron(expression);
  const fields = compiled.fields;
  const { minute, hour, dayOfMonth, month, dayOfWeek } = fields;

  const sentence: string[] = [];

  // --- время суток -------------------------------------------------------
  const minuteStep = /^\*\/(\d+)$/.exec(minute.trim());
  if (isSingleValue(minute) && isSingleValue(hour)) {
    sentence.push(`At ${hour.trim().padStart(2, '0')}:${minute.trim().padStart(2, '0')}`);
  } else if (isUnrestricted(hour) && isUnrestricted(minute)) {
    sentence.push('Every minute');
  } else if (isUnrestricted(hour) && minuteStep) {
    sentence.push(`Every ${ordinal(parseInt(minuteStep[1], 10))} minute`);
  } else {
    const minutePart = describeFieldValue(minute, FIELD_SPECS.minute, 'minute', 'minutes');
    if (isUnrestricted(hour)) {
      sentence.push(`At ${minutePart} of every hour`);
    } else {
      sentence.push(`At ${minutePart} past ${describeFieldValue(hour, FIELD_SPECS.hour, 'hour', 'hours')}`);
    }
  }

  // --- дни ---------------------------------------------------------------
  // Порядок и союз здесь не косметика: "or" — единственное место, где видно
  // правило объединения, ради которого этот файл и правили.
  const domPart = isUnrestricted(dayOfMonth)
    ? ''
    : `on ${describeFieldValue(dayOfMonth, FIELD_SPECS.dayOfMonth, 'day-of-month', 'day-of-month')}`;
  const dowPart = isUnrestricted(dayOfWeek)
    ? ''
    : `on ${describeFieldValue(dayOfWeek, FIELD_SPECS.dayOfWeek, 'day-of-week', 'day-of-week')}`;

  if (domPart && dowPart) {
    sentence.push(`${domPart} ${compiled.dayRule === 'or' ? 'or' : 'and'} ${dowPart}`);
  } else if (domPart) {
    sentence.push(domPart);
  } else if (dowPart) {
    sentence.push(dowPart);
  }

  // --- месяцы ------------------------------------------------------------
  if (!isUnrestricted(month)) {
    sentence.push(`in ${describeFieldValue(month, FIELD_SPECS.month, 'month', 'months')}`);
  }

  const notes: string[] = [];
  if (compiled.dayRule === 'or') {
    notes.push('Both the day-of-month and the day-of-week fields are restricted, so cron runs the job'
      + ' when either one matches, not only when both do.');
  }
  if (compiled.dayRuleAmbiguous) {
    // Не выдумка: croniter держит для этого отдельный флаг implement_cron_bug и
    // ссылается на https://crontab.guru/cron-bug.html. Мы считаем как croniter,
    // cron-parser и croner по умолчанию — объединением, но обязаны предупредить.
    notes.push('Careful: one of the day fields starts with "*". This page, croniter, cron-parser and croner'
      + ' all treat such a field as restricted and take the union — but vixie/ISC cron daemons treat any'
      + ' field starting with "*" as unrestricted and require BOTH fields to match, which gives a different'
      + ' schedule. Check against your own cron before relying on these times.');
  }

  return { summary: `${sentence.join(' ')}.`, notes };
}

export function explainCron(expression: string): string {
  const { summary, notes } = explainCronDetailed(expression);
  return [summary, ...notes].join(' ');
}

export interface CronPreset {
  label: string;
  expression: string;
  description: string;
}

export function getPresets(): CronPreset[] {
  return [
    { label: 'Every minute', expression: '* * * * *', description: 'Runs every single minute' },
    { label: 'Every 5 minutes', expression: '*/5 * * * *', description: 'Runs every 5 minutes' },
    { label: 'Every hour', expression: '0 * * * *', description: 'At minute 0 of every hour' },
    { label: 'Daily at midnight', expression: '0 0 * * *', description: 'At 00:00 every day' },
    { label: 'Daily at 9 AM', expression: '0 9 * * *', description: 'At 09:00 every day' },
    { label: 'Weekly on Monday', expression: '0 9 * * 1', description: 'At 09:00 on Monday' },
    { label: 'Monthly', expression: '0 0 1 * *', description: 'At midnight on the 1st of each month' },
    { label: 'Yearly', expression: '0 0 1 1 *', description: 'At midnight on January 1st' },
    { label: 'Weekdays at 9 AM', expression: '0 9 * * 1-5', description: 'At 09:00, Monday through Friday' },
    {
      label: '1st of month OR every Monday',
      expression: '0 0 1 * 1',
      description: 'Both day fields are set, so cron runs on either — the 1st and every Monday',
    },
  ];
}
