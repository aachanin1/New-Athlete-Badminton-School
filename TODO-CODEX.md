# TODO-CODEX.md - Active Execution Index

Last updated: 2026-07-14

This is the short current queue. Read `AGENTS.md`, `PROJECT_STATE.md`, and this
file first. Use `DEVELOPMENT_TODO.md` for detailed history and decision records;
use `TODO.md` only as stale legacy reference after code verification.

## Current Active Work

### 1. History Payment Selection 409 / Invalid Slip Modal State

Status: **AUDITED; SOURCE FIX REQUIRES OWNER APPROVAL**.

- Current classification:
  **PRODUCTION REGRESSION AUDITED - VALID SERVER 409 + CLIENT MODAL BUG; SOURCE
  FIX OWNER APPROVAL REQUIRED**.
- Scoped price proof is closed:
  **PASS - PRODUCTION STEP 4/STEP 5 PRICE UI VERIFIED**. Owner evidence shows both
  Steps at `2,000`, baseline/new/cumulative `4/4/8`, rate `500`, and no Legacy-money
  deduction.
- Exact History route: `POST /api/progressive-payments/prepare`. The incident had
  `11` prepare requests: `5` successful and `6` HTTP 409, plus `5` successful
  cancels. The 409 cause is `PROGRESSIVE_SCOPE_REVISION_CONFLICT` after a prior
  modal close cancelled its prepared batch and incremented the scope revision
  before the page refresh supplied the new revision.
- Selected items `c917f5f6...` (`3,464`, sequence `1`, entitlement `8`) and
  `1a7d58f8...` (`866`, sequence `2`, entitlement `2`) are both owned Progressive
  Kids Group July 2026 bookings in the same scope. The two-item set is the valid
  contiguous pending prefix; there is no Legacy mix, cross-scope selection,
  coupon, payment, attendance, wallet, attempt, or allocation conflict.
- The modal opened only from a real prepare `200`, not from the 409. Two valid
  `4,330` batches existed and were then cancelled. Client lifecycle remains wrong:
  cancel/refresh is not an in-flight state, stale batch/member/total state is not
  cleared, and the 409 error is stored only in a closed dialog surface. Current
  scope revision is `15`, current batch lock is absent, all incident batches are
  cancelled, and no repair/unlock is required.
- Failed 409 requests changed zero Production rows. Separate successful incident
  actions created/cancelled five batches, seven member rows, ten activity logs, and
  advanced scope revision `10 -> 15`. There was no slip/upload, Payment, attempt,
  allocation, coupon, Ledger, Finance, notification, or storage object; financial
  impact is none.
- Source/tests/deploy/environment/migration were unchanged by the audit. Deployment
  remains `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn` Ready on four aliases; Entry and four
  dependencies remain `true`, allowlist absent, shared Test Mode `true`, migration
  `20260713210000` once, and capabilities Ready.
- Next Owner gate: approve a narrow History client/error-contract correction that
  prevents stale-revision retry during cancel/refresh, clears invalid batch state,
  shows typed Thai error copy outside the modal, and requires a current prepared
  batch id before upload UI. Preserve contiguous-prefix/same-scope policy and all
  RPC guards; no migration or Production data repair is proposed.

### 2. Homepage LV Copy Audit/Fix - Paused Again

Status: **PAUSED; NOT STARTED**.

- Resume only after the Production Booking Regression is resolved or the Owner
  explicitly reprioritizes it.
- Audit homepage copy for `LV 71+` / `70+` language against the active school
  level contract of LV 0-70.
- Do not introduce LV 71+ as current Production behavior without explicit Owner
  confirmation.

## Historical Closeout - Kids Group Pricing Reconciliation (Reopened)

Historical 2026-07-13 classification, superseded by the active blocker above:
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
- Rollback was not required after the successful final artifact. The corrected
  Entry-absent deployment remains the documented rollback target.

### Progressive Status Matrix

| State | Current result |
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
| Task done | No - reopened by the 2026-07-14 Production booking regression |

## Worktree / Safety Notes

- Branch: `spike/next-major-security-upgrade`.
- The pre-existing unrelated unstaged `AGENTS.md` remainder remains excluded.
- The Owner-controlled Production `4+4` draft was restored browser-locally after
  two atomic `409` capacity rejections. No booking was created. Do not click
  booking confirmation again unless the Owner separately authorizes it.
- Deployment-health rollback target for the current fix is the pre-fix deployment
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`; Entry must remain `true`. No rollback was
  used because no approved rollback condition was observed.

## Session Exit Checklist

- Apply the Session Closeout Protocol in `AGENTS.md`.
- Update `PROJECT_STATE.md` and this file whenever policy, source, Production
  state, risks/blockers, or the next task changes.
- Put long reconciliation/release history in `DEVELOPMENT_TODO.md`.
- Run `npm.cmd run check:mojibake` and `git diff --check` for documentation edits.
- Next task: Owner decision on the narrow History payment client/error-contract
  source fix above. Homepage LV Copy Audit/Fix remains paused.
