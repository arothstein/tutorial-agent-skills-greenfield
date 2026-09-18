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

export function addDays(key: DateKey, days: number): DateKey {
  const date = atNoon(key);
  date.setDate(date.getDate() + days);

  return toDateKey(date);
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
 * Monday of the Mon–Sun week containing `key`.
 *
 * `getDay()` numbers Sunday 0, which would make Sunday the *start* of a week;
 * SPEC's lifting week closes on Sunday, so Sunday is renumbered 7.
 */
export function mondayOf(key: DateKey): DateKey {
  const weekday = atNoon(key).getDay() || 7;

  return addDays(key, 1 - weekday);
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
