import { getPresets } from '../utils/cron-parser';

interface PresetsProps {
  onSelect: (expression: string) => void;
  currentExpression: string;
}

export default function Presets({ onSelect, currentExpression }: PresetsProps) {
  const presets = getPresets();

  return (
    <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Common Presets</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.expression}
            onClick={() => onSelect(preset.expression)}
            className={`text-left px-3 py-2.5 rounded-lg transition-colors ${
              currentExpression === preset.expression
                ? 'bg-blue-600/20 border border-blue-600/50 text-blue-300'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <div className="font-medium text-sm">{preset.label}</div>
            <div className="font-mono text-xs mt-0.5 text-gray-500">{preset.expression}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
