import { describe, expect, it } from 'vitest';

import { habitById } from '../src/domain/habits';
import {
  daysLeftText,
  headerDate,
  missAnnotation,
  streakSummary,
  toggleAnnouncement,
  toggleLabel,
  unitWord,
  weekProgressText,
} from '../src/ui/labels';

describe('missAnnotation — informative, never scolding (AC3)', () => {
  it('says nothing when the streak is clean', () => {
    expect(missAnnotation(0)).toBe('');
  });

  it('spells one miss out in words, as SPEC writes it', () => {
    expect(missAnnotation(1)).toBe(', one miss');
  });

  it('pluralises two', () => {
    expect(missAnnotation(2)).toBe(', two misses');
  });

  it('spells three', () => {
    expect(missAnnotation(3)).toBe(', three misses');
  });

  it('falls back to digits past the words it spells', () => {
    expect(missAnnotation(7)).toBe(', 7 misses');
  });
});

describe('unitWord — a week count can never read as a day count (AC1, AC5)', () => {
  it('uses the singular for one day', () => {
    expect(unitWord('days', 1)).toBe('day');
  });

  it('uses the plural for several days', () => {
    expect(unitWord('days', 12)).toBe('days');
  });

  it('uses the singular for one week', () => {
    expect(unitWord('weeks', 1)).toBe('week');
  });

  it('uses the plural for several weeks', () => {
    expect(unitWord('weeks', 6)).toBe('weeks');
  });
});

describe('streakSummary — the readout, in one phrase', () => {
  it('reads a clean day streak', () => {
    expect(streakSummary({ count: 3, misses: 0, unit: 'days' })).toBe('3 days');
  });

  it('carries the annotation at the same weight as the number', () => {
    expect(streakSummary({ count: 11, misses: 1, unit: 'days' })).toBe('11 days, one miss');
  });

  it('labels a week streak in weeks', () => {
    expect(streakSummary({ count: 6, misses: 0, unit: 'weeks' })).toBe('6 weeks');
  });

  it('reads a reset as a plain zero, with no unit and no loss framing', () => {
    // This is the exact moment the app must not feel punishing.
    expect(streakSummary({ count: 0, misses: 0, unit: 'days' })).toBe('0');
  });

  it('never combines or sums anything (AC1)', () => {
    expect(streakSummary({ count: 1, misses: 1, unit: 'weeks' })).toBe('1 week, one miss');
  });
});

describe('weekProgressText — what lifting still owes (D2)', () => {
  it('reads as N of target', () => {
    expect(weekProgressText({ logged: 2, target: 3, daysLeft: 4, isMet: false })).toBe(
      '2 of 3 this week',
    );
  });

  it('reads the met week the same way, not as extra credit', () => {
    expect(weekProgressText({ logged: 3, target: 3, daysLeft: 4, isMet: true })).toBe(
      '3 of 3 this week',
    );
  });
});

describe('daysLeftText', () => {
  it('counts the days still usable, today included', () => {
    expect(daysLeftText({ logged: 0, target: 3, daysLeft: 4, isMet: false })).toBe('4 days left');
  });

  it('uses the singular on the last day of the week', () => {
    expect(daysLeftText({ logged: 0, target: 3, daysLeft: 1, isMet: false })).toBe('1 day left');
  });
});

describe('headerDate', () => {
  it('formats the date as SPEC draws it', () => {
    expect(headerDate('2026-09-17')).toBe('Thu 17 Sep 2026');
  });

  it('does not zero-pad the day, which would read as a filename', () => {
    expect(headerDate('2026-09-06')).toBe('Sun 6 Sep 2026');
  });

  it('names each weekday correctly across a full week', () => {
    // Mon 2026-09-14 through Sun 2026-09-20.
    const week = [
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ];

    expect(week.map((day) => headerDate(day).slice(0, 3))).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
  });

  it('names every month', () => {
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = `${index + 1}`.padStart(2, '0');

      return headerDate(`2026-${month}-01`).split(' ')[2];
    });

    expect(months).toEqual([
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
    ]);
  });
});

describe('toggleAnnouncement — what a screen reader hears after a toggle', () => {
  it('confirms the habit was marked and reads its new streak', () => {
    expect(toggleAnnouncement('Walking', true, { count: 12, misses: 1, unit: 'days' })).toBe(
      'Walking marked done for today. Streak 12 days, one miss.',
    );
  });

  it('confirms an un-mark as a correction, not a loss', () => {
    expect(toggleAnnouncement('Walking', false, { count: 11, misses: 1, unit: 'days' })).toBe(
      'Walking no longer marked for today. Streak 11 days, one miss.',
    );
  });

  it('names the habit, so three rows are never confused for one', () => {
    expect(
      toggleAnnouncement('Lifting weights', true, { count: 6, misses: 0, unit: 'weeks' }),
    ).toContain('Lifting weights');
  });
});

describe('toggleLabel', () => {
  const walking = habitById('walking');
  const lifting = habitById('lifting');

  it('asks a daily habit to be marked done', () => {
    expect(toggleLabel(walking, false)).toBe('Mark done');
  });

  it('reads back as done once it is', () => {
    expect(toggleLabel(walking, true)).toBe('Done today');
  });

  it('asks lifting for a session, in the habit’s own terms', () => {
    expect(toggleLabel(lifting, false)).toBe('Log session');
  });

  it('reads back as logged once the session is in', () => {
    expect(toggleLabel(lifting, true)).toBe('Logged today');
  });
});
