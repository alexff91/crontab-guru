import { useState } from 'react';
import CronBuilder from './components/CronBuilder';
import CronExplainer from './components/CronExplainer';
import NextRuns from './components/NextRuns';
import Presets from './components/Presets';
import { parseCronExpression } from './utils/cron-parser';

function App() {
  const [minute, setMinute] = useState('*');
  const [hour, setHour] = useState('*');
  const [dayOfMonth, setDayOfMonth] = useState('*');
  const [month, setMonth] = useState('*');
  const [dayOfWeek, setDayOfWeek] = useState('*');

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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">
            <span className="text-amber-400">*</span> Crontab Guru
          </h1>
          <p className="text-gray-500 text-sm mt-1">Cron Expression Builder &amp; Explainer</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <CronBuilder
            minute={minute}
            hour={hour}
            dayOfMonth={dayOfMonth}
            month={month}
            dayOfWeek={dayOfWeek}
            onChange={handleFieldChange}
          />
        </div>

        <CronExplainer expression={expression} />
        <NextRuns expression={expression} />
        <Presets onSelect={handlePresetSelect} currentExpression={expression} />
      </main>

      <footer className="border-t border-gray-800 mt-12 py-6 text-center text-gray-600 text-sm">
        Crontab Guru &mdash; Build and understand cron expressions
      </footer>
    </div>
  );
}

export default App;
