# Habit Tracker — Task List

Full specifications (acceptance criteria, verification, files, scope) live in
[tasks/plan.md](plan.md). This file is the ordered checklist.

**Status as of 2026-09-18:** **Phases 1, 2 and 3 are complete, and Phase 4 is
complete except the history strip (Task 12).** 301 tests passing; `test`,
`typecheck`, `lint` and `build` all green; 100% branch and line coverage on every
domain module, 95% branch overall.

D1–D3 were confirmed on 2026-09-18 and are encoded in `periods.ts` / `streak.ts`.
Plan Open Question 1 is closed.

**Next up:** Task 12 (history strip), then Phase 5 (backup). Task 13 can start in
parallel — `storage/schema.ts` already holds the validator it needs.

The in-browser pass on Phase 4 is **done**: checked against `pnpm run dev` on
2026-09-18.

**Awaiting you:** three checkpoints end in a human review — Foundation, Domain
core, and UI slices. Everything mechanical in them passes, and the UI has now been
seen running; the code reviews themselves are outstanding.

Legend: `[x]` complete and verified · `[ ]` not started.

---

## Phase 1: Foundation

- [x] **Task 1: Project toolchain** — Vite + TS strict, zero runtime deps, pnpm scripts. *(S, no deps)*
  - Vite 6 with `dev` / `build` / `preview`; `build` runs `tsc --noEmit` first.
    `packageManager` pinned, lockfile committed, zero `dependencies`.
  - `src/main.ts` is a placeholder Task 9 replaces — it exists so the build
    exercises the TypeScript pipeline rather than bundling an empty page.
- [x] **Task 2: Test and lint harness with the no-network guard** — Vitest + jsdom + ESLint; throwing stubs for `fetch`/XHR/WebSocket/`sendBeacon`/EventSource (AC7). *(S, after T1)*
  - Guard loaded via `setupFiles`, so it covers every suite rather than only the
    test that checks it. jsdom is the environment for the whole suite for the
    same reason.
  - ESLint enforces the plan's Definition of Done: no `any`, no non-null
    assertion, no `@ts-` silencing.
- [x] **Task 3: Domain model and the three fixed habits** — `AppState`, `HabitId`, frozen `HABITS`, `emptyState`. *(S, after T2)*
  - The fixed-habit invariant is carried by `Record<HabitId, Habit>`: a fourth
    id without a definition fails `typecheck` in two places.
  - `DateKey` stays in `dates.ts` and is re-exported from `model.ts`, so SPEC's
    `import type { DateKey, Habit } from './model'` still resolves.

### Checkpoint: Foundation — **mechanically met; review outstanding**
- [x] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` all green
- [x] The no-network guard demonstrably fails the run when a `fetch` is added
  - Verified by smuggling `fetch('/api/telemetry')` into `computeStreak`: the
    streak suite failed naming the call site. Removed.
- [x] `package.json` has zero `dependencies`
- [ ] Review with human before proceeding

## Phase 2: Domain core (the product thesis)

- [x] **Task 4: `dates.ts`** — local date keys (never `toISOString`), noon-normalized day math, Mon–Sun weeks. *(S, after T3)*
  - `toDateKey`, `addDays`, `daysBetween`, `daysInclusive`, `mondayOf`,
    `sundayOf`, `weeksInclusive`. 33 tests.
  - `daysBetween` is a span, not a countdown: Thursday→Sunday is 3, while the
    lifting row's "4 days left" counts today too. Task 11 adds the one.
- [x] **Task 5: `periods.ts`** — daily/weekly period lists; open period appended only if it already hits (D2). *(S, after T4)*
  - 17 tests: the `>= target` distinct-days rule, duplicates not inflating a
    week (D1), no spill across the Sunday/Monday seam, a mid-week `startedOn`
    starting at that week's Monday, the open week appended only on a hit (D2).
  - Spec delta closed: `periods.ts` is now listed in SPEC's Project Structure.
- [x] **Task 6: `streak.ts`** — `computeStreak` + `streakFor`; table-driven over SPEC's worked cases. *(S, after T5)*
  - All eight SPEC worked cases as a table, plus `dailyStreak`, `weeklyStreak`
    and `streakFor` — the one place cadence is dispatched on. 33 tests.

### Checkpoint: Domain core — **mechanically met; review outstanding**
- [x] 100% branch coverage on `dates.ts`, `periods.ts`, `streak.ts`
  - Measured: 100% branch **and** line on all five domain modules. The only
    uncovered file in `src/` is the `main.ts` placeholder.
- [x] All eight SPEC worked cases pass; AC2–AC5 each have a named test
- [x] `src/domain/` contains no clock, DOM, storage or network access
  - `today` is always injected; no `new Date()` anywhere under `src/domain/`.
- [ ] **Review with human — a wrong rule here is the failure mode that caused abandonment last time**

## Phase 3: Persistence

- [x] **Task 7: `localStore.ts`** — load/validate/save, first-run seed, nothing written until first mutation (AC6). *(S, after T3)*
  - Document validation, version dispatch and the migration seam split into
    `storage/schema.ts`: `backup.ts` (Task 13) needs the same validator, and two
    validators can disagree about what a valid document is. 40 tests.
  - `openStore` returns a store object rather than free `load` / `save`. The
    "do not overwrite this" decision is made while reading and has to hold for
    every later write; a free `save` could not know it, which would put the rule
    in the UI layer one forgotten branch from destroying a history.
  - Spec delta: an unsorted or duplicated `log` is **repaired** on read, not
    quarantined. The repair is provably lossless; quarantining would cost a real
    history over an ordering slip. Malformed dates are still rejected.
- [x] **Task 8: Storage failure modes** — memory mode, corruption quarantine, quota, future schema. *(S, after T7)*
  - Six `status.kind` values, each with its own banner: `stored`, `first-run`,
    `unavailable`, `corrupt`, `unsupported-version`, `future-version`.
  - A read that throws is treated as read-only, not just unreadable: a key that
    could not be read may still hold a real history, and a blind overwrite is how
    it is lost. Same rule when quarantining a damaged value fails.
  - Save failures are not latched — un-marking a day shrinks the document, so a
    retry after a quota failure can legitimately succeed.

### Checkpoint: Persistence
- [x] Round-trip save/load is deep-equal
- [x] All four failure modes tested; no test leaves a stored value overwritten
  - Asserted directly: every corruption test checks the original bytes are still
    under the live key after opening the store.
- [x] No derived value appears in the stored JSON
  - `serializeDocument` builds the document field by field, so a derived value
    cannot reach the disk even if one reached an `AppState`.

## Phase 4: UI slices

- [x] **Task 9: App shell, render loop, `main.ts` wiring** — full re-render from state; one save-then-render update path. *(M, after T6 + T8)*
  - Split into `main.ts` (composition root: the one clock read, the one
    `browserStorage()` call) and `app.ts` (`startApp({ root, today, storage })`).
    That seam is what lets the integration suite start the whole app against a
    fixed Thursday and a storage that fails on purpose.
  - `mount` builds the skeleton once; `render` replaces only the state-derived
    regions. Two things must survive a full rebuild: **focus**, restored by
    habit id so a keyboard user is not stranded after every mark, and the
    **live region**, which cannot announce anything if it is replaced.
  - Asserted by a source-level test: no clock read anywhere under `src/domain/`
    or `src/ui/`, and no `toISOString` in `src/` at all.
- [x] **Task 10: Today card** — three rows, toggle today (D1), streak labels with miss annotation (AC1–AC3). *(S, after T9)*
  - Wording lives in `ui/labels.ts` as pure functions, so the product's tone is
    asserted directly rather than read off the DOM. 29 tests.
  - Spec delta: the unit is spelled out — `12 days, one miss` rather than the
    mock's `12, one miss`. A bare number next to a row showing weekly progress is
    the confusion AC1 exists to prevent. `0` stays bare.
  - A zeroed streak offers `Start again today` only when the walk has actually
    scored a period (`hasClosedPeriod`), so a lifting week two days into its
    three is not told to start again.
- [x] **Task 11: Lifting weekly progress** — pips, `N of 3 this week`, days left, weeks-unit streak (D2). *(S, after T10)*
  - `openWeekProgress` lives in `periods.ts` and applies the same open-week rule
    `weeklyPeriods` does, so the pips fill in the render the streak ticks up.
  - The pips are `aria-hidden` decoration over a sentence that already says it:
    shape and colour are never the only channel carrying the count.
- [ ] **Task 12: History strip** — 14 days, Monday separators, click to back-fill. *(M, after T11)*
  - Note from Task 10: `toggleDay` deliberately never moves `startedOn`. Pulling
    it back to a back-filled older day does not undo — un-toggling would leave
    the walk starting before the user ever tracked, turning those days into
    misses and resetting a streak from an accidental click. How the walk's start
    moves when back-filling past it is this task's decision to make.

### Checkpoint: UI slices
- [x] Core flow works end to end in the browser: toggle → streak → reload → intact
  - Checked in the browser via `pnpm run dev` on 2026-09-18, on top of the jsdom
    coverage of the same flow including reload-renders-identically.
- [x] AC1 holds — no combined number anywhere in the UI
- [x] Keyboard-only operation of every toggle and history cell
  - Every toggle is a real `<button type="button">` with no `tabindex`, carrying
    `aria-pressed` and an accessible name including the habit. Focus survives the
    re-render. History cells arrive with Task 12.
- [ ] Review with human before proceeding

## Phase 5: Backup

- [ ] **Task 13: `backup.ts`** — export document with provenance, import validation with stated rejection reasons (AC8). *(S, after T8)*
- [ ] **Task 14: Backup bar UI** — save download, load + validate + confirm replace-all, inline error. *(M, after T13)*

### Checkpoint: Backup
- [ ] AC8 passes: export → mutate → import → identical state
- [ ] An invalid import changes nothing and explains why

## Phase 6: States and ship

- [ ] **Task 15: Remaining screen states and presentation rules** — first run, all-done, forgiveness, reset, storage banners; reset never punishing. *(M, after T14)*
- [ ] **Task 16: jsdom integration suite** — toggle→persist, reload→identical render, backup round-trip, corrupt case. *(M, after T15)*
- [ ] **Task 17: Ship gate** — enforced coverage thresholds, AC1–AC8 traceability table, manual pre-ship check. *(S, after T16)*

### Checkpoint: Complete
- [ ] AC1–AC8 all pass as automated tests, mapped in the traceability table
- [ ] Coverage thresholds enforced and passing; lint and typecheck clean
- [ ] Every screen state reachable with a test or documented manual repro
- [ ] Manual pre-ship check passed on the built page
- [ ] SPEC.md matches shipped behavior; ready for review
