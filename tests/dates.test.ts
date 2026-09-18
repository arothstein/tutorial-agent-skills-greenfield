import { describe, expect, it } from 'vitest';

import { addDays, daysInclusive, toDateKey } from '../src/domain/dates';

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
