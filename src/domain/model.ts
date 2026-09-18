import type { DateKey } from './dates';

/**
 * `DateKey` is declared by `dates.ts`, the module that actually does calendar
 * arithmetic, and re-exported here so the model layer reads as one import.
 */
export type { DateKey };

/**
 * The three habits are fixed in code (SPEC Non-Goals #5). Adding an id here
 * without defining it in `habits.ts` fails `pnpm run typecheck`.
 */
export type HabitId = 'lifting' | 'walking' | 'no-snacking';

export type Cadence = 'daily' | 'weekly';

export interface Habit {
  readonly id: HabitId;
  readonly name: string;
  readonly cadence: Cadence;
  /** Logged days needed to hit one period: 1 per day, or 3 per Mon–Sun week. */
  readonly target: number;
}

/**
 * The persisted document.
 *
 * Presence in `log` means done; absence means not done. There is no `false`,
 * and nothing derived — streaks, miss counts and weekly progress are recomputed
 * from `log` on every render, so a stored value can never disagree with it.
 */
export interface AppState {
  readonly schemaVersion: 1;
  readonly log: Readonly<Record<HabitId, readonly DateKey[]>>;
  /** First date the tracker was used. Streaks are never evaluated before this. */
  readonly startedOn: DateKey;
}

/**
 * First-run seed. Pure: it returns a value and writes nothing, so the app can
 * render a first run without committing anything to storage until the user's
 * first real mutation (AC6).
 */
export function emptyState(today: DateKey): AppState {
  return {
    schemaVersion: 1,
    log: {
      lifting: [],
      walking: [],
      'no-snacking': [],
    },
    startedOn: today,
  };
}
