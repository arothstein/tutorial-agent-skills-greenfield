/**
 * The app's one persistence boundary: `localStorage` in, `AppState` out.
 *
 * ## The contract
 *
 * `openStore` reads the stored document once and hands back a `HabitStore`:
 *
 * - `initial` — the state to render. **Always** a usable state, in every status.
 *   There is no failure mode where the caller is handed nothing and has to
 *   invent a fallback, because a second place that seeds a first run is a second
 *   place for it to go wrong.
 * - `status` — how that state was arrived at. The UI switches on `kind` to
 *   decide which banner, if any, to show.
 * - `save(state)` — never throws, and returns why it could not write.
 *
 * ## Why a store object rather than free `load` / `save` functions
 *
 * Some documents must not be written over: one from a newer build, or a damaged
 * one that could not be copied aside first. That decision is made while reading
 * and has to be enforced on every later write. A free `save(storage, state)`
 * could not know it, which would put the rule in the UI layer — where it is one
 * forgotten branch away from destroying the user's history. Holding it in the
 * object that owns the key makes the unsafe write unreachable instead.
 *
 * ## Failure modes
 *
 * | Stored value                    | `status.kind`          | Writes  |
 * |---------------------------------|------------------------|---------|
 * | A valid current document        | `stored`               | yes     |
 * | Nothing                         | `first-run`            | yes     |
 * | Unreadable — access threw       | `unavailable`          | refused |
 * | Invalid, copied aside           | `corrupt`              | yes     |
 * | Invalid, copy failed            | `corrupt`              | refused |
 * | Older than this build           | `unsupported-version`  | as above|
 * | Newer than this build           | `future-version`       | refused |
 *
 * Nothing is written while opening, on any path except quarantining a damaged
 * value — so a first run that the user never touches leaves no trace (AC6).
 */

import type { DateKey } from '../domain/dates';
import { emptyState, type AppState } from '../domain/model';
import { parseDocument, serializeDocument } from './schema';

/** The one key holding the one document (SPEC "Storage"). */
export const STORAGE_KEY = 'habit-tracker.v1';

/**
 * The slice of the `Storage` API this module uses.
 *
 * Two methods, so a test can supply a store that throws exactly where a real
 * browser throws. Deliberately no `removeItem`: nothing here ever deletes a
 * stored value.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** How the state in hand was arrived at. */
export type StoreStatus =
  /** A valid document was read. */
  | { readonly kind: 'stored' }
  /** Nothing was stored. Fresh seed, and nothing written yet. */
  | { readonly kind: 'first-run' }
  /** Storage could not be read. Memory-only for this session. */
  | { readonly kind: 'unavailable'; readonly detail: string }
  /** The stored value was unreadable. `quarantineKey` is null if copying it failed. */
  | {
      readonly kind: 'corrupt';
      readonly reason: string;
      readonly quarantineKey: string | null;
    }
  /** Older than this build, with no migration path. Same quarantine rules. */
  | {
      readonly kind: 'unsupported-version';
      readonly storedVersion: number;
      readonly reason: string;
      readonly quarantineKey: string | null;
    }
  /** Newer than this build. Read-only, so a downgrade cannot drop its fields. */
  | {
      readonly kind: 'future-version';
      readonly storedVersion: number;
      readonly reason: string;
    };

/** Why a save did not happen. */
export type SaveFailure =
  /** Out of room. The in-memory state survives; freeing space lets a retry work. */
  | { readonly kind: 'quota'; readonly detail: string }
  /** The write was rejected. Nothing will persist this session. */
  | { readonly kind: 'unavailable'; readonly detail: string }
  /** Writing would destroy a value this store must not overwrite. */
  | { readonly kind: 'read-only'; readonly detail: string };

export type SaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failure: SaveFailure };

export interface HabitStore {
  /** How `initial` was arrived at. */
  readonly status: StoreStatus;
  /** The state to render. Usable in every status. */
  readonly initial: AppState;
  /** Persists `state`. Never throws; reports why it could not write. */
  save(state: AppState): SaveResult;
}

export interface OpenOptions {
  /** Resolved by the caller, never read from the clock in here. */
  readonly today: DateKey;
  /** `null` means no usable store: the session runs in memory. */
  readonly storage: StorageLike | null;
  /** Stamps the quarantine key. Injected so the key is assertable in a test. */
  readonly now?: () => number;
}

/**
 * `window.localStorage`, or `null` when it cannot be used.
 *
 * The property access itself throws when storage is disabled by policy, which is
 * why this is a function with a `try` around it rather than a constant.
 */
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Quota names differ by engine; `code` 22 is the pre-`DOMException` spelling. */
function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false;
  }

  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22
  );
}

/**
 * Copies a value that failed to parse to a key of its own.
 *
 * Returns the key it landed on, or `null` if the copy failed — in which case the
 * caller must not write over the original, since the copy is the only thing that
 * made overwriting safe.
 */
function quarantine(storage: StorageLike, value: string, now: () => number): string | null {
  const key = `${STORAGE_KEY}.corrupt.${now()}`;

  try {
    storage.setItem(key, value);

    return key;
  } catch {
    return null;
  }
}

/** A store that holds state in memory and says why nothing will persist. */
function readOnlyStore(status: StoreStatus, initial: AppState, detail: string): HabitStore {
  return {
    status,
    initial,
    save: () => ({ ok: false, failure: { kind: 'read-only', detail } }),
  };
}

function writableStore(status: StoreStatus, initial: AppState, storage: StorageLike): HabitStore {
  return {
    status,
    initial,
    save: (state) => {
      try {
        storage.setItem(STORAGE_KEY, serializeDocument(state));

        return { ok: true };
      } catch (error) {
        const detail = detailOf(error);

        // Not latched: the document shrinks when the user un-logs a day, so a
        // later save can legitimately succeed where this one failed.
        return {
          ok: false,
          failure: isQuotaError(error) ? { kind: 'quota', detail } : { kind: 'unavailable', detail },
        };
      }
    },
  };
}

/**
 * Reads the stored document once and returns the store over it.
 *
 * Never throws. Every condition a browser can produce — disabled storage,
 * garbage under the key, a document from another build — comes back as a
 * `status` the UI can render, over a state the user can keep using.
 */
export function openStore({ today, storage, now = Date.now }: OpenOptions): HabitStore {
  const seed = emptyState(today);

  if (!storage) {
    return readOnlyStore(
      { kind: 'unavailable', detail: 'this browser has no usable local storage' },
      seed,
      'local storage is unavailable in this browser',
    );
  }

  let text: string | null;

  try {
    text = storage.getItem(STORAGE_KEY);
  } catch (error) {
    // Refusing to write here is the point: a key that could not be read may
    // still hold a real history, and a blind overwrite is how it is lost.
    const detail = detailOf(error);

    return readOnlyStore({ kind: 'unavailable', detail }, seed, detail);
  }

  if (text === null) {
    return writableStore({ kind: 'first-run' }, seed, storage);
  }

  const parsed = parseDocument(text);

  if (parsed.ok) {
    return writableStore({ kind: 'stored' }, parsed.state, storage);
  }

  if (parsed.kind === 'future-version') {
    return readOnlyStore(
      { kind: 'future-version', storedVersion: parsed.storedVersion, reason: parsed.reason },
      seed,
      `the stored data is version ${parsed.storedVersion}, which this build cannot write`,
    );
  }

  const quarantineKey = quarantine(storage, text, now);

  const status: StoreStatus =
    parsed.kind === 'corrupt'
      ? { kind: 'corrupt', reason: parsed.reason, quarantineKey }
      : {
          kind: 'unsupported-version',
          storedVersion: parsed.storedVersion,
          reason: parsed.reason,
          quarantineKey,
        };

  if (quarantineKey === null) {
    return readOnlyStore(
      status,
      seed,
      'the unreadable stored data could not be copied aside, so it will not be written over',
    );
  }

  return writableStore(status, seed, storage);
}
