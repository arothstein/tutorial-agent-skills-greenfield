import { describe, expect, it } from 'vitest';

import { HABITS, habitById } from '../src/domain/habits';
import { emptyState, isLogged, toggleDay, type AppState } from '../src/domain/model';

describe('HABITS — the three fixed habits', () => {
  it('holds exactly three habits', () => {
    // Habits are code, not data (SPEC Non-Goals #5). A fourth entry here is a
    // spec change, not a feature.
    expect(HABITS).toHaveLength(3);
  });

  it('lists them in the order the Today card renders them', () => {
    expect(HABITS.map((habit) => habit.id)).toEqual(['walking', 'no-snacking', 'lifting']);
  });

  it('gives lifting a weekly cadence with a target of three days', () => {
    expect(habitById('lifting')).toEqual({
      id: 'lifting',
      name: 'Lifting weights',
      cadence: 'weekly',
      target: 3,
    });
  });

  it('gives walking a daily cadence with a target of one day', () => {
    expect(habitById('walking')).toEqual({
      id: 'walking',
      name: 'Walking',
      cadence: 'daily',
      target: 1,
    });
  });

  it('gives not-snacking a daily cadence with a target of one day', () => {
    expect(habitById('no-snacking')).toEqual({
      id: 'no-snacking',
      name: 'Not snacking',
      cadence: 'daily',
      target: 1,
    });
  });

  it('is frozen, so no caller can add a fourth habit at runtime', () => {
    expect(Object.isFrozen(HABITS)).toBe(true);
  });

  it('freezes each habit, so no caller can retarget one', () => {
    expect(HABITS.every((habit) => Object.isFrozen(habit))).toBe(true);
  });
});

describe('emptyState — the first-run seed', () => {
  it('starts the walk at today', () => {
    expect(emptyState('2026-09-17').startedOn).toBe('2026-09-17');
  });

  it('stamps the current schema version', () => {
    expect(emptyState('2026-09-17').schemaVersion).toBe(1);
  });

  it('opens an empty log for every habit', () => {
    expect(emptyState('2026-09-17').log).toEqual({
      lifting: [],
      walking: [],
      'no-snacking': [],
    });
  });

  it('gives each habit its own log array', () => {
    // A shared array reference would make logging a walk also log a lift.
    const state = emptyState('2026-09-17');

    expect(state.log.walking).not.toBe(state.log.lifting);
  });

  it('returns a fresh state each call', () => {
    expect(emptyState('2026-09-17')).not.toBe(emptyState('2026-09-17'));
  });

  it('writes nothing anywhere (AC6 — nothing is stored until a real mutation)', () => {
    emptyState('2026-09-17');

    expect(localStorage.length).toBe(0);
  });
});

describe('isLogged', () => {
  const state: AppState = {
    schemaVersion: 1,
    log: { lifting: [], walking: ['2026-09-16'], 'no-snacking': [] },
    startedOn: '2026-09-16',
  };

  it('is true for a day present in that habit’s log', () => {
    expect(isLogged(state, 'walking', '2026-09-16')).toBe(true);
  });

  it('is false for a day absent from it', () => {
    expect(isLogged(state, 'walking', '2026-09-17')).toBe(false);
  });

  it('does not see another habit’s entry', () => {
    // Presence is per habit; a shared lookup here would tick three streaks at
    // once (AC1: the three streaks are independent).
    expect(isLogged(state, 'lifting', '2026-09-16')).toBe(false);
  });
});

describe('toggleDay — logging is a toggle over a calendar day (D1)', () => {
  const seed = emptyState('2026-09-17');

  it('adds the day when it was not logged', () => {
    expect(toggleDay(seed, 'walking', '2026-09-17').log.walking).toEqual(['2026-09-17']);
  });

  it('removes the day when it was already logged', () => {
    const logged = toggleDay(seed, 'walking', '2026-09-17');

    expect(toggleDay(logged, 'walking', '2026-09-17').log.walking).toEqual([]);
  });

  it('is its own inverse, so a double tap is harmless', () => {
    const there = toggleDay(seed, 'lifting', '2026-09-15');

    expect(toggleDay(there, 'lifting', '2026-09-15')).toEqual(seed);
  });

  it('is its own inverse for a day before startedOn too', () => {
    // The whole state, not just the array: nothing else may drift on a
    // round trip.
    const there = toggleDay(seed, 'walking', '2026-09-01');

    expect(toggleDay(there, 'walking', '2026-09-01')).toEqual(seed);
  });

  it('keeps the log sorted when a day is back-filled out of order', () => {
    // Sorted ascending is a stored invariant (SPEC "Why this shape").
    const state = ['2026-09-17', '2026-09-15', '2026-09-16'].reduce(
      (acc, day) => toggleDay(acc, 'walking', day),
      seed,
    );

    expect(state.log.walking).toEqual(['2026-09-15', '2026-09-16', '2026-09-17']);
  });

  it('leaves the other habits untouched', () => {
    const state = toggleDay(seed, 'walking', '2026-09-17');

    expect(state.log.lifting).toEqual([]);
    expect(state.log['no-snacking']).toEqual([]);
  });

  it('does not mutate the state it was given', () => {
    toggleDay(seed, 'walking', '2026-09-17');

    expect(seed.log.walking).toEqual([]);
  });

  it('preserves startedOn and the schema version', () => {
    const state = toggleDay(seed, 'walking', '2026-09-17');

    expect(state.startedOn).toBe('2026-09-17');
    expect(state.schemaVersion).toBe(1);
  });

  it('never moves startedOn, in either direction', () => {
    // Tempting to pull it back so a back-filled older day starts scoring. That
    // is not symmetric: un-toggling the same day would leave the walk start
    // moved, turning every day before it into a miss — an accidental click
    // resetting a streak, which is the one thing this app must never do.
    // Where the walk starts is Task 12's decision, not a side effect here.
    const back = toggleDay(seed, 'walking', '2026-09-10');

    expect(back.startedOn).toBe('2026-09-17');
    expect(toggleDay(back, 'walking', '2026-09-10').startedOn).toBe('2026-09-17');
  });
});
