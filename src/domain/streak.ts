import type { DateKey } from './dates';
import type { Habit } from './model';
import { dailyPeriods, weeklyPeriods, type Period } from './periods';

export interface Streak {
  readonly count: number;
  readonly misses: number;
}

export interface StreakResult extends Streak {
  readonly unit: 'days' | 'weeks';
}

/**
 * Walks scored periods, oldest first.
 *
 * One miss is forgiven: it holds the count instead of zeroing it. Only a second
 * consecutive miss resets. This forgiveness is the product — a single bad day
 * must never wipe out a long streak.
 */
export function computeStreak(periods: readonly Period[]): Streak {
  let count = 0;
  let misses = 0;
  let prevWasMiss = false;

  for (const period of periods) {
    if (period.hit) {
      count += 1;
      prevWasMiss = false;
    } else if (prevWasMiss) {
      count = 0;
      misses = 0;
    } else {
      misses += 1;
      prevWasMiss = true;
    }
  }

  return { count, misses };
}

/**
 * Current streak for a daily habit, in days.
 * Pure: `today` is injected, never read from the clock.
 */
export function dailyStreak(
  log: readonly DateKey[],
  startedOn: DateKey,
  today: DateKey,
): StreakResult {
  return {
    ...computeStreak(dailyPeriods(log, startedOn, today)),
    unit: 'days',
  };
}

/**
 * Current streak for a weekly habit, in Mon-Sun weeks.
 *
 * Same forgiveness rule as the daily walk, applied at week granularity: one
 * short week holds the count, two in a row reset it (AC5).
 * Pure: `today` is injected, never read from the clock.
 */
export function weeklyStreak(
  log: readonly DateKey[],
  target: number,
  startedOn: DateKey,
  today: DateKey,
): StreakResult {
  return {
    ...computeStreak(weeklyPeriods(log, target, startedOn, today)),
    unit: 'weeks',
  };
}

/**
 * Whether the walk has scored anything yet.
 *
 * The difference between "no streak yet" and "a streak that reset": both read
 * `0`, and only one of them should be offered a restart. A habit logged twice
 * this week towards a target of three has scored nothing — its week is still
 * open — so it is starting, not starting again.
 *
 * Asking the period list rather than the log is what makes that exact: the log
 * cannot distinguish an open period from a closed one, and this is the same
 * period list the count is walked over.
 *
 * Pure: `today` is injected, never read from the clock.
 */
export function hasClosedPeriod(
  habit: Habit,
  log: readonly DateKey[],
  startedOn: DateKey,
  today: DateKey,
): boolean {
  const periods =
    habit.cadence === 'daily'
      ? dailyPeriods(log, startedOn, today)
      : weeklyPeriods(log, habit.target, startedOn, today);

  return periods.length > 0;
}

/**
 * Current streak for one habit, in that habit's own unit.
 *
 * Cadence is dispatched on in this module and nowhere else. Everything downstream — the Today
 * card, the history strip — asks for a habit's streak and is handed a count
 * already labelled `days` or `weeks`, so a week count can never be rendered as
 * if it were days (AC1, AC5).
 *
 * A daily habit's target is 1 by definition: presence in the log is the hit, so
 * `dailyStreak` takes no target.
 *
 * Pure: `today` is injected, never read from the clock.
 */
export function streakFor(
  habit: Habit,
  log: readonly DateKey[],
  startedOn: DateKey,
  today: DateKey,
): StreakResult {
  return habit.cadence === 'daily'
    ? dailyStreak(log, startedOn, today)
    : weeklyStreak(log, habit.target, startedOn, today);
}
