/**
 * The app, assembled: storage -> state -> render, and one path back.
 *
 * Everything it needs from the outside world — the root element, today's date,
 * the storage to use — arrives as an argument. `main.ts` is the only module that
 * resolves those from the real environment, which is what lets the whole app run
 * inside a test against a fixed date and a storage that fails on purpose.
 *
 * Mutation has exactly one route: `toggle` changes state, saves, redraws, and
 * announces, in that order. There is no second path that could change state
 * without persisting it, because there is no second path at all.
 */

import type { DateKey } from './domain/dates';
import { habitById } from './domain/habits';
import { isLogged, toggleDay, type AppState, type HabitId } from './domain/model';
import { streakFor } from './domain/streak';
import { openStore, type SaveFailure, type StorageLike } from './storage/localStore';
import { toggleAnnouncement } from './ui/labels';
import { saveFailureSentence } from './ui/notices';
import { announce, mount, render } from './ui/render';

export interface StartOptions {
  readonly root: HTMLElement;
  /** Resolved once, by the caller. Nothing below here reads the clock. */
  readonly today: DateKey;
  /** `null` runs the session in memory, with a banner saying so. */
  readonly storage: StorageLike | null;
  /** Stamps a quarantine key. Injected so a test can pin it. */
  readonly now?: () => number;
}

/**
 * Loads the stored state, draws the page, and wires the toggles.
 *
 * Returns nothing: the page is the output. The state lives in this closure
 * rather than in a module variable so two calls — a test's second render, a
 * second root — cannot see each other's state.
 */
export function startApp({ root, today, storage, now }: StartOptions): void {
  const store = openStore({ today, storage, now });
  const regions = mount(root, today);

  let state: AppState = store.initial;
  let saveFailure: SaveFailure | null = null;

  function draw(): void {
    render(regions, { state, today, status: store.status, saveFailure }, toggle);
  }

  /** What a screen reader hears: the change, its consequence, and any failure. */
  function announcementFor(habitId: HabitId): string {
    const habit = habitById(habitId);
    const streak = streakFor(habit, state.log[habitId], state.startedOn, today);
    const change = toggleAnnouncement(habit.name, isLogged(state, habitId, today), streak);
    const failure = saveFailure === null ? '' : saveFailureSentence(saveFailure);

    return failure === '' ? change : `${change} ${failure}`;
  }

  function toggle(habitId: HabitId): void {
    state = toggleDay(state, habitId, today);

    const result = store.save(state);

    // Cleared on success: a quota failure the user fixed by un-marking a day
    // must not leave its banner on screen.
    saveFailure = result.ok ? null : result.failure;

    draw();
    announce(regions, announcementFor(habitId));
  }

  draw();
}
