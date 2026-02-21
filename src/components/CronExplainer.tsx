import { explainCron } from '../utils/cron-parser';

interface CronExplainerProps {
  expression: string;
}

export default function CronExplainer({ expression }: CronExplainerProps) {
  let explanation: string;
  try {
    explanation = explainCron(expression);
  } catch (e) {
    explanation = (e as Error).message;
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Human-Readable</h3>
      <p className="text-lg text-blue-300 font-medium">{explanation}</p>
    </div>
  );
}
