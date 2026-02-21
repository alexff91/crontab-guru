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

export interface ParsedField {
  type: 'wildcard' | 'value' | 'range' | 'list' | 'step';
  values: number[];
}

function replaceNames(field: string, map: Record<string, number>): string {
  let result = field.toLowerCase();
  for (const [name, num] of Object.entries(map)) {
    result = result.replace(new RegExp(name, 'gi'), String(num));
  }
  return result;
}

function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  const parts = field.split(',');
  for (const part of parts) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.includes('/')) {
      const [rangeStr, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      let start = min;
      let end = max;
      if (rangeStr !== '*') {
        if (rangeStr.includes('-')) {
          const [s, e] = rangeStr.split('-').map(Number);
          start = s;
          end = e;
        } else {
          start = parseInt(rangeStr, 10);
        }
      }
      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        values.add(i);
      }
    } else {
      values.add(parseInt(part, 10));
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

export function parseCronExpression(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Expected 5 fields, got ${parts.length}`);
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
    minutes: parseField(fields.minute, 0, 59),
    hours: parseField(fields.hour, 0, 23),
    daysOfMonth: parseField(fields.dayOfMonth, 1, 31),
    months: parseField(replaceNames(fields.month, MONTH_MAP), 1, 12),
    daysOfWeek: parseField(replaceNames(fields.dayOfWeek, DAY_MAP), 0, 6),
  };
}

function describeField(field: string, names?: string[]): string {
  if (field === '*') return 'every';
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    if (range === '*') return `every ${step}`;
    return `every ${step} starting at ${range}`;
  }
  if (field.includes('-')) {
    const [start, end] = field.split('-');
    const s = names ? names[parseInt(start, 10)] || start : start;
    const e = names ? names[parseInt(end, 10)] || end : end;
    return `${s} through ${e}`;
  }
  if (field.includes(',')) {
    const parts = field.split(',').map(p => names ? names[parseInt(p, 10)] || p : p);
    return parts.join(', ');
  }
  return names ? names[parseInt(field, 10)] || field : field;
}

export function explainCron(expression: string): string {
  const fields = parseCronExpression(expression);
  const { minute, hour, dayOfMonth, month, dayOfWeek } = fields;

  // Replace name aliases for processing
  const monthNorm = replaceNames(month, MONTH_MAP);
  const dowNorm = replaceNames(dayOfWeek, DAY_MAP);

  const parts: string[] = [];

  // Minute part
  if (minute === '*') {
    parts.push('Every minute');
  } else if (minute.includes('/')) {
    const step = minute.split('/')[1];
    parts.push(`Every ${step} minute${step === '1' ? '' : 's'}`);
  } else {
    parts.push(`At minute ${minute}`);
  }

  // Hour part
  if (hour === '*') {
    if (minute !== '*' && !minute.includes('/')) {
      parts.push('of every hour');
    }
  } else if (hour.includes('/')) {
    const step = hour.split('/')[1];
    parts.push(`past every ${step} hour${step === '1' ? '' : 's'}`);
  } else if (hour.includes(',')) {
    const hours = hour.split(',').map(h => `${h.padStart(2, '0')}:00`);
    parts.length = 0;
    parts.push(`At ${minute.padStart(2, '0')} past hour ${hour}`);
  } else if (hour.includes('-')) {
    parts.push(`during hours ${hour}`);
  } else {
    // specific hour + specific minute => "At HH:MM"
    if (!minute.includes('/') && !minute.includes(',') && !minute.includes('-') && minute !== '*') {
      parts.length = 0;
      parts.push(`At ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
    } else {
      parts.push(`past hour ${hour}`);
    }
  }

  // Day of month
  if (dayOfMonth !== '*') {
    parts.push(`on day-of-month ${dayOfMonth}`);
  }

  // Month
  if (monthNorm !== '*') {
    const monthDesc = monthNorm.split(',').map(m => MONTH_NAMES[parseInt(m, 10)] || m).join(', ');
    parts.push(`in ${monthDesc}`);
  }

  // Day of week
  if (dowNorm !== '*') {
    const dayDesc = dowNorm.split(',').map(d => {
      if (d.includes('-')) {
        const [s, e] = d.split('-').map(Number);
        return `${DAY_NAMES[s]} through ${DAY_NAMES[e]}`;
      }
      return DAY_NAMES[parseInt(d, 10)] || d;
    }).join(', ');
    parts.push(`on ${dayDesc}`);
  }

  return parts.join(' ');
}

export function getNextRuns(expression: string, count: number = 5, from?: Date): Date[] {
  const expanded = getExpandedValues(expression);
  const results: Date[] = [];
  const start = from ? new Date(from) : new Date();

  // Start from next minute
  const current = new Date(start);
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);

  const maxIterations = 525600; // one year of minutes
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    const min = current.getMinutes();
    const hr = current.getHours();
    const dom = current.getDate();
    const mon = current.getMonth() + 1; // JS months are 0-based
    const dow = current.getDay();

    if (
      expanded.minutes.includes(min) &&
      expanded.hours.includes(hr) &&
      expanded.daysOfMonth.includes(dom) &&
      expanded.months.includes(mon) &&
      expanded.daysOfWeek.includes(dow)
    ) {
      results.push(new Date(current));
    }

    current.setMinutes(current.getMinutes() + 1);
    iterations++;
  }

  return results;
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
  ];
}
