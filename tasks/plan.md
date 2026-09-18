# Implementation Plan: Habit Tracker

Derived from [SPEC.md](../SPEC.md) (draft, awaiting review) and
[docs/intent/habit-tracker.md](../docs/intent/habit-tracker.md).
Plan drafted 2026-09-17.

Task list target: `tasks/todo.md` (checklist). No external tracker is designated
by the repo. Full task specifications live in this document; `todo.md` is the
ordered checklist that `/build` and downstream tooling read.

---

## Overview

A single-page, zero-dependency habit tracker for one person on one machine.
Three fixed habits, three independent streaks, one forgiven miss, `localStorage`
persistence, manual JSON backup. The entire product thesis is the streak engine:
a single missed day must never display a zeroed streak. Everything else is a
thin shell around that.

The build is ordered so the two files that carry the thesis — `domain/dates.ts`
and `domain/streak.ts` — are written and proved early, under 100% branch
coverage, before any UI exists to hide a bug in them.

## Scope note: "add a habit"

The requested breakdown listed *add a habit* as a capability. SPEC.md rules this
out (Non-Goals #5: habits are fixed in code; "Ask first": adding a fourth habit
or making habits editable). **Task 3 is therefore "define the three fixed
habits" — the frozen `HABITS` constant — not a habit-creation UI.** If an
authoring UI is actually wanted, that is a spec change; see Open Questions Q6.

## Architecture Decisions

- **Pure domain, imperative shell.** `src/domain/` takes data plus an injected
  `today: DateKey` and returns data. No `new Date()`, no DOM, no `localStorage`
  below `src/storage/` and `src/ui/`. This is what makes the streak suite
  table-driven and the clock-dependent bugs untestable-by-construction.
- **Periods are a separate module.** SPEC's code sample imports `dailyPeriods` /
  `weeklyPeriods` from `./periods`, which the Project Structure section omits.
  This plan adds `src/domain/periods.ts` (Task 5) so the open-period rule (D2)
  has one home and `streak.ts` stays a pure fold. Flagged as a spec delta.
- **Nothing derived is persisted.** Streak counts, miss counts and weekly
  progress are recomputed from `log` on every render. There is no cache, so
  back-filling a past day repairs history for free (no invalidation task exists
  in this plan because there is nothing to invalidate).
- **Storage failures are states, not crashes.** Memory-only mode, corruption
  quarantine, quota exhaustion and future-schema refusal are each a rendered
  banner over a usable app. They get their own task (Task 8) rather than being
  smuggled into the happy path.
- **The no-network guard is scaffolding, not a final check.** Task 2 installs
  throwing stubs for `fetch`/`XHR`/`WebSocket`/`sendBeacon`/`EventSource` across
  the whole suite before any feature code is written, so AC7 holds continuously
  rather than being audited at the end.
- **Vertical slices after the domain is proved.** Phases 4–5 each deliver a
  complete working path (toggle -> state -> save -> render) rather than a layer.

## Definition of Done (standing bar, every task clears it)

No repo-wide `references/definition-of-done.md` exists, so the bar is taken from
SPEC.md "Boundaries" and recorded here:

- `pnpm test` green; `pnpm run typecheck` clean; `pnpm run lint` zero warnings.
- No `any`, no `!` non-null assertion, no `@ts-ignore`.
- `src/domain/` stays pure (no DOM, no storage, no clock).
- Zero runtime `dependencies` in `package.json`.
- No network call of any kind; the no-network suite still passes.
- No derived value written to storage; `log` arrays sorted and duplicate-free.
- A failing streak test is fixed, never skipped or deleted.
- If the data model changed, SPEC.md was updated *first*.

---

## Dependency Graph

```
T1 toolchain
 └── T2 test + lint harness (no-network guard)
      └── T3 model + fixed habits
           ├── T4 dates.ts ────── T5 periods.ts ────── T6 streak.ts
           │                                             │
           ├── T7 localStore load/save ── T8 storage failure modes
           │        │                          │
           │        └──────────┬───────────────┘
           │                   │
           └───────────────────┴── T9 app shell + render loop
                                    ├── T10 today card (toggle + streak label)
                                    │     └── T11 lifting weekly progress
                                    │           └── T12 history strip / back-fill
                                    └── T13 backup.ts ── T14 backup bar UI
                                              │
                                    T15 states + presentation rules
                                              └── T16 integration suite
                                                        └── T17 ship gate
```

Bottom-up: toolchain, then domain, then storage, then UI slices, then backup,
then states and the ship gate.

---

## Task List

### Phase 1: Foundation

- [ ] Task 1: Project toolchain
- [ ] Task 2: Test and lint harness with the no-network guard
- [ ] Task 3: Domain model and the three fixed habits

### Checkpoint: Foundation

### Phase 2: Domain core (the product thesis)

- [ ] Task 4: `dates.ts` — local date keys, day arithmetic, Mon–Sun weeks
- [ ] Task 5: `periods.ts` — daily and weekly period lists, open-period rule
- [ ] Task 6: `streak.ts` — the streak engine and its table-driven suite

### Checkpoint: Domain core

### Phase 3: Persistence

- [ ] Task 7: `localStore.ts` — load, validate, save, first-run seed
- [ ] Task 8: Storage failure modes — memory mode, corruption, quota, future schema

### Checkpoint: Persistence

### Phase 4: UI slices

- [ ] Task 9: App shell, render loop, and `main.ts` wiring
- [ ] Task 10: Today card — three rows, toggle today, streak labels
- [ ] Task 11: Lifting weekly progress — pips, `N of 3`, days left, weeks unit
- [ ] Task 12: History strip — 14 days, click to back-fill

### Checkpoint: UI slices

### Phase 5: Backup

- [ ] Task 13: `backup.ts` — export document, import validation
- [ ] Task 14: Backup bar UI — save, load, confirm, reject

### Checkpoint: Backup

### Phase 6: States and ship

- [ ] Task 15: Remaining screen states and presentation rules
- [ ] Task 16: jsdom integration suite
- [ ] Task 17: Ship gate — coverage thresholds, AC traceability, manual check

### Checkpoint: Complete

---

## Task Specifications

## Task 1: Project toolchain

**Description:** Scaffold the Vite + TypeScript project so there is a page that
builds and serves. No app logic — this task exists to make every later task
verifiable by `pnpm run build`.

**Acceptance criteria:**
- [ ] `pnpm install` completes with **zero** entries under `dependencies`;
      `package.json` pins the toolchain via a `packageManager: "pnpm@<version>"`
      field, and `pnpm-lock.yaml` is committed (not gitignored).
- [ ] `tsconfig.json` has `strict: true`, `noUncheckedIndexedAccess: true`, and
      no `allowJs`.
- [ ] `pnpm run dev`, `pnpm run build`, `pnpm run preview` and `pnpm run typecheck`
      exist and behave as SPEC "Commands" describes; `build` runs `tsc --noEmit`
      before `vite build`.

**Verification:**
- [ ] Build succeeds: `pnpm run build`
- [ ] Typecheck clean: `pnpm run typecheck`
- [ ] Manual check: `pnpm run dev` serves a page at localhost:5173 with the app
      title and no console errors.

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `.gitignore`

**Estimated scope:** Small

---

## Task 2: Test and lint harness with the no-network guard

**Description:** Stand up Vitest (jsdom + `@testing-library/dom`) and ESLint, and
install the AC7 network guard in global setup so it protects every test written
from this point on. This is deliberately the second task: the guard is worth
little if added last.

**Acceptance criteria:**
- [ ] A global setup file replaces `fetch`, `XMLHttpRequest`, `WebSocket`,
      `navigator.sendBeacon` and `EventSource` with stubs that throw, for the
      whole suite.
- [ ] `tests/no-network.test.ts` asserts each of the five throws — and would
      fail the run if production code called one.
- [ ] `pnpm test`, `pnpm run test:watch` and `pnpm run lint` (`--max-warnings 0`)
      run green on the empty project.

**Verification:**
- [ ] Tests pass: `pnpm test`
- [ ] Lint clean: `pnpm run lint`
- [ ] Manual check: temporarily add a `fetch('/x')` call to a test, confirm the
      run fails, then remove it.

**Dependencies:** Task 1

**Files likely touched:**
- `vitest.config.ts`
- `tests/setup/no-network.ts`
- `tests/no-network.test.ts`
- `eslint.config.js`

**Estimated scope:** Small

---

## Task 3: Domain model and the three fixed habits

**Description:** Define `AppState`, `HabitId`, `DateKey`, `Habit` and the frozen
`HABITS` constant holding the three habits with their cadences and targets. This
is the plan's reading of "add a habit": habits are code, not data (SPEC
Non-Goals #5). No storage, no UI, no functions that do work.

**Acceptance criteria:**
- [ ] `HABITS` is a frozen, readonly tuple of exactly three entries —
      `lifting` (weekly, target 3), `walking` (daily, target 1),
      `no-snacking` (daily, target 1) — each with a display name.
- [ ] `AppState` matches SPEC "Shape" exactly: `schemaVersion: 1`,
      `log: Record<HabitId, DateKey[]>`, `startedOn: DateKey`; every array and
      interface field the domain hands back is `readonly`.
- [ ] An `emptyState(today: DateKey): AppState` helper returns `startedOn = today`
      and an empty log for all three ids, and writes nothing anywhere.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/model.test.ts`
- [ ] Typecheck clean: `pnpm run typecheck`
- [ ] Manual check: a test asserting `HABITS.length === 3` fails to compile if a
      fourth id is added without updating `HabitId` — the fixed-habit invariant
      is enforced by the type system, not by convention.

**Dependencies:** Task 2

**Files likely touched:**
- `src/domain/model.ts`
- `src/domain/habits.ts`
- `tests/model.test.ts`

**Estimated scope:** Small

---

## Task 4: `dates.ts` — local date keys, day arithmetic, Mon–Sun weeks

**Description:** All calendar arithmetic, in one pure module, under 100% branch
coverage. This is the file where `toISOString()` would silently shift days and
where DST would produce a 23-hour day; it is built before anything depends on it.

**Acceptance criteria:**
- [ ] `toDateKey(date: Date): DateKey` formats from local `getFullYear`/
      `getMonth`/`getDate` — never `toISOString()` — and a test covers a late
      evening local time in a negative-offset zone where `toISOString()` is wrong.
- [ ] `addDays`, `daysBetween`, `mondayOf`, `sundayOf` and `daysInclusive(first,
      last)` (shipped name; this plan first called it `eachDay`)
      normalize to local noon before arithmetic, so spring-forward and fall-back
      dates neither skip nor repeat a date key.
- [ ] Week helpers treat **Monday** as the first day; tests cover Sunday→Monday
      rollover, month boundary, year boundary, and leap day.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/dates.test.ts`
- [ ] Coverage: `pnpm test --coverage` reports **100% branch** on
      `src/domain/dates.ts`
- [ ] Manual check: every test sets a fixed clock via `vi.setSystemTime`; grep
      confirms no test reads the real date.

**Dependencies:** Task 3

**Files likely touched:**
- `src/domain/dates.ts`
- `tests/dates.test.ts`

**Estimated scope:** Small

---

## Task 5: `periods.ts` — daily and weekly period lists, open-period rule

**Description:** Turn a log into a chronological list of scored periods. This is
where D2 lives: the open period is appended **only if it already hits**, so today
is never scored as a miss but a lifting week that reaches 3 on Thursday counts
immediately.

**Acceptance criteria:**
- [ ] `dailyPeriods(log, startedOn, today)` returns one period per calendar day
      from `startedOn` through **yesterday**, plus today appended only when today
      is logged.
- [ ] `weeklyPeriods(log, target, startedOn, today)` returns one period per
      Mon–Sun week from the week containing `startedOn` through the **last closed
      Sunday**, each hit when it holds `>= target` *distinct* logged days; the
      current open week is appended only when it already reaches `target`.
- [ ] Duplicate date entries in a log cannot inflate a weekly count (D1: a day is
      binary), and a period list for an empty log is empty, not a run of misses.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/periods.test.ts`
- [ ] Coverage: `pnpm test --coverage` reports 100% branch on
      `src/domain/periods.ts`
- [ ] Manual check: a fixture where `startedOn` is mid-week produces a first
      weekly period starting at that week's Monday, not at `startedOn`.

**Dependencies:** Task 4

**Files likely touched:**
- `src/domain/periods.ts`
- `tests/periods.test.ts`

**Estimated scope:** Small

---

## Task 6: `streak.ts` — the streak engine and its table-driven suite

**Description:** The product thesis. `computeStreak` folds a scored period list
into `{ count, misses }`; `streakFor` wires a habit's cadence to the right period
builder and tags the unit. Pure, clock-free, and the highest-risk code in the
project — hence early.

**Acceptance criteria:**
- [ ] Every row of SPEC "Worked cases" passes as a table-driven test over `H`/`M`
      strings: `HHH`→(3,0), `HHHHHHHHHHHM`→(11,1), `HHHHHHHHHHHMH`→(12,1),
      `HHHHHHHHHHHMM`→(0,0), `HHHMMH`→(1,0), `HMHMH`→(3,2), `HHHHHMMM`→(0,0),
      `''`→(0,0).
- [ ] `streakFor` returns `unit: 'days'` for the two daily habits and
      `unit: 'weeks'` for lifting, and the three habits streak **independently** —
      a test resets one and asserts the other two are untouched (AC1, AC5).
- [ ] Named tests cover: today never scores as a miss (AC2/AC3), one miss holds
      the count (AC3), two consecutive misses zero it (AC4), a post-reset hit
      starts at `1` with `0` misses (D3), an open lifting week at 1-of-3 is
      neither hit nor miss, an open week reaching 3 increments that day (D2), and
      back-filling a missed day retroactively repairs the streak.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/streak.test.ts`
- [ ] Coverage: `pnpm test --coverage` reports **100% branch** on
      `src/domain/streak.ts`
- [ ] Manual check: grep `src/domain/` for `new Date(`, `localStorage`,
      `document` and `fetch` — all absent.

**Dependencies:** Task 5

**Files likely touched:**
- `src/domain/streak.ts`
- `tests/streak.test.ts`

**Estimated scope:** Small

---

## Task 7: `localStore.ts` — load, validate, save, first-run seed

**Description:** The happy path of persistence (AC6). One key, one JSON document,
read once at startup, written synchronously after every mutation. Validation
runs on everything read back before it reaches the domain.

**Acceptance criteria:**
- [ ] `load()` returns a discriminated result (`{ ok: true, value } | { ok: false,
      reason }`) — never throws for expected conditions — and a round-trip
      `save(state)` -> `load()` yields a deep-equal state.
- [ ] Key absent is treated as **first run**: `startedOn = today`, empty logs, and
      **nothing is written** until the first real mutation (asserted by spying on
      `setItem`).
- [ ] Validation rejects a document whose `log` is missing an id, holds a
      malformed date key, or is unsorted/duplicated; `save` normalizes arrays to
      sorted and duplicate-free before writing.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/localStore.test.ts`
- [ ] Typecheck clean: `pnpm run typecheck`
- [ ] Manual check: after a save, the raw value under `habit-tracker.v1` contains
      no streak or miss count — no derived value is persisted.

**Dependencies:** Task 3 (parallel with Phase 2)

**Files likely touched:**
- `src/storage/localStore.ts`
- `tests/localStore.test.ts`

**Estimated scope:** Small

---

## Task 8: Storage failure modes — memory mode, corruption, quota, future schema

**Description:** Each row of SPEC "Integrity and failure handling" becomes a
reachable, tested state. The app must stay usable in every one of them; none may
destroy a stored value.

**Acceptance criteria:**
- [ ] `localStorage` throwing on read or write puts the app in **memory-only
      mode** with a `storageUnavailable` flag for the UI; state mutations still
      work in memory and nothing crashes.
- [ ] Unparseable or schema-invalid JSON is **preserved** at
      `habit-tracker.v1.corrupt.<timestamp>`, the live key is not overwritten, and
      a fresh empty state is returned with a `corrupt` flag naming the backup key.
- [ ] `QuotaExceededError` on write surfaces a non-dismissable error flag while
      the in-memory state survives; an unknown (future) `schemaVersion` refuses
      to load and returns a read-only warning rather than downgrading.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/localStore.test.ts`
- [ ] Lint clean: `pnpm run lint`
- [ ] Manual check: with a hand-written garbage value under `habit-tracker.v1`,
      reload and confirm the original garbage is still readable under its
      `.corrupt.` key.

**Dependencies:** Task 7

**Files likely touched:**
- `src/storage/localStore.ts`
- `src/domain/model.ts` (status flags)
- `tests/localStore.test.ts`

**Estimated scope:** Small

---

## Task 9: App shell, render loop, and `main.ts` wiring

**Description:** The imperative shell: load state once, render the whole page
from it, and route every mutation through one `update(fn)` that saves then
re-renders. No feature UI yet — regions render as empty placeholders. This is the
seam every later UI task plugs into.

**Acceptance criteria:**
- [ ] `render(state, today)` performs a **full** re-render from `AppState` alone;
      calling it twice with the same state produces identical DOM.
- [ ] A single `update` path applies a state change, persists via `localStore`,
      and re-renders — there is no code path that mutates state without saving.
- [ ] `today` is resolved once at the composition root (`main.ts`) and injected
      downward; no module under `src/domain/` or `src/ui/` calls `new Date()`.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/app.test.ts`
- [ ] Build succeeds: `pnpm run build`
- [ ] Manual check: `pnpm run dev` shows the three empty regions and the date
      header, with no console errors.

**Dependencies:** Tasks 6, 8

**Files likely touched:**
- `src/main.ts`
- `src/ui/render.ts`
- `src/styles.css`
- `tests/app.test.ts`

**Estimated scope:** Medium

---

## Task 10: Today card — three rows, toggle today, streak labels

**Description:** The core interaction (AC2) and the core readout (AC1, AC3). Three
rows, each with a name, a real `<button>` toggle for today, and that habit's
streak rendered with its miss annotation.

**Acceptance criteria:**
- [ ] Clicking a row's toggle logs today for that habit and re-renders with the
      incremented streak; clicking again **un-logs** it (D1), with no confirm.
- [ ] Streak labels read exactly as SPEC specifies: `3`, `11, one miss`,
      `3, two misses`, `0` — the annotation in the same weight as the number, and
      **no combined or summed number appears anywhere** (AC1).
- [ ] Each toggle is a tab-reachable `<button>` with `aria-pressed` reflecting
      state and an accessible name including the habit.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/app.test.ts`
- [ ] Lint clean: `pnpm run lint`
- [ ] Manual check: tab through the page — all three toggles reachable and
      operable by keyboard; a screen-reader label announces habit and state.

**Dependencies:** Task 9

**Files likely touched:**
- `src/ui/todayCard.ts`
- `src/ui/render.ts`
- `src/styles.css`
- `tests/app.test.ts`

**Estimated scope:** Small

---

## Task 11: Lifting weekly progress — pips, `N of 3`, days left, weeks unit

**Description:** Lifting's row gains the D2 readout: three pips, `2 of 3 this
week`, days remaining, and a week-unit streak that can never be mistaken for a
day count.

**Acceptance criteria:**
- [ ] The row shows filled pips matching distinct logged days this week,
      `N of 3 this week`, and days remaining until Sunday closes.
- [ ] Reaching 3 distinct days mid-week fills all pips and increments the week
      streak **immediately** (D2), without waiting for Sunday.
- [ ] The streak is labeled in weeks (e.g. `6 weeks`), visually distinct from the
      daily rows' counts.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/app.test.ts`
- [ ] Typecheck clean: `pnpm run typecheck`
- [ ] Manual check: with a fixed clock on a Thursday, log the third lifting day
      and watch the streak tick up and the pips fill in the same render.

**Dependencies:** Task 10

**Files likely touched:**
- `src/ui/todayCard.ts`
- `src/styles.css`
- `tests/app.test.ts`

**Estimated scope:** Small

---

## Task 12: History strip — 14 days, click to back-fill

**Description:** The last 14 days, one row per habit, oldest to newest. Every cell
is a button that toggles that day — this **is** the back-fill mechanism, and the
editable window is exactly these 14 days.

**Acceptance criteria:**
- [ ] Renders exactly 14 columns per habit, oldest to newest, with weekday markers
      and Monday separators so lifting weeks are legible.
- [ ] Clicking a cell toggles that date, persists, and re-renders with the
      recomputed streak — back-filling a miss repairs the streak it broke.
- [ ] Each cell is a `<button>` with an accessible label in SPEC's form
      (`"Walking, Tuesday 15 September: done"`); no affordance exists for editing
      a date older than 14 days.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/app.test.ts`
- [ ] Lint clean: `pnpm run lint`
- [ ] Manual check: with a seeded log containing a single gap, click the gap and
      confirm the annotated streak becomes clean.

**Dependencies:** Task 11

**Files likely touched:**
- `src/ui/historyStrip.ts`
- `src/ui/render.ts`
- `src/styles.css`
- `tests/app.test.ts`

**Estimated scope:** Medium

---

## Task 13: `backup.ts` — export document, import validation

**Description:** The pure half of AC8. Build the export document (state plus
`exportedAt` provenance) and validate an imported one, returning a discriminated
result. No DOM in this module.

**Acceptance criteria:**
- [ ] `toBackup(state, now)` returns the SPEC-shaped document with
      `exportedAt` as an ISO timestamp; `fromBackup(json)` round-trips it to a
      deep-equal `AppState` (AC8).
- [ ] Validation **rejects with a stated reason** — changing nothing — for:
      malformed JSON, a missing or unknown `schemaVersion`, a missing habit id,
      a malformed date key, and a non-array log.
- [ ] `fromBackup` reports the number of logged days a valid import would
      replace, so the UI can name what is being discarded.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/backup.test.ts`
- [ ] Coverage: `pnpm test --coverage` reports `src/storage/` at >= 90% lines
- [ ] Manual check: a backup file from a real session re-imports to an identical
      state object.

**Dependencies:** Task 8

**Files likely touched:**
- `src/storage/backup.ts`
- `tests/backup.test.ts`

**Estimated scope:** Small

---

## Task 14: Backup bar UI — save, load, confirm, reject

**Description:** Two controls and nothing else. Save downloads via `Blob` plus an
object URL; Load reads an `<input type="file">`, validates, confirms, and
**replaces all** — never merges.

**Acceptance criteria:**
- [ ] **Save backup** downloads `habit-tracker-backup-YYYY-MM-DD.json`; the
      object URL is revoked after use.
- [ ] **Load backup...** validates before replacing and shows an inline confirm
      naming what is discarded (`"replaces 47 logged days"`); cancelling leaves
      state untouched.
- [ ] An invalid file changes nothing and renders an inline error stating the
      reason; no settings, export formats or cloud affordance appear in this bar.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/app.test.ts`
- [ ] Lint clean: `pnpm run lint`
- [ ] Manual check: Save backup, toggle several habits, Load that backup, confirm
      the page returns to the exported state.

**Dependencies:** Task 13

**Files likely touched:**
- `src/ui/backupBar.ts`
- `src/ui/render.ts`
- `src/styles.css`
- `tests/app.test.ts`

**Estimated scope:** Medium

---

## Task 15: Remaining screen states and presentation rules

**Description:** Make every row of SPEC "Screens and States" reachable: first run,
all-done-today, streak-with-forgiveness, streak reset, storage unavailable,
corrupt data. Plus the presentation rules that carry the product's intent — reset
must not feel punishing.

**Acceptance criteria:**
- [ ] First run shows `0` streaks, an empty strip, and a one-line "Start by
      marking today" hint — no modal, no onboarding.
- [ ] Reset (`count === 0` with prior history) renders a plain `0` and "start
      again today"; **no streak anywhere renders in an alarm color**, and no
      confetti or sound fires on all-done.
- [ ] The `storageUnavailable` and `corrupt` flags from Task 8 each render their
      SPEC-specified banner over a still-usable app, the corrupt banner naming
      where the old value went and that Load backup can restore it.

**Verification:**
- [ ] Tests pass: `pnpm test -- tests/app.test.ts`
- [ ] Build succeeds: `pnpm run build`
- [ ] Manual check: each of the six states reproduced in the browser by seeding
      `localStorage` accordingly; `prefers-color-scheme` honored in both modes.

**Dependencies:** Task 14

**Files likely touched:**
- `src/ui/render.ts`
- `src/ui/todayCard.ts`
- `src/styles.css`
- `tests/app.test.ts`

**Estimated scope:** Medium

---

## Task 16: jsdom integration suite

**Description:** Prove the whole path end to end in jsdom: click, state, storage,
re-render, reload. These are the tests that would catch a regression the pure
domain suites cannot see.

**Acceptance criteria:**
- [ ] Toggle -> streak text updates -> `localStorage` holds the new date key.
- [ ] Re-initializing from the stored value produces an **identical render**
      (AC6 — the reload path).
- [ ] Backup round-trip (export, mutate, import, assert match) and the corrupt
      value case (empty state + banner + preserved `.corrupt.` key) both pass.

**Verification:**
- [ ] Tests pass: `pnpm test`
- [ ] Coverage: `pnpm test --coverage` reports >= 85% lines overall
- [ ] Manual check: the suite runs with a fixed clock throughout; no test reads
      the real date.

**Dependencies:** Task 15

**Files likely touched:**
- `tests/app.test.ts`
- `tests/setup/fixtures.ts`

**Estimated scope:** Medium

---

## Task 17: Ship gate — coverage thresholds, AC traceability, manual check

**Description:** Turn the SPEC "Success Criteria" checklist into enforced gates,
and run the pre-ship manual check in a real browser. Nothing ships on an
unenforced promise.

**Acceptance criteria:**
- [ ] Coverage thresholds **fail the build**: 100% branch on `src/domain/streak.ts`
      and `src/domain/dates.ts`, >= 90% lines on `src/storage/`, >= 85% lines
      overall.
- [ ] Every one of AC1–AC8 maps to a named test, recorded as a traceability table
      in the README; `package.json` has zero `dependencies`.
- [ ] The manual check passes on the **built** page: log all three habits, fully
      close and reopen the browser, state intact; then Save backup, clear site
      data, Load backup, state intact.

**Verification:**
- [ ] Tests pass: `pnpm test --coverage`
- [ ] Build succeeds: `pnpm run build` with zero type errors and zero lint warnings
- [ ] Manual check: as above, on `pnpm run preview`, results recorded in the README.

**Dependencies:** Task 16

**Files likely touched:**
- `vitest.config.ts`
- `README.md`
- `package.json`

**Estimated scope:** Small

---

## Checkpoints

### Checkpoint: Foundation (after Tasks 1–3)
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` all green
- [ ] The no-network guard demonstrably fails the run when a `fetch` is added
- [ ] `package.json` has zero `dependencies`
- [ ] Review with human before proceeding

### Checkpoint: Domain core (after Tasks 4–6)
- [ ] 100% branch coverage on `dates.ts`, `periods.ts` and `streak.ts`
- [ ] All eight SPEC worked cases pass; AC2–AC5 each have a named test
- [ ] `src/domain/` contains no `new Date(`, `document`, `localStorage` or `fetch`
- [ ] **Review with human — this is the product thesis; a wrong rule here is the
      failure mode that caused abandonment last time**

### Checkpoint: Persistence (after Tasks 7–8)
- [ ] Round-trip save/load is deep-equal (AC6 at unit level)
- [ ] All four failure modes tested; no test leaves a stored value overwritten
- [ ] No derived value appears in the stored JSON

### Checkpoint: UI slices (after Tasks 9–12)
- [ ] Core flow works end to end in the browser: toggle -> streak -> reload -> intact
- [ ] AC1 holds — no combined number anywhere in the UI
- [ ] Keyboard-only operation of every toggle and history cell
- [ ] Review with human before proceeding

### Checkpoint: Backup (after Tasks 13–14)
- [ ] AC8 passes: export -> mutate -> import -> identical state
- [ ] An invalid import changes nothing and explains why

### Checkpoint: Complete (after Tasks 15–17)
- [ ] AC1–AC8 all pass as automated tests, mapped in the traceability table
- [ ] Coverage thresholds enforced and passing; lint and typecheck clean
- [ ] Every screen state reachable with a test or documented manual repro
- [ ] Manual pre-ship check passed on the built page
- [ ] SPEC.md matches shipped behavior; ready for review

---

## Parallelization Opportunities

| Stream | Tasks | Notes |
|---|---|---|
| Safe to parallelize | T4→T5→T6 (domain) and T7→T8 (storage) | Both depend only on T3 and share no files. Two agents can run these streams concurrently. |
| Must be sequential | T4→T5→T6 | Each consumes the previous module's exports. |
| Must be sequential | T9→T10→T11→T12 | All touch `render.ts` and `styles.css`; concurrent edits will conflict. |
| Needs coordination | T8 status flags ↔ T15 banners | Define the flag shape in T8 (`storageUnavailable`, `corrupt`, `quotaExceeded`, `futureSchema`) before T15 renders against it. |
| Needs coordination | T13 ↔ T14 | Fix the `fromBackup` result shape first, then build the UI against it. |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A wrong streak rule ships — the exact failure that caused abandonment before | **High** | T6 is early, table-driven over SPEC's worked cases, at 100% branch coverage enforced as a build gate. Human review at the Domain core checkpoint. |
| `toISOString()` or DST shifts a date key, silently breaking a streak | **High** | T4 forbids `toISOString`, normalizes to local noon, and carries explicit spring-forward, fall-back and negative-offset-evening tests. |
| D2's "open week hits early" interacts badly with the reset rule at week boundaries | Medium | T5 owns the open-period rule in one module with its own suite; the open week is appended only on a hit, never as a miss. |
| The spec's Project Structure omits `periods.ts`, which its own code sample imports | Low | This plan adds it explicitly (T5) and flags the delta; update SPEC.md's structure listing when T5 lands. |
| `localStorage` unavailable or full destroys a session, or a corrupt value gets overwritten | Medium | T8 makes all four failure modes tested states; overwriting a bad value is forbidden and the quarantine key is asserted in tests. |
| 100% branch coverage becomes brittle and invites a skipped test to reach green | Medium | The bar applies to only two files, both pure and small. SPEC's "Never" rule forbids deleting or skipping a failing streak test; the ship gate (T17) re-checks. |
| A dependency sneaks in and brings network capability with it | Medium | Zero-`dependencies` is asserted in T17 and the no-network guard from T2 runs on every suite. |
| SPEC is still **draft, awaiting review**; D1–D3 could be overruled after Phase 2 | **High** | Q1 below is a blocking question — confirm D1–D3 before Task 5 starts, since T5/T6 encode them directly. |

---

## Open Questions

Carried from SPEC.md, plus one raised by this plan. Q1 blocks Phase 2.

1. **(Blocking)** Confirm or overrule **D1–D3** — toggle-not-append, open-week
   early promotion, derived-never-stored miss annotation. Tasks 5 and 6 encode
   all three directly; changing one after they land means rewriting the engine.
2. **Vanilla TS vs. a framework** (SPEC Assumption 1). Affects Task 1 only, and
   only if this repo is meant as a base for future projects.
3. **14-day editable window** (Task 12) — enough for a bad week, not for a
   two-week illness. Widen to 30 days? SPEC lists widening under "Ask first".
4. **Lifting: 3 distinct days or 3 sessions?** D1 makes a day binary, so two
   sessions in one day count once. Encoded in Task 5; confirm it matches the real
   habit.
5. **"Two consecutive misses" across a streak's start** — the walk begins at
   `startedOn`, so a fresh user can never open in a reset state. Confirm intended
   (Task 5).
6. **"Add a habit"** was requested in the task breakdown but is a SPEC non-goal.
   Task 3 implements the spec's reading: three habits frozen in code. If a habit
   authoring UI is genuinely wanted, that is a spec change and a new phase — say
   so before Task 3 lands.
