/**
 * AC7: the app issues zero network requests.
 *
 * Loaded via `setupFiles` before every suite, so this is not a convention the
 * app is asked to respect — reaching for the network throws at the call site,
 * in whatever file made the call, and fails that run.
 *
 * It is installed before the feature code exists on purpose. A guard added at
 * the end only proves the app was clean on the day it was added; this one
 * protects every task written from here on.
 */

function describeArgument(value: unknown): string {
  return typeof value === 'string' ? `'${value}'` : String(value);
}

function forbid(call: string): never {
  throw new Error(
    `Network access is forbidden (AC7): ${call}. This app is local-only — ` +
      `state lives in localStorage and backups move as files.`,
  );
}

/**
 * Defined rather than assigned: several of these are read-only accessors in
 * jsdom, where a plain assignment silently does nothing.
 */
function install(host: object, name: string, stub: unknown): void {
  Object.defineProperty(host, name, { value: stub, configurable: true, writable: true });
}

install(globalThis, 'fetch', (input: unknown) => forbid(`fetch(${describeArgument(input)})`));

install(
  globalThis,
  'XMLHttpRequest',
  class {
    constructor() {
      forbid('new XMLHttpRequest()');
    }
  },
);

install(
  globalThis,
  'WebSocket',
  class {
    constructor(url: unknown) {
      forbid(`new WebSocket(${describeArgument(url)})`);
    }
  },
);

install(
  globalThis,
  'EventSource',
  class {
    constructor(url: unknown) {
      forbid(`new EventSource(${describeArgument(url)})`);
    }
  },
);

install(globalThis.navigator, 'sendBeacon', (url: unknown) =>
  forbid(`navigator.sendBeacon(${describeArgument(url)})`),
);
