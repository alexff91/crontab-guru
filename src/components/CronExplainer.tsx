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
    <div>
      {error ? (
        <p className="wb-mono" style={{ color: '#ff8fa0', fontSize: 14, margin: 0 }}>{error}</p>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 'clamp(20px, 3.4vw, 28px)', lineHeight: 1.25, letterSpacing: '-.02em', color: '#fff', fontWeight: 600 }}>{summary}</p>
          {/* Оговорки показываем отдельно: без них фраза выше была бы неполной правдой. */}
          {notes.map((note, i) => (
            <p key={i} style={{ color: 'var(--acc)', fontSize: 14, margin: '8px 0 0', lineHeight: 1.5 }}>{note}</p>
          ))}
        </>
      )}
    </div>
  );
}
