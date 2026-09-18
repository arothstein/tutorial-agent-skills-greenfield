import { afterEach, describe, expect, it, vi } from 'vitest';

import { emptyState, toggleDay, type AppState } from '../src/domain/model';
import {
  STORAGE_KEY,
  browserStorage,
  openStore,
  type StorageLike,
  type StoreStatus,
} from '../src/storage/localStore';

const TODAY = '2026-09-17';

/** An in-memory `Storage`, with the written bytes readable for assertions. */
function fakeStorage(seed: Readonly<Record<string, string>> = {}): StorageLike & {
  readonly written: Map<string, string>;
} {
  const written = new Map(Object.entries(seed));

  return {
    written,
    getItem: (key) => written.get(key) ?? null,
    setItem: (key, value) => {
      written.set(key, value);
    },
  };
}

/** Storage whose `getItem` throws, as a disabled or partitioned store does. */
function unreadableStorage(): StorageLike {
  return {
    getItem: () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
    setItem: () => undefined,
  };
}

/** Storage that accepts reads and rejects every write with `error`. */
function unwritableStorage(error: unknown, seed: Readonly<Record<string, string>> = {}): StorageLike {
  const stored = new Map(Object.entries(seed));

  return {
    getItem: (key) => stored.get(key) ?? null,
    setItem: () => {
      throw error;
    },
  };
}

function quotaError(): DOMException {
  return new DOMException('The quota has been exceeded.', 'QuotaExceededError');
}

/** A stored document, as text, with `patch` merged over a valid one. */
function documentText(patch: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    log: { lifting: [], walking: ['2026-09-16'], 'no-snacking': [] },
    startedOn: '2026-09-16',
    ...patch,
  });
}

/** The quarantine key a corrupt status names, or `''` when it named none. */
function quarantineKeyOf(status: StoreStatus): string {
  return 'quarantineKey' in status ? (status.quarantineKey ?? '') : '';
}

afterEach(() => {
  // Mocks first: one test stubs the `localStorage` getter itself, and clearing
  // before restoring would trip over it.
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('openStore — a stored document (AC6)', () => {
  it('reads the document back as state', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: documentText() });

    expect(openStore({ today: TODAY, storage }).initial).toEqual({
      schemaVersion: 1,
      log: { lifting: [], walking: ['2026-09-16'], 'no-snacking': [] },
      startedOn: '2026-09-16',
    });
  });

  it('reports a clean read', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: documentText() });

    expect(openStore({ today: TODAY, storage }).status).toEqual({ kind: 'stored' });
  });

  it('round-trips a saved state deep-equal', () => {
    const storage = fakeStorage();
    const state = toggleDay(toggleDay(emptyState(TODAY), 'walking', TODAY), 'lifting', TODAY);

    openStore({ today: TODAY, storage }).save(state);

    expect(openStore({ today: TODAY, storage }).initial).toEqual(state);
  });

  it('round-trips through the real browser store under the specified key', () => {
    const storage = browserStorage();

    if (!storage) {
      throw new Error('this suite needs a working localStorage');
    }

    const state = toggleDay(emptyState(TODAY), 'walking', TODAY);
    openStore({ today: TODAY, storage }).save(state);

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(openStore({ today: TODAY, storage }).initial).toEqual(state);
  });

  it('survives a reload across a fresh store object, not a cached one', () => {
    const storage = fakeStorage();
    const first = openStore({ today: TODAY, storage });
    first.save(toggleDay(first.initial, 'no-snacking', TODAY));

    const reopened = openStore({ today: '2026-09-18', storage });

    expect(reopened.initial.log['no-snacking']).toEqual([TODAY]);
    expect(reopened.status.kind).toBe('stored');
  });
});

describe('openStore — first run', () => {
  it('seeds an empty state starting today', () => {
    expect(openStore({ today: TODAY, storage: fakeStorage() }).initial).toEqual(emptyState(TODAY));
  });

  it('reports a first run', () => {
    expect(openStore({ today: TODAY, storage: fakeStorage() }).status).toEqual({
      kind: 'first-run',
    });
  });

  it('writes nothing until the first real mutation (AC6)', () => {
    const storage = fakeStorage();
    const setItem = vi.spyOn(storage, 'setItem');

    openStore({ today: TODAY, storage });

    expect(setItem).not.toHaveBeenCalled();
    expect(storage.written.size).toBe(0);
  });

  it('writes on that first mutation', () => {
    const storage = fakeStorage();
    const store = openStore({ today: TODAY, storage });

    expect(store.save(toggleDay(store.initial, 'walking', TODAY))).toEqual({ ok: true });
    expect(storage.written.get(STORAGE_KEY)).toContain(TODAY);
  });

  it('ignores a value stored under some other key', () => {
    const storage = fakeStorage({ 'habit-tracker.v0': documentText() });

    expect(openStore({ today: TODAY, storage }).status.kind).toBe('first-run');
  });
});

describe('openStore — corrupt stored data', () => {
  it('starts fresh rather than crashing', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{ not json' });

    expect(openStore({ today: TODAY, storage }).initial).toEqual(emptyState(TODAY));
  });

  it('reports the corruption with a reason a human can read', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{ not json' });
    const { status } = openStore({ today: TODAY, storage });

    expect(status.kind).toBe('corrupt');
    expect('reason' in status ? status.reason : '').toContain('JSON');
  });

  it('preserves the unreadable value under a quarantine key', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{ not json' });
    const { status } = openStore({ today: TODAY, storage, now: () => 1_759_000_000_000 });

    expect(quarantineKeyOf(status)).toBe(`${STORAGE_KEY}.corrupt.1759000000000`);
    expect(storage.written.get(`${STORAGE_KEY}.corrupt.1759000000000`)).toBe('{ not json');
  });

  it('names the quarantine key in its status, so the banner can point at it', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{ not json' });
    const { status } = openStore({ today: TODAY, storage });

    expect(quarantineKeyOf(status)).toMatch(/^habit-tracker\.v1\.corrupt\.\d+$/);
  });

  it('leaves the live key holding the original bytes until a real save', () => {
    // SPEC "Never": do not overwrite a stored value that failed to parse.
    const storage = fakeStorage({ [STORAGE_KEY]: '{ not json' });

    openStore({ today: TODAY, storage });

    expect(storage.written.get(STORAGE_KEY)).toBe('{ not json');
  });

  it('quarantines a document that parses but fails validation', () => {
    const storage = fakeStorage({
      [STORAGE_KEY]: documentText({ log: { lifting: [], walking: ['17/09/2026'] } }),
    });
    const { status } = openStore({ today: TODAY, storage });

    expect(status.kind).toBe('corrupt');
    expect(storage.written.get(quarantineKeyOf(status))).toContain('17/09/2026');
  });

  it('saves normally once the bad value is safely copied aside', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{ not json' });
    const store = openStore({ today: TODAY, storage });

    expect(store.save(toggleDay(store.initial, 'walking', TODAY))).toEqual({ ok: true });
    expect(storage.written.get(STORAGE_KEY)).toContain(TODAY);
  });

  it('refuses to save when the value could not be copied aside', () => {
    // Quarantine is what makes overwriting safe. Without it the only way not to
    // destroy the user's history is not to write.
    const storage = unwritableStorage(quotaError(), { [STORAGE_KEY]: '{ not json' });
    const store = openStore({ today: TODAY, storage });
    const result = store.save(toggleDay(store.initial, 'walking', TODAY));

    expect(quarantineKeyOf(store.status)).toBe('');
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.failure.kind).toBe('read-only');
  });

  it('still hands back a usable state when quarantine failed', () => {
    const storage = unwritableStorage(quotaError(), { [STORAGE_KEY]: '{ not json' });

    expect(openStore({ today: TODAY, storage }).initial).toEqual(emptyState(TODAY));
  });
});

describe('openStore — a version this build does not read', () => {
  it('refuses a future version rather than downgrading it', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: documentText({ schemaVersion: 2 }) });
    const { status } = openStore({ today: TODAY, storage });

    expect(status.kind).toBe('future-version');
    expect('storedVersion' in status ? status.storedVersion : 0).toBe(2);
  });

  it('never writes over a future version, not even a copy of it', () => {
    // The document is intact and newer, not damaged. Copying it aside would
    // spend quota to protect a value nothing is threatening.
    const storage = fakeStorage({ [STORAGE_KEY]: documentText({ schemaVersion: 2 }) });
    const store = openStore({ today: TODAY, storage });
    const result = store.save(toggleDay(store.initial, 'walking', TODAY));

    expect(storage.written.get(STORAGE_KEY)).toBe(documentText({ schemaVersion: 2 }));
    expect(storage.written.size).toBe(1);
    expect(result.ok ? '' : result.failure.kind).toBe('read-only');
  });

  it('stays usable in memory while refusing to persist', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: documentText({ schemaVersion: 2 }) });

    expect(openStore({ today: TODAY, storage }).initial).toEqual(emptyState(TODAY));
  });

  it('quarantines a version older than anything it can migrate', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: documentText({ schemaVersion: 0 }) });
    const { status } = openStore({ today: TODAY, storage });

    expect(status.kind).toBe('unsupported-version');
    expect(storage.written.get(quarantineKeyOf(status))).toBe(documentText({ schemaVersion: 0 }));
  });

  it('reports the version it found on an unsupported document', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: documentText({ schemaVersion: 0 }) });
    const { status } = openStore({ today: TODAY, storage });

    expect('storedVersion' in status ? status.storedVersion : -1).toBe(0);
  });
});

describe('openStore — storage unavailable (memory-only mode)', () => {
  it('runs in memory when reading throws', () => {
    const store = openStore({ today: TODAY, storage: unreadableStorage() });

    expect(store.status.kind).toBe('unavailable');
    expect(store.initial).toEqual(emptyState(TODAY));
  });

  it('explains why, for the banner', () => {
    const { status } = openStore({ today: TODAY, storage: unreadableStorage() });

    expect('detail' in status ? status.detail : '').toContain('insecure');
  });

  it('runs in memory when there is no storage at all', () => {
    const store = openStore({ today: TODAY, storage: null });

    expect(store.status.kind).toBe('unavailable');
    expect(store.initial).toEqual(emptyState(TODAY));
  });

  it('does not attempt a write it cannot verify', () => {
    // A key that could not be read may still hold a real history. Writing over
    // it blind is how that history is lost.
    const storage = unreadableStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    const store = openStore({ today: TODAY, storage });

    const result = store.save(toggleDay(store.initial, 'walking', TODAY));

    expect(setItem).not.toHaveBeenCalled();
    expect(result.ok ? '' : result.failure.kind).toBe('read-only');
  });

  it('keeps the session alive: state changes still apply in memory', () => {
    const store = openStore({ today: TODAY, storage: null });
    const mutated = toggleDay(store.initial, 'walking', TODAY);

    store.save(mutated);

    expect(mutated.log.walking).toEqual([TODAY]);
  });
});

describe('save — write failures', () => {
  it('reports a quota failure instead of throwing', () => {
    const store = openStore({ today: TODAY, storage: unwritableStorage(quotaError()) });
    const result = store.save(toggleDay(store.initial, 'walking', TODAY));

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.failure.kind).toBe('quota');
  });

  it('recognises the legacy Firefox quota name', () => {
    const error = new DOMException('persistent storage', 'NS_ERROR_DOM_QUOTA_REACHED');
    const store = openStore({ today: TODAY, storage: unwritableStorage(error) });
    const result = store.save(store.initial);

    expect(result.ok ? '' : result.failure.kind).toBe('quota');
  });

  it('reports any other write failure as the store being unavailable', () => {
    const error = new DOMException('denied', 'SecurityError');
    const store = openStore({ today: TODAY, storage: unwritableStorage(error) });
    const result = store.save(store.initial);

    expect(result.ok ? '' : result.failure.kind).toBe('unavailable');
  });

  it('survives a thrown value that is not an Error at all', () => {
    const store = openStore({ today: TODAY, storage: unwritableStorage('nope') });
    const result = store.save(store.initial);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.failure.detail).toContain('nope');
  });

  it('keeps accepting saves after a failure, so freeing space recovers', () => {
    // Un-logging a day shrinks the document. The store must not have latched
    // itself shut on the failed write, or the session is stuck.
    let failing = true;
    const written = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => written.get(key) ?? null,
      setItem: (key, value) => {
        if (failing) {
          throw quotaError();
        }

        written.set(key, value);
      },
    };

    const store = openStore({ today: TODAY, storage });
    expect(store.save(store.initial).ok).toBe(false);

    failing = false;

    expect(store.save(toggleDay(store.initial, 'walking', TODAY))).toEqual({ ok: true });
    expect(written.get(STORAGE_KEY)).toContain(TODAY);
  });

  it('writes the document sorted and duplicate-free', () => {
    const storage = fakeStorage();
    const unsorted: AppState = {
      schemaVersion: 1,
      log: { lifting: [], walking: ['2026-09-17', '2026-09-15', '2026-09-17'], 'no-snacking': [] },
      startedOn: '2026-09-15',
    };

    openStore({ today: TODAY, storage }).save(unsorted);

    expect(JSON.parse(storage.written.get(STORAGE_KEY) ?? '').log.walking).toEqual([
      '2026-09-15',
      '2026-09-17',
    ]);
  });

  it('persists no derived value', () => {
    const storage = fakeStorage();
    const store = openStore({ today: TODAY, storage });

    store.save(toggleDay(store.initial, 'walking', TODAY));

    expect(storage.written.get(STORAGE_KEY)).not.toMatch(/streak|miss/i);
  });
});

describe('browserStorage', () => {
  it('hands back the real store when one is usable', () => {
    expect(browserStorage()).not.toBeNull();
  });

  it('hands back null when even touching localStorage throws', () => {
    // Access itself throws when storage is disabled by policy — this cannot be
    // caught by guarding the call that follows it.
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(browserStorage()).toBeNull();
  });
});
