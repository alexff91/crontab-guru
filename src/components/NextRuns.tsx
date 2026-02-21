import { getNextRuns } from '../utils/cron-parser';

interface NextRunsProps {
  expression: string;
}

export default function NextRuns({ expression }: NextRunsProps) {
  let runs: Date[] = [];
  let error = '';

  try {
    runs = getNextRuns(expression, 5);
  } catch (e) {
    error = (e as Error).message;
  }

  const formatDate = (d: Date) => {
    return d.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Next 5 Execution Times</h3>
      {error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : runs.length === 0 ? (
        <p className="text-gray-500 text-sm">No upcoming runs found within the next year</p>
      ) : (
        <ul className="space-y-2">
          {runs.map((run, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="text-gray-300 font-mono text-sm">{formatDate(run)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
