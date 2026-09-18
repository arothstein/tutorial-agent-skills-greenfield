import { getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HabitId } from '../src/domain/model';
import { startApp } from '../src/app';
import { STORAGE_KEY, type StorageLike } from '../src/storage/localStore';

/** Thursday. The reference "today" for every case below. */
const TODAY = '2026-09-17';

let root: HTMLElement;

beforeEach(() => {
  root = document.createElement('div');
  document.body.append(root);
});

afterEach(() => {
  root.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

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

/** A stored document holding `log`, as `localStorage` would hold it. */
function storedLog(
  log: Partial<Record<HabitId, readonly string[]>>,
  startedOn: string,
): Record<string, string> {
  return {
    [STORAGE_KEY]: JSON.stringify({
      schemaVersion: 1,
      log: { lifting: [], walking: [], 'no-snacking': [], ...log },
      startedOn,
    }),
  };
}

/** Every day from `first` to `last` inclusive. Test arithmetic, not the app's. */
function days(first: string, last: string): string[] {
  const all: string[] = [];

  for (let day = new Date(`${first}T12:00:00`); ; day.setDate(day.getDate() + 1)) {
    const key = `${day.getFullYear()}-${`${day.getMonth() + 1}`.padStart(2, '0')}-${`${day.getDate()}`.padStart(2, '0')}`;
    all.push(key);

    if (key === last) {
      return all;
    }
  }
}

function habitRow(habitId: HabitId): HTMLElement {
  const row = root.querySelector<HTMLElement>(`[data-habit="${habitId}"]`);

  if (!row) {
    throw new Error(`no row rendered for '${habitId}'`);
  }

  return row;
}

/** The streak readout of one row, as a screen reader would read it. */
function streakText(habitId: HabitId): string {
  return habitRow(habitId).querySelector('[data-streak]')?.textContent?.trim() ?? '';
}

function toggleOf(habitId: HabitId): HTMLElement {
  return getByRole(habitRow(habitId), 'button');
}

/** The text of every banner currently shown. */
function banners(): string[] {
  return [...root.querySelectorAll('[data-notice]')].map(
    (notice) => notice.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

describe('the three habit rows (AC1)', () => {
  it('renders one row per habit', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    expect(root.querySelectorAll('[data-habit]')).toHaveLength(3);
  });

  it('names each habit', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    expect([...root.querySelectorAll('[data-habit]')].map((row) => row.getAttribute('data-habit'))).toEqual(
      ['walking', 'no-snacking', 'lifting'],
    );
    expect(habitRow('lifting').textContent).toContain('Lifting weights');
  });

  it('renders the three streaks independently, never as one number', () => {
    // Walking: 12 closed days all logged. Not snacking: 3. Lifting: 2 weeks.
    const storage = fakeStorage(
      storedLog(
        {
          walking: days('2026-09-05', '2026-09-16'),
          'no-snacking': days('2026-09-14', '2026-09-16'),
          lifting: [
            '2026-08-31',
            '2026-09-01',
            '2026-09-02',
            '2026-09-07',
            '2026-09-08',
            '2026-09-09',
          ],
        },
        '2026-09-05',
      ),
    );

    startApp({ root, today: TODAY, storage });

    expect(streakText('walking')).toBe('12 days');
    expect(streakText('no-snacking')).toBe('3 days');
    expect(streakText('lifting')).toBe('2 weeks');
  });

  it('shows no summed or averaged number anywhere on the page', () => {
    const storage = fakeStorage(
      storedLog({ walking: days('2026-09-14', '2026-09-16') }, '2026-09-14'),
    );

    startApp({ root, today: TODAY, storage });

    expect(root.textContent).not.toMatch(/total|overall|average|combined/i);
  });

  it('puts the date on the page once, as a machine-readable time', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    const time = root.querySelector('time');

    expect(time?.getAttribute('datetime')).toBe(TODAY);
    expect(time?.textContent).toBe('Thu 17 Sep 2026');
  });
});

describe('marking today done (AC2, D1)', () => {
  it('increments the streak immediately', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    toggleOf('walking').click();

    expect(streakText('walking')).toBe('1 day');
  });

  it('reflects the new state on the toggle itself', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });
    expect(toggleOf('walking').getAttribute('aria-pressed')).toBe('false');

    toggleOf('walking').click();

    expect(toggleOf('walking').getAttribute('aria-pressed')).toBe('true');
  });

  it('un-logs on a second click, with no confirmation (D1)', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    toggleOf('walking').click();
    toggleOf('walking').click();

    expect(toggleOf('walking').getAttribute('aria-pressed')).toBe('false');
    expect(queryByRole(root, 'dialog')).toBeNull();
  });

  it('leaves the other two habits alone', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    toggleOf('walking').click();

    expect(toggleOf('no-snacking').getAttribute('aria-pressed')).toBe('false');
    expect(streakText('lifting')).toBe('0');
  });

  it('persists the day under the one storage key', () => {
    const storage = fakeStorage();
    startApp({ root, today: TODAY, storage });

    toggleOf('walking').click();

    expect(JSON.parse(storage.written.get(STORAGE_KEY) ?? '').log.walking).toEqual([TODAY]);
  });

  it('writes nothing before the first mutation (AC6)', () => {
    const storage = fakeStorage();
    startApp({ root, today: TODAY, storage });

    expect(storage.written.size).toBe(0);
  });

  it('renders identically after a reload (AC6)', () => {
    const storage = fakeStorage();
    startApp({ root, today: TODAY, storage });
    toggleOf('walking').click();
    toggleOf('lifting').click();

    // The card, not the whole page: the live region holds a transcript of what
    // was announced this session, which a reload correctly starts empty.
    const before = root.querySelector('.card')?.innerHTML;

    const reloaded = document.createElement('div');
    document.body.append(reloaded);
    startApp({ root: reloaded, today: TODAY, storage });

    expect(reloaded.querySelector('.card')?.innerHTML).toBe(before);
    expect(before).toContain('Done today');
    reloaded.remove();
  });

  it('re-renders from state alone, so drawing twice changes nothing', () => {
    const storage = fakeStorage();
    startApp({ root, today: TODAY, storage });
    toggleOf('walking').click();
    const once = root.innerHTML;

    toggleOf('walking').click();
    toggleOf('walking').click();

    expect(root.innerHTML).toBe(once);
  });
});

describe('forgiveness (AC3, AC4)', () => {
  it('annotates a single miss without reducing the count', () => {
    // Eleven logged days, then one missed. Today is untouched and is not a miss.
    const storage = fakeStorage(
      storedLog({ walking: days('2026-09-05', '2026-09-15') }, '2026-09-05'),
    );

    startApp({ root, today: TODAY, storage });

    expect(streakText('walking')).toBe('11 days, one miss');
  });

  it('holds the count when the miss is back-filled away', () => {
    const storage = fakeStorage(
      storedLog({ walking: days('2026-09-05', '2026-09-15') }, '2026-09-05'),
    );
    startApp({ root, today: TODAY, storage });

    toggleOf('walking').click();

    expect(streakText('walking')).toBe('12 days, one miss');
  });

  it('resets to zero on two consecutive misses', () => {
    const storage = fakeStorage(
      storedLog({ walking: days('2026-09-05', '2026-09-14') }, '2026-09-05'),
    );

    startApp({ root, today: TODAY, storage });

    expect(streakText('walking')).toBe('0');
  });

  it('frames a reset as a restart, not a loss', () => {
    const storage = fakeStorage(
      storedLog({ walking: days('2026-09-05', '2026-09-14') }, '2026-09-05'),
    );

    startApp({ root, today: TODAY, storage });

    expect(habitRow('walking').textContent).toContain('Start again today');
    expect(habitRow('walking').textContent).not.toMatch(/lost|broken|failed|streak gone/i);
  });

  it('starts a clean streak at one on the next day logged', () => {
    const storage = fakeStorage(
      storedLog({ walking: days('2026-09-05', '2026-09-14') }, '2026-09-05'),
    );
    startApp({ root, today: TODAY, storage });

    toggleOf('walking').click();

    expect(streakText('walking')).toBe('1 day');
  });

  it('counts scattered misses as annotations, not resets', () => {
    // H M H M H over five closed days.
    const storage = fakeStorage(
      storedLog({ walking: ['2026-09-12', '2026-09-14', '2026-09-16'] }, '2026-09-12'),
    );

    startApp({ root, today: TODAY, storage });

    expect(streakText('walking')).toBe('3 days, two misses');
  });
});

describe('lifting: weeks, not days (AC5, D2)', () => {
  /** Two closed weeks hit, and two of three days logged in the open week. */
  function twoWeeksIn(): StorageLike & { readonly written: Map<string, string> } {
    return fakeStorage(
      storedLog(
        {
          lifting: [
            '2026-08-31',
            '2026-09-01',
            '2026-09-02',
            '2026-09-07',
            '2026-09-08',
            '2026-09-09',
            '2026-09-14',
            '2026-09-16',
          ],
        },
        '2026-08-31',
      ),
    );
  }

  it('labels the streak in weeks', () => {
    startApp({ root, today: TODAY, storage: twoWeeksIn() });

    expect(streakText('lifting')).toBe('2 weeks');
  });

  it('shows what the open week still owes', () => {
    startApp({ root, today: TODAY, storage: twoWeeksIn() });

    expect(habitRow('lifting').textContent).toContain('2 of 3 this week');
    expect(habitRow('lifting').textContent).toContain('4 days left');
  });

  it('ticks the streak up the moment the third day lands, without waiting for Sunday', () => {
    startApp({ root, today: TODAY, storage: twoWeeksIn() });

    toggleOf('lifting').click();

    expect(streakText('lifting')).toBe('3 weeks');
    expect(habitRow('lifting').textContent).toContain('3 of 3 this week');
  });

  it('carries the weekly progress in text, not in the pips alone', () => {
    // Colour and shape are never the only channel; the pips are decoration over
    // a sentence that already says it.
    startApp({ root, today: TODAY, storage: twoWeeksIn() });
    const pips = habitRow('lifting').querySelector('[data-pips]');

    expect(pips?.getAttribute('aria-hidden')).toBe('true');
    expect(habitRow('lifting').textContent).toContain('2 of 3 this week');
  });

  it('gives the daily habits no weekly progress line', () => {
    startApp({ root, today: TODAY, storage: twoWeeksIn() });

    expect(habitRow('walking').querySelector('[data-pips]')).toBeNull();
    expect(habitRow('walking').textContent).not.toContain('this week');
  });
});

describe('first run', () => {
  it('shows every streak at zero', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    expect(streakText('walking')).toBe('0');
    expect(streakText('no-snacking')).toBe('0');
    expect(streakText('lifting')).toBe('0');
  });

  it('invites the first mark instead of showing a modal', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    expect(root.textContent).toContain('Start by marking today');
    expect(queryByRole(root, 'dialog')).toBeNull();
  });

  it('says it once for the page, not once per row', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    expect(root.textContent?.match(/Start by marking today/g)).toHaveLength(1);
  });

  it('drops the hint the moment anything is logged', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    toggleOf('walking').click();

    expect(root.textContent).not.toContain('Start by marking today');
  });
});

describe('accessibility', () => {
  it('gives the page one heading and a list of habits', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    expect(getByRole(root, 'heading', { level: 1 }).textContent).toBe('Habits');
    expect(root.querySelectorAll('ul[role="list"] > li')).toHaveLength(3);
  });

  it('makes every toggle a real, tab-reachable button', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    for (const habitId of ['walking', 'no-snacking', 'lifting'] as const) {
      const toggle = toggleOf(habitId);

      expect(toggle.tagName).toBe('BUTTON');
      expect(toggle.getAttribute('type')).toBe('button');
      expect(toggle.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('names each toggle with its habit, so three buttons are distinguishable', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    expect(getByRole(habitRow('no-snacking'), 'button').textContent).toContain('Not snacking');
  });

  it('keeps focus on the toggle that was just pressed', () => {
    // A full re-render replaces the button. Losing focus to the body here would
    // strand a keyboard user after every single mark.
    startApp({ root, today: TODAY, storage: fakeStorage() });
    const toggle = toggleOf('walking');
    toggle.focus();

    toggle.click();

    expect(document.activeElement).toBe(toggleOf('walking'));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('announces the change in a live region', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    toggleOf('walking').click();

    expect(getByRole(root, 'status').textContent).toBe(
      'Walking marked done for today. Streak 1 day.',
    );
  });

  it('keeps the live region in the DOM across renders, so it is not missed', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });
    const region = getByRole(root, 'status');

    toggleOf('walking').click();

    expect(getByRole(root, 'status')).toBe(region);
  });

  it('announces an un-mark too', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    toggleOf('walking').click();
    toggleOf('walking').click();

    expect(getByRole(root, 'status').textContent).toBe(
      'Walking no longer marked for today. Streak 0.',
    );
  });
});

describe('storage failures stay on the page, not in the console', () => {
  it('warns that nothing will be saved when storage is unavailable', () => {
    startApp({ root, today: TODAY, storage: null });

    expect(banners().join(' ')).toContain("Changes won't be saved on this device");
  });

  it('stays usable in memory-only mode', () => {
    startApp({ root, today: TODAY, storage: null });

    toggleOf('walking').click();

    expect(streakText('walking')).toBe('1 day');
  });

  it('says where a corrupt value was set aside and that a backup can restore it', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{ not json' });

    startApp({ root, today: TODAY, storage, now: () => 1_759_000_000_000 });

    const banner = banners().join(' ');
    expect(banner).toContain('habit-tracker.v1.corrupt.1759000000000');
    expect(banner).toContain('backup');
  });

  it('renders the empty state beneath the corruption banner', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{ not json' });

    startApp({ root, today: TODAY, storage });

    expect(streakText('walking')).toBe('0');
    expect(root.querySelectorAll('[data-habit]')).toHaveLength(3);
  });

  it('warns without writing when the stored data is from a newer build', () => {
    const newer = JSON.stringify({
      schemaVersion: 2,
      log: { lifting: [], walking: [], 'no-snacking': [] },
      startedOn: '2026-09-01',
    });
    const storage = fakeStorage({ [STORAGE_KEY]: newer });

    startApp({ root, today: TODAY, storage });
    toggleOf('walking').click();

    expect(banners().join(' ')).toContain('newer version');
    expect(storage.written.get(STORAGE_KEY)).toBe(newer);
  });

  it('explains data from an older build, and where it went', () => {
    const older = JSON.stringify({
      schemaVersion: 0,
      log: { lifting: [], walking: [], 'no-snacking': [] },
      startedOn: '2026-09-01',
    });
    const storage = fakeStorage({ [STORAGE_KEY]: older });

    startApp({ root, today: TODAY, storage, now: () => 1_759_000_000_000 });

    const banner = banners().join(' ');
    expect(banner).toContain('older version');
    expect(banner).toContain('habit-tracker.v1.corrupt.1759000000000');
    expect(storage.written.get(`${STORAGE_KEY}.corrupt.1759000000000`)).toBe(older);
  });

  it('reports a rejected write that is not a quota problem', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('write denied by policy', 'SecurityError');
      },
    };

    startApp({ root, today: TODAY, storage });
    toggleOf('walking').click();

    const banner = banners().join(' ');
    expect(banner).toContain("That change wasn't saved");
    expect(banner).toContain('write denied by policy');
    expect(streakText('walking')).toBe('1 day');
  });

  it('surfaces a quota failure while keeping the session alive', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    };

    startApp({ root, today: TODAY, storage });
    toggleOf('walking').click();

    expect(banners().join(' ')).toContain('out of space');
    expect(streakText('walking')).toBe('1 day');
  });

  it('tells a screen reader user the change was not saved', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    };

    startApp({ root, today: TODAY, storage });
    toggleOf('walking').click();

    expect(getByRole(root, 'status').textContent).toBe(
      'Walking marked done for today. Streak 1 day. Not saved: the browser is out of space.',
    );
  });

  it('clears a save failure once a save succeeds again', () => {
    let failing = true;
    const written = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => written.get(key) ?? null,
      setItem: (key, value) => {
        if (failing) {
          throw new DOMException('quota', 'QuotaExceededError');
        }

        written.set(key, value);
      },
    };

    startApp({ root, today: TODAY, storage });
    toggleOf('walking').click();
    expect(banners().join(' ')).toContain('out of space');

    failing = false;
    toggleOf('no-snacking').click();

    expect(banners().join(' ')).not.toContain('out of space');
  });

  it('shows no banner at all when everything is fine', () => {
    startApp({ root, today: TODAY, storage: fakeStorage() });

    expect(banners()).toEqual([]);
  });

  it('never reports a problem by throwing', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    };

    expect(() => {
      startApp({ root, today: TODAY, storage });
      toggleOf('walking').click();
    }).not.toThrow();
  });
});

describe('the clock is read in exactly one place (Task 9)', () => {
  /** Every module under `src/`, as source text, keyed by path. */
  const sources = import.meta.glob('../src/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Readonly<Record<string, string>>;

  /** Source with comments stripped, so a comment *about* a trap is not a hit. */
  function code(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  function offenders(prefixes: readonly string[], pattern: RegExp): string[] {
    return Object.entries(sources)
      .filter(([path]) => prefixes.some((prefix) => path.startsWith(prefix)))
      .filter(([, source]) => pattern.test(code(source)))
      .map(([path]) => path);
  }

  it('finds the modules it is meant to be checking', () => {
    // A glob that silently matched nothing would make every check below pass.
    expect(Object.keys(sources).length).toBeGreaterThan(8);
  });

  it('reads the clock nowhere in the domain or the UI', () => {
    // `today` is injected from `main.ts` downward. A clock read below it is one
    // no test can pin, and the bug it hides only shows up for someone in a
    // different timezone at 11pm. `new Date(y, m, d)` is fine — that is
    // arithmetic on a date it was handed, not a reading of now.
    expect(offenders(['../src/domain/', '../src/ui/'], /new Date\(\s*\)|Date\.now/)).toEqual([]);
  });

  it('keeps the domain free of storage and the DOM', () => {
    expect(offenders(['../src/domain/'], /localStorage|document\.|window\./)).toEqual([]);
  });

  it('never formats a date through toISOString', () => {
    // It renders the UTC instant, which is a different calendar day for most of
    // the evening in western timezones.
    expect(offenders(['../src/'], /toISOString/)).toEqual([]);
  });
});
