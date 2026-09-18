# Habit Tracker — Task List

Full specifications (acceptance criteria, verification, files, scope) live in
[tasks/plan.md](plan.md). This file is the ordered checklist.

**Blocked on:** Open Question 1 in the plan — confirm or overrule SPEC decisions
D1–D3 before starting Task 5. Tasks 1–4 can proceed now.

---

## Phase 1: Foundation

- [ ] **Task 1: Project toolchain** — Vite + TS strict, zero runtime deps, pnpm scripts. *(S, no deps)*
- [ ] **Task 2: Test and lint harness with the no-network guard** — Vitest + jsdom + ESLint; throwing stubs for `fetch`/XHR/WebSocket/`sendBeacon`/EventSource (AC7). *(S, after T1)*
- [ ] **Task 3: Domain model and the three fixed habits** — `AppState`, `HabitId`, frozen `HABITS`, `emptyState`. *(S, after T2)*

### Checkpoint: Foundation
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` all green
- [ ] The no-network guard demonstrably fails the run when a `fetch` is added
- [ ] `package.json` has zero `dependencies`
- [ ] Review with human before proceeding

## Phase 2: Domain core (the product thesis)

- [ ] **Task 4: `dates.ts`** — local date keys (never `toISOString`), noon-normalized day math, Mon–Sun weeks; 100% branch. *(S, after T3)*
- [ ] **Task 5: `periods.ts`** — daily/weekly period lists; open period appended only if it already hits (D2). *(S, after T4)*
- [ ] **Task 6: `streak.ts`** — `computeStreak` + `streakFor`; table-driven over SPEC's worked cases; 100% branch. *(S, after T5)*

### Checkpoint: Domain core
- [ ] 100% branch coverage on `dates.ts`, `periods.ts`, `streak.ts`
- [ ] All eight SPEC worked cases pass; AC2–AC5 each have a named test
- [ ] `src/domain/` contains no `new Date(`, `document`, `localStorage` or `fetch`
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
