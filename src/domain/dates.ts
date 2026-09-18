/** Local calendar date, 'YYYY-MM-DD'. Never a UTC ISO timestamp. */
export type DateKey = string;

/**
 * Formats a date from its local components.
 *
 * `toISOString()` would be shorter and wrong: it renders the UTC instant, which
 * is a different calendar day for most of the evening in western timezones.
 */
export function toDateKey(date: Date): DateKey {
  const year = `${date.getFullYear()}`.padStart(4, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Local noon on the given date.
 *
 * Day arithmetic anchors at noon so a 23- or 25-hour DST day cannot push the
 * result over midnight and skip or repeat a date.
 */
function atNoon(key: DateKey): Date {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));

  return new Date(year, month - 1, day, 12);
}

/** Shape of a date key. Real-calendar validity is `isDateKey`'s job. */
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when `value` is a real local calendar date written 'YYYY-MM-DD'.
 *
 * The guard every date read from outside the app — `localStorage`, an imported
 * backup — passes through before it reaches the streak walk.
 *
 * A regex alone is not enough: `new Date(2026, 1, 29)` rolls forward to 1 March
 * rather than failing, so '2026-02-29' would sail through and then score a day
 * the user never logged. Formatting the parsed date back out and comparing is
 * what catches it.
 *
 * Years under 100 are rejected as a consequence, since `new Date` maps 0-99 to
 * 1900-1999. Nothing was tracked in the year 26.
 */
export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  return toDateKey(atNoon(value)) === value;
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = atNoon(key);
  date.setDate(date.getDate() + days);

  return toDateKey(date);
}

/** Milliseconds in a 24-hour day. Only ever used against noon-anchored dates. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from `from` to `to`; negative when `to` is earlier.
 *
 * Both ends anchor at noon, so a 23- or 25-hour DST day leaves the quotient
 * within half a day of the true count and `Math.round` recovers it.
 *
 * This is a span, not a countdown: the Thursday-to-Sunday span is 3, while the
 * "4 days left" the lifting row shows counts today too. Add one at the call
 * site rather than bending this.
 */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((atNoon(to).getTime() - atNoon(from).getTime()) / ONE_DAY_MS);
}

/**
 * Every date from `first` through `last`, oldest first. Empty when `last`
 * precedes `first`.
 */
export function daysInclusive(first: DateKey, last: DateKey): readonly DateKey[] {
  const days: DateKey[] = [];

  // Zero-padded keys sort lexicographically in calendar order, so `<=` is a
  // correct date comparison here.
  for (let key = first; key <= last; key = addDays(key, 1)) {
    days.push(key);
  }

  return days;
}

/**
 * Weekday of `key`: Monday 1 through Sunday 7.
 *
 * `getDay()` numbers Sunday 0, which would make Sunday the *start* of a week;
 * SPEC's lifting week closes on Sunday, so Sunday is renumbered 7.
 */
export function weekdayOf(key: DateKey): number {
  return atNoon(key).getDay() || 7;
}

/** Monday of the Mon–Sun week containing `key`. */
export function mondayOf(key: DateKey): DateKey {
  return addDays(key, 1 - weekdayOf(key));
}

/** Sunday that closes the Mon–Sun week containing `key`. */
export function sundayOf(key: DateKey): DateKey {
  return addDays(mondayOf(key), 6);
}

/**
 * Monday of every week from the week containing `first` through the week
 * containing `last`, oldest first. Empty when `last` precedes that first week.
 */
export function weeksInclusive(first: DateKey, last: DateKey): readonly DateKey[] {
  const weeks: DateKey[] = [];

  // As in `daysInclusive`, zero-padded keys compare in calendar order. A week
  // is included when its Monday falls on or before `last`, so a partial final
  // week still appears.
  for (let week = mondayOf(first); week <= last; week = addDays(week, 7)) {
    weeks.push(week);
  }

  return weeks;
}
