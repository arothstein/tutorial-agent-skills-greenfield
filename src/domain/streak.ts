import type { DateKey } from './dates';
import { dailyPeriods, type Period } from './periods';

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
