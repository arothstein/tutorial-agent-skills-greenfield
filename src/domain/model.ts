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

/** Whether `habitId` was completed on `day`. Presence in the log is the record. */
export function isLogged(state: AppState, habitId: HabitId, day: DateKey): boolean {
  return state.log[habitId].includes(day);
}

/**
 * Logs `day` for `habitId`, or un-logs it if it was already there (D1).
 *
 * A toggle over a calendar day, not an append: a double tap is harmless and
 * "3x per week" means three distinct days. The returned log stays sorted and
 * duplicate-free — the invariant `localStore` writes and validates against.
 *
 * `startedOn` is deliberately left alone in both directions. Pulling it back to
 * a back-filled older day is tempting, but it does not undo: un-toggling that
 * same day would leave the walk starting earlier than the user ever tracked,
 * turning every day before it into a miss. An accidental click would reset a
 * streak, which is the one thing this app must never do. Where the walk starts
 * when the history strip back-fills past it is that task's decision to make.
 */
export function toggleDay(state: AppState, habitId: HabitId, day: DateKey): AppState {
  const logged = state.log[habitId];

  // Zero-padded keys sort lexicographically in calendar order, so the default
  // comparator is the right one here.
  const next = logged.includes(day)
    ? logged.filter((entry) => entry !== day)
    : [...logged, day].sort();

  return { ...state, log: { ...state.log, [habitId]: next } };
}
