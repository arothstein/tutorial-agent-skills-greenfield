import { describe, expect, it } from 'vitest';

import { emptyState, type AppState } from '../src/domain/model';
import {
  CURRENT_VERSION,
  applyMigrations,
  parseDocument,
  serializeDocument,
  type Migration,
} from '../src/storage/schema';

/** A valid document, as text, with `patch` merged over it. */
function documentText(patch: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    log: { lifting: [], walking: [], 'no-snacking': [] },
    startedOn: '2026-09-17',
    ...patch,
  });
}

/** The parsed state, or a failure that fails the test rather than the types. */
function parsedState(text: string): AppState {
  const result = parseDocument(text);

  if (!result.ok) {
    throw new Error(`expected a valid document, got ${result.kind}: ${result.reason}`);
  }

  return result.state;
}

describe('serializeDocument', () => {
  it('writes the whole document back', () => {
    expect(JSON.parse(serializeDocument(emptyState('2026-09-17')))).toEqual({
      schemaVersion: 1,
      log: { lifting: [], walking: [], 'no-snacking': [] },
      startedOn: '2026-09-17',
    });
  });

  it('round-trips through parseDocument unchanged', () => {
    const state: AppState = {
      schemaVersion: 1,
      log: {
        lifting: ['2026-09-14', '2026-09-16'],
        walking: ['2026-09-17'],
        'no-snacking': [],
      },
      startedOn: '2026-09-14',
    };

    expect(parsedState(serializeDocument(state))).toEqual(state);
  });

  it('persists no derived value', () => {
    // SPEC "Never": a stored streak could disagree with the log. The only cure
    // is for it never to be written.
    const text = serializeDocument({
      schemaVersion: 1,
      log: { lifting: [], walking: ['2026-09-17'], 'no-snacking': [] },
      startedOn: '2026-09-17',
    });

    expect(Object.keys(JSON.parse(text)).sort()).toEqual(['log', 'schemaVersion', 'startedOn']);
    expect(text).not.toMatch(/streak|miss|count/i);
  });

  it('writes the log sorted and duplicate-free even when handed neither', () => {
    // Callers maintain the invariant; this boundary guarantees it.
    const text = serializeDocument({
      schemaVersion: 1,
      log: {
        lifting: [],
        walking: ['2026-09-17', '2026-09-15', '2026-09-17'],
        'no-snacking': [],
      },
      startedOn: '2026-09-15',
    });

    expect(JSON.parse(text).log.walking).toEqual(['2026-09-15', '2026-09-17']);
  });

  it('stamps the version this build writes', () => {
    expect(JSON.parse(serializeDocument(emptyState('2026-09-17'))).schemaVersion).toBe(
      CURRENT_VERSION,
    );
  });
});

describe('parseDocument — a valid document', () => {
  it('returns the stored log', () => {
    const text = documentText({
      log: { lifting: ['2026-09-14'], walking: ['2026-09-16'], 'no-snacking': [] },
    });

    expect(parsedState(text).log).toEqual({
      lifting: ['2026-09-14'],
      walking: ['2026-09-16'],
      'no-snacking': [],
    });
  });

  it('returns the stored startedOn', () => {
    expect(parsedState(documentText()).startedOn).toBe('2026-09-17');
  });

  it('drops unknown top-level keys rather than carrying them forward', () => {
    // `exportedAt` rides along on a backup file; a tolerant reader ignores it
    // instead of rejecting the document over it.
    const state = parsedState(documentText({ exportedAt: '2026-09-17T21:40:00.000Z' }));

    expect(Object.keys(state).sort()).toEqual(['log', 'schemaVersion', 'startedOn']);
  });
});

describe('parseDocument — repairing what is losslessly repairable', () => {
  it('sorts a log stored out of order', () => {
    // A set of dates has exactly one sorted, duplicate-free form, so this
    // repair cannot guess wrong. Quarantining here would cost the user a real
    // history over a violation with a provably correct fix.
    const text = documentText({
      log: { lifting: [], walking: ['2026-09-17', '2026-09-15'], 'no-snacking': [] },
    });

    expect(parsedState(text).log.walking).toEqual(['2026-09-15', '2026-09-17']);
  });

  it('collapses a duplicated day', () => {
    const text = documentText({
      log: { lifting: ['2026-09-14', '2026-09-14'], walking: [], 'no-snacking': [] },
    });

    expect(parsedState(text).log.lifting).toEqual(['2026-09-14']);
  });
});

describe('parseDocument — corrupt documents', () => {
  /** The failure kind, or `'ok'` when the document was wrongly accepted. */
  function kindOf(text: string): string {
    const result = parseDocument(text);

    return result.ok ? 'ok' : result.kind;
  }

  it('rejects text that is not JSON', () => {
    expect(kindOf('{ not json')).toBe('corrupt');
  });

  it('rejects the empty string', () => {
    expect(kindOf('')).toBe('corrupt');
  });

  it('rejects JSON that is not an object', () => {
    expect(kindOf('"a string"')).toBe('corrupt');
    expect(kindOf('42')).toBe('corrupt');
    expect(kindOf('null')).toBe('corrupt');
  });

  it('rejects an array, which `typeof` alone would call an object', () => {
    expect(kindOf('[]')).toBe('corrupt');
  });

  it('rejects a missing schemaVersion', () => {
    expect(kindOf(JSON.stringify({ log: {}, startedOn: '2026-09-17' }))).toBe('corrupt');
  });

  it('rejects a non-numeric schemaVersion', () => {
    expect(kindOf(documentText({ schemaVersion: '1' }))).toBe('corrupt');
  });

  it('rejects a fractional schemaVersion', () => {
    expect(kindOf(documentText({ schemaVersion: 1.5 }))).toBe('corrupt');
  });

  it('rejects a missing log', () => {
    expect(kindOf(JSON.stringify({ schemaVersion: 1, startedOn: '2026-09-17' }))).toBe('corrupt');
  });

  it('rejects a log that is not an object', () => {
    expect(kindOf(documentText({ log: [] }))).toBe('corrupt');
  });

  it('rejects a log missing a habit', () => {
    expect(kindOf(documentText({ log: { lifting: [], walking: [] } }))).toBe('corrupt');
  });

  it('names the habit a log is missing', () => {
    const result = parseDocument(documentText({ log: { lifting: [], walking: [] } }));

    expect(result.ok ? '' : result.reason).toContain('no-snacking');
  });

  it("rejects a habit's entries that are not an array", () => {
    const text = documentText({
      log: { lifting: '2026-09-14', walking: [], 'no-snacking': [] },
    });

    expect(kindOf(text)).toBe('corrupt');
  });

  it('rejects an entry that is not a calendar date', () => {
    const text = documentText({
      log: { lifting: [], walking: ['17/09/2026'], 'no-snacking': [] },
    });

    expect(kindOf(text)).toBe('corrupt');
  });

  it('rejects an entry that is a UTC timestamp rather than a local date', () => {
    const text = documentText({
      log: { lifting: [], walking: ['2026-09-17T00:00:00.000Z'], 'no-snacking': [] },
    });

    expect(kindOf(text)).toBe('corrupt');
  });

  it('rejects a date that looks well-formed but is not on the calendar', () => {
    const text = documentText({
      log: { lifting: [], walking: ['2026-02-30'], 'no-snacking': [] },
    });

    expect(kindOf(text)).toBe('corrupt');
  });

  it('quotes the offending entry so the banner can say what went wrong', () => {
    const text = documentText({
      log: { lifting: [], walking: ['17/09/2026'], 'no-snacking': [] },
    });
    const result = parseDocument(text);

    expect(result.ok ? '' : result.reason).toContain('17/09/2026');
  });

  it('truncates a very long offending value rather than quoting all of it', () => {
    const text = documentText({
      log: { lifting: [], walking: ['x'.repeat(500)], 'no-snacking': [] },
    });
    const result = parseDocument(text);

    expect(result.ok ? 'x'.repeat(500) : result.reason.length).toBeLessThan(120);
  });

  it('rejects a log holding a habit this build does not know', () => {
    // A fourth habit means the document came from a build that is not this one.
    // Dropping it silently would destroy data the user can still see; the
    // caller quarantines it instead.
    const text = documentText({
      log: { lifting: [], walking: [], 'no-snacking': [], meditation: ['2026-09-17'] },
    });

    expect(kindOf(text)).toBe('corrupt');
  });

  it('rejects a missing startedOn', () => {
    expect(kindOf(JSON.stringify({ schemaVersion: 1, log: {} }))).toBe('corrupt');
  });

  it('rejects a startedOn that is not a calendar date', () => {
    expect(kindOf(documentText({ startedOn: 'yesterday' }))).toBe('corrupt');
  });

  it('gives every rejection a reason worth showing a human', () => {
    const result = parseDocument('{ not json');

    expect(result.ok ? '' : result.reason.length).toBeGreaterThan(10);
  });
});

describe('parseDocument — a version this build does not read', () => {
  it('refuses a version from the future rather than downgrading it', () => {
    const result = parseDocument(documentText({ schemaVersion: 2 }));

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.kind).toBe('future-version');
  });

  it('reports the version it found, so the warning can name it', () => {
    const result = parseDocument(documentText({ schemaVersion: 7 }));

    expect(result.ok || result.kind === 'corrupt' ? 0 : result.storedVersion).toBe(7);
  });

  it('refuses a version older than any this build can migrate', () => {
    // No version 0 was ever released, so a document claiming one was not
    // written by this app. Guessing at its shape is how data gets destroyed.
    const result = parseDocument(documentText({ schemaVersion: 0 }));

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.kind).toBe('unsupported-version');
  });

  it('refuses a negative version', () => {
    const result = parseDocument(documentText({ schemaVersion: -1 }));

    expect(result.ok ? '' : result.kind).toBe('unsupported-version');
  });
});

describe('applyMigrations — the seam a future schema bump lands on', () => {
  /** Two steps, as a real bump would ship them: one per version crossed. */
  const steps: Readonly<Record<number, Migration>> = {
    1: (document) => ({ ...document, schemaVersion: 2, startedOn: '2026-01-01' }),
    2: (document) => ({ ...document, schemaVersion: 3 }),
  };

  it('returns a current document untouched', () => {
    const document = { schemaVersion: 3, startedOn: '2026-09-17' };

    expect(applyMigrations(document, 3, 3, steps)).toEqual({ ok: true, document });
  });

  it('runs every step between the stored version and the current one', () => {
    const result = applyMigrations({ schemaVersion: 1, startedOn: '2026-09-17' }, 1, 3, steps);

    expect(result).toEqual({
      ok: true,
      document: { schemaVersion: 3, startedOn: '2026-01-01' },
    });
  });

  it('runs them in order, oldest first', () => {
    const order: number[] = [];
    const recorded: Readonly<Record<number, Migration>> = {
      1: (document) => {
        order.push(1);

        return { ...document, schemaVersion: 2 };
      },
      2: (document) => {
        order.push(2);

        return { ...document, schemaVersion: 3 };
      },
    };

    applyMigrations({ schemaVersion: 1 }, 1, 3, recorded);

    expect(order).toEqual([1, 2]);
  });

  it('refuses when a step in the chain is missing rather than skipping it', () => {
    // Skipping a version would hand the validator a shape nothing produced.
    const result = applyMigrations({ schemaVersion: 1 }, 1, 3, { 1: steps[1] as Migration });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toContain('2');
  });

  it('ships empty, because version 1 is the first there has ever been', () => {
    // Nothing older than the current version has been written, so there is
    // nothing to migrate from yet. A bump registers its step here.
    const result = applyMigrations({ schemaVersion: 0 }, 0, CURRENT_VERSION);

    expect(result.ok).toBe(false);
  });
});
