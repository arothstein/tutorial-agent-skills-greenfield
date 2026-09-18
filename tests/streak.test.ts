import { describe, expect, it } from 'vitest';

import { daysInclusive } from '../src/domain/dates';
import { habitById } from '../src/domain/habits';
import type { Period } from '../src/domain/periods';
import { computeStreak, dailyStreak, streakFor, weeklyStreak } from '../src/domain/streak';

/** 'HHM' -> three scored periods, oldest first. */
function periodsFrom(sequence: string): readonly Period[] {
  return [...sequence].map((mark) => ({ hit: mark === 'H' }));
}

describe('computeStreak — the period walk', () => {
  // The worked cases from SPEC.md "Streak Rules". One row per rule.
  const cases: Array<[label: string, periods: string, count: number, misses: number]> = [
    ['clean run', 'HHH', 3, 0],
    ['one miss holds the count', 'HHHHHHHHHHHM', 11, 1],
    ['a hit after a forgiven miss resumes', 'HHHHHHHHHHHMH', 12, 1],
    ['two in a row resets', 'HHHHHHHHHHHMM', 0, 0],
    ['restart after a reset is clean', 'HHHHHHHHHHHMMH', 1, 0],
    ['non-adjacent misses accumulate', 'HMHMH', 3, 2],
    ['three in a row stays reset', 'HHHHHMMM', 0, 0],
    ['nothing logged yet', '', 0, 0],
  ];

  it.each(cases)('%s: %s -> %i, %i misses', (_label, sequence, count, misses) => {
    expect(computeStreak(periodsFrom(sequence))).toEqual({ count, misses });
  });

  it('handles a leading miss without going negative', () => {
    expect(computeStreak(periodsFrom('MH'))).toEqual({ count: 1, misses: 1 });
  });
});

describe('dailyStreak — a streak from a list of completed dates', () => {
  it('counts one day per logged date', () => {
    const streak = dailyStreak(
      ['2026-09-15', '2026-09-16', '2026-09-17'],
      '2026-09-15',
      '2026-09-17',
    );

    expect(streak).toEqual({ count: 3, misses: 0, unit: 'days' });
  });

  it('does not score today as a miss when it is not done yet', () => {
    // Today is 09-17 and absent from the log. Yesterday's streak must be intact.
    const streak = dailyStreak(
      ['2026-09-14', '2026-09-15', '2026-09-16'],
      '2026-09-14',
      '2026-09-17',
    );

    expect(streak).toEqual({ count: 3, misses: 0, unit: 'days' });
  });

  it('increments immediately when today is logged (AC2)', () => {
    const streak = dailyStreak(
      ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'],
      '2026-09-14',
      '2026-09-17',
    );

    expect(streak).toEqual({ count: 4, misses: 0, unit: 'days' });
  });

  it('holds the count and annotates it after one missed day (AC3)', () => {
    // 09-15 missed, then back on the wagon.
    const streak = dailyStreak(
      ['2026-09-13', '2026-09-14', '2026-09-16', '2026-09-17'],
      '2026-09-13',
      '2026-09-17',
    );

    expect(streak).toEqual({ count: 4, misses: 1, unit: 'days' });
  });

  it('resets to zero after two consecutive missed days (AC4)', () => {
    // 09-15 and 09-16 both missed; today is open and unlogged, so it is not scored.
    const streak = dailyStreak(['2026-09-13', '2026-09-14'], '2026-09-13', '2026-09-17');

    expect(streak).toEqual({ count: 0, misses: 0, unit: 'days' });
  });

  it('restarts at one when today is logged after a reset', () => {
    const streak = dailyStreak(
      ['2026-09-13', '2026-09-14', '2026-09-17'],
      '2026-09-13',
      '2026-09-17',
    );

    expect(streak).toEqual({ count: 1, misses: 0, unit: 'days' });
  });

  it('repairs the streak when a missed day is back-filled', () => {
    const broken = dailyStreak(
      ['2026-09-13', '2026-09-14', '2026-09-17'],
      '2026-09-13',
      '2026-09-17',
    );
    const backFilled = dailyStreak(
      ['2026-09-13', '2026-09-14', '2026-09-16', '2026-09-17'],
      '2026-09-13',
      '2026-09-17',
    );

    expect(broken.count).toBe(1);
    expect(backFilled).toEqual({ count: 4, misses: 1, unit: 'days' });
  });

  it('is zero on the first run with nothing logged', () => {
    expect(dailyStreak([], '2026-09-17', '2026-09-17')).toEqual({
      count: 0,
      misses: 0,
      unit: 'days',
    });
  });

  it('never evaluates days before startedOn', () => {
    // The 09-10 entry predates startedOn and must not extend the walk backwards.
    const streak = dailyStreak(
      ['2026-09-10', '2026-09-16', '2026-09-17'],
      '2026-09-16',
      '2026-09-17',
    );

    expect(streak).toEqual({ count: 2, misses: 0, unit: 'days' });
  });

  it('tolerates an unsorted log with duplicate dates', () => {
    const streak = dailyStreak(
      ['2026-09-16', '2026-09-15', '2026-09-16'],
      '2026-09-15',
      '2026-09-17',
    );

    expect(streak).toEqual({ count: 2, misses: 0, unit: 'days' });
  });

  it('walks across a month boundary', () => {
    const streak = dailyStreak(
      ['2026-08-30', '2026-08-31', '2026-09-01'],
      '2026-08-30',
      '2026-09-01',
    );

    expect(streak).toEqual({ count: 3, misses: 0, unit: 'days' });
  });
});

describe('weeklyStreak — a streak over Mon–Sun weeks (AC5)', () => {
  it('counts one week per week holding at least the target logged days', () => {
    // Three weeks of three sessions each: Mon/Wed/Fri from 08-31 onward.
    const log = [
      '2026-08-31',
      '2026-09-02',
      '2026-09-04',
      '2026-09-07',
      '2026-09-09',
      '2026-09-11',
      '2026-09-14',
      '2026-09-16',
      '2026-09-18',
    ];

    expect(weeklyStreak(log, 3, '2026-08-31', '2026-09-21')).toEqual({
      count: 3,
      misses: 0,
      unit: 'weeks',
    });
  });

  it('does not score the current week as a miss while it is still open', () => {
    // Today is Thu 09-17 with one session logged this week. The two complete
    // weeks behind it must stand.
    const log = [
      '2026-08-31',
      '2026-09-02',
      '2026-09-04',
      '2026-09-07',
      '2026-09-09',
      '2026-09-11',
      '2026-09-14',
    ];

    expect(weeklyStreak(log, 3, '2026-08-31', '2026-09-17')).toEqual({
      count: 2,
      misses: 0,
      unit: 'weeks',
    });
  });

  it('ticks up mid-week the moment the target is reached (D2)', () => {
    const log = ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-15'];
    const beforeTheThird = weeklyStreak(log, 3, '2026-09-07', '2026-09-17');
    const afterTheThird = weeklyStreak([...log, '2026-09-16'], 3, '2026-09-07', '2026-09-17');

    expect(beforeTheThird.count).toBe(1);
    expect(afterTheThird.count).toBe(2);
  });

  it('forgives one short week without reducing the count', () => {
    // Week of 09-07 holds only two sessions; the count holds at 2 and is annotated.
    const log = [
      '2026-08-31',
      '2026-09-02',
      '2026-09-04',
      '2026-09-07',
      '2026-09-09',
      '2026-09-14',
      '2026-09-16',
      '2026-09-18',
    ];

    expect(weeklyStreak(log, 3, '2026-08-31', '2026-09-21')).toEqual({
      count: 2,
      misses: 1,
      unit: 'weeks',
    });
  });

  it('resets to zero after two consecutive short weeks', () => {
    const log = ['2026-08-31', '2026-09-02', '2026-09-04', '2026-09-07', '2026-09-14'];

    expect(weeklyStreak(log, 3, '2026-08-31', '2026-09-21')).toEqual({
      count: 0,
      misses: 0,
      unit: 'weeks',
    });
  });

  it('is zero on the first run with nothing logged', () => {
    expect(weeklyStreak([], 3, '2026-09-17', '2026-09-17')).toEqual({
      count: 0,
      misses: 0,
      unit: 'weeks',
    });
  });
});

describe("streakFor — wiring a habit's cadence to the right walk", () => {
  const STARTED_ON = '2026-08-31';
  const TODAY = '2026-09-17';

  it('walks walking in days', () => {
    const streak = streakFor(habitById('walking'), ['2026-09-17'], TODAY, TODAY);

    expect(streak).toEqual({ count: 1, misses: 0, unit: 'days' });
  });

  it('walks not-snacking in days', () => {
    const streak = streakFor(habitById('no-snacking'), ['2026-09-17'], TODAY, TODAY);

    expect(streak).toEqual({ count: 1, misses: 0, unit: 'days' });
  });

  it('walks lifting in weeks, never days (AC5)', () => {
    const streak = streakFor(
      habitById('lifting'),
      ['2026-09-14', '2026-09-15', '2026-09-16'],
      '2026-09-14',
      TODAY,
    );

    expect(streak).toEqual({ count: 1, misses: 0, unit: 'weeks' });
  });

  it("applies lifting's target of three, so a two-day week does not hit", () => {
    const streak = streakFor(
      habitById('lifting'),
      ['2026-09-14', '2026-09-15'],
      '2026-09-14',
      TODAY,
    );

    expect(streak).toEqual({ count: 0, misses: 0, unit: 'weeks' });
  });

  it('agrees with the cadence-specific walks it dispatches to', () => {
    const log = ['2026-09-14', '2026-09-15', '2026-09-16'];

    expect(streakFor(habitById('walking'), log, '2026-09-14', TODAY)).toEqual(
      dailyStreak(log, '2026-09-14', TODAY),
    );
    expect(streakFor(habitById('lifting'), log, '2026-09-14', TODAY)).toEqual(
      weeklyStreak(log, 3, '2026-09-14', TODAY),
    );
  });

  it('streaks the three habits independently — a reset in one leaves the others standing (AC1)', () => {
    // One state, three habits in three different conditions. Built from
    // daysInclusive so the intent stays legible rather than an 18-date literal.
    const everyDay = daysInclusive(STARTED_ON, TODAY);
    const log = {
      // Clean since the start.
      walking: everyDay,
      // Missed two days in a row, so it reset and rebuilt.
      'no-snacking': everyDay.filter((day) => day !== '2026-09-14' && day !== '2026-09-15'),
      // One session in each of two closed weeks: two short weeks, so reset.
      lifting: ['2026-08-31', '2026-09-07'],
    };

    expect(streakFor(habitById('walking'), log.walking, STARTED_ON, TODAY)).toEqual({
      count: 18,
      misses: 0,
      unit: 'days',
    });
    expect(streakFor(habitById('no-snacking'), log['no-snacking'], STARTED_ON, TODAY)).toEqual({
      count: 2,
      misses: 0,
      unit: 'days',
    });
    expect(streakFor(habitById('lifting'), log.lifting, STARTED_ON, TODAY)).toEqual({
      count: 0,
      misses: 0,
      unit: 'weeks',
    });
  });

  it("reads only its own habit's log", () => {
    // Lifting's sessions must not feed walking's streak.
    const liftingOnly = ['2026-09-15', '2026-09-16', '2026-09-17'];

    expect(streakFor(habitById('walking'), [], '2026-09-15', TODAY).count).toBe(0);
    expect(streakFor(habitById('lifting'), liftingOnly, '2026-09-15', TODAY).count).toBe(1);
  });
});
