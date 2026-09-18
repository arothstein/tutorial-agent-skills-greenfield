import {
  addDays,
  daysInclusive,
  mondayOf,
  sundayOf,
  weeksInclusive,
  type DateKey,
} from './dates';

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

/** Distinct logged days in `first`..`last`; duplicate entries count once (D1). */
function daysLogged(completed: ReadonlySet<DateKey>, first: DateKey, last: DateKey): number {
  return daysInclusive(first, last).filter((day) => completed.has(day)).length;
}

/**
 * Scored periods for a weekly habit, oldest first.
 *
 * One period per Mon-Sun week, from the week containing `startedOn` through the
 * last closed Sunday. A week hits when it holds at least `target` distinct
 * logged days -- a fixed calendar week, never a rolling 7-day window.
 *
 * The current week is open and is appended only when it already reaches
 * `target` (D2): hitting three sessions on Thursday ticks the streak up at once,
 * while a week still owing sessions is never a miss. The open week is scored
 * from `startedOn`'s Monday through today only, so a stray entry dated later in
 * the week cannot promote it.
 *
 * A first weekly period is the whole week containing `startedOn`, not the days
 * from `startedOn` onward: the week is the unit being scored.
 */
export function weeklyPeriods(
  log: readonly DateKey[],
  target: number,
  startedOn: DateKey,
  today: DateKey,
): readonly Period[] {
  const completed = new Set(log);
  const openWeek = mondayOf(today);

  const periods: Period[] = weeksInclusive(startedOn, addDays(openWeek, -1)).map((monday) => ({
    hit: daysLogged(completed, monday, sundayOf(monday)) >= target,
  }));

  if (daysLogged(completed, openWeek, today) >= target) {
    periods.push({ hit: true });
  }

  return periods;
}
