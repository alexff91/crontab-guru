import { useState } from 'react';
import CronBuilder from './components/CronBuilder';
import CronExplainer from './components/CronExplainer';
import NextRuns from './components/NextRuns';
import Presets from './components/Presets';
import { parseCronExpression, liveExpression } from './utils/cron-parser';

// Opens on a schedule people actually write — weekdays at nine — so the page
// shows its answer before anyone types.
const START = ['0', '9', '*', '*', '1-5'];

function App() {
  const [minute, setMinute] = useState(START[0]);
  const [hour, setHour] = useState(START[1]);
  const [dayOfMonth, setDayOfMonth] = useState(START[2]);
  const [month, setMonth] = useState(START[3]);
  const [dayOfWeek, setDayOfWeek] = useState(START[4]);

  // What is being typed into the big box right now, or null when nobody is typing
  // there. While it is set, the sentence and the next runs read *it* — also when it
  // is half a line — so the page never describes a schedule other than the one on
  // screen (until 13 Nov 2026 it waited for Enter or blur).
  const [draft, setDraft] = useState<string | null>(null);

  const fields = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  const expression = liveExpression(draft, fields);

  const handleFieldChange = (field: string, value: string) => {
    setDraft(null);
    switch (field) {
      case 'minute': setMinute(value); break;
      case 'hour': setHour(value); break;
      case 'dayOfMonth': setDayOfMonth(value); break;
      case 'month': setMonth(value); break;
      case 'dayOfWeek': setDayOfWeek(value); break;
    }
  };

  const handlePresetSelect = (expr: string) => {
    setDraft(null);
    applyLine(expr);
  };

  const applyLine = (expr: string) => {
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

  // Type or paste a whole line ("*/15 2 * * 0") into the big field and it splits
  // itself on every keystroke; a line that is not five fields yet leaves the fields
  // below alone and the sentence says what is missing.
  const handleWhole = (text: string) => {
    setDraft(text);
    applyLine(text);
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
            whole={draft ?? fields}
            onChange={handleFieldChange} onWhole={handleWhole} onWholeDone={() => setDraft(null)} explainer={<CronExplainer expression={expression} />} />
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
