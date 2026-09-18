/**
 * The render loop: one full re-render from `AppState`, every time.
 *
 * There is no diffing and no partial update. The page is a pure function of the
 * state, so there is no path where a stale corner of the DOM disagrees with the
 * log — which is the class of bug that lets a streak on screen be wrong.
 *
 * Two things must survive that rebuild, and both are why `mount` exists
 * separately from `render`:
 *
 * - **Focus.** Replacing the button a keyboard user just pressed would drop
 *   focus to the body after every mark. `render` puts it back.
 * - **The live region.** An element that is replaced on every render cannot
 *   reliably announce anything, so the announcer is built once and only ever has
 *   its text changed.
 */

import type { DateKey } from '../domain/dates';
import type { AppState, HabitId } from '../domain/model';
import type { SaveFailure, StoreStatus } from '../storage/localStore';
import { el } from './dom';
import { headerDate } from './labels';
import { notices } from './notices';
import { todayCard } from './todayCard';

/** The parts of the page `render` writes into. Built once by `mount`. */
export interface AppRegions {
  readonly root: HTMLElement;
  readonly notices: HTMLElement;
  readonly today: HTMLElement;
  readonly hint: HTMLElement;
  /** Built once and never replaced, so what it says is actually announced. */
  readonly announcer: HTMLElement;
}

/** Everything the page shows, in one value. */
export interface AppView {
  readonly state: AppState;
  readonly today: DateKey;
  readonly status: StoreStatus;
  readonly saveFailure: SaveFailure | null;
}

/**
 * Builds the page skeleton and returns the regions `render` fills.
 *
 * The date is written once: `today` is resolved at startup and does not change
 * while the page is open.
 */
export function mount(root: HTMLElement, today: DateKey): AppRegions {
  const noticeRegion = el('div', { class: 'app__notices' });
  const habits = el('div', { class: 'app__today' });
  const hint = el('div', { class: 'app__hint' });
  const announcer = el('p', {
    class: 'sr-only',
    role: 'status',
    'aria-live': 'polite',
  });

  root.replaceChildren(
    el('main', { class: 'app' }, [
      el('header', { class: 'app__header' }, [
        el('h1', { class: 'app__title' }, ['Habits']),
        el('p', { class: 'app__date' }, [
          el('time', { datetime: today }, [headerDate(today)]),
        ]),
      ]),
      noticeRegion,
      el('section', { class: 'card' }, [
        el('h2', { class: 'card__title' }, ['Today']),
        hint,
        habits,
      ]),
      announcer,
    ]),
  );

  return { root, notices: noticeRegion, today: habits, hint, announcer };
}

/** The habit id of the toggle holding focus, if one does. */
function focusedToggle(root: HTMLElement): string | null {
  const active = document.activeElement;

  if (!(active instanceof HTMLElement) || !root.contains(active)) {
    return null;
  }

  return active.closest('[data-toggle]')?.getAttribute('data-toggle') ?? null;
}

/**
 * The first-run invitation.
 *
 * Shown while nothing at all has been logged, and gone the moment something is —
 * one line, no modal, no onboarding to dismiss.
 */
function startHint(state: AppState): readonly HTMLElement[] {
  const empty = Object.values(state.log).every((days) => days.length === 0);

  return empty ? [el('p', { class: 'hint' }, ['Start by marking today.'])] : [];
}

/** Redraws the page from `view`. Safe to call repeatedly; the result is the same. */
export function render(
  regions: AppRegions,
  view: AppView,
  onToggle: (habitId: HabitId) => void,
): void {
  const refocus = focusedToggle(regions.root);

  regions.notices.replaceChildren(...notices(view.status, view.saveFailure));
  regions.hint.replaceChildren(...startHint(view.state));
  regions.today.replaceChildren(todayCard(view.state, view.today, onToggle));

  if (refocus !== null) {
    regions.root.querySelector<HTMLElement>(`[data-toggle="${refocus}"]`)?.focus();
  }
}

/** Says `message` in the live region. */
export function announce(regions: AppRegions, message: string): void {
  regions.announcer.textContent = message;
}
