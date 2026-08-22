import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NextRuns from '../NextRuns';
import CronExplainer from '../CronExplainer';

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
