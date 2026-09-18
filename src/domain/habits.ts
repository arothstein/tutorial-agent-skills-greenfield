import type { Habit, HabitId } from './model';

/**
 * Every habit, keyed by id.
 *
 * `Record<HabitId, Habit>` is what enforces the fixed-habit invariant: adding
 * an id to `HabitId` without defining it here is a type error, not a convention
 * someone has to remember.
 */
const BY_ID: Readonly<Record<HabitId, Habit>> = Object.freeze({
  walking: Object.freeze({ id: 'walking', name: 'Walking', cadence: 'daily', target: 1 }),
  'no-snacking': Object.freeze({
    id: 'no-snacking',
    name: 'Not snacking',
    cadence: 'daily',
    target: 1,
  }),
  lifting: Object.freeze({ id: 'lifting', name: 'Lifting weights', cadence: 'weekly', target: 3 }),
});

/** In the order the Today card renders them (SPEC "Screens and States"). */
export const HABITS: readonly [Habit, Habit, Habit] = Object.freeze([
  BY_ID.walking,
  BY_ID['no-snacking'],
  BY_ID.lifting,
]);

export function habitById(id: HabitId): Habit {
  return BY_ID[id];
}
