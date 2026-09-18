import { describe, expect, it } from 'vitest';

import { dailyPeriods, weeklyPeriods } from '../src/domain/periods';

/** Mon 2026-09-14 .. Sun 2026-09-20 is the reference week; 09-17 is a Thursday. */

describe('dailyPeriods — the open-day rule (D2)', () => {
  it('scores one period per day from startedOn through yesterday', () => {
    expect(dailyPeriods(['2026-09-15'], '2026-09-15', '2026-09-17')).toEqual([
      { hit: true },
      { hit: false },
    ]);
  });

  it('leaves today out entirely when it is not logged', () => {
    // Three days have passed but only two are scored: an unfinished day is
    // never a miss.
    expect(dailyPeriods([], '2026-09-15', '2026-09-17')).toEqual([
      { hit: false },
      { hit: false },
    ]);
  });

  it('appends today as a hit the moment it is logged', () => {
    expect(dailyPeriods(['2026-09-17'], '2026-09-17', '2026-09-17')).toEqual([{ hit: true }]);
  });

  it('is empty on the first run with nothing logged', () => {
    expect(dailyPeriods([], '2026-09-17', '2026-09-17')).toEqual([]);
  });
});

describe('weeklyPeriods — closed Mon–Sun weeks', () => {
  it('scores a closed week as a hit when it holds the target number of days', () => {
    const periods = weeklyPeriods(
      ['2026-09-07', '2026-09-09', '2026-09-11'],
      3,
      '2026-09-07',
      '2026-09-17',
    );

    expect(periods).toEqual([{ hit: true }]);
  });

  it('scores a closed week as a miss when it falls short of the target', () => {
    const periods = weeklyPeriods(['2026-09-07', '2026-09-09'], 3, '2026-09-07', '2026-09-17');

    expect(periods).toEqual([{ hit: false }]);
  });

  it('counts a week over target as a hit, not as extra credit', () => {
    const periods = weeklyPeriods(
      ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'],
      3,
      '2026-09-07',
      '2026-09-17',
    );

    expect(periods).toEqual([{ hit: true }]);
  });

  it('cannot be inflated by duplicate entries for the same day (D1)', () => {
    // Three entries but only two distinct days: a day is binary.
    const periods = weeklyPeriods(
      ['2026-09-07', '2026-09-09', '2026-09-07'],
      3,
      '2026-09-07',
      '2026-09-17',
    );

    expect(periods).toEqual([{ hit: false }]);
  });

  it('does not let days spill across the Sunday-to-Monday boundary', () => {
    // Sat + Sun of one week and Mon + Tue of the next: four logged days that
    // form no hit at all. A rolling 7-day window would wrongly score a hit.
    const periods = weeklyPeriods(
      ['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'],
      3,
      '2026-09-07',
      '2026-09-24',
    );

    expect(periods).toEqual([{ hit: false }, { hit: false }]);
  });

  it('starts the first period at the Monday of the week containing startedOn', () => {
    // startedOn is Wed 09-02, so the first period is the week of Mon 08-31 —
    // two periods through the last closed Sunday (09-13), not three.
    const periods = weeklyPeriods(
      ['2026-09-02', '2026-09-03', '2026-09-04'],
      3,
      '2026-09-02',
      '2026-09-14',
    );

    expect(periods).toEqual([{ hit: true }, { hit: false }]);
  });

  it('steps across a year boundary', () => {
    const periods = weeklyPeriods(
      ['2026-12-28', '2026-12-30', '2027-01-01'],
      3,
      '2026-12-28',
      '2027-01-06',
    );

    expect(periods).toEqual([{ hit: true }]);
  });
});

describe('weeklyPeriods — the open week (D2)', () => {
  it('appends the open week as a hit the moment it reaches the target', () => {
    // Today is Thu 09-17 and Mon/Tue/Wed are logged. Hitting the target should
    // count immediately, not wait for Sunday.
    const periods = weeklyPeriods(
      ['2026-09-14', '2026-09-15', '2026-09-16'],
      3,
      '2026-09-14',
      '2026-09-17',
    );

    expect(periods).toEqual([{ hit: true }]);
  });

  it('omits the open week while it is still short of the target', () => {
    // Two of three logged on Thursday: still owed, never a miss.
    const periods = weeklyPeriods(['2026-09-14', '2026-09-15'], 3, '2026-09-14', '2026-09-17');

    expect(periods).toEqual([]);
  });

  it('appends the open week on top of the closed ones', () => {
    const periods = weeklyPeriods(
      ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16'],
      3,
      '2026-09-07',
      '2026-09-17',
    );

    expect(periods).toEqual([{ hit: true }, { hit: true }]);
  });

  it('scores the open week from days already lived, ignoring the rest of it', () => {
    // A stray entry for Sat 09-19 must not promote Thursday's week to a hit.
    const periods = weeklyPeriods(
      ['2026-09-14', '2026-09-15', '2026-09-19'],
      3,
      '2026-09-14',
      '2026-09-17',
    );

    expect(periods).toEqual([]);
  });

  it('closes the week on Sunday rather than leaving it open', () => {
    // Today *is* the closing Sunday, so the week is still the open period —
    // and it hits, so it is appended.
    const periods = weeklyPeriods(
      ['2026-09-14', '2026-09-16', '2026-09-20'],
      3,
      '2026-09-14',
      '2026-09-20',
    );

    expect(periods).toEqual([{ hit: true }]);
  });

  it('is empty on the first run with nothing logged', () => {
    expect(weeklyPeriods([], 3, '2026-09-17', '2026-09-17')).toEqual([]);
  });
});
