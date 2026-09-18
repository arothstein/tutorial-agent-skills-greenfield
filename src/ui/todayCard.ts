/**
 * The three habit rows: a name, a toggle for today, and that habit's own streak.
 *
 * Every number here is recomputed from `state` on each render. Nothing is cached
 * and nothing is stored, so a streak on screen cannot disagree with the log
 * underneath it.
 */

import type { DateKey } from '../domain/dates';
import { HABITS } from '../domain/habits';
import { isLogged, type AppState, type Habit, type HabitId } from '../domain/model';
import { openWeekProgress, type OpenWeek } from '../domain/periods';
import { hasClosedPeriod, streakFor, type StreakResult } from '../domain/streak';
import { el, srOnly, type Child } from './dom';
import {
  daysLeftText,
  missAnnotation,
  toggleLabel,
  unitWord,
  weekProgressText,
} from './labels';

/**
 * The streak readout.
 *
 * The count and its annotation are rendered at the same weight, per SPEC: a
 * smaller or greyer "one miss" would read as a demerit rather than as the
 * forgiveness it is.
 *
 * Built piece by piece rather than from `streakSummary`, which says the same
 * thing in one string, because the count carries the page's only large type and
 * needs an element of its own. The two phrasings are asserted against the same
 * expected text.
 */
function streakLine(streak: StreakResult): HTMLElement {
  const phrase: Child[] =
    streak.count === 0
      ? ['0']
      : [
          el('span', { class: 'streak__count' }, [`${streak.count}`]),
          ' ',
          unitWord(streak.unit, streak.count),
          missAnnotation(streak.misses),
        ];

  return el('p', { class: 'habit__streak' }, [
    srOnly('Streak: '),
    el('span', { 'data-streak': '' }, phrase),
  ]);
}

/**
 * The open week's progress, for lifting only.
 *
 * The pips are decoration over a sentence that already says it: shape and colour
 * are never the only channel carrying the count, so the row reads the same to
 * someone using a screen reader as to someone glancing at it.
 */
function weekLine(week: OpenWeek): HTMLElement {
  const pips = Array.from({ length: week.target }, (_, index) =>
    el('span', { class: index < week.logged ? 'pip pip--filled' : 'pip' }),
  );

  return el('p', { class: 'habit__week' }, [
    el('span', { 'data-pips': '', 'aria-hidden': 'true', class: 'pips' }, pips),
    weekProgressText(week),
    el('span', { class: 'habit__separator', 'aria-hidden': 'true' }, [' · ']),
    srOnly(', '),
    daysLeftText(week),
  ]);
}

/**
 * The one-line nudge under a zeroed streak.
 *
 * A reset is the moment the app is most likely to be abandoned, so it gets an
 * invitation rather than a warning: no red, no "you lost", nothing to feel bad
 * about. Absent entirely while a streak is running.
 *
 * `scored` is what keeps it off a habit that has simply not started: a lifting
 * week two days into its three has a count of zero and nothing to start again.
 */
function resetHint(streak: StreakResult, scored: boolean): readonly Child[] {
  if (streak.count > 0 || !scored) {
    return [];
  }

  return [el('p', { class: 'habit__hint' }, ['Start again today'])];
}

function habitRow(
  habit: Habit,
  state: AppState,
  today: DateKey,
  onToggle: (habitId: HabitId) => void,
): HTMLLIElement {
  const log = state.log[habit.id];
  const streak = streakFor(habit, log, state.startedOn, today);
  const done = isLogged(state, habit.id, today);

  const toggle = el(
    'button',
    {
      type: 'button',
      class: 'toggle',
      'data-toggle': habit.id,
      // The state lives on `aria-pressed`, not in the label alone, so it is
      // announced as a toggle rather than as a button whose text happened to
      // change.
      'aria-pressed': done ? 'true' : 'false',
    },
    [
      el('span', { class: 'toggle__box', 'aria-hidden': 'true' }),
      srOnly(`${habit.name}: `),
      el('span', { class: 'toggle__label' }, [toggleLabel(habit, done)]),
    ],
  );

  toggle.addEventListener('click', () => onToggle(habit.id));

  const week =
    habit.cadence === 'weekly' ? [weekLine(openWeekProgress(log, habit.target, today))] : [];

  return el('li', { class: 'habit', 'data-habit': habit.id }, [
    el('div', { class: 'habit__text' }, [
      el('h3', { class: 'habit__name' }, [habit.name]),
      streakLine(streak),
      ...week,
      ...resetHint(streak, hasClosedPeriod(habit, log, state.startedOn, today)),
    ]),
    toggle,
  ]);
}

/**
 * The habit list.
 *
 * `role="list"` is explicit: removing the bullets with `list-style: none` also
 * removes the list semantics in Safari, and three rows that do not announce as a
 * list of three is a real loss for no styling gain.
 */
export function todayCard(
  state: AppState,
  today: DateKey,
  onToggle: (habitId: HabitId) => void,
): HTMLUListElement {
  return el(
    'ul',
    { class: 'habits', role: 'list' },
    HABITS.map((habit) => habitRow(habit, state, today, onToggle)),
  );
}
