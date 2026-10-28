import { useState } from 'react';
import CronBuilder from './components/CronBuilder';
import CronExplainer from './components/CronExplainer';
import NextRuns from './components/NextRuns';
import Presets from './components/Presets';
import { parseCronExpression } from './utils/cron-parser';

// Opens on a schedule people actually write — weekdays at nine — so the page
// shows its answer before anyone types.
const START = ['0', '9', '*', '*', '1-5'];

function App() {
  const [minute, setMinute] = useState(START[0]);
  const [hour, setHour] = useState(START[1]);
  const [dayOfMonth, setDayOfMonth] = useState(START[2]);
  const [month, setMonth] = useState(START[3]);
  const [dayOfWeek, setDayOfWeek] = useState(START[4]);

  const expression = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;

  const handleFieldChange = (field: string, value: string) => {
    switch (field) {
      case 'minute': setMinute(value); break;
      case 'hour': setHour(value); break;
      case 'dayOfMonth': setDayOfMonth(value); break;
      case 'month': setMonth(value); break;
      case 'dayOfWeek': setDayOfWeek(value); break;
    }
  };

  const handlePresetSelect = (expr: string) => {
    try {
      const fields = parseCronExpression(expr);
      setMinute(fields.minute);
      setHour(fields.hour);
      setDayOfMonth(fields.dayOfMonth);
      setMonth(fields.month);
      setDayOfWeek(fields.dayOfWeek);
    } catch {
      // ignore invalid preset
    }
  };

  // Paste a whole line ("*/15 2 * * 0") into the big field and it splits itself.
  const handleWhole = (text: string) => {
    const parts = text.trim().split(/\s+/);
    if (parts.length === 5) handlePresetSelect(parts.join(' '));
  };

  return (
    <div className="wb">
      <header className="wb-top">
        <a className="wb-brand" href="https://alftech.space/"><i />ALFTECH</a>
        <nav><a href="https://regex.alftech.space/">regex</a><a href="https://json.alftech.space/">json</a></nav>
      </header>
      <main className="wb-main">
        <div className="wb-eyebrow">Cron builder · runs in your browser</div>
        <h1 className="wb-h1">Five fields, <em>one</em> plain sentence.</h1>
        <p className="wb-lede">Type or pick each field and read back what the schedule means, with the next five times it will fire — the quickest way to catch a job that runs at 9 p.m. instead of 9 a.m.</p>
        <div className="wb-stack">
          <CronBuilder minute={minute} hour={hour} dayOfMonth={dayOfMonth} month={month} dayOfWeek={dayOfWeek}
            onChange={handleFieldChange} onWhole={handleWhole} explainer={<CronExplainer expression={expression} />} />
          <div className="wb-grid2">
            <NextRuns expression={expression} />
            <Presets onSelect={handlePresetSelect} currentExpression={expression} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
