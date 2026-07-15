# TODO-CODEX.md - Active Execution Index

Last updated: 2026-07-15

This is the short current queue. Read `AGENTS.md`, `PROJECT_STATE.md`, and this
file first. Use `DEVELOPMENT_TODO.md` for detailed history and decision records;
use `TODO.md` only as stale legacy reference after code verification.

## Current Active Work

### 1. Dashboard Booking Unlimited Slot Entry + Customer Price UX

Status: **ACTIVE — PRODUCTION RELEASE PREFLIGHT COMPLETE;
REMOTE MIGRATION/DEPLOY OWNER APPROVAL REQUIRED**.

- Remove fixed learner-capacity blocking consistently from new User booking,
  pending-payment edit, User reschedule, Lesson Wallet redemption, and
  makeup/replacement-date target selection while preserving every duplicate,
  overlap, ownership, template/slot, timing, payment, same-month, idempotency,
  concurrency, atomicity, Option A, coupon, Ledger, and Finance guard.
- Replace customer `x/6`, full/remaining-seat states, and internal pricing terms
  with non-blocking occupancy behavior and plain Thai price explanation sourced
  from the authoritative selected `pricing_tiers` range.
- Standardize Booking learner headings to distinct nickname plus full name, or full
  name only, for child, self/adult, and multi-child cases.
- Functional Source and executable tests now implement the approved behavior across
  all five normal entry paths. The authoritative preview includes selected-tier
  evidence, learner headings use the shared formatter, and customer Steps 4-5 no
  longer require Progressive/Legacy terminology.
- Additive migration Source
  `20260715060541_unlimited_normal_slot_entry.sql` replaces the effective lock,
  refresh, and capability functions without a data rewrite. It passed a complete
  disposable local reset and runtime/rollback/concurrency checks; it has not been
  applied remotely.
- Verification passed 265 deterministic checks, 9 rendered Booking E2E cases with
  residue `0`, TypeScript, ESLint, mojibake, and production build. Source commit
  `4ab6a69e23de6f7989b51dfaf624ff631dde420f` (tree
  `397618a391f968ec1135084978ce3589a43f1d89`) and this context closeout are pushed
  to `origin/spike/next-major-security-upgrade`. Remote migration, deploy,
  Production read/write/UAT, environment/feature/allowlist, pricing-tier/formula,
  and financial/data state remain unchanged. Next gate is separate Owner approval
  for coordinated Remote Migration + exact Deploy + Production UAT.
- Read-only Production release preflight passed on 2026-07-15. Git provenance and
  migration checksum match; the remote history matches local through
  `20260713210000`, and `20260715060541` is the only pending migration. Production
  remains on Ready deployment `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9` with Entry, four
  dependencies, and shared SlipOK Test Mode still `true`, and allowlist absent.
- Current DB capability remains Option A version `2` without
  `slotEntryPolicy=unlimited_learner_v1`; the old lock still raises the capacity
  error and refresh still derives `full`. Safe proposed order is therefore exact
  migration first, verify functions/grants/capability, then deploy exact Source
  `4ab6a69` within one bounded release window. No remote migration, deploy,
  Production UAT, environment change, or Production data write was performed.

## Recently Completed

### History Payment Selection 409 / Invalid Slip Modal State

Status: **DONE**.

- Final classification:
  **PASS - HISTORY PAYMENT LIFECYCLE FIXED; LOCAL E2E AND CONTROLLED PRODUCTION
  UAT PASSED; TASK DONE**.
- Source commit `7d98b062f850a4210fae052cefddd92b994889b8` (tree
  `73294ca5419582492fa558623d395c5b3801af5e`) is pushed and deployed as
  `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9` on all four Production aliases.
- The History client now has an explicit prepare/cancel/refresh/conflict lifecycle,
  a synchronous single-flight lock, stale-response generation guard, revision
  reconciliation, visible typed Thai errors, and upload eligibility tied only to
  the current authoritative prepared batch. Same-scope contiguous-prefix and all
  RPC guards remain unchanged.
- Executable verification passed `248` unique checks: `244` deterministic/runtime
  checks plus `4` real rendered History E2E scenarios. The browser suite passed
  both before and after the required build/dev restart. Disposable residue was `0`.
- Controlled Production UAT selected the exact valid `3,464 + 866 = 4,330` prefix.
  Two one-click prepares returned `200`, both modals showed `4,330 · 2 รายการ`, and
  two closes/cancels returned `200`. Controls remained disabled through revision
  refresh, re-prepare did not return 409, and the final scope state was revision
  `17` with no lock or active member.
- Expected UAT lifecycle delta was exactly two cancelled batches, four inactive
  members, four activity logs, and scope revision `15 -> 17`. Booking, Session,
  receipt, coupon, Payment, attempt, allocation, Ledger, wallet, attendance, tier,
  Finance, slip/storage, and SlipOK deltas were `0`. One coach check-in activity
  and one reminder notification during the window were unrelated and separated by
  timestamp/user/entity.
- Entry and all four dependencies remain `true`; allowlist remains absent; shared
  `SLIPOK_TEST_MODE=true`; migration `20260713210000` remains applied once; all
  four capabilities remain Ready at the approved versions/contracts.

## Parking Lot

### Admin Schedules 20+ Second Performance Investigation

Status: **PARKING LOT — AUDITED; FIX NOT STARTED**.

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
- No source fix, migration, deploy, environment change, or Production write has
  been approved or performed for this issue.

### Homepage LV Copy Audit/Fix

Status: **PARKING LOT — NOT STARTED**.

- The History payment blocker is closed. Owner explicitly kept this parked while
  Dashboard Booking is the single active task.
- Audit homepage copy for `LV 71+` / `70+` language against the active school
  level contract of LV 0-70.
- Do not introduce LV 71+ as current Production behavior without explicit Owner
  confirmation.

## Historical Closeout - Kids Group Pricing Reconciliation (Closed)

Historical 2026-07-13 classification. Pricing reconciliation is closed; the later
Booking and History regressions are also closed. Unlimited Slot Entry is a separate
active Owner policy task, not a reopening of pricing reconciliation:
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
| Pricing reconciliation task | Done - later Booking/History regressions are also closed; Unlimited Slot Entry is a separate active task |

## Worktree / Safety Notes

- Branch: `spike/next-major-security-upgrade`.
- The pre-existing unrelated unstaged `AGENTS.md` remainder remains excluded.
- Historical safety note: the Owner-controlled Production `4+4` draft was restored
  browser-locally after two atomic `409` capacity rejections. No booking was created.
  Do not replay Production confirmation without separate Owner authorization.
- Historical booking-regression rollback evidence referenced
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`. It is not a rollback target for Unlimited
  Slot Entry. The Source Fix is committed and pushed, but no remote migration,
  deployment, or Production UAT exists for it yet, so no release rollback target
  has been established.

## Session Exit Checklist

- Apply the Session Closeout Protocol in `AGENTS.md`.
- Update `PROJECT_STATE.md` and this file whenever policy, source, Production
  state, risks/blockers, or the next task changes.
- Put long reconciliation/release history in `DEVELOPMENT_TODO.md`.
- Run `npm.cmd run check:mojibake` and `git diff --check` for documentation edits.
- Next task: fresh Production preflight, then obtain Owner approval for coordinated
  Remote Migration + exact Deploy + Production UAT. Admin Schedules Performance
  and Homepage LV Copy remain in the Parking Lot.
