/**
 * Every string the UI shows, as pure functions over already-computed values.
 *
 * Kept out of the DOM modules so the wording — which is the product's tone, not
 * decoration — is asserted directly. "11 days, one miss" rather than "streak
 * broken" is the difference between an app that gets opened in month three and
 * one that does not.
 */

import { weekdayOf, type DateKey } from '../domain/dates';
import type { Habit } from '../domain/model';
import type { OpenWeek } from '../domain/periods';
import type { StreakResult } from '../domain/streak';

/** Small counts read as words; past that, digits are clearer than prose. */
const MISS_WORDS = ['no', 'one', 'two', 'three'] as const;

/**
 * The forgiveness annotation, e.g. `, one miss`.
 *
 * Empty for a clean streak. Never phrased as a failure: it reports what the
 * count already survived.
 */
export function missAnnotation(misses: number): string {
  if (misses === 0) {
    return '';
  }

  const word = MISS_WORDS[misses] ?? `${misses}`;

  return `, ${word} ${misses === 1 ? 'miss' : 'misses'}`;
}

/** `day`/`days` or `week`/`weeks`, so a week count never reads as days (AC1). */
export function unitWord(unit: StreakResult['unit'], count: number): string {
  const singular = unit === 'days' ? 'day' : 'week';

  return count === 1 ? singular : `${singular}s`;
}

/**
 * The streak readout: `12 days`, `11 days, one miss`, `6 weeks`, or `0`.
 *
 * Zero drops the unit and stands alone. "0 days" invites reading the number as a
 * measure of how badly it went; a bare `0` is just where the next streak starts.
 */
export function streakSummary(streak: StreakResult): string {
  if (streak.count === 0) {
    return '0';
  }

  return `${streak.count} ${unitWord(streak.unit, streak.count)}${missAnnotation(streak.misses)}`;
}

/** What the open week has banked, e.g. `2 of 3 this week`. */
export function weekProgressText(week: OpenWeek): string {
  return `${week.logged} of ${week.target} this week`;
}

/** Days still usable this week, today included. */
export function daysLeftText(week: OpenWeek): string {
  return `${week.daysLeft} ${week.daysLeft === 1 ? 'day' : 'days'} left`;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * The date in the page header, e.g. `Thu 17 Sep 2026`.
 *
 * Spelled out from lookup tables rather than `Intl.DateTimeFormat` so the output
 * is identical on every machine that runs the tests. There is one locale by
 * design (SPEC Non-Goals #14), so a formatter that varies with the host's is
 * a liability, not a feature.
 */
export function headerDate(key: DateKey): string {
  const weekday = WEEKDAYS[weekdayOf(key) - 1] ?? '';
  const month = MONTHS[Number(key.slice(5, 7)) - 1] ?? '';

  // Unpadded: "6 Sep" reads as a date, "06 Sep" reads as a filename.
  return `${weekday} ${Number(key.slice(8, 10))} ${month} ${key.slice(0, 4)}`;
}

/**
 * What a screen reader hears after a toggle.
 *
 * A full re-render is silent to assistive technology, so the change and its
 * consequence are spoken here or not at all. Un-marking is announced as a
 * correction, never as a loss.
 */
export function toggleAnnouncement(
  habitName: string,
  isLogged: boolean,
  streak: StreakResult,
): string {
  const change = isLogged ? 'marked done for today' : 'no longer marked for today';

  return `${habitName} ${change}. Streak ${streakSummary(streak)}.`;
}

/**
 * What the toggle says, in the habit's own terms.
 *
 * A lifting session is logged, a walk is marked done. The wording is per cadence
 * rather than per habit so a fourth habit could not arrive without one.
 */
export function toggleLabel(habit: Habit, isLogged: boolean): string {
  if (habit.cadence === 'weekly') {
    return isLogged ? 'Logged today' : 'Log session';
  }

  return isLogged ? 'Done today' : 'Mark done';
}
