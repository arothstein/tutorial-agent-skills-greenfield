import { addDays, daysInclusive, type DateKey } from './dates';

/** One already-scored period of a streak walk. */
export interface Period {
  readonly hit: boolean;
}

/**
 * Scored days for a daily habit, oldest first.
 *
 * Runs from `startedOn` through the last closed day (yesterday), plus today —
 * but today is appended only when it is already logged. An unfinished day is
 * never a miss.
 */
export function dailyPeriods(
  log: readonly DateKey[],
  startedOn: DateKey,
  today: DateKey,
): readonly Period[] {
  const completed = new Set(log);

  const periods: Period[] = daysInclusive(startedOn, addDays(today, -1)).map((day) => ({
    hit: completed.has(day),
  }));

  if (completed.has(today)) {
    periods.push({ hit: true });
  }

  return periods;
}
