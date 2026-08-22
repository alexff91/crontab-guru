import { getNextRunsDetailed, type NextRunsResult } from '../utils/cron-parser';

interface NextRunsProps {
  expression: string;
}

const WANTED = 5;

export default function NextRuns({ expression }: NextRunsProps) {
  let result: NextRunsResult | null = null;
  let error = '';

  try {
    result = getNextRunsDetailed(expression, WANTED);
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

  // Времена считаются по часам браузера. Пока это не написано, пользователь
  // вправе прочитать их как UTC или как время своего сервера — и ошибиться.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const runs = result?.runs ?? [];
  const foundFewer = result !== null && runs.length < WANTED;

  return (
    <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">
        Next {WANTED} Execution Times
      </h3>

      {error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <>
          {runs.length === 0 ? (
            <p className="text-amber-300 text-sm">
              This schedule never runs: no matching date exists in the next {result?.horizonYears} years.
              A day-of-month that the chosen months never have (30 February, 31 April) does this.
            </p>
          ) : (
            <>
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

              {foundFewer && (
                <p className="text-amber-300 text-sm mt-3">
                  Only {runs.length} run{runs.length === 1 ? '' : 's'} found — the search stops
                  after {result?.horizonYears} years.
                </p>
              )}

              <p className="text-gray-500 text-xs mt-3">
                Local time, {timeZone}. Your server may run on a different timezone.
              </p>

              {result?.dayRule === 'or' && (
                <p className="text-amber-300/90 text-xs mt-2 leading-relaxed">
                  Day-of-month and day-of-week are both restricted, so these times are the union of the two:
                  cron fires when either matches.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
