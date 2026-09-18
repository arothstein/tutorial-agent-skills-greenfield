import { describe, expect, it } from 'vitest';

import {
  addDays,
  daysBetween,
  daysInclusive,
  mondayOf,
  sundayOf,
  toDateKey,
  weeksInclusive,
} from '../src/domain/dates';

describe('toDateKey', () => {
  it('formats from local components, not the UTC instant', () => {
    // 23:30 local on the 17th is already the 18th in UTC; toISOString would say '2026-09-18'.
    expect(toDateKey(new Date(2026, 8, 17, 23, 30))).toBe('2026-09-17');
  });

  it('pads month and day to two digits', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('steps backwards', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('survives a spring-forward DST transition', () => {
    // 2026-03-08 is a 23-hour day in US locales; naive +24h arithmetic repeats a date.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('survives a fall-back DST transition', () => {
    // 2026-11-01 is a 25-hour day; naive +24h arithmetic skips a date.
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('daysInclusive', () => {
  it('returns every date from first to last, inclusive', () => {
    expect(daysInclusive('2026-09-15', '2026-09-18')).toEqual([
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ]);
  });

  it('returns a single day when both ends are the same date', () => {
    expect(daysInclusive('2026-09-15', '2026-09-15')).toEqual(['2026-09-15']);
  });

  it('returns nothing when the last date precedes the first', () => {
    expect(daysInclusive('2026-09-15', '2026-09-14')).toEqual([]);
  });
});

describe('mondayOf', () => {
  it('walks back to the Monday of a mid-week date', () => {
    expect(mondayOf('2026-09-17')).toBe('2026-09-14');
  });

  it('returns the date itself when it is already a Monday', () => {
    expect(mondayOf('2026-09-14')).toBe('2026-09-14');
  });

  it('treats Sunday as the last day of the week, not the first', () => {
    // The Sunday→Monday rollover: 09-20 belongs to the week that began 09-14,
    // and 09-21 starts a new one. A Sunday-first week would report 09-20.
    expect(mondayOf('2026-09-20')).toBe('2026-09-14');
    expect(mondayOf('2026-09-21')).toBe('2026-09-21');
  });

  it('crosses a month boundary', () => {
    expect(mondayOf('2026-09-01')).toBe('2026-08-31');
  });

  it('crosses a year boundary', () => {
    expect(mondayOf('2027-01-03')).toBe('2026-12-28');
  });

  it('survives a fall-back DST Sunday', () => {
    // 2026-11-01 is a 25-hour day in US locales.
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
  });
});

describe('sundayOf', () => {
  it('walks forward to the Sunday that closes the week', () => {
    expect(sundayOf('2026-09-17')).toBe('2026-09-20');
  });

  it('returns the date itself when it is already a Sunday', () => {
    expect(sundayOf('2026-09-20')).toBe('2026-09-20');
  });

  it('closes a week that spans a leap day', () => {
    expect(sundayOf('2028-02-28')).toBe('2028-03-05');
  });

  it('survives a spring-forward DST week', () => {
    // 2026-03-08 is a 23-hour day in US locales.
    expect(sundayOf('2026-03-02')).toBe('2026-03-08');
  });
});

describe('weeksInclusive', () => {
  it('returns the Monday of every week from the first date through the last', () => {
    expect(weeksInclusive('2026-09-17', '2026-10-01')).toEqual([
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
  });

  it('returns a single week when both dates fall inside it', () => {
    expect(weeksInclusive('2026-09-14', '2026-09-20')).toEqual(['2026-09-14']);
  });

  it('returns nothing when the last date precedes the first week', () => {
    expect(weeksInclusive('2026-09-14', '2026-09-13')).toEqual([]);
  });

  it('steps across a year boundary', () => {
    expect(weeksInclusive('2026-12-28', '2027-01-04')).toEqual(['2026-12-28', '2027-01-04']);
  });
});

describe('daysBetween', () => {
  it('is zero for the same date', () => {
    expect(daysBetween('2026-09-17', '2026-09-17')).toBe(0);
  });

  it('counts forward to a later date', () => {
    // Thursday to the Sunday that closes its week.
    expect(daysBetween('2026-09-17', '2026-09-20')).toBe(3);
  });

  it('is negative when the second date is earlier', () => {
    expect(daysBetween('2026-09-20', '2026-09-17')).toBe(-3);
  });

  it('counts across a month boundary', () => {
    expect(daysBetween('2026-08-30', '2026-09-02')).toBe(3);
  });

  it('counts across a year boundary', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('counts a span containing a leap day', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('survives a span containing a spring-forward 23-hour day', () => {
    // Dividing elapsed milliseconds by 24h would give 1.96 here, not 2.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('survives a span containing a fall-back 25-hour day', () => {
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});
