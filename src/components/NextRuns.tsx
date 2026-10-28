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
    <section>
      <h2 className="wb-h2">Next {WANTED} runs</h2>

      {error ? (
        <div className="wb-error">{error}</div>
      ) : (
        <>
          {runs.length === 0 ? (
            <p className="wb-note">
              This schedule never runs: no matching date exists in the next {result?.horizonYears} years.
              A day-of-month that the chosen months never have (30 February, 31 April) does this.
            </p>
          ) : (
            <>
              <ul className="wb-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {runs.map((run, i) => (
                  <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                    <span className="wb-mono" style={{ color: 'var(--dim)', fontSize: 12, width: 18 }}>{i + 1}</span>
                    <span className="wb-mono" style={{ fontSize: 15 }}>{formatDate(run)}</span>
                  </li>
                ))}
              </ul>

              {foundFewer && (
                <p className="wb-note" style={{ marginTop: 10 }}>
                  Only {runs.length} run{runs.length === 1 ? '' : 's'} found — the search stops
                  after {result?.horizonYears} years.
                </p>
              )}

              <p className="wb-mono" style={{ color: 'var(--soft)', fontSize: 12, marginTop: 10 }}>
                Local time, {timeZone}. Your server may run on a different timezone.
              </p>

              {result?.dayRule === 'or' && (
                <p className="wb-note" style={{ marginTop: 8 }}>
                  Day-of-month and day-of-week are both restricted, so these times are the union of the two:
                  cron fires when either matches.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
