# Intent: Habit Tracker

*Confirmed 2026-09-17 via `interview-me`. This is a statement of intent, not a spec.*

## Outcome

One page, three habits, three separate streaks.

| Habit | Cadence |
|---|---|
| Lifting weights | 3× per week |
| Walking | Daily |
| Not snacking | Daily |

## User

The author, alone. No account, no sharing, no other audience.

## Why now

Previous trackers zeroed out a long streak over a single bad day, and that
caused abandonment. The goal is one that survives a bad Tuesday.

## Streak rules

Streaks are counted **per habit** — never one combined number.

- **Walking, not snacking** — count consecutive *days*.
- **Lifting** — counts consecutive *weeks* in which 3 sessions were logged.
- **A single miss does not break a streak.** It annotates it and the count
  continues: `11, one miss`.
- **Two consecutive misses reset the streak to zero.** For the daily habits
  that is two days in a row; for lifting, two weeks in a row under 3 sessions.

### Week boundary

A week is **Monday–Sunday**. Lifting sessions count toward the Mon–Sun week
they fall in; the weekly target is evaluated at the close of Sunday. Not a
rolling 7-day window.

## Success

Still being opened in month three — specifically, *after* a bad week.

## Constraint

Data stays on this device.

- Browser storage on one machine.
- No network calls, no server, no sync.
- A **Save backup** button writes a file; that file can be loaded back in.
  This is the only escape hatch — no automatic or cloud backup.

## Out of scope

- Phone access or cross-device sync
- Accounts or login
- Reminders and notifications
- Charts, graphs, analytics
- Adding or editing habits beyond the three above

## Open for the spec

- Behavior when the same day is logged twice, or logged late (back-filling).
- What the UI shows for lifting mid-week (e.g. 1 of 3 done, Thursday).
- Whether a miss annotation persists in history after the streak resets.
