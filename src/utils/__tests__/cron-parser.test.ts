import { describe, it, expect } from 'vitest';
import {
  parseCronExpression,
  getExpandedValues,
  explainCron,
  getNextRuns,
  getPresets,
} from '../cron-parser';

describe('parseCronExpression', () => {
  it('should parse a valid 5-field expression', () => {
    const result = parseCronExpression('*/5 * * * *');
    expect(result.minute).toBe('*/5');
    expect(result.hour).toBe('*');
    expect(result.dayOfMonth).toBe('*');
    expect(result.month).toBe('*');
    expect(result.dayOfWeek).toBe('*');
  });

  it('should throw for invalid number of fields', () => {
    expect(() => parseCronExpression('* * *')).toThrow('Expected 5 fields');
  });

  it('should handle specific values', () => {
    const result = parseCronExpression('30 9 1 1 1');
    expect(result.minute).toBe('30');
    expect(result.hour).toBe('9');
    expect(result.dayOfMonth).toBe('1');
    expect(result.month).toBe('1');
    expect(result.dayOfWeek).toBe('1');
  });
});

describe('getExpandedValues', () => {
  it('should expand every minute (* * * * *)', () => {
    const result = getExpandedValues('* * * * *');
    expect(result.minutes).toHaveLength(60);
    expect(result.hours).toHaveLength(24);
    expect(result.daysOfMonth).toHaveLength(31);
    expect(result.months).toHaveLength(12);
    expect(result.daysOfWeek).toHaveLength(7);
  });

  it('should expand step values (*/15 * * * *)', () => {
    const result = getExpandedValues('*/15 * * * *');
    expect(result.minutes).toEqual([0, 15, 30, 45]);
  });

  it('should expand ranges (1-5)', () => {
    const result = getExpandedValues('0 9 * * 1-5');
    expect(result.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it('should expand lists (1,15)', () => {
    const result = getExpandedValues('0 0 1,15 * *');
    expect(result.daysOfMonth).toEqual([1, 15]);
  });

  it('should handle month names', () => {
    const result = getExpandedValues('0 0 1 jan,jun *');
    expect(result.months).toEqual([1, 6]);
  });

  it('should handle day names', () => {
    const result = getExpandedValues('0 9 * * mon,wed,fri');
    expect(result.daysOfWeek).toEqual([1, 3, 5]);
  });
});

describe('explainCron', () => {
  it('should explain every minute', () => {
    const result = explainCron('* * * * *');
    expect(result).toContain('Every minute');
  });

  it('should explain specific time', () => {
    const result = explainCron('0 9 * * *');
    expect(result).toContain('09:00');
  });

  it('should explain with day of week', () => {
    const result = explainCron('0 9 * * 1');
    expect(result).toContain('Monday');
  });

  it('should explain step values', () => {
    const result = explainCron('*/5 * * * *');
    expect(result).toContain('5');
    expect(result).toContain('minute');
  });

  it('should explain monthly with specific day', () => {
    const result = explainCron('0 0 1 * *');
    expect(result).toContain('day-of-month 1');
  });
});

describe('getNextRuns', () => {
  it('should return the requested number of runs', () => {
    const runs = getNextRuns('* * * * *', 5);
    expect(runs).toHaveLength(5);
  });

  it('should return dates in ascending order', () => {
    const runs = getNextRuns('*/10 * * * *', 5);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].getTime()).toBeGreaterThan(runs[i - 1].getTime());
    }
  });

  it('should respect the from parameter', () => {
    const from = new Date(2025, 0, 1, 0, 0, 0); // Jan 1, 2025
    const runs = getNextRuns('0 9 * * *', 3, from);
    expect(runs).toHaveLength(3);
    expect(runs[0].getHours()).toBe(9);
    expect(runs[0].getMinutes()).toBe(0);
  });

  it('should correctly calculate every-minute runs', () => {
    const from = new Date(2025, 0, 1, 12, 0, 0);
    const runs = getNextRuns('* * * * *', 3, from);
    expect(runs).toHaveLength(3);
    expect(runs[0].getMinutes()).toBe(1);
    expect(runs[1].getMinutes()).toBe(2);
    expect(runs[2].getMinutes()).toBe(3);
  });
});

describe('getPresets', () => {
  it('should return at least 5 presets', () => {
    const presets = getPresets();
    expect(presets.length).toBeGreaterThanOrEqual(5);
  });

  it('should have valid expressions for all presets', () => {
    const presets = getPresets();
    for (const preset of presets) {
      expect(() => parseCronExpression(preset.expression)).not.toThrow();
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
    }
  });
});
