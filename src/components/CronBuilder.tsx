interface CronBuilderProps {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  onChange: (field: string, value: string) => void;
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
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</label>
      {/* On a phone the control is a finger target: 44px tall, 16px type so
          iOS does not zoom the page on focus. Wider screens keep the old size. */}
      <select
        value={options.includes(value) ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 text-white rounded-lg px-3 py-2.5 border border-gray-700 focus:border-blue-500 focus:outline-none min-h-11 text-base sm:min-h-0 sm:text-sm"
      >
        {!options.includes(value) && <option value="">{value} (custom)</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labelMap ? labelMap[opt] || opt : opt}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 text-gray-300 font-mono px-3 py-1.5 rounded border border-gray-700 focus:border-blue-500 focus:outline-none min-h-11 text-base sm:min-h-0 sm:text-xs"
        placeholder="or type..."
      />
    </div>
  );
}

export default function CronBuilder({ minute, hour, dayOfMonth, month, dayOfWeek, onChange }: CronBuilderProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="font-mono text-2xl text-center text-green-400 tracking-widest mb-4">
          {minute} {hour} {dayOfMonth} {month} {dayOfWeek}
        </div>
        <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
          <span className="px-2">min</span>
          <span className="px-2">hour</span>
          <span className="px-2">day</span>
          <span className="px-2">month</span>
          <span className="px-2">weekday</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <FieldSelect label="Minute" value={minute} options={minuteOptions} onChange={(v) => onChange('minute', v)} />
        <FieldSelect label="Hour" value={hour} options={hourOptions} onChange={(v) => onChange('hour', v)} />
        <FieldSelect label="Day of Month" value={dayOfMonth} options={domOptions} onChange={(v) => onChange('dayOfMonth', v)} />
        <FieldSelect label="Month" value={month} options={monthOptions} labelMap={monthLabels} onChange={(v) => onChange('month', v)} />
        <FieldSelect label="Day of Week" value={dayOfWeek} options={dowOptions} labelMap={dowLabels} onChange={(v) => onChange('dayOfWeek', v)} />
      </div>
      <button
        onClick={() => navigator.clipboard.writeText(`${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`)}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors min-h-11 sm:min-h-0"
      >
        Copy Expression
      </button>
    </div>
  );
}
