import { describe, expect, it } from 'vitest';

import { HABITS, habitById } from '../src/domain/habits';
import { emptyState } from '../src/domain/model';

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
