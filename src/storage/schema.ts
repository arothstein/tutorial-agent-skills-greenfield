/**
 * The stored document: its shape, its version, and the rules for reading one
 * this build did not write.
 *
 * Everything crossing into the app from outside — `localStorage`, an imported
 * backup file — comes through `parseDocument`. Below this module the domain
 * trusts its types; above it, nothing is trusted. That boundary is the whole
 * point of the module: there is exactly one place where an unknown value
 * becomes an `AppState`, so there is exactly one place to get it right.
 */

import { isDateKey, type DateKey } from '../domain/dates';
import { HABITS } from '../domain/habits';
import type { AppState, HabitId } from '../domain/model';

/**
 * The version this build reads and writes.
 *
 * Bumped only on a breaking shape change, and a bump ships with its migration
 * step registered in `MIGRATIONS` plus a test that migrates a real captured
 * document of the previous version (SPEC "Migration policy").
 */
export const CURRENT_VERSION = 1;

/** Why a document could not become an `AppState`. */
export type ParseFailure =
  /** Unreadable or invalid. The caller quarantines it and starts fresh. */
  | { readonly ok: false; readonly kind: 'corrupt'; readonly reason: string }
  /** Newer than this build. The caller refuses to write rather than downgrade. */
  | {
      readonly ok: false;
      readonly kind: 'future-version';
      readonly storedVersion: number;
      readonly reason: string;
    }
  /** Older than anything this build can migrate. Quarantined, never guessed at. */
  | {
      readonly ok: false;
      readonly kind: 'unsupported-version';
      readonly storedVersion: number;
      readonly reason: string;
    };

export type ParseResult = { readonly ok: true; readonly state: AppState } | ParseFailure;

/** A document, mid-flight: parsed from JSON but not yet known to be valid. */
type RawDocument = Readonly<Record<string, unknown>>;

/**
 * One version step: reads a document at version `n` and returns it at `n + 1`.
 *
 * A step receives an already-parsed object and nothing else. It cannot read the
 * clock or storage, so migrating is reproducible and testable against a
 * captured document.
 */
export type Migration = (document: RawDocument) => RawDocument;

/**
 * Migration steps, keyed by the version each one reads.
 *
 * Empty, and correctly so: version 1 is the first there has ever been, so no
 * older document exists to migrate. This is the seam a future bump lands on —
 * add the step here, and `applyMigrations` picks it up with no other change.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = Object.freeze({});

export type MigrationResult =
  | { readonly ok: true; readonly document: RawDocument }
  | { readonly ok: false; readonly reason: string };

/**
 * Walks `document` from `fromVersion` up to `toVersion`, one registered step at
 * a time.
 *
 * A gap in the chain fails rather than skipping the missing step: jumping a
 * version would hand the validator a shape no released build ever wrote, and
 * the most likely outcome of guessing is a silently mangled history.
 */
export function applyMigrations(
  document: RawDocument,
  fromVersion: number,
  toVersion: number,
  steps: Readonly<Record<number, Migration>> = MIGRATIONS,
): MigrationResult {
  let migrated = document;

  for (let version = fromVersion; version < toVersion; version += 1) {
    const step = steps[version];

    if (!step) {
      return {
        ok: false,
        reason:
          `no migration is registered from schema version ${version} to ${version + 1}, ` +
          `so a version ${fromVersion} document cannot be read by this build`,
      };
    }

    migrated = step(migrated);
  }

  return { ok: true, document: migrated };
}

/** The longest a stored value is quoted back in a message shown to a human. */
const QUOTE_LIMIT = 24;

/** Quotes an offending value for a message, short enough to fit in a banner. */
function quote(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);

  if (typeof text !== 'string') {
    return String(value);
  }

  return text.length > QUOTE_LIMIT ? `'${text.slice(0, QUOTE_LIMIT)}…'` : `'${text}'`;
}

function corrupt(reason: string): ParseFailure {
  return { ok: false, kind: 'corrupt', reason };
}

/** True for a JSON object, excluding `null` and arrays, which `typeof` does not. */
function isRecord(value: unknown): value is RawDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates and normalizes one habit's entries.
 *
 * Sorting and de-duplicating is a repair, not an acceptance of invalid data: a
 * set of calendar dates has exactly one sorted, duplicate-free form, so the fix
 * cannot guess wrong. Quarantining over an ordering slip would cost the user a
 * real history to satisfy an invariant this module can simply restore. A
 * malformed *date*, by contrast, has no correct repair and is rejected.
 */
function readEntries(
  log: RawDocument,
  habitId: HabitId,
): { readonly ok: true; readonly days: DateKey[] } | ParseFailure {
  const entries = log[habitId];

  if (entries === undefined) {
    return corrupt(`the stored log has no entry for '${habitId}'`);
  }

  if (!Array.isArray(entries)) {
    return corrupt(`the stored log for '${habitId}' is not a list of dates`);
  }

  for (const entry of entries) {
    if (!isDateKey(entry)) {
      return corrupt(`the stored log for '${habitId}' holds ${quote(entry)}, which is not a date`);
    }
  }

  return { ok: true, days: [...new Set<DateKey>(entries)].sort() };
}

function readLog(document: RawDocument): ParseResult {
  const log = document.log;

  if (!isRecord(log)) {
    return corrupt('the stored document has no habit log');
  }

  const known = new Set<string>(HABITS.map((habit) => habit.id));
  const unknown = Object.keys(log).filter((key) => !known.has(key));

  if (unknown.length > 0) {
    // A habit this build does not define means the document came from a
    // different build. Dropping it would destroy data the user can still see,
    // so the document is quarantined whole instead.
    return corrupt(`the stored log holds unknown habits: ${unknown.map(quote).join(', ')}`);
  }

  const startedOn = document.startedOn;

  if (!isDateKey(startedOn)) {
    return corrupt(`the stored start date ${quote(startedOn)} is not a calendar date`);
  }

  const walking = readEntries(log, 'walking');

  if (!walking.ok) {
    return walking;
  }

  const snacking = readEntries(log, 'no-snacking');

  if (!snacking.ok) {
    return snacking;
  }

  const lifting = readEntries(log, 'lifting');

  if (!lifting.ok) {
    return lifting;
  }

  return {
    ok: true,
    state: {
      schemaVersion: 1,
      log: {
        walking: walking.days,
        'no-snacking': snacking.days,
        lifting: lifting.days,
      },
      startedOn,
    },
  };
}

/**
 * Turns stored text into an `AppState`, or says why it cannot.
 *
 * Never throws: every condition a real browser can produce is a returned
 * failure the caller can render. Only a bug throws.
 */
export function parseDocument(text: string): ParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    return corrupt(`the stored value is not valid JSON (${detail})`);
  }

  if (!isRecord(parsed)) {
    return corrupt('the stored value is not a JSON object');
  }

  const version = parsed.schemaVersion;

  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return corrupt(`the stored schema version ${quote(version)} is not a whole number`);
  }

  if (version > CURRENT_VERSION) {
    return {
      ok: false,
      kind: 'future-version',
      storedVersion: version,
      reason:
        `the stored data is version ${version}, and this build reads version ` +
        `${CURRENT_VERSION}. Reading it would mean guessing at fields this build ` +
        `does not know, and writing it back would drop them.`,
    };
  }

  if (version < CURRENT_VERSION) {
    const migrated = applyMigrations(parsed, version, CURRENT_VERSION);

    if (!migrated.ok) {
      return {
        ok: false,
        kind: 'unsupported-version',
        storedVersion: version,
        reason: migrated.reason,
      };
    }

    return readLog(migrated.document);
  }

  return readLog(parsed);
}

/**
 * The document to store, as text.
 *
 * Built field by field rather than by stringifying the state whole: a derived
 * value that ever reaches an `AppState` still cannot reach the disk from here,
 * and the sorted, duplicate-free log invariant is guaranteed at the boundary
 * rather than assumed of every caller.
 */
export function serializeDocument(state: AppState): string {
  const log = Object.fromEntries(
    HABITS.map((habit) => [habit.id, [...new Set(state.log[habit.id])].sort()]),
  );

  return JSON.stringify({
    schemaVersion: CURRENT_VERSION,
    log,
    startedOn: state.startedOn,
  });
}
