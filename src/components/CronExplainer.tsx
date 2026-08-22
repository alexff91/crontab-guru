import { explainCronDetailed } from '../utils/cron-parser';

interface CronExplainerProps {
  expression: string;
}

export default function CronExplainer({ expression }: CronExplainerProps) {
  let summary = '';
  let notes: string[] = [];
  let error = '';

  try {
    const explanation = explainCronDetailed(expression);
    summary = explanation.summary;
    notes = explanation.notes;
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Human-Readable</h3>
      {error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <>
          <p className="text-lg text-blue-300 font-medium">{summary}</p>
          {/* Оговорки показываем отдельно: без них фраза выше была бы неполной правдой. */}
          {notes.map((note, i) => (
            <p key={i} className="text-amber-300/90 text-sm mt-2 leading-relaxed">{note}</p>
          ))}
        </>
      )}
    </div>
  );
}
