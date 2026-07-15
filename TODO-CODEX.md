# TODO-CODEX.md - Active Execution Index

Last updated: 2026-07-15

This is the short current queue. Read `AGENTS.md`, `PROJECT_STATE.md`, and this
file first. Use `DEVELOPMENT_TODO.md` for detailed history and decision records;
use `TODO.md` only as stale legacy reference after code verification. Current
mutable state is authoritative only in `PROJECT_STATE.md`.

## Current Active Work

### Production Lesson Wallet Canonical Recurring-Round Redemption

Status: **PASS — DEPLOYED; PRODUCTION NO-WRITE UAT PASSED; CONTROLLED WRITE UAT
NOT RUN**.

- Functional Source `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae` fixes the
  UTC-host/Bangkok-weekday mismatch while preserving stale-ID canonical fallback,
  authoritative credit course type, learner conflict, same-month/future, CAS,
  no-payment, and unlimited-entry rules.
- Deployment `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` is Ready from exact functional
  Source `bb7bd8b`; all four aliases converge. No migration, environment, flag,
  allowlist, SlipOK, or Production business-data change occurred.
- Authenticated no-write UAT selected Ramintra / Private / Sunday 2026-07-19 /
  17:00-18:00 with no capacity, console, hydration, or preflight block, then
  cancelled without a redemption POST. The real incident credits were later
  consumed by the real user and are not safe controlled-write UAT data.
- Authoritative detail and the current state matrix are in `PROJECT_STATE.md` under
  **Production Lesson Wallet Canonical Redemption Regression**.

Next action: **Owner direction on the remaining controlled-write UAT gate. Provide
an independently proved existing Owner-controlled Production test entitlement or
accept the no-write closeout; do not create substitute data or consume a real
customer credit.**

## Recently Completed

### Dashboard Booking Unlimited Slot Entry + Customer Price UX

Status: **DONE — REMOTE MIGRATION APPLIED; EXACT SOURCE DEPLOYED;
NO-WRITE PRODUCTION UAT PASSED**.

- Authoritative current state is in `PROJECT_STATE.md` under **Dashboard Booking
  Unlimited Slot Entry + Customer Price UX** and **Production**. Detailed dated
  evidence is in the 2026-07-15 release closeout in `DEVELOPMENT_TODO.md`.

### History Payment Selection 409 / Invalid Slip Modal State

Status: **DONE**.

- Authoritative current state is in `PROJECT_STATE.md`; dated implementation and
  Production UAT evidence remains in `DEVELOPMENT_TODO.md`.

## Parking Lot

### Admin Schedules 20+ Second Performance Investigation

Status: **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.

- Read-only Supabase evidence confirms request fan-out/waterfall: a 100-request
  snapshot spanned `24.816` seconds with all requests returning `200`.
- July scope contains `1,373` verified non-rescheduled sessions, `418` slots, and
  `252` learners. Current chunking/loading produces about `50` Supabase data
  requests per schedules render before Auth/Profile/Layout work.
- No single 20-second SQL query, Supabase outage, timeout, deadlock, connection
  exhaustion, or schedules-correlated 5xx was found.
- Admin latency is confirmed. System-wide User impact is
  `Unknown / Need verification`; shared-capacity risk requires correlated Browser,
  Vercel/RSC, Supabase, and connection/compute evidence.
- Continue from
  `docs/performance/admin-schedules-supabase-log-analysis-2026-07-14.md`.
- The existing audit does not authorize implementation. Await explicit Owner
  selection before any further work.

### Homepage LV Copy Audit/Fix

Status: **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.

- Audit homepage copy for `LV 71+` / `70+` language against the active school
  level contract of LV 0-70.
- Do not introduce LV 71+ as current Production behavior without explicit Owner
  confirmation.
- Await explicit Owner selection before any audit or implementation work.

## Historical / Superseded Reference — Kids Group Pricing Reconciliation

State observed at the 2026-07-13 closeout. This retained reference is historical;
current mutable state is authoritative only in `PROJECT_STATE.md`. Pricing
reconciliation closed at that checkpoint, and Unlimited Slot Entry later became a
separate task that is now also DONE:
**PASS — PROGRESSIVE SUMMARY FIXED; OPTION A ENTRY ACTIVE; PRODUCTION 4+4=2,000 UAT PASSED; PRICING RECONCILIATION DONE**.

Confirmed final state:

- Permanent Option A policy is unchanged: every new general Kids Group booking
  uses Progressive after Entry activation; eligible Legacy bookings contribute
  only `bookings.total_sessions` entitlement to the initial baseline; Legacy money
  is never deducted and Legacy rows are never repriced, scoped, snapshotted,
  credited, refunded, or backfilled.
- Progressive summary root cause was localized to
  `src/components/dashboard/booking-client.tsx`: the component stored too little
  preview evidence and rendered the Legacy monthly true-up explanation for every
  Kids Group summary.
- Source fix commit `aa64adfb765139ca38908ca2409fa2127ffe4a29`
  uses the authoritative server preview `mode`, preserves the full Progressive
  preview evidence, renders a Progressive-only booking-level explanation, and
  leaves Legacy, Adult Group, Private, coupon, and zero-price business semantics
  unchanged.
- Narrow regression coverage is in `scripts/check-progressive-booking-entry.js`.
  Booking-entry checks increased from `25` to `31` and cover Progressive `4+4`,
  coupon, zero Legacy baseline, exact Legacy `4+4`, Adult Group, and Private.
- Source verification passed: booking entry `31`, Option A baseline `32`,
  Progressive pricing `17`, transactions `33`, coupon `38`, Legacy
  pricing/payment `14`, TypeScript, lint, mojibake `225`, build `90` routes, and
  `git diff --check`.
- Source commit was pushed to
  `origin/spike/next-major-security-upgrade`.
- Corrected Entry-absent rollback deployment is
  `dpl_GyGnKWq49mTU6NYNavWRVYLwmo3P`, Ready from exact clean source
  `aa64adf` on all four aliases when verified. Entry-off authenticated Kids Group
  remained Legacy: previous `4` / `2,500`, new `4`, cumulative `8`, rate `500`,
  target `4,000`, deduction `2,500`, charge `1,500`; Progressive-only copy was
  absent.
- Final activation deployment is
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`, Ready from the same exact clean source
  `aa64adf` on all four aliases. Production Entry is the exact non-sensitive
  value `true`; allowlist remains absent; all four Progressive dependencies and
  shared `SLIPOK_TEST_MODE` remain unchanged.
- The final activation required a forced rebuild because unchanged source had
  initially reused the Entry-off build cache. The forced artifact is the
  authoritative final deployment above.
- Authenticated no-write July UAT passed: eligible Legacy `2+2=4`, historical
  amounts `1,250+1,250=2,500`, cancelled rows excluded, previous Progressive `0`,
  new `4`, cumulative `8`, rate `500`, coupon `0`, gross/final `2,000`.
- Customer Summary visibly shows `คำนวณราคา Progressive สำหรับการจองครั้งนี้`,
  baseline `4`, previous Progressive `0`, new `4`, cumulative `8`, rate `500`,
  `ราคาการจองใหม่: 4 × 500 = 2,000 บาท`, and the preservation statement that
  historical payment is not deducted. Legacy target/deduction/credit wording is
  absent.
- Adult Group and Private remain Legacy by the unchanged server-only entry
  decision and deterministic regression proof. Existing Progressive History,
  approved batch, and payment-drain capabilities remain readable/Ready.
- Unauthenticated booking preview is `401`. Activation logs sampled `28` requests:
  error `0`, 5xx `0`, baseline fault `0`, dependency fault `0`, SlipOK `0`,
  booking-create POST `0`, and successful preview `1`. Browser console warnings/
  errors and hydration errors were `0`.
- Protected pre/post counts and SHA-256 fingerprints matched at every checkpoint:
  bookings `519`, sessions `2,785`, scopes `2`, snapshots `519`, receipts `3`,
  coupon reservations/usages `0/0`, batches/members `4/4`, attempts/allocations
  `1/1`, payments `470`, Ledger `471`, wallet `60`, attendance `1,622`,
  notifications `16,147`, tiers `11`, Finance expenses `1`, existing Progressive
  bookings `2`, approved batches `1`, and the repaired booking. UAT-attributable
  business-data delta is `0`.
- No booking was confirmed. No Booking, Payment, scope, session, snapshot,
  receipt, coupon, wallet, attendance, notification, Ledger, Finance, refund,
  credit, pricing-tier, Legacy, Adult Group, or Private write occurred.
- Rollback was not required after the successful final artifact. At that historical
  closeout, the corrected Entry-absent deployment was the documented rollback
  target; it is not a rollback target for Unlimited Slot Entry.

### Historical Progressive Status Matrix (2026-07-13 Closeout)

| State | Historical closeout result |
| --- | --- |
| Source complete | Yes - summary fix `aa64adf`; core Option A `f8568a6` |
| Tests passed | Yes |
| Committed | Yes - source commit; documentation closeout follows separately |
| Pushed | Yes - source commit; documentation closeout follows separately |
| Migration applied | Yes - `20260713210000` exactly once |
| Deployed | Yes - `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS` Ready |
| Dependencies enabled | Yes - four dependency controls unchanged/true |
| Entry enabled | Yes - exact Production value `true` |
| Allowlisted | No - absent and not required |
| Production active | Yes - new general Kids Group uses Progressive |
| Production UAT | Passed - authoritative and visible `4+4=2,000` |
| Adult/Private | Legacy |
| Data repaired this round | No |
| Customer impact | Future new general Kids Group bookings now use Progressive |
| Financial impact | Future charges follow Option A; historical money/evidence unchanged |
| Pricing reconciliation task | Done at this closeout; later Booking/History and Unlimited Slot tasks are also closed |

## Worktree / Safety Notes

- Branch: `spike/next-major-security-upgrade`.
- The pre-existing unrelated unstaged `AGENTS.md` remainder remains excluded.
- Historical safety note: the Owner-controlled Production `4+4` draft was restored
  browser-locally after two atomic `409` capacity rejections. No booking was created.
  Do not replay Production confirmation without separate Owner authorization.
- Historical booking-regression rollback evidence referenced
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`. It is not a rollback target for Unlimited
  Slot Entry. At the pre-release checkpoint, its Source Fix was committed and
  pushed but its remote migration, deployment, and Production UAT had not yet
  occurred. That checkpoint is superseded by the completed release state in
  `PROJECT_STATE.md`.

## Session Exit Checklist

- Apply the Session Closeout Protocol in `AGENTS.md`.
- Update `PROJECT_STATE.md` and this file whenever policy, source, Production
  state, risks/blockers, or the next task changes.
- Put long reconciliation/release history in `DEVELOPMENT_TODO.md`.
- Run `npm.cmd run check:mojibake` and `git diff --check` for documentation edits.
- Next action: **Await Owner selection. Do not start a Parking Lot task
  automatically.**
