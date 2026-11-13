import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NextRuns from '../NextRuns';
import CronExplainer from '../CronExplainer';
import CronBuilder from '../CronBuilder';
import { liveExpression } from '../../utils/cron-parser';

// Проверяем не расчёт, а то, что на экран попадает: правильные числа мало
// стоят, если рядом с ними стоит подпись, которая их искажает.
function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('NextRuns', () => {
  it('warns that both day fields are in play', () => {
    const text = render(<NextRuns expression="0 0 1 * 1" />);
    expect(text).toMatch(/union of the two/);
    expect(text).toMatch(/either matches/);
  });

  it('stays quiet about the rule when only one day field is restricted', () => {
    expect(render(<NextRuns expression="0 0 1 * *" />)).not.toMatch(/union of the two/);
  });

  it('says which timezone the times are in', () => {
    expect(render(<NextRuns expression="0 9 * * *" />)).toMatch(/Local time/);
  });

  it('admits that a 30 February schedule never runs', () => {
    const text = render(<NextRuns expression="0 0 30 2 *" />);
    expect(text).toMatch(/never runs/);
    expect(text).not.toMatch(/Local time/);
  });

  it('shows the parse error instead of an empty list', () => {
    expect(render(<NextRuns expression="0 0 * * 9" />)).toMatch(/out of range/);
  });

  it('lists five times for a normal schedule', () => {
    const text = render(<NextRuns expression="*/5 * * * *" />);
    expect(text).toMatch(/1 .*2 .*3 .*4 .*5/);
    expect(text).not.toMatch(/never runs/);
  });
});

describe('CronExplainer', () => {
  it('says "or" between the day fields and explains why', () => {
    const text = render(<CronExplainer expression="0 0 1 * 1" />);
    expect(text).toContain('on day-of-month 1 or on Monday');
    expect(text).toMatch(/either one matches/);
  });

  it('does not add the note for a plain monthly schedule', () => {
    const text = render(<CronExplainer expression="0 0 1 * *" />);
    expect(text).toContain('day-of-month 1');
    expect(text).not.toMatch(/either one matches/);
  });

  it('shows the parse error rather than a plausible sentence', () => {
    expect(render(<CronExplainer expression="0 0 1 * MON#2" />)).toMatch(/nth weekday. extension/);
  });
});

// 13 Nov 2026: typing a whole line into the top box left the sentence and the
// next runs describing the previous schedule until Enter or blur.
describe('whole-line box, while typing', () => {
  it('explains the draft, not the fields it has not reached yet', () => {
    const fields = '0 9 * * 1-5';
    expect(liveExpression(null, fields)).toBe(fields);
    expect(liveExpression('*/15 2 * *', fields)).toBe('*/15 2 * *');
    expect(liveExpression('  */15   2 * * 0 ', fields)).toBe('*/15 2 * * 0');
  });

  it('a four-field draft reads as an error, not as the old sentence', () => {
    const live = liveExpression('*/15 2 * *', '0 9 * * 1-5');
    expect(render(<CronExplainer expression={live} />)).toMatch(/Expected 5 fields, got 4/);
    expect(render(<NextRuns expression={live} />)).toMatch(/Expected 5 fields, got 4/);
  });

  it('the fifth field makes it the new schedule at once', () => {
    const live = liveExpression('*/15 2 * * 0', '0 9 * * 1-5');
    const text = render(<CronExplainer expression={live} />);
    expect(text).toMatch(/15th minute/i);
    expect(text).toMatch(/Sunday/);
    expect(text).not.toMatch(/Friday|hour 9/);
  });

  it('the box is controlled, so React re-renders it per keystroke', () => {
    const html = renderToStaticMarkup(<CronBuilder minute="0" hour="9" dayOfMonth="*" month="*" dayOfWeek="1-5" whole="*/15 2" onChange={() => {}} onWhole={() => {}} />);
    expect(html).toMatch(/id="whole"[^>]*value="\*\/15 2"/);
  });
});
