import { getPresets } from '../utils/cron-parser';

interface PresetsProps {
  onSelect: (expression: string) => void;
  currentExpression: string;
}

export default function Presets({ onSelect, currentExpression }: PresetsProps) {
  const presets = getPresets();

  return (
    <section>
      <h2 className="wb-h2">Common schedules</h2>
      <div className="wb-list">
        {presets.map((preset) => (
          <button key={preset.expression} onClick={() => onSelect(preset.expression)} aria-pressed={currentExpression === preset.expression}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%', background: currentExpression === preset.expression ? 'var(--acc)' : 'transparent', border: 0, borderBottom: '1px solid var(--line)', padding: '10px 6px', cursor: 'pointer', textAlign: 'left', color: 'var(--ink)', font: 'inherit' }}>
            <span style={{ fontSize: 15 }}>{preset.label}</span>
            <span className="wb-mono" style={{ fontSize: 13, color: 'var(--soft)' }}>{preset.expression}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
