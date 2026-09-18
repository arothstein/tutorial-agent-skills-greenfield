# Habit Tracker — Task List

Full specifications (acceptance criteria, verification, files, scope) live in
[tasks/plan.md](plan.md). This file is the ordered checklist.

**Status as of 2026-09-18:** Phase 2 (the domain core) is essentially complete —
`dates.ts`, `periods.ts` and `streak.ts` are built and proved by 68 passing tests.
Phases 1–2 were partly skipped to get there: there is **no Vite build, no ESLint,
no jsdom, no no-network guard, and no `model.ts`**. Those gaps are itemized below
and now block Phase 4.

**Next up:** Task 3 (`model.ts` + frozen `HABITS`), which unblocks `streakFor`
and everything in Phase 4. Tasks 1–2 should be finished before then, since their
gates (`lint`, `build`, AC7) were meant to protect every later task.

**Still blocked on:** Open Question 1 in the plan — confirm or overrule SPEC
decisions D1–D3. **Tasks 5 and 6 landed without that confirmation and encode all
three directly**, so overruling one now means rewriting the period/streak logic.

Legend: `[x]` complete and verified · `[ ]` not started · `[ ]` **Partial** —
some acceptance criteria met, remainder listed underneath.

---

## Phase 1: Foundation

- [ ] **Task 1: Project toolchain** — Vite + TS strict, zero runtime deps, pnpm scripts. *(S, no deps)*
  - **Partial.** Done: pnpm, `tsconfig.json` with `strict` + `noUncheckedIndexedAccess`,
    zero `dependencies`, `pnpm-lock.yaml` committed.
  - Remaining: Vite itself — `vite.config.ts`, `index.html`, and the
    `dev` / `build` / `preview` scripts (`build` must run `tsc --noEmit` first);
    the `packageManager: "pnpm@<version>"` field.
- [ ] **Task 2: Test and lint harness with the no-network guard** — Vitest + jsdom + ESLint; throwing stubs for `fetch`/XHR/WebSocket/`sendBeacon`/EventSource (AC7). *(S, after T1)*
  - **Partial.** Done: Vitest with `test` and `test:watch`, running green.
  - Remaining: jsdom + `@testing-library/dom`; ESLint + a `lint` script at
    `--max-warnings 0`; the global no-network setup file and
    `tests/no-network.test.ts`. **AC7 is currently unprotected.**
- [ ] **Task 3: Domain model and the three fixed habits** — `AppState`, `HabitId`, frozen `HABITS`, `emptyState`. *(S, after T2)*
  - Not started. `src/domain/model.ts` does not exist; this is what blocks
    `streakFor` (Task 6) and all of Phase 4.

### Checkpoint: Foundation — **not met**
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` all green
  - `pnpm test` (68 passing) and `pnpm run typecheck` are green; `lint` and
    `build` do not exist yet.
- [ ] The no-network guard demonstrably fails the run when a `fetch` is added
- [x] `package.json` has zero `dependencies`
- [ ] Review with human before proceeding

## Phase 2: Domain core (the product thesis)

- [x] **Task 4: `dates.ts`** — local date keys (never `toISOString`), noon-normalized day math, Mon–Sun weeks. *(S, after T3)*
  - `toDateKey`, `addDays`, `daysInclusive`, `mondayOf`, `sundayOf`,
    `weeksInclusive`. 25 tests: negative-offset evening, both DST transitions,
    leap day, month/year rollover, Sunday→Monday rollover.
  - Two deltas from the plan: `eachDay` shipped as **`daysInclusive`**, and
    **`daysBetween` was not built** — deferred until Task 11 needs "days left".
- [x] **Task 5: `periods.ts`** — daily/weekly period lists; open period appended only if it already hits (D2). *(S, after T4)*
  - `dailyPeriods` and `weeklyPeriods(log, target, startedOn, today)`. 17 tests
    covering the `>= target` distinct-days rule, duplicates not inflating a week
    (D1), no spill across the Sunday/Monday seam, a mid-week `startedOn` starting
    at that week's Monday, and the open week appended only on a hit (D2).
  - Spec delta to fold back in: SPEC's "Project Structure" still omits
    `periods.ts`, which its own code sample imports.
- [ ] **Task 6: `streak.ts`** — `computeStreak` + `streakFor`; table-driven over SPEC's worked cases. *(S, after T5)*
  - **Partial.** Done: `computeStreak` with all eight SPEC worked cases as a
    table-driven suite, plus `dailyStreak` and `weeklyStreak` (26 tests; AC2–AC5
    each named).
  - Remaining: **`streakFor(habit, ...)`** — blocked on Task 3's `Habit` type —
    and the AC1 test that the three habits streak independently, which needs
    `HABITS`.

### Checkpoint: Domain core — **mostly met, two items open**
- [ ] 100% branch coverage on `dates.ts`, `periods.ts`, `streak.ts`
  - **Unverified, not failed.** `@vitest/coverage-v8` is not installed, so
    `--coverage` cannot run. Every branch in these files is exercised by a named
    test, but there is no instrumented number yet.
- [x] All eight SPEC worked cases pass; AC2–AC5 each have a named test
- [x] `src/domain/` contains no `new Date(`, `document`, `localStorage` or `fetch`
- [ ] **Review with human — a wrong rule here is the failure mode that caused abandonment last time**

## Phase 3: Persistence

- [ ] **Task 7: `localStore.ts`** — load/validate/save, first-run seed, nothing written until first mutation (AC6). *(S, after T3 — parallel with Phase 2)*
- [ ] **Task 8: Storage failure modes** — memory mode, corruption quarantine, quota, future schema. *(S, after T7)*

### Checkpoint: Persistence
- [ ] Round-trip save/load is deep-equal
- [ ] All four failure modes tested; no test leaves a stored value overwritten
- [ ] No derived value appears in the stored JSON

## Phase 4: UI slices

- [ ] **Task 9: App shell, render loop, `main.ts` wiring** — full re-render from state; one save-then-render update path. *(M, after T6 + T8)*
- [ ] **Task 10: Today card** — three rows, toggle today (D1), streak labels with miss annotation (AC1–AC3). *(S, after T9)*
- [ ] **Task 11: Lifting weekly progress** — pips, `N of 3 this week`, days left, weeks-unit streak (D2). *(S, after T10)*
- [ ] **Task 12: History strip** — 14 days, Monday separators, click to back-fill. *(M, after T11)*

### Checkpoint: UI slices
- [ ] Core flow works end to end in the browser: toggle → streak → reload → intact
- [ ] AC1 holds — no combined number anywhere in the UI
- [ ] Keyboard-only operation of every toggle and history cell
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
