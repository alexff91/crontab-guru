import type { ReactNode } from 'react';

interface CronBuilderProps {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  onChange: (field: string, value: string) => void;
  onWhole?: (text: string) => void;
  explainer?: ReactNode;
}

const minuteOptions = ['*', '*/5', '*/10', '*/15', '*/30', ...Array.from({ length: 60 }, (_, i) => String(i))];
const hourOptions = ['*', '*/2', '*/3', '*/4', '*/6', '*/12', ...Array.from({ length: 24 }, (_, i) => String(i))];
const domOptions = ['*', ...Array.from({ length: 31 }, (_, i) => String(i + 1))];
const monthOptions = ['*', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const monthLabels: Record<string, string> = {
  '*': 'Every month', '1': 'January', '2': 'February', '3': 'March',
  '4': 'April', '5': 'May', '6': 'June', '7': 'July',
  '8': 'August', '9': 'September', '10': 'October', '11': 'November', '12': 'December',
};
const dowOptions = ['*', '0', '1', '2', '3', '4', '5', '6', '1-5'];
const dowLabels: Record<string, string> = {
  '*': 'Every day', '0': 'Sunday', '1': 'Monday', '2': 'Tuesday',
  '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday', '1-5': 'Weekdays (Mon-Fri)',
};

function FieldSelect({ label, value, options, labelMap, onChange }: {
  label: string;
  value: string;
  options: string[];
  labelMap?: Record<string, string>;
  onChange: (val: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label className="wb-label" style={{ margin: 0 }}>{label}</label>
      <input type="text" className="wb-field" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 18, fontWeight: 500, textAlign: 'center' }} spellCheck={false} aria-label={`${label} — type`} />
      <select className="wb-field" style={{ padding: '9px 8px', fontSize: 13 }} value={options.includes(value) ? value : ''} onChange={(e) => onChange(e.target.value)} aria-label={`${label} — pick`}>
        {!options.includes(value) && <option value="">{value} (custom)</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>{labelMap ? labelMap[opt] || opt : opt}</option>
        ))}
      </select>
    </div>
  );
}

export default function CronBuilder({ minute, hour, dayOfMonth, month, dayOfWeek, onChange, onWhole, explainer }: CronBuilderProps) {
  const expression = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  return (
    <div className="wb-stack">
      <section className="wb-slab">
        <label className="wb-label" htmlFor="whole">Expression — paste a whole line or edit below</label>
        <input id="whole" key={expression} defaultValue={expression} onBlur={(e) => onWhole?.(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onWhole?.((e.target as HTMLInputElement).value); }}
          style={{ fontSize: 'clamp(28px, 6vw, 46px)', letterSpacing: '.08em' }} spellCheck={false} />
        <div style={{ marginTop: 14, minHeight: 40 }}>{explainer}</div>
        <div className="wb-row" style={{ marginTop: 12 }}>
          <button className="wb-btn acc" onClick={() => navigator.clipboard.writeText(expression)}>Copy expression</button>
        </div>
      </section>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <FieldSelect label="Minute" value={minute} options={minuteOptions} onChange={(v) => onChange('minute', v)} />
        <FieldSelect label="Hour" value={hour} options={hourOptions} onChange={(v) => onChange('hour', v)} />
        <FieldSelect label="Day of month" value={dayOfMonth} options={domOptions} onChange={(v) => onChange('dayOfMonth', v)} />
        <FieldSelect label="Month" value={month} options={monthOptions} labelMap={monthLabels} onChange={(v) => onChange('month', v)} />
        <FieldSelect label="Day of week" value={dayOfWeek} options={dowOptions} labelMap={dowLabels} onChange={(v) => onChange('dayOfWeek', v)} />
      </div>
    </div>
  );
}
