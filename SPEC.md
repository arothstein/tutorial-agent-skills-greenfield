# Spec: Habit Tracker

Status: **draft, awaiting review**
Derived from [docs/intent/habit-tracker.md](docs/intent/habit-tracker.md) (intent confirmed 2026-09-17).
Spec drafted 2026-09-17.

---

## Assumptions

These were not stated in the intent. Correct them now or the spec proceeds on them.

1. **Vanilla TypeScript + Vite**, no UI framework. The app is one page with
   three rows; React/Svelte would be more build than app. Vitest for tests.
2. **Desktop browser, one machine, modern evergreen engine.** No mobile layout
   work beyond not breaking at narrow widths (intent: phone is out of scope).
3. **Local device time** defines the day and week boundary — not UTC. Date keys
   are local calendar dates.
4. **Deployed as static files** opened from disk or a local static server. No
   build-time environment config, no hosting story.

## Decisions taken on the intent's open questions

The intent left three items "Open for the spec". Resolved here; each is
reversible and flagged for review.

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Same day logged twice | Logging is a **toggle over a calendar day**, not an append. A second tap un-logs that day. A day holds at most one completion per habit — including lifting. | Idempotent, makes double-tap harmless, and makes "3x per week" mean *three distinct days*, which is how the target is actually meant. |
| D2 | Lifting mid-week display | Show `2 of 3 this week` + three pips + days remaining, alongside the week streak. The open week is neither a hit nor a miss until Sunday closes — **unless** it already reaches 3, which promotes it to a hit immediately and ticks the streak up. | The user needs to know what is still owed this week; and hitting the target should feel like it counted the moment it happened. |
| D3 | Miss annotation after reset | The annotation is **derived, never stored**. It describes the *current* streak, so a reset clears it to `0` with no inherited misses. The underlying log is never mutated — history keeps the real gaps forever. | Keeps the log a factual record and the streak a pure function of it. |

---

## Objective

A single-page habit tracker for one person — the author — running entirely in
one browser on one machine, tracking three fixed habits with three independent
streaks.

**The problem being solved:** previous trackers zeroed a long streak over a
single bad day, and that caused abandonment. This one forgives one miss.

**Users:** the author, alone. No accounts, no sharing, no second audience.

**Success:** still being opened in month three — specifically, opened *after* a
bad week. The behavioral proxy for that is: a single missed day never displays
a zeroed streak.

### Acceptance criteria

- **AC1** — Three habits render with three separate streak counts; no combined
  number appears anywhere in the UI.
- **AC2** — Logging a daily habit for today increments its streak immediately.
- **AC3** — Missing one day annotates the streak (`11, one miss`) and does
  **not** reduce the count.
- **AC4** — Missing two consecutive days sets that habit's streak to `0`.
- **AC5** — Lifting's streak counts Mon–Sun weeks containing at least 3 logged
  days, under the same one-forgiven / two-resets rule at week granularity.
- **AC6** — All state survives a page reload and a browser restart.
- **AC7** — The app issues zero network requests. Verified by an explicit test.
- **AC8** — **Save backup** writes a JSON file that **Load backup** restores to
  an identical state.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript 5.x, `strict: true` |
| Build / dev | Vite 6.x |
| UI | No framework. DOM + template literals |
| Styling | Plain CSS, custom properties, one stylesheet |
| Persistence | `window.localStorage` |
| Test runner | Vitest 3.x |
| DOM tests | jsdom + `@testing-library/dom` |

Runtime dependencies: **none**. Everything above is a devDependency.

## Commands

```
Install:   pnpm install
Dev:       pnpm run dev              # vite, localhost:5173
Build:     pnpm run build            # tsc --noEmit && vite build
Preview:   pnpm run preview
Test:      pnpm test                 # vitest run
Watch:     pnpm run test:watch       # vitest
Coverage:  pnpm test -- --coverage
Typecheck: pnpm run typecheck        # tsc --noEmit
Lint:      pnpm run lint             # eslint . --max-warnings 0
Lint fix:  pnpm run lint -- --fix
```

## Project Structure

```
src/
  main.ts              -> Entry point: wires storage -> state -> render
  domain/
    habits.ts          -> The three habit definitions (frozen constant)
    dates.ts           -> Local-date keys, day/week arithmetic, week boundaries
    streak.ts          -> Streak engine. Pure. No I/O, no clock access.
    model.ts           -> AppState types, defaults, invariants
  storage/
    localStore.ts      -> load/save against localStorage, quota + corruption handling
    backup.ts          -> Export to file, import from file, validation
  ui/
    render.ts          -> Full re-render from state
    todayCard.ts       -> The three habit rows
    historyStrip.ts    -> 14-day grid
    backupBar.ts       -> Save/Load controls
  styles.css
tests/
  streak.test.ts       -> Table-driven streak cases (the critical suite)
  dates.test.ts        -> Week boundaries, DST, month/year rollover
  localStore.test.ts   -> Round-trip, corruption, quota, migration
  backup.test.ts       -> Export/import fidelity and rejection cases
  app.test.ts          -> jsdom integration: click -> state -> render
docs/
  intent/habit-tracker.md
SPEC.md
index.html
```

## Data Model

### Storage

One `localStorage` key holding one JSON document.

- **Key:** `habit-tracker.v1`
- **Written:** synchronously after every state mutation (the document is a few
  KB at most; there is nothing to debounce).
- **Read:** once, at startup.

### Shape

```ts
type HabitId = 'lifting' | 'walking' | 'no-snacking';

/** Local calendar date, 'YYYY-MM-DD'. Never a UTC ISO timestamp. */
type DateKey = string;

interface AppState {
  schemaVersion: 1;
  /** Per habit: the set of local dates on which it was completed.
   *  Presence = done. Absence = not done. There is no `false`. */
  log: Record<HabitId, DateKey[]>;
  /** First date the tracker was used. Streaks are never evaluated before this. */
  startedOn: DateKey;
}
```

Example document:

```json
{
  "schemaVersion": 1,
  "log": {
    "lifting":     ["2026-09-08", "2026-09-10", "2026-09-12", "2026-09-15"],
    "walking":     ["2026-09-14", "2026-09-15", "2026-09-17"],
    "no-snacking": ["2026-09-15", "2026-09-16", "2026-09-17"]
  },
  "startedOn": "2026-09-08"
}
```

### Why this shape

- **Habit definitions are code, not data.** The three habits and their cadences
  are fixed (intent: adding/editing habits is out of scope), so they live in
  `domain/habits.ts` as a frozen constant. Storing them would invite an editor
  UI that is explicitly a non-goal.
- **Sorted date arrays, not maps of booleans.** A date is present or it is not
  (D1) — there is no count to store and no `false` state to drift out of sync.
  Arrays are kept sorted ascending and duplicate-free; that is a stored invariant.
- **No derived values are persisted.** Streaks, miss annotations, and weekly
  progress are computed from `log` on every render. There is no cache to
  invalidate and no way for a stored streak to disagree with the log.
- **`startedOn` bounds the walk.** Without it, a first-run app would evaluate an
  infinite past of misses.

### Integrity and failure handling

| Condition | Behavior |
|---|---|
| Key absent | First run. Seed `startedOn = today`, empty logs. Do not write until the first real mutation. |
| `localStorage` throws on read/write (private mode, disabled) | Run in **memory-only mode**. Show a persistent warning banner. Do not crash. |
| JSON unparseable, or fails schema validation | Do **not** overwrite. Preserve the bad value at `habit-tracker.v1.corrupt.<timestamp>`, start fresh, and tell the user where the old value went and that **Load backup** can restore. |
| `QuotaExceededError` on write | Surface a non-dismissable error; keep the in-memory state so the session is not lost. |
| Unknown `schemaVersion` (a future version) | Refuse to load. Read-only warning rather than a lossy downgrade. |

Migration policy: `schemaVersion` is bumped only on a breaking shape change, and
a bump ships with a migration function `v(n-1) -> v(n)` plus a test that migrates
a real captured v(n-1) document.

### Backup file

The same document plus provenance. Written via `Blob` + object URL download;
read via `<input type="file">`.

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-09-17T21:40:00.000Z",
  "log": { "lifting": [], "walking": [], "no-snacking": [] },
  "startedOn": "2026-09-08"
}
```

- Filename: `habit-tracker-backup-2026-09-17.json`
- Import is **replace-all, never merge**, behind a confirmation naming what is
  being discarded ("replaces 47 logged days"). Merging two divergent histories
  has no correct answer and there is only one device.
- Import validates before replacing. An invalid file changes nothing and reports
  why.

---

## Streak Rules

### Periods

A streak is a walk over **periods**, not over raw log entries.

| Habit | Period | Target |
|---|---|---|
| Walking | Calendar day | 1 logged day |
| Not snacking | Calendar day | 1 logged day |
| Lifting | **Monday–Sunday** week | at least 3 distinct logged days |

The lifting week is Mon–Sun and is evaluated at the close of Sunday. It is
**not** a rolling 7-day window.

### The open period

Today (or the current week) is still in progress and must never be scored as a
miss. The period list therefore runs:

1. Every period from the period containing `startedOn` through the **last closed
   period** (yesterday; last completed Sunday).
2. Plus the **current open period, appended only if it already hits** its target
   (D2).

### The engine

```ts
interface Streak { count: number; misses: number; }

/** periods: chronological, oldest first. Each is already scored hit/miss. */
export function computeStreak(periods: readonly Period[]): Streak {
  let count = 0;
  let misses = 0;
  let prevWasMiss = false;

  for (const period of periods) {
    if (period.hit) {
      count += 1;
      prevWasMiss = false;
    } else if (prevWasMiss) {
      count = 0;      // second consecutive miss resets
      misses = 0;
    } else {
      misses += 1;    // first miss is forgiven; count is held, not incremented
      prevWasMiss = true;
    }
  }

  return { count, misses };
}
```

Stated plainly:

- A hit increments the count.
- A **single** miss neither increments nor resets — it is recorded as a
  forgiveness against the current streak and the count is held.
- A **second consecutive** miss resets both count and forgiveness to zero.
- Non-consecutive misses accumulate as annotations (`11, two misses`); only
  *adjacency* resets.
- After a reset, the next hit starts a clean streak at `1` with zero misses (D3).

### Worked cases

`H` = period hit, `M` = period missed, oldest to newest.

| Period sequence | Result | Label |
|---|---|---|
| `HHH` | 3, 0 misses | `3` |
| `HHHHHHHHHHHM` | 11, 1 miss | `11, one miss` |
| `HHHHHHHHHHHMH` | 12, 1 miss | `12, one miss` |
| `HHHHHHHHHHHMM` | 0, 0 | `0` |
| `HHHHHHHHHHHMMH` | 1, 0 | `1` |
| `HMHMH` | 3, 2 misses | `3, two misses` |
| `HHHHHMMM` | 0, 0 | `0` |
| *(nothing logged yet)* | 0, 0 | `0` |

### Timekeeping

- The current date enters the domain **only** as an injected `today: DateKey`
  parameter. No function under `src/domain/` calls `new Date()`.
- Date keys are formatted from local components (`getFullYear`/`getMonth`/
  `getDate`), never `toISOString()` — the latter silently shifts the day across
  the UTC boundary.
- Day arithmetic goes through `dates.ts` helpers that normalize to local noon
  before adding days, so a DST transition cannot produce a 23- or 25-hour "day"
  that skips or repeats a date.
- Back-filling recomputes everything from scratch. There is no incremental streak
  update, so an edited past day is always fully reflected.

---

## Screens and States

One page, three regions, no routing and no navigation.

```
+----------------------------------------------+
|  Habits                      Thu 17 Sep 2026 |
+----------------------------------------------+
|  Walking                                     |
|  [x done today]              12, one miss    |
|                                              |
|  Not snacking                                |
|  [  mark done ]              3               |
|                                              |
|  Lifting weights                             |
|  [  log session]  ((.))  2 of 3 this week    |
|                   4 days left      6 weeks   |
+----------------------------------------------+
|  Last 14 days                                |
|  Walking       # # . # # # # # . # # # # #   |
|  Not snacking  # # # # # . # # # # # # # #   |
|  Lifting       # . # . # . . # . # .  .  .   |
+----------------------------------------------+
|  [Save backup]  [Load backup...]             |
+----------------------------------------------+
```

### Region 1 — Today

Three rows. Each row: habit name, a toggle control, and its streak.

- **Daily habits** — one toggle. Untoggling is immediate and needs no
  confirmation (D1: it is a correction, not a destructive act).
- **Lifting** — the same toggle for *today*, plus weekly progress: three pips,
  `N of 3 this week`, and days remaining in the week. The week streak sits beside
  it, labeled in weeks so it is never confused with a day count.

### Region 2 — History strip

The last 14 days, one row per habit, oldest to newest, with weekday markers and
Monday separators so lifting weeks are visually legible.

Each cell is clickable and toggles that day — this **is** the back-fill
mechanism (D1). Scope of editing is exactly these 14 days; anything older is
reachable only by editing a backup file and re-importing. Rationale: 14 days
covers "I forgot to log the week I had the flu" without building a date picker
and a calendar view that the intent rules out.

### Region 3 — Backup bar

**Save backup** and **Load backup...**. Nothing else; no settings, no export
formats, no cloud affordance.

### States

| State | Trigger | Presentation |
|---|---|---|
| First run | No stored key | Streaks show `0`; history strip empty; a one-line "Start by marking today" hint. No modal, no onboarding. |
| Normal | Any log data | As drawn above |
| All done today | All three daily targets met | Rows read as complete. A quiet acknowledgment — no confetti, no sound. |
| Streak with forgiveness | `misses > 0` | `11, one miss` in the same weight as the number. The annotation is informative, never scolding. |
| Streak reset | `count === 0` with prior history | Plain `0` and "start again today". No red, no loss framing — this is the exact moment the app must not feel punishing. |
| Lifting week in progress | Open week, under 3 days | `2 of 3 this week - 4 days left`, streak unchanged |
| Lifting week hit early | Open week reaches 3 | Pips fill; streak increments immediately (D2) |
| Storage unavailable | `localStorage` throws | Persistent banner: "Changes won't be saved on this device." App stays usable in memory. |
| Corrupt data | Stored JSON invalid | Banner explaining the old value was set aside and that Load backup can restore it. Fresh empty state beneath. |
| Import confirmation | File chosen and validated | Inline confirm naming what will be replaced |
| Import rejected | File invalid | Inline error with the reason. State untouched. |

### Presentation rules

- No streak is ever rendered in an alarm color. Reset is neutral.
- The three streaks are never summed, averaged, or shown as one number (AC1).
- Every state above renders from `AppState` alone — there is no state a reload
  cannot reproduce.
- Keyboard: every toggle is a real `<button>`, tab-reachable, with `aria-pressed`
  reflecting state. History cells are buttons with accessible labels
  (`"Walking, Tuesday 15 September: done"`).

---

## Code Style

Pure domain, imperative shell. The domain layer takes data and `today` and
returns data; storage and DOM live at the edges.

```ts
// src/domain/streak.ts

import type { DateKey, Habit } from './model';
import { dailyPeriods, weeklyPeriods } from './periods';

export interface StreakResult {
  readonly count: number;
  readonly misses: number;
  readonly unit: 'days' | 'weeks';
}

/**
 * Current streak for one habit.
 * Pure: `today` is injected, never read from the clock.
 */
export function streakFor(
  habit: Habit,
  log: readonly DateKey[],
  startedOn: DateKey,
  today: DateKey,
): StreakResult {
  const periods =
    habit.cadence === 'daily'
      ? dailyPeriods(log, startedOn, today)
      : weeklyPeriods(log, habit.target, startedOn, today);

  return {
    ...computeStreak(periods),
    unit: habit.cadence === 'daily' ? 'days' : 'weeks',
  };
}
```

Conventions:

- `camelCase` functions and variables, `PascalCase` types, `SCREAMING_SNAKE` for
  module-level constants (`STORAGE_KEY`).
- Named exports only. No default exports.
- `readonly` on every array and interface field the domain hands back.
- No `any`, no non-null `!`. Narrow explicitly or return a result type.
- Comments explain *why*, never *what*. The `toISOString` trap gets a comment; a
  `for` loop does not.
- Errors at boundaries return discriminated results
  (`{ ok: true, value } | { ok: false, reason }`); exceptions are for bugs.

---

## Testing Strategy

**Framework:** Vitest. **Location:** `tests/`, mirroring `src/`.
**Command:** `pnpm test` (CI), `pnpm run test:watch` (dev).

### Levels

| Level | Scope | Where | Share |
|---|---|---|---|
| Unit — domain | `streak.ts`, `dates.ts`. Pure, no mocks, no DOM. | `tests/streak.test.ts`, `tests/dates.test.ts` | ~65% |
| Unit — storage | Serialization, corruption, quota, migration. `localStorage` stubbed. | `tests/localStore.test.ts`, `tests/backup.test.ts` | ~20% |
| Integration — DOM | jsdom. Click a toggle, assert rendered streak and persisted state. | `tests/app.test.ts` | ~15% |
| E2E | **None.** See non-goals. | — | 0% |

### Coverage

- `src/domain/streak.ts` and `src/domain/dates.ts`: **100% branch coverage,
  enforced as a threshold that fails the build.** These two files are the entire
  product thesis; a bug here is the failure mode that caused abandonment last time.
- `src/storage/`: at least 90% lines.
- Overall: at least 85% lines.

### The streak suite

Table-driven over period sequences, so each rule is a readable row rather than a
bespoke test:

```ts
const cases: Array<[label: string, periods: string, count: number, misses: number]> = [
  ['clean run',           'HHH',           3,  0],
  ['one miss holds',      'HHHHHHHHHHHM',  11, 1],
  ['resumes after miss',  'HHHHHHHHHHHMH', 12, 1],
  ['two in a row resets', 'HHHHHHHHHHHMM', 0,  0],
  ['clean restart',       'HHHMMH',        1,  0],
  ['scattered misses',    'HMHMH',         3,  2],
  ['three in a row',      'HHHHHMMM',      0,  0],
  ['nothing logged',      '',              0,  0],
];
```

Plus, as separate named tests:

- Today is never a miss (log nothing today; yesterday's streak is intact).
- An open lifting week showing 1-of-3 on Thursday is neither hit nor miss.
- An open lifting week reaching 3 on Thursday increments the streak that day.
- Each of the three habits streaks independently — one resets, the others do not.
- Back-filling a missed day retroactively repairs the streak it broke.

### Date tests

Fixed clock in every test (`vi.setSystemTime`); no test reads the real date.
Explicit cases for: Sunday-to-Monday week rollover, month and year boundaries, a
spring-forward and a fall-back DST date, and dates where `toISOString()` would be
wrong (late evening local time in a negative-offset zone).

### Integration tests

- Toggle -> streak text updates -> `localStorage` holds the new date.
- Reload (re-init from the stored value) -> identical render.
- Backup round-trip: export, mutate, import, assert state matches the export.
- Corrupt stored value -> app renders empty state and the banner, and the corrupt
  value is preserved under its own key.

### Non-negotiable test

**AC7 — no network.** `fetch`, `XMLHttpRequest`, `WebSocket`,
`navigator.sendBeacon` and `EventSource` are replaced with throwing stubs for the
whole suite. Any call fails the run. This is how "data stays on this device"
stays true as the code changes.

### Manual check before shipping

Load the built page, log all three habits, close the browser fully, reopen: state
intact. Then use Save backup, clear site data, Load backup: state intact.

---

## Boundaries

**Always**

- Run `pnpm test` and `pnpm run typecheck` before any commit.
- Keep `src/domain/` pure — no DOM, no `localStorage`, no `new Date()`.
- Validate anything read from `localStorage` or an imported file before use.
- Update this spec *before* changing the data model, then implement.
- Keep `log` arrays sorted and free of duplicates.

**Ask first**

- Adding any runtime dependency (the target is zero).
- Changing `schemaVersion` or the storage key.
- Changing streak semantics in any way — this is the product.
- Adding a fourth habit or making habits editable.
- Anything that widens the 14-day editable window.

**Never**

- Make a network request of any kind, or add a dependency that could.
- Persist a derived value (streak count, miss count) to storage.
- Overwrite a stored value that failed to parse.
- Reset a streak on a single miss.
- Delete or skip a failing streak test to get to green.
- Silence a type error with `any` or `@ts-ignore`.

---

## Non-Goals

Explicitly out of scope. Building any of these is a spec change, not a
nice-to-have.

**From the intent, confirmed:**

1. **Phone access or cross-device sync.** One machine, one browser profile.
2. **Accounts, login, or any identity.** No user record exists.
3. **Reminders or notifications.** No push, no email, no scheduled prompts.
4. **Charts, graphs, or analytics.** The 14-day strip is history, not a
   visualization; no trend lines, no percentages, no "best month".
5. **Adding, editing, renaming, or removing habits.** The three are fixed in code.

**Additional, established by this spec:**

6. **No server, backend, or hosted anything.** No API, no database, no deployment
   target beyond static files.
7. **No automatic or cloud backup.** The manual Save backup button is the only
   escape hatch, by design.
8. **No merge on import.** Import replaces; two histories are never reconciled.
9. **No editing beyond 14 days back.** No calendar view, no date picker, no
   arbitrary-date entry UI.
10. **No goals, targets, rewards, levels, or gamification** beyond the streak
    number itself.
11. **No notes, journaling, mood, or free text attached to a day.**
12. **No multi-user, no sharing, no export to a third-party format** (CSV, Apple
    Health, etc.). JSON backup only.
13. **No E2E/browser-automation test layer.** jsdom integration tests plus the
    pre-ship manual check are the ceiling for an app this size.
14. **No i18n or theming.** One locale, one visual design, honoring
    `prefers-color-scheme` only.
15. **No offline/PWA installability work.** The page already works offline by
    virtue of having no network dependency; a manifest and service worker add a
    cache-invalidation problem for no gain.

---

## Success Criteria

Done means all of the following hold:

- [ ] AC1–AC8 above pass as automated tests.
- [ ] `pnpm run build` succeeds with zero type errors and zero lint warnings.
- [ ] `pnpm test -- --coverage` passes with 100% branch coverage on `streak.ts`
      and `dates.ts`, and at least 85% overall.
- [ ] The no-network test is present and would fail if a `fetch` were added.
- [ ] Every state in the Screens and States table is reachable and has a test or
      a documented manual reproduction.
- [ ] Manual check passes: log all three -> full browser restart -> state intact;
      Save backup -> clear site data -> Load backup -> state intact.
- [ ] `package.json` has zero `dependencies`.
- [ ] This spec is committed and matches the shipped behavior.

---

## Open Questions

1. **D1–D3 above** — the three decisions taken on the intent's open items.
   Confirm or overrule before Phase 2 (Plan).
2. **Vanilla TS vs. a framework.** Assumption 1. If this is meant to become a
   base for future projects, a framework may be worth the weight; for the app as
   specified, it is not.
3. **14-day editable window.** Enough to back-fill a bad week, but a two-week
   illness would fall outside it. Is a longer window (30 days) worth the taller
   history strip?
4. **Lifting: 3 distinct days, or 3 sessions?** D1 makes a day binary, so two
   sessions on one day count once. Confirm that matches the actual habit.
5. **"Two consecutive misses" across a streak's start.** The walk begins at
   `startedOn`, so the very first period is always a hit and a fresh user can
   never begin in a reset state. Confirm that is intended.
