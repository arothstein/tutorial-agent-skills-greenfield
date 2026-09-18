import { describe, expect, it } from 'vitest';

/**
 * AC7: the app issues zero network requests.
 *
 * These five tests assert the guard installed in `tests/setup/no-network.ts` is
 * live. They are the tripwire, not the guarantee — the guarantee is that the
 * same stubs are loaded before every suite, so any production code reaching for
 * the network fails the run wherever it is called from.
 */
describe('the no-network guard (AC7)', () => {
  it('throws when anything calls fetch', () => {
    expect(() => fetch('/api/habits')).toThrow(/network access is forbidden/i);
  });

  it('throws when anything constructs an XMLHttpRequest', () => {
    expect(() => new XMLHttpRequest()).toThrow(/network access is forbidden/i);
  });

  it('throws when anything opens a WebSocket', () => {
    expect(() => new WebSocket('wss://example.test')).toThrow(/network access is forbidden/i);
  });

  it('throws when anything calls navigator.sendBeacon', () => {
    expect(() => navigator.sendBeacon('/beacon')).toThrow(/network access is forbidden/i);
  });

  it('throws when anything opens an EventSource', () => {
    expect(() => new EventSource('/stream')).toThrow(/network access is forbidden/i);
  });

  it('names the offending call so a failure points at the culprit', () => {
    expect(() => fetch('/api/habits')).toThrow(/fetch/);
  });
});
