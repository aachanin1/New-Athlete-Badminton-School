# Development TODO

## Decision / Reconciliation Records

### 2026-07-31 — Policy Reset — Owner UAT + Continuous Delivery Decision and Closeout

Status at this closeout: **TASK DONE IN THE PUBLISHED STATE — PM-NA INITIAL POLICY
COMMIT AND ALL THREE EXACT TARGET POLICY/DOCUMENTATION COMMITS COMPLETE; ONE
AUTHORIZED NORMAL TARGET PUSH PUBLISHES THE CONTAINING CLOSEOUT**.

Owner decision:

- Owner approved **POLICY RESET — OWNER UAT + CONTINUOUS DELIVERY**. One approved
  Scope Contract authorizes Developer Codex to execute continuously through audit,
  implementation, focused verification, bounded corrections within Scope, diff
  compliance, commit/push, staged artifact, and READY FOR OWNER UAT.
- Owner PASS authorizes Promotion only of the exact tested artifact/SHA. Any
  Source/configuration change after PASS invalidates that UAT. Developer then runs
  automated Production health/error-log checks, updates documentation once, and
  reports TASK DONE.
- PM-NA remains permanently read-only. Both PM and Developer must challenge
  conflicting assumptions, separate Fact/Inference/Unknown, and never use Owner UI
  PASS to override failing technical/backend evidence.
- This policy-maintenance task authorizes exactly three Target commits and one
  normal non-force Push after all three, plus one local PM-NA Initial Commit. It
  authorizes no Application Source/test/Migration/configuration/Environment,
  manual Deploy/Promotion/Alias, Vercel/Supabase/Production, or data action.
  Automatic Preview from the Target Push is an accepted Git-integration side
  effect only and is not Production.

Gate 0 and current evidence:

- Target repository/branch/upstream matched
  `spike/next-major-security-upgrade` at original HEAD
  `829e0156c1af1f7b130ca280b8b5c191c9514b93`, Ahead/Behind `0/0`.
  The five-path dirty set matched the authorized baseline exactly; no file was
  staged. Protected `src/lib/schedule-slot-utils.ts` had no content diff and
  SHA-256
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Existing Target documentation described legitimate completed prior work, showed
  no Active Task, and had no unresolved Documentation Drift.
- Target baseline commit
  `ddc2a15805f75b83234bca217ab6cf2e90608334` contains exactly `AGENTS.md`,
  `DEVELOPMENT_TODO.md`, `PROJECT_STATE.md`, and `TODO-CODEX.md`.
- PM-NA began as an unborn `master` repository with staged-new `AGENTS.md`,
  untracked `TARGETS.md`, and no remote. Local Initial Commit
  `ec810411157dfb72bc27fc5986a087fc1d1334ac` contains exactly the rewritten
  `AGENTS.md` and byte-unchanged `TARGETS.md`. The first commit invocation created
  no commit because author identity was absent; the successful invocation used the
  already-verified Target author identity through command-scoped `git -c` values,
  without writing Git configuration.
- Target `AGENTS.md` now owns the Developer workflow: One Task, One Approval,
  Continuous Delivery; strict Scope Contract; justified direct technical
  dependencies; bounded corrections; Code Complete and READY FOR OWNER UAT;
  screenshot/backend evidence limits; exact-artifact Owner PASS and Promotion;
  post-Promotion health/log checks; one closeout update; material Hard Stops; and
  No Yes-Man behavior. Permanent business and technical guardrails remain intact.
- Functional File Count is `0`. Application Source, test, Migration, package,
  configuration, Environment, Vercel, Supabase, Production, customer data, and
  financial state did not change.
- Next action at this checkpoint: create the containing Target policy commit,
  verify exact membership, then produce the separate closeout commit. Do not Push
  until all three Target commits exist.

Closeout evidence:

- Target policy commit
  `230085958466558cce493e0a6226b1f361320de3` contains exactly `AGENTS.md`,
  `DEVELOPMENT_TODO.md`, `PROJECT_STATE.md`, and `TODO-CODEX.md`. It preserved all
  permanent business rules and installed the approved Developer workflow.
- The containing closeout commit contains exactly `PROJECT_STATE.md`,
  `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`. Its exact SHA is reported in the
  final handoff because a commit cannot contain its own SHA and the Owner
  prohibited a fourth Target commit.
- Target commits at closeout are exactly: baseline `ddc2a158...`, policy
  `230085958...`, and this containing closeout. They are pending one authorized
  normal non-force Push at commit creation. The final handoff records Push attempt/
  retry count and local/upstream/origin equality; no post-Push documentation
  commit is authorized.
- PM-NA verification remains exactly one local root commit
  `ec810411157dfb72bc27fc5986a087fc1d1334ac`, membership `AGENTS.md` and
  `TARGETS.md`, no remote, and no Push.
- Functional File Count is `0`. Application Source/Test/Migration/Config/
  Environment changed: **No**. Application tests, npm commands, build, browser
  UAT, Vercel, and Supabase checks were Not Run because they were outside Scope.
- Policy verification passed `git diff --check`, Markdown heading inspection,
  required-term searches, contradictory active-policy searches, exact commit
  membership, and combined-diff allowlist review.
- Protected `src/lib/schedule-slot-utils.ts` was never edited, staged, committed,
  normalized, restored, moved, deleted, or cleaned. Gate 0 and closeout SHA-256 are
  identical:
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Manual Deploy/Promotion/Alias/Environment/Production action counts are
  `0/0/0/0/0`. No Vercel write API was called. An Automatic Preview caused solely
  by the Target Push is an accepted Git-integration side effect only; it is not
  Production and receives no manual retry, Promotion, Alias, or other mutation.
- Production Data Changed: **No**. Data Repaired: **No**. Customer Impact:
  **None**. Financial Impact: **None**. Speed Insights: **Not started**.
  Documentation Drift: **No**. Scope Expansion/Breach: **No/No**.
- Active Task in the published state: **None — Awaiting Owner Selection**. Next
  action after the single Push: await Owner selection of a product task; do not
  start Parking Lot work automatically.

### 2026-07-30 — Progressive Kids Group Multi-Branch Create + Pending Edit Source/Local Gate

Status at this local checkpoint: **PASS — SOURCE ONLY; SCOPED SOURCE AND FOCUSED
LOCAL REGRESSIONS PASS; FULL BOOKING E2E COMMAND NOT GREEN DUE TO A PRE-EXISTING
EXPIRED-DATE FIXTURE; UNSTAGED / UNCOMMITTED / UNPUSHED / UNDEPLOYED;
PRODUCTION UNTOUCHED**.

State observed at this closeout:

- Owner selected this as the single Active Task and authorized Source Fix + Local
  Test only. Fresh Gate 0 verified repository root
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, local/upstream/origin HEAD
  `7b7dd912d46b28d4ca299c9221f53abe4c67d075`, Ahead/Behind `0/0`, empty staged
  and untracked sets, and the five disclosed pre-existing dirty paths.
- Baseline worktree blob hashes were captured before the task: `AGENTS.md`
  `e979a2c895dd8fe60a651b4e41f71d49ca020f35`;
  `DEVELOPMENT_TODO.md` `b9ca8979e1965d59210344313292b25ff6ee0ea5`;
  `PROJECT_STATE.md` `5703befbb08a7798a218dbd0eb20095d7be4c378`;
  `TODO-CODEX.md` `f15da96c03bb3ed056edb012c7caf0c1bbf32ae7`;
  and `src/lib/schedule-slot-utils.ts`
  `4521281d099efb189429a744909552d67871ff23`. The two excluded files retain those
  exact hashes and have no task-attributable diff; the three context documents
  retain their prior hunks plus only this task's reconciliation.
- Audit First confirmed the call chain
  `booking-client → POST/PUT /api/bookings → createProgressiveBooking() /
  updateProgressivePendingBooking() → progressive_requested_sessions_v1()`.
  The UI already exposes multi-branch choice; the request/helper layers preserve
  per-session `branch_id` and `schedule_template_id` while separately retaining
  the primary `p_booking_branch_id`.
- Root Cause is the effective function's isolated
  `v_branch <> p_booking_branch_id` rejection. Its remaining active-template and
  canonical-slot lookup already keys on each session's branch/course/day/time and
  optional template hint. Create/update continue to keep `bookings.branch_id` as
  the request primary branch and persist each requested session's own branch,
  template, and canonical slot. Read-only consumer review found no need to change
  API/UI payloads, booking-primary-branch semantics, authorization, or reporting.
- Regression-first execution added the approved fixtures/tests, reset Local
  Supabase to the previous effective schema, and proved the valid two-branch RPC
  create fails exactly with `PROGRESSIVE_INVALID_REQUEST`; the transaction left
  fixture/booking residue `0`. This expected pre-fix proof is not classified as a
  final regression failure.
- The exact functional change is one additive migration:
  `supabase/migrations/20260730000000_fix_progressive_multibranch_booking.sql`.
  It uses `CREATE OR REPLACE FUNCTION` and removes only the all-sessions-equal-
  primary-branch rejection. Automated comparison matched the previous function
  body minus that block. Signature, return contract, `plpgsql`, `STABLE`, invoker
  security, `search_path`, owner, ACL/grants, ownership/timing/same-month/template,
  duplicate/overlap, canonical-slot, idempotency/concurrency/atomicity, Option A,
  and pricing behavior remain unchanged. There is no DML backfill or table/schema/
  grant/RLS change.
- Exact test changes are
  `scripts/check-unlimited-slot-entry-runtime.sql`,
  `tests/booking-regression/local-supabase.ts`, and
  `tests/booking-regression/booking.spec.ts`. They add a disposable second branch
  with active canonical templates/slots; valid two-branch create/pending edit;
  exact baseline-zero `9 × 500 = 4,500`; per-session branch/template/slot linkage;
  single-branch behavior; inactive/nonexistent/cross-branch template, past/started,
  multi-month, unauthorized-child, duplicate/overlap, and cancelled-slot guards;
  unlimited occupancy; idempotent replay/concurrency; and no-partial-artifact
  assertions across bookings, sessions, scopes/snapshots/receipts, coupon/payment/
  allocation, Ledger, Finance, wallet, and activity evidence. The retained
  deterministic rendered `4+4 = 2,000` Option A assertion also passes.
- Final Local evidence: `npx supabase db reset --local` passed the full migration
  chain; direct runtime SQL passed and rolled back; focused new rendered/API E2E
  passed `1/1` with teardown residue `0`; TypeScript, zero-warning ESLint,
  mojibake `250`, Progressive entry `31/31`, Progressive pricing `17/17`, Option A
  Legacy baseline `32/32`, Progressive transactions `33/33`, unlimited UX `27/27`,
  and Legacy baseline concurrency `8/8` passed. Next.js `16.2.6` build passed
  compile/type/static generation `91/91`; only the generated repository `.next`
  was removed after exact-path validation, the dev server was restarted on
  `127.0.0.1:3000`, and root plus CSS asset returned HTTP `200`. Local DB advisors
  exited `0` and contained no reference to the changed function/migration.
- Full `npm run test:booking-regression:e2e` is **Failed at command level only due
  to pre-existing fixture age**: the new task test passes first, then the old
  availability test times out clicking disabled past date `2026-07-22`; nine
  serial tests are skipped and teardown residue remains `0`. The same failure was
  reproduced before any task edit. Correcting that fixture is outside the exact
  allowlist and was not attempted.
- Exact allowlist/blast radius is one functional migration, three test files, and
  three documentation files. No API, UI, helper, old migration, pricing/payment/
  coupon/wallet/reschedule/makeup/attendance/coach/admin source, package/lockfile,
  environment, feature control, allowlist, remote/Production resource, or data
  changed. Scope Expansion: **No**. Scope Breach: **No**.
- Source Complete: **Yes — authorized local scope only**. Tests Passed:
  **Focused/required static and build checks yes; full E2E command no because of
  the proved pre-existing expired fixture**. Migration Applied Locally: **Yes**.
  Migration Applied Remotely: **No**. Committed/Pushed/Deployed: **No/No/No**.
  Production Active/UAT/Controlled Write UAT: **No/Not run/Not run**. Data
  Repaired/Production Data Changed: **No/No**. Customer/Financial impact from this
  gate: **None/None**. Task Done: **No**.
- Next Action: stop and await Owner/PM review. Any correction round, old-fixture
  repair, Commit/Push, remote migration, Deploy, Production UAT/write, repair, or
  Parking Lot work requires a new explicit Owner gate.

#### 2026-07-30 Owner-Approved Test Fixture Correction Round

Status at this correction closeout: **PASS — LOCAL TEST ONLY; FUNCTIONAL SOURCE
UNCHANGED; FULL BOOKING E2E `11/11`; UNSTAGED / UNCOMMITTED / UNPUSHED /
UNDEPLOYED; PRODUCTION UNTOUCHED**.

State observed at this correction closeout:

- Owner authorized only the two booking-regression fixture/spec files and the
  three context documents. Functional/migration changes, Commit, Push, Deploy,
  remote migration, Production access/UAT/write, data repair, and feature/
  allowlist/environment/dependency changes remained prohibited.
- Fresh Gate 0 matched root
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, local/upstream/origin HEAD
  `7b7dd912d46b28d4ca299c9221f53abe4c67d075`, Ahead/Behind `0/0`, and empty staged
  diff. Status contained exactly the nine known prior-gate paths; the existing
  multi-branch migration remained untracked. Baseline hashes were captured for
  every path before correction.
- Protected prior-gate content remained exact through this round: `AGENTS.md`
  worktree blob `e979a2c895dd8fe60a651b4e41f71d49ca020f35`;
  `scripts/check-unlimited-slot-entry-runtime.sql`
  `4d1a489e7c26865a1e609bec4da0fa88b620b764`;
  `src/lib/schedule-slot-utils.ts`
  `4521281d099efb189429a744909552d67871ff23`; and untracked migration
  `20260730000000_fix_progressive_multibranch_booking.sql`
  `2e49f016cd5f168680cc112f5f7789dc5c7a0d5a`. No discard, restore, reset, clean,
  stage, migration edit, or concealment operation occurred.
- The prior Root Cause was reconfirmed without Source change. A direct focused
  line-target run on the old fixture failed exactly at disabled
  `booking-date-2026-07-22`, exit `1`, and teardown residue `0`. An earlier exact-
  anchor grep invocation selected no test and is not counted as root-cause
  evidence; its setup/teardown also left residue `0`.
- Date audit classified `BOOKING_DATES`, `FULL_DATE`, `OVERFULL_DATE`, and
  `RACE_DATE` as selectable/not-started; Legacy baseline sessions, booking scope,
  wallet expiry, Private Sunday/other-month targets, and Admin Makeup source scope
  as directly linked metadata; `2026-07-14` and pending-payment expiry as
  intentional past/expired evidence; and pricing validity/created-at values as
  historical ordering metadata. `MULTI_BRANCH_DATES` was already valid in 2030
  and remained byte-identical.
- The smallest test-only correction moved the single-branch fixture scope to
  deterministic July 2031 constants, moved only directly linked metadata, and
  reused those constants in `booking.spec.ts`. The rendered-flow helper uses the
  existing validated draft contract through `page.addInitScript()` before reload,
  avoiding calendar-click loops and eliminating a debounce race. No assertion,
  timeout, retry, skip, force click, or disabled-element guard was weakened.
- Relative semantics remain explicit: same-month booking/wallet rules, next-month
  Admin Makeup, intentional past/expired rejection, active occupancy `5/6/20`,
  FULL/OVERFULL and RACE behavior, Legacy baseline `4`, Option A `4+4 = 2,000`,
  and multi-branch `9 × 500 = 4,500`.
- Correction verification was regression-driven. Focused availability first
  exposed that a future fixture month must be restored before date clicks; after
  the deterministic draft correction it passed `1/1`. The first full run then
  exposed linked Admin Makeup month metadata and stopped after `5` passes; focused
  Admin Makeup passed `1/1` after moving its source scope with the target. The next
  full run passed `10` tests before exposing the page-evaluate/debounce race in
  actual `4+4`; focused actual `4+4` passed `1/1` after switching to init script.
  Each failed run still reported global teardown residue `0`.
- Final evidence passed: focused availability `1/1` (`8.8s`), focused multi-branch
  `1/1` (`23.7s`), focused Admin Makeup `1/1` (`5.8s`), focused actual rendered
  `4+4` `1/1` (`34.4s`), and exact `npm run test:booking-regression:e2e`
  `11/11` in `3.7m`, skipped `0`, exit `0`, teardown residue `0`. The full run
  included multi-branch `4,500` and rendered Option A `2,000` assertions with no
  unexpected browser console/page errors. `npx tsc --noEmit`, zero-warning
  `npm run lint`, and mojibake `250` passed. Build and runtime SQL were not rerun
  because functional Source did not change.
- Exact Correction Round change count is functional `0`, test `2`, documentation
  `3`. No application Source/API/RPC/migration, package/lockfile, configuration,
  environment, remote/Production resource, or data changed. Scope Expansion:
  **No**. Scope Breach: **No**.
- Source Complete: **Yes — authorized local Source remains unchanged**. Tests
  Passed: **Yes — Local full booking regression**. Migration Applied Locally:
  **Yes through disposable test resets; migration Source unchanged**. Migration
  Applied Remotely: **No**. Committed/Pushed/Deployed: **No/No/No**. Feature/
  Allowlist change: **No/No**. Production Active/UAT/Controlled Write UAT:
  **No/Not run/Not run**. Data Repaired/Production Data Changed: **No/No**.
  Customer/Financial Impact: **None/None**. Task Done: **No**.
- Next Action: stop and await Owner/PM review before any separately authorized
  Commit + Push gate. Do not start another correction, remote migration, Deploy,
  UAT, repair, or Parking Lot task automatically.

#### 2026-07-30 Owner-Approved Commit + Push Publication Gate

Status represented by this containing documentation commit after successful live-
Remote verification: **PASS — COMMITTED AND PUSHED; SOURCE COMPLETE; ACCEPTED LOCAL
CHECKPOINT `11/11`; UNDEPLOYED; REMOTE MIGRATION AND PRODUCTION UNTOUCHED**.

State observed for this publication closeout:

- Owner authorized exactly one Functional/Test commit, one task-specific
  documentation commit, and one normal non-force push on
  `spike/next-major-security-upgrade`. Functional/Test editing, unrelated
  documentation hunks, force/retry, pull/merge/rebase/cherry-pick, branch change,
  Deploy, linked/remote migration, Production access/UAT/write, data repair,
  feature/allowlist/environment/dependency changes, and Parking Lot work remained
  prohibited.
- Gate 0 matched repository root, original local/upstream/origin/live-Remote SHA
  `7b7dd912d46b28d4ca299c9221f53abe4c67d075`, Ahead/Behind `0/0`, and empty staged
  diff. Embedded Playwright report stats were total/expected `11/11`, unexpected/
  flaky/skipped `0/0/0`, `ok=true`; `.last-run.json` was `passed`.
- Accepted Functional/Test worktree blobs remained exact before staging:
  migration `2e49f016cd5f168680cc112f5f7789dc5c7a0d5a`, runtime SQL
  `4d1a489e7c26865a1e609bec4da0fa88b620b764`, Local fixture
  `7239ae58d173276d440abed9a15b706e8791ab8f`, and rendered/API spec
  `2aa1dde8706f8c543177890970ff1b3adbeba7ec`.
- Functional/Test Commit A is
  `f7ee7a1026a543df8e3d215944b9958083aee142`, tree
  `716f194240db7584df0f6230ee428f25d943be35`, parent
  `7b7dd912d46b28d4ca299c9221f53abe4c67d075`. Its membership is exactly
  `supabase/migrations/20260730000000_fix_progressive_multibranch_booking.sql`,
  `scripts/check-unlimited-slot-entry-runtime.sql`,
  `tests/booking-regression/local-supabase.ts`, and
  `tests/booking-regression/booking.spec.ts`.
- The containing Commit B is limited to task-attributable hunks in
  `PROJECT_STATE.md`, `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`. `Pushed: Yes`
  and `PASS — COMMITTED AND PUSHED` are conditional on the one authorized push
  succeeding and independent `git ls-remote` verification resolving the branch to
  Commit B. If push fails, no retry is allowed and this conditional published
  closeout does not take effect.
- Tests were not rerun because all four accepted Functional/Test blobs remained
  byte-identical. Accepted evidence remains full E2E `11/11`, skipped `0`, exit
  `0`, teardown residue `0`, multi-branch `4,500`, Option A `2,000`, TypeScript,
  zero-warning ESLint, and mojibake `250` passed.
- Protected pre-existing dirty work remains local and uncommitted: `AGENTS.md`
  blob `e979a2c895dd8fe60a651b4e41f71d49ca020f35` and
  `src/lib/schedule-slot-utils.ts` blob
  `4521281d099efb189429a744909552d67871ff23`.
- Source Complete/Tests Passed/Committed: **Yes/Yes/Yes**. Pushed: **Yes only after
  successful final live-Remote verification**. Deployed/Migration Applied
  Remotely/Production Active: **No/No/No**. Migration Applied Locally: **Yes —
  disposable Local only**. Production UAT/Controlled Write UAT: **Not run/Not
  run**. Data Repaired/Production Data Changed: **No/No**. Customer/Financial
  impact from this Git publication gate: **None/None**. Task Done: **No**.
- Next Action after successful publication: stop and await Owner review before a
  separate Deploy/remote-migration gate. No Production or Parking Lot action
  starts automatically.

#### 2026-07-30 Owner-Approved Rendered Pending-Edit UI Correction Round

Status at this correction closeout: **PASS — LOCAL TEST ONLY; RENDERED EDIT
SOURCE/REGRESSION COMPLETE; UNSTAGED / UNCOMMITTED / UNPUSHED / UNDEPLOYED;
PRODUCTION UI CORRECTION NOT ACTIVE; TASK NOT DONE**.

State observed at this correction closeout:

- Owner retained **PROGRESSIVE KIDS GROUP MULTI-BRANCH CREATE + PENDING EDIT** as
  the single Active Task and authorized Correction Source Fix + Local Test only.
  The exact allowlist was one functional file, one test file, and task-specific
  hunks in the three context documents. Commit, Push, Deploy, remote migration,
  Production access/UAT/write, data repair, branch/remote changes, feature/
  allowlist/environment/dependency changes, and Parking Lot work were prohibited.
- Fresh Repository-only Gate 0 verified root
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, local/configured-upstream HEAD
  `33eb3af1c95e43e2596455d24c316eb0812b30e4`, Ahead/Behind `0/0` without fetch,
  and an empty staged diff. Functional/test files were clean with initial blobs
  `b44ae6d0fdea308d4a4e2cec8555a3efdd040592` and
  `2aa1dde8706f8c543177890970ff1b3adbeba7ec`.
- Gate 0 dirty worktree blobs were captured before editing: `AGENTS.md`
  `e979a2c895dd8fe60a651b4e41f71d49ca020f35`, `DEVELOPMENT_TODO.md`
  `326277d00df8f65e67ac67889f5525bf2e043fa0`, `PROJECT_STATE.md`
  `6cf4d7de2eea8548f40bb765269eeb009c656998`, `TODO-CODEX.md`
  `fcf0bad9188d1aad25982055b9c43982a0b03e17`, and
  `src/lib/schedule-slot-utils.ts`
  `4521281d099efb189429a744909552d67871ff23`. Protected `AGENTS.md` and
  `schedule-slot-utils.ts` retained those exact blobs; no discard, restore,
  clean, reset, stage, or overwrite occurred.
- Retained Owner-confirmed state from the prior Production gate is now reconciled:
  remote migration `20260730000000_fix_progressive_multibranch_booking.sql` is
  applied, multi-branch database capability is active, and Production create UAT
  passed. Production rendered pending-edit UAT failed because the page displayed
  only the booking primary branch. No Production operation was performed in this
  correction gate; exact deployed application Source/Deployment ID remain
  `Unknown / Need verification` under the Repository-only restriction.
- Fresh Source audit reconfirmed that the dashboard server page selects
  `booking_sessions.branch_id` for every edit session and
  `buildEditSessionsMap()` retains `s.branch_id`. The defect was isolated to
  `selectedBranchIds` initialization from `editBooking.branch_id` alone and draft
  sanitization filtering sessions against that collapsed set. The prior pending-
  edit regression invoked API PUT inside `page.evaluate()` and therefore did not
  prove rendered initialization, multi-branch labels/summary, or Save-button use.
- Regression-first changed only `tests/booking-regression/booking.spec.ts`: after
  a real UI-created pending multi-branch booking it removes the edit-draft key,
  opens the real Edit URL without injecting a multi-branch edit draft, checks both
  branches in Calendar/header/session labels, changes one round through calendar
  controls, checks both Summary branches, clicks `บันทึกการแก้ไข`, verifies the
  booking/session/canonical-slot/price database state, reloads Edit, and separately
  restores a stale edit draft with primary-only `selectedBranchIds` and a valid
  multi-branch `sessionsMap`.
- The focused test against pre-fix Source exited `1` and failed `1/1` exactly at
  the Calendar header: expected second branch `Multi Branch Localhost`, received
  only primary `สาขาทดสอบ Localhost`. Skipped/retries were `0/0`; global teardown
  residue was `0`. This is the expected regression-first proof.
- The minimal functional change is only
  `src/components/dashboard/booking-client.tsx`. Edit mode now derives an ordered
  unique valid union of primary `editBooking.branch_id` followed by all session
  `branch_id` values. Edit-only draft reconciliation prepends that required union
  before sanitizing sessions. New Booking draft semantics remain unchanged;
  `bookings.branch_id` remains the primary first element; per-session branch,
  template hint, canonical slot, and API payload contracts remain intact.
- Post-fix focused rendered Edit passed `1/1` with UI Save, reload, stale-draft,
  browser-error, DB linkage, primary-branch, and `4,500` assertions; residue `0`.
  Focused single-branch create/rendered Edit/UI Save passed `1/1` with canonical
  linkage, unchanged `2,000` price, and residue `0`. Exact final full
  `npm run test:booking-regression:e2e` passed `11/11` in `4.1m`, with
  skipped/unexpected/flaky/retries `0/0/0/0`, residue `0`, multi-branch
  `9 × 500 = 4,500`, Option A `4+4 = 2,000`, single-branch, occupancy,
  concurrency, duplicate/overlap/past/cancelled-slot, and atomicity coverage.
- `npx tsc --noEmit`, zero-warning `npm run lint`, mojibake `250`, and Next.js
  `16.2.6` build compile/type/static generation `91/91` passed. The exact generated
  repository `.next` path was removed, a hidden localhost dev process returned
  HTTP `200` for root and `_next/static/css/app/layout.css`, that gate process was
  stopped, and port `3000` was free. `git diff --check` passed.
- Final correction blobs are functional
  `a8243c7c1ef15a80b6b690649a15c4a098365429` and test
  `d89c88cc50371f74db8825fe834617a30c381049`. Functional/Test/Documentation
  counts are `1/1/3`. No API/RPC/migration/schema/package/lockfile/configuration,
  remote/Production, data-repair, payment/coupon/Ledger/Finance/entitlement,
  attendance/coach/payroll/accounting, customer-data, or financial mutation
  occurred. Scope Expansion: **No**. Scope Breach: **No**.
- Source Complete/Tests Passed: **Yes/Yes for Local correction scope**. Committed/
  Pushed/Deployed: **No/No/No**. Migration changed/applied in this gate:
  **No/No**; retained prior remote apply remains active. Feature/Allowlist change:
  **No/No**. Production correction Active/UAT/Controlled Write UAT:
  **No/Not run/Not run**. Data Repaired/Production Data Changed: **No/No**.
  Customer impact from this gate: **None until deploy**; current Production users
  editing affected pending multi-branch bookings still see the old collapsed UI.
  Financial impact: **No confirmed change; pricing is unchanged**. Task Done:
  **No**.
- Next Action: stop and await Owner review before any separately authorized
  Commit + Push gate. Do not start Deploy, Production UAT/write, repair, or another
  task automatically.

#### 2026-07-30 Rendered Pending-Edit Correction Publication Gate

Status at this publication record: **PASS — COMMITTED AND PUSHED; UNDEPLOYED;
PRODUCTION UI CORRECTION NOT ACTIVE; TASK NOT DONE**, effective only after Commit
B, the one authorized normal push, and independent live-Remote verification
succeed; otherwise the publication handoff reports the actual blocker.

State observed for this publication gate:

- Owner authorized exactly two commits and one normal non-force push for the
  rendered pending-edit correction. Functional/Test bytes were locked to blobs
  `a8243c7c1ef15a80b6b690649a15c4a098365429` and
  `d89c88cc50371f74db8825fe834617a30c381049`. No test rerun, Deploy, remote
  Supabase/migration, Production UAT/write, data repair, or feature/allowlist/
  environment/dependency change was authorized.
- Fresh Gate 0 matched repository root, branch
  `spike/next-major-security-upgrade`, local/configured-upstream HEAD
  `33eb3af1c95e43e2596455d24c316eb0812b30e4`, Ahead/Behind `0/0` without fetch,
  empty staged and untracked sets, and the expected mixed worktree. Live Remote
  preflight independently resolved the same branch to `33eb3af1...`.
- Accepted worktree blobs matched exactly. Protected `AGENTS.md` and
  `src/lib/schedule-slot-utils.ts` retained blobs
  `e979a2c895dd8fe60a651b4e41f71d49ca020f35` and
  `4521281d099efb189429a744909552d67871ff23`; the schedule helper retained no
  content diff. Playwright's booking `.last-run.json` remained `passed` with no
  failed tests, and the existing report artifact was inspected read-only.
- Commit A `7110e6a49ce909635057c06bf0bcb7cf1b371ae6`, tree
  `6a1546920243344d3e60b7ef06b3ead498818745`, parent
  `33eb3af1c95e43e2596455d24c316eb0812b30e4`, subject
  `fix(bookings): preserve multi-branch pending edits`, contains exactly
  `src/components/dashboard/booking-client.tsx` and
  `tests/booking-regression/booking.spec.ts`. Post-commit verification reconfirmed
  both accepted blobs and both protected worktree blobs unchanged.
- Commit B is limited to task-specific rendered pending-edit correction and
  publication hunks in `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`; unrelated pre-existing documentation hunks remain only in
  the worktree. Its exact SHA/tree are recorded in the publication handoff.
- Verification evidence is the accepted Local checkpoint and was not rerun:
  focused post-fix multi-branch and single-branch rendered Edit `1/1` each; full
  booking E2E `11/11`; skipped/unexpected/flaky/retries/residue `0/0/0/0/0`;
  prices `9 × 500 = 4,500` and Option A `4+4 = 2,000`; TypeScript, zero-warning
  ESLint, mojibake `250`, and build/static generation `91/91` passed.
- `Pushed: Yes` becomes effective only after the one authorized
  `git push origin HEAD:refs/heads/spike/next-major-security-upgrade` invocation
  succeeds and local/upstream/origin/live-Remote equality is independently
  verified. A failed push must remain a blocker with no retry.
- Source Complete/Tests Passed/Committed: **Yes/Yes/Yes**. Deployed: **No**.
  Migration changed/applied in this gate: **No/No**. Remote Supabase changed:
  **No**. Production DB multi-branch capability remains active from the prior
  gate; the rendered pending-edit UI correction remains not Production-active.
  Production UAT/Controlled Write UAT in this gate: **Not run/Not run**. Data
  Repaired/Production Data Changed: **No/No**. Customer impact from this
  publication alone: **None until Deploy**. Financial impact: **None; pricing is
  unchanged**. Documentation Drift is reconciled only for this Active Task.
  Task Done remains **No**.
- Next Action after successful push verification: stop and await Owner review
  before a separately authorized Deploy gate. Do not start Deploy, Production UAT,
  repair, Parking Lot work, or another task automatically.

#### 2026-07-30 Local-Only Documentation Reconciliation After Publication and Vercel Preflight

Status at this reconciliation: **PASS — LOCAL DOCUMENTATION RECONCILIATION ONLY;
SOURCE/TEST ALREADY COMMITTED AND PUSHED; AUTOMATIC PREVIEW READY; NO EXACT-SHA
PRODUCTION-TARGET CORRECTION ARTIFACT; RENDERED UI CORRECTION NOT PRODUCTION-
ACTIVE; TASK NOT DONE**.

State observed at this reconciliation:

- Owner retained **PROGRESSIVE KIDS GROUP MULTI-BRANCH CREATE + PENDING EDIT** as
  the single Active Task and authorized only task-specific local documentation
  reconciliation in `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`. Source/Test/Migration/config changes, staging, Commit,
  Push, Git remote requests, Vercel/Supabase/Production requests, Deploy,
  Promotion, Rollback, alias/environment mutation, application/browser UAT,
  data repair, dependency work, and Parking Lot work were prohibited.
- Documentation Drift before this reconciliation was confirmed in the current
  matrix and short execution index: Remote HEAD still named pre-publication
  `33eb3af1...`, Push remained conditional, current Production Source/Deployment
  were Unknown, the exact-SHA Preview and Production-target count were absent,
  and Next Action still waited for Push. Legitimate dated publication history was
  retained unchanged rather than rewritten as current state.
- Fresh local Gate 0 verified repository root
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, local/configured-upstream HEAD
  `244853f5132393f0336d504362e81a45dec19101`, tree
  `b20afa51a2fd31e7ab5e8ae0ab973dbcd0c83f2f`, and Ahead/Behind `0/0` without
  fetch or any remote request. Staged and untracked sets were empty; dirty paths
  remained exactly the five expected pre-existing paths.
- Commit A `7110e6a49ce909635057c06bf0bcb7cf1b371ae6`, tree
  `6a1546920243344d3e60b7ef06b3ead498818745`, parent
  `33eb3af1c95e43e2596455d24c316eb0812b30e4`, contains exactly
  `src/components/dashboard/booking-client.tsx` and
  `tests/booking-regression/booking.spec.ts`. Commit B
  `244853f5132393f0336d504362e81a45dec19101`, tree
  `b20afa51a2fd31e7ab5e8ae0ab973dbcd0c83f2f`, parent Commit A, contains exactly
  the three task-specific context documents. Accepted functional/test blobs
  remained `a8243c7c1ef15a80b6b690649a15c4a098365429` and
  `d89c88cc50371f74db8825fe834617a30c381049`.
- Protected pre-existing work remained exact at Gate 0: `AGENTS.md` blob
  `e979a2c895dd8fe60a651b4e41f71d49ca020f35` and
  `src/lib/schedule-slot-utils.ts` blob
  `4521281d099efb189429a744909552d67871ff23`. Documentation worktree baselines
  before reconciliation were `PROJECT_STATE.md`
  `0e8bd89a471820d8e5162627b12db188bd4215e9`, `TODO-CODEX.md`
  `d852c0992866a35410bd026afee5f863a49c7310`, and `DEVELOPMENT_TODO.md`
  `7fec0f981d4b903272848b4bf4c5cd2385972d9f`; their unrelated pre-existing hunks
  were preserved.
- Owner-accepted read-only Vercel evidence was recorded without calling Vercel in
  this gate. Project identity is `new-athlete-badminton-school`, project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`. Exact release SHA
  `244853f5132393f0336d504362e81a45dec19101` has Automatic Preview
  `dpl_8xCbK71hn2mSzHxGAFx5hCQeXvtF` in `preview/READY/STAGED`; it is not a
  Production-target artifact. Exact-SHA Production-target `READY/STAGED` count is
  `0`.
- Current promoted Production remains
  `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`, source record
  `7b7dd912d46b28d4ca299c9221f53abe4c67d075`, in
  `production/READY/PROMOTED`; all four established Production aliases still point
  to it. The Owner-accepted pre/post deployment inventory and alias mappings were
  unchanged. Deploy/Promotion/Alias/Environment mutation counts in that preflight
  were `0/0/0/0`.
- `PROJECT_STATE.md` now owns one authoritative current value for Git publication,
  Source/Test, Automatic Preview, exact-SHA Production-target count, current
  promoted Production Source/deployment/aliases, migration, feature/allowlist,
  Production-active behavior, UAT, data, customer/financial impact, remaining
  work, and next gate. `TODO-CODEX.md` derives only the short execution index from
  that matrix. Documentation Drift is **No for this Active Task after local
  reconciliation**.
- Source Complete/Tests Passed are **Yes/Yes**; tests are the accepted Local
  checkpoint and were not rerun. Published Source Committed/Pushed is **Yes/Yes**
  from prior gates; this reconciliation is **uncommitted/unpushed**. Automatic
  Preview is **Yes**; exact-SHA Production-target correction artifact and rendered
  correction Production Active are **No/No**. Production DB multi-branch/create
  capability remains **Yes** from the prior gate. Correction Production UAT and
  Controlled Write UAT are **Not run/Not run**. Data Repaired/Production Data
  Changed are **No/No**. Customer and Financial impact from this documentation
  gate are **None/None**. Task Done remains **No**.
- Functional/Test/Migration/config/package files changed in this gate: `0/0/0/0/0`.
  Functional File Count is `0`; documentation file count is `3`. No Git ref,
  external deployment, alias, environment, database, application, Production
  data, customer, payment, pricing, coupon, Ledger, Finance, entitlement,
  attendance, coach, payroll, or accounting state changed.
- Next Action: stop after the local documentation reconciliation and await
  Owner/PM review. The exact-SHA Production-target staged Deploy has separate
  Owner approval but must not start from this documentation gate. Promotion,
  Production UAT/write, repair, or Parking Lot work must not start automatically.

#### 2026-07-30 Local-Only Documentation Reconciliation After Staged Deploy and Builder Exception

Status at this reconciliation: **PASS — LOCAL DOCUMENTATION RECONCILIATION ONLY;
EXACT-SHA PRODUCTION-TARGET ARTIFACT READY/STAGED AND UNALIASED; ARTIFACT-SPECIFIC
BUILDER EXCEPTION ACCEPTED; RENDERED UI CORRECTION NOT PRODUCTION-ACTIVE; TASK NOT
DONE**.

State observed at this reconciliation:

- Owner retained **PROGRESSIVE KIDS GROUP MULTI-BRANCH CREATE + PENDING EDIT** as
  the single Active Task and accepted remote builder Vercel CLI `58.4.0` only for
  `dpl_9aqADgizA8jdh5WXsT84LPgb4gyt`. This exception does not extend to another
  artifact or release. Owner authorized only task-specific local documentation
  reconciliation in `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`; no Source/Test/Migration/config/package edit, staging,
  Commit/Push, external request, UAT, or Parking Lot work was authorized.
- Fresh local Gate 0 verified repository root
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, local/configured-upstream HEAD
  `244853f5132393f0336d504362e81a45dec19101`, tree
  `b20afa51a2fd31e7ab5e8ae0ab973dbcd0c83f2f`, and Ahead/Behind `0/0` without a
  remote request. Staged and untracked sets were empty; dirty paths remained the
  five expected pre-existing paths.
- Accepted functional/test blobs remained
  `a8243c7c1ef15a80b6b690649a15c4a098365429` and
  `d89c88cc50371f74db8825fe834617a30c381049`. Protected `AGENTS.md`,
  `src/lib/schedule-slot-utils.ts`, and `.vercel/project.json` blobs remained
  `e979a2c895dd8fe60a651b4e41f71d49ca020f35`,
  `4521281d099efb189429a744909552d67871ff23`, and
  `645408364e72fcd087ca314b6a566ff8774813d4`. Documentation baselines before this
  reconciliation were `PROJECT_STATE.md`
  `9868953dbe0fbb8382c8ec911b59c58bce5e7e12`, `TODO-CODEX.md`
  `f045258c4cc0baa7b4140d021fe266f75044f16e`, and `DEVELOPMENT_TODO.md`
  `26a10a4ed2cf9c962029119ae0b15b28960a601b`; unrelated hunks were preserved.
- In the prior Owner-approved staged Deploy gate, exactly one invocation ran and
  no retry occurred (`1/1` attempt, retry `0`). It created exact-SHA/tree artifact
  `dpl_9aqADgizA8jdh5WXsT84LPgb4gyt` at
  `new-athlete-badminton-school-gk5it8d9n-aachanin1s-projects.vercel.app` in
  `production/READY/STAGED`. Metadata recorded `autoAssignCustomDomains=false`
  and aliases `0`; exact-SHA Production-target `READY/STAGED` count changed
  `0 → 1`.
- Pinned local Node and Vercel CLI were `24.16.0` and `56.5.0`; the remote builder
  ran Vercel CLI `58.4.0`. Owner accepted that drift as an artifact-specific
  exception only. The build passed `npm ci`, Next.js `16.2.6` compilation,
  TypeScript, and static generation `91/91`. The remote install reported an
  unchanged npm-audit finding of one low and six high vulnerabilities; dependency
  remediation was not authorized or performed.
- Promotion/Rollback/Alias/Environment mutation counts in the staged Deploy gate
  were `0/0/0/0`. Current promoted Production remained
  `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`, source record
  `7b7dd912d46b28d4ca299c9221f53abe4c67d075`, in
  `production/READY/PROMOTED`; all four Production aliases remained mapped to it.
  Automatic Preview `dpl_8xCbK71hn2mSzHxGAFx5hCQeXvtF` and its branch alias were
  unchanged. The rendered pending-edit correction therefore remained not
  Production-active.
- Source Complete/Tests Passed and published Source Committed/Pushed remained
  **Yes/Yes** and **Yes/Yes**. Tests were the accepted Local checkpoint and were
  not rerun. Deployed is **Yes — staged artifact only**; Promoted is **No**.
  Production correction UAT and Controlled Write UAT remained **Not run/Not
  run**. Feature/Allowlist state remained **Yes/No**. Data Repaired/Production
  Data Changed remained **No/No**. Customer and Financial impact from the staged
  artifact and this documentation gate were **None/None**. Task Done remained
  **No**.
- This documentation gate made no Source/Test/Migration/config/package, Git ref,
  Vercel, alias, environment, Supabase/database, application/browser, Production
  data, customer, payment, pricing, coupon, Ledger, Finance, entitlement,
  attendance, coach, payroll, or accounting mutation. Functional File Count was
  `0`; documentation file count was `3`; the documentation edits remained local,
  unstaged, uncommitted, and unpushed.
- Documentation Drift is **No for this Active Task after this reconciliation**.
  `PROJECT_STATE.md` owns the authoritative staged-artifact, builder-exception,
  current Production, and next-gate values; `TODO-CODEX.md` remains the short
  execution index. Next Action: stop and await Owner/PM review before any
  separately authorized read-only staged UAT. Do not start staged UAT, Promotion,
  Production UAT/write, repair, or Parking Lot work automatically.

#### 2026-07-31 Production Promotion/UAT Contract Reconciliation + Release Closeout

Status at this closeout: **DONE — EXACT ARTIFACT PROMOTED AND PRODUCTION-ACTIVE;
RENDERED UAT PASSED AFTER EXPECTED READ-ONLY POST ATTRIBUTION; CONTROLLED RESTORE
AND POST-UAT SELECT-ONLY STATE VERIFIED; DOCUMENTATION COMMITTED/PUSHED; NO
FINANCIAL IMPACT**. The documentation publication statement becomes effective
only after the containing commit and single authorized normal push succeed; exact
closeout SHA/tree and push result are recorded in the final handoff.

State observed at this closeout:

- Owner superseded the prior overbroad UAT transport prohibition only for the two
  exact automatic calls `POST /api/bookings/availability` and
  `POST /api/bookings/preview`, accepted both as expected read-only calls, and
  authorized Source attribution, read-only Vercel reconciliation, post-UAT
  `SELECT` verification, three-document reconciliation, one documentation commit,
  and one normal push. No new browser UAT, `PUT /api/bookings`, booking-create
  POST, PATCH/DELETE, DB/RPC write, Source/Test/config edit, Deploy/Promotion/
  Retry/Rollback, manual alias/environment change, or Parking Lot work was
  authorized or performed.
- Fresh Git Gate 0 matched branch `spike/next-major-security-upgrade`, local/
  configured-upstream/live-Remote HEAD
  `244853f5132393f0336d504362e81a45dec19101`, tree
  `b20afa51a2fd31e7ab5e8ae0ab973dbcd0c83f2f`, Ahead/Behind `0/0`, staged/
  untracked `0/0`, and exactly the five expected pre-existing dirty paths.
  Protected `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and
  `.vercel/project.json` blobs remained
  `e979a2c895dd8fe60a651b4e41f71d49ca020f35`,
  `4521281d099efb189429a744909552d67871ff23`, and
  `645408364e72fcd087ca314b6a566ff8774813d4`. Accepted Functional/Test blobs
  remained `a8243c7c1ef15a80b6b690649a15c4a098365429` and
  `d89c88cc50371f74db8825fe834617a30c381049`.
- Source attribution proved `booking-client.tsx` automatically calls Preview and
  Availability when an Edit draft is ready in Calendar/Summary. Availability
  authenticates the User and reads course, booking, template, slot, and session
  rows through SELECTs only. Preview authenticates, reads the same business
  context, and its helper contains only SELECTs plus
  `progressive_legacy_baseline_v1`. Migration `20260713210000` declares that
  function `STABLE`; its body contains only validation and SELECT/aggregation.
  No `.insert()`, `.update()`, `.upsert()`, or `.delete()` exists in these read
  paths. The actual pending-booking edit mutation is the explicit Save handler's
  `PUT /api/bookings`.
- The prior Owner-authorized Promotion used pinned local Node `24.16.0` and cached
  Vercel CLI `56.5.0` once against exact artifact
  `dpl_9aqADgizA8jdh5WXsT84LPgb4gyt`. Exact command shape was
  `node.exe <cached-vercel-56.5.0-entrypoint> promote
  dpl_9aqADgizA8jdh5WXsT84LPgb4gyt --yes --scope
  team_gw8Y6CPd602WAKRsVFobPGCL --no-color`. It ran from
  `2026-07-31T02:20:41.1424641Z` through `02:20:46.6958163Z`, duration `5.553`
  seconds, exited `0`, and returned Promotion success. Invocation/retry counts
  were `1/0`; no rebuild, new manual deployment, rollback, or separate alias
  command occurred.
- Fresh read-only Vercel evidence matched project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, exact artifact/SHA/tree
  `dpl_9aqADgizA8jdh5WXsT84LPgb4gyt` /
  `244853f5132393f0336d504362e81a45dec19101` /
  `b20afa51a2fd31e7ab5e8ae0ab973dbcd0c83f2f`, and
  `production/READY/PROMOTED`. Creation/build/Ready timestamps were unchanged,
  `autoAssignCustomDomains=false`, the target remained the newest deployment,
  and no later deployment/rebuild existed.
- All four established Production aliases target the promoted artifact:
  `www.newathleteschool.com`, `new-athlete-badminton-school.vercel.app`,
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`. Prior
  Production `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M` remains READY as a rollback
  reference; no rollback occurred.
- Existing authenticated Production UAT evidence was reused without reopening the
  browser. `/dashboard/history` and read-only Edit showed `น้อง Test`, August
  2569, 10 sessions, branches `345`, `แจ้งวัฒนะ`, and `ทวีวัฒนา`, and price
  `4,330` baht. Edit preserved all three branches and all 10 rows, contained
  `2026-08-07 17:00–19:00 @แจ้งวัฒนะ` once, omitted the 11 August replacement,
  and showed no `PROGRESSIVE_INVALID_REQUEST`, console error, page error, or
  overlay. No session was selected/removed and Save was not clicked.
- Exact artifact runtime window `2026-07-31T02:23:20.119Z` through
  `02:25:03.660Z` grouped 68 requests, all HTTP `200`. Application request
  inventory contained exactly one `POST /api/bookings/availability 200` and one
  `POST /api/bookings/preview 200`. `PUT /api/bookings`, booking-create POST,
  PATCH, DELETE, unexpected write endpoint, 4xx/5xx, warning, error, and fatal
  counts were all `0`.
- Post-UAT Supabase verification ran as one bounded `BEGIN TRANSACTION READ ONLY`
  audit and ended with `ROLLBACK`; `transaction_read_only=on`. Target booking
  `fa9de48b-1589-4924-9510-be8eb73c4d6d` remains `pending_payment`, user
  `e8a4b5c9-880d-4a43-b693-96cb0ce26316`, child
  `4209ef39-21cd-494e-9e1f-507e3f0a92d1`, primary branch
  `14ae2056-374e-4a65-b516-a2c15220f0fc`, month/year `8/2026`, sessions/branches
  `10/3`, branch names `345` / `แจ้งวัฒนะ` / `ทวีวัฒนา`, price/entitlement
  `4,330/10`, pricing rate `433`, revision `12`, and canonical linkage `10/10`.
- Exact restored original tuple count was `1`: `2026-08-07`, `17:00–19:00`,
  branch `aa77eba0-d05e-4539-9606-f55fe8a530ca`, template
  `c38a09c3-d37d-4ec8-8f8d-5d47220437bd`, canonical slot
  `087433e1-c7cd-4192-bc96-63ff09b58a0b`. Replacement tuple count was `0` for
  `2026-08-11`, the same branch/time, template
  `680ba191-4e93-4904-92d4-5ff015b69263`, and slot
  `55ce486e-5f50-44f1-b5c1-9448c90f950e`.
- Target payments, coupon reservations/usages, batch memberships, Progressive
  allocations, Ledger allocations, wallet credits, attendance, reschedule
  descendants, coach assignment memberships, and exact-UAT-window Finance
  expenses were `0/0/0/0/0/0/0/0/0/0/0`. UAT-window target receipts, target
  activity, target booking updates, target session create/updates, and same-scope
  booking updates were also all `0`.
- The Owner's known UI restore receipt
  `4c418e92-9fb8-4edf-9d77-5c4982ed17b5` and activity
  `d958ceb6-4cf4-4fc1-825e-a37c3366bf50` remain intact: client request
  `978ab1a5-8e39-449a-8488-101bf8886250`, expected/result scope revision
  `11/12`, `ok=true`, `idempotentReplay=false`, total `4,330`, and no changed
  sibling booking. This was an approved UI restore, not a direct data repair.
- Documentation reconciliation changed only task-specific current-matrix/index/
  dated-closeout hunks in `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`. Historical staged/unpromoted and prior Hard Stop records
  remain explicitly dated history. Functional/Test/config/package/environment,
  deployment, alias, feature/allowlist, booking, DB/RPC, payment, coupon, Ledger,
  Finance, attendance, coach, payroll, and accounting mutation counts in this gate
  are all `0`. Functional File Count is `0`; Scope Expansion and Scope Breach are
  **No/No**.
- The containing commit subject is `docs: close progressive multi-branch release`
  and membership is exactly the three approved documents. One normal non-force
  push to `origin/spike/next-major-security-upgrade` is authorized with retry `0`.
  A Git-integration Automatic Preview is an accepted side effect only; it is not
  Production and must not be promoted, aliased, retried, or recorded through a
  second documentation commit.
- Source Complete/Tests Passed/Source Committed/Source Pushed are
  **Yes/Yes/Yes/Yes**. Deployed/Promoted/Production Active are **Yes/Yes/Yes**.
  Production UAT is **Passed after read-only POST attribution**. Controlled Write
  UAT is **Passed; final restore verified**. Data Repaired is **No direct repair**;
  Production Data Changed in this gate is **No**. Customer impact is the active,
  verified correction. Financial impact is **None**. Documentation Drift is
  **No after commit/push**. Task Done is **Yes**. Active Task is **None**. Next
  Action is await Owner selection; Parking Lot remains unchanged and unauthorized.

### 2026-07-24 — Coach Assignment Status Communication + Save Feedback Source/Local Gate

Status at this local checkpoint: **PASS — SOURCE FIX + LOCAL TEST ONLY; UNSTAGED /
UNCOMMITTED / UNPUSHED / UNDEPLOYED; PRODUCTION UNTOUCHED**.

State observed at this closeout:

- Owner selected this task and authorized only Source Fix + Local Test. Fresh Gate
  0 verified repository root, branch `spike/next-major-security-upgrade`, local /
  upstream / remote HEAD `b79e4d5a2bf31c232f55ceba921012635a357807`,
  Ahead/Behind `0/0`, empty staged/untracked sets, and only the two known excluded
  dirty files. Their SHA-256 values matched before work:
  `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`;
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Source audit confirmed the UI root cause: overall/date summaries classified
  every state other than `saved` as unassigned and also counted `changed`
  separately. Date cards therefore showed red plus amber for the same changed
  slot. The Save success path normalized the local draft, retained API warning
  toast, and called `router.refresh()`, but had no success toast or local evidence
  to hold the saved state until refreshed Server props arrived.
- The Coach client now maps internal `unassigned` and `empty` to red
  `ยังไม่ได้มอบหมาย`, `changed` to amber
  `มีการเปลี่ยนแปลง รอตรวจและบันทึก`, and `saved` to green `มอบหมายแล้ว`.
  Page/date/date-card/slot-card summaries use one exclusive reducer, preserving
  `saved + changed + unassigned = total slots`. Date-card priority is red when
  true unassigned exists, otherwise amber for changed, otherwise green; mixed
  dates show separate red/amber/green count badges. The action filter label is
  `ต้องดำเนินการ` and continues to include every non-saved state.
- Changed detail copy is the exact Owner-approved statement that the prior saved
  assignment remains effective and the change is not sent to the Coach until
  Save. Coach-facing schedule semantics remain persisted-group membership plus
  visible lifecycle only. Admin exact-assignment classification remains unchanged.
- HTTP success now shows `toast.success('บันทึกการมอบหมายสำเร็จ')`, preserves the
  existing API warning toast, and records a normalized per-slot saved signature
  tied to the Server signature observed at Save. The marker is set only after a
  successful response. It renders saved/disabled immediately while refresh is
  intentionally held, returns to changed/enabled after any later draft edit, and
  is ignored when refreshed Server props no longer match its baseline. Response
  normalization updates the local draft only when the user has not edited that
  draft while the request was in flight.
- No API/RPC/database/migration, payload, validation, authorization, atomic save,
  notification, Admin Schedules runtime, Coach Today, environment, feature,
  allowlist, package, or dependency file changed. No API/query, polling, timer,
  global state, or Production path was added. Existing Local E2E call counts stayed
  summary/day/search `4/7/6`.
- Regression coverage increased deterministic checks from `32` to `38` and adds
  status mapping, exclusive summary buckets, action-filter/date-card semantics,
  exact changed copy, safe success-signature invalidation, retained warning toast,
  and persisted Coach schedule visibility assertions. The Local Supabase browser
  flow now proves HTTP error has no success/green transition and remains retryable;
  successful retry makes exactly one success POST, shows toast plus immediate
  green/disabled state while `router.refresh()` is held, then a draft edit returns
  amber/enabled. Existing name persistence, warning-only mixed Level, empty-name
  pre-write rejection, atomic/conflict behavior, Admin classification, mobile,
  and residue assertions remain covered.
- Final Local evidence passed: `npm.cmd run test:admin-schedule-assignment`
  `38/38`; `npm.cmd run test:admin-schedule-assignment:e2e` `6/6` with fixture
  residue `0`; focused Save-state E2E `1/1` with residue `0`; Lesson Wallet
  `17/17`; `npx.cmd tsc --noEmit`; ESLint with zero warnings; mojibake `247` files;
  Next.js 16.2.6 build `91/91` static pages. Post-build cleanup removed only the
  ignored repository `.next` directory after an exact `git clean -ndX -- .next`
  dry run; clean hidden dev restart on `127.0.0.1:3000` passed `/` `200` and CSS
  asset `200` (`text/css`). Final diff/checksum/safety results are recorded in the
  current `PROJECT_STATE.md` matrix.
- Source Complete: **Yes — authorized local scope only**. Tests Passed: **Yes —
  Local only**. Committed/Pushed/Deployed: **No/No/No**. Feature/Allowlist/
  Environment/Migration change: **No**. Production Active for this fix: **No**.
  Production UAT and Controlled Write UAT: **Not run**. Data Repaired: **No**.
  Production Data Changed: **No**. Customer impact from this local change:
  **None yet**. Financial impact: **None**.
- Task Done: **Yes for the authorized Source Fix + Local Test round; No for
  release/Production activation**. Next Action: **Owner review before Commit +
  Push**. No later gate is authorized automatically.

#### Owner-approved retry push + documentation closeout

State observed at this Commit + Push closeout on 2026-07-24:

- Owner authorized one retry of the exact functional normal non-force push after
  the first attempt was rejected by GitHub with Internal Server Error request
  `EA08:392386:5E8D4:65A84:6A638F2A`, followed only after successful functional
  Remote verification by a separate three-file documentation closeout commit and
  normal non-force push. Deploy, Vercel/alias operations, Production access/UAT/
  write, PR creation, history rewrite, and all Source/Test changes remained
  prohibited.
- Fresh Gate 0 verified branch `spike/next-major-security-upgrade`; exact local
  functional commit `fc9f228fa5fc165a3b961636267c6d8614f852cf`; parent
  `b79e4d5a2bf31c232f55ceba921012635a357807`; tree
  `d75793ad61fc0c02dbbc2631cfb957fd8f4ae5d7`; Ahead/Behind `1/0`; empty staged
  and untracked sets; exact functional/documentation/protected hashes; working
  GitHub authentication; and live Remote HEAD at the expected parent.
- The functional commit contains exactly
  `src/components/coach/assign-groups-client.tsx`,
  `scripts/check-admin-schedule-assignment-state.mjs`, and
  `tests/admin-schedule-assignment/admin-schedule-assignment.spec.ts`. The single
  authorized retry succeeded normal non-force. `git ls-remote` and the GitHub
  commit API independently returned exact SHA `fc9f228...`, tree `d75793a...`,
  parent `b79e4d5...`, and the same three-file list.
- Local verification was not repeated because the exact functional commit and all
  three functional SHA-256 checkpoints remained unchanged. The authoritative
  prior Local evidence remains deterministic `38/38`, Local E2E `6/6` residue
  `0`, focused Save-state E2E `1/1` residue `0`, Lesson Wallet `17/17`, TypeScript,
  zero-warning ESLint, mojibake `247`, build `91/91`, clean dev restart/static-
  asset smoke, and call counts summary/day/search `4/7/6`.
- The documentation closeout is the separate commit containing this record with
  subject `docs: close coach assignment status publish`; only `PROJECT_STATE.md`,
  `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md` are included, and it was pushed
  normal non-force after documentation checks and Remote-parent verification.
- Source Complete: **Yes**. Tests Passed: **Yes — Local checkpoint unchanged**.
  Functional and Documentation Committed/Pushed: **Yes/Yes**. Deployed: **No**.
  Feature/Allowlist/Environment/Migration change: **No**. Production Active for
  this fix: **No**. Production UAT and Controlled Write UAT: **Not run**. Data
  Repaired: **No**. Production Data Changed: **No**. Customer Impact: **None yet**.
  Financial Impact: **None**. Documentation Drift: **No**.
- Task Done: **Yes for Source/Local and Commit + Push gates; No for release/
  Production activation**. Blocker: **None**. Next Action: **Owner review before
  Deploy**. Deploy remains unauthorized pending a separate Owner gate.

#### Owner-approved staged Production-target deploy gate

State observed at this staged deployment closeout on 2026-07-24:

- Owner authorized exactly one Production-target Vercel deployment from exact clean
  commit `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`, tree
  `56cd0afb02f64aedba047caef205725a56381b06`, with `--prod --skip-domain`, public
  read-only smoke, alias reconciliation, and local documentation only. Promotion,
  alias commands, authenticated UAT, application/Production writes, retry/force/
  rollback, migration, environment/feature/allowlist changes, Source/Test/config/
  package edits, and documentation Commit/Push remained prohibited.
- Fresh Gate 0 verified branch/local/upstream/live Remote at exact `5544c8a...`,
  Ahead/Behind `0/0`, tree `56cd0af...`, functional ancestor `fc9f228...`, empty
  staged/untracked sets, exact approved and protected hashes, cached Vercel CLI
  `56.5.0`, authenticated account `aachanin1`, project/team linkage, and region
  `icn1`. The Production baseline was `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`,
  `READY/PROMOTED`, Git SHA `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`;
  its exact Production aliases `www.newathleteschool.com`,
  `new-athlete-badminton-school.vercel.app`,
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`, plus
  four branch-preview aliases, were captured.
- A uniquely named detached worktree at
  `C:\Users\aacha\AppData\Local\Temp\codex-coach-status-deploy-20260724-235530-947d89d0`
  was clean at the approved HEAD/tree. Only verified `.vercel/project.json` linkage
  was copied; no environment/token/credential, `node_modules`, `.next`, build
  output, or protected dirty file was copied. The worktree was removed safely
  after evidence collection and is no longer present or registered.
- Exactly one deployment command created
  `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E` at
  `https://new-athlete-badminton-school-255g5cr3r-aachanin1s-projects.vercel.app`.
  Control-plane metadata is target `production`, state/substate `READY/STAGED`,
  current/promoted **No**, source `cli`, `autoAssignCustomDomains=false`, attached
  aliases `0`, Git SHA exact `5544c8a...`, and function region `icn1`. It was
  created `2026-07-24T16:57:43.411Z`, entered build at
  `2026-07-24T16:57:44.522Z`, and became Ready at
  `2026-07-24T16:58:54.970Z`; build duration was `70.448s`.
- Remote build passed using Vercel CLI `56.5.0`, Node `24.x`, and Next.js `16.2.6`.
  Compilation and TypeScript passed, static generation completed `91/91`, output
  build completed in `56s`, build ran in `cle1`, and functions remain configured
  for `icn1`. The log scan found no build error and no error-level runtime record;
  it did report the existing npm audit summary (`7` vulnerabilities) and Node
  engine auto-upgrade warning. No dependency or package file was changed.
- Public unauthenticated application smoke was **Not passed**: direct requests to
  `/`, `/api/health`, and `/_next/static/*` each returned `302` to Vercel SSO due
  to Deployment Protection. Following the redirect returned the Vercel sign-in
  page (`200 text/html`), not application health/static content. No authenticated
  bypass or application request was attempted.
- Post-deploy reconciliation found exactly one post-baseline deployment and one
  production-target deployment from this gate. All eight captured alias mappings
  remained exact: the four established Production aliases still point to
  `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`, all four branch-preview aliases are
  unchanged, the new artifact has zero aliases, and missing/extra/moved aliases
  are `0/0/0`.
- Operation counts: deployment `1`; retry `0`; force `0`; promotion `0`; alias
  command `0`; rollback `0`. Source/Test/config/package/migration/environment/
  feature/allowlist changes: **No**. Authenticated UAT and Production business-data
  write: **No**. Production Data Changed: **No**. Data Repaired: **No**. Customer
  Impact: **None**. Financial Impact: **None**.
- Source Complete: **Yes**. Tests Passed: **Yes — prior Local checkpoint
  unchanged**. Committed/Pushed: **Yes — prior gate**. Artifact creation/build:
  **Passed**. Deployed: **Yes — staged Production-target artifact only**.
  Promoted: **No**. Production Active for this fix: **No**. Production UAT and
  Controlled Write UAT: **Not run**. Overall previous Deploy Gate result:
  **Partial**, because mandatory public application smoke did not reach the app.
  Documentation was updated locally only and remained unstaged, uncommitted, and
  unpushed.
- Blocker at that checkpoint: **Vercel Deployment Protection prevented
  unauthenticated public staged application smoke**. Historical next action was
  Owner review before separately authorized read-only staged UAT. Promotion was
  prohibited.

#### Owner-approved authenticated read-only staged application UAT

State observed at this read-only staged UAT closeout on 2026-07-25:

- Owner authorized only authenticated read-only UAT of exact staged deployment
  `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E` through an existing authorized browser/Vercel/
  Head Coach session. Navigation, GET reads, desktop/mobile rendering, console/
  network/log inspection, and one non-persisted name draft followed by reload were
  authorized. Save, assignment POST, all application/Production writes,
  Controlled Write, promotion/alias movement, deploy/rebuild/retry/rollback,
  direct Production API/database access, Source/Test/config/package/migration/
  environment/feature/allowlist change, Commit/Push, and credential/session
  extraction remained prohibited.
- Fresh Gate 0 verified branch/local/upstream/live Remote
  `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`, tree `56cd0af...`, Ahead/Behind
  `0/0`, exact five-file dirty scope, empty staged/untracked sets, all documentation/
  protected/functional hashes, no functional/config/migration diff, pinned Vercel
  CLI `56.5.0`, account/project/team, and no deployment operation in progress.
  Artifact preflight was exact `production/READY/STAGED`, Git SHA `5544c8a...`,
  source `cli`, region `icn1`, aliases `0`; Production baseline and all four
  aliases remained on `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`.
- Source inspection reconfirmed that group-name `onChange` changes only local React
  draft state. Persistence exists only inside explicit `saveSlot()` POST bound to
  `บันทึก/ยืนยันการมอบหมาย`. The browser runtime exposed no request-interception
  capability, so no guard could be installed; the Save control was never clicked,
  and zero mutation was independently proven from bounded deployment logs.
- An existing Chrome session loaded only
  `https://new-athlete-badminton-school-255g5cr3r-aachanin1s-projects.vercel.app/coach/assign-groups`
  as Head Coach without login or authorization redirect. No cookie, storage,
  password, token, browser profile, or session file was inspected or extracted.
  UAT ran from `2026-07-24T17:15:52.116Z` to
  `2026-07-24T17:20:37.836Z` UTC.
- Natural status evidence was available on 27 July 2026 at เทพารักษ์: green saved
  `10:00–12:00` with two learners, existing amber `17:00–19:00` with three
  learners, and red unassigned `20:00–22:00` with one learner. Page counts were
  total `20`, saved/changed/unassigned `8/6/6`; the invariant held. Date counts
  were exclusive `1/1/1`, with separate green/amber/red cards and no overlap.
- The only draft interaction selected the naturally saved `10:00–12:00` slot and
  changed group name `พื้นฐาน / เริ่มต้น` to
  `พื้นฐาน / เริ่มต้น [UAT-READONLY]`. No other field or control changed. The slot
  became amber with exact label `มีการเปลี่ยนแปลง รอตรวจและบันทึก`, exact approved
  detail copy, and enabled-but-unclicked Save button. Counts became `7/7/6` while
  total remained `20`; red did not increase. `ต้องดำเนินการ` included the edited
  slot and natural red/amber slots while saved-only 25/26 July dates were excluded.
- Reload discarded the client draft. Reopening 27 July restored original group
  name `พื้นฐาน / เริ่มต้น`, removed `[UAT-READONLY]`, returned the slot to green
  with disabled `มอบหมายแล้ว`, and restored counts to `8/6/6`. Existing data did
  not appear changed.
- Desktop `1920x855` and mobile `390x844` passed. Cards, exclusive badges, filter,
  green/red/amber states, exact changed detail copy, and action area remained
  readable. Document width stayed within viewport, horizontal overflow was absent,
  and Next.js overlay count was `0`. Screenshots were captured during the browser
  evidence session; temporary viewport override was reset before closeout.
- Browser console warning/error counts were `0`; page/hydration/overlay errors were
  `0`. Bounded Vercel logs contained `26` unique requests with method distribution
  `GET:26`, status distribution `200:23, 304:3`; assignment-group POST, all
  application POST/PUT/PATCH/DELETE, 4xx, 5xx, error, and fatal counts were all
  `0`. Save click count was `0`. Save-success toast, duplicate-submit, and refresh-
  gap behavior were **Not run on staged — prohibited**; prior Local E2E remains the
  only evidence for that write-path behavior.
- Post-UAT control-plane state remained exact `production/READY/STAGED`, Git SHA
  `5544c8a...`, source `cli`, region `icn1`, aliases `0`, unpromoted/current **No**.
  No deployment was created during UAT, and all four Production aliases remained
  on `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`. Deployment/rebuild/promotion/alias/
  rollback counts were `0/0/0/0/0`.
- Read-only Staged Application UAT: **Passed**. Source Complete: **Yes**. Tests:
  **Passed — prior Local checkpoint unchanged**. Committed/Pushed: **Yes — prior
  gate**. Artifact Build: **Passed**. Deployed: **Yes — staged only**. Promoted:
  **No**. Production Active: **No**. Production UAT and Controlled Write UAT:
  **Not run**. Data Repaired: **No**. Production Data Changed: **No**. Customer
  Impact: **None**. Financial Impact: **None**. Task Done: **Yes through the
  authorized read-only staged UAT; No for promotion/release**.
- Known Documentation Drift is reconciled: artifact creation/build passed, the
  previous Deploy Gate was **Partial** before authenticated application proof, and
  this separately authorized staged application UAT now **Passed**. Documentation
  remains local, unstaged, uncommitted, and unpushed. Blocker: **None for this UAT**.
  Next Action: **Owner review before separately authorized Promotion gate**.

#### Owner-approved Documentation Drift correction + resumed exact-artifact Promotion gate

State observed before the resumed Promotion preflight on 2026-07-25:

- The first Promotion attempt Hard Stopped before any Vercel command because
  `TODO-CODEX.md` contained two present-tense duplicate `Deploy gate` next-action
  statements while Current Active Work and the authoritative `PROJECT_STATE.md`
  matrix correctly pointed to a Promotion gate. This violated the single-owner /
  no-duplicated-mutable-state documentation contract.
- That stopped attempt issued Vercel promotion/deploy/build/rebuild/retry/force/
  rollback/separate-alias commands `0/0/0/0/0/0/0/0`; application synthetic GET,
  POST/PUT/PATCH/DELETE, Save, Production API/database access, business-data write,
  and data repair counts were all `0`.
- Owner explicitly authorized correction of Documentation Drift in only
  `PROJECT_STATE.md`, `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`, followed by a
  fresh Git/Remote/Vercel/control-plane gate and one conditional promotion of exact
  artifact `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E` without rebuild.
- Promotion has not occurred at this checkpoint. External Vercel/Production state
  is `Unknown / Need fresh verification` until the new Fresh Gate 0 passes. Any
  mismatch requires Hard Stop. Production application UAT, Controlled Write, Save,
  deploy/rebuild, retry/force/rollback, separate alias command, Production data
  access/write, Source/Test/API/RPC/config/package/migration/environment/feature/
  allowlist change, Commit, and Push remain unauthorized.
- Conditional next action: run Fresh Gate 0 and promote only the exact artifact if
  every expected Git/Vercel/deployment/alias value matches.

State observed at the completed Promotion closeout on 2026-07-25:

- Documentation correction passed before Vercel mutation: mojibake `247`, scoped
  `git diff --check`, current-state matrix, secret-like additions `0`, forbidden
  diff `0`, independent present-tense `Deploy gate` next actions `0`, and exact
  functional/protected hashes. The three documentation files remained local,
  unstaged, uncommitted, and unpushed.
- Fresh Git Gate 0 verified repository root, branch
  `spike/next-major-security-upgrade`, local/upstream/live Remote HEAD
  `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`, tree
  `56cd0afb02f64aedba047caef205725a56381b06`, Ahead/Behind `0/0`, functional
  ancestor `fc9f228...`, empty staged/untracked sets, exact five-file dirty scope,
  and no Source/Test/API/RPC/config/package/migration diff.
- Fresh Vercel Gate 0 verified cached CLI `56.5.0`, account `aachanin1`, project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, and configured/function region `icn1`. Exact
  target `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E` was
  `production/READY/STAGED`, source `cli`, Git SHA `5544c8a...`, aliases `0`,
  `autoAssignCustomDomains=false`, and not queued. Baseline
  `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9` was `READY/PROMOTED`, Git SHA `b6d974c...`.
  Four Production aliases pointed to the baseline and four branch-preview aliases
  matched their prior deployments. Deployment inventory page count was `20`, the
  latest deployment was the exact target created at `1784912263411`, and pending
  operations were `0`.
- Exactly one command ran:
  `vercel promote dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E --yes --scope team_gw8Y6CPd602WAKRsVFobPGCL --no-color`.
  It started `2026-07-25T07:23:14.0186485Z`, ended
  `2026-07-25T07:23:19.4718722Z`, exited `0`, and promoted that exact artifact.
- Post-promotion control plane reports target/state/substate
  `production/READY/PROMOTED`, Git SHA `5544c8a...`, source `cli`, and region
  `icn1`. Creation `1784912263411`, build start `1784912264522`, Ready
  `1784912334970`, boot, and build-container timestamps did not change. Deployment
  inventory remained page count `20`, latest ID `dpl_93iq...`, latest creation
  `1784912263411`; therefore no deployment or rebuild was created.
- All four established Production aliases moved from `dpl_9Hb6...` to
  `dpl_93iq...`; missing/extra/wrong were `0/0/0`. Branch-preview aliases remained
  exact on `dpl_2T8K7...`, `dpl_7uqAnv...`, `dpl_Cnu2A6...`, and `dpl_3CbHauh...`.
  No separate alias command was issued. Bounded logs since promotion contained
  error/fatal/5xx records `0/0/0`.
- Operation counts for this resumed gate: promotion `1`; deploy/build/rebuild/
  retry/force/rollback/separate-alias `0/0/0/0/0/0/0`. Application route and
  synthetic GET `0`; Save and application POST/PUT/PATCH/DELETE `0`; Production
  API/database access, business-data write, data repair, migration, environment,
  feature, allowlist, Source/Test/config/package change, Commit, and Push were all
  `0`.
- Source Complete: **Yes**. Tests Passed: **Yes — prior Local checkpoint**.
  Committed/Pushed: **Yes — prior gate**. Deployed/Promoted: **Yes/Yes**.
  Production Active: **Yes — control-plane evidence only**. Production UAT and
  Controlled Write UAT: **Not run**. Production Data Changed: **No**. Customer
  Impact: exact Source now receives Production traffic after four aliases moved.
  Financial Impact: **None from this gate**. Documentation Drift: **No** after the
  approved correction. Task Done: **No** pending post-promotion Production UAT and
  documentation publication.
- Next Action: **Owner review before separately authorized read-only post-promotion
  Production UAT**. Do not start UAT, Save, Controlled Write, Commit/Push, or
  another task automatically.

#### Owner-approved read-only post-promotion Production UAT — blocked pre-route

State observed at this blocked UAT checkpoint on 2026-07-25:

- Owner authorized only authenticated read-only Production UAT at
  `https://www.newathleteschool.com/coach/assign-groups` through an existing Head
  Coach session. Filter/date/slot selection, reload, desktop/mobile rendering,
  console/network capture, bounded Vercel logs, and local documentation were in
  scope. Editable-field focus/change, draft mutation, Save, application mutation,
  Controlled Write, Production database/API access, release operations, Source/
  Test/config/package/migration/environment/feature/allowlist change, Commit, and
  Push remained prohibited.
- Source was freshly read and confirmed that filter/date/slot buttons update only
  React selection state. Persistence remains isolated to explicit `saveSlot()` and
  its `POST /api/coach/assignment-groups`; editable inputs, coach/group controls,
  Add group, Level arrangement, learner moves, and Save were excluded from the
  planned browser interactions.
- Local Fresh Gate 0 evidence matched: branch
  `spike/next-major-security-upgrade`, HEAD and local upstream-tracking ref
  `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`, tree
  `56cd0afb02f64aedba047caef205725a56381b06`, local Ahead/Behind `0/0`, functional
  ancestor exact, staged/untracked empty, expected five-file dirty scope, no
  forbidden Source/Test/config/migration diff, exact three documentation hashes,
  and exact functional/protected hashes.
- Mandatory live Remote verification failed before Vercel or browser access:
  `git ls-remote origin refs/heads/spike/next-major-security-upgrade` could not
  connect to `github.com:443` from the managed Developer environment. Per the
  Owner Hard Stop, the gate stopped immediately. The local upstream-tracking ref
  is exact but is not a substitute for live Remote evidence.
- UAT classification: **Blocked / Not run**. Vercel preflight/postflight, browser
  session/role/hostname access, Production route navigation, desktop/mobile UI,
  natural red/amber/green cases, current counts/invariant, filters, amber copy,
  browser console/network, bounded UAT logs, and post-UAT alias/deployment
  comparison were not run and must not be claimed.
- Operation counts from this attempt: Production route/application GET `0`;
  editable-field or client-draft changes `0`; Save `0`; application POST/PUT/PATCH/
  DELETE `0`; Production API/database access and business-data writes `0`;
  deploy/build/rebuild/promotion/retry/force/rollback/separate alias commands `0`;
  Source/Test/config/package/migration/environment/feature/allowlist changes `0`;
  Commit/Push `0`.
- Production Active remains **Yes at the last successful Promotion closeout**;
  fresh external Vercel/alias state is `Unknown / Need verification` for this
  blocked UAT attempt. Production UAT Passed: **No — Blocked / Not run**.
  Controlled Write UAT: **Not run**. Production Data Changed: **No**. Customer
  impact from this attempt: **None**. Financial impact: **None**. Task Done:
  **No**, pending Production UAT and documentation publication.
- Next Action: **Owner review of the network blocker, then rerun Fresh Gate 0 and
  the already authorized read-only post-promotion Production UAT from a network-
  enabled Developer environment**. Do not start Controlled Write, Save, Commit/
  Push, or another task automatically.

#### Owner-approved read-only post-promotion Production UAT retry — passed

State observed at this successful retry closeout on 2026-07-25:

- Owner approved a fresh, read-only retry for exact artifact
  `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E`. Authorized scope was Git/documentation and
  Vercel read-only gates, existing-session Head Coach browser UAT at only
  `https://www.newathleteschool.com/coach/assign-groups`, passive evidence,
  bounded logs, and local documentation. Editable focus/change, client draft,
  Save, application mutation, direct Production API/database access, Controlled
  Write, data repair, deploy/build/rebuild/Promotion/rollback/alias mutation,
  environment/feature/allowlist change, Source/Test/config/package/migration
  change, Commit, Push, PR, and other tasks remained prohibited.
- Fresh Git Gate 0 passed from the repository root: branch
  `spike/next-major-security-upgrade`; local/upstream/live Remote HEAD
  `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`; tree
  `56cd0afb02f64aedba047caef205725a56381b06`; functional ancestor
  `fc9f228fa5fc165a3b961636267c6d8614f852cf`; Ahead/Behind `0/0`; staged and
  untracked `0/0`; exact five-file known dirty scope; forbidden Source/Test/API/
  RPC/config/package/migration diff `0`. Fresh `git ls-remote` returned the exact
  live Remote SHA. Protected, functional, and three starting documentation
  SHA-256 hashes matched the Owner-provided values.
- Vercel preflight passed with cached CLI `56.5.0`, account `aachanin1`, project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, and region `icn1`. The exact deployment was
  `production/READY/PROMOTED`, Current through all four established Production
  aliases, source `cli`, Git SHA exact, concurrent/system queues `false/false`,
  and pending operations `0`. Inventory page count was `20`; latest deployment
  remained the exact target URL with creation `1784912263411`. Production alias
  missing/extra/wrong was `0/0/0`. The four branch-preview mappings were captured
  on `dpl_2T8K7...`, `dpl_7uqAnv...`, `dpl_Cnu2A6...`, and `dpl_3CbHauh...`.
- Browser UAT window was `2026-07-25T09:29:46.145Z` through
  `2026-07-25T09:33:01.353Z`. A new tab in the existing authorized Chrome session
  loaded the canonical Production hostname without login or authorization
  redirect. Visible identity was `โค้ช A'Arm Chanin(หัวหน้า)`, classified as Head
  Coach. Final hostname remained `www.newathleteschool.com`.
- Desktop `1920x855` passed: no horizontal overflow, Next.js overlay, or hidden
  critical status content. Natural state totals were saved/changed/unassigned
  `85/11/25`, and `85 + 11 + 25 = 121`. The selected 25 July date separated
  `16` saved + `4` changed + `0` unassigned = `20`; 26 July separated `14` saved
  + `2` changed + `2` unassigned = `18`, proving changed was not double-counted
  as red. Green `มอบหมายแล้ว`, red `ยังไม่ได้มอบหมาย`, and amber
  `มีการเปลี่ยนแปลง รอตรวจและบันทึก` were all naturally present.
- The exact natural amber detail copy matched:
  `มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก การมอบหมายที่บันทึกไว้เดิมยังมีผล และการเปลี่ยนแปลงนี้จะยังไม่ส่งให้โค้ชจนกว่าจะกดบันทึกอีกครั้ง`.
  `ต้องดำเนินการ` on 26 July showed exactly the two red + two amber slots and
  saved `0`; `มอบหมายแล้ว` on 25 July showed saved `16`, red/amber `0/0`;
  `ทั้งหมด` restored `20` with saved/changed/unassigned `16/4/0`. Date and slot
  clicks never focused an editable control or changed a draft.
- Mobile `390x844` passed: status cards, badges, filters, slot cards, detail, and
  disabled action area were readable; horizontal overflow, clipped filter/action,
  hidden critical content, overlay, and focused editable controls were `0`.
  Reload returned the canonical hostname and preserved Server state at global
  `85/11/25 = 121` and selected-date `16/4/0 = 20`.
- Browser console warning/error count was `0`; observed Next overlay, page,
  hydration, and visible rendering errors were `0`. The Chrome control surface did
  not expose request interception/network events; therefore mutation proof was
  taken from bounded Vercel request logs rather than invented browser evidence.
  Those logs contained `27` unique requests, method distribution `GET:27`, status
  distribution `200:27`, level distribution `info:27`. Application GET/HEAD/
  OPTIONS was `27`; application POST/PUT/PATCH/DELETE `0`; exact
  `POST /api/coach/assignment-groups` `0`; application 4xx/5xx `0`; bounded
  error/fatal/5xx `0/0/0`.
- Postflight at `2026-07-25T09:34:44.7219988Z` kept exact artifact, project/team,
  Git SHA, `production/READY/PROMOTED`, region, creation/build/Ready timestamps,
  inventory page count `20`, latest ID/creation, four Production aliases, and four
  branch-preview mappings unchanged. Pending operations and deployment/rebuild/
  Promotion/rollback/separate-alias mutation during UAT were all `0`.
- Save clicks `0`; client draft changes `0`; assignment POST `0`; application
  mutation `0`; Production business-data writes `0`; Production data repair `0`;
  Source/Test/API/RPC/config/package/migration/environment/feature/allowlist
  changes `0`; Commit/Push/PR `0`. No direct Production API/database inspection
  occurred.
- Final classification: **PASS — READ-ONLY PRODUCTION UAT**. Source Complete and
  prior Local Tests/Commit/Push/Deploy/Promotion remain **Yes**; Production Active
  **Yes**; Production UAT Passed **Yes — read-only**; Controlled Write UAT **Not
  run / unauthorized**; Data Repaired **No**; Production Data Changed **No**;
  Customer impact from this retry **None beyond read-only application requests**;
  Financial impact **None**; Documentation Drift **No** after closeout.
- Task Done remains **No** only because this local documentation is unstaged,
  uncommitted, and unpushed. Next Action: **Owner review; if separately approved,
  Commit + normal non-force Push only `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`**. Do not start Controlled Write, Save, deploy, alias
  mutation, PR, Parking Lot, or another task automatically.

#### Owner-approved documentation-only publication closeout

State observed at this documentation publication closeout on 2026-07-25:

- Owner approved closeout wording, exactly one documentation-only commit, exactly
  one normal non-force Push to `spike/next-major-security-upgrade`, and live Remote
  verification. Only `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md` were authorized. Protected dirty files, Source/Test/API/
  RPC/migration/package/config, Browser/Vercel/Production access, Save, data write,
  deploy/rebuild/Promotion/rollback/alias change, PR, merge/rebase/reset/amend,
  force push, and every other task remained prohibited.
- Fresh Gate 0 started from exact parent
  `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`, tree
  `56cd0afb02f64aedba047caef205725a56381b06`, functional ancestor
  `fc9f228fa5fc165a3b961636267c6d8614f852cf`, branch
  `spike/next-major-security-upgrade`, local/upstream/live Remote exact, and
  Ahead/Behind `0/0`. Staged/untracked sets were empty; the dirty scope was the
  expected three documentation files plus excluded `AGENTS.md` and
  `src/lib/schedule-slot-utils.ts`. Documentation/protected/functional hashes
  matched the approved checkpoints, and forbidden functional diff was `0`.
- The publication unit is the documentation-only commit containing this record,
  with subject `docs: close coach assignment status release`; its exact SHA, tree,
  parent, three-file list, stat, and successful normal non-force Push result are
  reported in the final handoff. No second commit is created to embed its own SHA.
- This closeout changes documentation state only. Source/Test/runtime, deployment,
  Promotion, aliases, environment/feature/allowlist, Production application/data,
  customer behavior, and financial state did not change. Browser/Vercel/
  Production application/API/database access, Save, Controlled Write, data repair,
  and Production write counts were all `0` for this publication gate.
- Final task state after live Remote convergence: Source Complete **Yes**; Tests
  Passed **Yes — prior Local suite unchanged**; functional and documentation
  Committed/Pushed **Yes**; Deployed/Promoted/Production Active **Yes**; Production
  UAT **Passed — read-only**; Controlled Write UAT **Not run / unauthorized / not
  required**; Data Repaired **No**; Production Data Changed **No**; Customer impact
  from this closeout **None**; Financial impact **None**; Documentation Drift
  **No**; Blocker **None**; Remaining Work **None**; Task Done **Yes**.
- Active Task: **NONE**. Next Action: **Await Owner selection; do not start another
  task automatically**. No Parking Lot item is authorized to start automatically.

### 2026-07-24 — Coach Assignment Mixed-Level Save Regression Source/Local Gate

Status at the Source/Local checkpoint: **PASS — NEW OWNER-RULE SOURCE/LOCAL TEST
ONLY; UNSTAGED / UNCOMMITTED / UNPUSHED / UNDEPLOYED; THE STAGED ARTIFACT AT THAT
CHECKPOINT MUST NOT BE PROMOTED**.

#### Owner naming-rule supersession and new Source Fix + Local Test gate

State observed at this 2026-07-24 local closeout:

- Read-only staged UAT passed, then Owner Controlled Write UAT on deployment
  `dpl_vsnYY1QWBybnR3rF51DsqamnQLg7` demonstrated that Save succeeded but changed
  names visible at Save: `กลุ่ม 1` became `ชุดเตรียมนักกีฬา ชุด C` and `กลุ่ม 2`
  became `ชุดพื้นฐาน`. This is Owner-reported evidence; this Source gate did not
  access or write Production.
- Owner superseded the earlier automatic-renaming policy. For Coach Save, every
  non-empty name visible in the name field is authoritative, including `กลุ่ม 1`,
  `กลุ่ม 2`, and other Thai/English names. Save may trim surrounding whitespace
  and remove only a trailing dynamic `(N คน)` suffix. It must not reinterpret or
  replace the visible name from Level. Empty names must fail before a database
  write. `จัดตาม Level` may change the visible draft before Save; mixed/incomplete
  Level remains warning-only; `levelMin/levelMax` still comes from actual members.
- Root cause was confirmed in the Coach-only resolver used by persisted-draft
  initialization, client pre-Save normalization, and API normalization: it treated
  generic/placeholder names as candidates for Level-derived replacement. The
  shared/default resolver used by Admin Makeup is separate and remains unchanged.
- The Coach resolver now strips only the allowed suffix/outer whitespace, rejects
  an empty result with `กรุณากรอกชื่อกลุ่มก่อนบันทึก`, otherwise returns the exact
  cleaned visible name, and independently computes actual-member Level range.
  Existing Coach client/API call sites therefore implement the corrected behavior
  without requiring their own Source diff.
- Deterministic coverage now proves same-category and mixed-Level `กลุ่ม 1/2`,
  manual Thai/English names, dynamic-suffix removal, actual-member range, separate
  warning-only behavior, and empty-name rejection. Browser/API coverage proves
  Save/refetch name stability, `200` mixed Save, pre-write client empty-name
  rejection, API empty-name `400` without state change, and existing atomic/
  conflict protections.
- Fresh Local results: `npm.cmd run test:admin-schedule-assignment` `32/32`;
  `npm.cmd run test:admin-schedule-assignment:e2e` `6/6` against Local Supabase
  with fixture residue `0`; Coach conflict DB `21/21` with residue `0`; Admin
  Schedules performance `24/24`; Lesson Wallet `17/17`; TypeScript, ESLint,
  mojibake (`247` files), Next.js 16.2.6 Production build (`91/91` static pages),
  secret-addition scan, and `git diff --check` all passed. No Production endpoint
  or data was used.
- Post-build `.next` cleanup and clean local restart did not run: the tool execution
  policy rejected removal even after exact resolved-path verification. The build
  passed, but cleanup/restart is not claimed.
- Source/Test changes are limited to
  `src/lib/coach-assignment-group-naming.ts`,
  `scripts/check-admin-schedule-assignment-state.mjs`, and
  `tests/admin-schedule-assignment/admin-schedule-assignment.spec.ts`. The inspected
  Coach client/API require no direct diff. Admin Makeup, Admin Schedules runtime,
  `vercel.json`, packages, migrations, environment, feature controls, and allowlists
  have no task diff.
- The excluded dirty files remained unstaged and checksum-exact: `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Source Complete: **Yes — local Coach flow only under the new Owner rule**. Tests
  Passed: **Yes — Local only**. New fix Committed/Pushed/Deployed: **No/No/No**.
  Existing staged artifact: **READY / unpromoted / superseded behavior; do not
  promote**. Production Active for the new fix: **No**. Feature/Allowlist/
  Environment/Migration change: **No**.
- Controlled Write UAT: **Failed the new naming contract** based on Owner-reported
  results. Production Data Changed: **Yes — Owner reports assignment data changed**.
  Exact database reconciliation/restoration and Data Repaired remain **Unknown /
  Need verification**. Customer impact from that data state is **Unknown / Need
  verification**; no alias or Production Source changed. Financial impact is
  **None known**, while exact protected financial fingerprints remain **Unknown /
  Need verification**.
- Documentation files are updated locally only and remain unstaged/uncommitted.
  Task Done: **No**. Next Action: **Owner review before separately approved Commit
  + Push and read-only Production reconciliation gates. No deploy, Production
  write, or promotion is authorized.**

#### Read-only Production reconciliation gate

State observed during the Owner-approved 2026-07-24 read-only audit:

- Fresh Git Gate 0 matched repository root, branch
  `spike/next-major-security-upgrade`, local/upstream/remote HEAD
  `af9e7e6e71100eb0eada69164a7ab692523771f4`, tree
  `805c2c007a3f74f6eb19c08cda6ee86b831fc492`, and Ahead/Behind `0/0`.
  Staged/untracked sets were empty. The new Coach fix remained local/uncommitted.
  Excluded checksums remained exact: `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Cached Vercel CLI `56.5.0` read-only inspection verified staged deployment
  `dpl_vsnYY1QWBybnR3rF51DsqamnQLg7` remained target `production`, state `READY`,
  Coach assignment Function `icn1` / `nodejs24.x`, with alias count `0`. Before
  and after the audit, all four established Production aliases remained on
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`. No promotion or alias mutation occurred.
- Exact candidate search returned one and only one slot matching Owner evidence:
  schedule slot `8e2ede37-f7d3-4733-b63a-bd8504503f6f`, branch
  `da5ff28b-23a3-4cdb-87ad-8dc5a39a78c5` / เทพารักษ์, Kids Group,
  `2026-07-24` 17:00–19:00, status `open`. The slot had eleven booking-session
  rows: seven active `scheduled` sessions and four `rescheduled` rows; the exact
  assignment contained all seven active verified learners.
- Vercel historical request logs prove exactly two successful staged requests in
  the approved UAT/restoration sequence:
  - request `z9vtb-1784870104339-5fbd309e2785`, `POST
    /api/coach/assignment-groups`, `200`, `2026-07-24T05:15:04.339Z`;
  - request `dnvc5-1784870158304-e50037bf9adc`, the same route/method/status,
    `2026-07-24T05:15:58.304Z`.
  Matching Production activity rows are
  `eb33adf7-a749-4fd3-a29d-5e00c186722b` at `05:15:07.510101Z` and
  `09205f63-02d2-4301-945a-9db744afac6d` at `05:16:00.604159Z`. Both were created
  by Head Coach `05ca3f2e-fe83-4a80-ba60-6cbcf52fdaa5`, recorded two groups,
  seven students, and the same two coach IDs. Activity details do not retain
  names or member IDs, so the exact first-request payload and exact pre-Save
  membership baseline remain **Unknown / Need verification**.
- The atomic RPC deletes and recreates all exact groups and legacy assignments on
  each Save. Therefore current group/member/legacy/reservation IDs represent the
  second request and were all created at `2026-07-24T05:16:00.446856Z`; IDs from
  the first request are no longer present and were not reconstructed.
- Current exact mapping after the second request:
  - group `a6bac691-d7d1-4a4d-acdc-e22d0f417c78`, sort `0`, persisted name
    `ชุดเตรียมนักกีฬา ชุด C`, stored/actual Level range `38–57`, Coach/Head Coach
    `05ca3f2e-fe83-4a80-ba60-6cbcf52fdaa5`:
    - session `34842d9d-847d-42f6-86b7-58d490ebaa93`, booking
      `8a7451e4-d578-4d77-808e-f179da5051ae`, วุฒิภัทร พิญญะพันธุ์ (ภัทร), LV 38;
    - session `0e8b4c91-900f-40d4-8157-49ce2eddeb4a`, booking
      `5587bb4c-937d-42d2-ad44-3c2796c981f4`, เด็กชายสรัล วงษ์เชื่อม (สเปน), LV 57;
    - session `933297a0-46fb-4d69-a34a-95ba4abb9d5d`, booking
      `f6dbf16e-5c13-4cd4-9c7c-566bce6aaf1f`, โสภณวิชญ์ พุกกะณะสุต (ตินติน), LV 41;
    - session `92a87e2d-a25b-4a7b-a351-dd223877cf9e`, booking
      `2fe0532e-d0bf-4c42-a65c-f6ad0e7365a3`, เด็กชายธนกร วงษ์เชื่อม (สปิน), LV 40.
  - group `f460017e-4a6f-44e7-8068-b82a6a2af5b2`, sort `1`, persisted name
    `ชุดพื้นฐาน`, stored/actual Level range `9–22`, Coach
    `a5d186f6-8466-4249-83a2-64d7fd1d0848`:
    - session `1244d5eb-a803-4a23-9e7d-2923703d8dc7`, booking
      `939c2049-a660-4377-9d32-cc9bc4e0745a`, มิลิน วงศ์พนิตนันท์ (เอวา), LV 9;
    - session `d5ffb13a-6502-465e-b435-5dbe480fc015`, booking
      `d0e5bd56-fc3e-49e3-9bfa-993764f84f8e`, ก้องเมธี ห่อประทุม (นอฟ), LV 22;
    - session `f8ec2fa0-b651-43b4-b0a6-45e89533b557`, booking
      `aa4602c0-2e59-4cb1-b9a0-58d56d40b904`, พอเพียง คำอ้าย (พอล), LV 9.
- Legacy rows are complete and coach-set exact:
  `06d5b431-7393-4582-accf-fbb7779750b0` for Head Coach
  `05ca3f2e-fe83-4a80-ba60-6cbcf52fdaa5` and
  `ac9c1ed1-3bed-4a7f-bc17-1103addc054a` for Coach
  `a5d186f6-8466-4249-83a2-64d7fd1d0848`. Reservations use the two current group
  IDs, matching coaches/slot/date and exact Bangkok 17:00–19:00 range; their UTC
  range is `[2026-07-24 10:00:00Z, 2026-07-24 12:00:00Z)`.
- Reconciliation counts were groups/members/legacy/reservations `2/7/2/2`.
  Groups without members, duplicate booking sessions, member group/session
  orphans, slot mismatch, learner-identity mismatch, stored Level-range mismatch,
  missing/extra/duplicate legacy coach rows, missing/orphan reservation, and
  reservation coach/slot/date/time mismatches were all `0`. Active verified
  sessions not present exactly once in a group were `0`.
- Six historical notifications matched this slot label/filter. One notification
  was created by the first UAT Save: row
  `750e306b-5e94-4069-bc13-5c627c29d633`, type `schedule`, recipient Coach
  `a5d186f6-8466-4249-83a2-64d7fd1d0848`, created
  `2026-07-24T05:15:07.447918Z`, link `/coach/today?date=2026-07-24`, for one group
  and three learners. Its rendered message labels the date `23 ก.ค. 69` despite
  the link/slot date `2026-07-24`; this is recorded as observed evidence only and
  no separate task was started. No additional notification was created by the
  second request because the same notification content already existed.
- Protected state at the audit baseline: booking sessions `11` digest
  `6c7f5c281df5e841bcccae4c862256f5`; bookings `9`
  `02e59344694f12d7b76b189dfb06fa7b`; approved payments `9`
  `ed2cb447f5140790a402aa3427e7ebd0`; active wallet credits `2`
  `6de466f7f1aa0f205ec9eeba2e4d34de`; attendance/check-ins/teaching programs/
  teaching hours/weekly summaries/coach payouts each `0`, using empty digest
  `ba2b45bdc11e2a4a6e86aab2ac693cbb`. Assignment digests were groups
  `fe29f2e82b2436098b08335943244410`, members
  `2f907f44acfe123dd5eb367b68a5e453`, legacy
  `3d758d30b254bc99f303bc5e62427cdc`, reservations
  `96ebd3454e4e395c564c7b3e7c8846d4`, activity
  `f1385314344ee151eed6949fd9509cb1`, and notifications
  `31d3e09f4e39dc99b64502248a897c68`.
- Pre-audit capture `2026-07-24T05:57:26.441085Z` and post-audit capture
  `2026-07-24T06:03:59.739120Z` matched for every count and digest. Related
  booking-session, booking, payment, wallet, attendance, check-in, teaching
  program/hour, weekly summary, and payout changes during the UAT window were all
  `0`. Exact-slot assignment activity remained count `6` with latest timestamp
  `05:16:00.604159Z`; no concurrent assignment Save occurred during this audit.
- Every database statement in this gate was `SELECT`/read-only. Application
  mutation requests from this gate were `0`; no application endpoint was opened.
  No Source/Test/config/migration/environment/feature/allowlist, deployment,
  alias, or Production data change occurred in this audit.
- Reconciliation classification: current assignment structure is atomic and
  internally consistent, but group `a6bac691-d7d1-4a4d-acdc-e22d0f417c78`
  (`ชุดเตรียมนักกีฬา ชุด C`) and group
  `f460017e-4a6f-44e7-8068-b82a6a2af5b2` (`ชุดพื้นฐาน`) do not match the
  Owner-reported visible Save names `กลุ่ม 1` and `กลุ่ม 2`. They are **Data
  Repair Candidates only**. Data Repaired: **No**. Financial impact: **None
  detected**. Task Done: **No**.
- Documentation remains local, unstaged, and uncommitted. Next Action: **Owner
  review of this verified reconciliation and explicit selection of any separate
  next gate. No repair, Commit/Push, deploy, Production write/UAT, or promotion is
  authorized automatically.**

#### Owner-approved authoritative-name Commit + Push gate

State observed at the 2026-07-24 publish closeout:

- Fresh Gate 0 matched repository root, branch
  `spike/next-major-security-upgrade`, starting local/upstream/remote HEAD
  `af9e7e6e71100eb0eada69164a7ab692523771f4`, tree
  `805c2c007a3f74f6eb19c08cda6ee86b831fc492`, and Ahead/Behind `0/0`.
  Staged/untracked sets were empty. The only out-of-scope dirty files remained
  `AGENTS.md` and `src/lib/schedule-slot-utils.ts`, with their approved checksums.
- Inspected functional diff remained limited to
  `src/lib/coach-assignment-group-naming.ts`,
  `scripts/check-admin-schedule-assignment-state.mjs`, and
  `tests/admin-schedule-assignment/admin-schedule-assignment.spec.ts`. Coach client
  and API continued to call the Coach-only resolver without direct diff. Shared/
  default naming, Admin Makeup, Admin Schedules runtime, migrations, `vercel.json`,
  packages, lockfiles, configuration, environment, feature controls, and allowlists
  had no task diff. High-confidence credential/secret additions were `0`.
- Fresh Local verification passed: deterministic assignment/isolation `32/32`;
  Local Supabase browser/API E2E `6/6` with fixture residue `0`; Coach conflict DB
  `21/21` with residue `0`; Admin Schedules performance `24/24`; Lesson Wallet
  `17/17`; `npx.cmd tsc --noEmit`; ESLint with `--max-warnings=0`; mojibake `247`
  files; and `git diff --check`. The prior Next.js 16.2.6 Production build passed
  `91/91` static pages on the same unchanged functional Source/Test worktree and
  was not rerun in this publish gate. Its previously unrun post-build `.next`
  cleanup/clean restart remains explicitly not claimed.
- Source/Test commit `a3a573975bb0b8874baf2557aa3fcf9f0786229a`, tree
  `84a2494919f87ed9e8b2f1fd78c1d8d53860f40e`, parent
  `af9e7e6e71100eb0eada69164a7ab692523771f4`, contains exactly the three authorized
  functional files and uses message
  `fix(coach): preserve visible assignment group names`.
- The documentation closeout is the following commit containing this record and
  the matching current matrix. Both commits were pushed normally without force to
  `origin/spike/next-major-security-upgrade` and read-only remote verification
  confirmed matching local/upstream/remote HEAD and Ahead/Behind `0/0`.
- The two excluded dirty files remained unstaged, absent from both commits, and
  checksum-exact: `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`; and
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Source Complete: **Yes — Coach flow only**. Tests Passed: **Yes — Local only**.
  Committed/Pushed: **Yes/Yes**. Deployed/Production Active for the new fix:
  **No/No**. Promoted: **No**. Feature Enabled/Allowlisted/Environment/Migration:
  **No change**. Production UAT for the new fix: **No**. Controlled Write UAT on
  the superseded staged artifact: **Failed the Owner naming contract**. Data
  Repaired: **No**. Production Data Changed: **Yes from the prior Owner UAT and
  `0` from this Commit + Push gate**. Customer impact: the two reconciled persisted
  names remain inconsistent with the Owner contract. Financial impact: **None
  detected**. Documentation Drift: **No**. Task Done: **No**.
- Next Action: **Owner review before a separately approved Deploy gate. The old
  staged artifact must not be promoted, and no data repair, Production write/UAT,
  alias movement, deploy, or promotion is authorized automatically.**

#### Owner-approved authoritative-name staged Deploy gate

State observed at the 2026-07-24 staged deployment closeout:

- Fresh Git Gate 0 matched repository root, branch
  `spike/next-major-security-upgrade`, local/upstream/remote HEAD
  `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, tree
  `271908ac3f84be95391819fb01a47ac197460489`, and Ahead/Behind `0/0`.
  Staged/untracked sets were empty; the only dirty files remained the excluded
  `AGENTS.md` and `src/lib/schedule-slot-utils.ts`, checksum-exact at
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
  `git diff --check` passed; `vercel.json` remained unchanged with configured
  region `["icn1"]`; package, configuration, and migration diffs were `0`.
- Pinned cached Vercel CLI `56.5.0` was authenticated to project
  `new-athlete-badminton-school` / `prj_v034HOI6AjaMpBezWvuvT0W24pTp` in
  organization `team_gw8Y6CPd602WAKRsVFobPGCL`. Fresh CLI help defined
  `--skip-domain` as disabling automatic promotion/aliasing of relevant domains.
- At the pre-deploy timestamp `2026-07-24T06:42:44.2912477Z`, all four established
  Production aliases mapped to `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`. The old
  superseded staged artifact `dpl_vsnYY1QWBybnR3rF51DsqamnQLg7` remained
  `READY` / `STAGED`, target `production`, `autoAssignCustomDomains=false`, with
  zero attached aliases. Existing automatic branch preview
  `dpl_5mxJ9uHHUWJSg18oCf3nV5tKfeTy` predated this gate and was recorded separately;
  it was not used or promoted.
- A task-specific detached worktree was created under
  `C:\Users\aacha\AppData\Local\Temp\codex-nasc-coach-authoritative-deploy-b6d974c-20260724\worktree`.
  It was clean at the exact approved HEAD/tree and did not inherit either excluded
  dirty file, `.env`, credentials, token, `.next`, `node_modules`, or generated
  artifact. Only the verified `.vercel/project.json` linkage metadata was copied.
- The exact command
  `vercel deploy --prod --skip-domain --yes --scope team_gw8Y6CPd602WAKRsVFobPGCL --no-color`
  ran once from that detached worktree with pinned CLI `56.5.0`; exit code was `0`.
  No `--force` or retry was used. Exactly one post-baseline deployment was created:
  `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`, unique URL
  `https://new-athlete-badminton-school-5p92e6c1p-aachanin1s-projects.vercel.app`.
- Control-plane metadata verified target `production`, state `READY`,
  `readySubstate=STAGED`, `autoAssignCustomDomains=false`, source `cli`, actor
  `codex`, and Git SHA `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67` / ref
  `HEAD`. Exact tree identity is proven by the clean detached deployment input at
  `271908ac3f84be95391819fb01a47ac197460489`.
- Remote build succeeded in `79.057 s`: build execution region `cle1`, build
  metadata region `sfo1`, Next.js `16.2.6`, Node.js `24.x` / `nodejs24.x`, and
  static page generation `91/91`. Permanent configured region and the Coach
  assignment Function region remained `icn1`. The build's npm audit reported one
  low and six high dependency vulnerabilities; no dependency change was authorized
  or made in this gate.
- The new deployment has zero attached custom/Production aliases and is not
  Current. Post-deploy inspection found the same eight project aliases in total;
  the four established Production aliases remained exactly on
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`, and no alias was added, removed, or moved.
  Old staged artifact `dpl_vsnYY1QWBybnR3rF51DsqamnQLg7` remained `READY` /
  `STAGED`, unpromoted, and unaliased.
- No application route or unique deployment URL was opened. Production
  application API/database access and mutation requests were `0`. No environment,
  feature, allowlist, migration, Source/Test/configuration, Production data, or
  financial data change occurred. Promotion, rollback, and alias mutation were
  not performed.
- Evidence capture ended at `2026-07-24T06:45:32.8675049Z`. The exact detached
  worktree was removed with `git worktree remove`; its verified-empty task parent
  was removed non-recursively, and no task worktree or temporary file remained.
- Source Complete: **Yes — Coach flow only**. Tests Passed: **Yes — Local only**;
  the successful remote build is deployment evidence, not Production UAT.
  Committed/Pushed: **Yes/Yes**. Deployed: **Yes — staged Production-target
  artifact only**. Promoted/Production Active/Production UAT/Controlled Write UAT
  for the new fix: **No/No/No/No**. Feature/Allowlist/Environment/Migration change:
  **No**. Data Repaired: **No**. Production Data Changed by this gate: **0**.
  Customer impact: **No direct Production change**; the two reconciled persisted
  naming repair candidates remain. Financial impact: **None detected**. Task Done:
  **No**.
- These documentation changes are local, unstaged, and uncommitted. Next Action:
  **Owner review before a separately approved read-only staged-deployment UAT gate.
  Do not promote, move aliases, run Production UAT/write, or repair data
  automatically.**

#### Owner-approved authoritative-name read-only staged UAT gate

State observed during the 2026-07-24 Chrome read-only UAT:

- Fresh Git Gate 0 matched branch `spike/next-major-security-upgrade`, exact
  local/upstream/remote HEAD `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, tree
  `271908ac3f84be95391819fb01a47ac197460489`, and Ahead/Behind `0/0`.
  Staged/untracked sets were empty. Dirty scope was exactly the three authorized
  local documentation files plus excluded `AGENTS.md` and
  `src/lib/schedule-slot-utils.ts`; their SHA-256 values remained
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
  Source/Test/configuration/package/migration/`vercel.json` diffs were `0`, and
  `git diff --check` passed.
- Pre-UAT Vercel control-plane evidence confirmed exact deployment
  `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`, Git SHA
  `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, target `production`, state
  `READY`, `readySubstate=STAGED`, `autoAssignCustomDomains=false`, source `cli`,
  configured/Function region `icn1`, and attached alias count `0`. All four
  established Production aliases remained on
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`; superseded old artifact
  `dpl_vsnYY1QWBybnR3rF51DsqamnQLg7` remained `READY` / `STAGED`, unpromoted,
  and unaliased.
- The first staged navigation redirected to
  `/auth/login?redirect=%2Fcoach%2Fassign-groups`. Codex stopped without entering
  credentials or reading cookies/storage/session secrets and handed the exact
  staged tab to the Owner. After the Owner logged in personally, the exact staged
  hostname/path loaded `/coach/assign-groups` and visibly identified the session
  as `โคัช เบล NA เทพารักษ์ (หัวหน้า)`. Authentication and Head Coach
  authorization therefore passed without opening a Production alias.
- The page already selected Friday 24 July 2026 and the exact 17:00–19:00
  Thepharak slot `8e2ede37-f7d3-4733-b63a-bd8504503f6f`; no date/slot click was
  needed. It rendered one assigned slot, two groups, and all seven learners:
  - `ชุดเตรียมนักกีฬา ชุด C`, Coach `โคัช เบล NA เทพารักษ์ (ตนเอง) - หัวหน้าโค้ช`,
    displayed range `LV 38-57`, four learners: สเปน LV57, สปิน LV40, ตินติน LV41,
    and ภัทร LV38;
  - `ชุดพื้นฐาน`, Coach `โค้ช ชาติ NA เทพารัก - โค้ช`, displayed range
    `LV 9-22`, three learners: พอล LV9, นอฟ LV22, and เอวา LV9.
  This matches the reconciled persisted/current mapping. The assignment state
  displayed `มอบหมายแล้ว`; its Save/status button was disabled. No form control
  was focused, typed into, selected, or changed. `จัดตาม Level (ยังไม่บันทึก)`,
  add/delete, coach, learner-group, Save, and Confirm controls were not clicked.
- Desktop `1920x855` rendering and mobile viewport `390x844` rendering passed.
  Both retained the exact slot, names, ranges, coaches, and seven learners. Desktop
  and mobile document width equaled client width; horizontal overflow was absent.
  Mobile inspection found zero controls outside the viewport and no overlapping or
  unreadable group/control layout in screenshot evidence. The temporary viewport
  override was reset before browser closeout.
- Browser console warning/error entries were `0`. Next.js error-overlay count,
  page error, hydration/React error, authorization error, and active JavaScript
  dialog were `0`. No unsaved-draft state was introduced by this gate.
- UAT log interval was `2026-07-24T07:47:42.636Z` through
  `2026-07-24T07:50:56.172Z`. Pinned Vercel CLI `56.5.0` found `50` unique
  requests, all `GET`: `/coach` `7x200`; `/auth/register` `6x200` plus `5x307`;
  `/coach/today` `6x200`; `/` `4x200`; `/coach/students`,
  `/coach/assign-groups`, and `/coach/notifications` `3x200` each;
  `/coach/hours`, `/coach/checkin`, `/profile`, `/coach/attendance`,
  `/coach/levels`, and `/coach/programs` `2x200` each; and `/auth/login` `1x200`.
  The Coach/auth route fan-out and `307 /auth/register` entries were automatic
  Next.js prefetch/navigation behavior, not clicked routes or business writes.
- Application `POST`, `PUT`, `PATCH`, and `DELETE` counts were `0`.
  `/api/coach/assignment-groups` POST count, Save/Confirm request count, 4xx, 5xx,
  warning-level, error-level, and runtime-error counts were all `0`. No direct
  Production database/API query was made; Production data write attributable to
  this gate was `0`.
- Post-UAT metadata remained `production / READY / STAGED`, unpromoted, region
  `icn1`, `autoAssignCustomDomains=false`, with attached alias count `0`. All four
  Production aliases remained on `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`; no alias
  was added, removed, or moved. The old staged artifact remained unpromoted.
- Read-only staged UAT: **Passed**. Authoritative Save behavior: **Unknown / Need
  Controlled Write UAT** because no draft or Save may be exercised in this gate.
  Source Complete: **Yes — Coach flow only**. Tests Passed: **Yes — Local only**.
  Committed/Pushed: **Yes/Yes**. Deployed: **Yes — staged artifact only**.
  Promoted/Production Active/Controlled Write UAT: **No/No/No**. Feature/
  Allowlist/Environment/Migration change: **No**. Data Repaired: **No**.
  Production Data Changed by this gate: **0**. Customer impact: **No direct
  Production change; the two persisted naming repair candidates remain**.
  Financial impact: **None detected**. Task Done: **No**.
- Documentation is local, unstaged, and uncommitted. Next Action: **Owner review
  before a separately approved Controlled Write UAT and/or Data Repair gate.
  Promotion remains unauthorized; do not Save, repair, write Production data,
  promote, or move aliases automatically.**

#### Owner-approved combined Controlled Write UAT + exact two-name repair

State observed during the 2026-07-24 controlled staged-write closeout:

- Owner authorized exactly one Save through staged deployment
  `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9` for exact slot
  `8e2ede37-f7d3-4733-b63a-bd8504503f6f`, 2026-07-24 17:00–19:00 Bangkok,
  เทพารักษ์. Only sort-0/sort-1 names could change to `กลุ่ม 1` / `กลุ่ม 2`; coach,
  member, sort, Level, and slot changes were prohibited. Retry and restoration Save
  were not authorized.
- Fresh Gate 0 at `2026-07-24T15:14:16.672` Bangkok matched branch
  `spike/next-major-security-upgrade`, local/upstream/remote HEAD
  `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, tree
  `271908ac3f84be95391819fb01a47ac197460489`, Ahead/Behind `0/0`, staged/untracked
  `0/0`, and the expected three documentation plus two excluded dirty files.
  `git diff --check` passed. Excluded checksums remained `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Fresh Vercel control-plane evidence matched exact Git SHA, target `production`,
  `READY / STAGED`, `autoAssignCustomDomains=false`, source `cli`, region `icn1`,
  attached aliases `0`, and not Current. All four Production aliases remained on
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H` before the write.
- Fresh Production SELECT baseline at `15:19:58.359231` Bangkok found slot status
  `open`, no activity in the preceding 15 minutes, and zero attendance, check-in,
  teaching-program/hour, weekly-summary, or payout evidence. Pre-click recheck at
  `15:22:09.094457` still had `recent_activity_15m=0`, check-ins `0`, attendance
  `0`, and time before 17:00.
- Exact baseline groups/members/legacy/reservations were `2/7/2/2`. Sort 0 group
  `a6bac691-d7d1-4a4d-acdc-e22d0f417c78` persisted
  `ชุดเตรียมนักกีฬา ชุด C`, Coach
  `05ca3f2e-fe83-4a80-ba60-6cbcf52fdaa5`, range `38–57`, and sessions
  `34842d9d...`, `0e8b4c91...`, `933297a0...`, `92a87e2d...`. Sort 1 group
  `f460017e-4a6f-44e7-8068-b82a6a2af5b2` persisted `ชุดพื้นฐาน`, Coach
  `a5d186f6-8466-4249-83a2-64d7fd1d0848`, range `9–22`, and sessions
  `1244d5eb...`, `d5ffb13a...`, `f8ec2fa0...`. All seven were active verified and
  assigned exactly once; every baseline orphan/duplicate/identity/range/legacy/
  reservation mismatch count was `0`.
- Protected pre-write fingerprints were booking sessions `11` /
  `6c7f5c281df5e841bcccae4c862256f5`, bookings `9` /
  `02e59344694f12d7b76b189dfb06fa7b`, payments `9` /
  `ed2cb447f5140790a402aa3427e7ebd0`, wallet credits `2` /
  `6de466f7f1aa0f205ec9eeba2e4d34de`; attendance, check-ins, teaching programs,
  teaching hours, weekly summaries, and payouts were each `0` with digest
  `d41d8cd98f00b204e9800998ecf8427e`. Slot-specific matching assignment
  notifications were `4`, digest `39b8a1c5c362f66642134995e650209c`.
- Existing Owner/Head Coach Chrome authentication showed
  `โคัช เบล NA เทพารักษ์ (หัวหน้า)`. The exact staged hostname and target slot
  rendered the baseline mapping. Codex changed only the two name inputs. The
  approved client payload was slot `8e2ede37...`, branch `da5ff28b...`, and two
  ordered groups: `กลุ่ม 1` / Coach `05ca3f2e...` / range `38–57` / the original
  four sessions; and `กลุ่ม 2` / Coach `a5d186f6...` / range `9–22` / the original
  three sessions. Coaches and all seven learner-group controls remained unchanged
  before Save.
- Save was clicked exactly once at `2026-07-24T08:22:20.611Z`. Vercel request
  `xdlkj-1784881343649-b67b7bea8a1e` is the one and only application mutation:
  `POST /api/coach/assignment-groups`, staged hostname, status `200`, log timestamp
  `2026-07-24T08:22:23.649Z`. No retry, double-click, confirmation repeat, or
  restoration occurred. The raw response body/duration was not exposed by the
  available Chrome/Vercel log surfaces; the route contract plus UI and exact
  database reconciliation prove the success/result semantics.
- The atomic RPC created sort-0 group
  `bc51314c-7708-4ecb-bf56-98f3813fbdd5` as `กลุ่ม 1`, Coach `05ca3f2e...`, range
  `38–57`, and sort-1 group `17df9379-0b77-49b2-a6ae-3d79569323e6` as `กลุ่ม 2`,
  Coach `a5d186f6...`, range `9–22`, at
  `2026-07-24T08:22:25.349542Z`. The exact seven session/student mappings remained
  semantically identical. UI refetch settled to `มอบหมายแล้ว`, retained the two
  names/ranges/coaches/members, and showed no unsaved indicator.
- Post-write groups/members/legacy/reservations were `2/7/2/2`. Old group IDs were
  absent; group-without-member, duplicate session, member/session orphan, slot or
  learner identity mismatch, stored-range mismatch, legacy missing/extra/duplicate,
  and reservation missing/extra/mismatch counts were all `0`. Active verified
  learners remained `7/7`, each exactly once.
- Activity delta was exactly one row:
  `c858de48-c346-468f-b079-3b25e1579e00`, actor Head Coach `05ca3f2e...`, action
  `save_coach_assignment_groups`, groupCount `2`, studentCount `7`, both exact coach
  IDs, created `2026-07-24T08:22:25.625655Z`. Notification delta was `0`, and the
  prior notification count/digest remained `4` /
  `39b8a1c5c362f66642134995e650209c`.
- Every protected fingerprint was unchanged: booking sessions, bookings, payments,
  wallet, attendance, check-ins, teaching programs/hours, weekly summaries, and
  payouts matched the pre-write counts/digests. Financial/protected delta was `0`.
  Chrome console warning/error, page/hydration/React/Next.js error, Vercel 4xx/5xx,
  and runtime error/fatal counts were all `0`. The bounded Vercel interval contained
  `41` unique requests: exactly one POST `200` and `40` navigation/prefetch GETs.
- Post-write deployment remained `production / READY / STAGED`, unpromoted, region
  `icn1`, `autoAssignCustomDomains=false`, attached aliases `0`. All four established
  Production aliases still pointed to `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`; no
  deployment, promotion, rollback, alias, environment, feature, allowlist, migration,
  Source/Test, payment, wallet, attendance, check-in, teaching, or payroll mutation
  occurred beyond the one approved assignment Save.
- Controlled Write UAT: **Passed**. Authoritative Save behavior: **Passed for the
  exact approved payload**. Data Repaired: **Yes — exact slot/two names only**.
  Production Data Changed: **Yes — expected atomic assignment-row replacement and
  one activity row; no residual protected/financial change**. Customer impact: the
  two exact persisted naming mismatches are repaired. Financial impact: **None**.
  Source Complete/Tests Passed/Committed/Pushed/Deployed: **Yes/Yes/Yes/Yes/Yes —
  deployment remains staged only**. Promoted/Production Active: **No/No**. Task
  Done: **No**.
- Documentation remains local, unstaged, and uncommitted. Next Action: **Owner
  review before a separately authorized Promotion gate. Do not Save again, repair
  another row, deploy, promote, roll back, or move aliases automatically.**

#### Owner-approved exact-artifact Promotion — no rebuild

State observed during the 2026-07-24 Promotion-only closeout:

- Owner authorized only Promotion of exact deployment
  `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`, unique URL
  `https://new-athlete-badminton-school-5p92e6c1p-aachanin1s-projects.vercel.app`,
  Git SHA `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, tree
  `271908ac3f84be95391819fb01a47ac197460489`, without rebuild. Production route
  access, authenticated UAT, API/database access, business write, deploy, rollback,
  retry, and separate alias commands were prohibited and did not occur.
- Fresh Git Gate 0 matched branch `spike/next-major-security-upgrade`, exact
  local/upstream/remote HEAD and tree, Ahead/Behind `0/0`, staged/untracked `0/0`,
  and exactly the known three documentation plus two excluded dirty files.
  `git diff --check` passed; Source/Test/config/package/migration/`vercel.json`
  diffs were `0`. Excluded SHA-256 checksums matched the approved values.
- Cached pinned Vercel CLI `56.5.0` and authenticated account `aachanin1` matched
  project `new-athlete-badminton-school`, project ID
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, and organization
  `team_gw8Y6CPd602WAKRsVFobPGCL`. Fresh `vercel promote --help` confirmed ID/URL,
  `--yes`, `--scope`, and `--no-color` support and that Promote makes an existing
  deployment Current.
- Pre-promotion target metadata was exact: `production / READY / STAGED`, source
  `cli`, Git SHA matched, region `icn1`, deployment-level
  `autoAssignCustomDomains=false`, attached aliases `0`. Current Production was
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`. The two unbranched project domains plus two
  automatic Production aliases formed the exact approved set of four; all pointed
  to the previous Current deployment. Four separate branch-preview aliases were
  identified and were outside the Production target set.
- Exact command
  `vercel promote dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9 --yes --scope team_gw8Y6CPd602WAKRsVFobPGCL --no-color`
  ran once from `2026-07-24T16:01:20.7047308+07:00` to
  `2026-07-24T16:01:25.8707679+07:00`, exit `0`. Promotion command count was `1`;
  deploy/build/rebuild/rollback/alias-command/force/retry counts were each `0`.
- Post-promotion control-plane reconciliation found target `READY / PROMOTED` and
  Current with the same creation/build/ready timestamps and max deployment
  `createdAt=1784875390875`, proving no deployment or rebuild was created. Exactly
  four Production aliases moved to `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`:
  `www.newathleteschool.com`, `new-athlete-badminton-school.vercel.app`,
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`.
  Missing/extra moved Production aliases were `0/0`; all branch-preview aliases
  remained on their prior deployments. Superseded
  `dpl_vsnYY1QWBybnR3rF51DsqamnQLg7` remained `READY / STAGED`.
- Application routes exercised, Production API/database access, and Production
  mutation requests were each `0`. Post-promotion runtime/UAT was **Not run —
  outside this Promotion-only gate**. Production Data Changed by this gate was
  `0`; prior exact two-name Data Repair and Controlled Write UAT remain Passed.
- Source Complete/Tests Passed/Committed/Pushed/Deployed/Promoted/Production Active:
  **Yes/Yes/Yes/Yes/Yes/Yes/Yes**, with Tests scoped to prior Local evidence.
  Production UAT: **staged artifact passed; post-promotion not run**. Financial
  Impact: **None**. Task Done: **No**.
- Documentation remains local, unstaged, and uncommitted. Next Action: **Owner
  review before a separately approved read-only post-promotion Production UAT
  gate. Do not run UAT, Save, repair, deploy, rollback, additional Promotion,
  alias movement, Commit, or Push automatically.**

#### Owner-approved read-only post-promotion Production UAT — network gate incomplete

State observed during the 2026-07-24 post-promotion read-only checkpoint:

- Fresh Gate 0 matched branch `spike/next-major-security-upgrade`, exact local/
  upstream/remote HEAD `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, tree
  `271908ac3f84be95391819fb01a47ac197460489`, Ahead/Behind `0/0`, staged/untracked
  `0/0`, expected dirty scope, exact excluded checksums, and zero Source/Test/
  config/package/migration/`vercel.json` diff. Pinned CLI `56.5.0`, account,
  project, organization, and region `icn1` matched.
- Vercel control plane before and after UAT kept exact deployment
  `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9` as `READY / PROMOTED / Current`. All four
  established Production aliases remained on that deployment with missing/wrong
  targets `0/0`. Deploy/rebuild/Promotion/rollback/alias-command counts were `0`.
- Existing Chrome session authenticated as Head Coach
  `โคัช เบล NA เทพารักษ์(หัวหน้า)` at exact hostname/path
  `www.newathleteschool.com/coach/assign-groups`. Authorization passed without a
  login redirect or credential handling.
- Exact 2026-07-24 17:00–19:00 เทพารักษ์ slot rendered `2` groups, `7`
  learners, disabled `มอบหมายแล้ว` state, and no gate-created unsaved
  state. `กลุ่ม 1` retained Head Coach, LV `38–57`, and ภัทร/สเปน/ตินติน/
  สปิน. `กลุ่ม 2` retained โค้ช ชาติ, LV `9–22`, and เอวา/นอฟ/พอล.
  Input values remained exactly `กลุ่ม 1` / `กลุ่ม 2`; no form control was
  focused, typed, selected, or changed.
- Desktop `1920x855` and mobile `390x844` screenshots were captured. Both had
  horizontal overflow `false`, offscreen visible-control count `0`, and overlay
  count `0`. Mobile viewport was reset and the agent tab was finalized after
  evidence capture.
- Bounded browser interval was `2026-07-24T09:22:01.017Z`–
  `2026-07-24T09:25:05.684Z`. Chrome console warning/error count, JavaScript
  dialog count, and Next.js overlay count were `0`. The attributable Coach load
  burst contained `19` unique `GET 200` requests: one exact
  `/coach/assign-groups` load and `18` automatic Coach navigation prefetches.
  `/api/coach/assignment-groups POST`, Save/Confirm, and attributable business
  mutation counts were `0`; Vercel 4xx/5xx and warning/error/fatal counts were `0`.
- The deployment-wide interval also contained four later `POST 200` requests:
  `/api/bookings/availability` IDs `db485-1784884936846-3c8e9748cb4d` and
  `j85gd-1784884992883-e88d3a5d986b`, plus `/api/bookings/preview` IDs
  `5z454-1784884950349-4e9aef321345` and
  `bc4r2-1784884992883-02050b9a52de`. They did not match the Coach request burst;
  Source inspection found both endpoint paths use read-only SELECT operations.
  However, browser-level request attribution was unavailable and direct Production
  database reconciliation was prohibited, so the strict expected GET/HEAD-only
  network gate is **Incomplete**. Browser interaction stopped and was not resumed.
- Application page read through the Production alias: **Yes**. Direct Production
  API/database access: **0**. UAT-attributable Production business write/data
  delta: **0**. No Save, repair, deploy, rebuild, Promotion, rollback, alias,
  environment, feature, allowlist, Source/Test, Commit, or Push occurred.
- Production remains active and visible rendering passed, but overall
  post-promotion Production UAT is **Incomplete**, not Passed. Task Done: **No**.
  Next Action: **Owner review before a separate isolated read-only network-
  attribution/retest gate; documentation publication remains unauthorized.**

#### Owner-accepted post-promotion live Save and read-only Production closeout

State observed during the 2026-07-24 documentation closeout after Owner accepted
the live Production Save as business UAT evidence:

- Owner supplied two screenshots for เทพารักษ์, 2026-07-25 09:00–11:00. The
  pre-Save image shows `kids_group`, `9` learners, custom names
  `กลุ่มโค้ชชาติ` / `กลุ่มโค้ชเบล`, Coach ชาติ / Head Coach เบล, and
  `Level ต่างหมวด — เตือนเท่านั้น` on the mixed group. The post-Save image keeps
  both names and mappings and shows `มอบหมายแล้ว`. Owner accepted this exact
  post-promotion live Save as the closing business UAT evidence.
- Fresh Git Gate 0 matched repository root, branch
  `spike/next-major-security-upgrade`, starting local/upstream/actual remote HEAD
  `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, tree
  `271908ac3f84be95391819fb01a47ac197460489`, Ahead/Behind `0/0`, staged/untracked
  `0/0`, and exactly the known three documentation plus two excluded dirty files.
  `git diff --check` passed and Source/Test/config/package/migration/`vercel.json`
  diffs were `0`. Excluded SHA-256 checksums matched the approved values.
- Exact Production slot is `6e27b409-27e8-4b67-966b-75b27248c13d`, branch
  `da5ff28b-23a3-4cdb-87ad-8dc5a39a78c5`, เทพารักษ์, `kids_group`,
  2026-07-25 09:00–11:00. Active verified learners are `9/9`, each assigned
  exactly once.
- Sort 0 group `bcd619de-1138-4a90-9504-e11332b8d729` persists
  `กลุ่มโค้ชชาติ`, Coach ชาติ `a5d186f6-8466-4249-83a2-64d7fd1d0848`, and
  stored/actual range `3–11`. Exact members are วิน LV3 session
  `e2b9f979-9e1b-4f0d-8295-e98679aefec7`, อคิณ LV3
  `4f2391a6-a020-46de-8578-00c07e680f43`, พั้นช์ LV6
  `ffeede93-683e-4c80-bc64-7e557f726cb2`, เฌอ LV6
  `ce2ba0fe-c5aa-4ac8-b44d-d1285aa7b8fa`, and ต้นไม้ LV11
  `af1cf4b5-77d4-444c-bac1-92815200ba7b`.
- Sort 1 group `6edff27a-6d34-44b6-a00f-8a4403ad4544` persists
  `กลุ่มโค้ชเบล`, Head Coach เบล `05ca3f2e-fe83-4a80-ba60-6cbcf52fdaa5`, and
  stored/actual range `7–35`. Exact members are ผิง LV7 session
  `cc6d9d61-0ba9-4844-9754-686a48e94f02`, น้องณดา LV31
  `519c946d-3dab-4265-99ce-6c1b84ded6b3`, ZJ LV35
  `8da4f047-67fb-446e-ae52-f1ca7df0a5f3`, and ภูดิส LV35
  `9c251f24-ba89-45fa-b8f7-3dc91f24c7c4`.
- Groups/members/legacy/reservations reconcile `2/9/2/2`. Group-without-member,
  duplicate booking session, group/member/session orphan, slot/learner identity,
  stored Level range, legacy missing/extra/duplicate, and reservation missing/
  extra/mismatch counts are all `0`. Group/member/legacy/reservation rows share
  atomic creation timestamp `2026-07-24T09:44:24.071162Z`.
- Vercel request `d2wlk-1784886263183-64f29b35ccf7`, timestamp
  `2026-07-24T09:44:23.183Z`, is the exact Production-host
  `POST /api/coach/assignment-groups`, status `200`, on deployment
  `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`. Matching activity row
  `468e0e9f-7032-480a-8e17-43c779ae50de`, actor Head Coach เบล, action
  `save_coach_assignment_groups`, records the exact slot, branch, both coach IDs,
  `groupCount=2`, and `studentCount=9` at `2026-07-24T09:44:24.360240Z`.
- Notification delta near the Save was `0`. The two exact coach/date assignment
  messages already existed from earlier assignments and `notifyCoachOnce` deduped
  them; no new notification row was required for the accepted Save.
- Fresh Production function inspection found active
  `save_coach_assignment_groups_v1` definition digest
  `1fb7551cc0236c7c872ada7eebff2f83` with direct write targets only
  `coach_assignment_groups`, `coach_assignment_group_students`, and
  `coach_assignments`. Reservation sync definition digest
  `4b2a30ba581c232b212b759b29da47f9` writes only
  `coach_assignment_exact_reservations`. The API then performs deduped coach
  notification handling and one activity-log insert. There is no Assignment Save
  write target for booking sessions, bookings, payments, wallet, attendance,
  check-in, teaching programs/hours, weekly summaries, or payouts.
- Current post-Save protected fingerprints at `2026-07-24T10:02:09.855132Z` were:
  booking sessions `9` / `fa5867a1254f403cc6adbec3ebaee50e`, bookings `6` /
  `1537f47ebabafcd0c82e205bd429a4a3`, payments `5` /
  `a493511ad8972f3d32f563b5b8d9a10c`, wallet credits `0`, and attendance,
  check-ins, teaching programs/hours, weekly summaries, and payouts each `0`.
  Empty-set digest was `d41d8cd98f00b204e9800998ecf8427e`; protected RPC write targets were `0`.
- The screenshot's 16:00–18:00 learner count change `5 → 4` is independently
  explained. Exact slot `7ffceb27-6ac9-433f-b23a-a43af919f660` currently has
  seven physical sessions: four active verified and three rescheduled. Session
  `cf4c224a-fe4c-4a5b-a24d-bd6a7b3f72fd` for กัสโซ่ changed to `rescheduled`
  at `2026-07-24T09:18:32.437741Z`; activity
  `26ca576d-a53f-45be-8096-b919af161ce6` records
  `reschedule_booking_session` at `09:18:33.109843Z` to new session
  `ecfc5aea-0274-4550-818b-6c79507c670c`, 2026-07-31 10:00–12:00 รามอินทรา.
  This occurred about 26 minutes before the 09:44 Assignment Save. The Coach
  client calls `router.refresh()` after successful Save, so the post-Save image
  exposed the already-current active count; the Assignment Save did not cause the
  booking-session change. Later 16:00-slot assignment activity at 09:53Z is also
  after, not the cause of, the screenshot's earlier count change.
- Cached pinned Vercel CLI `56.5.0` remained authenticated as `aachanin1`.
  Deployment `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9` remained target `production`,
  `READY`, Current by exact four-alias mapping, Git SHA
  `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, and Function region `icn1`.
  All four established Production aliases remained on that deployment; this gate
  issued no deploy, rebuild, Promotion, rollback, alias, application mutation, or
  SQL DML command.
- The earlier four deployment-wide booking availability/preview POSTs remain
  historical attribution evidence only. They were outside the attributable Coach
  burst, their Source is SELECT-only, and Owner accepted the later exact live Save
  plus this reconciliation as sufficient business UAT evidence.
- Final state: Production UAT **Passed — Owner post-promotion live Save**;
  Authoritative Save behavior **Passed**; Controlled Write UAT **Passed**;
  Production Data Changed **Yes — expected Owner normal Assignment Save; `0` from
  this read-only reconciliation/documentation gate**; Data Repaired **Yes — prior
  exact two-name repair only, no new repair**; Financial Impact **None detected**;
  Blocker **None**; Task Done **Yes**. Active Task is **NONE**. Next Action:
  **Await Owner selection; do not start another task automatically.**

The original Source/Local, publish, and staged Deploy evidence below is retained as
historical evidence. Its automatic `กลุ่มผสม`/Level-derived naming policy is
superseded and must not be treated as current.

#### Authorization and root cause

- Owner confirmed that Coach/Head Coach may intentionally place learners from
  different Level categories in the same group. Mixed categories, wide Level
  gaps, assessed plus unassessed learners, and incomplete Level definitions are
  warning-only for Coach assignment Save. `จัดตาม Level` remains optional.
- Starting HEAD `eb2f2a998b84d73056a9f66df8fc2fa10907b8e9` did not contain prior
  corrective commit `9ef1ee30035a083426743aed3e326ad9676d65c4` as an ancestor. The
  current Coach client and Coach API both called the shared blocking naming
  resolver; generic `กลุ่ม N` therefore produced `mixed_level_categories` and
  blocked Save before or at the API.
- The prior commit was inspected read-only and was not cherry-picked because its
  shared-default change would also affect Admin Makeup and its lineage predates
  later Phase B/Production configuration.

#### Forward fix and isolation

- Added an explicit Coach-only naming resolver while preserving the shared
  resolver's default behavior. Manual names are trimmed and preserved, a trailing
  dynamic `(N คน)` suffix is removed, same-category generic names still derive
  from the active Level definition, and generic mixed/incomplete groups use the
  deterministic non-blocking name `กลุ่มผสม` with actual member `levelMin/levelMax`.
- Coach UI keeps wide/mixed/incomplete Level warnings visible without disabling
  Save or showing the blocking mixed-category error. After a successful Save it
  reconciles the canonical saved name and Level range before refresh.
- Coach API applies the same policy server-side. Existing authorization, atomic
  RPC, exact coach/member/legacy/reservation semantics, duplicate-coach rejection,
  and exact overlap conflict behavior remain unchanged.
- `src/app/api/admin/makeup/route.ts` has no diff and does not opt into the
  Coach-only resolver. `vercel.json`, Admin Schedules runtime Source, migrations,
  and permanent `regions: ["icn1"]` remain unchanged.

#### Local evidence

- `npm run test:admin-schedule-assignment`: `31/31` passed, including Coach mixed,
  assessed/unassessed, incomplete-definition, manual/legacy Thai name, suffix,
  same-category auto-name, range, and shared-default isolation checks.
- `npm run test:admin-schedule-assignment:e2e`: `6/6` passed against Local Supabase
  `http://127.0.0.1:54321`. Head Coach generic mixed Save returned `200`, persisted
  `กลุ่มผสม`, manual rename/refetch remained exact, duplicate and overlapping
  Coach rules remained blocked, groups/members/legacy/reservations were complete,
  desktop/mobile `390x844` passed, browser console/page errors were `0`, and
  disposable fixture residue was `0`.
- `npm run test:coach-assignment-conflicts`: `21/21`, residue `0`;
  `npm run test:admin-schedules-performance`: `24/24`;
  `npm run test:lesson-wallet-regression`: `17/17`.
- TypeScript, ESLint, mojibake, `git diff --check`, and Next.js 16.2.6 Production
  build passed; build generated `91/91` static pages. The required post-build
  `.next` cleanup/local restart was not run because execution policy blocked the
  recursive generated-folder removal; this is a cleanup limitation, not a build
  failure.
- Existing dirty `AGENTS.md` and `src/lib/schedule-slot-utils.ts` checksums remained
  unchanged. Staged and untracked sets remained empty; Local fixture writes only,
  with no Production access or data write.

#### Current classification

- Source Complete: **Yes — Coach flow only**. Tests Passed: **Yes — Local only**.
- Owner approved the exact Commit + non-force Push gate on 2026-07-24. Source/Test
  commit `8aea07aaa06cf82cf3ece7bf421e8211ef421c9e`, tree
  `78ab18f2a92d4e1c81d053c728d08da87bf048c6`, and the documentation closeout
  commit containing this matrix were pushed to
  `origin/spike/next-major-security-upgrade` and remote-verified at `0/0`.
- Committed/Pushed: **Yes**. Deployed: **Yes — staged Production-target artifact
  only**. Promoted/Production-active for this fix: **No**. Production UAT,
  Controlled Write UAT, data repair, and Production data change: **No**.
- Current permanent `icn1` Production deployment and Phase B behavior were not
  touched. Financial impact: **None**. Task Done: **No**.
- Next Action: **Owner review before a separate Read-only staged-deployment UAT
  gate; promotion remains separately prohibited**.

#### Commit + Push closeout evidence

- Starting branch/HEAD/upstream were exactly
  `spike/next-major-security-upgrade` / `eb2f2a998b84d73056a9f66df8fc2fa10907b8e9` /
  `origin/spike/next-major-security-upgrade`; remote HEAD matched and Ahead/Behind
  was `0/0`. Prior `9ef1ee30035a083426743aed3e326ad9676d65c4` was not an
  ancestor and was not cherry-picked.
- Gate 0 found no staged or untracked files. The only task files were the five
  Source/Test files and three context documents authorized for this gate. Admin
  Makeup, Admin Schedules runtime Source, `vercel.json`, and migrations had no task
  diff.
- Fresh verification passed: `npm.cmd run test:admin-schedule-assignment`
  (`31/31`), `npm.cmd run test:coach-assignment-conflicts` (`21/21`, residue `0`),
  `npm.cmd run test:admin-schedules-performance` (`24/24`),
  `npm.cmd run test:lesson-wallet-regression` (`17/17`),
  `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run check:mojibake`
  (`247` files), and `git diff --check`.
- Playwright E2E `6/6` and Production build `91/91` were not rerun; they remain
  prior exact-worktree Source/Local-gate evidence. Post-build `.next` cleanup and
  clean restart were not rerun.
- Pre-existing unrelated dirty `AGENTS.md` and
  `src/lib/schedule-slot-utils.ts` remained excluded, unstaged, and checksum-exact:
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Source Complete: **Yes — Coach flow only**. Tests Passed: **Yes — Local only**.
  Committed: **Yes**. Pushed: **Yes**. Deployed: **No**. Feature Enabled and
  Allowlisted: **No change**. Production Active: **No for this new fix**.
  Production UAT: **No**. Controlled Write UAT: **No**. Data Repaired: **No**.
  Production Data Changed: **No**. Customer Impact: **Production issue remains
  until a separately approved deploy/release**. Financial Impact: **None**. Task
  Done: **No**. Active Task: **Coach Assignment Mixed-Level Save Regression**.
  Next Action at that publish closeout: **Owner review before a separate Deploy
  gate**; this was superseded by the staged Deploy gate below.

#### Staged Production-target Deploy gate

State observed at this 2026-07-24 staged-deployment closeout:

- Owner approved exactly one Production-target staged deployment from exact HEAD
  `af9e7e6e71100eb0eada69164a7ab692523771f4`, tree
  `805c2c007a3f74f6eb19c08cda6ee86b831fc492`, using Production build environment
  and mandatory `--skip-domain`. Promotion, alias/domain mutation, route/browser/
  API/database UAT, Production write, migration, environment, feature-control,
  allowlist, Source/Test/config change, commit, and push remained prohibited.
- Fresh Git Gate 0 matched branch `spike/next-major-security-upgrade`, local and
  upstream HEAD `af9e7e6e71100eb0eada69164a7ab692523771f4`, tree
  `805c2c007a3f74f6eb19c08cda6ee86b831fc492`, and Ahead/Behind `0/0`. Staged and
  untracked sets were empty; only the two checksum-exact excluded dirty files were
  present. `vercel.json` retained `regions: ["icn1"]`; package/config/migration
  diff was empty; `git diff --check` passed.
- Pinned cached Vercel CLI `56.5.0` was already authenticated/configured and its
  help explicitly confirmed `--skip-domain` disables automatic promotion/
  aliasing. Gate 0 verified all four established Production aliases on existing
  `production` / `READY` deployment
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`. The separate push-created automatic branch
  deployment `dpl_FYKfaL4gXuJjuaiCinpctdfcatvC` was `preview` / `READY` and was
  not treated as this authorized deployment.
- A clean detached worktree under
  `C:\Users\aacha\AppData\Local\Temp\codex-nasc-coach-mixed-deploy-20260724`
  matched the exact approved HEAD/tree. Only `.vercel/project.json` linkage for
  project `prj_v034HOI6AjaMpBezWvuvT0W24pTp` and organization
  `team_gw8Y6CPd602WAKRsVFobPGCL` was copied. No token, `.env`, session, `.next`,
  `node_modules`, build output, or dirty excluded file was copied.
- Exactly one command was issued from that worktree:
  `vercel deploy --prod --skip-domain --yes --scope team_gw8Y6CPd602WAKRsVFobPGCL --no-color`.
  Exit code was `0`; no force or retry was used. Exactly one new deployment was
  observed after the pre-gate timestamp.
- Deployment `dpl_vsnYY1QWBybnR3rF51DsqamnQLg7` reached `READY` with
  `readySubstate=STAGED`, target `production`, unique URL
  `https://new-athlete-badminton-school-ajsdtbpvm-aachanin1s-projects.vercel.app`,
  and build duration `83.232 s` from Vercel `buildingAt` to `ready`. Build region
  was `cle1`, deployment metadata region `sfo1`, configured/Deployment region was
  `icn1`, and the Coach assignment Function was `icn1`. Framework/runtime were
  Next.js `16.2.6`, Node.js `24.x` / `nodejs24.x`; the remote build generated
  `91/91` static pages.
- Vercel metadata supplied exact `gitCommitSha`
  `af9e7e6e71100eb0eada69164a7ab692523771f4`, ref `HEAD`, source `cli`, and actor
  `codex`. Exactness is additionally proven by the clean detached-worktree
  HEAD/tree and the single deployment input. Functional Source/Test commit remains
  `8aea07aaa06cf82cf3ece7bf421e8211ef421c9e`.
- The new deployment had attached custom/Production alias count `0`,
  `autoAssignCustomDomains=false`, and remained `STAGED`. Vercel metadata listed
  two automatic-alias candidates, but read-only resolution proved neither moved:
  all four established Production aliases remained on
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H` before and after. The new deployment was not
  Current/Promoted and received no traffic through those aliases.
- No application URL or route was visited. `/`, `/api/health`, static assets,
  Coach routes, APIs, browser/authenticated UAT, and Production database access
  were not exercised. Promotion, rollback, alias mutation, environment,
  feature-control, allowlist, migration, Production data write, and Controlled
  Write were not performed.
- The exact temporary worktree and task-specific parent were safely removed after
  evidence capture. Main branch/HEAD/tree/upstream remained unchanged. The two
  unrelated dirty files remained unstaged and checksum-exact:
  `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Source Complete: **Yes — Coach flow only**. Tests Passed: **Yes — Local only**.
  Committed: **Yes**. Pushed: **Yes**. Deployed: **Yes — staged
  Production-target artifact only**. Promoted: **No**. Feature Enabled,
  Allowlisted, Environment, and Migration: **No change**. Production Active:
  **No**. Production UAT: **No**. Controlled Write UAT: **No**. Data Repaired:
  **No**. Production Data Changed: **No**. Customer Impact: **No direct Production
  change; existing issue remains**. Financial Impact: **None**. Task Done: **No**.
  Active Task: **Coach Assignment Mixed-Level Save Regression**. Next Action:
  **Owner review before a separate Read-only staged-deployment UAT gate; promotion
  remains separately prohibited**.

### 2026-07-23 — Admin Schedules Phase B Final Production Closeout

Status: **PASS — EXACT `icn1` ARTIFACT PRODUCTION-ACTIVE; PROTECTION-AWARE SMOKE
AND READ-ONLY PRODUCTION UAT PASSED; PHASE B DONE**.

#### Authorization and state observed at this closeout

- Owner authorized exact-artifact promotion, corrected protection-aware
  re-promotion after a conservative false-positive rollback, read-only Production
  UAT, the Performance Evidence Exception, and this documentation-only final
  closeout. This record does not authorize or perform Source/Test/config/migration
  changes, another deploy/promotion/rollback, alias changes, or Production writes.
- Exact deployment `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H` is `READY` in `icn1`.
  Fresh read-only inspection found all four established Production aliases mapped
  to that deployment and public health `200` with `icn1` Function routing evidence.

#### Promotion, rollback, and corrected smoke timeline

1. The exact permanent-config artifact was promoted without a rebuild.
2. Smoke automation observed `302` on protected project aliases and triggered a
   conservative rollback.
3. Review proved the `302` responses were expected Vercel Deployment Protection,
   not an application failure; correlated application 5xx/runtime errors and UAT
   business writes were `0`.
4. Owner authorized corrected deployment-protection-aware re-promotion.
5. The same exact artifact was re-promoted without a rebuild.
6. Corrected smoke and authenticated read-only Production UAT passed.
7. State observed at this closeout: rollback is not required and permanent
   `icn1` remains Production-active.

#### Production UAT and performance evidence

- Super Admin and Standard Admin passed monthly summary, month/day/Search flows,
  permission/filter behavior, stale-response protection, and desktop/mobile
  read-only checks. Verified mobile viewport was `390x844`. Relevant application
  5xx/runtime/console/hydration errors and UAT business mutations were `0`.
- After two warm-ups, five monthly observations per role produced Super Admin
  outer/server P95 `1.540/0.860 s` and Standard Admin outer/server P95
  `2.450/1.523 s`. Outer samples above `5 s` and Server samples above `3 s` were
  `0/5` for both roles.
- Owner accepted that page-internal timing was unavailable and live forced
  error/retry was not run. Prior Local error/loading/empty/stale evidence passed,
  the retry handler is present, and live retry interaction remains **Unknown / not
  explicitly proven**. The bounded outer observations are not relabeled as
  page-internal measurements.

#### Final matrix and next action

- State observed at this closeout: Source Complete **Yes — Phase B**; Tests Passed
  **Yes — prior Local evidence**; Committed/Pushed **Yes**; Deployed **Yes**;
  Permanent `icn1` Production Active **Yes**; Production UAT **Passed with
  Owner-accepted limitations**; Controlled Write UAT **No / not applicable**; Data
  Repaired **No / not applicable**; Production Data Changed by UAT/this gate
  **No**; Customer Impact **`icn1` performance remediation active**; Financial
  Impact **None**; Documentation Drift **No after this documentation push**; Task
  Done **Yes — Phase B**; Active Task **NONE**.
- Detailed final evidence:
  `docs/performance/admin-schedules-phase-b-final-production-closeout-2026-07-23.md`.
- Exact next action: await Owner selection; do not start another task
  automatically.

### 2026-07-22 — Admin Schedules Region Experiment and Permanent `icn1` Closeout

Status: **PASS — REGION EXPERIMENT PERFORMANCE GATE; PERMANENT `icn1`
CONFIGURATION COMMITTED AND PUSHED; DOCUMENTATION CLOSEOUT COMMITTED AND PUSHED;
NO PROMOTION**.

#### Authorization and state observed at this closeout

- Owner separately approved the Function-region-only unpromoted experiment,
  authenticated read-only measurement continuation, permanent repository region
  configuration plus Local validation, configuration commit/push, and this
  documentation-only closeout commit/push.
- Control `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` ran in `iad1`; Treatment
  `dpl_DvJ2gVNSqmqUCcdgcoiPTwJVSYh2` ran in `icn1`. Both were `READY`, Production-
  target, unpromoted, and had zero custom/Production aliases. The four established
  Production aliases remained on `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`.
- Both deployments used the same Admin Schedules business Source; functional
  remediation identity was `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`.
  Authentication was the only POST exception, with credentials/MFA entered by the
  Owner. No credential, session value, raw Search term, or PII was retained.

#### Region Experiment result

- Paired July monthly A/B completed `20/20` valid samples per environment after two
  excluded warm-ups per deployment. Control Browser/Server/residual P95 was
  `6.570/3.7189/2.8511 s`; Treatment was `2.640/1.5824/1.5243 s`.
- Treatment Browser P50/P95 was `2.203/2.640 s`, passing the `3.000/5.000 s`
  normal/P95 budgets. Server P95 improved approximately `57.46%`, Browser P95
  `59.82%`, and residual P95 approximately `46.55%`. Control cache hit/miss was
  `19/1`; Treatment was `10/10`, and both observed the same `1,440/586/54`
  sessions/groups/wallet counts.
- Three month-navigation cycles passed. Low-volume August Browser/Server/residual
  ranges were `0.735–0.802/0.133–0.147/0.602–0.655 s`. Selected-day combined
  P50/P95/max was `1.058/1.436/1.436 s`, with `0/15` samples over `3 s`.
- Corrected Search produced `21/21` GET `200` across Q1–Q7, with combined client
  min/P50/P95/max `1.726/1.979/2.614/3.150 s` including the fixed `0.300 s`
  debounce. All round-key counts remained `<=200`; rapid latest-query and filter
  persistence checks passed. Raw terms and PII are not recorded.
- Verified mobile `390x844`, monthly/selected-day/Search functional smoke, rapid
  stale-response protection, truncation warning, and no-overflow checks passed.
  Console/hydration/runtime errors were `0`. Standard Admin was not run because it
  was outside the continuation authorization.
- Available corrected-Search telemetry contained 21 Search-path GET `200` events;
  business POST/PUT/PATCH/DELETE, 4xx/5xx, warning/error/fatal, and PII/search-term
  marker findings were all `0`.

#### Permanent configuration and Local validation

- `vercel.json` received the only approved configuration change:
  `"regions": ["icn1"]`. JSON parse/exact assertion, Admin Schedules `24/24`,
  assignment `24/24`, Lesson Wallet `17/17`, TypeScript, ESLint with zero warnings,
  mojibake (`245` files), Production build (`91/91` pages), and diff check passed on
  the exact configuration worktree.
- Configuration commit `77db099607dd7ee8dfe265929a6720818e2015d1` was pushed
  non-force to `origin/spike/next-major-security-upgrade`. This documentation
  closeout is the subsequent commit containing this record and was also pushed
  non-force.
- Local build validation does not prove the deployed Function region. No deployment
  was created from the permanent configuration, so it is not Production-active.
  The Treatment result strongly supports regional alignment as a major Server
  improvement but does not guarantee every future deployment; Browser/RSC residual
  remains material and requires Canary remeasurement.

#### Closeout state and next action

- State observed at this closeout: Source Complete **Yes — permanent `icn1`
  configuration**; Tests Passed **Yes — Local**; Committed/Pushed **Yes —
  configuration plus documentation only**; Deployed **No new deployment**; Existing
  Region Canary **READY/unpromoted**; Permanent `icn1` Production Active **No**;
  Production UAT **No**; Controlled Write UAT **No / not applicable**; Data
  Repaired/Production Data Changed **No/No**; Customer Impact **No direct Production
  change**; Financial Impact **None**; Documentation Drift **No after this
  documentation push**; Task Done **No**; Active Task **Admin Schedules
  Performance**.
- Detailed evidence:
  `docs/performance/admin-schedules-phase-b-region-experiment-permanent-icn1-2026-07-22.md`.
- Exact next action: Owner approval required for **Permanent `icn1` Config Canary
  Deploy + Full Read-only UAT Gate; no Promotion**. This closeout does not authorize
  deployment, Production UAT, promotion, or another Parking Lot task.

### 2026-07-22 — Admin Schedules Phase B Closure Gate B1 Bottleneck Diagnosis

Status: **PASS — PHASE B CLOSURE BOTTLENECK DIAGNOSED; NO CHANGES MADE;
DOCUMENTATION-ONLY CLOSEOUT COMMITTED AND PUSHED**.

#### Authorization and state observed at this closeout

- Owner approved final read-only B1 diagnosis using existing remediation Canary
  `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF`, followed by this documentation-only closeout
  commit and non-force branch push. B1 did not authorize or perform Source/Test/
  configuration/migration change, deploy/redeploy, promotion, alias movement,
  Production UAT/write, data repair, region change, or performance exception.
- Canary remained `READY`, Production-target, unpromoted, with zero custom/
  Production aliases. The four established Production aliases remained on
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` before and after B1. Functional remediation
  Source remains `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`.
- Documentation-only work was based on branch
  `spike/next-major-security-upgrade` starting at
  `07a8bdf3368ed1b37c316a218c1e7321c93cde89`, with actual remote equal and
  ahead/behind `0/0`. Pre-existing dirty `AGENTS.md` and
  `src/lib/schedule-slot-utils.ts` were preserved and excluded.

#### B1 measurement result

- Twenty warm July monthly samples used the intended four-call path in `18/20`;
  two branch-reference cache misses used five calls. Browser
  min/P50/P90/P95/max was `3.926/4.905/6.329/6.574/7.577 s`; Server P95 was
  `4.171 s`; Browser-residual P95 was `3.406 s`. The normal `3 s` and P95 `5 s`
  budgets failed.
- Three complete adjacent-month cycles showed low-volume August Server duration
  `0.359–0.752 s` while Browser total remained `4.600–5.029 s`. Selected-day
  combined P50/P95/max was `2.827/3.874/3.874 s`. Search client total
  P50/P95/max was `5.795/7.868/7.930 s`, including the fixed `0.300 s` debounce;
  post-debounce P50/P95/max was `5.495/7.568/7.630 s`.
- Search learner/parent/Coach/branch/course/status/Thai-one-character behavior,
  branch/course-filter retention, bounded round-key response, PII-free response
  contract, and rapid latest-query protection passed. Raw Search terms and PII
  are not recorded. Rapid day-change stale-response protection passed.
- Standard Admin is **Unknown / Need verification** because no existing session was
  available. Mobile `390x844` is **Unknown / Need verification** because browser
  control did not establish the requested document viewport reliably. No account,
  credential, permission, session, or Production data was created or changed.

#### Evidence and ranked diagnosis

- The bounded deployment window contained 899 GET and business
  POST/PUT/PATCH/DELETE `0/0/0/0`; HTTP 5xx and warning/error/fatal were all `0`.
  Vercel functions were in `iad1`. A 12-hour all-environment/deployment aggregate,
  not Canary-only, showed Active CPU P75 `210 ms` and 2.7K outbound Supabase calls
  averaging `620 ms` with errors `0%`.
- Supabase remained `ACTIVE_HEALTHY` in `ap-northeast-2`. Connection, timeout,
  deadlock, exhaustion, and lock-pressure evidence was clean. Bounded read-only
  plans completed in `0.817–31.341 ms` with shared-buffer hits and no disk/temp
  spill. `pg_stat_statements` was read without reset.
- **Proven:** call reduction works; bounded SQL is milliseconds; Active CPU is low
  relative to duration; Server duration and Browser residual both contribute;
  low-volume August retains a high Browser residual; Canary/aliases/data did not
  change.
- **Strongly Supported:** the primary Server contribution is Vercel-to-Supabase
  Data API/network wait, multiplied by remaining request waves. Browser/RSC
  residual is a separate material bottleneck.
- **Inferred:** cross-region `iad1 → ap-northeast-2` is the leading explanation for
  much of the wait, with PostgREST/RLS/JSON materialization and remaining dependent
  phases contributing. The exact residual breakdown remains uninstrumented.
- **Unknown / Need verification:** the result of a same-artifact regional A/B,
  Canary-only outbound spans, detailed PostgREST phases, selected-day/Search
  per-sample server phases, Standard Admin overhead, reliable mobile behavior, and
  the internal composition of Browser/RSC residual.

#### Decision and closeout state

- The single recommended next technical path is a separately Owner-approved
  **Infrastructure Region Experiment Gate** using the same business Source on an
  unpromoted Canary, changing only Function region, retaining a rollback plan, and
  repeating the bounded measurements without promotion. This is an experiment,
  not a proven or guaranteed fix. Browser/RSC residual may still keep the overall
  budget failing even if Server latency improves.
- Detailed methodology, raw monthly/day/Search samples, Vercel/Supabase evidence,
  limitations, root-cause classification, recommendation, and fallback are in
  `docs/performance/admin-schedules-phase-b-closure-b1-bottleneck-diagnosis-2026-07-22.md`.
- State observed at this closeout: Source Complete **Yes — prior remediation**;
  Tests Passed **Yes — prior local evidence only**; B1 Diagnosis **Complete**;
  Committed/Pushed **Yes — documentation only**; Deployed **No new deployment**;
  Performance Gate **Failed**; Production Active/UAT **No/No**; Controlled Write
  UAT **No / not applicable**; Data Repaired/Production Data Changed **No/No**;
  Customer Impact **No direct Production change**; Financial Impact **None**;
  Documentation Drift **No after this successful documentation-only push**; Task
  Done **No**; Active Task **Admin Schedules Performance**.
- Exact next action: Owner/PM decides whether to authorize the separately scoped
  Infrastructure Region Experiment Gate. It is not authorized by this closeout
  and must not start automatically.

### 2026-07-21 — Admin Schedules Remediation Canary Performance Gate Failed

Status: **STOP — CANARY PERFORMANCE GATE FAILED; NOT PROMOTED**.

#### Authorization and exact deployment identity

- State observed at this closeout: Owner approved a Production-target unpromoted
  remediation Canary plus bounded authenticated read-only performance UAT from
  branch `spike/next-major-security-upgrade` at exact input commit
  `67a08fa5a11ee714d8ec23be3fb125732e255b54`. Functional Source was
  `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`.
- Deployment `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` at
  `https://new-athlete-badminton-school-hm0ntpqx2-aachanin1s-projects.vercel.app`
  became `READY` on target `production`. Its exact tree was
  `ad1a35b38d19bd1b203bb8d644946ea73db3c466`.
- Vercel `gitCommitSha` metadata was `null`. Exactness was therefore established
  from the clean detached worktree and deploy input identity, not from Vercel Git
  metadata. Build duration was `81.021 s`; build region was `cle1`, function region
  `iad1`, deployment metadata region `sfo1`, runtime Node.js `24.x`, and framework
  Next.js `16.2.6`.
- Custom/Production alias count on the Canary was `0`. Automatic deployment aliases
  were not treated as promotion. The four established Production aliases remained
  on `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` before and after deployment/UAT. Promotion
  and rollback were **No**.

#### Infrastructure and partial functional UAT

- Infrastructure smoke passed: `/` returned `200` (`80,237` bytes, `0.235 s`),
  `/api/health` returned `200` with status `ok` (`1,782` bytes), one generated
  `_next/static/*` asset returned `200` (`529` bytes, `0.138 s`), and anonymous
  `/admin/schedules` returned the expected `307` auth redirect. No build/runtime
  5xx was observed.
- Existing Super Admin authentication worked. Monthly-summary-first, no day detail
  before selection, desktop layout without horizontal overflow, and console
  warning/error count `0` passed before the mandatory performance stop. July summary
  metrics reported sessions `1,439`, groups `586`, and wallet rows `54`.
- Month-change, selected-day, Search, mobile `390x844`, and Standard Admin checks
  were intentionally **not run**. The gate required an immediate stop after the
  warm-navigation P95 budget failed.

#### Raw performance evidence

- Initial untimed navigation used five calls and reported summary server duration
  `3.3282 s`.
- The bounded cold/reference-cache-miss sample was browser `5.889 s`, summary
  server `3.0914 s`, and five calls: two session pages + one date-scoped group page
  + one wallet call + one branch-reference miss.
- Ten warm samples, in test order:

| Sample | Browser total | Summary server | External calls |
| ---: | ---: | ---: | ---: |
| 1 | `4.365 s` | `2.5529 s` | 4 |
| 2 | `4.145 s` | `2.5762 s` | 4 |
| 3 | `3.989 s` | `2.2107 s` | 4 |
| 4 | `3.910 s` | `2.1769 s` | 4 |
| 5 | `7.907 s` | `4.3137 s` | 4 |
| 6 | `4.125 s` | `2.6932 s` | 4 |
| 7 | `5.664 s` | `3.1271 s` | 5 |
| 8 | `5.228 s` | `2.9898 s` | 4 |
| 9 | `3.969 s` | `2.1832 s` | 4 |
| 10 | `5.130 s` | `2.5651 s` | 4 |

- Nearest-rank P95 for `n=10` selects rank `ceil(0.95 * 10) = 10` after sorting,
  yielding `7.907 s`. This exceeds the mandatory `5.000 s` budget.
- Nine of ten warm samples used the intended formula `2 session pages + 1
  date-scoped group page + 1 wallet call + 0 cached branch call = 4`. Sample 7 was
  the branch-cache miss and used five calls. The worst browser and server sample was
  sample 5 on the normal four-call path.

#### No-write, logs, and repository safety

- The bounded deployment-scoped Vercel window contained `500` events, all `GET`.
  Schedule requests were `30`; schedule/business `POST/PUT/PATCH/DELETE` were
  `0/0/0/0`; 5xx/fatal/error/warn were `0/0/0/0`; email/phone/JWT/search-term
  marker matches were `0`. No business-data write occurred.
- This Canary gate did not run direct Supabase SQL or collect direct RTT/comparison
  telemetry. The previously verified Supabase region remains `ap-northeast-2`.
- The main worktree stayed on exact HEAD/upstream
  `67a08fa5a11ee714d8ec23be3fb125732e255b54`, ahead/behind `0/0`, with staged state
  empty. The detached deployment worktree remained clean. Pre-existing dirty
  `AGENTS.md` and `src/lib/schedule-slot-utils.ts` retained SHA-256
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Source, Test, documentation, migration, environment, feature control, allowlist,
  Production data, and financial data changed by the Canary gate: **No**. This later
  closeout changes documentation only.

#### Proven findings

1. The Source remediation changed the normal warm summary from the prior eight-call
   shape to the designed four-call shape in `9/10` samples.
2. The remediation Canary still failed the warm-navigation performance gate at
   P95 `7.907 s`.
3. The worst latency occurred on the four-call path. A branch-cache miss does not
   explain that worst sample.
4. The Canary remained unpromoted; Production aliases and business data did not
   change.

#### Observed, not proven causal

- Functions ran in `iad1`; the previously verified Supabase region is
  `ap-northeast-2`. Residual region/network/runtime cost may contribute, but this
  gate collected no direct RTT or controlled regional comparison and does not claim
  the region difference as a proven root cause.

#### State observed at this closeout

| Field | Result |
| --- | --- |
| Active Task | Admin Schedules Performance |
| Source Complete | Yes — remediation committed/pushed |
| Local Tests | Passed — prior evidence |
| New Canary | `READY`, Production-target, unpromoted |
| Performance Gate | Failed — warm P95 `7.907 s` > `5.000 s` |
| Production Active | No |
| Production UAT Passed | No |
| Production Data Changed | No |
| Customer Impact | No direct Production change |
| Financial Impact | None |
| Task Done | No |
| Next Action | Owner/PM selects Source Fix, Database, Infrastructure, or explicit performance-exception scope; no option is authorized automatically |

Read-only Infrastructure Diagnosis may be considered as one recommendation, but it
is **OWNER APPROVAL REQUIRED — NOT AUTHORIZED TO START**. No Source, Database,
Infrastructure, performance-exception, promotion, or Production UAT gate starts
automatically.

### 2026-07-21 - Admin Schedules Phase B Canary Remediation Publish

Status: **PASS — COMMITTED AND PUSHED; NOT DEPLOYED**.

- State observed at this publish closeout: Owner approved the scoped Source/Test
  and documentation Commit + Push gate on existing branch
  `spike/next-major-security-upgrade`. Starting HEAD and actual remote were
  `358040d25c37398811f05611b53fc6a5f4ec099c`, staged state was empty, and
  ahead/behind was `0/0`.
- Source/Test commit `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`
  (`perf(admin-schedules): reduce canary read fan-out`) contains only the five
  approved remediation Source/Test files. This documentation closeout is the
  separate scoped documentation commit. Both are pushed non-force to the existing
  branch; no PR was created.
- Mandatory publish-gate verification passed on the exact Source worktree:
  remediation `24/24`, assignment `24/24`, Lesson Wallet `17/17`, TypeScript,
  ESLint, mojibake `243`, diff check, local Production build, and disposable
  browser E2E `5/5` with fixture residue `0`. Docker Engine was available and all
  Supabase URLs used by the E2E environment were `127.0.0.1` only.
- The publish-gate E2E measured cold `1985.5 ms`; warm samples
  `1074.4/1060.8/1226.0/1170.4/1117.0 ms` with P95 `1226.0 ms`; month change
  `273.5 ms`; summary server `136.5 ms` with four calls; cold day server
  `40.4 ms` with seven calls; learner/Coach/status Search server
  `105.9/124.3/152.0 ms` with `6/7/8` bounded calls. Local evidence is not a
  Production P95 claim.
- Owner explicitly accepted skipping repeat `.next` cleanup/clean-restart for the
  exact verified worktree. `.next` was not deleted or touched by this gate, the
  repeat smoke was not run, and this record does not claim otherwise.
- Pre-existing dirty `AGENTS.md` and `src/lib/schedule-slot-utils.ts` retained
  SHA-256 `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`
  and `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`;
  neither was edited, staged, or committed by this gate. Migration/RPC/index,
  environment/feature/allowlist, deploy, new Canary, promotion, Production
  access/UAT/write, data repair, and customer/financial change were all **No**.
- Prior Canary remained unpromoted according to the latest authorized evidence.
  Production Active **No**; Production UAT/P95 **Unknown / Need verification**;
  Task Done **No**. Next action is Owner/PM review before a separately authorized
  Canary Deploy + Performance UAT gate.

### 2026-07-21 - Admin Schedules Phase B Canary Source Remediation + Local Test

Status: **PASS — SOURCE ONLY; PASS — LOCAL TEST ONLY; UNCOMMITTED AND
UNPUSHED**.

- Owner authorized Source-only performance remediation and Local Test after the
  unpromoted Canary failed its performance gate. Starting/final Git HEAD remained
  `358040d25c37398811f05611b53fc6a5f4ec099c` on
  `spike/next-major-security-upgrade`; no commit, push, deploy, promotion,
  Production access/write, environment/feature/allowlist, Infrastructure, or
  database schema change occurred.
- Summary assignment groups now use an explicitly paginated
  `schedule_slots!inner(date)` read. The deterministic July-equivalent shape of
  1,437 sessions, 439 unique slots, 54 wallet IDs, and 576 groups changed from
  `2 + 1 + 5 = 8` warm calls to `2 + 1 + 1 = 4`; group calls no longer scale by
  100-slot chunks.
- Selected-day derives non-rescheduled/non-walleted slot-session attendance scope
  from the exact verified day sessions already loaded. The duplicate
  `booking_sessions` read is removed; warm local samples used 5–6 calls and the
  cold Level-reference path used 7 while exact child/adult Attendance, Wallet,
  Coach assignment, Level, and Teaching Program semantics remained unchanged.
- Search is authenticated, month-bounded, candidate-first, deterministic, and
  capped before detail reads. Fixed-column `ilike` queries escape literal `%`,
  `_`, and backslash without raw filter grammar; enum course names are resolved
  through a small reference read then matched by course ID. Thai one-character,
  NFC, parent, Coach, branch, course, status, filter, month-isolation, ordering,
  200-round truncation, stale/cancel, and PII-free response/log behavior passed.
- Final local checks passed: remediation `24/24`, assignment `24/24`, Lesson
  Wallet `17/17`, TypeScript, ESLint, mojibake `243`, diff check, local Production
  build, and disposable browser E2E `5/5` with fixture residue `0`. The
  high-cardinality local fixture had 250 July sessions and 207 groups; summary
  still used one group page and four total calls.
- Final local performance: cold `2359.8 ms`; five warm samples
  `2178.1/2311.7/2470.2/2745.9/2273.6 ms`, P95 `2745.9 ms`; month change
  `433.4 ms`; selected-day low/medium/high client `153.5/100.6/121.6 ms` with
  server `29.0/24.8/24.0 ms`; learner/Coach/status Search client
  `614.3/204.8/198.1 ms` with server `80.2/84.6/85.6 ms`. Document body was
  `222,466` bytes and transferred bytes `3,252,965` under the deliberately larger
  local fixture. Local latency does not prove Production P95.
- After the build, execution policy rejected the exact-path `.next` cleanup
  command before execution. No bypass was attempted; repeat clean restart/static
  smoke is not claimed. Normal final-worktree E2E still passed after the build.
- Production Active **No**; Production UAT **No**; Production P95 **Unknown / Need
  verification**; Production Data Changed **No**; Customer Impact **No direct
  Production change**; Financial Impact **None**; Task Done **No**. Next action is
  Owner/PM review and a separately approved Commit + Push gate.
- Detailed evidence:
  `docs/performance/admin-schedules-phase-b-canary-source-remediation-local-test-2026-07-21.md`.

### 2026-07-21 - Admin Schedules Phase B Canary Performance Diagnosis

Status: **PASS — READ-ONLY PERFORMANCE DIAGNOSIS; CANARY NOT PROMOTED**.

- State observed at this closeout: Production-target Canary
  `dpl_5x2vzwUxAmxNaT8HZGJeBQ32JVr4` was `READY` on exact commit
  `b0bada3d076302d24ebe3b594c03b22bf0997869`; functional Source remains
  `3d32401b13873592d5462e6776b0e847335d2d43`. Super Admin functional Canary
  UAT passed, but the performance gate failed. Warm navigation P95 was `5.344 s`,
  July summary Server duration was `2.766–3.447 s`, selected-day exceeded `3 s`
  in `3/5`, and Search was `4.654–5.937 s`.
- Canary remained unpromoted. All four Production aliases remained on
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`. The audit made no Source, Test,
  migration, index, RPC, environment, feature, allowlist, infrastructure, alias,
  Production business-data, or financial-data change.
- Actual July read-only counts were 1,437 qualifying sessions (two 1,000-row
  pages), 54 walleted session IDs (one 100-ID chunk), and 439 unique schedule-slot
  IDs (five 100-ID chunks). The observed warm summary count is therefore exactly
  `2 + 1 + 5 + 0 cached branch = 8` external calls. Search repeats the same two
  detailed pages, one wallet chunk, and five group chunks on every request.
- Vercel Admin Schedule functions were in `iad1`; Supabase was
  `ap-northeast-2`. Bounded direct SQL plans used the session date index and
  completed in `3.981–27.898 ms` with shared-buffer hits and no disk/temp spill.
  Assignment and Teaching Program Seq Scans were bounded to 1,061 and 422 rows;
  current evidence does not prove that an index is the primary fix.
- `pg_stat_statements` was already available in schema `extensions` and was read
  without reset. Connection evidence showed 25/60 connections, 14 idle
  `ClientRead`, one active, and no idle-in-transaction, timeout, deadlock, or
  connection-limit signal. Deployment-scoped Vercel logs were 100% GET with no
  5xx/fatal.
- Proven primary causes are Data API fan-out/dependent phases, full detailed-month
  Search reads, and fixed selected-day phases. Cross-region RTT, PostgREST/RLS/JSON
  overhead, cold start, and Standard Admin's extra permission round trip remain
  inferred or incompletely measured.
- Detailed evidence and separate Source-only, Database, and Infrastructure options
  are recorded in
  `docs/performance/admin-schedules-phase-b-canary-performance-diagnosis-2026-07-21.md`.
  Database options require a separate Owner-approved Migration/Database Gate;
  infrastructure options require a separate Owner-approved Infrastructure Gate.
- Task Done remained **No**. Production Active **No**; Production UAT **No**;
  Production P95 **not passed**; Production Data Changed **No**; direct customer
  and financial impact **No**. Next action is an explicit Owner choice of Source
  Fix, Database, Infrastructure, or performance-exception scope.

### 2026-07-20 - Admin Schedules Performance Phase B Source + Local Test

Status: **PASS — COMMITTED AND PUSHED; LOCAL TESTS PASSED; NOT DEPLOYED OR
PRODUCTION-VERIFIED**.

- Owner explicitly authorized Phase B Source Fix + Local Test and confirmed the
  authenticated month-wide server-side Search-on-demand contract. Search must keep
  learner, parent, Coach, branch, course, and booking-status behavior within the
  selected month. Commit, push, deploy, migration, Production access/UAT/write,
  environment, feature controls, and allowlists remained prohibited.
- State observed at this closeout: initial `/admin/schedules` is a bounded monthly
  aggregate. Selected-day detail and bounded month-wide Search are separate
  Admin-menu-authorized no-store read routes. The Client cancels and rejects stale
  day/Search responses, and the initial RSC no longer contains full-month learner,
  parent, Coach-name, Level, Program, or Attendance detail.
- Exact learner/Attendance, Wallet, and coach-assignment semantics remain on the
  existing helpers. Request Auth/Profile work is memoized. Only active branches and
  active Level definitions use a 10-minute non-PII reference cache.
- Local results: Phase B `17/17`, assignment-state `24/24`, Lesson Wallet `17/17`,
  disposable browser `5/5` with residue `0`, TypeScript, full ESLint, mojibake
  `241`, build, clean restart/static smoke, and diff check passed. Local cold/warm
  P95/day/Search were `2780.1/1039.9/230.9/463.3 ms`; summary/day/Search boundary
  calls were `4/8/3`; initial RSC/document body was `91,089` bytes and local-dev
  transferred bytes were `3,248,407`.
- Detailed implementation and measurement record:
  `docs/performance/admin-schedules-phase-b-source-local-test-2026-07-20.md`.
- The first 2026-07-21 publish attempt stopped before staging because Docker was
  unavailable. On resume, Docker and repo-local Supabase were verified on
  `127.0.0.1`; E2E passed `5/5`, residue `0`, with no Production connection. Owner
  then waived repeat `.next` cleanup/clean-restart because `.next` is an ignored
  local-generated artifact; the exact worktree had passed that smoke on 2026-07-20.
- Source/Test commit `3d32401b13873592d5462e6776b0e847335d2d43` was pushed
  non-force to `origin/spike/next-major-security-upgrade`; the documentation
  closeout is the commit containing this record. Migration **No**; Deploy **No**;
  Production UAT **No / Unknown**; Production data change **No**; customer and
  financial impact in this gate **No**. Task Done remains **No**. Next gate is
  Owner/PM review and separate Owner authorization for Deploy.

### 2026-07-19 - Admin Schedules Performance Phase A Code Review

Status: **ACTIVE TASK — PHASE A READ-ONLY CODE REVIEW COMPLETE; PHASE B NOT
AUTHORIZED**.

- Owner selected Admin Schedules Performance as the next single Active Task and
  authorized Phase A only. Confirmed decisions are `/admin/schedules` as the
  primary scope, true monthly-summary-first and selected-day detail UX, initial
  normal/P95 budget `3s/5s`, 5–15 minute Cache only for low-volatility reference
  data, separate Coach/User impact measurement, no Region move as the first fix,
  and approval one Phase at a time.
- State observed at this Phase A closeout: Source review confirms that the Client
  hides full-month detail until a day is selected, but the Server still loads all
  monthly wallet, assignment group/member, slot-session, program, Level, and
  attendance detail before render. Serial chunk loops and dependent phases match
  the observed 52–53 external calls and 15–18 second response.
- Recommended Phase B design is a bounded monthly-summary read plus an
  authenticated selected-day detail read. Current month-wide Search depends on
  preloaded learner, parent, and Coach detail; Phase A recommends authenticated
  server-side Search on demand and leaves that contract for Owner confirmation.
- Admin/Super Admin latency is supported by correlated Vercel evidence. Coach
  slowness is Owner-confirmed operational evidence. System-wide User impact remains
  Unknown / Need verification and is not included in the Source-fix scope.
- Detailed report is
  `docs/performance/admin-schedules-phase-a-code-review-2026-07-19.md`.
- Phase A changed no functional Source, Test Source, Migration Source, deployment,
  environment, feature control, allowlist, Production data, customer behavior, or
  financial data. Documentation changes are uncommitted and unpushed. Overall task
  was not done; the next gate at that Phase A closeout was Owner confirmation of
  the Search contract and separate approval for Phase B Source + Local
  verification. That gate was later granted on 2026-07-20.

### 2026-07-17 - Admin Teaching Programs Documentation Consistency Correction

Status: **DOCUMENTATION-ONLY CORRECTION — CURRENT CLOSEOUT STATE RECONCILED**.

- A fresh read-only Git audit verified branch
  `spike/next-major-security-upgrade`; local, upstream, and read-only remote HEAD
  matched before this correction, with ahead/behind `0/0`. Pre-existing unrelated
  dirty `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and `docs/performance/`
  remained excluded.
- State observed at that 2026-07-17 closeout: Admin Teaching Programs already
  recorded Functional Source
  `039ad6e03ca0cb8c8c4334c81818c570b03b9287`, Ready Production deployment
  `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr`, Production-active behavior, and authenticated
  read-only Production UAT passed on 2026-07-15.
- Documentation Drift was limited to two current-tense lines in `TODO-CODEX.md`:
  its Session Exit Checklist still awaited deployment, and the prior Lesson Wallet
  summary said its superseded deployment remained active. The next action now
  consistently awaits Owner task selection, and the Lesson Wallet deployment
  statement is explicitly scoped to its 2026-07-15 closeout.
- The dated 2026-07-15 Teaching Programs implementation, deployment, and UAT
  history remains unchanged. This correction did not change Source, deployment,
  Production UAT, migration, environment, feature controls, allowlists, Production
  data, customer behavior, or financial state.
- State observed at that closeout remained Active Task `NONE`, Task Done `Yes`,
  Remaining Work `None`, and Next Action: await Owner selection without starting
  Admin Schedules
  Performance, Homepage LV, or any other Parking Lot task automatically.

### 2026-07-15 - Admin Teaching Programs Default Today + Deterministic Ordering

Status: **DONE — EXACT SOURCE DEPLOYED; READ-ONLY PRODUCTION UAT PASSED**.

#### Initial Source-fix round (historical state observed before Build approval)

- Owner selected `/admin/teaching-programs` as the single active task and limited
  this round to Source Fix + Local Verification. Commit, push, deploy, migration,
  Production data repair/write, and controlled write UAT were prohibited.
- Gate 0 found branch `spike/next-major-security-upgrade`; local, upstream, and
  read-only remote HEAD all matched
  `74e26ee442cdb46cce5e1579df55a55d9a97bddf`, ahead/behind `0/0`. Pre-existing
  unrelated dirty `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and
  `docs/performance/` were preserved and excluded.
- Audit proved that start/end date states were blank and filtering occurred only in
  the client. Start-only was inclusive lower-bound, end-only inclusive upper-bound,
  and both blank admitted all dates. The server supplied at most 800 programs in
  `created_at DESC`; the client filtered and paginated that inherited order without
  a slot date/time/branch sort.
- `/admin/schedules` orders rounds by date, start time, branch name, and course type,
  and its active branch query orders by name. `branches` has no `sort_order`; its
  persisted unique slug identifies แจ้งวัฒนะ as `chaengwattana`.
- Source now computes Bangkok today once on the server and uses it for both initial
  date inputs. It joins branch slug with the existing slot relation, parses real
  `HH:mm[:ss]` values, and sorts all filtered items before the unchanged 18-row
  page slice by date, time, same-time `chaengwattana` priority, Thai branch name,
  branch slug, slot id, and program id. Search/filter/review behavior is otherwise
  unchanged; `/admin/schedules`, API contract, schema, and data were not changed.
- Verification passed: deterministic date/time/branch/tie-breaker/cross-page
  fixtures, Bangkok midnight UTC-boundary fixtures, `npx tsc --noEmit`, targeted
  ESLint, full `npm run lint`, `npm run check:mojibake` (230 files), and
  `git diff --check`. Local browser smoke reached the expected login redirect with
  zero console errors, but authenticated smoke was unavailable because no signed-in
  local browser session existed. No credentials were entered and no write action
  was invoked.
- State observed at the initial Source-only closeout: local Source was complete and
  tested but remained uncommitted/unpushed/undeployed. Functional Production Source remains documented
  as `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`; Production-active behavior and
  Production UAT for this fix are not claimed. Task Done remains No.

#### Build + Commit + Push closeout

- Owner subsequently authorized Gate 0, Production Build, scoped functional Source
  commit/push, and a separate documentation closeout commit/push. Deploy,
  Production UAT/write, migration, environment, feature-control, allowlist, and
  scope expansion remained prohibited.
- Fresh Gate 0 verified authenticated GitHub CLI account `aachanin1`, branch
  `spike/next-major-security-upgrade`, and matching local/upstream/read-only remote
  HEAD `74e26ee442cdb46cce5e1579df55a55d9a97bddf`, ahead/behind `0/0`. The unrelated
  dirty paths remained excluded and the staged set was initially empty.
- Reviewed Source diff retained the approved sorting/default-date contract and had
  no Review API, `/admin/schedules`, migration, server-cap, page-size, schema, or
  data change.
- Verification passed: ordering fixtures with 9 contract rows and 40 pagination
  rows at page size 18; 2 Bangkok UTC-boundary cases; `npx tsc --noEmit`; full
  `npm run lint`; mojibake 230 files; `npm run build` with 91/91 static pages; and
  `git diff --check`. The clean post-build dev restart served root and a generated
  static asset with `200`, preserved the Admin `307` login redirect, and produced
  zero dev stderr or browser console warnings/errors.
- Functional commit `039ad6e03ca0cb8c8c4334c81818c570b03b9287` contains exactly
  the three Teaching Programs Source files and is pushed to
  `origin/spike/next-major-security-upgrade`; local/upstream/read-only remote HEAD
  matched and ahead/behind was `0/0` after that push.
- State observed at this closeout: Source is committed and pushed and Build passed.
  It is not deployed or Production-active, Production UAT and controlled write UAT
  were not run, Production data did not change, and customer/financial impact is
  none. Task Done remains No; next action is Owner review before a separately
  authorized deployment round.

#### Exact Source Production deployment + read-only UAT closeout

- Owner subsequently authorized exact-source Production deployment from functional
  Source `039ad6e03ca0cb8c8c4334c81818c570b03b9287`, authenticated read-only
  Production UAT, immediate rollback to `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` if
  any mandatory gate failed, and a scoped documentation commit/push. Source,
  migration, environment, feature-control, allowlist, Review action, and
  Production business-data changes remained prohibited.
- Gate 0 verified branch `spike/next-major-security-upgrade`; local, upstream, and
  read-only remote HEAD `1056cff8f97a43571681721877ed6352334fc798`;
  ahead/behind `0/0`; the functional commit as an ancestor; and exactly the three
  approved Source files in that commit. Unrelated dirty `AGENTS.md`,
  `src/lib/schedule-slot-utils.ts`, and `docs/performance/` remained excluded.
  The prior Production deployment and rollback target
  `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` was Ready, and the pre-deploy custom/canonical
  root, health, and generated static asset checks passed.
- Deployment used a clean detached worktree at exact HEAD
  `039ad6e03ca0cb8c8c4334c81818c570b03b9287`, tree
  `1d716a275505ffbc688487f0f245920c31a5619b`. Vercel build passed 91/91 static
  pages and produced Ready deployment `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr` at
  `new-athlete-badminton-school-6t4c92z0k-aachanin1s-projects.vercel.app`.
  All four established Production aliases were explicitly converged to that
  deployment. The public root, `/api/health`, and a generated static JavaScript
  asset returned `200`; the two protected project aliases retained their existing
  Vercel SSO behavior and were independently confirmed by `vercel inspect` to map
  to the new deployment.
- Existing authenticated Super Admin Chrome state enabled UAT without entering
  credentials. Fresh load and two reloads set both date inputs to Bangkok
  `2026-07-15`, displayed exactly five rows for that date, and produced identical
  ordering. Today ordered `13:00` before `17:00`; at `17:00`, แจ้งวัฒนะ preceded
  Rama 2 and Suvarnabhumi.
- Manual date/range UAT passed. Single-day `2026-07-14` displayed seven rows only
  for that date. Range `2026-07-14` through `2026-07-15` displayed twelve rows in
  date-then-time order; at both July 14 `15:00` and `17:00`, แจ้งวัฒนะ preceded
  other branches at the same time. Start-only retained inclusive `>=`, end-only
  retained inclusive `<=`, and clearing both fields restored all-date behavior.
- Search and status, coach, branch, and course-type filters all changed the visible
  set correctly. Pagination was exercised on all 362 rows at the unchanged page
  size 18: page 1 had 18 rows, page 2 had 18 rows, overlap was zero, and the
  boundary advanced from June 6 `09:00` to `10:00`. Selecting the June 6 `10:00`
  Ratchaphruek-Taling Chan row opened the matching coach/date/branch detail. The
  Approve and Return buttons remained present and were not clicked.
- Browser console warning/error count, hydration errors, and React #418 were zero.
  Runtime log review found only GET requests during UAT; focused queries returned
  zero POST, PUT, PATCH, DELETE, 4xx, and 5xx events. No credential entry, Review
  action, form submission, Production business-data write, data repair, migration,
  environment, feature-control, allowlist, schema, server-cap, page-size, or
  `/admin/schedules` change occurred. Rollback was not performed because every
  mandatory gate passed.
- State observed at this closeout: exact functional Source is deployed and active,
  read-only Production UAT passed, customer impact is corrected Admin display
  behavior, financial impact is none, Task Done is Yes, Active Task is NONE, and
  the next action is to await Owner selection without automatically starting a
  Parking Lot task.

### 2026-07-15 - Production Lesson Wallet Canonical Redemption Regression

Status: **DONE — SOURCE DEPLOYED; NO-WRITE AND OWNER-VERIFIED CONTROLLED WRITE
PRODUCTION UAT PASSED**.

#### Gate 0 and exact incident audit

- Owner selected this regression as the single active task and authorized one
  coordinated gated audit/fix/test/commit/push/deploy/verification/docs round.
  No migration, Production repair/test-data creation, real-customer redeem,
  pricing/payment/coupon/Ledger/Finance/payroll/attendance/SlipOK change, or
  Reschedule/Makeup redesign was authorized.
- Starting branch was `spike/next-major-security-upgrade`; local and remote HEAD
  were both `9a678b9224ea3941db0727071d2337aaf714fcd1`, ahead/behind `0/0`.
  Unrelated `AGENTS.md` and `docs/performance/` work remained excluded.
- Existing deployment `dpl_DX9gCUMG4XeWtT27cFHXJgKwbAkm` was Ready on all four
  Production aliases. Its documented exact functional source remained `4ab6a69`;
  no contrary deployment evidence or documentation drift was found.
- Vercel logs contained exactly one incident `POST /api/lesson-wallet` `400` at
  `2026-07-15T11:20:10.294Z` and the supplied response was
  `รอบเรียนที่เลือกไม่ตรงกับรอบเรียนประจำในระบบ`. The request body was not retained,
  so the historical hint ID is `Unknown / Need verification`; one click sent one
  request.
- Exact target evidence was Ramintra / Private / Sunday 2026-07-19 /
  17:00-18:00, canonical template `508d96b1-c160-4127-87e1-353577ec4990`, and
  pre-existing dated slot `fa0f0797-023d-44c1-a137-b2b253fb7539`. Rama 2 had a
  separate valid same-time template, but the visible incident branch was Ramintra.
- Two sanitized matching credits originated from Private Saturday 2026-07-25
  16:00-17:00. Both were active at the failed request and later redeemed by the
  real user to a different target. They are real-customer entitlements and cannot
  be used for controlled Production write UAT.
- Incident-window fingerprints found no credit/session/slot/assignment/
  notification/activity/payment/coupon/Ledger/Finance change. Failure occurred
  before slot resolution and mutation.

#### Root cause and Source correction

- `dayOfWeek()` used `new Date(date + 'T00:00:00+07:00').getDay()`. On a UTC host,
  Bangkok Sunday midnight is Saturday 17:00 UTC, so Vercel queried weekday `6`
  instead of Sunday `0`. Both the supplied-ID query and canonical fallback used
  that wrong predicate. Historical stale-ID fallback and no-Kids-default fixes were
  still intact.
- Commit `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`, tree
  `c29de52987297e316d046faabcaee630878525dd`, is pushed. It adds host-independent
  Bangkok weekday calculation, robust exact time normalization, hint-then-canonical
  lookup by authoritative credit course, strict real-slot evidence, typed Thai
  errors, conflict-before-slot ordering, and post-CAS occupancy reconciliation.
- No migration Source changed or is required. No product UI, pricing, payment,
  coupon, Ledger, Finance, payroll, attendance, SlipOK, Reschedule, Makeup,
  capacity, or Production business-data change was made.

#### Verification observed before deployment

- `npm run test:lesson-wallet-regression`: 17/17 passed under `TZ=UTC`.
- `npm run uat:lesson-wallet`: passed on disposable local Supabase and cleaned 3
  profiles, 10 slots, 12 sessions, and 5 credits.
- Full rendered booking regression: 10/10 passed; auth/database residue `0`.
  Coverage includes the exact Ramintra Private Sunday selection, correct/stale/
  nonexistent/cross-branch/cross-course hints, time normalization, no canonical
  template, exact/overlap conflicts without slot residue, above-capacity entry,
  inactive/cancelled/past/different-month rejection, one-winner concurrent redeem,
  canonical slot persistence, no target assignment, and unchanged Payment/coupon/
  Ledger/Finance counts.
- `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, and
  `git diff --check` passed. After clean `.next` removal/restart, root, health, and
  a generated static asset returned `200`.
- Functional Source was deployed from a clean detached worktree pinned to
  `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`, tree
  `c29de52987297e316d046faabcaee630878525dd`. No migration delta existed.
  Deployment `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` reached Ready, and explicit alias
  convergence placed all four Production aliases on the same artifact. Root,
  `/api/health`, and generated static assets returned `200` on every alias.
- Vercel environment-name pre/post comparison retained the same 11 expected names.
  Progressive controls, Entry, shared `SLIPOK_TEST_MODE`, server-only credentials,
  and the absent allowlist were unchanged. No 5xx appeared in post-release logs.
- Protected pre-deploy and post-no-write-UAT credit/session/template/slot/payment/
  coupon/Progressive/Finance counts and fingerprints matched. Production business-
  data change attributable to this release/UAT was zero.
- Authenticated no-write UAT opened the real User Wallet, selected Ramintra /
  Private / Sunday 2026-07-19 / 17:00-18:00, verified the selected evidence and an
  enabled confirmation action, found no capacity/full block and no console,
  hydration, or network-preflight error, and cancelled without confirming. Runtime
  logs show the Wallet GETs returning `200` and no redemption POST.
- State observed at the earlier no-write closeout: controlled write UAT had not yet
  run because the identified incident credits were real-customer entitlements and
  no Owner-controlled test credit had been proved. This checkpoint is superseded
  by the Owner's later manual Production UAT and the final record below.

#### Owner-controlled Production write UAT and final closeout

- Owner confirmed personally completing a real Production Lesson Wallet redemption
  successfully and accepted the release. Codex performed read-only reconciliation
  only; it did not redeem, store, create, repair, migrate, deploy, or change any
  Production data or control.
- Gate 0 re-verification found branch `spike/next-major-security-upgrade`; local and
  fetched remote HEAD both `091a064b9b107913dfcc286e77c4a4e6253ad921`, ahead/
  behind `0/0`. The pre-existing unrelated `AGENTS.md`, content-identical stat-dirty
  `src/lib/schedule-slot-utils.ts`, and untracked `docs/performance/` remained
  excluded. Deployment `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` remained Production
  `READY`; Vercel metadata independently records functional Source
  `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`. All four Production aliases still
  point to that artifact.
- Runtime logs recorded two successful `POST /api/lesson-wallet` calls at
  `13:29:23Z` and `13:30:14Z`. Database activity evidence safely distinguishes
  exactly one `redeem_lesson_wallet_credit` at `13:29:31Z` and a later separate
  `store_lesson_wallet_credit` at `13:30:19Z` for the same sanitized account. The
  latter stored the newly redeemed target back into the Wallet and is not a second
  redemption. Both were Owner actions; Codex replayed neither.
- The redemption changed exactly one credit to `redeemed`, created exactly one
  target session, retained the credit/session booking relationship, and linked the
  target to the real open canonical slot and active recurring template for
  Ramintra / Private / Sunday 2026-07-19 / 17:00-18:00. The later store changed
  that target to `walleted` and created one correctly linked active credit; no
  orphan remained.
- Active exact duplicate/overlap count was `0`. One matching walleted session
  created on 2026-07-05 pre-existed the UAT, is non-active under the Wallet
  contract, and has its own active credit; the UAT did not create it. Target orphan
  count, assignment-student rows, and active overlapping-session count were `0`.
- Across the complete Owner action window, newly created related Payment rows,
  coupon usages, payment-Ledger allocations, Progressive allocations, Progressive
  batch members, Finance expenses, and Bookings were each `0`. Financial impact is
  none; data repair is none. Production business data changed only through the
  normal Owner redemption and subsequent Wallet-store actions.
- The former controlled-write/Task-Done fields were therefore documentation drift
  after the Owner's confirmation. Final classification:
  **PASS — LESSON WALLET PRODUCTION REDEMPTION OWNER-VERIFIED; TASK DONE**.
  At that closeout, Active Task was `NONE`; the dated next action was to await
  Owner selection without starting Admin Schedules Performance or Homepage LV
  automatically.

### 2026-07-15 - Documentation Closeout Correction

Status: **DOCUMENTATION DRIFT CORRECTED; NO ACTIVE TASK SELECTED**.

- Owner approved Documentation Closeout Correction Only. Stale present-tense
  statements that treated Unlimited Slot Entry as active, requested another
  Production preflight/migration/deploy/UAT gate, or tied Homepage LV authorization
  to the now-completed Booking task were corrected or explicitly marked historical
  and superseded.
- State observed at this closeout: the Unlimited Slot Production release remains
  **DONE**; no active implementation task is selected. Admin Schedules Performance
  and Homepage LV remain
  **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.
- A permanent `Documentation Consistency Gate` was added to `AGENTS.md`. It assigns
  one owner for mutable facts, requires ordered context updates and a consistency
  matrix, enforces hard-stop and historical-wording rules, prevents duplicated
  current Production/Git state, and requires separate final-report state fields.
- This correction changed no Source, Test Source, Migration Source, deployment,
  environment, feature control, allowlist, SlipOK mode, Production schema/data,
  customer behavior, or financial state. It performed no Production UAT or data
  repair.
- State observed at that closeout: next action was to await Owner selection and
  not start a Parking Lot task automatically.

### 2026-07-15 - Dashboard Booking Unlimited Slot Production Release Closeout

Status: **PASS — UNLIMITED SLOT RELEASE DEPLOYED;
NO-WRITE PRODUCTION UAT PASSED; TASK DONE**.

#### Gate 0 — exact release proof

- Owner approved one coordinated release containing only the exact remote migration,
  exact tested Source deploy, authenticated no-write Production UAT, bounded
  monitoring/reconciliation, and documentation closeout. Production Booking,
  Pending Edit, Wallet, Reschedule, Makeup, Payment, data-repair, environment,
  pricing, Source/Test/Migration-source changes, and automatic rollback remained
  prohibited.
- Branch was `spike/next-major-security-upgrade`; starting local and fetched remote
  HEAD were both `c978a24e863d42e1890faa94c7a1eaa90a144568`, ahead/behind
  `0/0`. Exact release Source was
  `4ab6a69e23de6f7989b51dfaf624ff631dde420f`, tree
  `397618a391f968ec1135084978ce3589a43f1d89`.
- The committed migration blob
  `20260715060541_unlimited_normal_slot_entry.sql` matched SHA-256
  `130E1F7770ECB2F1D4C16CE19ED7CC8DFFD042F33D3602CCF6EC782BC0982BFD`.
  Remote history matched local through `20260713210000`; `20260715060541` was the
  sole pending migration.
- Intentionally excluded dirty work was preserved: the unrelated `AGENTS.md`
  remainder and untracked `docs/performance/`. Generated `.next`, test-result,
  Playwright-report, fixture, backup, and local environment residue were absent.
- Starting Production deployment was
  `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`, Ready on all four aliases. Entry, pricing
  writes, coupon lifecycle, payment batch, and payment review were `true`; allowlist
  was absent; shared `SLIPOK_TEST_MODE=true`. No release environment value changed.

#### Gate 1 — protected baseline

- Baseline was captured at `2026-07-15T09:12:06Z` without personal output. Counts
  and MD5 fingerprints were:

| Protected set | Count | Gate 1 fingerprint |
| --- | ---: | --- |
| attendance | 1,663 | `9b3205a09c1a9ff224be68a190be140c` |
| booking sessions | 2,833 | `2359b348534ad188cda1f4db8bd6c255` |
| bookings | 526 | `eb8e143edd048185bf3da62733c55b90` |
| coupon reservations / usages | 0 / 0 | `d41d8cd98f00b204e9800998ecf8427e` / `d41d8cd98f00b204e9800998ecf8427e` |
| Finance expenses | 1 | `3049e3c7b305b34be859623eac21b858` |
| Legacy payments | 473 | `73a58aa3936780d5313e6b5966ccd621` |
| lesson-wallet credits | 61 | `7bc41470eec666042e21732264e02b83` |
| mutation receipts | 12 | `9bf536a911098f7e51197b716f565fd2` |
| notifications | 16,686 | `841f9451e6a1415af1d78922e0540d1c` |
| payment batch members / batches | 27 / 20 | `90bfc588b859002c450287da85118fdc` / `a20825a63edb87b21ea9676c7d6952b2` |
| payment Ledger | 475 | `7f0d3299c9635671a14b4e9b05bd6f96` |
| pricing scopes / snapshots | 4 / 7 | `0618acdceb0761eb9f4434a387ea223a` / `52650a9a53611bdbea46086c1dbcf891` |
| pricing tiers | 11 | `da1b6608a3f830fd936ad64eb60d94e1` |
| Progressive allocations / bookings | 2 / 7 | `6553e26f4987c6d7e709bbbf5792d47f` / `52650a9a53611bdbea46086c1dbcf891` |
| verification attempts | 2 | `39d611556e4fa5472936ed95701489fa` |

#### Gate 2 — exact remote migration

- `npx supabase db push --linked --yes` started at
  `2026-07-15T09:12:27.8745538Z` and completed successfully at
  `2026-07-15T09:12:32.3911341Z`. It applied only
  `20260715060541_unlimited_normal_slot_entry`, exactly once; no other migration or
  repair was applied.
- Immediate post-migration verification at `2026-07-15T09:13:50Z` matched every
  Gate 1 protected count/fingerprint. Release-attributable DML was `0`.
- Effective function hashes became:
  - `progressive_lock_booking_slots_v1(uuid,uuid,learner_type,uuid,uuid,jsonb,uuid,uuid[])`:
    `40dd9123d4d7f2fecd06011fe0c27958`;
  - `progressive_refresh_slot_capacity_v1(uuid[])`:
    `1849aee5282c7f0e4af3a5a6281ceed4`;
  - `progressive_pricing_writes_capability_v1()`:
    `7dbea01c93c1e29ee987d2ebd6a018d2`.
- Capability returned `ready=true`, version `2`,
  `slotEntryPolicy=unlimited_learner_v1`, and
  `legacyBaselineContract=immutable_scope_v1`. Lock/refresh remained invoker
  functions; capability remained `SECURITY DEFINER`; every function retained fixed
  `search_path=public, pg_temp` and execute grants only for `postgres` and
  `service_role`. Dependent create/update/cancel definitions, hashes, signatures,
  grants, and security mode were unchanged.

#### Gate 3 — exact Production deployment

- A first temporary `vercel link` attempt created `.env.local` and modified
  `.gitignore` only inside an isolated disposable worktree. That worktree was not
  deployed. It was removed after a second clean worktree was created; no repo Source,
  local environment, or tracked release content was changed.
- The deployed worktree was clean at exact Source/tree with no local `.env` file.
  Deployment began at `2026-07-15T09:16:23.9448235Z`; Vercel build passed install,
  Next.js compilation, TypeScript, and all 91 static pages. Deployment
  `dpl_DX9gCUMG4XeWtT27cFHXJgKwbAkm` reached Ready at
  `2026-07-15T09:17:52.134Z`, about four minutes after the migration verification
  gate and inside the approved 15-minute maximum.
- Vercel metadata records Source
  `4ab6a69e23de6f7989b51dfaf624ff631dde420f`, tree
  `397618a391f968ec1135084978ce3589a43f1d89`, and migration
  `20260715060541`. The two aliases not automatically promoted by the CLI deploy
  were explicitly assigned to the same new Ready artifact. Final inspection proved
  all four Production aliases resolve to this deployment. Root and `/api/health`
  returned `200`; unauthenticated Booking preview/create remained `401`.
- Production environment, Entry/dependencies/allowlist/SlipOK values were not
  changed. Both release worktrees were safely removed; unrelated pre-existing
  worktrees were preserved.

#### Gate 4 — authenticated no-write Production UAT

- Used only the existing Owner-controlled authenticated User session. No account,
  profile, child, booking, session, wallet credit, makeup entitlement, or payment
  batch was created or repurposed.
- A read-only aggregate query identified a future Kids Group round at Rama 2 on
  2026-07-23 17:00–19:00 with `15` active learners. No learner identities were
  read or documented. The slot rendered enabled and remained selectable. Booking
  showed no `x/6`, remaining-seat, full, or capacity-disabled state. Confirmation
  was not clicked.
- The restored browser-local Kids Group draft recalculated successfully. Available
  learner evidence showed distinct nickname/full name as
  `น้อง Test - TEST System`; self/adult and Private self-attend showed the profile
  full name once. The account contained no existing child with absent/equal
  nickname and no multi-child selection, so those unavailable Production cases rely
  on the passed rendered Local E2E suite as explicitly allowed.
- Authoritative Kids Group pricing passed in both steps:
  - `4+1`: range `2–6 ครั้ง`, rate `625`, gross/final `625`;
  - `4+4`: range `7–10 ครั้ง`, rate `500`, gross/final `2,000`.
  Step 5 stated previous `4`, new `4`, cumulative `8`, and
  `4 × 500 = 2,000`. Prior payments remained attached to earlier bookings and were
  not shown as a deduction.
- Steps 4-5 used `วิธีคิดราคาการจองครั้งนี้` and exposed none of Progressive,
  Legacy, baseline, scope, revision, ordered pricing, or true-up as required
  customer terminology. There was no fallback price flash. No existing safe coupon
  or zero-price case was available, so neither was manufactured; the passed Local
  E2E evidence remains the acceptance evidence for those branches.
- Adult Group remained one session in range `1 ครั้ง` at `600` total/average per
  session. Private self-attend remained one hour in range `1 ชั่วโมง` at `900`
  total/average per hour. Their pricing formulas and package semantics were not
  changed.
- Browser console errors `0`, hydration logs `0`, Next overlay `0`, and visible
  error dialogs `0`. No Booking create, Pending Edit save, Wallet, Reschedule,
  Makeup, Payment prepare/upload/submit, or SlipOK request was made. Controlled
  write UAT was not run; it was not authorized and was not required for closeout.

#### Gate 5 — monitoring and protected reconciliation

- Deployment monitoring from `2026-07-15T09:16:23Z` through
  `2026-07-15T09:33:15Z` sampled `52` request/log events: error/fatal `0`, 5xx `0`,
  unexpected Booking `409/500/503` `0`, capacity error `0`, capability mismatch `0`,
  dependency unavailable `0`, pricing revision/baseline fault `0`, SlipOK `0`, and
  business mutation requests `0`. Six availability and fourteen preview events
  returned `200`; duplicate middleware/serverless observations were not treated as
  separate business actions.
- Final protected counts matched Gate 1 for bookings `526`, booking sessions
  `2,833`, attendance `1,663`, scopes `4`, pricing snapshots `7`, mutation receipts
  `12`, coupon reservations/usages `0/0`, batches/members `20/27`, attempts `2`,
  allocations `2`, Legacy payments `473`, Ledger `475`, wallet `61`, tiers `11`,
  Finance expenses `1`, and Progressive bookings `7`.
- Notifications increased from `16,686` to `16,692`. Aggregate-only reconciliation
  classified all six as unrelated `reminder` notifications: four to two Head Coach
  recipients and two to one Coach recipient, created between
  `2026-07-15T09:21:01Z` and `09:46:49Z`. Booking preview/availability does not emit
  them, and the monitored UAT made no mutation request. No personal identifier or
  message content is recorded.
- Expected and observed release/UAT-attributable business-data delta is `0`;
  financial delta is `0`. The only release-attributable database change is the
  approved function/capability schema migration. No Production data repair,
  pricing-tier/formula change, historical reprice/backfill, environment change, or
  rollback occurred.

#### Closeout

- Source/Test/Migration Source changed in this release round: **NO / NO / NO**.
  Remote migration: **APPLIED EXACTLY ONCE**. Exact deploy: **READY ON ALL FOUR
  ALIASES**. Authenticated Production UAT: **PASSED — NO-WRITE**. Controlled write
  UAT: **NOT RUN — NOT AUTHORIZED**. Production business/financial data:
  **NOT CHANGED BY RELEASE/UAT**.
- Documentation closeout changes only `PROJECT_STATE.md`, `TODO-CODEX.md`, and this
  record. `AGENTS.md` and `docs/performance/` remain excluded. The task moves to
  Recently Completed; Admin Schedules Performance and Homepage LV remain parked.
  No next task starts in this round.
- Rollback was not used. Restoring old Source or old fixed-capacity DB functions
  would reintroduce the rejected policy and still requires a separate Owner
  decision. No remaining release blocker exists.

Final classification:
**PASS — UNLIMITED SLOT RELEASE DEPLOYED; NO-WRITE PRODUCTION UAT PASSED; TASK DONE**.

### 2026-07-15 - Dashboard Booking Unlimited Slot Production Release Preflight (Historical / Superseded)

Status: **PRODUCTION RELEASE PREFLIGHT COMPLETE; DOCUMENTATION ALIGNED;
MIGRATION/DEPLOY NOT STARTED**.

#### Git and release-candidate proof

- Read-only fetch confirmed branch `spike/next-major-security-upgrade` at matching
  local/remote HEAD `5328c42551a52d4b18f3d8fae9d198d42791bc75`, ahead/behind
  `0/0`. Source `4ab6a69e23de6f7989b51dfaf624ff631dde420f` and deployed
  Source `7d98b062f850a4210fae052cefddd92b994889b8` are ancestors.
- Release Source tree is `397618a391f968ec1135084978ce3589a43f1d89`.
  Production Source tree remains
  `73294ca5419582492fa558623d395c5b3801af5e` under the previously verified
  immutable deployment association.
- Committed migration
  `20260715060541_unlimited_normal_slot_entry.sql` still has SHA-256
  `130E1F7770ECB2F1D4C16CE19ED7CC8DFFD042F33D3602CCF6EC782BC0982BFD`.
- Intentionally excluded work remains the unrelated `AGENTS.md` remainder and
  `docs/performance/admin-schedules-supabase-log-analysis-2026-07-14.md`.

#### Current Production deployment and controls

- Vercel deployment `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9` is `READY`, target
  `production`, source `cli`, and still serves all four aliases. Vercel exposes no
  Git SHA/ref metadata for this CLI deployment; the deployment ID is unchanged
  from the prior exact Source/tree proof.
- All four public roots returned `200`; a generated `/_next/static/*` asset returned
  `200`. Unauthenticated POST guards for Booking availability, preview, and create
  each returned `401`; no browser draft or authenticated business request was made.
- Safe boolean readback is unchanged: `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`,
  pricing writes `true`, coupon lifecycle `true`, payment batch `true`, payment
  review `true`, and shared `SLIPOK_TEST_MODE=true`. The allowlist is absent; no
  UUID member or secret was read or printed.
- Bounded 24-hour logs for the current deployment contained capacity rejection
  `0`, Booking dependency fault `0`, Progressive RPC unavailable `0`, and SlipOK
  activity `0`. Separate observations were three `500` responses from
  `PATCH /api/admin/makeup` and one error-level `/` request that still returned
  `200`; neither matched the capacity/dependency/RPC/SlipOK searches and neither is
  treated as proof about the Unlimited Slot target-creation path.

#### Remote migration and current DB contract

- Linked migration history matches local exactly through `20260713210000`, which
  is present once. `20260715060541` is absent remotely and is the only local-only
  migration; there is no unexpected migration before or after it. No remote DDL,
  DML, migration repair, or data read beyond aggregate/metadata evidence occurred.
- Current normalized effective function hashes (MD5 over whitespace-normalized
  `pg_get_functiondef`) are:
  - lock `progressive_lock_booking_slots_v1(uuid,uuid,learner_type,uuid,uuid,jsonb,uuid,uuid[])`:
    `b5b871c3bda83668902d5ad3bf2b512c`;
  - refresh `progressive_refresh_slot_capacity_v1(uuid[])`:
    `7d63bf278bebebad3595319428026f14`;
  - capability `progressive_pricing_writes_capability_v1()`:
    `b87e256720c9c10e5f053bacc75223b0`.
- Capability response is exactly `ready=true`, `version=2`,
  `legacyBaselineContract=immutable_scope_v1`; `slotEntryPolicy` is absent. The
  lock still contains `PROGRESSIVE_CAPACITY_EXCEEDED`, and refresh still derives a
  `full` status from active occupancy.
- The lock and refresh are invoker functions owned by `postgres`; the capability
  and dependent create/update/cancel RPCs are `SECURITY DEFINER`. Every inspected
  function has fixed `search_path=public, pg_temp` and an ACL limited to
  `postgres`/`service_role`; `PUBLIC`, `anon`, and `authenticated` have no execute
  grant. Create/update call lock and refresh; cancel calls refresh. Their signatures
  and capability version remain the Option A contract expected before the new
  migration.
- Aggregate-only evidence found `25` future non-cancelled slots above six active
  learners, none above twenty, and a maximum future active occupancy of `15`.
  This supports a later no-write visible above-six selection check without exposing
  learner or allowlist data.

#### Source/DB compatibility matrix

| State | Preview/UI | Create/edit and other entry paths | Fail-closed / customer effect | Short controlled interval |
| --- | --- | --- | --- | --- |
| Old Source `7d98b062` + old DB | Current Progressive preview works, but Booking shows occupancy/capacity and disables full slots. | Progressive create/edit can raise `PROGRESSIVE_CAPACITY_EXCEEDED`; old Wallet checks `open` and `current_students < max_students`; Reschedule and Makeup do not share that DB capacity RPC. | Existing capability passes old Source. Technically stable but violates the new Owner policy and still blocks valid customers. | Baseline only; not an acceptable final release. |
| Old Source `7d98b062` + new Unlimited DB | Old preview/UI/availability still shows and blocks capacity. | DB lock no longer rejects capacity, but old client/server availability and Wallet can still block; duplicate, template, timing, ownership, Option A and atomic guards remain. | Old Source accepts capability version `2` even with the added policy field. No integrity guard is weakened by the new DB contract. | **YES**, migration-first bridge only; customer policy remains incomplete. |
| New Source `4ab6a69` + old DB | New UI/preview removes capacity and returns authoritative tier text. | Progressive create/edit calls the capability and fails `503` because `slotEntryPolicy` is absent; Wallet/Reschedule/Makeup and Legacy paths are not protected by that same capability. | Intentional fail-closed mismatch creates a preview-then-confirm failure and inconsistent entry paths. | **NO**, including a deploy-first interval. |
| New Source `4ab6a69` + new Unlimited DB | Non-blocking occupancy, shared learner names, authoritative range and plain Thai copy. | Progressive create/edit, Wallet, Reschedule and Makeup follow unlimited entry while preserving duplicate/lifecycle/template/payment/concurrency guards. | Capability matches `unlimited_learner_v1`; expected release state. | **YES**, target state after verification. |

#### Proposed release order and bounded interval

1. Repeat Git/Vercel/Supabase/env/log baseline immediately before release.
2. Apply exactly `20260715060541`; do not include any other migration.
3. Verify remote history, all three function hashes/definitions, signatures,
   owner/security mode, grants/search path, and capability
   `slotEntryPolicy=unlimited_learner_v1`.
4. Deploy exact Source commit `4ab6a69e23de6f7989b51dfaf624ff631dde420f`
   and verify the build provenance available from Vercel.
5. Confirm every Production alias and generated static asset points to the new
   Ready deployment.
6. Run the bounded no-write UAT below, then scan errors/capability/capacity logs and
   reconcile that no business-data write occurred.
7. Close documentation only after all separately approved gates pass.

- Migration-to-deploy target is immediate; proposed hard maximum is **15 minutes**
  in one staffed release window. Do not apply the migration unless the exact Source
  artifact and deploy operator are ready. If deployment cannot become Ready inside
  that window, stop further actions and escalate; do not deploy new Source first.
- Stop on migration/history/hash/signature/grant/capability mismatch, alias or static
  asset mismatch, build/runtime error, new dependency/RPC fault, unexpected
  business write, or any evidence that duplicate/template/timing/pricing/payment/
  accounting guards changed.

#### Rollback and failure limits

- A Source alias rollback is technically possible, and old Source can operate
  briefly against the new DB, but it restores old capacity UI/availability and
  Wallet blocking. It is therefore not an automatic policy-compliant rollback.
- Restoring old DB helper definitions restores the fixed capacity ceiling and makes
  new Source fail closed. It requires explicit Owner approval and must never be
  treated as a routine rollback or run independently of Source compatibility.
- If migration verification passes but deploy fails, leave the new DB contract in
  place, keep old Source only for the bounded bridge, and retry the exact deployment
  or forward-fix. Prefer forward repair over restoring the rejected DB policy.
- If deploy is healthy but no-write UAT fails, stop confirmation/UAT actions and
  forward-fix. Repointing to old Source or restoring old DB functions requires a
  separate Owner decision because either can restore prohibited capacity behavior.

#### Proposed no-write Production UAT

- Use only an existing Owner-controlled authenticated User state; do not create a
  customer or server-side draft. Verify no `x/6`, full, or remaining-seat state and
  confirm an existing future slot with aggregate occupancy above six remains
  selectable without confirming.
- Verify child `nickname - full name`, nickname-absent/equal/blank fallback, multiple
  children, and self/adult full-name-only rendering.
- Verify authoritative one-session, bounded, and open-ended tier copy; plain Thai
  calculation; coupon gross/discount/final and zero-price copy; no customer-visible
  Progressive, Legacy, baseline, scope, revision, ordered pricing, or true-up terms.
- Where an existing safe history/draft permits, verify `4+1` selects range `2–6` at
  `625` and `4+4` selects range `7–10` at `500`, plus restored browser-local draft
  recalculation. Adult Group and Private must remain unchanged.
- Confirm no console, hydration, or network error. Do not confirm Booking, save a
  pending edit, redeem Wallet, submit Reschedule, create Makeup, or prepare/upload/
  submit Payment. These mutation-success paths cannot be proven in Production by a
  no-write UAT; if Owner requires live mutation proof, classify it separately as
  **OWNER DECISION REQUIRED — CONTROLLED WRITE UAT**.

#### Documentation alignment and remaining gate

- Corrected present-tense claims that the release candidate was local, unstaged, or
  uncommitted. Current docs now separate pushed candidate `4ab6a69` from deployed
  Source `7d98b062` and do not name historical deployments as automatic rollback
  targets for this release.
- Source/tests/migration changed: **NO / NO / NO**. Remote migration/deploy/UAT:
  **NO / NO / NOT RUN**. Environment and Production data: **NO CHANGE / NOT
  CHANGED**. Task Done: **NO**.
- Remaining gate is Owner approval or rejection of the coordinated exact migration,
  exact deploy, and no-write Production UAT plan. No Production write is implied.

### 2026-07-15 - Dashboard Booking Unlimited Slot Entry Commit/Push Closeout (Historical / Superseded)

Status: **SOURCE COMPLETE, TESTED, COMMITTED AND PUSHED; PRODUCTION RELEASE NOT STARTED**.

- Source commit:
  `4ab6a69e23de6f7989b51dfaf624ff631dde420f`.
- Source tree:
  `397618a391f968ec1135084978ce3589a43f1d89`.
- Source message: `fix(booking): remove normal slot capacity limits`.
- Documentation closeout is the commit containing this record; its exact SHA is
  reported in the Git/final handoff because a commit cannot contain its own final
  content-addressed SHA.
- Both commits are pushed without force to
  `origin/spike/next-major-security-upgrade`; local/remote equality and ancestry are
  verified after push.
- Committed migration Source is exactly
  `supabase/migrations/20260715060541_unlimited_normal_slot_entry.sql`, SHA-256
  `130E1F7770ECB2F1D4C16CE19ED7CC8DFFD042F33D3602CCF6EC782BC0982BFD`.

#### Source commit contents

- Permanent rule: only the approved unlimited-capacity Scheduling hunk from
  `AGENTS.md`.
- Tests/scripts: `scripts/check-booking-slot-availability.mjs`,
  `scripts/check-progressive-booking-entry.js`,
  `scripts/check-unlimited-slot-entry-and-price-ux.mjs`,
  `scripts/check-unlimited-slot-entry-runtime.sql`,
  `tests/booking-regression/booking.spec.ts`, and
  `tests/booking-regression/local-supabase.ts`.
- Booking/UI/API: `src/components/dashboard/booking-client.tsx`,
  `src/app/api/bookings/availability/route.ts`,
  `src/app/api/bookings/preview/route.ts`, `src/app/api/bookings/route.ts`,
  `src/app/api/lesson-wallet/route.ts`, `src/app/api/reschedule/route.ts`, and
  `src/app/api/admin/makeup/route.ts`.
- Shared helpers/contracts: `src/lib/learner-display-name.ts`,
  `src/lib/booking-slot-availability.ts`, `src/lib/booking-pricing.ts`,
  `src/lib/pricing.ts`, `src/lib/progressive-booking-preview.ts`,
  `src/lib/progressive-booking-pricing.ts`, and
  `src/lib/progressive-booking-write.ts`.
- Additive migration: exactly
  `supabase/migrations/20260715060541_unlimited_normal_slot_entry.sql`.

#### Commit/push verification and exclusions

- Before commit: branch/local/remote provenance matched expected
  `db161d4a39c25a45932c821b7d0f0295ca8d7e2d`; functional ancestor
  `7d98b062f850a4210fae052cefddd92b994889b8` remained in ancestry; migration
  checksum matched; `git diff --check`, mojibake, focused Unlimited UX `27/27`,
  and Booking Entry `31/31` passed; secret scan passed.
- After Source commit: all 22 committed paths were inspected; context docs were
  absent; migration checksum from the committed Git blob matched; no unrelated
  source, performance work, generated output, credentials, or Production identifier
  was included.
- Documentation commit contains only `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`.
- Excluded and intentionally still dirty: the unrelated `AGENTS.md` remainder and
  `docs/performance/admin-schedules-supabase-log-analysis-2026-07-14.md`.
- Remote migration: **NO**. Deploy: **NO**. Feature/Entry: **NO CHANGE**.
  Production UAT: **NOT RUN**. Task Done: **NO**.
- Production remains on Source
  `7d98b062f850a4210fae052cefddd92b994889b8` and deployment
  `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`; Production data and financial state are
  unchanged. The next gate is fresh Production preflight and separate Owner
  approval for Remote Migration + exact Deploy + Production UAT.

### 2026-07-15 - Current-State Documentation Alignment (Historical / Superseded)

- Classification before correction:
  **DOCUMENTATION DRIFT — CURRENT STATE MUST BE CORRECTED BEFORE SOURCE FIX**.
- Read-only verification confirmed branch `spike/next-major-security-upgrade`,
  matching local/remote HEAD `db161d4a39c25a45932c821b7d0f0295ca8d7e2d`,
  functional Source `7d98b062f850a4210fae052cefddd92b994889b8`, tree
  `73294ca5419582492fa558623d395c5b3801af5e`, and Ready Production deployment
  `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`.
- Production controls remained Entry `true`, all four Progressive dependencies
  `true`, allowlist absent, and shared `SLIPOK_TEST_MODE=true`; migration
  `20260713210000` remained applied once. History Payment is DONE with Production
  UAT passed.
- Current-state documents now label `be61b68`, `dpl_2GQ4...`, `dpl_CJV...`, Entry-off
  checkpoints, pre-fix History classifications, and old rollback notes as historical
  or superseded. Unlimited Slot Entry remains the only active task; Admin Schedules
  Performance and Homepage LV remain parked.
- Functional Source/tests/migration, commit, push, deploy, environment, Production
  data, customer behavior, and financial state changed in this correction round:
  **no / no / no / no / no / no / no / no / no**.

### 2026-07-15 - Dashboard Booking Unlimited Slot Entry + Customer Price UX Source Fix (Historical / Superseded)

Status: **SOURCE COMPLETE, TESTED, COMMITTED AND PUSHED; PRODUCTION RELEASE NOT STARTED**.

#### Approved policy and implemented boundary

- Implemented the Owner-approved unlimited-learner rule for new User booking,
  pending-payment edit, User reschedule, Lesson Wallet redemption, and Admin Makeup
  target selection. Occupancy is informational and no longer decides eligibility.
- Preserved or strengthened learner date/time overlap prevention, authentication and
  ownership, active schedule-template resolution, canonical `schedule_slot_id`,
  future/not-started and cancelled-slot checks, booking/payment status, same-month
  wallet/reschedule rules, mutation idempotency, revision/baseline concurrency,
  coupon consistency, and compensating cleanup. Admin booking remains disabled.
- Pricing tiers/formulas, Option A, historical bookings/payments, Adult Group,
  Private, SlipOK, Ledger, Finance, attendance, payroll, and Head Coach grouping were
  not changed.

#### Source map and result

| File / function | Implemented result | Safety retained | Migration |
| --- | --- | --- | --- |
| `src/components/dashboard/booking-client.tsx` | Removed `x/y`, full/remaining-seat display and occupancy-based disabling; all course types fetch authoritative preview; Steps 4-5 render plain Thai selected-tier/coupon/zero-price evidence. | Draft fingerprint, stale-response guard, learner/session selection, server preview authority and final totals. | No |
| `src/lib/learner-display-name.ts` | New shared pure formatter: distinct trimmed nickname + full name, otherwise one available name; multi-learner join has no blank separator. | Does not invent profile nicknames; child and self/adult contracts remain distinct. | No |
| `src/app/api/bookings/availability/route.ts` + `src/lib/booking-slot-availability.ts` | Availability remains server-authoritative lifecycle/template/slot validation and returns non-blocking `activeOccupancy`; capacity/full/can-fit fields and requested-seat decisions are removed. | Auth/edit ownership, active template, exact date/time/end, canonical slot and cancelled-slot rejection. | No |
| `src/app/api/bookings/route.ts` + `src/lib/progressive-booking-write.ts` | Removed the obsolete capacity error contract; create/edit now fail closed unless the DB capability advertises `slotEntryPolicy=unlimited_learner_v1`. | Option A preview/revision/baseline, mutation replay, ownership, canonical slots and overlap checks. | Yes |
| `src/lib/pricing.ts`, `src/lib/booking-pricing.ts`, `src/lib/progressive-booking-pricing.ts`, `src/lib/progressive-booking-preview.ts`, `src/app/api/bookings/preview/route.ts` | Exact selected tier now crosses the server preview boundary as `{id,minSessions,maxSessions,pricePerSession,packagePrice,unit}`; one, bounded and open-ended ranges are formatted without client tier tables. | DB `pricing_tiers` authority; Legacy/Progressive/Adult/Private formulas and coupon order unchanged. | No |
| `src/app/api/reschedule/route.ts` | Remains capacity-free; duplicate guard now rejects any same-learner interval overlap rather than only exact times. | Verified/scheduled source, cutoff, same month, future active template, real slot, cleanup/log/notification behavior. | No |
| `src/app/api/lesson-wallet/route.ts` | Removed `current_students < max_students` and historical `full` blocking; cached occupancy updates are informational. | Entitlement, attendance/cutoff, same month, future template/slot, credit CAS, no-payment behavior, overlap and cancelled/lifecycle guards. | No |
| `src/app/api/admin/makeup/route.ts` | Capacity remains non-blocking; target creation now validates booking/course relationship, future active template, canonical slot and learner overlap and writes `schedule_slot_id`. | Admin authorization, absence/verified policy, next-month entitlement, audit and notifications. | No |

#### Additive migration Source

- Created exactly one new migration:
  `supabase/migrations/20260715060541_unlimited_normal_slot_entry.sql`.
- SHA-256:
  `130E1F7770ECB2F1D4C16CE19ED7CC8DFFD042F33D3602CCF6EC782BC0982BFD`.
- `CREATE OR REPLACE FUNCTION` keeps the existing signatures for
  `progressive_lock_booking_slots_v1(uuid,uuid,learner_type,uuid,uuid,jsonb,uuid,uuid[])`
  and `progressive_refresh_slot_capacity_v1(uuid[])`. The lock helper still resolves
  and locks canonical slots, rejects cancelled/invalid templates and learner time
  overlap, but no longer compares occupancy with `max_students`. Refresh still
  counts active learners into `current_students`, preserves cancelled slots, and
  normalizes touched non-cancelled slots to `open` without deriving `full`.
- `progressive_pricing_writes_capability_v1()` remains capability version `2`, keeps
  `legacyBaselineContract=immutable_scope_v1`, and adds
  `slotEntryPolicy=unlimited_learner_v1` so mismatched Source/DB fails closed.
- Fixed search paths and existing `SECURITY DEFINER` top-level create/update RPCs
  remain intact. Helper/capability execution is revoked from `PUBLIC`, `anon`, and
  `authenticated`; capability remains granted to `service_role`. There is no DML,
  table rewrite, historical backfill, tier change, or Production repair.
- Applied only through disposable local `supabase db reset`; not applied to remote or
  Production. A rollback to the previous helper definitions would restore the
  prohibited ceiling and therefore requires a coordinated Source/DB rollback, not
  a standalone function rollback.

#### Executable verification

- Full disposable migration-chain reset passed and proved capability version/policy,
  effective grants, and absence of the old capacity/full derivation in effective
  function definitions.
- `scripts/check-unlimited-slot-entry-runtime.sql` passed with transaction rollback:
  `6+1`, `20+1`, pending edit above the old ceiling, overlap against existing data,
  overlap inside one request, cancelled slot, invalid template, past/started target,
  informational occupancy, no partial write, and clean residue.
- Option A runtime rollback SQL passed cleanly; concurrent first booking produced
  exactly one winner and one `PROGRESSIVE_SCOPE_REVISION_CONFLICT` loser (`8/8`),
  one scope/receipt, the preserved baseline, correct `2,000` price, and no payment.
- Deterministic checks passed `265`; rewritten capacity tests retain `6`/`20` as
  regression triggers and now require learner `7`/`21` success rather than deleting
  the cases.
- Rendered Playwright Booking regression passed `9/9`: occupancy `6` and `20`, child
  and self name display, Reschedule `20+1`, Wallet `6+1`, Makeup above `20`, restored
  `4+4`/coupon calculation, stale preview, occupied restored draft, occupancy race,
  and actual `4+4 = 2,000` create. Disposable residue was `0`.
- `npx tsc --noEmit`, ESLint, `npm.cmd run check:mojibake`, production build, and
  post-build clean `.next` dev/E2E asset load passed. Final local checks returned
  `/ = 200`, generated `/_next/static/* = 200`, and unauthenticated Booking
  availability/preview/create APIs each `401`. Build/dev artifacts remain ignored,
  no fixture/backup residue is tracked, and the disposable stack was stopped with
  no backup volume retained.

#### Scope closeout and remaining gate

- Functional Source changed: **yes**. Commit/push: **yes**. Remote
  migration/deploy/environment/Entry/allowlist/Production read-write/UAT: **no**.
  Production data and financial state: **no change**.
- Production remains on Source
  `7d98b062f850a4210fae052cefddd92b994889b8`, deployment
  `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`, and therefore still exposes the superseded
  capacity behavior until separately approved commit/push, migration application,
  deploy, and UAT gates complete.
- Admin Schedules Performance remains
  **PARKING LOT — AUDITED; FIX NOT STARTED**; Homepage LV remains parked.
- Next Owner gate: fresh Production preflight, then approve coordinated Remote
  Migration + exact Deploy + Production UAT. Production writes remain unapproved.

### 2026-07-15 - Dashboard Booking Unlimited Slot Entry + Customer Price UX Audit (Historical / Superseded)

#### Owner decision and business reason

- Owner permanently removed fixed learner-capacity ceilings from normal teaching
  rounds. A round may contain more than `6`, `20`, or any configured count; the Head
  Coach divides learners into groups and assigns coaches after booking.
- Occupancy must not block or discourage any of five normal entry paths: new User
  booking, pending-payment booking edit, User reschedule, Lesson Wallet redemption,
  and Admin/User makeup or replacement-date target selection. Admin booking on
  behalf of users remains disabled.
- The decision addresses valid customers being blocked by `0/6`, full-slot UI, and
  `PROGRESSIVE_CAPACITY_EXCEEDED`. It does not change pricing tiers, Legacy or
  Progressive formulas, Option A, historical bookings, Adult Group, Private,
  payment, coupon, Ledger, Finance, attendance, payroll, or coach assignment rules.
- Customer learner headings must use distinct nickname plus full name, or full name
  once. Price explanations must use plain Thai and authoritative tier ranges without
  requiring Progressive, Legacy, baseline, scope, revision, ordered pricing, or
  true-up terminology.
- This round was read-only Source/DB audit plus documentation only. Functional
  Source/tests, migration Source/application, commit, push, deploy, environment,
  Entry/allowlist, Production data, booking/payment actions, and financial state did
  not change.

#### Effective Source dependency map

| File / function | Current behavior and policy conflict | Safety to preserve | Proposed future change | Migration |
| --- | --- | --- | --- | --- |
| `src/components/dashboard/booking-client.tsx` | Fetches availability, shows `x/y`/full/remaining-seat copy, disables full slots and confirmation, maps `PROGRESSIVE_CAPACITY_EXCEEDED`, and describes Kids Group as `4-6` learners. Learner names and pricing terminology vary by step. | Draft fingerprint/stale-preview protection, exact learner selection, start-time checks, authoritative preview, coupon/final totals. | Remove all customer capacity ceilings and disabling; use one learner-name formatter; render authoritative tier range and low-technical Thai explanation in Steps 4-5. | No |
| `src/app/api/bookings/availability/route.ts` + `src/lib/booking-slot-availability.ts` | Canonicalizes active templates/slots and active occupancy, then derives capacity, remaining, `full`, and `canFit`. Progressive UI treats those fields as blocking. | Authentication, edit ownership, active template/date/time/end matching, cancelled-slot detection, canonical slot id. | Keep as server-authoritative non-blocking slot validation and optional internal `activeOccupancy`; remove capacity/full/remaining/can-fit from customer decisions. | No |
| `POST/PUT src/app/api/bookings/route.ts` | Progressive create/edit maps the RPC capacity exception to HTTP `409`; Legacy create/edit has no capacity check. | Auth/ownership, learner ownership, active template and real slot resolution, future checks, price preview/revision/baseline, coupon and compensating cleanup. | Remove capacity error contract only; keep server authority. Add overlap and transaction regression coverage rather than weakening guards. | Yes for Progressive RPC |
| `src/lib/progressive-booking-write.ts` | Carries `PROGRESSIVE_CAPACITY_EXCEEDED` as a known typed RPC error; delegates atomic create/edit to DB. | Service-role boundary, mutation fingerprint/replay, expected revision and Option A baseline. | Remove obsolete capacity error mapping and require a capability contract that proves unlimited-slot policy. | Coordinated |
| `progressive_lock_booking_slots_v1(...)` | Locks canonical slot rows, prevents exact learner/date/time duplicates, then rejects when active occupancy plus requested learners exceeds `schedule_slots.max_students`. | Advisory/row locking, template/date/time/end resolution, cancelled-slot and duplicate guards. | `CREATE OR REPLACE` the same signature to remove only the capacity comparison/error. Preserve locks and safety checks; extend overlap protection separately. | Yes |
| `progressive_refresh_slot_capacity_v1(uuid[])` | Recomputes `current_students` and derives slot `status='full'` at `max_students`. | Accurate informational occupancy and cancelled status. | Keep `current_students` informational if still useful, but never derive a blocking `full` state from occupancy; cancelled remains non-entry. | Yes |
| effective `create_progressive_booking_v1(...)` / `update_progressive_pending_booking_v1(...)` | Atomic create/edit call the lock and refresh helpers, so both inherit the hard capacity ceiling. | Security-definer/service-role-only access, fixed search path, receipt idempotency, revision/baseline/pricing/coupon transaction. | Retain signatures if possible; dependency behavior changes through replaced helpers and a bumped policy capability. | Dependency only |
| Legacy create/edit in `src/app/api/bookings/route.ts` | Does not enforce capacity, but its shared slot resolver does not itself prove general overlapping-session prevention or a DB transaction. | Existing template, ownership, future, exact duplicate, price, rollback behavior. | Keep unlimited behavior; add overlap/atomicity tests and close proven safety gaps within approved Booking scope. | Unknown if later atomic RPC is chosen |
| `src/app/api/reschedule/route.ts` | Already ignores occupancy/capacity. It validates ownership, verified/scheduled source, cutoff, same month, future target, active template, real slot, and exact duplicate. Exact duplicates are blocked, but arbitrary time overlap and full DB atomicity are not proven. | All listed guards, notifications, audit and rollback cleanup. | Do not add capacity. Add overlap/idempotency/atomicity regression and hardening where evidence requires. | Unknown |
| `src/app/api/lesson-wallet/route.ts` | `ensureSlotHasCapacity` requires `status='open'` and `current_students < max_students`; redemption therefore blocks full targets and manually adjusts cached occupancy. | Verified entitlement, ownership, no attendance, 48-hour store cutoff, same month, future active template, real slot, duplicate prevention, credit CAS, no new payment, assignment cleanup. | Replace capacity check with cancelled/lifecycle/template validation; keep occupancy informational. Audit transaction boundary and overlapping-session prevention. | Unknown if later atomic RPC is chosen |
| `src/app/api/admin/makeup/route.ts` + makeup client | Target creation has no capacity ceiling, but the API does not currently prove active target template, future target, exact learner duplicate/overlap, real `schedule_slot_id`, booking/session relationship, idempotency, or atomicity. | Admin authorization, verified/absence review policy, next-month rule, attendance/entitlement audit and notifications. | Preserve unlimited entry and add the missing server-authoritative target-slot/safety contract before calling the path consistent. | Likely for atomic RPC; exact boundary needs implementation design |
| Tests/fixtures | Booking regression and availability checks intentionally assert `5/6`, `6/6`, full disabling and atomic capacity rejection; Lesson Wallet UAT asserts available target capacity. Schema fixtures seed `max_students=6`. | Executable template, duplicate, timing, pricing, coupon, draft, race and cleanup proof. | Rewrite behavior assertions rather than delete them: retain `6` fixtures as a regression trigger but require learner 7 and learner 21 to succeed. | No |

- Capacity occurrence classification:
  - **Hard business capacity limit to remove:** Booking capacity display/disable/error
    handling, availability capacity/full/can-fit decisions, Progressive lock rejection,
    refresh-derived `status='full'`, Lesson Wallet capacity/open-only guard, and tests
    whose pass condition is rejection at `6`.
  - **Informational occupancy only:** active occupancy counting and
    `schedule_slots.current_students`, if retained as a non-authoritative operational
    count that cannot affect entry, pricing, entitlement, payroll, or accounting.
  - **Duplicate learner/time protection to preserve and strengthen:** the current
    exact learner/date/start/end checks in Booking, Progressive RPC, Reschedule, and
    Wallet. General interval-overlap prevention is not proven and remains a required
    Source-fix safety item.
  - **Lifecycle/start-time/template protection to preserve:** active template and
    canonical slot matching, cancelled-slot rejection, future/not-started checks,
    same-month rules, ownership/status/payment requirements, and assignment cleanup.
  - **Stale/dead code:** no effective dead capacity guard was relied on. Hardcoded
    `6` in Booking marketing text conflicts with policy; `max_students=6` in schema
    defaults and fixtures may remain only as compatibility/regression evidence.
  - **Unknown / Need verification:** no separate customer User makeup target-entry
    API was found; the inspected target creation is the Admin makeup path. Whether
    Reschedule, Wallet, and Makeup should share one new atomic RPC is an
    implementation design decision, not established current behavior.

#### Effective migration audit

- Latest applied local/Production definition of
  `progressive_lock_booking_slots_v1(uuid,uuid,learner_type,uuid,uuid,jsonb,uuid,uuid[])`
  and `progressive_refresh_slot_capacity_v1(uuid[])` is migration
  `20260710170000_add_progressive_pricing_transactions.sql`. No later migration
  replaces these helpers.
- Effective create is the 11-argument
  `create_progressive_booking_v1(uuid,learner_type,uuid,uuid,uuid,jsonb,uuid,uuid,bigint,integer,text)`
  from `20260713210000_add_progressive_legacy_baseline_compatibility.sql`. Effective
  pending edit is
  `update_progressive_pending_booking_v1(uuid,uuid,uuid,jsonb,uuid,bigint)` from
  `20260710170000`; effective cancel is
  `cancel_progressive_pending_booking_v1(uuid,uuid,uuid,bigint)` from
  `20260710180000_add_progressive_coupon_lifecycle.sql`.
- Production read-only `pg_proc` and migration-order verification confirmed the lock
  helper still raises `PROGRESSIVE_CAPACITY_EXCEEDED`; create and pending edit call
  it. Only the lock/refresh helpers reference `schedule_slots.max_students` or
  `current_students` among effective Progressive public functions. No pricing,
  entitlement, payment, Ledger, Finance, attendance, payroll, or accounting RPC was
  found using capacity as an input.
- **Migration required: YES.** A new additive, non-destructive
  `CREATE OR REPLACE FUNCTION` migration must supersede the two effective helpers.
  No table rewrite, tier change, historical reprice, or Production data repair is
  currently indicated.
- Preserve `SET search_path = public, pg_temp`. Lock/refresh are invoker functions;
  create/update/cancel and capability remain `SECURITY DEFINER`. Preserve revokes
  from `PUBLIC`, `anon`, and `authenticated`, service-role-only execution, and the
  current top-level signatures unless a coordinated capability bump explicitly
  requires otherwise. Production ACL inspection confirmed only `postgres` and
  `service_role` can execute these functions.
- Add an explicit unlimited-slot policy field/version to
  `progressive_pricing_writes_capability_v1()` and update the server expectation in
  the same Source release so old DB behavior fails closed. Rolling back only the
  function would reintroduce the invalid capacity ceiling; rollback must be a
  coordinated Owner-approved Source/migration decision. Existing cached `full`
  rows need not be destructively rewritten if every entry path ignores occupancy
  state and touched rows are normalized by the new refresh behavior.

#### Learner names, pricing evidence, and customer copy

- `children.full_name` is required and `children.nickname` is nullable. `profiles`
  has `full_name` but no nickname field. No shared learner display formatter exists;
  Booking currently mixes full name, nickname-only, and `full_name (nickname)`.
- Smallest shared boundary is a pure `src/lib/learner-display-name.ts` formatter:
  distinct trimmed nickname/full name -> `{nickname} - {fullName}`; absent or
  whitespace nickname -> full name; equal normalized values -> full name once;
  blank full name with nickname -> nickname only; both blank -> neutral
  `ไม่ระบุชื่อผู้เรียน`. Self/adult uses profile full name only. Multi-child output
  maps the formatter per child and joins the resulting names without blank separators.

  | Case | Required output |
  | --- | --- |
  | nickname `น้องเมย์`, full name `เมย์ ใจดี` | `น้องเมย์ - เมย์ ใจดี` |
  | nickname absent or whitespace, full name `เมย์ ใจดี` | `เมย์ ใจดี` |
  | nickname equals full name `เมย์ ใจดี` | `เมย์ ใจดี` |
  | child learner | Apply the same rule to `children.nickname` + `children.full_name` |
  | self/adult learner | Trimmed `profiles.full_name` only; do not invent nickname |
  | children `น้องเมย์`/`เมย์ ใจดี` and no nickname/`มิน ใจดี` | `น้องเมย์ - เมย์ ใจดี, มิน ใจดี` |
- `pricing_tiers.min_sessions` is the inclusive lower bound,
  `max_sessions` the nullable inclusive upper bound, `price_per_session` the unit
  price, and `package_price` the package price. `max_sessions=null` is open-ended.
- Progressive preview already computes an authoritative nested `selectedTier`
  containing id/min/max, but Booking's client type/render discards that range and
  uses only the rate. Legacy preview returns totals without selected-tier evidence.
  The client separately receives tier rows and fallback defaults; that is not a safe
  substitute for the exact server-selected tier.
- Smallest safe preview contract adds top-level selected-tier evidence from the exact
  authoritative DB calculation for every applicable mode:
  `{id,minSessions,maxSessions,pricePerSession,packagePrice,unit}`. Render `N ครั้ง`
  for one-session, `N–M ครั้ง` for bounded, and `N ครั้งขึ้นไป` for open-ended.
  Adult Group and Private preserve their current formulas and render the exact
  package/session/hour evidence selected by the server. Coupon applies after gross;
  a zero final price still shows gross, discount, selected range, final `0`, and that
  no slip is required.
- Step 4 compact copy: `ช่วงราคา {range} • {rate} บาท/ครั้ง`. Step 5 title:
  `วิธีคิดราคาการจองครั้งนี้`, followed by `เดือนนี้มีรอบเรียนเดิม {previous} ครั้ง`,
  `ครั้งนี้เลือกเพิ่ม {new} ครั้ง`, `หลังจองจะรวมเป็น {after} ครั้ง`,
  `จำนวนรวม {after} ครั้ง อยู่ในช่วงราคา {range}`,
  `ราคาสำหรับการจองครั้งนี้ {rate} บาทต่อครั้ง`, and
  `ยอดชำระครั้งนี้: {new} × {rate} = {gross} บาท`.
- Progressive Kids Group additionally says
  `ยอดที่ชำระสำหรับรายการก่อนหน้าจะยังอยู่กับรายการเดิม และไม่ถูกหักจากการจองครั้งนี้`.
  Legacy Kids Group, if still customer-visible, uses the same neutral title and
  explains paid rounds, total rounds, authoritative range, total monthly amount,
  amount already paid, and this payment without naming Legacy or true-up.
- Coupon copy: `ราคาก่อนใช้คูปอง: {gross} บาท`,
  `ส่วนลดคูปอง {code}: {discount} บาท`,
  `ยอดชำระหลังหักส่วนลด: {final} บาท`. Zero copy:
  `ยอดชำระครั้งนี้: 0 บาท` and `ไม่ต้องแนบสลิปสำหรับรายการนี้`.
- One-session range copy is `ช่วงราคา 1 ครั้ง`; bounded range is
  `ช่วงราคา {min}–{max} ครั้ง`; open-ended range is
  `ช่วงราคา {min} ครั้งขึ้นไป`.
- Exact neutral Legacy explanation, if that mode is still customer-visible:
  `วิธีคิดราคาการจองครั้งนี้`, `เดือนนี้มีรอบที่ชำระแล้ว {old} ครั้ง`,
  `ครั้งนี้เลือกเพิ่ม {new} ครั้ง`, `หลังจองจะรวมเป็น {after} ครั้ง`,
  `จำนวนรวม {after} ครั้ง อยู่ในช่วงราคา {range}`,
  `ยอดรวมของเดือนตามช่วงราคานี้: {after} × {rate} = {target} บาท`,
  `หักยอดที่ชำระแล้วในเดือนนี้: {paid} บาท`, and
  `ยอดชำระครั้งนี้: {charge} บาท`.
- Exact Adult Group explanation:
  `วิธีคิดราคาการจองครั้งนี้`, `เลือกเรียน {n} ครั้ง`,
  `แพ็กเกจที่ใช้: {authoritativeRange}`, `ราคาแพ็กเกจ {package} บาท`,
  `เฉลี่ย {rate} บาทต่อครั้ง`, and `ยอดชำระครั้งนี้: {final} บาท`.
  Exact Private explanation uses the same lines with `{hours} ชั่วโมง` and
  `เฉลี่ย {rate} บาทต่อชั่วโมง`. Coupon and zero-price lines above append after the
  authoritative gross calculation without changing either formula.
- Current customer copy to replace includes `เรท Progressive`,
  `คำนวณราคา Progressive`,
  `สิทธิ์เดิมที่ใช้กำหนดเรท`, `การจอง Progressive ก่อนหน้า`, technical `เรท`,
  Legacy monthly target/deduction/credit wording, and capacity/full messages.

#### Proposed implementation split and executable test matrix

1. Customer Booking UI and authoritative preview contract: add shared learner-name
   formatting, return the selected DB tier evidence for all modes, replace Steps 4-5
   copy, and retain preview/draft/coupon authority.
2. User booking/edit: remove UI/API capacity decisions and obsolete typed error while
   preserving server template/slot/duplicate/timing/Option A/atomic write guards.
3. Reschedule and Lesson Wallet: remove Wallet capacity/status-full blocking and add
   shared overlap/lifecycle/idempotency/atomicity regression coverage; Reschedule
   remains unlimited and receives the same safety proof.
4. Makeup: add server-authoritative active template, future real-slot, learner
   duplicate/overlap, ownership relationship, idempotency and atomic write behavior
   without adding a capacity ceiling.
5. Database RPC Source: add the non-destructive helper replacements and coordinated
   capability contract. Do not apply remotely in the Source-fix round.
6. Rewrite rather than delete the existing full-slot tests. Required matrix:
   `0+1`, `6+1`, and `20+1` learners succeed; same learner exact/overlapping time
   remains blocked; started/past and inactive/nonexistent template remain blocked;
   new booking, pending edit, reschedule, Wallet redemption, and makeup target all
   succeed above old capacity; Progressive `4+1` shows `2–6`/`625`, `4+4` shows
   `7–10`/`500`; coupon gross/discount/final remains correct; restored draft
   recalculates; Adult Group and Private are unchanged; normal customer explanation
   contains no Progressive/Legacy; all learner-name cases pass. Also retain mutation
   replay, stale revision/baseline, race, rollback residue, payment/history,
   attendance, and coach-evidence regressions.
7. Commit/Push is a separate gate after local/disposable checks and Owner approval.
8. Deploy, migration application, Production no-write/write UAT, and any data action
   remain separate later approvals; this audit does not combine them.

#### Out of scope and remaining gate

- No Head Coach grouping redesign, Admin Schedules performance fix, Homepage LV copy,
  tier/formula change, historical reprice/repair, payment, SlipOK, coupon, Ledger,
  Finance, payroll, attendance, deployment, environment, or Production write belongs
  to this audit.
- No conflicting Owner capacity policy, destructive migration, pricing/payroll/
  accounting dependency, or required Production data repair was found. The effective
  RPC is identified confidently. The remaining gate is Owner approval for the
  audited functional Source Fix, additive migration Source, and Local Test scope
  only. Commit/push, remote migration, deploy, and Production UAT remain unapproved.

### 2026-07-12 - Kids Group Legacy vs Progressive Pricing

Purpose: preserve the detailed evidence behind the current
`PRODUCTION POLICY MISMATCH` classification. The prioritized current state and next
actions live in `PROJECT_STATE.md` and `TODO-CODEX.md`.

#### Formula and ordering

- Legacy source (`src/lib/pricing.ts`, `src/lib/booking-pricing.ts`):
  - DB `pricing_tiers` is authoritative; source constants are fallback only.
  - Existing pricing history includes settled `paid` and `verified` bookings only.
  - `totalAfter = existingSettledSessions + newSessions`.
  - `targetMonthlyTotal = totalAfter * rateOf(totalAfter)`.
  - `charge = max(0, targetMonthlyTotal - existingSettledTotal)`.
  - This is a retroactive monthly true-up. A negative raw charge is represented as
    `creditDifference`; prior rows are not automatically rewritten during booking.
- Owner-approved Progressive source (`src/lib/progressive-booking-pricing.ts`):
  - Active ordering includes non-expired `pending_payment`, `paid`, and `verified`;
    cancelled/expired rows are excluded.
  - Order is `created_at`, then booking id for a deterministic tie-break.
  - `cumulativeAfter = previousActiveSessions + newBookingEntitlementSessions`.
  - `grossBookingPrice = newBookingEntitlementSessions * rateOf(cumulativeAfter)`.
  - The current booking's coupon is deducted after gross pricing.
  - No retroactive monthly true-up, difference credit, or reprice of earlier bookings.

#### Owner examples / scenario matrix

| Scenario | Legacy true-up | Progressive booking-level |
| --- | ---: | ---: |
| One booking, 10 sessions | `5,000` | `5,000` |
| Split `5+5` | `3,125 + 1,875 = 5,000` | `3,125 + 2,500 = 5,625` |
| Ten settled one-session bookings | `5,000` after true-up/credit effects | `5,825` |
| Split `8+8` | `4,000 + 2,496 = 6,496` | `4,000 + 3,248 = 7,248` |

Evidence: `scripts/check-pricing-true-up.js`,
`scripts/check-progressive-booking-pricing.js`, Progressive transaction tests, and
the Owner's 2026-07-12 documentation-reconciliation instruction. The separately
named “Formula And Ordering / Scenario Matrix” design document was not found in the
repo: `Unknown / Need verification`.

#### Source, commits, and releases

- Legacy monthly true-up source commit `5897cede58f720c1b5f205af53c9821cff0a39bf`
  was recorded deployed as `dpl_5e6i8M3Mtzy5xNah6xVD9v6PtHwQ`.
- Legacy settled-only follow-up/source repair commit
  `1701a0474ae1fdcf742f6db4c3e3c8c26d39ec2b` excluded `pending_payment` from
  settled history and was recorded in deployment `dpl_2FKH4GbJ1wa3fSn4xnsxehW6pRdB`.
- Progressive pricing foundation was added by `ed1d20d`; transaction support by
  `46ab89b`; coupon/payment layers followed in later commits.
- Progressive Normal Booking Entry commit
  `56daabf30ad60c07b3c3ccb98fe42028e33de1be` is pushed to
  `origin/spike/next-major-security-upgrade` and passed local/disposable runtime
  verification. It was not included in the last confirmed Production release.
- Last confirmed Production source is shared SlipOK corrective commit
  `0fbf98fe7a03f71ecb61642ebb20458e4a6480de`, deployment
  `dpl_P5BQcazfbWjReuuLkGXkZpGoG1Gz`, with Progressive entry flags/allowlist unset.
- Current live deployment/SHA/env state on 2026-07-12 is
  `Unknown / Need verification`: Vercel read-only inspection failed with scope 403.

#### Production repairs made under Legacy true-up

- `ff0728dd-066a-417a-aeaa-0049fed6b931`: `3,248 -> 2,496`; paired first booking
  remained `4,000`; no payment/coupon rows; sessions unchanged. Under Progressive
  `8+8`, the second booking would remain `3,248`, so this repair differs by `752`.
- Four July rows were repaired with payment evidence preserved, no payment/refund/
  coupon rows created, and sessions/tiers untouched:
  - `5d1d9a43-afcd-4d26-8817-68ab948443f2`: `2,800 -> 1,169`.
  - `3f95767e-8418-4b0b-b87d-2cd18811825b`: `14,700 -> 13,600`.
  - `f565a552-65f3-44e0-8826-22a4c9cb0dbb`: `1,299 -> 763`.
  - `ff9cf27f-6415-444d-90b6-89ab05fc2d47`: `2,000 -> 1,500`.
  - Progressive impact for each is `Unknown / Need verification` until ordered
    entitlement/tier/coupon snapshots are reconstructed read-only.
- Two pending rows were corrected from settled history `8 / 4,000`, plus one new
  session at rate `500`: `9112a5cb-006c-4fdd-838d-5534c15b6fb1` `0 -> 500` and
  `60779d60-ac26-4eaf-a34f-703157a32300` `196 -> 500`. Payments, coupons, wallet,
  and attendance were zero; sessions were unchanged. This documented `8+1` case is
  also `500` under current Progressive tiers.
- These are historical repair facts. Current row status and later dependencies are
  `Unknown / Need verification`; no further write is authorized from this record.

#### Documentation drift found and corrected

- `PROJECT_STATE.md` was a long chronological log without a prioritized distinction
  between Owner policy, Legacy behavior, Progressive source, and deployed runtime.
- `TODO-CODEX.md` treated Homepage LV copy as the next task while the pricing policy
  mismatch remained open, and repeated extensive completed history.
- Earlier scoped `PASS` labels could be read as end-to-end policy/runtime agreement.
  They now remain historical scope results only and are superseded for current
  reconciliation by the top-level mismatch classification.
- Legacy monthly true-up examples and Progressive booking-level examples are now
  explicitly separated; no formula is silently treated as the other.

#### Final audit result and pending Owner decision

- Progressive implementation matches the supplied Owner formula and scenarios.
- Superseded by the Owner decision and read-only audit record below.

### 2026-07-12 - Progressive General Rollout Decision and Unpaid-Only Boundary

#### Owner decision

- Progressive replaces Legacy for general Kids Group Production traffic.
- Exact formula:
  `grossBookingPrice = newBookingSessions * rateOf(previousActiveSessions + newBookingSessions)`.
- There is no retroactive monthly true-up, price-difference credit, or automatic
  rewrite of earlier bookings.
- Historical review is limited to genuinely unpaid Kids Group bookings. Paid,
  approved-payment, or verified bookings are excluded from repricing in this round.
- Adult Group and Private pricing are unchanged.
- Deploy, environment/feature controls, allowlist changes, Production UAT writes,
  and Production data repair were not approved.

#### Read-only deployment result and documentation drift

- `DOCUMENTATION DRIFT`: Vercel CLI verification found the current Ready Production
  deployment is `dpl_AG8zaB1Wexi5hCKuh5jeDQzfabuW` at source
  `56daabf30ad60c07b3c3ccb98fe42028e33de1be`, not the previously documented
  `0fbf98f` release.
- Public/project aliases are attached to that deployment. All five Progressive
  control variable names and `PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS` are absent from
  Production. No values, secrets, or UUIDs were exposed.
- Deployed = yes; Enabled = no; Allowlisted = no; Production active = no;
  Production UAT = not performed. No Vercel state changed.

#### Read-only unpaid-booking result

- Query scope: all `454` Production Kids Group bookings across 2026-05 through
  2026-08. Counts: `415 verified`, `33 cancelled`, `6 pending_payment`, `0 paid`.
- Each pending row was checked against payment rows/statuses, coupon usages and
  Progressive reservations, lesson wallet credits, sessions and attendance,
  Progressive payment batches/allocations, finance ledger allocations, current
  pricing tiers, and deterministic active booking order.
- All six pending rows are genuinely unpaid and have no checked downstream
  dependency rows. Five match Progressive price. One proposed repair candidate is
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40`: ordered second after one verified
  one-session booking, so `previousActiveSessions = 1`, `newBookingSessions = 1`,
  `rateOf(2) = 625`, expected `625` versus stored Legacy `550`, difference `75`.
- Candidate totals are Legacy `12,800` versus Progressive `12,875`.
- All `415` verified rows have direct approved payment evidence and are excluded;
  no paid or verified row was reopened or repriced.

#### Separate proposed scopes — not performed

- Deploy scope: select and approve a general-traffic gating design because current
  source still requires UUID allowlisting; then separately approve deploy, exact
  Production controls, activation order, controlled UAT, monitoring, and rollback.
- Data-repair scope: after separate Owner approval and a fresh dependency recheck,
  update only `d6dad7aa...` from `550` to `625`. Do not modify the five matching
  candidates or any payment, coupon, wallet, refund, entitlement, session,
  attendance, payroll, or accounting row.
- Current classification is
  **OWNER DECISION CONFIRMED — READ-ONLY DEPLOYMENT AND UNPAID-BOOKING AUDIT REQUIRED**,
  not `PASS`. Superseded for current source status by the 2026-07-13 record below.

### 2026-07-13 - General Kids Group Gating Source

#### Root cause and approved contract

- Deployed source `56daabf` required both `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`
  and membership in `PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS`. That was appropriate
  for the earlier staged rollout but did not implement the Owner-approved general
  Kids Group policy.
- Owner approved general `kids_group` selection from the server-resolved course type
  plus the Entry control, without per-user UUID membership. `adult_group` and
  `private` remain Legacy.
- Pricing-write, coupon-lifecycle, and payment-batch dependencies remain mandatory.
  Once Progressive is selected, any missing dependency returns typed `503` with no
  Legacy fallback or partial write.

#### Implementation

- Source commit `5c8cee1e8a81f928b870e643a78e1d2baf39fa06` is committed and pushed to
  `origin/spike/next-major-security-upgrade`.
- Preview and create now call the server-only decision with the DB course type;
  client mode, user, and price fields remain non-authoritative.
- Stored `pricing_scope_id` continues to select Progressive edit/cancel regardless
  of the current Entry flag.
- Payment prepare/upload/submit/status/cancel and History payment eligibility now
  use authenticated ownership plus dependency readiness, not Entry or UUID
  membership. This preserves draining existing Progressive bookings after Entry is
  disabled.
- UUID allowlist parsing was retained as staged/test infrastructure. It is no longer
  general eligibility and was never a substitute for route authentication or batch
  ownership checks.
- No migration, pricing formula/tier, Legacy, Adult Group, Private, SlipOK, payment,
  coupon, wallet, attendance, entitlement, refund, payroll, or accounting behavior
  was otherwise changed.

#### Verification and state separation

- Passed: booking entry `23`, Progressive pricing `17`, transactions `33`, coupon
  lifecycle `38`, payment batches `39`, payment integration `18`, shared SlipOK `6`,
  Legacy pricing regression `14`, TypeScript, ESLint, mojibake, and Production build.
- Post-build protocol passed: this repo's `.next` was removed, dev restarted on
  `127.0.0.1:3000`, home/static assets returned `200`, browser content rendered,
  captured console errors were empty, and no Next error overlay was present.
- Source complete: yes. Committed: yes. Pushed: yes.
- Deployed for `5c8cee1`: no. Enabled: no. Production active: no. Production UAT:
  not performed. Production data repaired: no.
- Production remains deployment `dpl_AG8zaB1Wexi5hCKuh5jeDQzfabuW` at older source
  `56daabf30ad60c07b3c3ccb98fe42028e33de1be`, with Progressive controls absent.
- Owner separately approved the later unpaid repair
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40`, `550 -> 625`. It was not performed and
  remains a separate write round requiring a fresh pre-write dependency check.
- Current classification:
  **PASS — GENERAL KIDS GROUP GATING SOURCE ONLY; DEPLOY/ACTIVATION/UAT AND ONE-ROW REPAIR PENDING**.

### 2026-07-13 - Owner-Approved Progressive Unpaid Booking Repair

#### Policy and pre-write proof

- Owner explicitly approved exactly booking
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40`, `bookings.total_price 550 -> 625`, using
  `newBookingSessions * rateOf(previousActiveSessions + newBookingSessions)`.
- Fresh Production audit found exactly one target row: `kids_group`,
  `pending_payment`, one child entitlement/session, one `scheduled` session, and
  unchanged `updated_at` from creation.
- Deterministic active order remained one earlier verified one-session booking
  `119752e0...` followed by the target. Therefore `previousActiveSessions = 1`,
  `newBookingSessions = 1`, `cumulativeAfter = 2`, current tier `625`, expected
  booking price `625`.
- Pre-write dependency counts were all zero: payments/payment evidence, coupon
  usages/reservations, lesson wallet, attendance, Progressive batch links,
  allocations, finance ledger, and refund/credit/accounting relations.
- Only the original `create_booking` activity existed. The target had no later edit,
  cancellation, payment, verification, or manual correction evidence.

#### Atomic write

- One linked-Production SQL transaction locked the target booking, target session,
  active booking order, and pricing-tier rows; rechecked all safety predicates; and
  required the exact id, `pending_payment`, `550`, and pre-write `updated_at`.
- Exactly one booking row changed to `625`. Only normal `updated_at` changed beside
  `total_price`; status, learner, branch, course, month/year, entitlement fields,
  pricing-scope fields, and all sessions were preserved.
- The same transaction inserted exactly one activity log:
  `98359d52-4da1-4ef2-bc75-a9b3a29db830`, action
  `owner_progressive_unpaid_booking_repair`.
- Activity details record Owner approval, `550 -> 625`, difference `75`, formula,
  `1 + 1 -> 2`, tier `625`, preserved pending status, zero dependencies, gating
  source `5c8cee1`, Production deployment `dpl_AG8za...`/source `56daabf`, and that
  no deploy or feature activation occurred.

#### Post-write reconciliation and impact

- Independent read-only audit confirmed target `625`, `pending_payment`, the same
  one scheduled session/order, dependency counts still zero, and exactly one repair
  activity log.
- Transaction fingerprints confirmed the other five matching unpaid candidates,
  every paid/verified booking, all target sessions, and all pricing tiers unchanged.
- July Progressive shadow reconciliation now reports `4/4` pending bookings
  `MATCH`, underpriced count `0`, underpriced amount `0`, and no missing tier.
- Customer impact: the genuinely unpaid amount due increased by `75`; no payment,
  refund, credit, wallet, attendance, entitlement, payroll, or accounting entry was
  created or changed.
- Financial impact: booking receivable/net value increased by `75`; cash received,
  payment ledger, and accounting allocations remain unchanged.
- Rollback recorded but not executed: `625 -> 550` only if a fresh audit proves no
  payment, coupon, wallet, attendance, refund, credit, entitlement, or accounting
  dependency occurred after repair. Otherwise stop and re-plan with Owner approval.
- Source complete/committed/pushed: yes (`5c8cee1`). New source deployed: no.
  Progressive enabled: no. Production active: no. Production UAT: not performed.
  One-row data repaired: yes.
- Current classification:
  **PASS — ONE UNPAID PRODUCTION BOOKING REPAIRED; DEPLOY/ACTIVATION/UAT PENDING**.

### 2026-07-13 - Progressive General-Traffic Rollout and Safe Entry Rollback

- Owner approved deploy/activation/UAT for exact source `5c8cee1`. Pre-deploy Git,
  Vercel, migration capabilities, Production counts, ledger, and logs matched the
  documented baseline. All required source checks and Production build passed; the
  payment-integration test required LF normalization because its literal LF match
  is a Windows CRLF false negative.
- Gate 2 deployed Entry-off source as `dpl_9q684Kgc...`; authenticated Owner test
  preview remained Legacy. Gate 3 enabled pricing-write, coupon-lifecycle,
  payment-batch, and payment-review controls and deployed `dpl_7cpBHQY...`; Entry
  and allowlist remained absent and DB counts were unchanged.
- Gate 4 enabled Entry and deployed `dpl_223P3mh...`, Ready at exact SHA `5c8cee1`.
  Stage A passed: Kids Group entered the Progressive path, Adult Group and Private
  remained Legacy, unauthenticated preview returned `401`, and no preview write
  occurred.
- Stage B used the documented Owner test profile and `TEST System` learner. It
  created exactly booking `89533cdf-76cf-4ee5-bb66-ce7bf7bbf5fe` (`700`, one
  session, `pending_payment`), scope `f4acca6c-86b9-44da-88cc-86d8222f28c3`, and
  session `34ad024d-59f3-409d-b431-36e2765f9737`. Pricing snapshots prove sequence
  `1`, cumulative `0 -> 1`, rate/gross/final `700`, coupon `0`.
- Payment prepare created batch `eb5a1c73-fceb-4fd1-b6e6-414fc3fe1410`, amount
  `700`, status `prepared`, one active member. Chrome blocked local file attachment
  because the ChatGPT extension lacks file-URL access. No slip path/hash, submit,
  verification attempt, allocation, payment, coupon, or ledger row exists.
- Primary rollback executed immediately: Entry `false`, four dependency controls
  remain `true`, allowlist absent, shared `SLIPOK_TEST_MODE=true`. Current Ready
  deployment is `dpl_F2gfntqNX8ZiR5yr5dPB6UdeX8Fe`, exact SHA `5c8cee1`, with all
  Production aliases. No source/data deletion or hard source rollback occurred.
- Monitoring found no final-deployment error logs, no duplicate ledger source, and
  no Progressive allocation. Legacy payments/ledger remain `465`; repaired booking
  `d6dad7aa...` remains `625` and `pending_payment`.
- Current classification:
  **BLOCKER — ENTRY DISABLED; PROGRESSIVE ROLLOUT ROLLED BACK SAFELY**.
- Resume only after Chrome file-URL access is enabled. Drain the existing UAT
  booking/batch if valid; do not create a second booking. After full payment,
  Admin/Finance/notification reconciliation passes, re-enable Entry last and repeat
  bounded monitoring.

#### 2026-07-13 - Existing UAT Payment Completed; Entry Remains Disabled

- Owner confirmed Chrome file-URL access and authorized continuation on only booking
  `89533cdf-76cf-4ee5-bb66-ce7bf7bbf5fe`. Pre-continuation read-only verification
  matched deployment `dpl_F2gfntqNX8ZiR5yr5dPB6UdeX8Fe`, exact source `5c8cee1`,
  four dependency controls `true`, Entry `false`, allowlist absent, and shared
  `SLIPOK_TEST_MODE=true`.
- Original prepared batch `eb5a1c73-fceb-4fd1-b6e6-414fc3fe1410` expired normally.
  The product's lazy-expiry path cancelled it with `prepared_expired` and released
  its scope lock. One stale client revision attempt failed closed and created no
  batch; after refreshing authoritative scope revision, exactly one replacement
  batch `d65dc3b8-5a48-4b4a-bea5-b64f2a1133ac` was prepared for the same booking.
- The real User History flow attached the harmless repository favicon PNG, uploaded
  it to the private Progressive bucket, and submitted it. Shared Test Mode created
  no live SlipOK request and resolved verification attempt
  `7da5e1dd-1c5d-436a-8c62-a1f06b67d51c` as `approved`, amount `700`, result
  `TEST_APPROVED`. The replacement batch is approved and the booking is `verified`.
- Allocation `7ec8d0e1-a3fa-4e27-9c6e-5e6779c50e9d` is the only allocation and is
  `700`. `payment_ledger_allocations_v1` contains one Progressive source for the
  replacement batch and booking, also `700`; no legacy `payments` row exists.
  Pricing snapshots, one scheduled session, and total `700` are unchanged; coupon
  reservations/usages remain zero and the pricing scope is unlocked at revision `3`.
- User History shows one successful booking card with no stale upload state. User
  notification `e62d9e2f-f49f-49f1-a138-9ee427655d14` exists once and is visible.
  Finance reconciliation is cash `+700`, booking net `700`, allocation `700`, and
  one distinct Progressive transaction with no batch-header double count.
- The required Admin notification gate failed. No Admin-recipient payment
  notification was created; the approval RPC inserts only the user notification.
  The other two notifications in the count delta were unrelated coach attendance
  reminders. The Chrome session also lacked verified Standard Admin and Super Admin
  identities, so the required role-specific Production UI checks could not be
  completed. Source inspection shows Admin Payments conditionally includes amount
  only when `role === 'super_admin'`, but that is not a substitute for the requested
  Production role UAT.
- Counts changed only as expected for this continuation: bookings `514 -> 514`,
  scopes `2 -> 2`, batches `3 -> 4`, attempts `0 -> 1`, allocations `0 -> 1`,
  legacy payments `465 -> 465`, coupon reservations/usages `0 -> 0`, ledger
  `465 -> 466`, notifications `15889 -> 15892`. Existing repaired booking
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40` remains `625`, `pending_payment`.
- Safety gate applied before activation: Entry remains `false`; no environment
  change, redeploy, rollback repetition, second booking, cleanup, migration, source
  change, pricing-tier change, coupon change, or additional repair occurred.
- Current classification:
  **BLOCKER — ENTRY DISABLED; PROGRESSIVE ROLLOUT ROLLED BACK SAFELY**.
- Next work requires separate Owner approval for a narrowly scoped Admin-notification
  source correction and deployment, plus verified Standard Admin and Super Admin
  identities for read-only role UAT. Do not repeat this payment or create another
  Production UAT booking.

### 2026-07-13 - Progressive Admin Payment Notification Source Fix

#### Root cause and implementation

- Production UAT proved booking `89533cdf-76cf-4ee5-bb66-ce7bf7bbf5fe` and batch
  `d65dc3b8-5a48-4b4a-bea5-b64f2a1133ac` approved correctly for `700`, but only
  user notification `e62d9e2f-f49f-49f1-a138-9ee427655d14` was created.
- Source audit proved `approve_progressive_payment_batch_v1` owns booking
  verification, coupon consumption, allocations, batch approval, scope unlock,
  activity log, and the user notification in one transaction. It inserted only for
  `v_batch.user_id`; neither the submit route nor another helper notified staff.
- Route-level notification was not used because it would execute after the atomic
  approval and the shared `notifyUserOnce` helper is a non-atomic check-then-insert.
  A route failure or concurrent retry could therefore leave missing or duplicate
  notifications while payment had already committed.
- Commit `60688a340d473b2bb64f0bee9b1e68cb8cf47c1a` adds migration
  `20260713153000_notify_staff_on_progressive_payment_approval.sql`. It replaces
  only the approval RPC, preserves its payment/booking/allocation/coupon/activity
  semantics and existing user notification, and adds an amount-free operational
  notification linked to `/admin/payments` for every extant profile whose role is
  `admin` or `super_admin`. Profiles have no separate active flag.
- The staff copy contains no batch total, booking total, allocation, revenue, or
  other restricted amount. Admin and Super Admin receive the same operational copy;
  no financial visibility contract was broadened.
- Idempotency remains the approval transaction contract: the batch advisory/row
  locks serialize approval and an already-approved replay returns before either
  notification insert. Prepared, expired/cancelled, rejected, under-review, and
  failed-verification states create no success notification unless a submitted or
  under-review batch actually completes the successful approval transition.

#### Verification and state separation

- Passed deterministic checks: notification `16`, payment batches `39`, payment
  integration/Finance/redaction `18`, booking entry `23`, Progressive pricing `17`,
  Progressive transactions `33`, coupon lifecycle `38`, shared SlipOK `6`, and
  Legacy pricing/payment `14`.
- Passed `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`,
  `npm.cmd run build`, and `git diff --check`. After build, `.next` was removed,
  dev restarted on `127.0.0.1:3000`, and `/` plus
  `/_next/static/chunks/webpack.js` returned `200`.
- Source complete: yes. Committed: yes (`60688a3`). Pushed: yes after synchronized
  documentation closeout. Migration added: yes. Migration applied remotely: no.
- Deployed: no. Entry: `false`. Allowlist: absent. Production active: no.
  Production data changed: no. Existing UAT payment was not repeated and no second
  booking or direct notification repair was performed.
- Owner confirms a verified Super Admin Chrome session is ready for later read-only
  Production UAT. Standard Admin identity remains `Unknown / Need verification`.
- Remaining gate: separate Owner approval to apply exactly the new migration and
  deploy the exact source, then read-only Super Admin and verified Standard Admin
  UAT. Entry activation remains a later, separate final gate.
- Source-only classification:
  **PASS — ADMIN PAYMENT NOTIFICATION SOURCE FIX ONLY; DEPLOY/UAT/ENTRY ACTIVATION PENDING**.

### 2026-07-13 - Notification Migration, Exact Deploy, and Read-Only Admin UAT

- Gate 0 passed: local/remote branch HEAD matched documentation commit
  `f5b22a9a3e7e27c16d3a20cd3788a4f3af4b26b5`; source commit `60688a3` is its
  ancestor; only the pre-existing `AGENTS.md` change was dirty. Exactly migration
  `20260713153000` was pending. Migration file SHA-256 was
  `B7C9A44BED917BFFDBD7CAFD12D0C58928CDED97AE46A5897A6D79BCC5D8D778`.
- Prior approval function hash was `2b4ee8a5a7243a54747f3a2632aeb005`, with one
  service-role-only signature, the user insert present, and no staff-role selection.
- Gate 1 applied exactly `20260713153000`. Post-apply function hash is
  `424b3939e86b615b8ded01f0e8038105`; signature/grants remain correct, both user and
  staff inserts are present, staff selection is only `admin`/`super_admin`, staff
  copy links to `/admin/payments` and contains no restricted amount token, and the
  approved replay return precedes both inserts.
- Migration application created no notification/backfill or business data change.
  Baseline and final counts remained: notifications `15931`, bookings `517`, scopes
  `2`, batches `4`, attempts `1`, allocations `1`, legacy payments `467`, ledger
  `468`, coupon reservations/usages `0`. Protected UAT and repaired-booking hashes
  were unchanged; duplicate allocation and Progressive ledger-source counts were
  `0`.
- Gate 2 deployed from a clean detached worktree at exact commit `f5b22a9`, which
  contains source `60688a3`. Vercel linking initially added a local `.env*` ignore
  line, so that first artifact `dpl_9kFSKGs...` was not accepted for UAT. The line
  was removed and the final clean deployment is
  `dpl_3tW1GQdxJGrfjo3XU35wwKLCxuWe`, Ready with all four Production aliases.
- Vercel API did not populate Git SHA metadata for the CLI deployment; exact commit
  evidence is the clean detached worktree HEAD/status and upload source scope.
  Home/static assets returned `200`, protected Admin routes preserved login guards,
  unauthenticated preview returned `401`, and monitoring found no error, 5xx, or
  SlipOK runtime log.
- Production controls remained pricing-write/coupon-lifecycle/payment-batch/
  payment-review `true`, Entry `false`, allowlist absent, and shared
  `SLIPOK_TEST_MODE=true`. No environment value changed in this round.
- Super Admin read-only UAT passed. `/admin/payments` showed the approved Progressive
  UAT batch once with amount `700`, approved state, one booking, exact batch/booking
  ids, Progressive method, and permitted details. `/admin/notifications` loaded the
  recipient-specific Super Admin inbox. No historical staff notification appeared,
  as required, and Chrome console/React/hydration errors were empty.
- Standard Admin UAT: `NEED REVIEW — STANDARD ADMIN IDENTITY NOT AVAILABLE`.
  Source tests still prove amount redaction, but no account was created, changed, or
  repurposed to substitute for Production role UAT.
- Entry-off Kids Group pricing remained Legacy by policy/control. Record:
  **PASS — ENTRY-OFF LEGACY BASELINE CONFIRMED**. The Owner-observed `4` prior + `4`
  new session draft result `1,500` was not repeated because the only verified
  browser identity was Super Admin; no booking confirmation occurred. Adult Group
  and Private remain Legacy by the unchanged entry contract, and the
  unauthenticated preview guard passed.
- Customer impact: none in this round; general Kids Group remains Legacy while Entry
  is off. Financial/data impact: none; no booking, payment, notification, allocation,
  ledger, Finance, coupon, wallet, attendance, entitlement, refund, payroll, or
  accounting row changed. Rollback was not performed.
- Source complete/committed/pushed/deployed: yes. Migration remotely applied: yes.
  Entry enabled/Production active: no. Production UAT: partial because Standard
  Admin remains unavailable. Task Done: no; separate Standard Admin UAT and Owner
  Entry activation decision remain.
- Classification:
  **NEED REVIEW — SOURCE DEPLOYED AND ENTRY DISABLED; STANDARD ADMIN UAT PENDING**.

### 2026-07-13 - Standard Admin Read-Only Production UAT Closeout

- Owner authorized read-only inspection and documentation closeout only. No deploy,
  environment change, Entry activation, booking/payment replay, notification
  insertion, role change, account creation, or Production repair was performed.
- Pre-UAT state matched the release record: deployment
  `dpl_3tW1GQdxJGrfjo3XU35wwKLCxuWe` was Ready on all four Production aliases from
  clean commit `f5b22a9`, containing notification source `60688a3`; migration
  `20260713153000` was applied. Pricing-write, coupon-lifecycle, payment-batch, and
  payment-review controls were `true`; Entry was `false`; allowlist was absent; and
  shared `SLIPOK_TEST_MODE=true` remained unchanged.
- The authenticated Chrome identity was proved from its visible profile name plus a
  unique read-only Production profile match: role exactly `admin`, with zero matching
  `super_admin` profiles. No role or account was changed to prepare the session.
- `/admin` loaded as Standard Admin without monthly/aggregate revenue, baht totals,
  Finance summary, or Super Admin identity/content. `/admin/payments` showed approved
  Progressive batch `d65dc3b8...` and booking `89533cdf...` exactly once with payer,
  learner, course, branch, date/session, identifiers, status, slip, and permitted
  operational detail.
- Standard Admin financial redaction passed in both rendered UI and the technically
  inspectable server payload: no structured payment amount, Progressive batch total,
  booking total price, allocation amount, approved/incomplete total, aggregate
  revenue, or Finance field was delivered. Target value `700` was not exposed as a
  structured value. The server source selects amount fields only for `super_admin`.
- `/admin/notifications` loaded the recipient-specific Standard Admin inbox with no
  Super Admin financial summary. No historical Progressive staff copy exists, as
  required by the future-event-only/no-backfill migration. Existing historical
  Legacy/booking notification messages may contain free-text amounts under their
  pre-existing contract; this is not a structured Progressive field. Future
  Progressive staff copy remains amount-free, targets `admin` and `super_admin`,
  and links to `/admin/payments`.
- Direct `/admin/finance` and `/admin/settings` checks redirected to `/admin` and
  exposed no restricted data. No user navigation or click opened `/admin/coupons`,
  although Vercel logs recorded automatic Next.js menu-link prefetch requests.
  Read-only follow-up proved the two current coupons have no expiry or usage cap,
  zero usages, and zero auto-close candidates, so the render-time guarded update
  could not run and coupon data remained unchanged. No write action was clicked.
  Browser console warnings/errors, React/hydration errors, and observed network 5xx
  were `0`.
- Bounded Vercel monitoring sampled `100` UAT-window requests, all from
  `dpl_3tW1GQdx...`: error-level events `0`, 5xx `0`; target Admin pages returned
  `200`, and Settings returned the expected `307` guard redirect.
- Before/after Production counts were unchanged: bookings `519`, pricing scopes `2`,
  batches `4`, attempts `1`, allocations `1`, legacy payments `469`, ledger rows
  `470`, coupon reservations/usages `0`, and notifications `15978`. Protected
  fingerprints remained UAT booking `b3ace1823603773273d19783fecfa9f4`, approved
  batch `dbcdcb47fde7f6b59d0244bf90b6b7f6`, and repaired booking
  `e99a8144b0c0af731aad4d4ae3c81025`. No row changed and no historical staff
  notification was backfilled.
- Source complete/committed/pushed/deployed: yes through the existing release.
  Migration applied: yes. Dependencies enabled: yes. Entry enabled/Production
  active: no. Super Admin and Standard Admin read-only UAT: passed. Customer,
  financial, and Production data impact in this round: none. Task Done: no, because
  general Kids Group remains Legacy until a separate Owner Entry-activation decision.
- Classification:
  **PASS — STANDARD ADMIN READ-ONLY UAT VERIFIED; ENTRY ACTIVATION OWNER DECISION PENDING**.

### 2026-07-13 - Final Entry Activation Attempt and Safe Rollback

- Owner approved changing only `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`, preserving
  the four Progressive dependencies as `true`, UUID allowlist absent, and shared
  `SLIPOK_TEST_MODE=true`; redeploying the exact approved source; performing only
  no-write routing/pricing UAT; and immediately using the primary Entry-off rollback
  if any required proof gate failed. No source change, migration, Booking, Payment,
  historical repricing, or other Production data write was approved.
- Gate 0 matched the documented state: `dpl_3tW1GQdxJGrfjo3XU35wwKLCxuWe`
  Ready on all four aliases from clean commit
  `f5b22a9a3e7e27c16d3a20cd3788a4f3af4b26b5`, containing general gating source
  `5c8cee1` and notification source `60688a3`; migration `20260713153000` applied;
  four dependencies `true`; Entry `false`; allowlist absent; shared Test Mode
  `true`; local/remote documentation HEAD `bbadb64`; only the unrelated unstaged
  `AGENTS.md` change present.
- Entry was set to `true` and the exact source was deployed from a clean detached
  `f5b22a9` worktree as `dpl_HBTap8Rv72uDN1NFHSg3CyR6GqZp`. It reached Ready and
  all four Production aliases pointed to it. The deployed functional tree remained
  unchanged; Vercel CLI metadata did not supply `gitSource.sha`, so the pinned clean
  worktree and uploaded source scope remain the exact-source evidence.
- Adult Group and Private authenticated previews each returned `200` and remained
  Legacy under the inspected server-only course routing contract. They showed one
  session at `600` and `900` respectively. No confirmation button was clicked.
  Unauthenticated booking preview returned the expected `401`.
- The authenticated Standard Admin identity had no child learner. The Kids Group
  learner step showed no child data and disabled continuation. Proceeding would have
  required the prohibited creation or repurposing of Production data. The original
  Owner-controlled User/Parent context and its `4` previous + `4` new safe draft were
  not available, so the required runtime proof of Progressive routing and exact
  `4 * 500 = 2,000` preview could not be completed. No `1,500` or `2,000` preview
  result was manufactured. The browser identity later changed externally to a
  Super Admin session, confirming it was not a stable substitute for that context.
- This inability to prove Entry-on Kids Group routing met the mandatory Safety Gate.
  The approved primary rollback set Entry to `false`, retained all four dependencies
  `true`, retained allowlist absent and shared Test Mode `true`, and redeployed the
  exact same source as `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G`. The final deployment is
  Ready and owns all four aliases. Entry is now a Vercel Sensitive/write-only value;
  plaintext readback is unavailable, but the exact rollback command set `false`
  before this final deployment. No old-source rollback was performed.
- Baseline/final counts: bookings `519 -> 519`, pricing scopes `2 -> 2`, batches
  `4 -> 4`, attempts `1 -> 1`, allocations `1 -> 1`, legacy payments `469 -> 469`,
  ledger rows `470 -> 470`, and coupon reservations/usages `0 -> 0`. Booking
  status/course/source-scope distribution was unchanged. Pricing tier count/fingerprint
  remained `11` / `5c665704b2f0adffd67d9c7ec3a337db`. Protected fingerprints
  remained UAT booking `b3ace1823603773273d19783fecfa9f4`, approved batch
  `dbcdcb47fde7f6b59d0244bf90b6b7f6`, and repaired booking
  `e99a8144b0c0af731aad4d4ae3c81025`. The target still has one attempt, one
  allocation, one Progressive ledger source, and zero duplicate keys.
- Notifications changed `16032 -> 16034` from two real operational coach-assignment
  events by other users: `8f8cae4d-5ea2-4c6c-95d3-11da26a3e0bb` and
  `142ae692-96ac-4dfe-a7dd-abea07b3b79d`. Their timestamps correlate to
  `save_coach_assignment_groups` activity logs. They are separated from the UAT,
  were not modified, and do not represent activation-created data.
- Bounded Vercel monitoring sampled `100` activation-deployment and `100`
  rollback-deployment requests. Both windows had error-level `0`, 5xx `0`, typed
  dependency 503 `0`, and SlipOK activity `0`. Browser console warnings/errors and
  observed React/hydration errors were `0`. The approved Progressive batch remained
  readable in Admin Payments after rollback.
- UAT-attributable business-data delta, customer impact, and financial impact were
  all `0`. No Booking, Payment, scope, batch, attempt, allocation, ledger, coupon,
  wallet, attendance, entitlement, Finance, notification, refund, payroll, or
  accounting write was performed. General Kids Group returns to Legacy with Entry
  off; Adult Group and Private remain Legacy; existing Progressive records remain
  readable/drainable under the same source.
- Source complete/committed/pushed/deployed: yes. Entry enabled/Production active:
  no after safe rollback. Production UAT passed: no, because the required Kids Group
  runtime proof was not available. Data repaired in this round: no. Task Done: no.
  Remaining gate: verify an existing Owner-controlled User/Parent session with an
  existing child/safe draft, then obtain separate Owner approval before retrying
  Entry activation. Do not create data to reproduce the preview.
- Classification:
  **BLOCKER — ENTRY DISABLED; PROGRESSIVE ACTIVATION ROLLED BACK SAFELY**.

### 2026-07-13 - User/Parent Safe 4+4 Draft Verification

- Owner confirmed Chrome was logged in as a User and authorized only read-only
  identity, existing-child, entitlement-history, browser-local draft, Entry-off
  preview, monitoring, reconciliation, and documentation work. Entry activation,
  environment changes, deploy, Booking confirmation, Payment action, child/account
  changes, source work, migration, and Production data writes were not authorized.
- Gate 0 matched the rollback record: `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G` was Ready
  on all four aliases from exact functional source `f5b22a9`; all four dependency
  controls were `true`; allowlist was absent; shared `SLIPOK_TEST_MODE=true`; and
  the Entry value remained Sensitive/write-only after the exact rollback command.
  The runtime Entry-off Legacy response below independently confirms Entry is off.
- The visible Chrome identity uniquely matched Production profile
  `e8a4b5c9-880d-4a43-b693-96cb0ce26316`, role exactly `user`. It owns one existing
  child. Profile and child creation/update fingerprints were captured before the
  flow and remained unchanged; no account, role, profile, or child was created,
  repurposed, or edited.
- July Kids Group active deterministic order is booking
  `9634dca8-d3ce-4922-aaa4-f743edf3dd86` then
  `db5c80c2-5b5d-42c2-b569-7be643a9da6c`, ordered by `created_at`, then id. Both
  are `verified`, each has `2` sessions and stored amount `1,250`, so previous
  active sessions = previous settled sessions = `4` and previous settled amount =
  `2,500`. Two later cancelled four-session bookings are excluded.
- No usable restored draft appeared in the normal booking UI. A new browser-local
  draft selected the existing child, Kids Group, Chaengwattana, and four valid
  template-backed future sessions: July `17` 10:00-12:00, `18` 09:00-11:00,
  `19` 09:00-11:00, and `20` 10:00-12:00. Slots were open, capacity was available,
  no duplicate or disabled selection was bypassed, and coupon input remained empty.
- Entry-off summary passed exactly: previous settled `4` / `2,500`, selected new
  `4`, cumulative `8`, authoritative `7-10` tier rate `500`, target total `4,000`,
  and Legacy charge `1,500`. The UI displayed the true-up and prior-payment
  deduction as expected while Entry is off. Owner-policy Progressive arithmetic for
  the same sequence is `4 * 500 = 2,000`, with no deduction or retroactive true-up.
  The booking confirmation button was present but never clicked; the summary tab
  was preserved as an unconfirmed browser-local handoff.
- A new rollout-readiness blocker was proved before any activation retry. Both
  active bookings have `pricing_scope_id=null` and `entitlement_sessions=null`, and
  the matching July `booking_pricing_scopes` count is `0`. The deployed
  `previewProgressiveKidsGroupBooking()` source compares every active booking scope
  with the current scope and fails with `PROGRESSIVE_LEGACY_SCOPE_NOT_READY` before
  pricing when they differ. Therefore the policy result `2,000` is arithmetic only;
  the current Entry-on source would fail closed for this exact account rather than
  return `2,000`. No source defect was changed and no migration/data repair was
  proposed or performed in this round.
- Before/after Production counts were identical: bookings `519`, booking sessions
  `2782`, pricing scopes `2`, batches `4`, attempts `1`, allocations `1`, payments
  `470`, ledger rows `471`, coupon reservations/usages `0`, notifications `16088`.
  Profile, child, User booking, and User booking-session fingerprints matched.
  One unique authenticated `POST /api/bookings/preview` returned `200`; exact
  `/api/bookings` write requests were `0`. Bounded logs sampled `100` requests with
  error-level `0` and 5xx `0`; browser warnings/errors and React/hydration errors
  were `0`.
- Source changed/committed/deployed: no. Environment/Entry/allowlist changed: no.
  Production business data, customer impact, and financial impact: `0`. Entry stays
  configured `false`; general Kids Group remains Legacy.
- Scoped draft result:
  **PASS — USER/PARENT SAFE 4+4 DRAFT VERIFIED**.
- Overall activation result:
  **BLOCKER — LEGACY ACTIVE SCOPE NOT READY; OWNER COMPATIBILITY DECISION REQUIRED**.
  The Owner must define how active Legacy bookings participate in initial
  Progressive Entry before any separately approved source/migration/data scope or
  activation retry. Do not confirm the prepared draft or activate Entry yet.

### 2026-07-13 - Option A Legacy-to-Progressive Compatibility Decision and Audit

- Owner selected Option A. After Entry activation, every new general Kids Group
  booking uses Progressive. Eligible active Legacy Kids Group bookings in the same
  user/course/month period contribute only their entitlement sessions as the
  initial `previousActiveSessions` baseline. Active remains non-expired
  `pending_payment`, `paid`, and `verified`; cancelled and expired pending rows are
  excluded. Legacy stored/paid money is never deducted. Old Legacy bookings are not
  repriced, credited, refunded, assigned Progressive scopes/snapshots, or backfilled.
  Adult Group and Private remain Legacy; Production `pricing_tiers` remains authority.
- This was a read-only source/data/blast-radius audit plus documentation round. No
  source, migration, Production schema/data, Vercel control, deployment, Entry,
  allowlist, browser draft, Booking, Payment, coupon, wallet, attendance, entitlement,
  Finance, Ledger, refund, payroll, or accounting state changed.
- Source root cause is layered:
  - `src/lib/progressive-booking-preview.ts` loads active period bookings and raises
    `PROGRESSIVE_LEGACY_SCOPE_NOT_READY` when any `pricing_scope_id` differs from the
    current scope, including `null` Legacy rows when no scope exists.
  - `src/app/api/bookings/preview/route.ts` maps this to a fail-closed `409`; the
    create route remains server-routed and requires the preview revision.
  - `progressive_assert_scope_membership_v1()` repeats the same rejection inside
    atomic create/edit/cancel after the advisory scope lock.
  - `progressive_reprice_scope_v1()` initializes cumulative sessions to `0` and
    iterates only bookings whose `pricing_scope_id` equals the Progressive scope.
    Removing the TypeScript guard alone would therefore still reject the write and,
    if the SQL guard alone were removed, would still price from the wrong zero baseline.
  - Mutation receipts and expected scope revisions already provide idempotent replay
    and stale-scope detection. Payment batches intentionally select only pending
    Progressive members in one stored scope; Legacy rows must remain outside batch,
    allocation, payment, and ledger membership.
- Canonical Legacy entitlement source is `bookings.total_sessions`, summed once per
  eligible Legacy booking. All `423` active Legacy Kids Group bookings currently
  have `entitlement_sessions=null`; nevertheless every `total_sessions` value equals
  its original/root (`rescheduled_from_id is null`) session-row count. Counting all
  `booking_sessions` would overcount `87` rescheduled bookings. `25` active Legacy
  bookings have wallet dependencies, but wallet storage/redemption does not change
  the purchased booking entitlement. No active Legacy root session falls outside
  its booking month. Monetary columns and payment/ledger rows are not entitlement
  inputs. This preserves sibling aggregation because the booking total already
  counts all child sessions once; `68` active user/month periods contain multiple
  children.
- Production query captured at `2026-07-13T12:03:24Z`: all `459` Kids Group
  bookings and `2,647` related sessions, plus `2` pricing scopes, `4` Progressive
  batches, `1` verification attempt, `1` allocation, `419` Legacy payment rows,
  `420` combined ledger rows for those Kids Group bookings, `0` coupon usages,
  `0` Progressive coupon reservations, and `42` lesson-wallet credits. Active
  status/source counts are `419` verified Legacy, `4` pending-payment Legacy, and
  `1` verified Progressive; one additional Progressive booking is cancelled.
- User/month period blast radius:
  - all recorded active periods: Legacy-only `373`, Progressive-only `1`, mixed
    `0`, active Legacy plus cancelled Legacy `23`, active Legacy plus pending
    Progressive `0`, multiple-child `68`, wallet/reschedule history `96`,
    coupon-affected `0`, and existing scope with unmatched active Legacy `0`;
  - June: `188` Legacy-only periods / `204` active Legacy bookings / `1,133`
    entitlement sessions;
  - July: `184` Legacy-only periods / `218` active Legacy bookings / `1,279`
    entitlement sessions;
  - August: `1` Legacy-only period with `4` sessions and `1` separate
    Progressive-only period with `1` session;
  - current/future July-August potential exposure: `185` Legacy-only periods,
    `219` active Legacy bookings, and `1,283` entitlement sessions. This is a
    compatibility population, not a repair list and not a prediction that every
    period will create another booking.
- Authoritative active Kids Group tiers observed read-only: `1 -> 700`, `2-6 ->
  625`, `7-10 -> 500`, `11-14 -> 433`, `15-18 -> 406`, and `19+ -> 350`.
  Scenario matrix (coupon is applied only after the shown gross price):

| Scenario | Legacy active | Progressive active | New | Cumulative | Rate | Gross | Coupon/final | Preserved Legacy money |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| No prior + new 4 | 0 | 0 | 4 | 4 | 625 | 2,500 | none / 2,500 | 0 |
| Legacy 4 + new 4 | 4 | 0 | 4 | 8 | 500 | 2,000 | none / 2,000 | 2,500, not deducted |
| Legacy 5 + new 5 | 5 | 0 | 5 | 10 | 500 | 2,500 | none / 2,500 | 3,125, not deducted |
| Legacy 8 + new 8 | 8 | 0 | 8 | 16 | 406 | 3,248 | none / 3,248 | 4,000, not deducted |
| Non-expired pending Legacy 4 + new 4 | 4 | 0 | 4 | 8 | 500 | 2,000 | none / 2,000 | historical amount only |
| Verified Legacy 4 + pending Progressive 4 + new 4 | 4 | 4 | 4 | 12 | 433 | 1,732 | none / 1,732 | 2,500, not deducted |
| Cancelled Legacy 4 + new 4 | 0 | 0 | 4 | 4 | 625 | 2,500 | none / 2,500 | preserved but excluded |
| Expired pending Legacy 4 + new 4 | 0 | 0 | 4 | 4 | 625 | 2,500 | none / 2,500 | preserved but excluded |
| Sibling Legacy 2+2 + new 4 | 4 | 0 | 4 | 8 | 500 | 2,000 | none / 2,000 | 2,500, not deducted |
| Wallet/reschedule history on Legacy 4 + new 4 | 4 | 0 | 4 | 8 | 500 | 2,000 | none / 2,000 | 2,500, not deducted |
| Legacy 4 + new 4 with coupon | 4 | 0 | 4 | 8 | 500 | 2,000 | existing coupon contract / `2,000 - discount` | 2,500, not deducted |

- Retry/concurrency contract: preview must return the current scope revision plus
  the expected Legacy baseline/fingerprint. Create must acquire the existing
  user/course/month advisory lock, capture or verify the baseline exactly once,
  reject a stale preview, include the baseline contract in the mutation fingerprint,
  and retain the existing receipt replay. One request creates one scope/booking;
  concurrent stale requests fail and re-preview rather than double-count Legacy.
- Rollback contract remains safe: Entry `false` routes new general bookings to
  Legacy while stored-scope Progressive edit/cancel/payment drain continues. No
  Progressive or Legacy record is rewritten. Before any later reactivation, a
  fresh read-only audit must detect any Legacy booking created in a period that now
  already has a Progressive scope; such a newly mixed period must fail closed until
  its baseline initialization is proved, never silently fall back or double-count.
- Smallest safe later implementation boundary is a combination, not source-only:
  1. update `src/lib/progressive-booking-preview.ts`, preview/create payload typing,
     and `src/lib/progressive-booking-write.ts` to return/pass a baseline count or
     fingerprint alongside expected revision;
  2. add a narrow additive migration with scope-level Legacy baseline metadata and
     a single authoritative active-Legacy entitlement helper;
  3. replace `progressive_acquire_scope_v1`,
     `progressive_assert_scope_membership_v1`, and
     `progressive_reprice_scope_v1`, plus the create/capability signatures required
     to capture and verify the baseline atomically;
  4. keep coupon functions, payment-prefix membership, approval/allocation/ledger,
     Finance, wallet, attendance, and Legacy pricing semantics unchanged.
  Existing Progressive edit/cancel can continue through stored scope and the replaced
  shared repricer. No Legacy booking backfill and no Production business-data repair
  are required. Applying the additive migration and deploying source are separate
  later approvals.
- Required deterministic tests: all eleven pricing rows above; cancelled/expired
  exclusion; sibling aggregation; wallet/reschedule no double count; coupon after
  gross; preview/create stale-baseline conflict; concurrent first-scope creation;
  mutation replay; later Progressive ordering; existing Progressive edit/cancel;
  payment-prefix/drain; Entry-off rollback; Adult/Private Legacy routing; Finance,
  ledger, coupon, and Legacy pricing regressions. Exact `4 + 4` must return `2,000`
  after implementation and must never read/deduct the Legacy `2,500`.
- Current Vercel deployment remains `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G`, Ready on
  all four aliases. Four dependency controls remain present/true, Entry remains the
  explicit rollback `false`, allowlist is absent, and shared Test Mode remains true.
  Recent deployment error logs returned zero rows. The preserved unconfirmed
  browser-local `1,500` draft was not modified or confirmed.
- Read-only before/after counts were identical: Kids Group bookings `459 -> 459`,
  related sessions `2,647 -> 2,647`, Kids Group pricing scopes `2 -> 2`, all
  Progressive batches `4 -> 4`, attempts `1 -> 1`, allocations `1 -> 1`, all
  payments `470 -> 470`, combined ledger rows `471 -> 471`, coupon usages `0 -> 0`,
  and Progressive coupon reservations `0 -> 0`.
- Source changed: no. Migration created/applied: no. Production data repair: no.
  Deploy/Entry/allowlist change: no. Customer impact and financial impact: `0`.
  Source complete for Option A: no. Task Done: no. Next gate is separate Owner
  approval for the audited source plus additive-migration implementation scope.
- Decision/audit documentation commit
  `b0cab81014a2dde2e245fd4e156a98b1048f1dfc` was pushed to
  `origin/spike/next-major-security-upgrade`; the pre-existing unrelated remainder
  of the `AGENTS.md` worktree change stayed unstaged and excluded.
- Classification:
  **PASS — OPTION A COMPATIBILITY AUDITED; SOURCE FIX OWNER APPROVAL PENDING**.

#### 2026-07-13 - Option A Implementation Gate 0 Documentation Drift

- Owner approved the audited TypeScript plus additive-migration/RPC source scope,
  local/disposable verification, documentation, commit, and push only.
- Fresh `git fetch origin` proved branch `spike/next-major-security-upgrade`, local
  HEAD, and remote HEAD all at `e61d612118b57fb36137e4bb2306715feee5f43f`.
  Its direct parent is the actual Option A audit commit
  `b0cab81014a2dde2e245fd4e156a98b1048f1dfc`.
- The previously recorded full hash
  `b0cab819a201c625c9309463605af6e5495f81a4` was not a Git object. The shared
  seven-character prefix and commit subject matched, but the full provenance did
  not. The three context-document references were corrected.
- Per the explicit Gate 0 rule, source implementation stopped before any
  TypeScript or migration edit. No migration/runtime test, commit of source,
  remote migration, deploy, environment, Entry, allowlist, Production data,
  customer, or financial state changed.
- Classification:
  **DOCUMENTATION DRIFT — SOURCE FIX STOPPED BEFORE IMPLEMENTATION**.

#### 2026-07-13 - Option A Gate 0A Provenance Acceptance and Resume

- Owner accepted corrected Option A audit commit
  `b0cab81014a2dde2e245fd4e156a98b1048f1dfc` and documentation correction commit
  `21e32c7c5ee3254b981f8dabf19f515c6c77e8eb`.
- Fresh fetch proved branch, local HEAD, and remote HEAD at the accepted
  documentation correction commit; the corrected audit, previous closeout, and
  correction commits are all in ancestry. The only pre-existing worktree change
  remained the unrelated unstaged `AGENTS.md` remainder.
- Owner explicitly authorized the previously approved Option A TypeScript,
  additive-migration/RPC source, deterministic/disposable tests, documentation,
  commit, and push scope to resume from Gate 1.
- Remote migration application, Production schema/data writes, deploy, Vercel
  controls, Entry activation, allowlist changes, Booking/Payment actions, and live
  SlipOK remain unapproved.
- Classification:
  **OWNER APPROVAL ACCEPTED — OPTION A SOURCE IMPLEMENTATION AUTHORIZED**.

#### 2026-07-13 - Option A Compatibility Source Implementation Closeout

- Source complete: **yes**. Source commit
  `f8568a6d9c18da3745492d47c01d3ca22da156c8` was pushed to
  `origin/spike/next-major-security-upgrade`. It follows provenance-resume docs
  commit `210b7fc`; the unrelated pre-existing `AGENTS.md` remainder stayed
  unstaged and excluded.
- Migration source created: **yes**, exactly one new additive migration,
  `20260713210000_add_progressive_legacy_baseline_compatibility.sql`. Migration
  applied remotely: **no**. Existing applied migration files were not edited.
- Additive scope contract: nullable `legacy_baseline_sessions`,
  `legacy_baseline_fingerprint`, and `legacy_baseline_initialized_at`, with an
  all-or-none constraint and an immutability trigger. No monetary Legacy baseline
  field exists and the migration performs no Legacy booking, payment, ledger,
  Finance, coupon, wallet, attendance, refund, credit, or accounting DML.
- Canonical helper: `progressive_legacy_baseline_v1(uuid,uuid,integer,integer)` is
  service-role-only/SECURITY DEFINER and sums only `bookings.total_sessions` for
  exact-scope null-`pricing_scope_id` Kids Group bookings that are `paid`,
  `verified`, or non-expired `pending_payment`. The deterministic SHA-256 input is
  sorted by booking id and includes stable id/status/entitlement/expiry evidence;
  raw `booking_sessions`, reschedule descendants, wallet history, and Legacy money
  are not pricing inputs.
- Replaced effective shared functions without removing later coupon/payment fixes:
  `progressive_acquire_scope_v1(uuid,uuid,integer,integer,bigint)`,
  `progressive_assert_scope_membership_v1(uuid,uuid,uuid,integer,integer)`, and
  `progressive_reprice_scope_v1(uuid,bigint,timestamptz,uuid)`. Acquire initializes
  the Legacy count/fingerprint once under the existing advisory lock; existing
  initialized scopes require an exact match and fail
  `PROGRESSIVE_LEGACY_BASELINE_DRIFT`. Pre-compat scopes lazily initialize only an
  authoritative empty baseline.
- New create signature is
  `create_progressive_booking_v1(uuid,learner_type,uuid,uuid,uuid,jsonb,uuid,uuid,bigint,integer,text)`.
  It preserves mutation-receipt replay, advisory/revision locks, slot capacity,
  coupon reservation, activity logging, and no-payment-artifact behavior. Expected
  count/fingerprint are part of the mutation fingerprint and are compared with the
  stored authoritative baseline before inserting the new Progressive booking.
  Capability `progressive_pricing_writes_capability_v1()` is source version `2`
  with contract `immutable_scope_v1`.
- Preview response now separates Legacy baseline, previous Progressive active, and
  new sessions and preserves cumulative-after, rate, gross, discount/final,
  source/mode, scope, and revision. Client payload carries only the opaque expected
  count/fingerprint needed for stale-preview validation; it does not supply trusted
  Legacy ids, price/payment amounts, or arbitrary pricing authority.
- Repricing starts cumulative entitlement at the stored Legacy baseline and walks
  only active scope-owned Progressive rows in `created_at`, then booking-id order.
  Existing edit/cancel and payment rejection continue through this shared repricer;
  Legacy rows are outside membership and are never repriced, snapshotted, assigned
  a scope, or written.
- Exact verified Option A result: Legacy entitlement `4`, historical Legacy amount
  `2,500`, new `4`, cumulative `8`, rate `500`, gross/final without coupon `2,000`.
  The `2,500` remained unchanged and was never deducted. Cancelled and expired
  pending Legacy were excluded; multi-child `2+2` counted `4`; wallet/reschedule
  descendants did not change entitlement; coupon applied only after gross.
- Disposable migration/runtime result: `npx supabase db reset` compiled the full
  chain through `20260713210000`. A transaction-wrapped SQL fixture rolled back
  cleanly after testing Legacy-only/mixed and Progressive-only scope creation,
  exclusions, reschedule/wallet, children, stale revision/baseline, no partial write,
  replay/idempotency conflict, edit/cancel, immutable drift, pre-compat zero-only
  initialization, coupon recalculation, and payment prepare/cancel drain. A real
  two-connection concurrency test passed `8/8`: exactly one first request created
  one scope/booking/receipt at `2,000`; the other failed typed stale revision. All
  fixtures were rolled back/deleted, residue counts were zero, and the disposable
  stack was stopped without backup.
- Deterministic/regression results: Option A `32`, booking entry `25`, booking
  pricing `17`, pricing transactions `33`, coupon lifecycle `38`, payment batches
  `39`, payment integration/Finance/redaction `18`, payment notifications `16`,
  shared SlipOK `6`, Legacy pricing/payment `14`, plus the concurrency `8` above.
  The read-only Progressive pricing shadow audit also completed. `tsc --noEmit`,
  ESLint, mojibake (`225` files), `next build --webpack`, and `git diff --check`
  passed. After build, port `3000` was stopped, only this repo's `.next` was removed,
  dev restarted, `/` and generated `/_next/static/*` returned `200`, unauthenticated
  booking preview returned `401`, browser console errors were `0`, and no visible
  Next error overlay existed.
- Source files changed: Progressive preview/write helpers, booking preview/create
  routes, booking client payload typing, manual database types, booking-entry and
  transaction regressions, three Option A deterministic/runtime/concurrency test
  scripts, and the single new migration. Adult Group, Private, Legacy pricing,
  pricing tiers, payment/Finance/Ledger implementation, environment, allowlist, and
  Production business data were not changed.
- Deploy performed: **no**. Entry: **variable absent, effective false**. Production
  active: **no**. Production data changed: **no**. Customer impact: **none**.
  Financial impact: **none**. Read-only Vercel closeout confirmed production
  deployment `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G` remains `Ready` with the same four
  aliases; Entry and allowlist names are absent, while the four dependency names
  and shared SlipOK Test Mode name remain present/encrypted.
  Remaining migration/deploy gate: fresh read-only mixed-scope audit plus separate
  Owner approval to apply `20260713210000` and deploy with Entry still false.
  Remaining activation/UAT gate: later separate Owner approval for Entry activation
  and a no-write authoritative `4+4 = 2,000` Production preview with rollback.
- Classification:
  **PASS — OPTION A COMPATIBILITY SOURCE COMPLETE; MIGRATION/DEPLOY/ACTIVATION PENDING**.

#### 2026-07-13 - Option A Migration/Deploy Gate 0 Entry-State Documentation Drift

- Owner approved a fresh read-only mixed-scope audit, exact migration
  `20260713210000`, capability/version and zero-data-delta verification, exact
  Entry-off Option A deployment, bounded monitoring, and documentation closeout.
  Owner required `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` and the UUID allowlist to stay
  absent and did not approve any environment-variable change or Entry activation.
- Fresh fetch proved branch `spike/next-major-security-upgrade`, local HEAD, and
  remote HEAD all at `1503b81ab71e16b8b89fe41d9dcc4e232a5acacc`; source commit
  `f8568a6d9c18da3745492d47c01d3ca22da156c8` is an ancestor and all descendants
  are documentation-only. The only worktree change remained the unrelated unstaged
  `AGENTS.md` remainder (`72` additions / `3` deletions).
- Migration SHA-256 is
  `30C0A711B391FA1F89F98A0589AABAEBD588E0FAD0390D8583D3E2937844A78E`.
  Remote history matched every prior migration through `20260713153000`; exactly
  `20260713210000` remained pending. No applied migration or source file differed.
- Read-only Vercel inspection confirmed deployment
  `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G` remains Production `Ready` on all four aliases.
  The four dependency names and shared `SLIPOK_TEST_MODE` remain present/encrypted,
  and the UUID allowlist remains absent. However,
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` is also present/encrypted. This materially
  conflicts with the approved absent-state prerequisite and the previous current
  snapshot. Vercel CLI does not expose its plaintext, so its exact value is
  `Unknown / Need verification`.
- Safety Gate result: stopped before the mixed-scope audit, Production baseline,
  migration application, capability change, deployment, browser UAT, or monitoring.
  No environment variable, Production schema/data/business row, Booking, Payment,
  coupon, wallet, attendance, notification, Finance, Ledger, refund, credit,
  payroll, or accounting state was changed. Customer and financial impact from this
  round: none.
- Next Owner decision required: explicitly authorize removal of the unexpected
  Entry variable or provide another safe resolution that restores the required
  pre-deploy contract. Then rerun Gate 0/0A and the fresh mixed-scope audit; do not
  resume at migration application.
- Classification:
  **DOCUMENTATION DRIFT — ENTRY VARIABLE PRESENT; MIGRATION/DEPLOY STOPPED**.

#### 2026-07-13 - Isolated Production Entry Variable Cleanup

- Owner explicitly authorized one isolated environment action only: remove exactly
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` from the Vercel Production project, preserve
  all other variables, do not replace it with `false` or `true`, and do not apply a
  migration, deploy, activate Entry, change the allowlist/dependencies/SlipOK, or
  write Production business data.
- Fresh Git preflight proved branch `spike/next-major-security-upgrade`, local and
  remote HEAD `a3d344205c5189c4bb0620f676bf4e1b5fceb8d5`, and source ancestor
  `f8568a6d9c18da3745492d47c01d3ca22da156c8`. The only dirty file remained the
  unrelated unstaged `AGENTS.md` remainder (`72` additions / `3` deletions).
- Pre-change Vercel JSON listed `11` Production names. Entry existed as a
  Production-only Sensitive variable; the four Progressive dependency names and
  shared `SLIPOK_TEST_MODE` name were present, and the UUID allowlist was absent.
  Deployment `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G` was Ready on the same four aliases,
  and remote migration history ended at `20260713153000` with only
  `20260713210000` pending.
- `vercel env rm PROGRESSIVE_PAYMENT_ENTRY_ENABLED production --yes` completed
  successfully. A fresh full JSON comparison proved exactly `11 -> 10`: removed
  Entry only, added `0`, and no type, target, configuration id, creation time, or
  update time changed for any remaining variable. No replacement value was added.
- No deployment was created. The same deployment remains Ready on the same aliases,
  and the Option A migration remains pending. Because Vercel environment changes do
  not alter an existing deployment artifact, its embedded Entry value remains
  `Unknown / Need verification`; the cleanup restores the absent prerequisite only
  for a future separately approved deployment.
- Safe checks before/after returned public home `200` and unauthenticated booking
  preview `401`. Bounded current-deployment searches found `0` error-log rows and
  `0` SlipOK rows. Read-only counts at `2026-07-13T13:58:05.722Z` and
  `2026-07-13T13:59:54.205Z` were identical for all `17` checked tables/views:
  bookings `519`, sessions `2785`, scopes `2`, mutation receipts `3`, coupon
  reservations `0`, payment batches/members `4/4`, allocations/attempts `1/1`,
  payments `470`, coupon usages `0`, wallet credits `60`, attendance `1617`,
  notifications `16137`, pricing tiers `11`, ledger allocations `471`, and Finance
  expenses `1`.
- Source changed: **no**. Migration applied remotely: **no**. Deploy/redeploy:
  **no**. Entry activation: **no**. Allowlist/dependency/SlipOK change: **no**.
  Production schema/business data changed: **no**. Customer impact: **none**.
  Financial impact: **none**. The next migration/deploy round requires separate
  Owner approval and must restart at Gate 0/0A with a fresh mixed-scope audit.
- Classification:
  **PASS — ENTRY VARIABLE REMOVED; MIGRATION/DEPLOY GATE MUST RESTART FROM GATE 0**.

#### 2026-07-13 - Option A Migration Applied and Entry-Absent Source Deployed

- Owner approved one gated execution covering fresh Gate 0/0A, mixed-scope audit,
  exact migration `20260713210000`, capability/data verification, exact Option A
  deployment with Entry absent, read-only smoke/monitoring, and documentation push.
  Entry activation, environment changes, Booking/Payment actions, repair, backfill,
  and additional source/migration changes remained prohibited.
- Git started at branch `spike/next-major-security-upgrade`, local/remote HEAD
  `d4574a76927b3f01e9fd5d8a2328d953c256243f`. Source `f8568a6` is an ancestor and
  the descendant functional tree is identical. Only the unrelated unstaged
  `AGENTS.md` remainder (`72` additions / `3` deletions) existed and stayed excluded.
- Migration SHA-256 matched
  `30C0A711B391FA1F89F98A0589AABAEBD588E0FAD0390D8583D3E2937844A78E`.
  Exactly `20260713210000` was pending. Gate 0A proved the additive columns and
  unchanged acquire/membership/reprice signatures safe for the old Entry-off
  deployment during the short migration-to-deploy interval.
- Fresh Production audit found active Kids Group periods: Legacy-only `373`,
  Progressive-only `1`, mixed `0`; active Legacy bookings `423` / `2,416` sessions;
  existing Progressive scopes with eligible Legacy `0`; multiple-child `68`;
  wallet/reschedule `97`; coupon-affected `0`. Current/future: `185` Legacy-only,
  `1` Progressive-only, mixed `0`, active Legacy bookings `219` / `1,283` sessions.
  Both existing scopes had authoritative eligible Legacy baseline count `0` and
  were unlocked; their revisions remained `4` and `3`.
- `supabase db push --linked --yes` applied exactly migration `20260713210000` once.
  Remote schema contains only the three approved nullable scope baseline fields,
  all-or-none constraint, immutability trigger, authoritative helper, compatible
  scope/membership/reprice/create replacements, and capability update. Existing
  scope baseline fields stayed null; no backfill ran. Anon helper access remained
  denied and service-role grants/search paths remained correct.
- Pricing-write capability is `{ ready: true, version: 2,
  legacyBaselineContract: "immutable_scope_v1" }`. Payment batch and integration
  capabilities remain Ready at version `1`. Pre/post migration protected hashes
  matched for all `21` checkpoints, including Booking/sessions/scopes/snapshots,
  receipts, Payment/batches/attempts/allocations, Ledger, Finance, coupon, wallet,
  attendance, notifications, and pricing tiers.
- A clean detached worktree at exact `d4574a7` deployed the functional-tree-identical
  Option A source. Production deployment `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE` is
  Ready on all four aliases. Entry and allowlist remain absent; the four dependency
  controls and shared `SLIPOK_TEST_MODE` name remain present. No environment value
  was added, removed, or changed in this deployment round.
- Entry-off smoke: public home `200`; generated assets identify the new deployment;
  unauthenticated preview `401`; preserved authenticated Kids `4+4` draft remained
  Legacy `1,500`; Adult/Private source decision remains Legacy; User History showed
  the approved Progressive `700` booking. The approved batch and both existing
  scopes remained readable, and payment drain capabilities remained Ready. No
  confirm/edit/cancel/Payment/batch action was submitted.
- Bounded deployment log searches returned error `0`, 5xx `0`, and SlipOK `0`.
  Browser console/hydration warnings were `0`. Final protected counts were unchanged
  except five attendance rows plus one coach reminder created by timestamp-correlated
  real coach operations after the baseline; attributable migration/deploy business
  delta is `0`. Customer impact: none. Financial impact: none. Rollback: not used.
- Source complete: **yes**. Tests passed: **yes**. Committed/pushed source: **yes**.
  Migration applied: **yes**. Deployed: **yes**. Feature enabled/Production active:
  **no**. Production Entry-on UAT: **no**. Data repaired this round: **no**. Task
  done: **no**. Remaining gate is separate Owner approval for final Entry activation,
  authoritative no-write Production `4+4 = 2,000` UAT, monitoring, and closeout.
- Classification:
  **PASS — OPTION A MIGRATION APPLIED AND ENTRY-ABSENT SOURCE DEPLOYED; ACTIVATION UAT PENDING**.

#### 2026-07-13 - Final Option A Activation UAT Failed; Entry Rolled Back

- Owner approved one final gated round: add only Production
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`, redeploy exact clean Option A source,
  run authenticated no-write `4+4` UAT, retain Entry only if every mandatory proof
  passed, otherwise immediately remove Entry and restore the known-good Entry-absent
  deployment. Source edits, migrations, Booking/Payment actions, and Production
  business-data writes remained prohibited.
- Git Gate 0 passed on branch `spike/next-major-security-upgrade` at matching
  local/remote HEAD `9ecc6181c093e23fb2b75e30c6ed1b9332051b06`.
  `f8568a6d9c18da3745492d47c01d3ca22da156c8` is an ancestor, and clean deploy
  commit `d4574a76927b3f01e9fd5d8a2328d953c256243f` has an identical functional
  tree. The only dirty file was the unrelated unstaged `AGENTS.md` remainder
  (`72` additions / `3` deletions), which stayed excluded.
- Production preflight passed: `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE` was Ready on
  all four aliases; Entry and allowlist were absent; four Progressive dependencies
  and shared Test Mode were present/true; migration `20260713210000` was applied
  once; pricing capability was Ready/version `2`/`immutable_scope_v1`; payment
  capabilities were Ready/version `1`. Both existing Progressive scopes were
  unlocked/readable with authoritative eligible Legacy baseline `0`.
- Protected pre-activation counts were bookings `519`, booking sessions `2,785`,
  scopes `2`, pricing snapshots `519`, mutation receipts `3`, coupon reservations
  `0`, payment batches/members `4/4`, attempts/allocations `1/1`, legacy payments
  `470`, coupon usages `0`, wallet credits `60`, attendance `1,622`, notifications
  `16,144`, pricing tiers `11`, Ledger rows `471`, Finance expenses `1`, and
  existing Progressive bookings `2`. Target UAT booking/batch and repaired booking
  `d6dad7aa...` fingerprints were captured separately.
- Gate 1 added exactly Sensitive Production Entry with value `true`. Environment
  names changed `10 -> 11`; no other name or metadata changed, allowlist remained
  absent, and the four dependencies/shared Test Mode remained unchanged.
- Gate 2 deployed from a clean detached worktree pinned to exact `d4574a7`.
  Activation deployment `dpl_Hqz23xUgUXYSH1FtoVZUXSgS2Bqh` reached Ready and
  owned all four Production aliases with unchanged migration/capabilities/source.
- Authenticated read-only UAT proved one Production `user`, the unchanged owned
  child, and July eligible Legacy history `2+2=4` sessions with preserved amounts
  `1,250+1,250=2,500`; cancelled rows were excluded and no matching July
  Progressive booking existed. The browser-local draft selected exactly four
  active, template-backed July sessions with no coupon and never called create.
- The authoritative preview selected Progressive and returned the expected
  pricing evidence: Legacy baseline `4`, previous Progressive active sessions `0`,
  new sessions `4`, cumulative `8`, rate `500`, gross `2,000`, coupon discount `0`,
  final `2,000`. There was no Legacy `1,500`, baseline conflict/drift, capability
  error, or booking-create request.
- Mandatory pass condition 12 failed in the customer UI. Alongside the correct
  `฿2,000` total, the summary rendered stale Legacy true-up lines:
  `ยอดรวมตามเรทใหม่: 8 × ฿500 = ฿4,000`,
  `หักยอดที่จ่ายแล้ว: ฿2,500`, and
  `ยอดที่ต้องชำระเพิ่ม: ฿2,000`. This tells the customer that historical Legacy
  money was deducted, contrary to the permanent Option A rule. Source inspection
  localized the issue to the existing Kids Group summary branch in
  `src/components/dashboard/booking-client.tsx`, which does not distinguish the
  Progressive preview mode. No source edit was authorized or performed.
- The immediate primary rollback removed exactly Entry without replacing it with
  `false` and promoted known-good `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE`. It is Ready
  on all four aliases. Final environment names are back to `10`: Entry/allowlist
  absent, dependencies/Test Mode unchanged. The same browser-local draft returned
  Entry-off Legacy `1,500`; Adult Group and Private remain Legacy; unauthenticated
  preview returned `401`; approved Progressive User History and drain capability
  remained readable. No edit/cancel/payment/batch action was submitted.
- Post-rollback protected counts/fingerprints matched every preflight checkpoint
  above except notifications `16,144 -> 16,147`. The three new notification ids
  `d8fd54e1...`, `b3f9cf51...`, and `ec1d2579...` were timestamp-correlated real
  coach-assignment events for separate teaching dates, not activation/UAT writes.
  Activation/UAT-attributable business-data delta is exactly `0`; no Legacy row
  received a Progressive scope or snapshot.
- Bounded activation and rollback monitoring found error `0`, 5xx `0`, dependency
  or baseline fault `0`, and SlipOK activity `0`. Browser/React/hydration errors and
  a Next error overlay were absent. Customer impact: `0`. Financial impact: `0`.
  Rollback used: **yes**. Migration was not reversed.
- Source complete: **no** for activation-ready customer-summary behavior; core
  Option A TypeScript/RPC/migration remains complete. Tests passed: **no** for the
  mandatory Production activation UAT. Committed/pushed: core source **yes**;
  rollback documentation is the follow-up commit. Migration applied: **yes**.
  Deployed: **yes**, final known-good Entry-absent deployment. Feature enabled /
  Production active / Production UAT passed: **no / no / no**. Data repaired this
  round: **no**. Task Done: **no**.
- Next gate requires separate Owner approval for a narrow Progressive summary
  source/test correction, then separately approved Entry-off deployment and final
  activation/no-write UAT retry. Do not reactivate Entry or confirm the draft.
- Classification:
  **BLOCKER — OPTION A ACTIVATION UAT FAILED; ENTRY ROLLED BACK TO ABSENT**.

#### 2026-07-13 - Progressive Summary Fixed; Option A Production Active

- Owner approved one combined closeout round limited to the localized Progressive
  Kids Group Summary correction, narrow deterministic tests, source commit/push,
  corrected Entry-absent deployment, exact-source Entry activation, authenticated
  no-write `4+4` UAT, reconciliation, and documentation. API/RPC/migration/tier,
  Legacy, Adult Group, Private, Booking confirmation, Payment, and Production
  business-data changes remained prohibited.
- Gate 0 passed on branch `spike/next-major-security-upgrade` from matching
  local/remote HEAD `817794a4aaefe885aa46f30f4765e7e8a20902e4`. Core Option A
  `f8568a6` was an ancestor. The only dirty file was the unrelated unstaged
  `AGENTS.md` remainder (`72` additions / `3` deletions), which remained excluded.
- Root cause was exactly the Kids Group summary render in
  `src/components/dashboard/booking-client.tsx`: the component stored only a
  partial authoritative preview and rendered the Legacy monthly true-up block for
  every Kids Group summary. The Progressive server preview/price was already
  correct; no pricing formula or API contract change was required.
- Source commit `aa64adfb765139ca38908ca2409fa2127ffe4a29`
  (`fix(booking): separate progressive summary pricing copy`) changes only
  `src/components/dashboard/booking-client.tsx` and
  `scripts/check-progressive-booking-entry.js`. It introduces a discriminated
  preview state, preserves the server-provided Progressive baseline/ordering/rate/
  gross/final evidence, branches only on authoritative `mode`, and renders separate
  Progressive and Legacy explanations. Coupon and zero-price semantics are
  unchanged; Adult Group and Private remain Legacy. The commit was pushed to
  `origin/spike/next-major-security-upgrade`.
- Verification passed: booking entry `31`, Option A baseline `32`, Progressive
  pricing `17`, transactions `33`, coupon `38`, Legacy pricing/payment `14`,
  `npx.cmd tsc --noEmit`, lint, mojibake `225`, production build `90` routes, and
  `git diff --check`. Post-build protocol stopped port `3000`, removed only this
  repo's generated `.next`, restarted dev on `127.0.0.1:3000`, and verified home
  `200`, generated static asset `200`, unauthenticated preview `401`, and no Next
  error overlay. Deterministic Summary checks supplied the authenticated local UI
  proof because the local Chrome tab could not be attached reliably.
- Corrected clean Entry-absent deployment
  `dpl_GyGnKWq49mTU6NYNavWRVYLwmo3P` reached Ready on all four aliases from exact
  `aa64adf` and became the primary rollback target. Authenticated no-write Entry-off
  UAT preserved the exact Legacy block/result: previous `4` / `2,500`, new `4`,
  cumulative `8`, rate `500`, target `4,000`, deduction `2,500`, charge `1,500`;
  Progressive-only explanation was absent.
- Entry activation added only Production
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`. The first interactive Vercel attempt
  accidentally answered the default Sensitive prompt instead of the value prompt,
  so its artifact remained default-deny and was rejected by runtime proof. Entry
  was recreated as a non-sensitive flag and pull-back proved exact value `true`.
  Ordinary same-source deployments still reused the Entry-off build cache and were
  also rejected. A final `--force` build of the same clean `aa64adf` source produced
  activation deployment `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`, Ready on all four
  aliases. No source or dependency changed between Entry-off and Entry-on.
- Authenticated Production no-write UAT confirmed the exact Owner case: eligible
  Legacy history `2+2=4`, historical amounts `1,250+1,250=2,500`, cancelled rows
  excluded, previous Progressive `0`, selected new sessions `4`, and coupon `0`.
  The authoritative Progressive result was Legacy baseline `4`, previous
  Progressive `0`, new `4`, cumulative `8`, rate `500`, gross `2,000`, discount
  `0`, final `2,000`.
- The customer Summary visibly showed the Progressive booking-level explanation,
  including `สิทธิ์เดิมที่ใช้กำหนดเรท: 4 ครั้ง`,
  `การจอง Progressive ก่อนหน้า: 0 ครั้ง`, `จองเพิ่มครั้งนี้: 4 ครั้ง`,
  `จำนวนสะสมหลังจอง: 8 ครั้ง`,
  `เรทสำหรับการจองครั้งนี้: 500 บาท/ครั้ง`, and
  `ราคาการจองใหม่: 4 × 500 = 2,000 บาท`. It also stated that historical payment is
  preserved and not deducted. Legacy target-total, prior-payment-deduction, and
  credit-difference wording were all absent. The historical Legacy `2,500` did not
  participate in or appear as a deduction.
- Adult Group and Private remained Legacy through the unchanged server-only entry
  decision and passing deterministic checks. Unauthenticated preview returned
  `401`. Existing Progressive User History and approved batch remained readable;
  pricing capability was Ready/version `2`/`immutable_scope_v1`; coupon, payment
  batch, and payment integration capabilities were Ready/version `1`; both existing
  scopes were unlocked. Migration `20260713210000` remained applied exactly once.
- Protected baseline was captured at `2026-07-13T15:43:51.815Z`; post-UAT was
  captured at `2026-07-13T16:01:11.187Z`. Every count and SHA-256 fingerprint
  matched exactly:

  | Checkpoint | Count | SHA-256 |
  | --- | ---: | --- |
  | bookings | 519 | `d3d5a7c57d7178bc80698672a57634eadb8c4ecca2ea7664201d9fc4ceb040ae` |
  | booking sessions | 2,785 | `ab8269bb6b1fa1e479880d450aa0edecc07b4048e75a966985b136a60f54b752` |
  | pricing scopes | 2 | `86503f5f2eb1197578d774fec9a4a3de8dcf43204c12c07f73bf76e9e74edb48` |
  | mutation receipts | 3 | `0a2e5b22b52817d840b17b40d8b0869475bf08630e4170a8cb7d1bdf83eb3b78` |
  | coupon reservations | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
  | coupon usages | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
  | payment batches | 4 | `662e71bb9eb71ca5d0a830d9129e87ad3c7dc3a243b9c49e3650b37ce0f34faf` |
  | payment batch members | 4 | `f94c8df0f696431f99bf9156a09d04f29069deb98fb2cc2dd7db020af900b075` |
  | verification attempts | 1 | `5b125b6b2bb2e2f5732efdbab8e43cdc4da6afed36b155aef21e6d5218cdfa33` |
  | allocations | 1 | `3100748cd90c49db598f714ebcae865b90d191ff4ad4df9100f7e2fb24419936` |
  | payments | 470 | `3c32d4ea56390b151707b04109b5a8020d5c1ce588c7d943596458ef13f0ed2e` |
  | Ledger | 471 | `ff92de3a57d20a2139f32317379d2588ff69706f391e3fa771703bbc7d88cfbd` |
  | wallet credits | 60 | `08ba708a26efaba9445856a00414092ee867e25741195ea0be88f97c01ac007a` |
  | attendance | 1,622 | `4974ee348f148d676fa3fc2e770cce9619469b3424defa7da4d4910fc017d0e7` |
  | notifications | 16,147 | `402eb8a491c104f5c281fc8f8da6755d9496ea13ec80b287bb32572ca3031df5` |
  | pricing tiers | 11 | `27c184b2bf280bf0352848d0ef04866db278e5ecd5cf20963395301ba520aaa7` |
  | Finance expenses | 1 | `f0dafc3824b411b3d8b131103f5f9043a4536d634e2037138b661d92b8df3846` |
  | existing Progressive bookings | 2 | `41e87af0e6b7d18701a8dec74dd10a810f09c6962d8281b29d5e114be4c8e377` |
  | virtual pricing snapshots | 519 | `33324b5abf3dbd588aa22f3d2c26e0233cf0b12f0c61a03e839a1eed7b31b993` |
  | approved Progressive batches | 1 | `d61ed493eadee3da1c0e5871d3f30f9eefadbe22891df1d6e4c1c573cc4ce020` |
  | repaired booking | 1 | `7ca7308ec459bb39d1c45d0a557774d48b7aba919459f63363a7321c1cb0b541` |

- Final deployment logs sampled `28` requests: errors `0`, 5xx `0`, baseline faults
  `0`, dependency faults `0`, live SlipOK `0`, booking-create POST `0`, and one
  successful preview `200`. Browser console warnings/errors, React/hydration errors,
  and Next error overlay were `0`. No confirmation button was clicked.
- Source complete: **yes**. Tests passed: **yes**. Committed/pushed: **yes** for
  source; documentation closeout is the follow-up commit. Migration applied:
  **yes**. Deployed / Feature enabled / Production active / Production UAT passed:
  **yes / yes / yes / yes**. Data repaired this round: **no**. Task Done: **yes**.
  Customer impact: future new general Kids Group bookings now use Progressive.
  Financial impact: future charges follow Option A; all historical money and
  accounting evidence remain unchanged. Rollback used after the successful final
  artifact: **no**; corrected Entry-absent rollback target remains available.
- Kids Group Pricing Reconciliation is closed and removed from the active blocker
  queue. The next documented task, Homepage LV copy audit/fix, is unpaused but was
  not started.
- Classification:
  **PASS — PROGRESSIVE SUMMARY FIXED; OPTION A ENTRY ACTIVE; PRODUCTION 4+4=2,000 UAT PASSED; PRICING RECONCILIATION DONE**.

#### 2026-07-14 - Production Booking Regression Read-Only Audit

- Owner reported a fresh Production regression on `/dashboard/booking` for the
  controlled July 2026 Kids Group `4+4` case: Step 4 displayed `1,500`, Step 5
  displayed authoritative Progressive `2,000`, and confirmation returned
  `409 PROGRESSIVE_CAPACITY_EXCEEDED`. Owner authorized read-only audit and
  documentation only. No source/test edit, create replay, deploy, Entry change,
  migration, or Production business-data write was authorized.
- Gate 0 passed. Branch `spike/next-major-security-upgrade` started at matching
  local/remote HEAD `8a78d5d7c917787b29cf65425445ed4932179f65`; functional source
  `aa64adfb765139ca38908ca2409fa2127ffe4a29` is its direct ancestor and the HEAD
  delta is documentation only. The unrelated unstaged `AGENTS.md` remainder
  (`72` additions / `3` deletions) remained excluded. Production deployment
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS` was Ready on all four aliases. Entry was
  exactly `true`, allowlist absent, four Progressive dependencies and shared
  `SLIPOK_TEST_MODE` exactly `true`, migration `20260713210000` applied once,
  pricing capability Ready/version `2`/`immutable_scope_v1`, and payment
  capabilities Ready/version `1`.
  Current Vercel inspection did not expose Git SHA metadata; the exact `aa64adf`
  provenance remains the prior clean-detached deployment record plus the unchanged
  functional tree, rather than a new platform-side SHA assertion.
- Price root cause is the separate Step 4 client render path. In
  `src/components/dashboard/booking-client.tsx`, `existingMonthData` filters same-
  period settled `paid`/`verified` history, `kidsIncremental` calls the Legacy
  monthly true-up helper, and Step 4 renders its `totalBatchPrice`. For the exact
  case this is `8 x 500 - 2,500 = 1,500`. Step 4 does not call
  `/api/bookings/preview`.
- Moving to Step 5 calls `fetchAuthoritativePreview`, which returned Progressive
  baseline `4`, prior Progressive `0`, new `4`, cumulative `8`, rate `500`, coupon
  `0`, gross/final `2,000`. After that preview, create submitted the authoritative
  preview amount/revision/baseline contract; the 409 was not a price conflict.
  Draft restore retained selection/client mutation state but no price or preview;
  it therefore exposed the same deterministic Step 4 Legacy path. Proven cause:
  separate render paths plus preview timing, not corrupted draft state or a stale
  deployment/cache artifact.
- The prior `31` booking-entry checks are source-text assertions around Step 5's
  Summary branches and contracts. They do not execute/render Step 4, transition a
  real component from calendar to Summary, or assert that the two visible totals
  match. A later regression suite must cover the executable calendar -> Summary
  transition for Legacy baseline, zero baseline, coupon, restored draft, and full-
  slot rejection.
- Capacity root cause is independent. The effective
  `progressive_lock_booking_slots_v1` creates/reuses slots, resolves the requested
  template/date/time rows, locks exact slot rows, rejects duplicate learner/date/
  time, and then counts existing active sessions with `cancelled_at IS NULL`,
  session status `scheduled|completed|absent`, and booking status non-expired
  `pending_payment|paid|verified`. It raised `PROGRESSIVE_CAPACITY_EXCEEDED` inside
  `create_progressive_booking_v1`; the route correctly mapped the typed database
  exception to HTTP `409`.
- Exact selected-slot audit using that rule:

  | Date/time | Template id | Schedule slot id | Active/capacity | Result |
  | --- | --- | --- | ---: | --- |
  | 2026-07-20 17:00-19:00 | `8940de2e-022b-4437-bf59-42dd882dfbda` | `ede40674-b21d-4f50-9c98-0cf2f1f20347` | `5/6` | available |
  | 2026-07-21 17:00-19:00 | `680ba191-4e93-4904-92d4-5ff015b69263` | `53c3556a-6067-4ad1-813c-ca8410d17994` | `4/6` | available |
  | 2026-07-22 17:00-19:00 | `fc3937db-bf41-44ef-be1e-5e0f01a5841c` | `25aee5d6-7ca1-4a79-a754-ea1e99697113` | `6/6` | rejected; request would make `7` |
  | 2026-07-23 17:00-19:00 | `b59a3b34-4be7-46a6-9c2b-07045972bf65` | `5266ddfb-8491-4cd2-9214-7c226b2a9bb0` | `1/6` | available |

- Exact booking/session/learner record sets were verified read-only and intentionally
  not copied into documentation as full personal identifiers. All `16` active
  contributors across the four slot counts were other users' verified Legacy
  bookings with scheduled sessions. The current user's Legacy baseline contributed
  zero physical occupancy. There were no duplicate active learners, Progressive
  rows, wallet links, makeup rows, cancelled sessions, or expired pending bookings.
  One valid reschedule descendant contributed on 2026-07-21; its 2026-07-20
  predecessor had session status `rescheduled` and was excluded, so it was not
  double-counted.
- The restored draft's template ids exactly matched the current active templates
  and resolved to the listed current slots. The six July 22 occupants predated the
  incident, so capacity did not race from available to full after Step 4. Step 4
  lists dates from recurring `schedule_templates` and never queries authoritative
  occupancy. The RPC counts live booking/session rows under lock. All four
  `schedule_slots.current_students` cache values were stale at `0`, but neither the
  client nor RPC trusted that cache for the capacity decision. Conclusion:
  expected protection against a genuinely full slot plus stale-availability UX.
- The approved Chrome bridge could not attach to the existing incident tab. Per
  Owner safety rules, the page was not reloaded, the draft was not changed, and no
  create was replayed. Original Network payload/headers and sanitized Session
  Storage detail remain `Unknown / Need verification`; screenshots, source, bounded
  logs, and authoritative database reads supplied the remaining proof.
- Bounded Vercel logs from 09:26:30-09:31:10 Asia/Bangkok contained three unique
  preview `200` events and two unique create `409` events at 09:27:48.849 and
  09:30:45.172. All were Production cache misses served by
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`. The log records had empty message/trace fields
  and did not include payload, response body, or selected slot. There were no 5xx,
  baseline/dependency faults, payment/slip route events, or live SlipOK activity.
- Failed-create atomicity passed across a window spanning both requests. Attributable
  created/updated counts were zero for bookings, booking sessions and pricing
  snapshots, July pricing scope, mutation receipts, coupon reservations/usages,
  payment batches/members, verification attempts, allocations, Legacy payments,
  Ledger, wallet, attendance, notifications, Finance, and activity logs. No orphan
  scope/booking/session/receipt, notification, payment artifact, or partial slot-
  count write exists.
- The two symptoms are separate: (A) UI pricing-source divergence on Step 4 versus
  authoritative Step 5, and (B) correct atomic capacity rejection combined with a
  stale-availability UI. Affected scope is any new Progressive Kids Group selection
  where Step 4's Legacy-derived local price differs from server Progressive pricing;
  the availability issue affects any slot whose live occupancy reaches capacity.
- Customer impact: misleading Step 4 price, then corrected Summary, plus late full-
  slot rejection. Financial impact from both observed attempts: none; no Booking or
  Payment existed and no amount was charged. Immediate Entry rollback is not
  recommended because it would route new Kids Group traffic back to the explicitly
  rejected Legacy formula while server pricing/capacity authority remains intact.
- Smallest later fix boundary, pending separate Owner approval: make Step 4 consume
  the same authoritative Kids Group preview used by Step 5; expose authoritative
  capacity/preflight before confirmation while retaining the locked RPC as final
  authority; add executable UI transition/full-slot coverage. Do not change tiers,
  Option A formula, Legacy rows, Adult/Private, coupon/payment policy, or RPC
  financial semantics.
- Source changed: **no**. Tests changed: **no**. Deployment, Entry, environment,
  migration, and Production data changed: **no**. Task Done: **no**. Homepage LV
  Copy Audit/Fix is paused again. Classification:
  **PRODUCTION REGRESSION AUDITED - SOURCE FIX OWNER APPROVAL REQUIRED**.

#### 2026-07-14 - Production Booking Regression Fix Deployed; Authenticated UAT Blocked

- Owner approved one combined closeout round and superseded the earlier rollback
  discussion: continue fixing current source through Localhost, disposable, deploy,
  and Production no-write gates; do not roll back Source or Database. No formula,
  tier, migration, Legacy/Adult/Private, coupon/payment/SlipOK policy, Entry,
  allowlist, dependency, Production repair, or unrelated change was approved.
- Source commit `be61b684b8d278c9e3ca69e5cf4f0f313bd4813e`, tree
  `22296e88b9dafbfe369ae559257ac5900aac3c36`, was committed and pushed only after
  all Localhost gates passed. It uses one draft-fingerprinted authoritative preview
  across Steps 4 and 5, invalidates/aborts stale preview work, blocks transition or
  confirmation without fresh evidence, and submits the same revision/baseline
  evidence used for the displayed gross/discount/final amount. Progressive never
  falls back visibly to Legacy `totalBatchPrice`; Legacy paths remain intact.
- A narrow authenticated read model at `/api/bookings/availability` reports only
  canonical ids, capacity, active occupancy, remaining seats, and full state. The
  helper mirrors the locked RPC status/expiry rules, excludes cancelled,
  rescheduled-source, walleted, expired-pending, and inactive rows, and ignores the
  stale `schedule_slots.current_students` cache. Full selections are disabled or
  invalidated, other valid selections remain, and fresh availability is required
  before Summary/confirm. The RPC remains final authority; capacity races return
  Thai customer copy, refresh availability, and return to selection.
- Exact source/test files: `.gitignore`, `package.json`, `package-lock.json`,
  `playwright.booking.config.ts`, `scripts/check-booking-entry-runtime.mjs`,
  `scripts/check-booking-slot-availability.mjs`,
  `scripts/check-progressive-booking-entry.js`,
  `scripts/check-progressive-legacy-baseline.js`,
  `src/app/api/bookings/availability/route.ts`, `src/app/api/bookings/route.ts`,
  `src/components/dashboard/booking-client.tsx`,
  `src/lib/booking-slot-availability.ts`, and the four files under
  `tests/booking-regression/`.
- Executable gates passed: availability `8`, booking runtime `1`, Progressive
  pricing `17`, booking entry `31`, Option A baseline `32`, concurrency `8`,
  transactions `33`, coupon `38`, payment batches `39`, payment integration `18`,
  notifications `16`, Legacy pricing/payment `14`, plus `6/6` rendered Playwright
  scenarios. Total deterministic/runtime checks were `255`. TypeScript, lint,
  mojibake (`227` files), build (`91` routes), `git diff --check`, and the required
  post-build `.next` cleanup/restart/root/static/authenticated smoke passed.
- Disposable actual flow proved Step 4 `2,000`, Step 5 `2,000`, preview baseline/
  cumulative `4/8`, rate `500`, and created Booking total `2,000` with four
  sessions. Historical Legacy entitlement `4` / stored `2,500` remained unchanged,
  unscoped, and unsnapshotted. Coupon rendered `2,000/200/1,800` consistently.
  Restored drafts recalculated with no `1,500` flash; stale preview responses could
  not win. Adult, Private, and Entry-off Legacy remained unchanged.
- Capacity fixtures proved `5/6` selectable/create success, `6/6` disabled with
  forced typed atomic `409` and no partial financial/business rows, mixed/restored
  drafts preserving valid selections, and a `5/6 -> 6/6` race refreshing to Thai
  customer copy. Application console/page/hydration error counts were zero.
  Teardown reset fixtures and auth; residue count was `0`.
- The exact tested source was deployed from a clean detached worktree as
  `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn`, Ready on all four Production aliases. `/`
  and a generated static asset returned `200`; unauthenticated preview and
  availability returned `401`. Entry remained exactly `true`, allowlist absent,
  four dependencies and shared `SLIPOK_TEST_MODE` exactly `true`, migration
  `20260713210000` applied once, and capabilities unchanged.
- Protected pre/post Production comparison passed `23/23` count plus complete
  SHA-256 fingerprints. Covered counts included bookings `519`, sessions `2,793`,
  scopes `2`, receipts `3`, coupon reservations/usages `0/0`, batches/members
  `4/4`, attempts/allocations `1/1`, payments `470`, Ledger `471`, wallet `61`,
  attendance `1,630`, notifications `16,323`, tiers `11`, Finance `1`, snapshots,
  existing Progressive targets, approved batch, and the repaired booking.
  UAT-attributable Production business-data delta was exactly `0`.
- Deployment monitoring found no 5xx, error-level events, baseline/revision/
  dependency faults, or live SlipOK activity. No Production create request or
  confirmation was issued in this round.
- The in-app browser and Chrome bridges failed to bootstrap. The Computer Use
  fallback could list Chrome but explicitly stopped before navigation because it
  could not determine the current Windows browser URL with sufficient confidence.
  Therefore authenticated Production Step 4/Step 5 `2,000`, full-slot UI,
  Adult/Private UI, existing History/batch readability, response PII inspection,
  and browser console/hydration proof for the new deployment remain
  `Unknown / Need verification`. No unsafe manual continuation was attempted.
- No deployment rollback criterion was observed, so the healthy deployment remains
  active and rollback to `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS` was not used. Customer
  impact is the deployed source correction; financial impact this round is none.
  Production data changed: **no**. Data repaired: **no**. Task Done: **no**.
  Homepage LV Copy Audit/Fix remains paused.
- Current classification:
  **BLOCKER - PRODUCTION AUTHENTICATED NO-WRITE UAT COULD NOT BE COMPLETED;
  DEPLOYMENT HEALTHY, PRODUCTION DATA DELTA 0; TASK NOT DONE**.

#### 2026-07-14 - History Payment Selection 409 / Modal-State Read-Only Audit

- Owner supplied authenticated Production evidence that the Booking correction is
  visibly correct: Step 4 and Step 5 both show `2,000`, Legacy baseline `4`, new
  sessions `4`, cumulative `8`, rate `500`, and no Legacy-money deduction. Scoped
  result: **PASS - PRODUCTION STEP 4/STEP 5 PRICE UI VERIFIED**. During the next
  History check, selecting `3,464 + 866 = 4,330` produced visible 409 Network rows
  while a two-item slip modal also appeared. Owner authorized read-only audit plus
  documentation only and prohibited replay, slip upload, batch/Booking/payment
  mutation, source/test change, migration, deploy, environment change, or repair.
- Gate 0 matched exactly: branch `spike/next-major-security-upgrade`, local/remote
  HEAD `be5c6014a4994930bf178e3e7a0c415c845046f6`, functional source
  `be61b684b8d278c9e3ca69e5cf4f0f313bd4813e`, tree
  `22296e88b9dafbfe369ae559257ac5900aac3c36`, Ready deployment
  `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn` on four aliases, Entry `true`, allowlist
  absent, four dependencies and shared Test Mode `true`, migration
  `20260713210000` once, and all four capabilities Ready at expected versions.
  Only unrelated unstaged `AGENTS.md` remained dirty.
- The approved Chrome connector failed twice during bootstrap before reading or
  changing any tab. No reload/navigation/request occurred. Original Network
  payload, response JSON/headers, trace id, idempotency keys, duplicate-payload
  proof, and one-click request count remain `Unknown / Need verification`.
- Exact route was `POST /api/progressive-payments/prepare`. Bounded 13:38-13:43
  Asia/Bangkok logs expanded to the complete 13:40:50.201-13:41:36 window:
  prepare `11` (`200 x5`, `409 x6`) and cancel `200 x5`. Every event was served by
  `dpl_2GQ4...`. There were no upload, submit, status, 5xx, error-level, or SlipOK
  events. Prepare results in order were `200, 409, 409, 200, 409, 200, 409, 200,
  409, 409, 200`; each successful modal was closed and followed by its own cancel.
- Exact selection:

  | Booking | Amount | Progressive order | Eligibility |
  | --- | ---: | --- | --- |
  | `c917f5f6...` | `3,464` | entitlement `8`, sequence `1`, scope revision snapshot `9` | owned, pending, unexpired, prefix member 1 |
  | `1a7d58f8...` | `866` | entitlement `2`, sequence `2`, scope revision snapshot `10` | owned, pending, unexpired, prefix member 2 |

  Both are child Kids Group bookings for July 2026, same User/child/course/month
  scope `c1285993...`, different branches, no coupon, and no Legacy/Progressive
  mix. Their sessions are future scheduled rows with no attendance or wallet
  credit. Neither has a Legacy payment, verification attempt, allocation, Ledger
  row, or active batch member. They are the complete active pending prefix in
  `created_at, id` order; choosing one or both is valid policy.
- The server contract first validates same User/scope and exact prefix, then guards
  expiry, active member/lock, existing payment, attendance/wallet/started session,
  coupon snapshot, amount, scope lock, and revision under advisory/row locks.
  Prepare writes batch/member/scope-lock/activity rows only after all validation.
  The actual 409 was not prefix or selection rejection. Timeline proof shows every
  409 followed a committed `user_cancelled` batch that increased scope revision;
  the still-rendered page sent the earlier revision, so line 408-409 of the prepare
  RPC raised `PROGRESSIVE_SCOPE_REVISION_CONFLICT`. The six exception transactions
  rolled back before insert/update. Original response body is unavailable, but the
  internal typed cause and route mapping are proven by source plus revision/action
  timestamps.
- Current prepare HTTP mapping is narrower than the RPC guard set:

  | Guard/code | Current HTTP | Meaning |
  | --- | ---: | --- |
  | `PROGRESSIVE_SCOPE_REVISION_CONFLICT` | 409 | stale client scope revision; observed and valid |
  | `PROGRESSIVE_PAYMENT_PREFIX_REQUIRED` | 409 | selection skipped an earlier pending member |
  | `PROGRESSIVE_BOOKING_EXPIRED` | 409 | pending booking expired |
  | `PROGRESSIVE_COUPON_STATE_CONFLICT` | 409 | reservation snapshot/state mismatch |
  | `PROGRESSIVE_IDEMPOTENCY_CONFLICT` | 409 | key reused with different fingerprint |
  | `PROGRESSIVE_USER_MISMATCH` / `PROGRESSIVE_UNAUTHORIZED` | 403 | wrong scope owner or ownership safeguard; mixed/cross-scope ids normally fail the earlier prefix guard |
  | dependency unavailable | 503 | required server flags absent |
  | `PROGRESSIVE_SCOPE_LOCKED`, `PROGRESSIVE_PAYMENT_EXISTS`, `PROGRESSIVE_BOOKING_NOT_PENDING`, `PROGRESSIVE_BATCH_AMOUNT_MISMATCH`, capability mismatch | 500 | valid guards currently not mapped to customer conflict status |

  An active prepared/submitted/review batch or active member therefore protects the
  scope; prepare itself does not lazily cancel an old prepared batch before checking
  the scope lock. Status/cancel/upload paths perform lazy expiry. This limitation
  did not trigger here because every successful batch was explicitly cancelled.
- Client root cause is lifecycle/error presentation in
  `src/components/dashboard/history-client.tsx`:
  - Lines 827-870 build one scope group and enforce a local prefix by slicing the
    ordered bookings. The button disables on React `loading`, but there is no ref-
    based synchronous re-entry lock.
  - Lines 465-496 POST prepare and open the modal only after `response.ok` and a
    real authoritative batch. Lines 497-500 do not open it on failure.
  - Lines 540-550 close first, cancel a prepared batch, and refresh, but never set
    a cancel/refresh loading state or clear `progressiveBatch`, `payBookingIds`, or
    `authoritativeBatchTotal`. The underlying button can therefore submit stale
    revision props before refresh completes.
  - Prepare failure stores the raw server message in `error`, but the only rendered
    error blocks are inside the closed payment/detail dialogs (1108-1112,
    1252-1255). The customer sees no useful Thai stale-revision message.
  - The progressive modal total uses authoritative batch total (784-789,
    1094-1095). The observed `4,330 / 2 items` came from one of two valid successful
    batches, not a failed prepare. The source can nevertheless retain a cancelled
    batch id behind a closed modal because close does not clear state.
- Incident batches were exactly five: totals `3,464`, `4,330`, `3,464`, `4,330`,
  `3,464`, at scope revisions `10` through `14`. All five are now `cancelled` with
  reason `user_cancelled`; seven member rows are inactive; slip metadata is null;
  attempts/allocations are absent. Scope revision is now `15`, lock owner/time are
  null, and no active prepared/submitted/under-review batch exists. There was no
  lazy expiry and no current batch/scope repair requirement.
- Failed-prepare atomicity: all six 409s produced zero batch/member/scope/Booking/
  session/receipt/coupon/payment/attempt/allocation/Ledger/wallet/attendance/
  notification/Finance/activity/storage change. Successful actions in the same
  incident are separate: five batches and seven members were inserted, five
  cancellations made those members inactive, ten activity logs were written, and
  scope revision advanced `10 -> 15`. No slip object exists and upload from any
  now-cancelled id would be rejected before storage by the upload route's status
  preflight.
- Reconciliation from the prior protected baseline at 05:25:27Z found five new
  bookings/22 sessions: four bookings/18 sessions belonged to the authenticated
  UAT User and one booking/four sessions was unrelated. The UAT User made four
  creates, two Booking cancels, nine batch prepares, and nine batch cancels in the
  wider window. The one new Legacy payment, 50 notifications, and four activity
  rows were unrelated. Current relevant counts are bookings `524`, sessions
  `2,815`, scopes `3`, mutation receipts `9`, batches/members `13/17`, attempts/
  allocations `1/1`, payments/Ledger `471/472`, wallet `61`, attendance `1,630`,
  notifications `16,373`, tiers `11`, Finance `1`, and activity logs `6,386`.
- Customer impact: repeated stale-revision retries, an apparently contradictory
  409 beside a modal created by a different successful request, and no visible
  typed error. Financial impact: none; no slip/payment/coupon/allocation/Ledger/
  Finance write occurred. Incident Production data did change through valid
  prepare/cancel lifecycle rows; this read-only audit itself changed none.
- Smallest safe source proposal, pending Owner approval: synchronous prepare and
  cancel/refresh guards; clear stale batch/member/total state; refresh and show Thai
  copy for typed revision conflict; render/enable Progressive upload only with a
  current authoritative `prepared` batch id; return structured typed codes and map
  remaining payment guards appropriately. Preserve same-scope contiguous prefix,
  lock/revision/idempotency, coupon, Payment, Ledger, and allocation semantics.
  No migration, unlock, batch repair, or Production data repair is indicated.
- Source/tests/commit/deploy/environment/migration changed by this audit:
  **no/no/docs-only pending/no/no/no**. Entry/dependencies/Test Mode remain true;
  allowlist absent. Classification:
  **PRODUCTION REGRESSION AUDITED - VALID SERVER 409 + CLIENT MODAL BUG; SOURCE
  FIX OWNER APPROVAL REQUIRED**.

#### 2026-07-14 - History Payment Lifecycle Fix and Controlled Production UAT Closeout

- Owner approved the audited smallest boundary: explicit client lifecycle and
  reconciliation, safe structured error mapping/Thai copy, executable rendered
  History tests, disposable/local E2E, exact-source commit/push/deploy, and two
  controlled Production prepare/cancel cycles for the exact `3,464 + 866` prefix.
  The approval did not include slip upload/submission, Payment, verification
  attempt, allocation, Ledger, Finance, coupon, Booking, migration, environment,
  Entry, allowlist, dependency, formula, policy, guard, or data-repair changes.
- Changed source/test files in commit
  `7d98b062f850a4210fae052cefddd92b994889b8` (tree
  `73294ca5419582492fa558623d395c5b3801af5e`):
  - `src/components/dashboard/history-client.tsx`;
  - `src/lib/progressive-payment-route.ts`;
  - `src/app/api/progressive-payments/prepare/route.ts`;
  - `package.json` and `playwright.history.config.ts`;
  - `tests/history-payment-regression/global-setup.ts`, `global-teardown.ts`,
    `local-supabase.ts`, and `history-payment.spec.ts`.
- Client contract now uses `idle | preparing | prepared | cancelling | refreshing
  | conflict | failed`, a synchronous operation ref, stale-generation rejection,
  server-revision reconciliation, immediate upload-evidence invalidation on close,
  and exact scope/member/amount checks before the modal/upload path. A conflict
  refreshes once without retry, retains safe selection, and renders the Thai main-
  surface message instead of exposing a raw RPC code. Cancel failure keeps the
  uncertain batch blocked until authoritative refresh/resume. The RPC remains the
  final same-scope/prefix/revision/idempotency authority.
- Structured route mapping now returns stable `{ code, error, refreshRequired }`
  for known 400/403/404/409/503 cases, including scope revision/lock, prefix,
  expiry, coupon/idempotency, existing payment, pending-state, amount/fingerprint,
  currency, batch state, and capability/dependency errors. Unknown internals remain
  a safe 500 and SQL/stack text is not exposed.
- Executable result: `248` unique checks passed. Deterministic/runtime suites were
  `244` total (payment batches `39`, integration `18`, notifications `16`, pricing
  transactions `33`, coupon `38`, Legacy `14`, SlipOK `6`, booking entry `31`,
  Option A `32`, pricing `17`) and rendered History E2E was `4`. E2E passed both
  before and after build cleanup/restart. TypeScript, lint, mojibake (`227` files),
  build (`91` routes), root/static smoke, and `git diff --check` passed. Console,
  page, and hydration errors were `0`; disposable fixture residue was `0`.
- Local E2E covered one physical rapid double click producing one prepare, current
  authoritative `4,330 · 2 รายการ` modal, cancel/revision wait/re-prepare, forced
  stale revision with typed 409/Thai recovery/no modal/no auto-retry, cancel-failure
  safe reconciliation/resume, and real RPC valid/skipped-prefix behavior. No slip,
  Payment, attempt, allocation, Ledger, or Finance artifact remained.
- The source commit was pushed to `origin/spike/next-major-security-upgrade` and
  deployed as `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`, Ready on all four aliases. Root
  and generated static asset returned `200`; unauthenticated prepare with valid
  origin returned `401`. Two earlier deployment attempts
  (`dpl_2x6buY9UgAacgLBsAZ4EZHvPBL8t` and
  `dpl_GyFfc9KgfK9bGU3hSDCWBrpaweVk`) were rolled back to
  `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn` before UAT because Vercel link metadata made
  their detached worktrees fail the exact-clean gate. Neither attempt caused a
  Production business-data write. The final detached worktree stayed clean at the
  exact tested commit/tree.
- Controlled Production UAT selected `c917f5f6...` and `1a7d58f8...` only. Two
  physical prepare clicks returned `200 x2`; both modals showed `4,330 · 2 รายการ`;
  no 409 occurred. Two closes produced cancel `200 x2`; selection/prepare/upload
  controls stayed disabled until each RSC revision refresh completed. No file was
  selected and upload/submit/SlipOK was never invoked. Browser console/hydration
  count was zero.
- Exact UAT data result: two new batches (`b4691d68...`, `818833a6...`) are
  `cancelled`, each total `4,330`, member count `2`, revisions `15`/`16`, and all
  slip fields null; four new member rows are inactive; scope revision is `17` with
  no lock. This is the approved `+2` batch, `+4` member, `+4` activity, `+2`
  revision lifecycle delta. Booking `525`, sessions `2,819`, receipts `10`, coupon
  rows `0/0`, attempts `2`, allocations `2`, payments `472`, Ledger `474`, wallet
  `61`, attendance `1,636`, tiers `11`, and Finance `1` retained their complete
  protected fingerprints. A different user's coach check-in activity and reminder
  notification were separated by timestamp/user/entity as unrelated real activity.
- Production controls remained Entry `true`, dependencies `true/true/true/true`,
  allowlist absent, and shared `SLIPOK_TEST_MODE=true`. Migration
  `20260713210000` remained applied once. Pricing capability stayed Ready/version
  `2`/`immutable_scope_v1`; coupon, payment batch, and integration stayed Ready/
  version `1`. Monitoring found prepare/cancel `200 x2/x2`, zero 409/5xx/error/
  upload/submit/SlipOK, and no final rollback criterion.
- Customer impact: stale revision and duplicate re-entry can no longer expose an
  invalid slip modal; users see a clear Thai recovery path. Financial impact:
  none. Data repair: none. Final classification:
  **PASS - HISTORY PAYMENT LIFECYCLE FIXED; LOCAL E2E AND CONTROLLED PRODUCTION
  UAT PASSED; TASK DONE**. Homepage LV Copy Audit/Fix is unpaused as the next task
  and was not started in this round.

## Phase 0 - Baseline & Readiness

- [x] Confirm current app runs locally with real Supabase project.
- [x] Confirm `.env.local` contains all required values on this machine.
- [x] Confirm registration creates `profiles.phone` correctly.
- [x] Confirm Supabase Storage buckets and policies are ready for payment slips and uploads.
- [x] Set up Supabase CLI locally or choose a manual migration baseline path.
- [x] Create a baseline database migration/snapshot from the current remote schema.
- [x] Confirm local migration history matches the remote project before adding new DB changes.

Notes:
- Supabase CLI is initialized and linked to project `tvnhholicwjtxdhlxfqs`.
- Baseline migration created at `supabase/migrations/20260506082635_current_remote_baseline.sql`.
- Local and remote migration history both show `20260506082635` as applied.
- `payment-slips` is a public Storage bucket with upload/select policies, and user history links to `payments.slip_image_url`.

## Phase 1 - Core UAT

- [x] User flow: register/login, dashboard, booking, payment slip upload, slip view.
- [ ] Admin flow: dashboard, users, coaches, bookings, payments, coupons, complaints.
- [ ] Coach flow: dashboard, today, check-in, attendance, student levels, teaching programs.
- [ ] Head coach flow: assign coaches to teaching slots.
- [ ] Super admin flow: settings and activity logs.
- [ ] Record bugs found during UAT with severity.

## Phase 2 - Blocking Fixes

- [x] Admin overview dashboard compact KPI cards and monthly schedule overview.
- [x] Admin payments audit dashboard for SlipOK-driven payment review and slip viewing.
- [x] Admin schedules operation calendar with monthly filters and daily drill-down.
- [x] Admin users management dashboard with role-safe editing and learner details.
- [x] Admin coaches management dashboard with head coach self-assignment clarity.
- [x] Admin branches operations dashboard with branch status, coach coverage, and booking overview.
- [x] Admin makeup sessions dashboard with overdue detection and one-time next-month makeup creation flow.
- [x] Admin coach check-in audit by teaching slot with mandatory selfie/photo evidence.
- [x] Admin coach payroll review based on assigned teaching slots, verified check-in evidence, and weekly OT rules.
- [x] Admin finance manual expenses for real monthly/yearly net income tracking.
- [x] Admin schedule templates moved to a dedicated "รอบเรียนประจำ" menu, seeded from legacy hardcoded schedules, and booking/makeup flows use DB templates before hardcoded fallback.
- [ ] Fix any auth/session/profile issues.
- [ ] Fix any booking/session/payment data issues.
- [ ] Fix any Storage upload or public URL issues.
- [ ] Fix any coach assignment/check-in/attendance issues.
- [ ] Fix any role/RLS permission issues.

## Phase 2.5 - Admin/System Execution Queue

**Current source of truth for the next Admin/System work.** Work through this queue one item at a time. Do enough checking to confirm the touched flow still works, but do not loop into broad redesigns or repeated QA before the main process/function tasks are complete.

- [x] 1. User Profile Settings for every role
  - Users can edit their own name, phone, avatar, and password.
  - Email must not be editable because it is the login username.
  - Avatar should update `profiles.avatar_url` and be reused by sidebar/ranking/profile surfaces.
- [x] 2. Pricing Settings
  - Super Admin can edit course price tiers through the system.
  - User Booking should use DB settings as the source of truth, not hardcoded pricing.
- [x] 3. Coach OT Settings
  - Super Admin can edit weekly OT threshold and OT rates.
  - Payroll and Finance should read these settings instead of constants.
- [x] 4. Settings Workspace UX
  - Replace the raw Key/Value JSON settings list with user-friendly section panels.
  - Default section should be Admin Menu Permissions.
  - Reuse existing Admin Menu Permissions, Level Settings, Pricing Settings, and Coach OT Settings UI.
  - Keep raw JSON settings hidden from the normal Super Admin workflow; reserve it for developer/debug use only if needed.
- [x] 5. Schedule Templates as DB Source of Truth
  - Confirmed remote DB has 653 active schedule templates, matching the legacy seed migration.
  - User Booking, Reschedule, and Makeup flows now resolve slots from DB templates without hardcoded schedule fallback.
  - Legacy `branch-schedules.ts` remains only as a label/reference file until the remaining imports are cleaned up later.
- [x] 6. Remove Admin Booking Entry Points
  - Admin/Super Admin must not book on behalf of users.
  - Users must create bookings and complete payment themselves.
  - Old `/admin/booking` page now redirects to `/admin`.
  - Old `POST /api/admin/booking` now returns `410 Gone`.
  - Removed the unused Admin booking client component so the cancelled flow is not accidentally reused.
- [x] 7. Coach Teaching Hours / Weekly OT Refactor
  - Rename the Admin menu from "เงินเดือนโค้ช" to "คำนวณชั่วโมงสอน".
  - Keep the existing Head Coach / Coach role and permissions unchanged; the new coach type is payment logic only.
  - Add independent coach employment type: `full_time`, `half_time`, `part_time`.
  - Full-Time: weekly threshold 25 hours; OT Private 400 THB/hour, Group 200 THB/hour.
  - Half-Time: weekly threshold 12.5 hours; OT Private 400 THB/hour, Group 200 THB/hour.
  - Part-Time: no threshold; pay weekly teaching hours directly; Private 400 THB/hour, Group 250 THB/hour.
  - Calculate from verified teaching evidence only: assigned teaching slot + coach check-in + mandatory photo evidence.
  - Base salary is outside this system; this page summarizes weekly teaching hours and extra/payable teaching amounts for the owner.
  - Existing monthly `coach_payouts` implementation is superseded by this weekly teaching-hour model and must be refactored before continuing Coach/User work.
  - Added `profiles.coach_employment_type` and `coach_weekly_teaching_summaries` as the new weekly summary/audit source.
  - Coach management can set employment type without changing Head Coach / Coach role.
  - Admin teaching-hours page now closes weekly summaries from verified teaching slots and stores a server-side snapshot.
- [x] 8. Finance Business Overview Completion
  - Improve monthly/yearly business view with revenue, expenses, OT, net result, branch/course breakdown, and export-ready summaries if needed.
  - Finance now reads coach cost from closed `coach_weekly_teaching_summaries` instead of recalculating OT from live assignments.
  - Monthly/yearly view summarizes approved revenue, closed coach teaching pay, manual expenses, net result, branch/course revenue, coach cost, and monthly trend.
- [x] 9. Admin Menu Permissions QA
  - Verify regular Admin sees only menus allowed by Super Admin and cannot access hidden routes directly.
  - Admin menu labels/settings copy were normalized back to readable Thai for the permission workspace.
  - Added API-level guards for configurable Admin menu domains so hidden menus cannot be used through direct endpoint calls.
  - Mobile notification badge now respects the Admin notification menu permission.
- [x] 10. Admin Ranking QA and Useful Filters
  - Verify Ranking data, avatars, Level 0/default state, child/adult tabs, branch source, and latest Coach/Admin evaluation.
  - Public ranking must support read-only filters, including branch filter, learner type, and level/rank view.
  - Public users can see who is in each branch, each student's rank within that branch, and their overall NA rank.
  - Add branch summary for both public/admin views: selected branch top student, selected branch count, and overall NA top student/level for comparison.
  - Keep ranking source based on latest Coach evaluation in `student_levels`; students with no evaluation must stay at Level 0.
  - Admin and Coach can update student level/rank; public users can only view.
  - Add achievement/badge plan for students who competed or won awards. Prefer a dedicated `student_achievements` data source with emoji/title/description/is_active instead of storing badges in level notes.
  - Admin and Coach can manage achievement emoji/badges; public users can only view active badges.
  - Show achievement emoji after the student name on both public and admin ranking, with achievement detail available in a tooltip/detail area.
  - Keep responsive layout readable on mobile: compact filters, small KPI summary, and ranking rows that do not become too tall.
  - Implemented dynamic branch filters from `branches`, overall NA rank, selected-branch rank, public read-only ranking, and Admin achievement management.
  - Added `student_achievements` table/API for active public badges. Coach UI for managing badges should be wired in the Coach/Level flow.
- [x] 11. Level Settings to Coach Evaluation Flow
  - Confirm Super Admin Level settings feed Coach level evaluation and public/admin ranking consistently.
  - Coach evaluation now uses active Level rows from `levels` as the selectable source of truth instead of free typing from hardcoded copy.
  - `/api/coach/levels` validates that the selected Level exists and is active before writing to `student_levels`.
  - Public/Admin Ranking now resolves the latest evaluated Level against `levels` so edited Level names are reflected in ranking display.
  - Added shared student achievement management for Admin Ranking and Coach Level flow, with preset trophy/medal emoji options ready for awards.
  - Repaired Thai copy in Level constants, Admin Level settings, Coach Level evaluation, and Ranking surfaces touched by this flow.
  - Level settings must be extensible beyond LV 70: Super Admin can add LV 71+ rows, while Coach evaluation can only select active rows from `levels`.
- [x] 12. Admin Regression and Responsive Pass
  - After items 1-11 are completed, run a focused pass on Admin desktop/mobile layout and critical flows.
  - Added Admin shell width guards (`min-w-0`, max readable canvas) so wide tables/cards do not force horizontal overflow under the sidebar.
  - Adjusted Admin schedule calendars and dashboard schedule cards for mobile: compact month labels, shorter day cells, and desktop split layout only at very wide screens.
  - Moved heavy table/grid layouts on Payments, Users, Coaches, Complaints, Makeup, Payroll, and Level Settings to wider breakpoints so tablet/mobile use stacked cards instead of cramped pseudo-tables.
  - Verified `npm run check:mojibake`, `git diff --check`, and `npm run build`; build passes with existing lint warnings from Coach/User areas still tracked as separate technical debt.
- [x] 13. Apply Admin/System DB Migrations
  - Push/apply the committed Supabase migration for extensible Level constraints before relying on LV 71+ in the live DB.
  - Confirm remote DB has the schema needed by recent Admin/System work, including Level extension and coach weekly teaching summary fields.
  - Do this before continuing broad Coach/User feature work so app code and DB constraints do not drift.
  - Applied remote migration `20260515093000_make_levels_extensible.sql`; local and remote migration history now match through `20260515093000`.
  - Remote schema check confirmed Admin/System tables/fields used by recent work exist: `profiles.coach_employment_type`, `coach_weekly_teaching_summaries`, `schedule_templates`, and `student_achievements`.
  - Supabase CLI read-only count/constraint queries timed out intermittently after migration, but migration history confirms the constraint migration was applied successfully.
- [x] 14. Admin/System Smoke Test After Migration
  - Verify the committed Admin flows against the real DB: Settings workspace, Admin menu permissions, Level settings, Pricing settings, Coach teaching rules, User management, Schedule templates, Ranking, Finance, and responsive mobile layout.
  - Record only real blockers found during this smoke test; avoid repeated redesign unless a main flow is broken.
  - Verified `npm run check:mojibake` and `npm run build`; production build passes with existing Coach/User lint warnings still separated as technical debt.
  - Verified remote migration history matches local through `20260515093000`.
  - Verified remote DB read sanity with service role: branches 7, course types 3, pricing tiers 11, levels 70, active schedule templates 702, profiles 7, payments 6, student achievements 5.
  - Verified `/api/health` on localhost returns 200 after restarting the stale dev server.
  - Verified public Home and Ranking render after restart; Admin routes redirect unauthenticated users to login with redirect params.
  - `coach_teaching_rules_settings` is not yet stored in `system_settings` until Super Admin saves the Coach OT settings once, but current code has default fallback so this is not a blocker.
- [x] 15. Start Coach-First / User-Last Completion Queue
  - After Admin/System DB and smoke test are stable, continue with Coach/User work.
  - Work through this queue in order: finish Coach flows and Coach QA first, then User flows last. Admin/System is now the stable base; only touch Admin/System for real blockers found while connecting Coach/User flows.
  - Realistic Supabase seed data is available for development via `npm run seed:realistic`, with verification via `npm run seed:verify`. Seed accounts use `seed.nasc+...@example.com` and are tagged with `NASC_SEED` where tables support notes/details.
  - [x] 15.1 Coach Level Evaluation + Achievement
    - Coach must see all students they are responsible for.
    - Coach can evaluate student Level from active master `levels`, not free text or hardcoded ranges.
    - Coach can add/disable award emoji badges after student names.
    - Public Ranking, Admin Ranking, and Coach Ranking/Level views must display the same latest Level and active achievements.
    - Implemented assignment-first coach student access: regular Coach sees assigned students only; Head Coach can fall back to branch students when no direct assignment exists.
    - Level and achievement APIs now verify that Coach/Head Coach is allowed to manage the selected student; Admin/Super Admin keep all-access behavior.
    - Active achievements continue to flow through shared `student_achievements`, so Public/Admin/Coach ranking surfaces use the same award source.
  - [x] 15.2 Coach Teaching Flow
    - [x] 15.2.0 Coach-Student Memory / Suggested Coach
      - Read coach-student history from real `coach_assignments` + `booking_sessions`, not manual-only preference.
      - Show Head Coach/Coach which coaches a learner has studied with, including last taught date and total sessions together.
      - If a learner studied with multiple coaches, show all history; suggest the strongest/default coach without blocking Head Coach override.
      - Keep User booking user-owned. This memory only helps assignment after booking, not Admin booking on behalf of users.
      - Use this memory to reduce repeated manual assignment for learners who regularly study with the same coach.
      - Implemented shared `getCoachStudentMemoryMap` helper and wired it into Head Coach assignment plus Coach student views.
    - [x] 15.2.1 Coach Schedule from Real Assignments
      - Coach dashboard, today schedule, attendance, and check-in pages now read from `coach_assignments` first.
      - Removed branch-wide fallback from Coach schedule/attendance surfaces so Coach sees only assigned teaching slots.
      - Added shared `getCoachAssignedTeachingDay` helper to keep assigned slot, student, attendance, and check-in context consistent.
    - [x] 15.2.1.1 Coach Group Assignment by Student Level
      - Upgrade Head Coach assignment from "assign coach to slot" into "group learners inside a slot, then assign one coach per group".
      - Add DB migration for group assignment source of truth, likely `coach_assignment_groups` and `coach_assignment_group_students`.
      - Store group membership per `booking_session_id` so the system knows exactly which coach is responsible for which learner in each teaching round.
      - Show each learner with latest Level, learner type, parent/self context, coach history, and warning states such as no Level or mixed Level range.
      - Auto-suggest groups by Level bands and coach-student history, but keep Head Coach manual control to move learners, rename groups, add/remove groups, and change coach.
      - Keep User booking user-owned; grouping happens after booking/payment and is a Head Coach operation.
      - Preserve compatibility with existing `coach_assignments` during transition, but group assignment should become the main source for learner responsibility.
      - Implemented `coach_assignment_groups` and `coach_assignment_group_students`, pushed migration `20260515190000_add_coach_assignment_groups.sql` to Supabase, added Head Coach grouping UI, and added `/api/coach/assignment-groups`.
      - Group saves still sync selected coaches back to `coach_assignments` for transitional compatibility with existing Coach schedule/check-in pages.
    - [x] 15.2.1.2 Coach Assignment UX: day/slot picker + duplicate coach prevention
      - Head Coach assignment now uses a day picker first, then a slot picker, so one busy day does not render every teaching round and group editor at once.
      - The selected slot is the only slot expanded for group editing; other rounds stay as compact selectable cards with student count, course type, saved status, and warning badges.
      - Coach dropdown options are disabled/greyed when the same coach is already used by another non-empty group in the selected teaching round.
      - Save is blocked when a draft still has the same coach assigned to multiple groups in the same slot, matching the server-side duplicate coach validation.
      - Auto-group suggestions avoid assigning the same available coach to multiple Level groups in the same slot where possible.
    - [x] 15.2.1.3 Auto-suggest Draft Confirmation
      - Auto-suggest and manual grouping changes are shown as Draft until Head Coach clicks "บันทึก/ยืนยันกลุ่ม".
      - Coach-facing schedule/check-in/attendance surfaces continue to read saved assignment groups only; unsaved draft changes remain local to the Head Coach assignment screen.
      - Selected slot cards and the expanded editor show Draft versus saved assignment state clearly.
      - The save button changes to a confirmation action and is disabled once the current grouping already matches saved assignment data.
      - The "จัดตาม Level" action is labeled as Draft so Head Coach understands it is a suggestion, not an automatic assignment commit.
    - [x] 15.2.2 Coach Check-in Per Assigned Slot + Required Photo QA
      - Coach check-in is per teaching session/slot, not per workday, and must require photo evidence.
      - Check-in should remain tied to the assigned slot while learner responsibility comes from assignment groups.
      - Check-in API now validates the logged-in Coach/Head Coach, assigned slot/group responsibility, Bangkok current date, 30-minute-before to 30-minute-after-start check-in window, duplicate check-ins, and required image evidence.
      - Coach check-in UI uses front-camera capture only, removes browse/file picker entry points, requires GPS permission, and sends a camera-capture source flag with the selfie.
      - Check-in API requires valid GPS coordinates and rejects uploads that do not come through the camera-capture flow.
      - Attendance is locked until the assigned Coach/Head Coach has checked in for that specific teaching slot, so check-in evidence becomes required before marking learners.
      - Build and mojibake checks passed after the change.
    - [x] 15.2.3 Attendance From Coach Assignment Groups
      - Update Coach pages after the group model exists so `/coach/today`, `/coach/attendance`, `/coach/students`, and Level evaluation use learner-level group responsibility.
      - Attendance must write against the real `booking_sessions` records and the correct student/child.
      - Coach should only mark attendance for learners in their assigned group.
      - `getCoachAssignedTeachingDay` now prefers `coach_assignment_groups` / `coach_assignment_group_students`; legacy slot assignment is used only when a slot has no group assignment yet.
      - Attendance API validates the booking session, student identity, and coach group responsibility before writing attendance.
      - Coach dashboard, Today, Students, Check-in, and Attendance copy touched in this flow were cleaned back to readable Thai.
    - [x] 15.2.4 Weekly Teaching Hours Integration
      - Weekly teaching hours now connect to Admin "คำนวณชั่วโมงสอน" and use verified evidence only.
      - Added shared `getCoachTeachingHourSourceRows` source of truth: assignment groups first, legacy assignment fallback only when no group exists for the slot.
      - A teaching slot is counted only when it has assigned learners, Coach check-in, selfie/photo evidence, GPS location, and attendance records.
      - Admin payroll, weekly close API, Coach dashboard, and Coach hours page now read from the same verified source.
      - Payroll UI shows missing evidence buckets: no check-in, no photo, no location, and no attendance.
      - Build and mojibake guard passed; localhost smoke test for `/admin/payroll`, `/coach/hours`, and `/coach` returned 200 after restarting the dev server.
    - [x] 15.2.4.1 Coach Schedule Calendar Detail
      - `/coach/today` is now "ตารางสอนของฉัน" and accepts `?date=YYYY-MM-DD` to show any assigned teaching day.
      - Added a monthly calendar/detail view for Coach using saved assignment/group source data only.
      - Coach dashboard calendar days now link into `/coach/today?date=YYYY-MM-DD`.
      - Coach sidebar label changed from "รอบสอนวันนี้" to "ตารางสอนของฉัน" to match the expanded monthly workflow.
      - The selected day still shows the real assigned slots, assigned learner groups, check-in status, and learner list from `getCoachAssignedTeachingDay`.
    - [x] 15.2.5 Attendance UX From Schedule
      - `/coach/attendance` now accepts `?date=YYYY-MM-DD` and optional `?slot=...` so Coach can enter attendance from the selected teaching day/round.
      - `/coach/today` adds a per-slot attendance action after the Coach has checked in; locked slots point Coach to check in first when it is the teaching day.
      - Attendance UI clearly shows the selected date, selected slot state, all-day fallback, and a return path to "ตารางสอนของฉัน".
      - Attendance remains locked without the specific slot check-in, matching the API rule that weekly teaching hours require check-in, selfie/photo, location, and attendance evidence.
      - Coach schedule/attendance source now keeps `absent` sessions visible after marking a learner absent, so refresh does not make the learner disappear from the round.
  - [x] 15.3 Coach Completion QA Gate
    - Do this before any User feature work.
    - Housekeeping status on 2026-05-19: Coach/Admin completion gate is closed for the current development queue. Child items `15.3.1` through `15.3.8` and `15.4` are complete enough to move into User flow; keep any new Coach issues as regressions or follow-up bugs, not as a reason to restart the whole Coach queue.
    - Known QA limitation kept for context: direct Supabase seed sign-in works, authenticated HTTP QA passed, and unauthenticated browser route guards passed; the in-app Browser form automation did not complete the login redirect, so real logged-in browser QA should be repeated manually or with a stable browser session when available.
    - Recommended remaining execution order before starting User flow:
      - [x] 15.3.4 Coach pages high-volume UX pass
        - Goal: remove long endless Coach lists the same way Admin lists were cleaned up.
        - Check and improve `/coach/today`, `/coach/checkin`, `/coach/attendance`, `/coach/students`, `/coach/hours`, and `/coach/programs`.
        - Use compact summaries, filters, pagination, collapsible sections, and detail dialogs/drawers where needed.
        - Do not change the existing assignment/check-in/attendance/hour source of truth unless a real bug requires it.
        - Implemented: `/coach/programs` now paginates the template library and submitted program list; `/coach/levels` now paginates searchable learner evaluation rows; `/coach/checkin` now caps daily check-in history with expand/collapse controls; `/coach/students` keeps search/filter pagination capped at 12 learners per page.
        - Verified existing `/coach/today`, `/coach/attendance`, and `/coach/hours` already use selected-day, collapsible slot, or weekly grouping patterns, so this pass did not change their business flow.
      - [x] 15.3.5 Coach program flow final check
        - Verify one assigned teaching slot can have only one active teaching-program submission per Coach.
        - Verify draft/delete/revise/reuse template flows work correctly and do not create duplicate submissions.
        - Verify Admin review status and returned notes appear correctly back on `/coach/programs`.
        - Implemented/verified: Coach program API already blocks duplicate `coach_id + schedule_slot_id` submissions, only allows assigned slots, and only allows editing `draft`/`rejected` programs.
        - Added Coach UI action for `rejected` programs so Coach can revise and resubmit the original slot instead of creating a duplicate.
        - Program submit now closes the modal immediately and refreshes the server data, reducing accidental double-click resubmits while the server-side duplicate guard remains authoritative.
        - Confirmed draft deletion uses the in-app `AlertDialog`, template reuse/preset/reuse-old flow still feeds the same single program form, and Admin review notes/status are shown in the Coach program list/detail.
      - [x] 15.3.5.1 Coach Dialog Accessibility Cleanup
        - Fix Coach-side Radix Dialog warnings before the Coach QA gate: every `DialogContent` must include a `DialogTitle`.
        - Add a visible or visually-hidden `DialogDescription` / `aria-describedby` where needed so the console stays clean during authenticated browser QA.
        - Scope this cleanup to Coach pages/components touched by the Coach completion queue; do not redesign dialog flows or change business logic.
        - Implemented: Coach mobile sidebar `SheetContent` now includes an sr-only `SheetTitle` and `SheetDescription`, fixing the Radix Dialog title warning seen on `/coach`.
        - Implemented: Coach Level evaluation dialog now includes `DialogDescription`; Coach program dialogs already had titles/descriptions and were rechecked.
        - Verified with `npm run check:mojibake` and `npm run build`; remaining build warnings are existing User/Dashboard/API lint debt outside this Coach accessibility scope.
      - [x] 15.3.6 Coach check-in + attendance end-to-end
        - Verify the 30-minute before to 30-minute after teaching-start check-in window.
        - Verify selfie/front-camera capture, GPS/location requirement, duplicate check-in prevention, and assigned-slot validation.
        - Verify attendance remains locked when that specific slot has no valid Coach check-in.
        - Verify attendance writes are tied to real assignment groups and only allowed for responsible Coach/Head Coach.
        - Implemented: attendance now links locked slots directly to `/coach/checkin?slot=...`, and the check-in page preselects that exact assigned slot.
        - Implemented: Coach check-in UI shows the per-slot check-in window and disables submit outside the allowed 30-minute-before to 30-minute-after range while the API remains the authoritative guard.
        - Implemented: attendance updates the latest existing record instead of relying on `upsert` without a DB unique constraint, preventing duplicate attendance rows when Coach changes present/late/absent.
        - Implemented: shared Coach schedule reads attendance ordered by `checked_at`, so if older duplicate rows already exist the latest status wins in Coach UI.
        - Verified with `npm run check:mojibake`, `npm run build`, and unauthenticated browser route smoke for `/coach/checkin`, `/coach/attendance`, and `/coach/today`.
      - [x] 15.3.7 Coach level/ranking/achievement final check
        - Verify Coach can evaluate only learners they are responsible for.
        - Verify Level evaluation feeds Coach/Admin/Public ranking consistently.
        - Verify achievement emoji shows consistently on Coach/Admin/Public ranking and only authorized roles can manage it.
        - Verified: `/api/coach/levels` requires Coach/Head Coach/Admin/Super Admin and checks `canManageStudentForCoach` before writing `student_levels`.
        - Verified: `/api/student-achievements` uses the same `canManageStudentForCoach` guard for Coach/Head Coach, while Admin/Super Admin keep all-student access through the shared staff-all-access rule.
        - Verified: Coach Level page loads only students from `getCoachVisibleStudents`, then reads latest Level and active `student_achievements` for that visible set.
        - Verified: Public `/ranking` and Admin `/admin/ranking` share `RankingContent`/`RankingBoard`, read latest `student_levels`, active `student_achievements`, and dynamic branch filters from the same data source.
        - Verified: Public ranking has no achievement management action; Admin ranking can open the shared achievement manager; Coach manages achievements only from visible students in `/coach/levels`.
        - Verified with `npm run check:mojibake`, `npm run build`, and browser smoke for `/ranking`, `/admin/ranking`, and `/coach/levels`.
      - [x] 15.3.8 Coach regression
        - Run `npm run check:mojibake`, `npm run build`, and authenticated smoke tests for core Coach pages.
        - Verify mobile responsive for Coach dashboard, schedule, assignment, check-in, attendance, hours, students, and programs.
        - Commit and push after this gate passes.
        - Verified: `npm run check:mojibake` passed after the Coach regression pass.
        - Verified: Coach-scope scan found no native `alert/confirm/prompt`, no `<img>` usage, and no new `any` debt in Coach routes/components/libs.
        - Verified: `npm run build` passed. Remaining warnings are existing User/Dashboard/API/Auth lint debt outside this Coach regression scope.
        - Verified: unauthenticated route guard browser smoke still redirects Coach routes to login without console errors.
        - Verified: Supabase seed auth works for Head Coach seed account; Browser form automation did not complete the login redirect even though direct Supabase sign-in passed, so this is recorded as a tool/browser-smoke limitation rather than a Coach runtime error.
        - Fixed: Coach student list source filter now uses the real `assigned_slot` source value, so the "เคยได้รับมอบหมาย" filter can match students returned from assignment-slot history.
        - Seed QA note: `npm run seed:verify` executed against Supabase and duplicate coach/group slots remained `0`; current QA data has a small non-blocking drift from extra test rows (`assignment_groups` 197 vs 196, `assignment_group_students` 246 vs 245, `notifications` 32 vs 29).
      - After Coach is complete, start `15.5 User Booking / Payment / History` as the next major queue because User flow touches booking, pricing, coupon, SlipOK, schedule, and history together.
    - Verify Coach pages end-to-end with realistic Supabase data: `/coach`, `/coach/today`, `/coach/students`, `/coach/levels`, `/coach/assign-groups`, `/coach/checkin`, `/coach/attendance`, `/coach/hours`, and `/coach/notifications`.
    - Verify Head Coach can group learners by Level and coach history, assign coaches, and manually override suggestions.
    - Verify regular Coach sees only assigned learners/groups, cannot evaluate unrelated learners, and cannot mark attendance outside their responsibility.
    - Verify mobile responsive for Coach dashboard, group assignment, check-in camera/location, attendance, and hours.
    - Verify stale Next dev cache is handled by restart after build before browser checks.
    - Fix Coach-side mojibake, runtime errors, and warnings only in files that affect the Coach completion gate.
    - QA progress:
      - [x] Coach-side lint/mojibake pass: removed old `any`/mojibake debt from Coach programs and Coach assignment API without touching User flow.
      - [x] `npm run check:mojibake` passed.
      - [x] `npm run build` passed; remaining warnings are outside Coach scope and stay for the later User/shared debt pass.
      - [x] Cleared stale `.next` dev cache, restarted dev server, and confirmed localhost loads again after the known CSS/chunk cache failure mode.
      - [x] Unauthenticated route guard smoke passed for Coach routes: `/coach`, `/coach/today`, `/coach/students`, `/coach/levels`, `/coach/assign-groups`, `/coach/checkin`, `/coach/attendance`, `/coach/hours`, `/coach/notifications`, `/coach/programs`.
      - [x] Realistic seed data verification passed against Supabase.
      - [x] Expanded realistic seed data for authenticated Coach QA: 7 active branches, 7 Head Coaches, 21 Coaches, 21 Users, 21 children, 35 bookings, 245 booking sessions, 147 schedule slots, 196 assignment groups, 28 check-ins, 35 attendance rows, and cleanup command `npm run seed:cleanup`.
      - [x] QA note: first seed verification found stale seed state (`coach_assignments` expected 196, got 193). Reran `npm run seed:realistic`, then `npm run seed:verify` passed with 196 synced assignment groups and zero duplicate coach/group slots.
      - [x] Authenticated HTTP QA passed on production server for Head Coach and Coach routes: `/coach`, `/coach/today?date=2026-05-17`, `/coach/today?date=2026-05-18`, `/coach/attendance?date=2026-05-17`, `/coach/checkin`, `/coach/students`, `/coach/levels`, `/coach/hours`, `/coach/notifications`, `/coach/programs`; Head Coach `/coach/assign-groups` returned 200 and regular Coach `/coach/assign-groups` redirected to `/coach`.
      - [x] Attendance API guard passed with real seed data: assigned learner after check-in returned 200, unrelated learner returned 403, and assigned learner without slot check-in returned 403.
      - [x] Reran `npm run seed:realistic` after the attendance write tests and confirmed `npm run seed:verify` returned canonical counts again, including 35 attendance rows.
      - [x] Runtime note: production build/server was used for authenticated QA to avoid the known local dev stale `.next` chunk/CSS failure. No Coach route 500 was reproduced in production QA.
      - [x] Authenticated browser QA limitation documented: Head Coach/Coach screens passed authenticated HTTP QA, while the Browser form-login issue is a tool/session limitation to retry later, not a blocking Coach runtime bug.
  - [x] 15.3.1 Head Coach / Coach UX Hardening From QA
    - Completed before `15.4 Coach Notifications / Reminders`; this section is kept as historical implementation context for the Coach-side completion work.
    - Keep the existing assignment/check-in/attendance/hour source of truth intact. This pass should improve UX and workflow clarity without changing User booking ownership.
    - Assignment wording and status states:
      - Replace visible "Draft ยังไม่ยืนยัน" copy with "ยังไม่ได้มอบหมาย" where the round/group has not been saved into real assignment data.
      - Use clear saved state copy: "มอบหมายแล้ว" with a green check for slots/groups already saved.
      - If a saved assignment is edited locally before saving, do not call it "มอบหมายแล้ว"; show a separate "มีการแก้ไขยังไม่บันทึก" state so Head Coach does not confuse local changes with confirmed assignments.
      - Keep auto-suggest as a local recommendation only until Head Coach clicks save/confirm.
    - Head Coach assignment month-scale navigation:
      - Replace the short 7-day-only day picker with a month-aware planner that can handle real booking volume for the whole current month and future months.
      - Default to the current month, with previous/next month controls and quick filters for "ยังไม่ได้มอบหมาย", "มอบหมายแล้ว", branch, course type, and date range.
      - Day cards should summarize total slots, total learners, unassigned slots, saved slots, and warning severity.
      - Any day with at least one unassigned slot should show a red alert indicator; days with all booked slots assigned should show a green check.
      - After choosing a day, show slot cards grouped by time/course/branch with red alert for unassigned slots and green check for assigned slots, so Head Coach does not need to open each slot to discover work.
      - Keep only one selected slot expanded for group editing to avoid rendering a huge form for a busy month.
    - Assignment slot list at high volume:
      - Add status tabs or segmented control: "ต้องมอบหมาย", "มอบหมายแล้ว", "ทั้งหมด".
      - Add compact slot rows/cards with time, branch, course type, learner count, Level range, saved/unassigned state, and responsible coach names.
      - Preserve duplicate coach prevention: a coach already assigned to a non-empty group in the same slot must be disabled/greyed and blocked by server validation.
    - Coach attendance UX for busy days:
      - Attendance should group learners by teaching slot and assignment group, not show one long flat list.
      - Add a sticky daily slot summary at the top: total slots, checked-in slots, completed attendance, missing attendance.
      - Each slot card should show status: upcoming, open for attendance after check-in, completed, missing, or locked because Coach has not checked in.
      - For a day with 3 slots and 18 learners, show collapsible slot sections; expand the selected/active slot first and keep completed slots collapsed by default.
      - Past slots should not disappear. They should remain visible with their final status so Coach/Admin can audit attendance and weekly hours evidence.
      - Attendance actions should remain locked when there is no check-in for that specific slot.
    - Coach student list UX for more than 20 learners:
      - Replace the simple card list with searchable/filterable student management.
      - Add search by student name, parent name, phone, branch, Level, course type, and last taught date.
      - Add filters for assigned now, previously taught, active this month, Level band, child/adult, and branch.
      - Use pagination or incremental loading so the page does not become one huge scroll when a Coach has many historical learners.
      - Keep the coach-student memory visible: total sessions together, last taught date, latest Level, and current responsible group/slot where applicable.
    - Coach hours UX for many monthly rows:
      - Add month/week filters and a weekly accordion/table so a busy month does not become an endless vertical list.
      - Keep KPI cards compact, then show weekly summaries first; expand a week to see slot-level evidence.
      - Add evidence filters: complete, missing check-in, missing photo/location, missing attendance, not yet taught.
      - Keep the calculation source tied to verified assignment groups, check-in selfie/location, and attendance evidence.
    - Teaching programs workflow:
      - Split "โปรแกรมสอน" into reusable program templates and per-slot program submissions.
      - Coach can create, edit, archive, and reuse their own program templates, such as warm up, footwork, rally, or Level-specific drills.
      - When preparing for a real assigned slot, Coach selects one of their templates, can adjust details for that slot, then submits it to Super Admin/Admin review.
      - Program submission must link to the real `schedule_slot_id`, assignment group, coach_id, branch, date, time, course type, and learner group.
      - Coach should be able to see submission status: draft, submitted, reviewed/approved, returned for revision.
      - Super Admin/Admin review UI can come after Coach submission source is stable, but the DB/API should not be hardcoded to free text only.
      - All Coaches should submit teaching programs for all teaching systems/course types where they are assigned.
    - Seed and QA requirements for this hardening pass:
      - Expand or adjust realistic seed data to include at least one Head Coach day with 3 teaching slots and around 18 assigned learners, plus one Coach with more than 20 historical learners and a month with many teaching-hour rows.
      - Keep `npm run seed:cleanup` able to remove all generated seed data before deployment.
      - Verify `npm run check:mojibake`, `npm run build`, and authenticated Coach/Head Coach smoke tests after implementation.
    - Implementation status on 2026-05-17:
      - [x] Head Coach assignment now uses month-aware planning, status filters, red unassigned warnings, green saved checks, and clearer Thai status copy: unassigned, saved, and changed-but-unsaved.
      - [x] Duplicate coach prevention remains active: the seed verifier confirms `duplicate_coach_group_slots = 0`, and the UI keeps already-used coaches unavailable for another non-empty group in the same slot.
      - [x] Coach attendance now groups by assigned teaching slot and student group, adds daily summary cards, keeps past slots visible, and collapses busy days instead of rendering one long flat list.
      - [x] Coach student list now supports search, filters, and pagination for larger history lists.
      - [x] Coach hours now uses weekly summaries and expandable evidence rows instead of an endless monthly list.
      - [x] Teaching program submission is now linked to real assigned slots and can reuse preset/previous content before saving draft or submitting.
      - [x] Realistic seed verification passed after reseed: 7 branches, 7 Head Coaches, 21 Coaches, 21 Users, 245 booking sessions, 196 assignment groups, 28 check-ins, 35 attendance rows, and 28 teaching programs.
      - [x] Coach Program Template Library: add a persistent per-coach template table/API/UI so each Coach can create, edit, archive, and reuse their own teaching-program templates separately from per-slot submissions.
      - [x] Follow-up debt closed: Admin Payroll weekly close now uses an app dialog instead of the old `window.prompt`. Product UI must continue to avoid browser-native `alert`, `confirm`, or `prompt`.
  - [x] 15.3.2 Admin Teaching Program Review Page
    - Keep this in the Coach completion queue before moving to User flow.
    - Add an Admin/Super Admin page/menu for reviewing teaching programs submitted by Coaches.
    - Filters: status, coach, branch, date range, course type, and assigned slot.
    - Each row/card should show coach, branch, date/time, course type, learner group, submitted content, notes, and review status.
    - Admin/Super Admin can approve or return for revision with notes; Coach should see the result and revise only returned/draft items.
    - Notifications for submitted teaching programs should link to this review page instead of a generic admin log page.
    - Do not allow duplicate per-slot submissions: one Coach can have only one teaching program per assigned schedule slot.
    - Implementation status on 2026-05-18:
      - [x] Added Admin menu/page `/admin/teaching-programs` for filtering submitted programs by status, coach, branch, course type, and date range.
      - [x] Added detail view plus approve/return-for-revision actions using app dialogs, not browser-native alerts/prompts/confirms.
      - [x] Added Admin review API with activity logs and per-coach notifications back to `/coach/programs`.
      - [x] Coach submitted-program notifications now link directly to `/admin/teaching-programs`.
      - [x] High-volume UX pass: changed the review page from long stacked cards into a compact work queue with detail panel and pagination.
      - [x] Admin Ranking image runtime error from DiceBear seed avatars fixed by adding `api.dicebear.com` to the Next image allowlist.
      - [x] Admin Payroll high-volume UX pass: changed the long all-coach card list into a summary table with detail drawer, and replaced the weekly-close `window.prompt` with an app dialog.
  - [x] 15.3.3 Admin List UX Scalability Pass
    - Do this before closing Coach/Admin QA and before starting User flow, because Admin must monitor Coach workflow at realistic volume.
    - Goal: remove long endless Admin lists where data can grow daily or monthly; use compact queue/table, filters, pagination, and detail drawer/dialog instead.
    - Keep already-approved pages stable. Do not redesign pages that were recently accepted unless a real bug appears.
    - Priority 1: `/admin/coach-checkins`.
      - Default to today/week instead of dumping the whole month.
      - Add summary by coach and status: total assigned rounds, checked in, late, missing, missing photo/location.
      - Show abnormal items first and open slot/selfie/GPS evidence in a drawer.
      - Support date range, branch, coach, and status filters without rendering every row as a large card.
    - Priority 2: `/admin/logs`.
      - Replace the long card stream with compact audit table, pagination, and JSON detail drawer.
    - Priority 3: `/admin/notifications`.
      - Add pagination or compact queue for Admin inbox/history so broadcasts and event notifications do not become endless scroll.
    - Priority 4: `/admin/coupons`.
      - Replace high-volume coupon cards with a compact summary table and detail drawer for usage history.
    - Priority 5: `/admin/finance`.
      - Compact manual expenses, coach payout summaries, and branch/course breakdowns.
      - Replace remaining browser-native `confirm` with app dialog.
    - Later pass: add pagination/page-size to Admin users, coaches, complaints, and other table-like pages if realistic data volume makes them too long.
    - Verification required after each batch: `npm run check:mojibake`, `npm run build`, and smoke test the touched Admin pages after restarting/clearing stale Next dev cache when needed.
    - Implementation status on 2026-05-18:
      - [x] Added shared Admin `ListPagination` control for consistent page-size and next/previous behavior.
      - [x] `/admin/coach-checkins` now defaults to week scope, shows KPI/status summary, coach summary, abnormal-first rows, filters, pagination, and evidence detail dialog.
      - [x] `/admin/logs` now uses compact audit table, filters, pagination, and JSON detail dialog instead of endless cards.
      - [x] `/admin/notifications` inbox and history now paginate separately.
      - [x] `/admin/coupons` now paginates coupon cards while keeping existing detail/edit flow intact.
      - [x] `/admin/finance` manual expenses now paginate and delete through an app dialog instead of browser-native confirm.
      - [x] Added pagination/page-size to `/admin/payments`, `/admin/users`, `/admin/coaches`, `/admin/complaints`, and `/admin/branches`.
      - [x] Verified `npm run check:mojibake`, `npm run build`, and HTTP smoke checks for touched Admin pages.
      - [x] Follow-up: added the same pagination/page-size pattern to `/admin/ranking`, `/admin/makeup`, and `/admin/payroll` where realistic data volume can still create very long pages.
      - [x] Follow-up: added `/admin/payments/settings` for bank transfer display data shown to users on slip upload, with a clear warning that the displayed account must match SlipOK.
  - [x] 15.4 Coach Notifications / Reminders
    - [x] Notify Coach when assigned to a teaching slot/group.
    - [x] Notify Coach when a slot has learners but check-in has not happened near the allowed window, where technically feasible.
    - [x] Notify Coach/Head Coach for attendance gaps that block weekly teaching hours.
    - [x] Badge counts must be per logged-in Coach, not global.
    - Implementation status on 2026-05-17:
      - Assignment group save now creates per-coach schedule notifications linked to `/coach/today?date=YYYY-MM-DD`.
      - Coach check-in success now creates an attendance reminder linked to the assigned attendance page for that slot.
      - Coach layout/notifications page now creates idempotent check-in-window reminders and attendance-gap reminders before unread badge/count rendering.
      - Coach notification page now uses Coach-specific copy while reusing the shared notification list/read actions.
      - Verified with `npm run build`, `npm run check:mojibake`, `npm run seed:verify`, and authenticated Head Coach/Coach smoke tests.
  - [x] 15.5 User Booking / Payment / History
    - User booking must read available slots from DB `schedule_templates` only.
    - Same-day booking is allowed only for future sessions that have not started yet.
    - Booking price must use DB `pricing_tiers`.
    - Coupon usage must decrement availability and appear in user history.
    - SlipOK payment success must make booking/payment/history statuses consistent without manual admin approval.
    - Production pricing true-up closeout on 2026-07-02:
      - Source commit `5897cede58f720c1b5f205af53c9821cff0a39bf` (`fix(pricing): true up kids group monthly tiers`) is deployed to production alias `https://www.newathleteschool.com` via deployment `dpl_5e6i8M3Mtzy5xNah6xVD9v6PtHwQ` (Ready).
      - kids_group split sibling monthly bookings now true-up to the final monthly tier total: `targetMonthlyTotal = finalMonthlyPerSession * (existingSessions + newSessions)` and `incrementalPrice = max(0, targetMonthlyTotal - existingPersistedBookingTotals)`.
      - Dry-run proof passed: single 16 sessions = `THB 6,496`; split 8 + 8 = `THB 4,000 + THB 2,496 = THB 6,496`; existing 8 then add 1 keeps expected 7-10 tier behavior.
      - Coupon limitation remains: true-up subtracts persisted `bookings.total_price`; coupon true-up semantics need owner decision because no pre-discount subtotal snapshot exists.
      - Branch-scope limitation remains: preserved current same `user_id + course_type_id + month/year + status` scope; branch-specific monthly pricing needs owner decision if required.
      - Owner-approved production DB repair for the existing July mismatch is complete: target booking `ff0728dd-066a-417a-aeaa-0049fed6b931` was updated from `bookings.total_price = 3248` to `2496`; paired booking `10254533-f76a-4985-bf0d-af18942a3b85` remained `4000`; combined July 2026 total is now `6496`.
      - Post-repair verification passed: both bookings remain `pending_payment`; payment rows remain 0; coupon usages remain 0; `booking_sessions` were unchanged by fingerprint; booking status was unchanged; activity log `07150189-0a5e-4fe6-bd20-24c47b4b9a75` exists with action `pricing_true_up_repair`.
      - Owner-approved July 2026 current-month DB repair for 4 additional kids_group mismatch groups is complete. Owner policy: ignore June historical mismatches; repair July 2026 current-month mismatches even when payment exists; keep payment rows as evidence of actual transfer and do not modify `payments.amount`; do not create refund/coupon/payment rows; do not touch `booking_sessions`, `pricing_tiers`, Trin/Bin, or June groups.
      - Root cause for these groups: old incremental pricing charged `final tier per-session * newSessions` and did not true-up earlier higher-tier bookings. The source fix prevents future repeats.
      - Exact rows: `5d1d9a43-afcd-4d26-8817-68ab948443f2` `2800 -> 1169` log `04cf71ee-5718-49a7-8a5f-364d44a9184f`; `3f95767e-8418-4b0b-b87d-2cd18811825b` `14700 -> 13600` log `e2aa73ff-b1b9-4168-b58a-28ffc3128a1d`; `f565a552-65f3-44e0-8826-22a4c9cb0dbb` `1299 -> 763` log `c953f942-7d67-44d0-b8a5-b0abefa213a0`; `ff9cf27f-6415-444d-90b6-89ab05fc2d47` `2000 -> 1500` log `e46f9fb1-608e-48d6-a6a5-0c0bd7a7746a`.
      - Post-repair group totals: Ningnong `7700`; Kanokpan `16100`; Siripong `4763`; Janyawat `4000`. Latest batch total July reduction is `3767`; total July reduction including Trin/Bin is `4519`.
      - Post-write verification passed: payments unchanged by fingerprint; `booking_sessions` unchanged by fingerprint; `pricing_tiers` unchanged by fingerprint; no coupon rows created; no booking/payment/refund/coupon created; non-target bookings in those groups unchanged; Trin/Bin remains matched at `6496`; June guarded bookings unchanged.
      - Rollback condition for these exact DB repairs: rollback only before further dependent accounting/credit/payment action; if later accounting action exists, stop and re-plan.
      - Production smoke passed with no console/runtime/hydration/React #418 errors. UI price preview is `NEED REVIEW` only because reproducing the exact target case would risk entering booking creation flow.
      - Remaining limitations: coupon true-up semantics still need owner decision if a coupon case appears later; branch-scope policy for future business rules remains owner decision, while this July repair followed current source scope.
      - No source code, migration, deploy, booking/payment/refund/coupon creation, slip upload, `ยืนยันการจอง`, or product write action beyond the exact owner-approved DB repairs was performed.
    - Audit notes on 2026-05-19 before implementation:
      - Booking page already reads `schedule_templates`, enforces same-day future slots in the UI, and posts new bookings through `/api/bookings`.
      - `/api/bookings` revalidates price from DB `pricing_tiers`, validates coupon usage, decrements coupon usage, and sets bookings to `pending_payment`.
      - Gap: newly created User booking sessions do not currently persist `schedule_slot_id`; Coach assignment/check-in/attendance flows rely on `schedule_slot_id`, so User-created sessions must resolve/create the real `schedule_slots` row before insert.
      - Gap: pending-booking edit mode in `booking-client` still mutates `booking_sessions` directly from the client and should be moved behind a server API or removed.
      - Gap: `history-client` still has old "choose dates later" and delete-session flows that insert/delete sessions directly, bypass DB schedule templates, server pricing, and Coach assignment linkage.
    - [x] 15.5.1 Resolve User bookings to real `schedule_slots`
      - For every selected session, find or create the matching `schedule_slots` row from DB template/date/branch/course/start/end.
      - Save `schedule_slot_id` on `booking_sessions` for new bookings and pending edits.
      - Keep same-day future-slot validation on both client and server.
      - Completed on 2026-05-19:
        - `schedule_templates` now carry template ids into the booking calendar, including one-hour private subslots.
        - `/api/bookings` resolves every posted session against an active DB template, creates/reuses the matching `schedule_slots` row, and saves `schedule_slot_id` on `booking_sessions`.
        - Pending booking edit now goes through server-side `PUT /api/bookings` instead of mutating `booking_sessions` directly from the client.
        - Verified `npm run check:mojibake` and `npm run build`; build passes with existing lint warnings in older User/API files.
    - [x] 15.5.2 Remove or refactor old pending edit/delete/date-pick paths
      - Replace direct client mutations in history/booking edit with server-side APIs that validate ownership, payment status, DB templates, pricing, and coupon consistency.
      - Do not allow arbitrary dates/times that are not backed by DB schedule templates.
      - Completed on 2026-05-19:
        - Removed the old manual "choose dates later" dialog from User history so Users can no longer insert arbitrary dates/times outside DB schedule templates.
        - Removed the pending-session delete action from the history detail modal; pending bookings now use the calendar edit flow from `15.5.1`.
        - Pending booking cancellation now goes through `DELETE /api/bookings`, which validates ownership and `pending_payment` status before deleting sessions and marking the booking cancelled.
        - Verified there are no remaining direct `booking_sessions` insert/delete calls in `history-client` or `booking-client`.
        - Verified `npm run check:mojibake` and `npm run build`; build passes with existing lint warnings in older User/API files.
    - [x] 15.5.3 Payment/history final consistency
      - Verify SlipOK success creates payment records, updates booking status, keeps coupon history visible, and does not require Admin manual approval.
      - Make pending/paid/verified history copy clear for User.
      - Completed on 2026-05-19:
        - Hardened `/api/verify-slip` so every submitted booking id must belong to the current user, still be `pending_payment`, and match the expected payment total before a slip can update records.
        - SlipOK/test-mode success now creates payment rows, updates booking status consistently (`verified` when approved, `paid` when still pending), and sends User/Admin notifications.
        - User history now uses clearer status copy for `pending_payment`, `paid`, and `verified`, keeps coupon usage visible, and no longer exposes Admin-style approve/reject controls.
        - Booking edit/create API now resolves sessions through DB schedule templates and real `schedule_slots`, validates ownership, recalculates pricing server-side, and keeps coupon usage/counts consistent.
        - Cleaned warnings in touched User/payment files and repaired mojibake in the booking flow before verification.
        - Verified `npm run check:mojibake` and `npm run build`; build still reports older lint warnings in User dashboard/schedule/reschedule/children/notifications files that are outside this payment/history pass.
  - [x] 15.6 User Schedule / Reschedule / Makeup
    - User schedule must show month/day/session overview clearly.
    - Absence/overdue session logic must connect to makeup rules.
    - Reschedule and makeup choices must come from DB schedule templates.
    - User must not see or perform Admin-only actions.
    - Audit notes on 2026-05-19 before implementation:
      - Schedule page already shows verified sessions by month and excludes old `rescheduled` sessions.
      - Reschedule UI reads `schedule_templates` and applies the 24-hour rule plus same-month rule for normal users.
      - Gap: reschedule currently mutates `booking_sessions` directly from the client and does not save `schedule_slot_id` for the new session.
    - [x] 15.6.1 Server-side User reschedule API
      - Validate ownership, verified booking, 24-hour rule, same-month rule, DB template availability, and schedule-slot resolution on the server.
      - Save the new session with `schedule_slot_id` and mark the old session as `rescheduled` atomically as much as Supabase allows.
    - [x] 15.6.2 User schedule UX pass
      - Keep month/day overview compact on mobile and desktop.
      - Show rescheduled-from context and makeup/reschedule status without long vertical lists.
    - Completed on 2026-05-20:
      - Added `/api/reschedule` so User reschedule validates ownership, verified booking, scheduled/non-makeup session, 24-hour rule, same-month rule, DB template coverage, real `schedule_slot_id`, same-slot duplicate prevention, and learner-specific duplicate prevention.
      - Removed direct client-side `booking_sessions` mutation from `reschedule-client`; the User UI now calls the server API and keeps Admin-only makeup/cross-month control out of the User page.
      - User schedule/reschedule pages now use typed server data, compact month/day views, rescheduled-from context, and crowded calendar indicators with `+N` instead of long overflowing dots.
      - Cleaned User-side lint warnings in the touched schedule/reschedule/notification/dashboard/children/complaint helper path.
      - Verified `npm run check:mojibake` and `npm run build`; build passes without lint warnings.
    - Hotfix 2026-05-23:
      - Reschedule modal now disables the original same date/time/branch/course slot and labels it `(รอบเดิม)` so users cannot choose the same class again.
      - `/api/reschedule` now rejects the same original slot by date/time/branch context before creating/reusing a target `schedule_slot_id`, and duplicate checks now compare learner/date/time/branch/course instead of relying only on slot id.
      - Checks passed: `npx tsc --noEmit`, `npm run lint`, and `npm run check:mojibake`.
  - [x] 15.7 Shared Notifications
    - Notification badge counts must be correct per recipient user, coach, admin, or super admin.
    - Important events should create notifications: booking created, payment verified, makeup granted, coach assigned, attendance/absence where useful.
    - Admin broadcast notifications must appear as one unread notification per recipient, not as a global shared count.
    - Audit notes on 2026-05-19 before implementation:
      - Payment verified currently notifies the User and Admin roles.
      - Booking created currently notifies Admin/Super Admin; User-facing booking-created feedback should be checked after booking flow cleanup.
      - Reschedule currently notifies Admin roles and branch coaches, but should be called only after the server-side reschedule succeeds.
    - Completed on 2026-05-20:
      - Added `notifyUserOnce` shared helper so event notifications that may be triggered repeatedly can avoid duplicate unread rows for the same user/title/message/link.
      - Booking creation now also notifies the User that the booking was created and needs slip upload, while keeping Admin/Super Admin notification intact.
      - Admin makeup creation now notifies the booking owner that a makeup session has been granted.
      - Coach attendance now notifies the booking owner when a learner is marked absent or late, with the assigned slot label and schedule link.
      - Verified badge-count behavior remains per `notifications.user_id` in Admin, Coach, and User layouts; Admin broadcast route inserts one row per recipient.
      - Verified `npm run check:mojibake` and `npm run build`; build passes without lint warnings.
  - [x] 15.8 Coach/User Regression Pass
    - After 15.1-15.7 are done, run build, mobile responsive checks, and end-to-end smoke tests.
    - Fix lint debt only in touched files or in areas that put the completed flow at risk.
    - Completed on 2026-05-20:
      - Verified `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.
      - `next lint` passes with no ESLint warnings or errors.
      - Public smoke passed for `/` and `/auth/login` on the local dev server.
      - User/Coach protected route smoke passed unauthenticated guards: `/dashboard/*` and `/coach/*` routes return redirects to login instead of 500/error HTML.
      - Browser automation could not open localhost in the in-app browser because the browser surface returned `ERR_BLOCKED_BY_CLIENT`; HTTP smoke was used as the fallback verification path.
      - No additional code changes were required during this regression pass.
  - [x] 15.9 User High-Volume UX Pass
    - Audit User-facing pages for long vertical lists before production UAT.
    - Focus pages: history, notifications, children/learners, complaints, schedule, reschedule, and booking summaries.
    - Add compact grouping, pagination, filters, or detail dialogs only where real high-volume data can become hard to scan.
    - Keep booking/payment/business rules unchanged; this pass is layout and usability only.
    - Verify mobile and desktop after changes with `npm run check:mojibake`, `npm run lint`, and `npm run build`.
    - Completed on 2026-05-20:
      - Added pagination to User notifications so high-volume broadcasts and event messages do not render as one long page.
      - Added learner search and pagination to the User children/learners page.
      - Added status filtering and pagination to User complaints.
      - Collapsed booking history and reschedule sessions by month with “show more” controls.
      - Added a bounded scroll area to selected-date schedule details for days with many sessions.
      - Verified `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.
  - Completed on 2026-05-20:
    - Coach-first/User-last implementation queue is closed through `15.9`.
    - Remaining verification should continue under `18. Real Login UAT By Role` and `19. User Payment / Booking Final UAT`, not by reopening the full `15.x` implementation queue.
    - Keep Admin/System changes limited to real regression fixes while the stabilization queue is active.

  - [x] 16. Home Index Polish Before User Flow
    - Do this before starting `15.5 User Booking / Payment / History` because it affects the public entry point, login UX, and first impression before User-side completion work.
    - Scope: Home Index and public auth polish only. Do not change booking/payment/user business logic in this pass.
    - Smooth public navigation:
      - Improve `PublicNavbar` section navigation so clicking menu items scrolls smoothly to the correct section with sticky-header offset.
      - Replace the current browser-default black focus outline with brand-consistent accessible focus styling.
      - Support navigating from other routes back to `/#section` and scrolling after the Home page loads.
      - On mobile, close the sheet first, then scroll smoothly without jumpy layout behavior.
    - Login redirect loading:
      - Add a clear loading/redirect state after successful login in both `AuthModal` and `/auth/login`.
      - Keep submit buttons disabled while signing in and while redirecting to the role dashboard to prevent repeat clicks.
      - Show user-friendly copy such as "กำลังพาไปหน้าแดชบอร์ด..." instead of closing the modal abruptly.
      - Preserve existing role-based redirect logic from `getHomePathForRole`.
    - Hero motion / badminton identity:
      - Add restrained badminton-themed motion on the Home hero, such as a floating shuttlecock, racket accent, or motion trail.
      - Prefer lightweight CSS/Tailwind animation; do not add a new animation library for this polish pass.
      - Respect `prefers-reduced-motion` so users who reduce motion are not forced to see animation.
      - Keep the hero clean and inspection-friendly; avoid decorative orbs, heavy gradients, or animation that competes with the main CTA.
    - Expected files:
      - `src/components/layout/public-navbar.tsx`
      - `src/components/shared/auth-modal.tsx`
      - `src/app/auth/login/page.tsx`
      - `src/app/page.tsx`
      - `src/app/globals.css` only if keyframes or shared motion/focus styles are needed.
    - Verification:
      - Run `npm run check:mojibake`.
      - Run `npm run build`.
      - Browser smoke desktop/mobile for `/`: menu clicks, section offsets, ranking link, login modal loading state, and console errors.
      - Browser smoke `/auth/login`: loading state, disabled repeat submit, and role redirect behavior where a real session can be tested.
    - Completed:
      - `PublicNavbar` section navigation now uses real anchor fallback plus custom easing scroll with sticky-header offset, focus-visible styling, and route/hash support.
      - Follow-up fix: removed the `prefers-reduced-motion` CSS override that forced section links to jump instantly; reduced-motion users now get a shorter controlled scroll instead of a hard jump while hero motion remains disabled.
      - `AuthModal` and `/auth/login` now keep a redirect/loading state after successful login and disable repeat submit while routing to the role dashboard.
      - Home hero now has restrained badminton-themed CSS motion and respects `prefers-reduced-motion`.
      - Verified `npm run check:mojibake` and `npm run build`; build passes with existing lint warnings in older Dashboard/User/API files.
      - Browser smoke verified `/` section anchor fallback and `/auth/login` render with no console errors. Login modal could not be smoke-opened in the current browser session because the public navbar was already in an authenticated/loading state, but the modal code path was covered by build/type checks.

## Next Stabilization Order Before Deploy

- [x] 17. TODO Housekeeping / Close Completed Planning Items
  - Reconcile parent/child checklist status so `DEVELOPMENT_TODO.md` matches the real state of the system.
  - Confirm `Phase 3 - Make npm run build pass` status after recent successful builds.
  - Confirm `15. Start Coach-First / User-Last Completion Queue` parent status now that core children through `15.9` are completed.
  - Keep only real remaining work open so future development does not loop back into completed flows.
  - Completed on 2026-05-20:
    - Marked parent `15. Start Coach-First / User-Last Completion Queue` complete because all tracked child items through `15.9` are complete.
    - Marked parent `15.5 User Booking / Payment / History` complete because `15.5.1` through `15.5.3` are complete.
    - Kept role-based UAT, payment/booking final UAT, seed cleanup, production env, and staging deploy open because those require real login/staging validation.
    - Reconfirmed current local checks: `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.

- [x] 18. Real Login UAT By Role
  - Super Admin: settings, payment settings, ranking, teaching program review, payroll, finance.
  - Admin: allowed menu visibility, payment monitoring, complaints, notifications.
  - Head Coach: assign groups, coach suggestion, calendar, student grouping.
  - Coach: schedule, check-in, attendance, level/ranking, teaching program, hours.
  - User: booking, coupon, slip upload, history, schedule, reschedule, notifications.
  - Completed 2026-05-20:
    - Verified seed auth users exist and reset seed passwords to `NascSeed@2026` for repeatable UAT.
    - Verified seed data counts via `npm run seed:verify`.
    - Real session route smoke tested by role with Supabase SSR cookies:
      - Super Admin: `/admin`, `/admin/settings`, `/admin/payments`, `/admin/ranking`, `/admin/teaching-programs`, `/admin/payroll`, `/admin/finance` returned `200`.
      - Admin: `/admin`, `/admin/payments`, `/admin/complaints`, `/admin/notifications` returned `200`; `/admin/settings` correctly redirected back to `/admin`.
      - Head Coach: `/coach`, `/coach/assign-groups`, `/coach/today`, `/coach/students`, `/coach/programs`, `/coach/hours` returned `200`.
      - Coach: `/coach`, `/coach/today`, `/coach/checkin`, `/coach/attendance`, `/coach/levels`, `/coach/programs`, `/coach/hours` returned `200`; `/coach/assign-groups` correctly redirected back to `/coach`.
      - User: `/dashboard`, `/dashboard/booking`, `/dashboard/history`, `/dashboard/schedule`, `/dashboard/reschedule`, `/dashboard/progress`, `/dashboard/notifications` returned `200`.
    - Note: in-app Browser client could open local pages, but Supabase client-side login was blocked by the test environment's external network path, so final UAT used real Supabase Auth sessions and Next route requests instead of UI form clicks.

- [x] 19. User Payment / Booking Final UAT
  - Verify same-day booking allows only slots that have not started.
  - Verify coupon usage deducts usage count and appears in user history.
  - Verify SlipOK success keeps booking, payment, and history statuses consistent.
  - Verify user can view slip, booking history, schedule, and notification state correctly.
  - Completed 2026-05-20:
    - Ran real authenticated UAT as `seed.nasc+adult.group.chaengwattana@example.com` against localhost + Supabase.
    - Verified same-day started slot `13:00` was rejected and same-day future slot `19:00` was bookable.
    - Created a one-use UAT coupon, confirmed `/api/validate-coupon`, booking usage row, `current_uses = 1`, and auto close after max use.
    - Uploaded a UAT slip through `/api/verify-slip` with `SLIPOK_TEST_MODE=true`; confirmed `bookings.status = verified`, `payments.status = approved`, amount, slip URL, and user notification link.
    - Confirmed `/dashboard/booking`, `/dashboard/history`, `/dashboard/schedule`, and `/dashboard/notifications` render with the authenticated user session.
    - Cleaned up the temporary UAT booking, coupon, payment, coupon usage, slip file, sessions, and UAT notifications after verification.
    - Tightened User history session loading so it fetches only `booking_sessions` for bookings visible on that page instead of scanning all sessions.

  - [x] 19.1 User Schedule Coach / Attendance Context
  - Improve `/dashboard/schedule` so User can understand each real class session, not only the date and time.
  - Connect `booking_sessions.id` to `coach_assignment_group_students.booking_session_id`, then `coach_assignment_groups.coach_id`, then `profiles` so each session can show the assigned Coach/Head Coach name, avatar, and role when available.
  - Connect `attendance` for each visible booking session so the User can see whether the learner is pending, present, late, absent, completed, rescheduled, or makeup.
  - Extend the data shape passed into `ScheduleCalendarClient` with coach info, assignment status, attendance status, and a user-friendly session display status.
  - Redesign the calendar cells and selected-day detail cards:
    - Keep calendar cells compact with session counts/status indicators, especially on mobile.
    - Show session cards below the calendar with time, branch, learner, course type, assigned coach, attendance status, makeup/reschedule context, and clear fallback text such as "ยังไม่ได้มอบหมายโค้ช".
    - Avoid long overflowing day content; use bounded detail areas and concise badges.
  - Regression checks:
    - User with multiple children.
    - Self/adult learner.
    - Assigned coach versus not-yet-assigned coach.
    - Checked attendance versus no attendance yet.
    - Makeup and rescheduled sessions.
    - Mobile and desktop layout.
  - Completed:
    - `/dashboard/schedule` now joins coach assignment groups and attendance rows for each real booking session.
    - Selected-day session cards show learner, course, branch, assigned coach/head coach, assignment fallback, attendance/check-in status, makeup, and reschedule context.
      - Calendar cells stay compact with session count and bounded status indicators for mobile and desktop.
      - Checks passed: `npm run check:mojibake`, `npm run lint`, `npm run build`, `git diff --check`.

  - [x] 19.2 Attendance Gap Review Rule Across User/Admin/Coach
    - Replace the simple past-session display rule with a safer shared business rule for missing attendance.
    - Core rule:
      - If attendance exists for the learner, use the real attendance status: present, late, or absent.
      - If `booking_sessions.status` is already `completed` or `absent`, use that persisted status.
      - If the session is in progress, show "กำลังเรียน".
      - If the session is in the future, show "รอเรียน".
      - If the session has ended and the slot has attendance records for some students, any learner without attendance should be treated as "ขาดเรียน".
      - If the session has ended and the entire slot/group has no attendance records at all, do not automatically mark every learner as absent; route the slot to Admin review as "ต้องตรวจสอบการเช็คชื่อ".
    - User schedule behavior:
      - Past slot with partial attendance and this learner missing/absent: show "ขาดเรียน".
      - Past slot with no attendance for the whole slot/group: show "รอตรวจสอบการเช็คชื่อ" with a clear note that Admin/Coach must review.
      - Once Admin confirms absence, show "ขาดเรียน" and allow the normal makeup rule to apply.
    - Admin makeup behavior:
      - Do not auto-list whole-slot attendance gaps as actionable makeup until Admin confirms or attendance is entered.
      - Continue listing confirmed absent sessions and partial-attendance missed learners as makeup candidates.
      - Add status visibility so Admin can distinguish "ขาดเรียน" from "ต้องตรวจสอบการเช็คชื่อ".
    - Admin review UI:
      - Add or extend an Admin screen, likely under `เช็คอินโค้ช` or `วันชดเชย`, for ended slots/groups with zero attendance records.
      - Show date, time, branch, course type, assigned coach/group, student count, coach check-in status, selfie/location evidence, and current review status.
      - Actions should include: request coach correction, enter attendance retrospectively, confirm all absent, close/ignore with reason.
    - Coach workflow:
      - Keep blocking attendance until the coach check-in requirement is satisfied.
      - Add clear warnings for slots that ended without attendance so Coach/Head Coach can correct before Admin has to intervene.
    - Teaching hours/payroll behavior:
      - Do not automatically remove coach teaching hours only because all attendance is missing.
      - Mark the slot as missing attendance evidence for Admin review; coach hours should require check-in/photo/location and review status before closing.
    - Implementation notes:
      - Prefer a shared helper/service for derived session status so User schedule, Admin makeup, Coach attendance, and payroll do not drift again.
      - Existing quick UI change that labels all past unmarked sessions as "ขาดเรียน" must be revisited under this rule before final UAT.
    - Regression checks:
      - Past slot with no attendance for any student.
      - Past slot with partial attendance.
      - Past slot where this learner is explicitly absent.
      - Past slot where this learner is present/late.
      - Coach checked in but forgot attendance.
      - Coach did not check in and no attendance exists.
      - Admin confirms all absent and makeup eligibility appears.
      - Admin enters retrospective attendance and User schedule updates.
      - Mobile and desktop views for User schedule and Admin review.
    - Completed:
      - Added shared `src/lib/session-attendance-status.ts` so User/Admin screens derive class status from the same rule instead of each page guessing separately.
      - `/dashboard/schedule` now counts attendance in the learner's assignment group or whole slot fallback, so a past class with partial attendance can mark the missing learner as absent, while a class with zero attendance for everyone becomes `attendance_gap_review`.
      - User schedule now shows a separate orange review note for ended slots with no attendance records instead of saying the learner is absent immediately.
      - `/admin/makeup` now uses the same rule, excludes whole-slot attendance gaps from actionable makeup, and adds a review queue with a compact list and a "confirm absent" action.
      - Added `PATCH /api/admin/makeup` for Admin to confirm an ended normal session as absent, after which the normal makeup eligibility flow can apply.
      - Payroll/teaching-hours behavior remains guarded by the existing `has_attendance` evidence check; the new rule does not remove coach hours automatically when attendance is missing.
      - Checks passed: `npm run check:mojibake`, `npm run build`, `git diff --check`.

  - [x] 19.3 Admin Attendance Gap Resolution
    - Complete the Admin/Super Admin workflow for ended teaching rounds where Coach forgot all evidence: no attendance records, and possibly no coach check-in.
    - This is a follow-up to `19.2`; do not treat every no-attendance round as automatic student absence.
    - Admin review screen should show:
      - Date, time, branch, course type, assigned coach/group, learner list, and booking/session status.
      - Coach check-in status, selfie/photo evidence, location evidence, and check-in time if available.
      - Clear severity:
        - Attendance missing but coach checked in: likely Coach forgot attendance.
        - Attendance missing and coach did not check in: evidence gap for both Coach and learners.
    - Required Admin/Super Admin actions:
      - Confirm all absent: write/update attendance as `absent`, make the normal makeup rule eligible, and add audit log.
      - Enter retrospective attendance per learner: allow `present`, `late`, or `absent` with required reason/note.
      - Send back to Coach/Head Coach for correction: create notification/task state without making makeup eligible yet.
      - Close/ignore with reason: for cancelled/wrong data/no-action cases, without creating makeup.
    - User schedule result:
      - Confirmed `absent` shows as absent and can flow to makeup eligibility.
      - Retrospective `present` or `late` shows as attended and must not create makeup.
      - Pending coach/admin review stays as review status, not absent.
    - Coach/payroll result:
      - Student attendance correction must not automatically approve Coach teaching hours when Coach check-in/photo/location evidence is missing.
      - Slots with missing Coach evidence should remain visible for Super Admin review before weekly teaching-hour closing.
    - Audit requirements:
      - Store who resolved the gap, when, what action was selected, and the reason/note.
      - Avoid browser native `confirm`, `alert`, or `prompt`; use the project dialog design system.
    - Regression checks:
      - Coach checked in but forgot all attendance.
      - Coach did not check in and no attendance exists.
      - Mixed retrospective attendance: some present, some absent.
      - Confirm all absent creates makeup candidates.
      - Present/late retrospective attendance does not create makeup candidates.
      - Send back to Coach keeps User/Admin status pending review.
      - Mobile and desktop review layout.
    - Completed 2026-05-21:
      - `/admin/makeup` review queue now shows assigned coach/group, coach check-in time, and photo/location evidence state for ended sessions with zero attendance.
      - Admin/Super Admin can resolve each attendance gap as confirmed absent, retrospective present/late/absent, send back to assigned Coach, or close the case with a required audit reason where needed.
      - `PATCH /api/admin/makeup` now writes retrospective attendance, updates session status, sends user/coach notifications, and logs each resolution path to Activity Log.
      - Confirmed absent flows back into normal makeup eligibility; retrospective present/late closes the gap without creating makeup eligibility.
      - Close/ignore uses a completed session state plus Activity Log reason to keep the case out of makeup while preserving an audit trail.
      - Coach can retroactively check in only for slots Admin returned via `attendance_gap_request_coach_review`; normal past slots remain blocked.
      - `/coach/attendance` now exposes a "เช็คอินย้อนหลัง" path for Admin-returned gaps, then normal attendance can be recorded after selfie/location check-in exists.
      - Checks passed: `npm run check:mojibake`, `npm run lint`, `npm run build`, `git diff --check`.
    - [x] 19.3.1 Pre-commit UAT for Admin-returned attendance gap
      - Find or create one disposable ended slot with assigned Coach, learner session, no attendance, and no/optional check-in.
      - Admin action: send the gap back to Coach and verify notification + Activity Log.
      - Coach action: open the returned slot, retroactively check in with selfie/location, then mark attendance.
      - Verification: Admin makeup queue no longer shows the gap after attendance exists.
      - Verification: User schedule shows absent/present/late correctly and makeup eligibility follows the same shared rule.
      - Completed 2026-05-21:
        - Added `npm run uat:attendance-gap`, a guarded disposable Supabase UAT that creates only `uat.nasc+attendance.gap.*@example.com` accounts and `NASC_UAT_ATTENDANCE_GAP` schedule data.
        - UAT verifies Admin-returned attendance gap detection, Coach retroactive check-in permission, present/late/absent attendance outcomes, booking session status mapping, and gap queue closure after attendance exists.
        - UAT auto-cleanup passed after the run: 3 profiles, 1 slot, and 3 sessions removed.
        - Check passed: `npm run uat:attendance-gap`.

  - [x] 20. Seed Data Cleanup / Production Readiness
  - Prepare a safe cleanup plan for seed/demo data in Supabase before production.
  - Separate master data that must remain, such as levels, pricing, schedule templates, branches, and system settings.
  - Review Supabase buckets, storage policies, RLS behavior, and required production env vars.
  - Completed 2026-05-20:
    - Added `npm run prod:check` as a read-only production readiness checker for Supabase env vars, seed/demo data, master data, required system settings, placeholder media URLs, and Storage buckets.
    - Added `PRODUCTION_READINESS.md` with the safe order for backup, checking, seed verification, seed cleanup, and post-cleanup verification.
    - Confirmed current remote master data is present: 7 active branches, 3 course types, 702 active schedule templates, 70 active levels, 11 pricing tiers, and required buckets `avatars`, `coach-checkins`, and `payment-slips`.
    - Confirmed production warnings that must be resolved before deploy: 51 seed auth/profile users still exist, placeholder payment/check-in URLs still exist, `SLIPOK_TEST_MODE=true`, and `coach_teaching_rules_settings` has not been saved yet in `system_settings`.
    - Checks passed: `node --check scripts/production-readiness-check.js`, `npm run check:mojibake`, `npm run lint`, `npm run prod:check`, and `git diff --check`.

  - [x] 20.1 User Lesson Wallet / Same-Month Learning Credit
  - New owner requirement before deploy: users can move a paid/verified learning session into a same-month "lesson wallet" when they cannot choose a new date yet.
  - Hard rules:
    - A session can be moved into the wallet only if the booking is paid/verified, the session has not started, no attendance exists, and the request is at least 48 hours before the session start time.
    - If the user forgets to move it before the 48-hour cutoff, the session remains on the schedule and normal absence/makeup rules apply; no late wallet action.
    - Wallet credits can only be redeemed into another available schedule slot in the same month and before that target slot starts.
    - Redeeming a wallet credit does not create a new payment because it uses the already-paid session entitlement.
    - Walleted sessions are not absent, not completed, not makeup-eligible, not coach-payable, and must not be included in coach attendance/hour calculations.
    - Unused wallet credits expire at the end of the original booking month and do not carry over.
  - Safety design:
    - Do not delete the original booking/payment record; preserve audit history.
    - Add DB support for lesson wallet credits and/or a clear `booking_sessions` wallet status/mapping.
    - When a session is moved into the wallet after Head Coach assignment exists, remove only that learner from `coach_assignment_group_students`, reduce slot occupancy, and only notify Head Coach/Coach when active learners remain unassigned after the cleanup.
    - If the learner was the only student in a group, keep the assignment auditable but ensure empty groups are not treated as payable teaching evidence.
    - When redeemed into a new slot, create/reactivate a scheduled session that enters the normal Head Coach assignment flow again.
  - Required implementation:
    - DB migration for wallet credit records, status/audit fields, and safe indexes.
    - User UI for "เก็บเข้ากระเป๋า" and "ใช้วันเรียนจากกระเป๋า" with 48-hour cutoff messaging.
    - User schedule/history must show walleted, redeemed, and expired states clearly.
    - API guards for paid booking, same-month redemption, target slot capacity, cutoff time, no attendance, and no started session.
    - Head Coach/Coach assignment cleanup when a learner is removed from an assigned group; notifications must avoid creating reassignment work when the remaining learners are still assigned.
    - Admin visibility/audit trail for wallet actions before deploy.
  - UAT cases:
    - Store before Head Coach assignment.
    - Store after Head Coach assignment but before 48-hour cutoff.
    - Block store within 48 hours.
    - Block store after Coach check-in or attendance exists.
    - Redeem in same month into an available slot without payment.
    - Block redeem into full/past/wrong-month slots.
    - Expire unused wallet credit at month end and confirm it does not become makeup.
  - Completed 2026-05-21:
    - Added DB migration/schema/type support for `lesson_wallet_credits` and `booking_sessions.status = walleted` so original booking/payment history stays auditable.
    - Added `/api/lesson-wallet` with store/redeem/expire guards: verified booking only, no makeup, no attendance, 48-hour store cutoff, same-month redeem, future target slot, template validation, capacity check, duplicate learner prevention, slot count updates, assignment cleanup, notifications, and activity logs.
    - Added User schedule action “เก็บเข้ากระเป๋า” only on eligible sessions and a new `/dashboard/lesson-wallet` page for active/redeemed/expired credits and same-month redemption without payment.
    - Kept walleted sessions out of coach access/assignment duplicate logic and slot attendance scope, while showing wallet status clearly in User schedule/history and Admin schedule views.
    - Applied remote Supabase migration `20260521170000_add_lesson_wallet_credits.sql` with `supabase db push`.
    - Added `npm run uat:lesson-wallet`, a guarded disposable Supabase UAT that creates only `uat.nasc+lesson.wallet.*@example.com` accounts and `NASC_UAT_LESSON_WALLET` schedule data.
    - UAT verifies migration table usability, storing a verified paid session into the wallet, 48-hour/no-attendance guards, coach assignment cleanup, slot count decrement, same-month redemption into a future slot, original booking/payment reuse without new charge, wrong-month detection, expired credit handling, and cleanup.
    - UAT auto-cleanup passed after the run: 3 profiles, 6 slots, 5 sessions, and 2 wallet credits removed.
    - Checks passed: `npm run uat:lesson-wallet`, `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.

- [ ] 21. Phase 3 Deploy Readiness
  - Review dependency vulnerabilities and update only when safe.
  - Prepare production environment variables.
  - Deploy staging.
  - Smoke test staging across Super Admin, Admin, Head Coach, Coach, and User roles.
  - Completed 2026-05-21:
    - Ran Production readiness re-check against the real Supabase remote.
    - Confirmed seed/demo users are gone: 0 seed profiles and 0 seed auth users.
    - Confirmed required master data exists: 7 active branches, 3 course types, 702 active schedule templates, 70 active levels, and 11 pricing tiers.
    - Confirmed required Storage buckets exist: `avatars`, `coach-checkins`, and `payment-slips`.
    - Added `npm run prod:save-default-settings` to save missing production-safe defaults without hand-editing JSON in the app.
    - Saved `coach_teaching_rules_settings` into `system_settings`; `prod:check` now finds all 3 required settings.
    - Remaining warning before production deploy: `.env.local` still has `SLIPOK_TEST_MODE=true` for current testing. Production must remove it or set it to false and use real SlipOK credentials.
    - Checks passed: `npm run prod:save-default-settings`, `npm run prod:check`, `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.
  - Re-check 2026-05-21 after pricing/wallet fixes:
    - Re-ran `npm run prod:check` against the real Supabase remote after wallet UAT cleanup; result remains READY WITH WARNINGS/PASSES.
    - Confirmed no seed/demo users remain: 0 seed profiles and 0 seed auth users.
    - Confirmed master data still exists: 7 active branches, 3 course types, 702 active schedule templates, 70 active levels, 11 pricing tiers, 3 required system settings, and Storage buckets `avatars`, `coach-checkins`, `payment-slips`.
    - Verified lesson wallet UAT again: store guard, assignment cleanup, slot count decrement, same-month redeem, no extra payment path, expired/wrong-month guards, and auto-cleanup all passed.
    - Verified kids group incremental pricing code path now charges only the newly added sessions at the tier for the final monthly count, e.g. existing 2 + new 1 uses the 3-session tier for 1 new session instead of recalculating the whole month.
    - Remaining warning before production deploy is still intentional for testing: `SLIPOK_TEST_MODE=true`. Production must set it to false/remove it and use real SlipOK credentials.
    - Checks passed: `npm run lint`, `npm run check:mojibake`, `npm run prod:check`, `npm run uat:lesson-wallet`, `npm run build`, and `git diff --check`.
  - SlipOK real-mode check 2026-05-21:
    - Compared local implementation with `SlipOK API Guide.docx`; updated SlipOK verification to send `log=true` and `amount` with file uploads so SlipOK can validate receiver/deduplicate/check amount according to the guide.
    - Added live SlipOK quota validation to `npm run prod:check` when `SLIPOK_TEST_MODE=false` and real credentials are present.
    - Current real SlipOK blocker: quota endpoint returns code `1003` / `Package ของคุณหมดอายุแล้ว`, so real slip auto-approval cannot work until the SlipOK package/branch is renewed or corrected.
    - Checks passed after code changes: `npm run lint`, `npm run check:mojibake`, `npx tsc --noEmit`, and `git diff --check`.
    - `npm run build` did not complete in this local run because Google Fonts DNS lookup failed for `fonts.googleapis.com`; this is a network/font fetch issue, not a TypeScript error from the SlipOK changes.

- [x] 21.1 Booking Duplicate Guard + Payment Review Actions
  - Production blocker found during real SlipOK testing: the same learner can still create and pay for a duplicate booking on the same date/time/branch.
  - Safe booking rule:
    - One learner must not have duplicate active sessions for the same `date + start_time + end_time` even if the branch/course differs, because the learner cannot attend overlapping rounds.
    - Active booking statuses for duplicate checks: `pending_payment`, `paid`, `verified`.
    - Active session statuses for duplicate checks: `scheduled`, `completed`, `absent`.
    - Ignore sessions/bookings that are `rescheduled`, `walleted`, or `cancelled`.
    - Server API must enforce this even if the UI is bypassed.
  - Booking fixes:
    - Disable already-booked learner slots in the User booking calendar and label them clearly as `จองแล้ว`.
    - Add duplicate guard to `POST /api/bookings` before inserting booking/session rows.
    - Add the same guard to `PUT /api/bookings`, excluding the booking being edited.
    - Return a clear error such as `น้อง A มีรอบเรียน 28 พ.ค. 17:00-19:00 ที่แจ้งวัฒนะอยู่แล้ว`.
  - Payment review fixes:
    - Keep auto-approval when SlipOK passes and local validation passes.
    - For SlipOK failures, Admin/Super Admin must have explicit actions:
      - `อนุมัติด้วยตนเอง`: mark payment `approved`, booking `verified`, and notify the user.
      - `ตีกลับให้แนบสลิปใหม่`: mark payment `rejected`, move booking back to `pending_payment`, store the admin reason, and notify the user to upload a new slip.
      - `ปฏิเสธและยกเลิกการจอง`: mark payment `rejected`, booking `cancelled`, and prevent the sessions from continuing into Coach assignment/attendance flow.
    - User history must show the admin reason and a clear re-upload path when a slip is sent back.
  - UAT required:
    - Duplicate same learner/date/time/branch is blocked in both UI and API.
    - SlipOK `1014` or other failure can be sent back with a reason; User can upload a new slip.
    - Manual approval verifies the booking and payment without requiring SlipOK to pass.
    - Cancelled payment booking no longer appears in active scheduling/coach flows.
  - Completed 2026-05-21:
    - User booking calendar now disables already-booked same-learner same-time slots and labels them `จองแล้ว`.
    - `POST /api/bookings` and `PUT /api/bookings` now reject duplicate active sessions server-side; `PUT` excludes the booking currently being edited.
    - Admin payment review now supports three explicit actions from the payment detail dialog: manual approve, send back for re-upload, and reject/cancel booking.
    - Admin review actions store notes, notify the User, log Activity Log entries, and update booking/payment status consistently.
    - User history now surfaces the latest rejected payment note and keeps the re-upload path visible while the booking is back in `pending_payment`.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `git diff --check`, `npm run build`, and `npm run prod:check`.
    - Note: local non-escalated `prod:check`/`build` can fail on network access to Supabase/Google Fonts inside sandbox; escalated checks passed. Production warning remains only `SLIPOK_TEST_MODE=true` until real mode is intentionally enabled.

- [x] 21.2 Coach Assignment Visibility / Past Slot Lock
  - Critical issue found 2026-05-22: Head Coach can confirm a coach assignment, Admin sees the assigned coach, but User schedule can still show `ยังไม่ได้มอบหมายโค้ช`.
  - Fix the read model so User schedule/history uses the same confirmed `coach_assignment_groups` / student-to-coach assignment source as Admin and Coach pages.
  - User-facing schedule must show the assigned coach name once Head Coach has saved/confirmed the group for that learner/session.
  - Filter default fixes for high-risk operational pages:
    - Admin Makeup page should open with `ทุกสาขา` + `ทั้งหมด` instead of hiding records behind `ยังชดเชยได้`.
    - Head Coach group assignment page should open with `ทั้งหมด` instead of `ต้องมอบหมาย`.
    - Default filters should prioritize visibility first; users can narrow down after they see the full workload.
  - Past-slot rule:
    - Head Coach/Admin must not be able to newly assign or reassign learners/coaches after the class date/time has already passed.
    - Past confirmed assignments should remain view-only for audit, attendance, teaching hours, and User history.
    - If a past class has no assignment/attendance, it must go through the attendance gap resolution flow instead of normal assignment.
  - API/server guards must enforce the same rule even if the UI is bypassed.
  - UAT required:
    - Future assigned slot: Head Coach confirms -> Admin sees coach -> User sees the same coach.
    - Past slot with existing assignment: visible read-only everywhere.
    - Past slot without assignment: normal assign controls are blocked and the record routes to attendance gap review.
    - Coach schedule, attendance, makeup, teaching hours, and User schedule remain consistent after the change.
  - Completed 2026-05-22:
    - User schedule now reads confirmed `coach_assignment_groups` with service access and falls back to legacy `coach_assignments` only when no assignment group exists for that slot.
    - User schedule, attendance status, and coach visibility now share the same assignment source used by Admin/Coach pages.
    - Head Coach assignment page now opens with all statuses visible by default and locks started/past slots as read-only.
    - `POST /api/coach/assignment-groups` now rejects started/past slots server-side, so UI bypass cannot create backdated assignments.
    - Admin Makeup page now opens with `ทุกสาขา` + `ทั้งหมด` to avoid hiding review records behind an action-only filter.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `git diff --check`, `npm run build`.

- [x] 21.3 Production Env / SlipOK Real Mode Final Check
  - Confirm production `.env` values before staging/deploy:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `SLIPOK_TEST_MODE=false`
    - `SLIPOK_API_URL`
    - `SLIPOK_API_KEY`
  - Confirm the SlipOK branch/account shown to users matches the account SlipOK validates.
  - Run `npm run prod:check` in real mode and confirm the only remaining warnings are intentional.
  - Verify `payment-slips`, `avatars`, and `coach-checkins` buckets/policies still work before staging.
  - Do not commit real secrets into the repository.
  - Mobile check-in hardening 2026-05-22:
    - Coach check-in now detects insecure mobile contexts and explains that camera/GPS require HTTPS instead of showing a generic permission error.
    - Camera capture now waits for real video metadata/frame readiness before enabling selfie capture, reducing black-preview/blank-capture issues on mobile browsers.
    - GPS errors now distinguish denied permission, unavailable position, and timeout so Coach/Admin know what to fix during field use.
    - Real SlipOK credentials validated through `npm run prod:check`; quota is readable, remaining quota is 98, and package end date is 2026-05-26.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `git diff --check`, `npm run build`, `npm run prod:check`.
  - Final real-mode re-check 2026-05-23:
    - Confirmed required local env keys are present without printing secrets: Supabase URL/publishable key/service role key, `SLIPOK_TEST_MODE=false`, `SLIPOK_API_URL`, and `SLIPOK_API_KEY`.
    - `npm run prod:check` can read real SlipOK quota and reports: seed profiles `0`, seed auth users `0`, required Storage buckets present, active branches `7`, course types `3`, active schedule templates `702`, active levels `70`, pricing tiers `11`, system settings `3`, SlipOK quota remaining `98`, and package end date `2026-05-26`.
    - No production secrets were committed; real `.env.local` remains local only.
    - Checks passed: `npm run prod:check`, `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, and `git diff --check`.

- [x] 21.3.1 User Lesson Wallet Display + Re-Wallet Flow
  - Refine `/dashboard/schedule` wallet visibility so the calendar is not overloaded with duplicate wallet statuses.
  - Display rules:
    - `walleted` + active credit: show as purple "อยู่ในกระเป๋า" because the lesson entitlement is still unused.
    - `walleted` + redeemed credit: hide from the main calendar/session list because the target session already shows "ใช้สิทธิ์จากกระเป๋าวันที่ ...".
    - `walleted` + expired credit: prefer showing in `/dashboard/lesson-wallet` rather than cluttering the schedule calendar, unless a clear expired audit indicator is needed.
  - Re-wallet rule:
    - A session created from wallet redemption may be stored back into the wallet again if it is still in the same month, at least 48 hours before start, has no attendance, and is not a makeup session.
    - Re-walleting must not create a new payment; it must keep using the original paid booking entitlement.
    - If the redeemed session was already assigned to a Coach group, remove only that learner from the assignment group. Only notify Head Coach/Coach when active learners remain without any group assignment.
  - Backend/API safety:
    - Confirm `/api/lesson-wallet` handles repeated wallet -> redeem -> wallet -> redeem chains without duplicate active credits, duplicate learner slots, or extra payment rows.
    - Keep same-month, future-slot, capacity, and duplicate learner guards.
  - UAT required:
    - Store original session A into wallet.
    - Redeem into session B.
    - Store session B into wallet again.
    - Redeem into session C in the same month.
    - Verify only the active/relevant schedule entries are visible, payment count does not increase, and Coach assignment cleanup happens per learner only.
  - Completed 2026-05-23:
    - `/dashboard/schedule` now shows walleted sessions only when the wallet credit is still active; redeemed/expired wallet source sessions are hidden from the main calendar/list to avoid duplicate status noise.
    - Target sessions redeemed from wallet continue to show the source context, such as "ใช้สิทธิ์จากกระเป๋าวันที่ ...".
    - `/dashboard/lesson-wallet` now disables already-booked target slots for the same learner/date/time/branch/course and labels them "จองแล้ว".
    - `/api/lesson-wallet` now blocks duplicate wallet redemption by learner/date/time/branch/course, not just by selected `schedule_slot_id`.
    - Extended `npm run uat:lesson-wallet` to cover wallet -> redeem -> wallet -> redeem chains.
    - UAT now verifies re-walleting a redeemed/assigned session decrements the old target slot, removes only that learner from Coach assignment groups, creates the new target session, keeps the original booking/payment count unchanged, and blocks duplicate target slots before wallet redemption.
    - Checks passed: `node --check scripts/uat-lesson-wallet.js`, `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run uat:lesson-wallet`, `npm run build`, and `git diff --check`.
  - Production hotfix 2026-05-23:
    - `/api/lesson-wallet` now verifies that the `lesson_wallet_credits` row was actually updated from `active` to `redeemed`; if another request already used the same credit, it rolls back the newly-created session and slot count, then returns a conflict instead of silently creating an extra class.
    - `/dashboard/lesson-wallet` blocks repeated redeem clicks while the request is running.
    - Admin dashboard and Admin schedule now apply the same visibility rule as User schedule: wallet source sessions are shown only while the wallet credit is still active; redeemed/expired wallet sources are hidden from operational calendars.

- [x] 21.3.2 Coach Assignment Stability After Wallet Store
  - Owner requirement: when a User stores a lesson into the wallet after Head Coach has already assigned groups/coaches, the system must remove only that learner and must not create unnecessary reassignment work.
  - Safe rules:
    - If the affected slot/group still has active learners after the wallet action, keep the existing Coach/group assignment as confirmed and do not force Head Coach to assign again.
    - If the removed learner was the last learner in a group, keep the old group auditable but exclude the empty group from Coach schedule, check-in, attendance, teaching programs, and teaching-hour/payroll evidence.
    - If the whole slot has no active learners left after wallet store, Coach should no longer see the slot as work to teach/check in for; it should behave like a slot with no booking.
    - Only show Head Coach "needs assignment" when active learner sessions remain in the slot but are not assigned to any group.
  - Required implementation:
    - Adjust `/api/lesson-wallet` store flow to compute post-wallet slot state after removing the learner from `coach_assignment_group_students`.
    - Send Head Coach/Coach notifications only when a real review is needed; avoid noisy "review group" alerts when the remaining learners are still fully assigned.
    - Ensure Coach schedule, check-in, attendance, teaching programs, and teaching-hour calculations ignore empty assignment groups and slots with no active learners.
    - Extend lesson-wallet UAT to cover: 3 learners -> wallet 1, 1 learner -> wallet 1, one group emptied while other groups remain, and active unassigned learner remains.
  - Completed:
    - `/api/lesson-wallet` now computes post-wallet assignment state after removing the learner from group students.
    - Coach/Head Coach notifications are sent only when active learners remain without assignment; normal remaining assigned groups do not create reassignment noise.
    - Coach schedule, check-in authorization, teaching programs, and teaching-hour/payroll sources ignore empty groups after wallet actions.
    - Lesson wallet UAT covers multi-learner group removal, emptied group audit retention, split groups, re-wallet chains, duplicate target guards, and payment reuse.
    - Checks passed: `node --check scripts/uat-lesson-wallet.js`, `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run uat:lesson-wallet`, `npm run build`, and `git diff --check`.

- [x] 21.4 Dependency Vulnerability Review
  - Run dependency audit and review only actionable `critical`/`high` issues first.
  - Avoid broad dependency upgrades that could destabilize Next.js, Supabase, Drizzle, or UI behavior.
  - If fixes require package updates, run `npm run lint`, `npx tsc --noEmit`, `npm run check:mojibake`, and `npm run build`.
  - Document any intentionally deferred vulnerability with reason and risk.
  - Completed 2026-05-22:
    - Ran `npm audit --audit-level=moderate`; initial result was 11 vulnerabilities from transitive packages plus Next.js.
    - `npm audit fix` without `--force` did not produce a lockfile-safe fix, so broad forced upgrades were avoided.
    - Added safe npm overrides for transitive dependencies only: `ajv`, `brace-expansion`, `flatted`, `glob`, `minimatch`, `picomatch`, `ws`, and Next's nested `postcss`.
    - Updated direct `postcss` dev dependency to a patched 8.5.x range.
    - Reduced audit result to 1 remaining high-severity Next.js advisory group.
    - Deferred `npm audit fix --force` because it would install `next@16.2.6` and `eslint-config-next@16.2.6`, a breaking framework upgrade that must be handled as a separate upgrade window.
    - Checks passed: `npm run lint`, `npx tsc --noEmit`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.

- [x] 21.4.1 Next.js Major Security Upgrade Spike
  - Review the remaining `npm audit` high-severity Next.js advisory group separately from routine dependency patching.
  - Test upgrade path from Next 14.2.35 to the current secure Next major on a separate branch before production deploy.
  - Re-run role smoke tests after upgrade because routing, middleware, image handling, and App Router behavior can be affected.
  - Completed 2026-05-23 on branch `spike/next-major-security-upgrade`:
    - Upgraded `next` and `eslint-config-next` to `16.2.6`, upgraded ESLint to `9.39.1`, and confirmed `npm audit --audit-level=moderate` reports 0 vulnerabilities.
    - Migrated Supabase server client usage for async `cookies()` and updated App Router pages that receive `searchParams` to the Next 16 Promise-based shape.
    - Replaced deprecated `.eslintrc.json` with ESLint 9 flat config and scoped lint to `src` to match the prior app lint surface.
    - Locked local dev/build to webpack with `next dev --webpack` and `next build --webpack` because the project still has webpack configuration and Next 16 defaults to Turbopack.
    - Renamed request `middleware` convention to `proxy` and converted Tailwind config plugin loading to ESM import so Next 16 dev server opens cleanly.
    - Smoke checked public/protected routes on `http://127.0.0.1:3002`: public pages returned 200 and protected Admin/Coach/User pages returned expected auth redirects.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm audit --audit-level=moderate`, `npm run prod:check`, and `git diff --check`.
    - Not merged into `main` yet; keep this as a reviewed spike branch before deciding whether to promote the framework upgrade.

- [x] 21.5 Staging Deploy Preparation
  - Prepare staging environment variables in the target host.
  - Confirm build command, install command, Node version, and output settings.
  - Run local checks before deployment: `npm run prod:check`, `npm run lint`, `npx tsc --noEmit`, `npm run check:mojibake`, and `npm run build`.
  - Confirm Supabase migrations are already applied and no seed/demo data is required for production.
  - Prepare a rollback point before first staging deploy.
  - Completed 2026-05-23 on branch `spike/next-major-security-upgrade`:
    - Added Node engine requirement `>=20.9.0` and documented staging settings: install `npm ci`, build `npm run build`, start `npm run start` for Node hosts.
    - Added `vercel.json` so Vercel uses `npm ci` and `npm run build`, preserving the Next 16 webpack build flag configured in `package.json`.
    - Updated `.env.example` and production docs to prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` only as fallback, and use `SLIPOK_TEST_MODE=false` for staging/production.
    - Fixed Supabase browser/server/proxy clients to read `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` first with `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback, preventing auth/client breakage if the host only configures the newer Supabase publishable key.
    - Confirmed production readiness against remote Supabase: 0 seed profiles, 0 seed auth users, required master data present, required buckets present, and SlipOK quota readable.
    - Rollback plan documented in `PRODUCTION_READINESS.md`: keep last stable `main`, keep this branch separate until smoke passes, and redeploy stable `main` if staging reveals a framework/runtime blocker.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm audit --audit-level=moderate`, `npm run prod:check`, and `git diff --check`.

- [ ] 21.6 Staging Smoke Test Across Roles
  - Super Admin: settings, payment settings, ranking, teaching program review, payroll/teaching hours, finance.
  - Admin: allowed menu visibility, payment review actions, complaints, notifications, attendance gap handling.
  - Head Coach: schedule, coach suggestion, group assignment, duplicate coach prevention, student grouping by level.
  - Coach: schedule calendar, check-in selfie/location window, attendance, level evaluation, teaching program, teaching hours.
  - User: booking, duplicate booking guard, pricing tier calculation, coupon, SlipOK upload, history, schedule, reschedule, lesson wallet, notifications.
  - Confirm mobile responsive basics for Admin, Coach, and User critical pages.
  - Record any staging-only issue as a new TODO item instead of silently patching unrelated flows.

- [x] 21.6.1 Production Blocker: Attendance Gap Without Assigned Coach
  - Real production case found 2026-05-23: Head Coach can forget to assign a coach/group, the class time can pass, and the Admin makeup/attendance-gap flow becomes stuck because there is no assigned coach to send back to and the existing absence confirmation is too strict for this no-assignment state.
  - Safe resolution rules:
    - If the class really happened but the coach assignment was forgotten, Admin/Super Admin must be able to record a retroactive audited assignment, choose the actual coach, and save attendance for each learner.
    - If no class happened because the school forgot to assign a coach, Admin/Super Admin must close the case as a school/system issue and return the lesson entitlement to the learner, preferably through makeup/wallet credit, without marking the learner absent.
    - If the learner truly did not attend even though no assignment exists, Admin/Super Admin may confirm absence only with a required reason/audit note.
    - Head Coach must not be allowed to perform normal backdated assignment after the class has passed; past no-assignment classes should be handled through the Admin attendance-gap audit flow only.
  - Keep downstream flows aligned: User schedule/makeup/wallet, Coach teaching hours, attendance evidence, and Admin audit log must reflect the selected resolution.
  - Treat as a production blocker before broad owner review because it can leave paid lessons stuck between makeup, attendance, and coach assignment flows.
  - Completed:
    - Admin/Super Admin attendance-gap review now supports three audited outcomes for past sessions without assigned coach:
      - record real attendance by selecting the actual coach; the system creates a retroactive assignment group and writes attendance to that coach,
      - confirm learner absence with a required reason/audit note,
      - return the lesson entitlement into the learner lesson wallet when the school/system caused the missed class.
    - "Send back to coach" is blocked when no coach exists for that round, so the flow no longer sends a task into nowhere.
    - Head Coach normal backdated assignment remains locked after class time; past no-assignment cases are handled through Admin audit flow.
    - User is notified when Admin returns entitlement to the lesson wallet.

- [x] 21.6.2 Production QA Fixes: Admin Schedule Status + SlipOK Mode Visibility
  - Admin schedule status mismatch found 2026-05-23: Admin schedule can still show a past attended round as `รอเรียน` while User schedule correctly shows `มาเรียนแล้ว`.
  - Fix the Admin schedule read model/status mapper to use the same attendance/session truth source as User schedule, and cross-check Coach pages for the same status consistency:
    - `present` / checked attendance should render as `มาเรียนแล้ว`.
    - Past sessions with no attendance should route into the attendance-gap/makeup review states, not remain `รอเรียน`.
    - Wallet/reschedule/makeup states must remain consistent with User schedule and Admin makeup pages.
  - Admin payment review should visibly show current SlipOK mode:
    - Display `SlipOK ใช้งานจริง` when production verification is active.
    - Display `SlipOK TEST MODE` with a clear warning when test mode is active.
  - Do not add a web UI toggle for SlipOK mode. Mode changes must stay in Vercel environment variables and require redeploy, so production payment behavior cannot be changed accidentally from the app.
  - Keep SlipOK API URL/key in environment variables only; never expose secrets in UI.
  - Completed:
    - Admin schedule now derives status from the same session/attendance truth used by User schedule, including completed attendance, in-progress, attendance-gap review, wallet, reschedule, and makeup states.
    - Admin schedule displays coach names from saved coach assignment groups first, with legacy slot assignment as fallback.
    - Coach schedule detail now displays learner status from attendance rows first, so checked students show `มาเรียนแล้ว` / `มาสาย` / `ขาดเรียน` instead of staying `รอสอน`.
    - Coach schedule detail shows a completed attendance badge when all learners in that assigned slot are checked, reducing duplicate check-name actions.
    - Coach attendance/schedule wording now says `บันทึกผลครบแล้ว` for completed attendance so an absent result is not misread as the student attended.
    - Coach monthly calendar and teaching-hour source now ignore assignment groups whose sessions were moved to wallet/rescheduled/cancelled, preventing ghost orange dots and non-payable hours after wallet actions.
    - Admin payment review now displays server-side SlipOK mode clearly as live production verification or TEST MODE without exposing API keys and without adding a risky UI toggle.
    - Verification target: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.

- [x] 21.6.3 Verified Booking Gate for Teaching/Assignment Surfaces
  - Production blocker found 2026-06-01: Admin overview, Admin schedules, and Head Coach assignment can treat `pending_payment` / `paid` bookings as teaching-ready rows, while payment review still shows those bookings are not fully verified.
  - Business rule: only `bookings.status = verified` is a real teaching session that can show as scheduled/learning, be assigned to Coach, appear on Coach schedule/check-in/attendance, and count toward teaching hours.
  - Keep `/admin/payments` broad enough to show pending/paid/verified payment review states; do not hide payment problems from Admin.
  - Fix Admin overview and Admin schedules operational calendars to load verified bookings only.
  - Fix Head Coach assignment to load verified bookings only and add server-side assignment API validation so non-verified booking sessions cannot be saved into assignment groups.
  - Fix Coach schedule/student-memory access helpers to ignore pending/paid bookings on teaching surfaces.
  - After code changes, run `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.
  - Completed:
    - Admin overview and Admin schedules now load only `bookings.status = verified` into operational teaching calendars and "today/scheduled" counts.
    - Head Coach assignment now loads only verified booking sessions, so unpaid or slip-pending learners cannot be grouped from the UI.
    - `/api/coach/assignment-groups` now validates submitted booking sessions server-side and rejects any session whose booking is not `verified`.
    - Coach schedule, Coach student access, Coach-student memory, and teaching-hour/payable source helpers now ignore pending/paid bookings on teaching surfaces.
    - Payment audit remains broad and still shows pending/paid/verified states for Admin review.
    - Read-only production audit found 20 existing assignment-group student rows tied to non-verified booking sessions and 122 pending/paid sessions that the old calendar query could show; this code now hides/blocks them from teaching surfaces, but no production cleanup was performed.
    - Verification passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.

- [x] 21.6.4 Payment Pending Visibility for User/Admin
  - Production follow-up found 2026-06-01: after gating teaching surfaces to verified bookings only, `pending_payment` / `paid` bookings can correctly disappear from teaching calendars, but User/Admin still need a clear place to see and resolve those incomplete bookings.
  - Business rule:
    - `bookings.status = verified` is the only status that enters teaching, assignment, coach schedule, attendance, and teaching-hour flows.
    - `pending_payment` means the user has not completed slip upload yet and must see an obvious path to continue payment.
    - `paid` means a slip/payment exists but the booking is not verified yet, so Admin must be able to track it and User must understand the booking is not complete.
  - Add User-facing visibility on schedule/history/dashboard so incomplete bookings do not look lost after being removed from teaching calendars.
  - Add Admin payment visibility for booking-level incomplete items, including bookings that do not have a payment row yet.
  - Do not change verified booking behavior.
  - After code changes, run `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.
  - Completed:
    - User schedule now shows a clear incomplete-payment banner when the user has `pending_payment` or `paid` bookings that are intentionally excluded from the teaching calendar.
    - The banner explains that those bookings do not enter teaching/assignment flow until verified, summarizes waiting-slip/waiting-review counts, and links to booking history for slip upload/review.
    - Admin payment review now includes a booking-level "รายการจองที่ยังไม่สมบูรณ์" section for `pending_payment` / `paid` bookings, including bookings with no payment row yet.
    - Admin can search, paginate, see learner/branch/course/month/session/amount, and copy booking/payment ids for follow-up without changing verified payment review behavior.
    - Follow-up closeout 2026-07-04: `/admin/payments` multi-child learner display now falls back from `bookings.child_id -> children` to unique learner names from `booking_sessions.child_id` when `bookings.child_id` is null by design. Source commit `abe01e11324bbb1d5bc29034fe516f0bfa655220` deployed as `dpl_CdVyyJMkYWcSJJBZrWY6aajcZ1Mf`; production smoke confirmed `ปันนา, ปีนัง`, `เอมี่, เอลซ่า`, and `ภูเมธ, ซานต้า, ซันเดย์, ตุลย์` display correctly, single-child `Tigger` still displays, search/detail modal use the derived learner name, and console errors/warnings were 0.
    - This learner-name fallback is display/read-model only. It did not change payment approval/reject/send-back/cancel logic, payment status/amount logic, pricing, SlipOK behavior, DB/migrations, booking/session/payment/coupon data, or write behavior; no payment write action was clicked.
    - Verified booking behavior remains unchanged: verified bookings are still the only rows that enter teaching, assignment, coach schedule, attendance, and teaching-hour flows.
    - Verification passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, and `git diff --check`.
    - `npm run prod:check` passed readiness checks with one environment warning: local `SLIPOK_TEST_MODE=true`; production must keep SlipOK live credentials configured in Vercel before deploy.
    - Follow-up closeout 2026-07-04: User Payment / Slip Upload reliability hardening deployed as source commit `bc5e013b4b0d90b517f908d9aaf34e7caad5f43b` (`fix(payment): harden slip upload reliability`), deployment `dpl_B2895m9DiJwxm3xWEhu64BUYDhAj`, production alias `https://www.newathleteschool.com`.
    - Reliability risk addressed: the slip upload flow could feel stuck or unclear when SlipOK was slow/timeout-prone or when a partial failure occurred after upload/payment insert.
    - Fix details: SlipOK request now has a 25s `AbortController` timeout with typed `SLIPOK_TIMEOUT`; `/api/verify-slip` returns clearer safe messages/codes for storage upload failure, SlipOK timeout/rejection/invalid slip, payment insert failure, and booking update failure after payment insert; `/dashboard/history` shows upload/verify/refresh/failed states and disables duplicate submit/file changes while pending.
    - Business semantics preserved: SlipOK approved still creates payment `approved` and booking `verified`; timeout/rejected/manual-review still records payment `pending` and booking `paid`; payment approval/reject/send-back/cancel semantics, pricing, DB migrations, and direct DB repair were not changed/performed.
    - Production read-only smoke passed: production alias, `/dashboard/history`, and `/admin/payments` loaded; pending payment/upload UI rendered without submitting a slip; console errors/warnings were 0; no React hydration error or React #418 was found.
    - Post-deploy read-only inconsistency audit passed: payments scanned 392, paid/verified bookings 392, and 0 rows for payment-exists-but-booking-pending, approved-payment-but-booking-not-verified, paid/verified-booking-without-payment, and duplicate-payment-per-booking checks.
    - Browser slip-upload write smoke remains `NEED REVIEW` because no clearly disposable/test pending booking existed. No production slip upload was performed, no booking/payment/slip/coupon was created, and no payment/write action was clicked.
    - Follow-up closeout 2026-07-08: `/dashboard/booking` draft preservation deployed as source commit `85aa80a90bd645b63e7bab1fbca408fa66cf2c73` (`fix(booking): preserve draft state`), deployment `dpl_AZhW1vNkdGm4oZiMZvVb4hx152qr`, production alias `https://www.newathleteschool.com`.
    - Reliability issue addressed: booking wizard state lived only in React `useState`, so refresh/remount/auth refresh/returning to the page could lose selected course, learner, branch, and session draft state.
    - Fix details: `/dashboard/booking` now preserves a validated client-only `sessionStorage` draft scoped by `nabs:booking-draft:v1:{userId}:new` or `nabs:booking-draft:v1:{userId}:edit:{bookingId}`. It persists selection state (`step`, course/learner/child/private attend/branch/month/year/session map/active tab/update time) but does not persist price source of truth, coupons, payment state, API errors, or loading state.
    - Draft restore validates course type, child ids, branch ids, active learner key, and session shape; corrupt/invalid drafts are removed. UI shows `กู้คืนแบบร่างการจองล่าสุดแล้ว` and `ล้างแบบร่าง`; draft clears after successful `POST`/`PUT`, discard, and mode/edit key change, but not on API failure, refresh, slow network, or summary back.
    - Production smoke passed: Private -> `A'Arm Chanin` -> `แจ้งวัฒนะ` -> `จันทร์ 6 ก.ค. 69` -> `08:00-09:00` restored after refresh with recalculated price `฿900`; summary/back preserved it; `ล้างแบบร่าง` cleared it; console errors/warnings/pageerrors were 0; no React hydration error or React #418 was observed.
    - Safety preserved: no API, DB, migration, pricing, `/api/bookings` payload shape, duplicate guard, schedule template, same-day future-slot, payment/slip, lesson-wallet, reschedule, or coupon semantic changes. `ยืนยันการจอง` was not clicked, and no booking/payment/slip/coupon was created.
    - `NEED REVIEW`: kids_group multi-child browser smoke was not tested because the safe smoke session had no child records; pending edit booking smoke was not tested because no pending editable booking was visible. Next recommended task is Booking Performance Audit for real speed improvement, or branch/month reset confirmation if users still feel selections disappear during in-page changes.

- [x] 21.6.5 Coach Check-in Image Visibility
  - Production issue found 2026-06-01: Coach check-in rows can show check-in time and GPS, but the selfie image breaks because `coach-checkins` is a private Supabase Storage bucket while old rows store public object URLs.
  - Business rule: keep coach selfie evidence private; do not make `coach-checkins` public and do not change check-in, attendance, or payroll logic.
  - Fix:
    - Added a dedicated server helper that converts old public URLs or object paths into short-lived signed URLs for the private `coach-checkins` bucket.
    - Admin `/admin/coach-checkins` now resolves selfie evidence through signed URLs before passing rows to the client.
    - Coach check-in history uses the same signed URL path through the assigned schedule helper.
    - Added a readable Admin fallback if a signed evidence image still cannot load.
  - Verification passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.
  - `npm run prod:check` still reports the existing local environment warning: `SLIPOK_TEST_MODE=true`; production Vercel env must remain configured for live SlipOK.

- [x] 21.6.6 Makeup Attendance Review Data Source Fix
  - Production issue found 2026-06-01: Admin schedule could show past verified sessions as `attendance_gap_review`, but Admin Makeup/วันชดเชย showed 0 rows because the page loaded only the newest 300 `booking_sessions`; future sessions filled that limit and hid older past review rows.
  - Business rule:
    - Only verified bookings can enter attendance-gap/makeup review.
    - Past sessions with no attendance must remain visible for Admin review even when the system has many future bookings.
    - Pending/paid/unverified bookings must stay out of teaching, assignment, attendance, and makeup-credit flows.
  - Completed:
    - Admin Makeup now queries verified past source sessions and linked makeup sessions separately, using Bangkok-local today instead of one newest-row limit.
    - Attendance scope for grouped/slot sessions now excludes non-verified, rescheduled, and walleted rows before deriving review/absence status.
    - Admin schedule and Admin overview now add a direct action from `attendance_gap_review` rows to `/admin/makeup`, so staff can see where to resolve the case.
  - Verification passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.
  - `npm run prod:check` still reports the existing local environment warning: `SLIPOK_TEST_MODE=true`; production Vercel env must remain configured for live SlipOK.

- [x] 21.6.7 Makeup Attendance Review Grouped Per-Student Actions
  - Admin Makeup "attendance review" must group rows by teaching round, coach, branch, course, date, and time so high-volume cases are readable.
  - "Send to coach for review" is a round-level action with one button per round.
  - Retroactive attendance, confirm absence, close case, and return entitlement remain per-student actions only.
  - Coach Attendance must show Admin-returned work in a clear "retroactive review" section.
  - Coach must still check in retroactively with selfie + GPS before recording attendance if evidence is missing.
  - Coach attendance remains per-student only; no group-level attendance button.
  - Must not affect verified booking gate, lesson wallet, makeup eligibility, payroll/teaching hours, or existing attendance rows.
  - Implemented: Admin Makeup now renders attendance-gap review rows as grouped teaching rounds with one round-level "send to coach" action and per-student resolution actions.
  - Implemented: Coach Attendance now shows Admin-returned retroactive review rounds in a dedicated section; missing check-in evidence routes the coach to retroactive selfie/GPS check-in before per-student attendance.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`, `npm run build`, and `npm run prod:check`.
  - `npm run prod:check` still reports the existing local environment warning: `SLIPOK_TEST_MODE=true`; production Vercel env must remain configured for live SlipOK.

- [x] 21.6.8 Admin Coach Check-in Audit UX Scalability Pass
  - Production UX issue found 2026-06-02: Admin `/admin/coach-checkins` has correct data but becomes visually noisy with many coaches and many assigned rounds.
  - Goal:
    - Keep coach check-in, attendance, payroll, and storage evidence logic unchanged.
    - Show a compact problem-first queue grouped by teaching round so Admin can review missing check-ins, missing selfie, late check-ins, and missing GPS before browsing all rows.
    - Keep coach summary and all-record audit table available, but reduce their visual weight with tighter height and pagination.
    - Preserve detail dialog for signed selfie/GPS review.
  - Implemented: added a problem-first review queue grouped by date/time/branch/course, with per-coach issue chips and a detail action that reuses the existing selfie/GPS dialog.
  - Implemented: default all-record audit pagination is now lighter at 15 rows/page, coach summary height is reduced, and GPS evidence checks use null-safe logic.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`, `npm run build`, and `npm run prod:check`.
  - `npm run prod:check` still reports the existing local environment warning: `SLIPOK_TEST_MODE=true`; production Vercel env must remain configured for live SlipOK.

- [x] 21.6.9 Attendance State Single Source of Truth + Reconciliation
  - Production consistency issue found 2026-06-02: Coach attendance can show a learner checked/present while Admin schedule or Makeup review still shows `รอตรวจเช็คชื่อ`/pending because some surfaces trust `booking_sessions.status` while others read `attendance`.
  - Business rule:
    - `attendance` is the source of truth for present, late, and absent.
    - `booking_sessions.status` is a lifecycle/cache field and must not be used alone for attendance display, makeup eligibility, payroll/audit, or Admin/User/Coach schedule status.
    - Pages may still write `booking_sessions.status` as a cache/audit status after attendance is recorded, but display logic must derive from attendance first.
  - Goals:
    - Use `src/lib/session-attendance-status.ts` as the shared helper for Admin overview, Admin schedules, Admin makeup, Coach schedule/attendance, and User schedule.
    - Keep per-student attendance decisions per student; do not collapse multiple learners in one teaching round into one status.
    - Add `npm run attendance:reconcile:dry-run` to report attendance/status mismatches without modifying production data.
    - Do not run any production reconciliation write until owner confirms the dry-run report.
  - Implemented:
    - Added shared attendance-state helpers in `src/lib/session-attendance-status.ts`, including per-session and per-session+student latest-attendance maps.
    - Admin overview, Admin schedules, Admin makeup, User schedule, Coach schedule, and coach assigned schedule now derive display status from `attendance` first.
    - Added `npm run attendance:reconcile:dry-run` for report-only production mismatch checks. The script uses smaller batches and retry logic to avoid long URL/fetch failures.
    - Added `AGENTS.md` rule: attendance is the source of truth; `booking_sessions.status` is only lifecycle/cache.
  - Dry-run result on 2026-06-02:
    - Verified teaching sessions checked: 726.
    - Attendance rows checked: 11.
    - Status mismatches found: 11 (`attendance` exists but `booking_sessions.status` is stale).
    - Booking status without attendance rows found: 8.
    - No production data was modified.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Next safe step if owner confirms: add a separate reconciliation write script/API to update stale `booking_sessions.status` from attendance, after reviewing the dry-run list.

- [x] 21.6.10 Admin Attendance RLS Visibility Guard
  - Production issue found 2026-06-02: Coach Attendance showed learners as checked/present, but Admin overview/schedule/makeup could still show `รอตรวจเช็คชื่อ` because server-rendered Admin pages queried `attendance` through the session client and could be affected by RLS/session visibility.
  - Business rule:
    - Admin pages remain protected by `requireAdminPageAccess`/Admin layout before rendering.
    - After Admin authorization, read-only attendance/evidence queries for Admin status rendering should use the service-role client so all Admin/User/Coach surfaces see the same attendance truth.
    - Do not change Coach attendance writes, payroll, lesson wallet, makeup rule, or production data.
  - Implemented:
    - Admin overview, Admin schedules, and Admin makeup now read `attendance` rows with `getServiceRoleClient()` while continuing to derive display status through `src/lib/session-attendance-status.ts`.
    - Added `AGENTS.md` guard so future Admin attendance reads do not accidentally fall back to session/RLS-dependent status logic.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Production data check: the 2026-06-02 rows for `เปรม`, `พรีม`, and `พรีโม่` have `attendance.status = present`; the patched Admin display rule derives them as `completed/มาเรียนแล้ว` even though `booking_sessions.status` is still stale `scheduled`.

- [x] 21.6.11 Admin Attendance Status Shared Scope Fix
  - Production consistency issue found 2026-06-02: Admin overview, Admin schedules, and Admin makeup can still disagree if each page builds attendance scope separately.
  - Goal:
    - Admin overview, Admin schedules, and Admin makeup must use one shared helper for attendance status and scope decisions.
    - The shared helper must read the same group/slot scope so one attended learner or one checked round is interpreted consistently across Admin surfaces.
    - Keep `attendance` as source of truth and keep service-role read-only attendance queries after Admin route authorization.
    - Do not modify production data, do not run reconciliation writes, and do not deploy until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Implemented:
    - Added `src/lib/admin-attendance-state.ts` as the shared Admin scope/status helper.
    - Admin overview, Admin schedules, and Admin makeup now use the same group/slot attendance scope and derive display state through the same helper.
    - Added an `AGENTS.md` rule so future Admin attendance views do not recalculate scope independently.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Production data was not modified. Production was not deployed.

- [x] 21.6.12 Attendance Status Exact Student Scope + Admin Review Link Fix
  - Production consistency issue found 2026-06-02: Coach can show attendance completed per learner while Admin overview/schedules still marks the same learner as attendance-gap review, and the Admin review button can open Makeup without showing the same item.
  - Root rule:
    - `attendance` remains the source of truth for present/late/absent.
    - Attendance display must match by `booking_session_id + expected_student_id`, not by session id alone.
    - Expected student id is `booking_sessions.child_id` for child learners, otherwise `bookings.user_id` for self/adult learners.
  - Goals:
    - Admin overview, Admin schedules, and Admin makeup must use the same exact per-student helper scope as Coach/User pages.
    - Admin attendance queries must include `student_id` so display status cannot be derived from an unrelated learner in the same teaching slot.
    - Admin review links should carry enough context (`review`, `date`, `session`) so staff land on the relevant Makeup review context.
    - Add a dry-run/report path to expose mismatches without writing production data.
  - Safety:
    - Do not modify production data.
    - Do not run reconciliation writes.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Implemented:
    - Added an exact Admin attendance helper that resolves each learner by `booking_session_id + expected_student_id`.
    - Admin overview, Admin schedules, and Admin makeup now select `attendance.student_id` and use the same exact-scope display status.
    - Admin review links now include `review`, `date`, and `session` so the Makeup page can highlight the same review context.
    - Expanded the attendance dry-run report to show exact student-scope mismatches without writing production data.
    - Added an `AGENTS.md` rule so future attendance surfaces do not fall back to broad session-only status.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Dry-run result 2026-06-02:
    - `Student-scope attendance mismatches: 0`.
    - `Status mismatches: 21` remain because some production `booking_sessions.status` rows are stale while attendance already exists; no production data was modified.

- [x] 21.6.13 Admin Schedule Single Source Display Fix
  - Production consistency issue found 2026-06-02: Admin overview duplicated the schedule/calendar display and could continue showing confusing attendance-review states even after Makeup/Coach source-of-truth fixes.
  - Goals:
    - Remove the duplicate schedule/calendar section from Admin overview so `/admin` is KPI-only.
    - Keep `/admin/schedules` as the single Admin schedule surface for calendar/status review.
    - Make `/admin/schedules` load attendance through the exact Admin attendance helper and fail visibly if attendance cannot be loaded, instead of silently defaulting past sessions to review.
    - Query large attendance scopes in chunks so production months with many booking sessions do not lose attendance data because of one oversized `.in()` request.
  - Safety:
    - Do not modify production data.
    - Do not change Coach/User attendance writes, makeup rules, payroll, booking verified gate, or lesson wallet behavior.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Completed 2026-06-02:
    - `/admin` now keeps only KPI cards and no longer renders a duplicate schedule/calendar surface.
    - `/admin/schedules` remains the single Admin schedule surface.
    - Admin schedule attendance loading now queries attendance rows in chunks and throws a visible server error if attendance cannot be loaded, instead of silently treating past sessions as review gaps.
    - No production data was modified.
  - Verification:
    - `npm run check:mojibake` passed.
    - `npx tsc --noEmit` passed.
    - `npm run lint` passed.
    - `npm run attendance:reconcile:dry-run` passed; report still shows production `booking_sessions.status` rows that are stale while attendance rows already exist, which is data reconciliation follow-up only.
    - `git diff --check` passed with Windows line-ending warnings only.
    - `npm run build` passed.

- [x] 21.6.14 Attendance Reconciliation Write
  - Production data consistency issue confirmed 2026-06-03: `attendance` rows were correct, but 21 `booking_sessions.status` rows were still stale as `scheduled`.
  - Business rule:
    - `attendance` remains the source of truth for present/late/absent.
    - Reconciliation writes may update only `booking_sessions.status`.
    - `present`/`late` attendance maps to `booking_sessions.status = completed`.
    - `absent` attendance maps to `booking_sessions.status = absent`.
    - Do not touch payments, bookings, lesson wallet, makeup records, coupons, coach assignments, or attendance rows.
  - Implemented:
    - Added `npm run attendance:reconcile:write` using the same report logic as `npm run attendance:reconcile:dry-run`.
    - Write mode refuses to run if exact student-scope mismatches are found.
    - Write mode updates rows by current `id + status` guard to avoid overwriting concurrent changes.
  - Production write result:
    - Dry-run before write: `Student-scope attendance mismatches: 0`, `Status mismatches: 21`.
    - Write applied: 21 `booking_sessions.status` rows updated from attendance.
    - Dry-run after write: `Student-scope attendance mismatches: 0`, `Status mismatches: 0`.
    - `Booking status without attendance: 9` remains as a separate historical-data review bucket; no action was taken on those rows.
  - Production was not deployed for this data-only reconciliation.

- [x] 21.6.15 Attendance Write-Through / DB Sync Guard
  - Production issue found 2026-06-03: Coach/Admin attendance can be correct while `booking_sessions.status` becomes stale, causing Admin/User/Coach status displays to disagree.
  - Goals:
    - Every Coach/Admin attendance write must sync the exact `booking_sessions.id` immediately.
    - `attendance` is the source of truth for present/late/absent.
    - `present`/`late` maps to `booking_sessions.status = completed`.
    - `absent` maps to `booking_sessions.status = absent`.
    - Update only the exact learner `booking_session_id`; never update another learner in the same slot/group.
    - Do not rely on daily/manual reconciliation for new attendance writes.
  - Safety:
    - Do not touch payments, bookings, lesson wallet, makeup rules, coupons, or coach assignment data.
    - If production stale data remains, report the exact rows before writing.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run attendance:reconcile:dry-run`, `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`, and `npm run build`.
  - Implemented:
    - Added shared `syncBookingSessionStatusFromAttendance()` helper so Coach/Admin attendance writes use the same mapping.
    - Coach attendance API now writes attendance, then uses service-role write-through to update only the exact `booking_sessions.id`.
    - Admin makeup retrospective attendance API now uses the same helper for exact-session status sync.
  - Verification:
    - Dry-run before code fix: `Student-scope attendance mismatches: 0`, `Status mismatches: 2`, `Booking status without attendance: 0`.
    - `npx tsc --noEmit` passed.
    - `npm run check:mojibake` passed.
    - `npm run lint` passed.
    - `git diff --check` passed with Windows line-ending warnings only.
    - `npm run build` passed.
    - Dry-run after code fix reported existing stale production rows; owner confirmed production sync.
  - Production data sync after owner confirmation:
    - `b4f96087-8dd1-4747-beab-5519de5eedd0` | 2026-06-03 15:00-17:00 | learner `แผ่นดิน` | `scheduled` -> `completed` from `present`.
    - `b1611125-efc8-458f-85e1-2f96a9a7b69b` | 2026-06-03 15:00-17:00 | learner `มาวิน` | `scheduled` -> `absent` from `absent`.
    - `753d6ba5-f782-41a0-81f7-cb291b0a2de5` | 2026-06-03 17:00-19:00 | learner `ปริญ` | `scheduled` -> `completed` from `present`.
    - Dry-run after write: `Student-scope attendance mismatches: 0`, `Status mismatches: 0`, `Booking status without attendance: 0`.
  - Production deploy note:
    - New attendance writes will auto-sync only after this code guard is deployed to production.

- [x] 21.6.16 Retroactive Coach Evidence Request
  - Production issue found 2026-06-03: Admin can record retroactive attendance for a real taught slot, but if no `coach_checkins` evidence exists, the owner still sees "no evidence" and has no clean way to request only selfie/GPS from the responsible coach.
  - Goals:
    - Admin can keep recording retroactive attendance as before.
    - If attendance is recorded but `coach_checkins` evidence is missing or incomplete, show "attendance recorded, coach evidence missing".
    - Add an Admin action to request retroactive coach evidence.
    - Coach sees the retroactive task and must submit selfie + GPS through the coach check-in flow.
    - Admin must never create coach evidence on behalf of a coach.
  - Safety:
    - Do not touch payment, booking, lesson wallet, makeup entitlement rules, coupons, or assignment logic.
    - Evidence request should use notification/activity log only until the coach submits real selfie/GPS.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Implemented 2026-06-03:
    - Admin makeup review now separates "attendance recorded but coach evidence missing" from real missing-attendance cases.
    - Added an Admin action to request retroactive coach evidence for a grouped slot without creating `coach_checkins` on behalf of the coach.
    - Coach retro check-in lookup now accepts the new evidence-request activity action, so the responsible coach can submit selfie + GPS through the existing coach check-in flow.
    - Scope preserved: no payment, booking, lesson wallet, makeup entitlement, coupon, or assignment logic was changed.
  - Verification:
    - `npm run check:mojibake` passed.
    - `npx tsc --noEmit` passed.
    - `npm run lint` passed.
    - `git diff --check` passed.
    - `npm run build` passed.
    - `npm run attendance:reconcile:dry-run` passed as a report-only command, but reported 1 existing production status mismatch outside this item: session `1b9d1b2b-2078-4c47-a042-46d74ae41fa6`, learner `โหย่ว`, 2026-06-03 17:00-19:00, `booking_status=scheduled`, `attendance=present`, expected `completed`. No production data was modified.

- [x] 21.6.17 Makeup Review Action Guard + Bangkok Time Fix
  - Production issue found 2026-06-03: Admin makeup review actions share one broad validation guard, so valid actions such as retroactive attendance or close review can be blocked by confirm-absent rules and show the wrong error.
  - Goals:
    - Make session-ended checks explicit to Asia/Bangkok time.
    - Split `/api/admin/makeup` validation by action instead of using one shared status guard.
    - `confirm_absent` uses only the confirm-absent rule.
    - `mark_attendance` can record retroactive attendance after the class has ended in Bangkok time.
    - `close_review` can close the case without being blocked by confirm-absent validation.
    - `return_entitlement` keeps its own entitlement return rules.
    - `request_coach_review` and `request_coach_evidence` keep their existing flow.
    - Error messages should match the action the Admin clicked.
  - Safety:
    - Do not touch payment, booking, lesson wallet, coupon, or assignment logic outside this action guard.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Implemented 2026-06-03:
    - `/api/admin/makeup` now evaluates ended sessions using an explicit Asia/Bangkok `+07:00` timestamp.
    - Replaced the shared non-scheduled status guard with action-specific validation.
    - `confirm_absent` keeps the confirm-absent-only rule, while `mark_attendance`, `close_review`, `return_entitlement`, `request_coach_review`, and `request_coach_evidence` keep their own action flow after the class has ended.
    - Error messages now match the action that Admin clicked instead of always returning the confirm-absent message.
    - Scope preserved: no payment, booking, lesson wallet, coupon, or assignment logic was changed.
  - Verification:
    - `npm run check:mojibake` passed.
    - `npx tsc --noEmit` passed.
    - `npm run lint` passed.
    - `git diff --check` passed with Windows line-ending warnings only.
    - `npm run build` passed.
    - `npm run attendance:reconcile:dry-run` passed as report-only. It found 1 existing production status mismatch outside this item: session `1b9d1b2b-2078-4c47-a042-46d74ae41fa6`, learner `โหย่ว`, 2026-06-03 17:00-19:00, `booking_status=scheduled`, `attendance=present`, expected `completed`. No production data was modified.

- [ ] 21.6.18 Attendance Sync Root-Cause Audit + Write-Path Enforcement
  - Production blocker: `attendance` and `booking_sessions.status` must not drift again after Coach/Admin records attendance. Manual reconciliation is only a repair tool, not the normal operating model.
  - Problem evidence:
    - Dry-run after 21.6.17 still found session `1b9d1b2b-2078-4c47-a042-46d74ae41fa6`, learner `โหย่ว`, 2026-06-03 17:00-19:00, `booking_status=scheduled`, `attendance=present`, expected `completed`.
    - This means at least one write path can still create/update attendance without syncing the exact `booking_sessions.id`.
  - Goals:
    - Audit every code path that writes to `attendance`.
    - All Coach/Admin attendance writes must call one shared write-through helper immediately after attendance is created or updated.
    - The helper must update only the exact `booking_sessions.id` for that student/session.
    - `present` or `late` must sync `booking_sessions.status` to `completed`.
    - `absent` must sync `booking_sessions.status` to `absent`.
    - Admin/User/Coach display must keep reading attendance-derived status through the shared status helper instead of deciding from `booking_sessions.status` alone.
    - Add a guard/check script or test that fails/report-blocks when future attendance writes are not followed by status sync.
    - Run dry-run before and after the fix. Production stale rows must be reported before any write, and production writes require owner confirmation.
  - Safety:
    - Do not touch payment, booking purchase, lesson wallet, coupon, pricing, SlipOK, or coach assignment behavior unless directly needed to preserve exact-session status sync.
    - No blind production data update. Any stale sync write must be scoped to listed session IDs and confirmed first.
    - No deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.

## Phase 3 - Build & Deploy Readiness

- [x] Make `npm run build` pass.
- [x] Add mojibake guard: run `npm run check:mojibake` before committing Thai UI/copy changes.
- [x] Add local verification note: after `npm run build`, restart the dev server before checking localhost to avoid stale Next CSS chunks.
- [x] Reduce lint blockers: unused imports, unused variables, JSX escaping, and high-risk `any` usage.
- [x] Current local verification passes: `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Review dependency vulnerabilities and update safely.
- [ ] Prepare production environment variables.
- [ ] Deploy staging and run smoke tests.

## Phase 4 - Feature Completion

- [ ] Real-time notifications.
- [ ] Automated renewal/payment reminders.
- [ ] Advanced reports for revenue, enrollment, coach performance.
- [ ] Level recommendation system.
- [ ] Adult package usage across 10 months.
- [ ] Waitlist and class capacity enhancements.

## 2026-07-17 - Admin Schedules Unassigned Group Classification Audit/Fix

- Owner selected this as the single urgent active task and authorized only
  read-only audit, narrow Source fix, local verification, and documentation.
- Read-only Production evidence confirmed the source contract failure on the
  2026-07-16 Rama 2 Kids Group 17:00-19:00 round: exact group
  `476fb938-af93-4689-82cb-377acd108d0d` has five active learner memberships and
  `coach_id = null`; same-slot legacy coaches are not exact learner evidence.
  Production data was not changed.
- Root cause: Admin Schedules treated any group membership as Assigned and rendered
  every non-empty group green. It did not require a resolved coach profile/role.
- Scoped Source fix: `src/lib/admin-schedule-assignment-state.ts` now owns the
  exact-valid predicate and round buckets; the schedule page supplies profile id,
  name, and role; the client renders grouped-but-unassigned learners in a red
  warning group and counts them in `รอจัดโค้ช`. Wallet and valid-group behavior
  remain unchanged.
- Verification passed: deterministic checks `12/12`, disposable authenticated
  desktop/mobile Playwright `1/1` with residue `0`, TypeScript, targeted/full
  ESLint, mojibake `231`, `git diff --check`, visual screenshot inspection, and
  agent-browser dev health. Build was not required/run.
- State observed at this closeout: Source complete locally; tests passed; not
  committed, pushed, deployed, enabled, allowlisted, or Production-active; no
  migration, Production write, data repair, customer-data change, or financial
  impact. Next gate is Owner approval for commit/push/deploy and authenticated
  read-only Production UAT. Admin Schedules Performance and Homepage LV remain
  unauthorized Parking Lot items.

### Build + Commit + Push closeout (state observed 2026-07-17)

- Owner subsequently authorized re-verification, Production Build, post-build
  clean restart, a scoped Source/Test commit and push, and a separate documentation
  closeout commit and push. Deploy, Production UAT, Production data changes,
  migration, auto-assignment, Admin Schedules Performance, and Homepage LV remained
  prohibited.
- Verification passed again: deterministic assignment-state checks `12/12`;
  disposable authenticated desktop/mobile Playwright `1/1` with fixture residue
  `0`; visual artifact inspection; TypeScript; targeted and full ESLint; mojibake
  `231`; and scoped/staged `git diff --check`.
- Production Build passed with 91/91 static pages. The verified repo-local `.next`
  directory was removed, the dev server restarted cleanly on `127.0.0.1:3000`,
  root and a generated static asset returned `200`, and `/admin/schedules` returned
  the expected `307` login redirect with no server error.
- Functional commit `0226e363f6677b078430f93459c2ee2ede6484e8` contains exactly
  the seven approved Source/Test files and is pushed to
  `origin/spike/next-major-security-upgrade`. The unrelated dirty `AGENTS.md`,
  content-identical/stat-dirty `src/lib/schedule-slot-utils.ts`, and
  `docs/performance/` remained excluded.
- State observed at this closeout: Source is tested, built, committed, and pushed;
  deployment has not started; Production-active behavior and Production UAT for
  this fix are not claimed; Production data did not change; customer impact remains
  the existing misleading Admin/Head Coach classification until deployment; and
  financial impact is none. Task Done remains No. The next gate is Owner approval
  for exact-source deployment and authenticated read-only Production UAT.

### 2026-07-17 — Admin Schedules Unassigned Coach Group Production Release Closeout

State observed at this closeout on 2026-07-17:

- Root cause: Admin Schedules treated exact learner group membership alone as
  Assigned without requiring a non-null group `coach_id`, matching resolved coach
  profile, non-empty coach name, and `coach|head_coach` role. That made an
  unassigned learner group green and incorrectly counted its learners as coached.
- Owner authorized only fresh Git/Vercel preflight, exact-source Production
  deployment, convergence of the established aliases, authenticated read-only
  Production UAT, runtime monitoring, and final documentation closeout. No
  Source/Test change, migration, environment/feature-control/allowlist change,
  Production business-data write, assignment save, attendance/check-in/payroll
  write, auto-assignment, performance work, Homepage LV work, or new task was
  authorized or performed.
- Gate 0 passed on branch `spike/next-major-security-upgrade`: pre-closeout Local,
  upstream, and fetched remote HEAD were
  `487b63ee7faa0e0b14703a9603d287035fccddec`, ahead/behind `0/0`; functional
  Source `0226e363f6677b078430f93459c2ee2ede6484e8` was an ancestor and contained
  exactly the seven approved Source/Test files. Unrelated dirty `AGENTS.md`,
  `src/lib/schedule-slot-utils.ts`, and `docs/performance/` remained excluded.
- Pre-deploy Gate 1 verified Ready rollback deployment
  `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr`, its four established aliases, healthy root/
  health/static/auth responses, and the unchanged set of eleven Production
  environment variable names. The older pre-Teaching-Programs deployment was not
  selected as the rollback target.
- Exact Source `0226e363f6677b078430f93459c2ee2ede6484e8` was deployed from a
  clean detached worktree with tree
  `d1b371bfcaef19494c4ac723b89f3e3e9e416ec0`. Vercel Production Build passed
  with 91/91 static pages. Ready deployment
  `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8` was created and all four established aliases
  converged to it:
  - `www.newathleteschool.com`
  - `new-athlete-badminton-school.vercel.app`
  - `new-athlete-badminton-school-aachanin1s-projects.vercel.app`
  - `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`
- Post-deploy root, `/api/health`, generated static asset, and Admin auth guard
  checks passed. Production environment names remained unchanged; no feature flag,
  allowlist, migration, or local environment/link file changed. Rollback was not
  used.
- Authenticated Super Admin read-only Production UAT passed the exact reproduction:
  2026-07-16, Rama 2, Kids Group, 17:00–19:00, slot
  `b2c6ec1a-2136-48c5-b0ba-4141d5923d94`, group
  `476fb938-af93-4689-82cb-377acd108d0d`. The group with `coach_id = null` rendered
  red with `ยังไม่ได้มอบหมายโค้ช`; its five active learners counted in
  `รอจัดโค้ช`, same-slot legacy coaches did not make them assigned, and two
  walleted learners remained excluded. Exact counters were
  `7 มีโค้ช / 5 รอจัดโค้ช / 2 อยู่ในกระเป๋า`.
- Both valid exact assigned groups in that round remained emerald/green with coach
  names. Learner LV, attendance labels, and teaching-program boxes remained
  visible. Desktop and explicit 390x844 mobile UAT passed; the red warning was
  readable and stayed inside its card with no horizontal overflow. Browser
  console, hydration, and page errors were `0`.
- Monitoring for the UAT window found runtime errors/5xx `0`, PUT/PATCH/DELETE
  requests `0`, and no assignment, attendance, or check-in mutation. Shared
  Production logs contained two normal `POST /api/reschedule` requests from
  unrelated user traffic; neither was attributable to the Admin Schedules UAT.
  The UAT itself issued no business-data mutation request.
- Final state: Source complete **Yes**; tests/build **Passed**; functional Source
  committed/pushed **Yes**; deployed/Production active **Yes**; authenticated
  read-only Production UAT **Passed**; controlled-write UAT **Not required/not
  run**; data repaired **No**; Production data changed by this task **No**;
  customer impact **corrected Admin/Head Coach assignment classification**;
  financial impact **None**; Task Done **Yes**; Active Task **NONE**; blocker and
  remaining work **None**. Next action is to await Owner selection without starting
  Admin Schedules Performance, Homepage LV, or another Parking Lot task
  automatically.

## 2026-07-17 — Coach Assignment Overlap Guard and Ungrouped Semantics (Local Gate)

State observed at this local closeout on 2026-07-17:

- Initial documentation state still said Active Task `NONE`; Owner selected this
  remediation and supplied six binding decisions. Classified and corrected as
  `DOCUMENTATION DRIFT — NEW OWNER DECISIONS NOT YET RECORDED`.
- Read-only preflight reconfirmed branch
  `spike/next-major-security-upgrade`, Local/upstream/fetched remote HEAD
  `4f2aa8b2e606f9753124b5818bf8b38c246d7a4c`, ahead/behind `0/0`, Ready
  Production deployment `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`, and deployed Source
  `0226e363f6677b078430f93459c2ee2ede6484e8`. Unrelated dirty `AGENTS.md`,
  `src/lib/schedule-slot-utils.ts`, and `docs/performance/` were preserved.
- Production rows matched the audit: Coach Nice
  `4bad40cc-7367-49a2-aa81-42f35d840d79` owns overlapping Ratchada group
  `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a` / slot
  `150b25ba-b55a-448f-9aad-19748ba36b93` / three learners and Ramintra group
  `d0b68d67-1ae3-416c-b2f2-99e9ee994449` / slot
  `98f60622-d02b-4333-9d65-8f4f7a86d8b1` / one learner, both 17:00–19:00.
  Owner selected Ramintra. Legacy rows are respectively
  `3bcafc20-f927-4814-a586-da7819445d60` and
  `b31c3bce-d319-489b-b7a2-ff5382497c0c`.
- Ratchada placeholder group `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc`, name
  `ยังไม่จัดกลุ่ม`, stores Coach Base
  `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe` and two learners. It is now treated as
  non-exact in display semantics, but Production data was not changed. A later
  repair requires an explicit choice between renaming it as a real Base-owned
  group or clearing its coach.
- Root source cause: the normal Head Coach save only rejected duplicate coach ids
  inside one submitted slot and performed non-atomic group/member/legacy writes;
  Admin Makeup paths had no shared cross-slot interval guard; the database had no
  concurrency exclusion. Separately, the ungrouped draft copied a suggested coach
  and Admin Schedules classified any valid group `coach_id` as exact regardless of
  the placeholder name.
- Local implementation added shared exact-conflict inspection and Thai conflict/
  legacy-warning formatting; applied it to the normal assignment route and all
  active Admin Makeup exact-assignment actions; changed the normal save to one
  transaction RPC; added a derived reservation table with GiST exclusion and
  group/member triggers; and added a no-write historical conflict preflight RPC.
  Existing rows are not backfilled or repaired and legacy rows never hard-block.
- Display now excludes `ยังไม่จัดกลุ่ม` from exact assignment and coach search,
  starts a new ungrouped draft with `coachId = null`, retains existing counters,
  and labels legacy coach data as not being the group owner. Exact normal groups
  continue rendering their real responsible coach.
- Verification passed: database conflict/concurrency `11/11`; deterministic
  display/authorization `15/15`; disposable Playwright `2/2`; local fixture and
  reservation residue `0`; TypeScript; full ESLint; mojibake `232`; Production
  Build 91/91; post-build clean restart root/static `200`; and diff check. Local
  migration reset/apply, last-migration rollback, re-apply, preflight `0`, and
  concurrency winner `1/2` passed.
- Production repair dry-run: keep Nice at Ramintra and keep legacy row `b31...`;
  proposed later controlled write clears Nice only from Ratchada group `924...`
  and removes only Ratchada legacy row `3bc...`, leaving three learners grouped
  and waiting for a replacement. Placeholder group `2e7...` remains a separate
  Owner decision. Historical conflicts and attendance/check-in/teaching-hours/
  payroll remain unchanged.
- Final state at this closeout: Source complete locally **Yes**; tests/build
  **Passed**; committed **No**; pushed **No**; Production migration **Not
  applied**; deployed/Production active **No**; Production UAT/write UAT **Not
  run**; data repaired **No**; Production data changed **No**; historical
  attendance/payroll changed **No**; customer impact **existing coordination risk
  remains until approved repair/deploy**; Task Done **No**. Next gate is Owner
  review and explicit approval before commit/push or any Production action.

## 2026-07-17 — Controlled Coach Nice Ratchada Production Repair

State observed after the Owner-approved exact-row repair on 2026-07-17:

- Owner policy: Coach Nice `4bad40cc-7367-49a2-aa81-42f35d840d79` must remain at
  Ramintra for the 17:00–19:00 round. Only the conflicting Ratchada exact group and
  its named matching legacy row were authorized for repair. Group membership,
  Coach Base, historical evidence, and all financial data were prohibited from
  change.
- Fresh preflight matched the approved dry-run exactly: Ratchada group
  `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a` still had Nice and three learners;
  Ratchada legacy row `3bcafc20-f927-4814-a586-da7819445d60` still existed;
  Ramintra group `d0b68d67-1ae3-416c-b2f2-99e9ee994449` still had Nice and one
  learner; Ramintra legacy row `b31c3bce-d319-489b-b7a2-ff5382497c0c` still
  existed. Both slots remained dated 2026-07-17, 17:00–19:00, at their approved
  branches.
- One explicit transaction locked and reasserted the exact slots, groups,
  memberships, legacy rows, coach ids, member counts, and empty downstream
  dependencies before writing. It set only Ratchada group `924...`.`coach_id`
  from Nice to `null` and deleted only legacy row `3bc...`. Exact affected counts:
  group update `1`; legacy delete `1`.
- Independent post-write reconciliation confirmed the Ratchada group has
  `coach_id = null`, its target legacy row is absent, and all three learners remain
  scheduled in the same group: ปฐพี จินตานนท์
  (`35d68dc4-ddcb-4dd4-8b6e-52af8e27f321`), ญาณพัฒน์ คูศุภรเจริญ
  (`5477519d-9447-41f5-aea1-17e3815b3ae1`), and นภิสา จินตานนท์
  (`d64ea638-d350-4d96-9793-d75309a82139`). They are now waiting for a replacement
  coach.
- Ramintra group `d0b...` remains assigned to Nice with learner wynn udompanit
  (`8563888b-b813-4b7b-a617-772da1658178`), and legacy row `b31...` remains.
  Ratchada placeholder group `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc`, Coach Base,
  and its two learners remain unchanged. Target-slot totals remain three groups
  and six memberships.
- Attendance, coach check-in, teaching program, daily teaching hours, weekly
  teaching summary, and payout dependency queries were empty before and after.
  No historical attendance/check-in/teaching-hours/payroll or financial data was
  changed.
- Final state: Source changed in this repair round **No**; migration applied
  **No**; committed **No**; pushed **No**; deployed **No**; data repaired **Yes —
  exact Nice/Ratchada scope only**; Production data changed **Yes — one group
  update and one legacy delete**; financial impact **None**. The local overlap/
  display remediation remains uncommitted and undeployed. Operational remaining
  action: assign a replacement coach to the three Ratchada learners. No next step
  was started automatically.

## 2026-07-17 — Local Auto Group Naming and Migration Safety Gate

State observed at this local closeout on 2026-07-17:

- Owner superseded the prior replacement-coach action: the three learners in the
  Nice/Ratchada group may intentionally remain unassigned and display
  `ยังไม่ได้มอบหมายโค้ช`. Owner confirmed Coach Base is the exact responsible
  coach for the other two Ratchada learners; its coach, members, and legacy row
  must remain, while the placeholder group name requires a separately approved
  rename.
- Naming audit found the old client auto-bands (`0–10`, `11–30`, `31–50`,
  `51–70`) were obsolete and conflicted with the active Level source. The new
  local rule reads the latest `student_levels` row and active `levels.category /
  program_name`. One shared category/program yields that existing program name;
  all LV0 yields the existing `ยังไม่ประเมิน` label. Mixed categories, mixed
  assessed/unassessed members, or incomplete/inactive definitions do not invent a
  name and require a manual group name. Valid user-authored names remain intact.
- Stored auto-names no longer include `(N คน)`. Coach and Admin displays derive
  member counts from their current arrays, so adding/moving/removing members cannot
  leave a stale number embedded in the displayed name. Exact coached groups cannot
  newly save blank, `ยังไม่จัดกลุ่ม`, or count-suffixed names.
- Fresh read-only Coach Base dry-run reconfirmed group
  `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc`, Coach Base
  `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe`, slot
  `150b25ba-b55a-448f-9aad-19748ba36b93`, 2026-07-17 17:00–19:00 Ratchada,
  and exactly two members. Their latest levels are LV6 and LV3, both active
  `basic / ชุดพื้นฐาน`; deterministic proposed name: **`ชุดพื้นฐาน`**. This was
  dry-run only; no Production row changed.
- Migration review corrected three safety gaps: a standalone CTE-only read-only
  preflight can run before apply; every current/future active exact group is
  backfilled into the reservation table after a zero-blocker gate; and triggers
  resynchronize reservations for group coach/slot, member insert/move/delete,
  slot date/time, booking-session lifecycle/slot, and booking lifecycle changes.
  Historical rows are neither reserved nor repaired.
- The exact standalone Production preflight ran read-only and returned active exact
  groups `968`, current/future reservation candidates `237`, current/future
  blocking conflicts `0`, and historical report-only conflicts `8`. Production
  migration history still ends at `20260715060541`; migration
  `20260717070225_coach_assignment_conflict_guards.sql` remains local only.
- Local verification passed: assignment naming/display/authorization `24/24`;
  database conflict/backfill/concurrency/lifecycle `21/21`; disposable authenticated
  Playwright authorization plus desktop/mobile Daily Board `2/2`; TypeScript;
  full ESLint; mojibake `234`; Lesson Wallet regression `17/17`; Production
  readiness check; Production Build 91/91; post-build clean restart root and
  `_next/static` `200`; in-app browser console errors `0`; and fixture/reservation
  residue `0`. Local migration reset/apply, rollback, re-apply, and retest passed.
- Final state for this round: Source complete locally **Yes**; tests **Passed**;
  migration safety **Proven locally**; committed **No**; pushed **No**; Production
  migration **Not applied**; Production Source active **No**; deployed **No**;
  Production data changed in this round **No**; Coach Base renamed **No**;
  historical attendance/check-in/teaching-hours/payroll changed **No**; financial
  impact **None**. The earlier exact Nice/Ratchada repair remains the only
  Production data change in the overall active task.
- Next gate requires separate Owner approvals for: (1) commit/push of the tested
  local Source/Test/Migration/Documentation set; (2) the exact Coach Base name-only
  Production repair to `ชุดพื้นฐาน`; (3) Production migration apply after a fresh
  identical read-only preflight still reports zero current/future blockers; and
  (4) exact-source deploy plus authenticated Production UAT. No step starts
  automatically.

## 2026-07-17 — Coach Assignment Remediation Scoped Commit and Push

State observed at this publish closeout on 2026-07-17:

- Owner accepted the deterministic Coach Base dry-run name `ชุดพื้นฐาน` and
  authorized only two scoped commits followed by a non-force push. Production
  rename, Production migration, deploy/aliases, Production UAT/write, environment,
  feature-control, allowlist, historical cleanup, and Parking Lot work remained
  prohibited.
- Before staging, branch `spike/next-major-security-upgrade`, Local HEAD, fetched
  remote HEAD, and upstream HEAD all matched
  `4f2aa8b2e606f9753124b5818bf8b38c246d7a4c` with ahead/behind `0/0`.
  The reviewed task set contained 17 paths: 11 modified, 6 new, and 0 deleted.
  Pre-existing dirty `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and
  `docs/performance/` were preserved and excluded from both commits.
- Migration `20260717070225_coach_assignment_conflict_guards.sql` SHA-256 was
  `2124C57725AA8891BD456927C37530F180019B8C0710EE73E6E9717174926EF8` before
  staging and the staged blob matched. The standalone preflight is one read-only
  CTE statement with no mutation or DDL token. The scoped set contained no secret
  value or local environment file.
- Fresh verification passed without further Source changes: naming/display/
  authorization `24/24`; database conflict/backfill/concurrency/lifecycle `21/21`;
  fixture and reservation residue `0`; TypeScript; full ESLint; mojibake guard
  `234`; and `git diff --check`.
- Source/Test/Migration commit is
  `1b995396f432d11b133c1cf4b5604b6db875b63b` (`fix: guard coach assignments and
  group naming`). This dated closeout is the separate documentation follow-up;
  its exact SHA is the Git commit containing this record and is reported in the
  session closeout. Both commits were pushed together non-force. A post-push fetch
  confirmed Local/Remote HEAD convergence and ahead/behind `0/0`.
- Production migration remains **Not applied**; Coach Base remains named
  `ยังไม่จัดกลุ่ม` in Production; remediation Source remains **Not deployed**;
  Production UAT was **Not run**; and no Production data, financial data,
  attendance, check-in, teaching-hours, or payroll record changed in this publish
  round. The earlier controlled Nice/Ratchada repair remains unchanged.
- Task Done remains **No**. Next gate requires separate Owner approval for the
  exact Coach Base name-only repair, Production migration apply after a fresh
  read-only preflight remains clear, and exact-source deploy plus authenticated
  Production UAT. Permanent `AGENTS.md` rule work remains a separate documentation
  task and was not mixed with the pre-existing dirty file.

## 2026-07-17 — Documentation Drift Corrected: Coach Base Owns Five Learners

State observed at this corrective documentation closeout on 2026-07-17:

- Fresh read-only Production reconciliation matched the Owner-confirmed state.
  Coach Base group `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc` still has coach
  `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe`, stored name `ยังไม่จัดกลุ่ม`, and five
  raw/active members. Their latest active levels are LV 15, 6, 6, 3, and 8; every
  learner resolves to `basic / ชุดพื้นฐาน`. The deterministic proposed name
  therefore remains `ชุดพื้นฐาน`.
- Former waiting group `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a` has
  `coach_id = null` and zero raw/active members. Owner confirmed that the three
  learner moves into Coach Base were intentional and the learners must not be
  moved back.
- Activity logs `1db62d59-1ae9-4ae6-8129-1da7fdb7f0c1`,
  `51bb003e-6d0c-4867-8f23-60a60b4e80fe`, and
  `727b2194-cf2d-47d9-9ee3-7a79086e13c1` record three normal Production-user
  `attendance_gap_move_learner_to_existing_group` actions at 20:14:17, 20:14:39,
  and 20:14:53 ICT. They moved booking sessions
  `3919671b-805d-4cb4-b1cd-ee7b24267e91`,
  `e1aae95f-1698-4262-99ee-c246b42211b7`, and
  `11a55e1b-b01c-404f-89b9-c790b026b5ea` from `924...` to `2e7...` for Coach
  Base. Actor `860c4d76-ca08-4252-8e18-68f9802ca60e` was a Production user, not
  Codex. Every log records attendance write `false`, booking-session status change
  `false`, and coach-evidence deletion `false`.
- Classified as `DOCUMENTATION DRIFT CORRECTED — OWNER CONFIRMED COACH BASE OWNS
  FIVE LEARNERS`. This round changed only `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`; Source/Test/Migration and Production data were not
  changed. Production migration history still ends at `20260715060541`.
- Coach Base was **not renamed**; remediation Source remains **not deployed**;
  Production migration remains **not applied**; Production UAT was **not run**;
  Task Done remains **No**. Next gate requires separate Owner approval for the
  exact Coach Base name-only repair to `ชุดพื้นฐาน`, Production migration apply,
  and exact-source deploy plus authenticated Production UAT. No Production action
  starts automatically.

## 2026-07-17 — Exact Coach Base Name-Only Production Repair

State observed at this controlled repair closeout on 2026-07-17:

- Owner approved only an exact name change for Coach Base group
  `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc`, from `ยังไม่จัดกลุ่ม` to
  `ชุดพื้นฐาน`. Moving learners, changing coach or legacy assignments, deleting
  the empty former group, applying the migration, deploying Source, and every
  attendance/check-in/teaching/payroll/financial write remained prohibited.
- Fresh read-only Production preflight matched every hard condition: target coach
  `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe`, expected old name, target slot
  `150b25ba-b55a-448f-9aad-19748ba36b93`, raw/active members `5/5`, and five valid
  active learners at LV 15, 6, 6, 3, and 8, all resolving to
  `basic / ชุดพื้นฐาน`. Former group
  `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a` remained `coach_id = null` with raw/
  active members `0/0`.
- At `2026-07-17 21:23:20 ICT`, one conditional update constrained by the exact
  target group id, exact Coach Base id, expected old name, five raw/active members,
  the five valid Level resolutions, and the empty former group changed only
  `name = ชุดพื้นฐาน`. Affected rows were exactly `1`; `updated_at` became
  `2026-07-17T14:23:20.536145+00:00`.
- Independent post-write reconciliation confirmed the same five exact member rows,
  learner/session ids, Coach Base id, and target-slot legacy row
  `9943df09-2e07-4cd6-9b52-112cc0fb51a0`. Former group `924...` remained empty and
  unassigned. Ramintra group `d0b68d67-1ae3-416c-b2f2-99e9ee994449`, Coach Nice,
  and legacy row `b31c3bce-d319-489b-b7a2-ff5382497c0c` remained unchanged.
- Before/after fingerprints matched for members, legacy rows, former/Ramintra
  groups, attendance, check-in, teaching programs, teaching hours, weekly
  summaries, payouts, payments, and finance metadata. Financial impact is
  **None**; no historical operational evidence changed.
- Authenticated Super Admin read-only Admin Schedules UAT for Ratchada on
  2026-07-17 passed. The target card shows `ชุดพื้นฐาน`, Coach Base, all five
  learners, Level range 3–15, and dynamic `ผู้เรียนในกลุ่มนี้ 5 คน`.
  `ยังไม่จัดกลุ่ม` is absent for this target; console, warning, page, and hydration
  errors were `0`. No Save or application mutation action was triggered.
- Source changed **No**; Production data changed **Yes — name-only one row**; Data
  Repaired **Yes — Coach Base group name only**; Migration Applied **No**;
  Deployed **No**; Production UAT for the new remediation Source **No**. Task Done
  remains **No**. The next Gate is separate Owner approval for Production migration
  after a fresh read-only preflight; deploy/UAT requires another later approval.

## 2026-07-17 — Coach Assignment Conflict Guard Production Migration Apply

State observed at this Production migration closeout on 2026-07-17:

- Owner authorized only a fresh read-only preflight, exact apply of committed
  migration `20260717070225_coach_assignment_conflict_guards.sql`, post-migration
  reconciliation, old-Source runtime health checks, and documentation closeout.
  Source/Test/Migration edits, deploy, application write UAT, business-data repair,
  environment/feature/allowlist changes, and every other migration remained
  prohibited.
- Gate 0 matched branch `spike/next-major-security-upgrade`, local/remote HEAD
  `90be20707d3a8ef8f2f3459d0721412295742c59`, and ahead/behind `0/0`.
  Pre-existing dirty `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and
  `docs/performance/` were preserved. The committed migration SHA-256 was exactly
  `2124C57725AA8891BD456927C37530F180019B8C0710EE73E6E9717174926EF8`.
  Remote history ended at `20260715060541`, and the pending set contained only the
  approved `20260717070225` migration. The standalone preflight was confirmed
  read-only.
- Fresh Production preflight reported active exact groups `966`, current/future
  reservation candidates `235`, current/future blocking conflicts `0`, and
  historical report-only conflicts `8`. The zero-blocker hard gate therefore
  passed.
- Standard linked migration apply completed successfully and applied only
  `20260717070225`. Remote migration history contains it exactly once and now ends
  at that version; a second dry-run reports the remote database is up to date and
  the pending set is empty.
- Reservation reconciliation passed: candidates/reservations `235/235`, missing
  reservations `0`, stale/orphan reservations `0`, field mismatches `0`, and
  current/future exact conflicts `0`. The reservation table and `btree_gist`
  extension exist; the expected primary/foreign/check constraints and GiST
  exclusion constraint exist; all five synchronization triggers are enabled; all
  twelve expected functions are present with fixed `search_path = public`; and
  table/RPC grants match the committed migration. The reservation table has RLS
  enabled, no anon/auth DML grants, and service-role CRUD access.
- Supabase advisors reported the intentional RLS-with-no-policy reservation table
  as informational and the committed `btree_gist` placement in `public` as a
  warning. These did not fail the approved gate and no ad-hoc schema change was
  made.
- Exact before/after fingerprints matched for `coach_assignment_groups` `1028`,
  `coach_assignment_group_students` `2430`, legacy `coach_assignments` `1002`,
  `attendance` `1739`, `booking_sessions` `2899`, `bookings` `543`, coach check-ins
  `703`, teaching hours `0`, weekly summaries `9`, payouts `0`, teaching programs
  `379`, payments `480`, wallet credits `70`, and finance expenses `1`.
  Production business and financial data therefore remained unchanged.
- Target reconciliation also remained exact: Coach Base group `2e7...` is
  `ชุดพื้นฐาน` with the same coach and raw/active members `5/5`; former group
  `924...` remains `coach_id = null` with `0/0`; Ramintra group `d0b...`, Coach
  Nice, and the exact target legacy rows remain unchanged.
- Read-only runtime health passed on the unchanged Production deployment
  `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`: `/` `200`, `/api/health` `200`, a generated
  static asset `200`, and unauthenticated `/admin/schedules` `307` to login.
  Authenticated Super Admin Admin Schedules rendered Coach Base, `ชุดพื้นฐาน`, the
  five learners, and the dynamic member count with new console/warning/page/
  hydration errors `0`. No Save, application mutation, deploy, redeploy, or alias
  action occurred.
- State at this closeout: Production DB changed **Yes — schema plus 235 derived
  reservation rows**; Production business data changed **No**; Source changed
  **No**; Coach/member/legacy data changed **No**; Financial impact **None**;
  Deployed **No**; Production UAT for the new Source **No**; controlled write UAT
  **No**; Task Done **No**. Next Gate requires separate Owner approval for the exact
  Source deploy and authenticated Production UAT. No next step starts
  automatically.

## 2026-07-18 — Coach Assignment Exact-Source Production Deploy

State observed at this infrastructure-only deployment closeout on 2026-07-18:

- Owner authorized only exact-source Production deployment of functional commit
  `1b995396f432d11b133c1cf4b5604b6db875b63b`, clean detached-worktree
  provenance, Ready/four-alias verification, root/health/static infrastructure
  checks, and documentation closeout. Authenticated Production UAT was explicitly
  deferred until tomorrow. Controlled write UAT, Save/mutation requests, Source,
  database migration, business data, environment, feature-control, allowlist, and
  Parking Lot changes remained prohibited.
- Gate 0 matched branch `spike/next-major-security-upgrade`, local/remote HEAD
  `86fbdc5331011de4caee8164d769c20bba9a5ef0`, and ahead/behind `0/0`.
  Migration `20260717070225` remained applied once with derived reservations
  `235`. Previous Production deployment and exact rollback target
  `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8` was Ready. Pre-existing dirty `AGENTS.md`,
  `src/lib/schedule-slot-utils.ts`, and `docs/performance/` were preserved.
- Deployment worktree was detached at exact commit
  `1b995396f432d11b133c1cf4b5604b6db875b63b`, tree
  `24504017e59e597fc66d8d467186249290981bb6`, with tracked status clean before
  upload. The successful Vercel remote Production build completed TypeScript and
  generated `91/91` static pages.
- New deployment `dpl_Ga9NvYaYCcNG4BzVdqeCt3pBbQ4F` reached `Ready`, target
  `production`, at URL
  `https://new-athlete-badminton-school-2xt5m1d26-aachanin1s-projects.vercel.app`.
  Initial deployment creation left the established aliases on the old artifact;
  explicit promotion of the same Ready deployment completed successfully. Final
  read-only inspection confirmed all four established Production aliases resolve
  to `dpl_Ga9NvYaYCcNG4BzVdqeCt3pBbQ4F`:
  - `https://www.newathleteschool.com`;
  - `https://new-athlete-badminton-school.vercel.app`;
  - `https://new-athlete-badminton-school-aachanin1s-projects.vercel.app`;
  - `https://new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`.
- Infrastructure-only checks passed on both public aliases. `/` returned `200`
  HTML, `/api/health` returned `200` JSON with `status = ok`, and generated asset
  `/_next/static/css/4e4fe59c9141653c.css` returned `200` CSS. Final deployment
  inspection remained Ready. Rollback was not required; the database migration
  was not rolled back.
- A first `vercel pull` in the randomly named detached directory created an
  unintended empty Vercel project named
  `nasc-exact-deploy-295bc76f9193419a9565139c6b2c1cbe`. It had no deployment and
  was immediately deleted. Follow-up inspection confirms the project no longer
  exists. The worktree was then linked explicitly to existing project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`.
- Local prebuilt build installed dependencies but failed before producing a
  deployment because Vercel CLI on Windows returned `spawn cmd.exe ENOENT`.
  Tracked `.gitignore` was restored byte-for-byte to HEAD before the successful
  remote build. No deployment resulted from the failed local attempt. The exact
  detached worktree and downloaded temporary environment files were removed after
  verification.
- Source/Test/Migration changed **No**. Production DB/business data changed
  **No** in this deployment round. Environment, feature control, and allowlist
  changed **No**. Deployed **Yes**. Production Active **Yes** for the exact Source
  and previously applied reservation protection. Authenticated Production UAT
  Passed **No — scheduled for tomorrow**. Controlled write UAT **No**. Financial
  impact **None**. Task Done **No**. Next action is to wait for the Owner's
  scheduled instruction tomorrow before authenticated read-only Production UAT;
  no next task starts automatically.

## 2026-07-18 — Emergency Production Rollback and Head Coach Incident Audit

State observed at this emergency rollback closeout on 2026-07-18:

- Real Head Coach operations confirmed that Source deployment
  `dpl_Ga9NvYaYCcNG4BzVdqeCt3pBbQ4F` blocked assignment visibility and mixed-Level
  grouping. Owner authorized only an immediate rollback of the four Production
  aliases to `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`, narrow read-only incident
  verification, activity-log reconciliation, and documentation closeout.
- Rollback succeeded. Target deployment is Ready and all four aliases resolve to
  it. `/`, `/api/health`, and static asset
  `/_next/static/css/4e4fe59c9141653c.css` returned `200`. Current Production
  Source is restored to `0226e363f6677b078430f93459c2ee2ede6484e8`.
- Database migration `20260717070225` remains applied exactly once. Pre/post
  rollback fingerprints are identical: groups `1026` /
  `a19dc8518421d7d04618ec377bc3aa2b`; members `2432` /
  `68e30e1fccf733555392b7a35720cf88`; legacy `1000` /
  `2f63d86390d5b47186209f293a515a5e`; reservations `234` /
  `2ffff002063db9e9ba46eb8c24402e10`. Therefore rollback changed no database or
  reservation row. The earlier `235` count is historical; normal Production
  assignment activity had already changed current reservations to `234` before
  rollback.
- Authenticated read-only Head Coach verification after rollback showed `36/39`
  assigned slots, `3` unassigned, `135` learners, and 2026-07-18 with all `4/4`
  rounds assigned. The widespread false `ยังไม่ได้มอบหมาย` state was gone. No
  Save or mutation request was issued by Codex.
- Incident window reviewed: bad deployment creation at
  `2026-07-17T17:01:38Z` through post-rollback reconciliation. There were `51`
  successful `save_coach_assignment_groups` activity rows, first at
  `2026-07-17T18:26:13.466854Z` and last at
  `2026-07-18T05:19:24.350726Z`; `47` distinct slots, six actors, six branches,
  submitted totals `62` groups / `118` learner placements, and four saves with no
  coach. Actor/branch totals: แจ้งวัฒนะ/โคัช ตี๋ `21` saves (`21` slots);
  สุวรรณภูมิ/โคัช แบม `20` (`17`); เทพารักษ์/โคัช เบล `4` (`3`);
  พระราม 2/โคัช จ้า `2` (`2`); รัชดา/โคัช เบส `2` (`2`); and
  รามอินทรา/โคัช อิค `2` (`2`).
- The committed RPC deletes and recreates exact groups/members and slot legacy
  rows before inserting submitted state; reservation triggers synchronize derived
  protection. Current surviving rows for those slots are `55` exact groups, `97`
  member rows, `50` legacy rows, and `50` reservations. Every surviving row was
  created during the incident window. Repeated saves mean deleted/replaced row IDs
  and exact pre-save values are not retained in activity-log details; no repair may
  infer them.
- Exact affected slot IDs (`47`):
  `0c42e0ae-803e-46e6-94ee-9b7e69a9debd`,
  `0dba39b3-b144-42ef-86b5-b14522ee9973`,
  `1402f9f7-ed69-49d0-be41-6a2508cf56e1`,
  `172ec432-ea04-4b8f-b051-643078d97929`,
  `1c77289d-7c81-422a-a907-8d459e171cc8`,
  `24da232d-9464-499e-bfac-a88d1da76cd3`,
  `2600c26d-66ec-4541-b138-222adc60887d`,
  `2c8a78e2-5a8d-4c65-9ea4-082fad61ddbc`,
  `2d74f803-035f-4b3e-81d2-ac1de4f453c2`,
  `30de9108-4f5d-4b7b-a973-d6034395d85b`,
  `38cb731d-4d3d-47a0-a8c7-a05e27eaf14f`,
  `3e4a9116-3b94-4d4a-8e8d-589999a109d3`,
  `41264f66-b892-499b-8184-773e966756d5`,
  `49398c94-9b06-40e0-af41-bc931b9124be`,
  `4ccef74d-2ba4-43a2-a46d-ce259464e3ba`,
  `4edff3c8-d353-4407-b3cb-e59c3f5b88ad`,
  `510bb353-deda-41af-9b43-4cdd88a031e6`,
  `5266ddfb-8491-4cd2-9214-7c226b2a9bb0`,
  `540e5de9-f7ab-4be0-89f7-6ad272685a1f`,
  `5f6a33e8-eca6-407a-9cba-e5d2a6d2a4ff`,
  `748bead5-a0d7-4d62-9e04-9b225187e05e`,
  `77fd55b4-588a-41eb-a7f3-6be621c6d4b1`,
  `8325e74f-a202-40bb-bc6f-cef6521367c3`,
  `88be346a-fc92-4b06-af48-d7277856e042`,
  `8fb032a4-5303-40bd-bbeb-091c8033050e`,
  `910c6b5e-e969-42e5-8e32-4d8b9aba59b3`,
  `91b9b803-6696-453b-8802-82f0b409ce3f`,
  `92945dc6-497e-4c18-9ef1-a5cda54115fb`,
  `94696a94-42d8-4056-9063-44fcf77db060`,
  `a356af6f-a317-4b04-97d1-d1570d0cc11d`,
  `aa05ef02-c713-44a1-bfd1-352168409346`,
  `afa91321-aa6a-453b-8163-481e4feeb1ad`,
  `afe3d174-b3da-4bb9-b9ba-4a57ceffc1f8`,
  `bc4d18d4-9050-40d6-be97-982c35744e54`,
  `c1d5849f-7eef-4162-a7cc-a2a9cac8912e`,
  `c6526b09-b8e4-462b-95b5-a5eb3a44df27`,
  `da36347f-8ff6-4eca-aae4-30282ec44f2c`,
  `dbb11f93-7225-4489-bb66-833124a53a51`,
  `e35bd1b2-309e-4fc4-b48d-37291ae7bd7a`,
  `e4a16451-fd7a-455f-8765-c4cc759c09be`,
  `eaedfc9f-a0f3-4c0a-bcf2-95e0f512074d`,
  `ede40674-b21d-4f50-9c98-0cf2f1f20347`,
  `ee62b870-ea74-4765-a5e2-a70b37538ce4`,
  `f003625e-1d0b-4a05-9987-afd2ebe421d6`,
  `f585924d-bb63-47a2-a562-1f07423a9c73`,
  `f79a05cf-d9bc-4f6e-8a9b-9b796a1a1638`,
  `fa88ea5b-9986-4117-b5a7-6cf007e8068f`.
- Exact surviving group IDs (`55`):
  `09429650-5c5d-402b-b2db-b0314cee553e`, `0ce9dab5-bb62-496f-a485-aae50cbad2a9`,
  `0e1848e0-ca02-4469-ac85-5b3c4d5d9e90`, `1075cccd-227e-4b49-a8c8-d7162f88ff3b`,
  `132a4c78-2e39-4be9-a6e1-4be4f924e948`, `1a86d15d-49ec-4a06-9a4f-e4dbd9271813`,
  `223b9479-2267-4d9d-9871-6df51a3006b6`, `25f4050f-21fc-4a46-93f9-77076d229a67`,
  `27c5dab4-4f7d-4834-b545-e6e0b63cfeaa`, `2a247c84-fe81-4c49-abbf-0c64f306f06f`,
  `322b7599-6e06-4d72-b5c8-6ad15a330932`, `327cf9df-ffc5-492b-9e39-04ffed183424`,
  `37d790de-338e-4447-bc09-f9e969a4af1e`, `4183f82a-56bc-4316-a15e-22a8a8f610ac`,
  `41eb13dd-6a73-4b38-9bd3-b93f66ceaabc`, `42b4dcea-478e-47f3-bc85-10b22b1cb0f6`,
  `454e3b97-79ac-45c2-8ed3-8f67e5d4fc5a`, `477d7c44-ac11-4963-a40f-5c603b98409c`,
  `4ca63923-5913-4be1-8986-a967a8bfb645`, `4e7e5914-befd-442d-8178-dc81caf30df7`,
  `519798a5-ace0-4203-b80b-1a27d93603fd`, `54a46a53-e115-4084-a624-727accc2e8bd`,
  `59773d52-5b90-4a74-90e4-c23d297a9226`, `620f865e-19e8-44c2-b923-ea60b2e99722`,
  `7261c16c-9c37-41d5-aa74-4580d326246b`, `76a0ec4c-244c-47dc-8e3a-25659490a75c`,
  `7838f9be-7bfe-40f3-a54b-95309e361301`, `78e56458-8e33-47f3-89b5-0a6b22b5a3b6`,
  `7e577cdc-5d67-4d26-b0f6-bfc6a788860a`, `8412ee17-e58b-45e2-b6c0-79bf1c356e5a`,
  `8cdf83df-fe79-4440-95c1-de11fa4de065`, `8f5f6f91-0ee1-4106-8e50-2a5db7ee6aaf`,
  `93ccc54d-570b-4af0-9ae3-be2a032579d9`, `94da159f-d5ff-4045-b6a6-ade565064ad4`,
  `9a87df14-bf93-4e72-8d8b-4df2c97101aa`, `9d36f878-905f-497c-87e0-d88bcfd55333`,
  `9edbe1e6-fb74-46a7-8dcb-97728ad1dcf0`, `a2ef1d33-a909-47a5-8862-0fcc4797bb23`,
  `b7989c00-8405-4eed-b03e-28958e9147c8`, `bcffe278-f755-4cc6-974e-3b97dc8435cb`,
  `bd085fd4-7558-4ed1-997d-4d9a8f82b054`, `c45f4d05-a7c9-4729-8923-8274099d376a`,
  `c4a4dd69-e931-4fb1-89fb-84864095bb21`, `c792c352-de6a-4125-b90a-5120e0642670`,
  `c980f02f-8b5f-43b7-99f3-c21bffaa0b0f`, `d582674d-de4a-4dfc-be6f-e97f943852b8`,
  `da9adf4c-4720-4a5c-8adc-28113913396b`, `de65e8fb-7a65-422d-a862-c02a35a0649f`,
  `e6f92092-295f-4c4a-a59a-5dcc1772817a`, `e743e64c-b064-4ce1-b7d9-142c9d90539a`,
  `ee880163-62ee-4c2b-9b8f-e5cd44fa36d9`, `ef7cf43e-31ef-46ab-be5e-6ac5a7b2c542`,
  `fadfe63f-f507-4785-a448-c24075c4dc22`, `fce44625-4a23-49b7-825f-a0a8320834a4`,
  `fd256a86-13d2-46a6-a604-c8337cdf9bcf`.
- Exact surviving member-row IDs (`97`):
  `01829e3b-d38e-4a1b-a55e-bc838d49158b`, `0224c72c-c195-47bd-8291-3c49a8c51cad`,
  `02a3a74e-b0bc-4bf8-a431-d99bc1a5c6a3`, `03ca8c70-fd1b-46e3-a29a-441d3a34736e`,
  `047e2242-5c60-4219-ba14-33e905afa07a`, `063872fd-22fd-4a25-b465-b1eb93e082d2`,
  `0729d836-f120-409e-aed0-432415e17954`, `0aa9c433-809a-4c57-b7d2-bcd3c75c37e9`,
  `15cc0b0a-a4c7-4bcc-b045-c877d8dcab96`, `16d41b04-4568-45de-b012-6009b88a3ef0`,
  `17462cdc-d18b-4bae-90f8-f5ce124b9ff1`, `186dcbac-2579-486a-8f41-b221ded10c8d`,
  `1a3da4a9-8376-446e-a440-76b0734983d7`, `2038838d-ca3a-483f-ae4c-27a58420c813`,
  `20613a90-8cfa-426f-a38a-b0e24a4446db`, `224c24b0-f25a-4acc-bbee-6058efa4c95b`,
  `227ec28c-57a3-4adf-8f33-04d5acc91b72`, `229707d1-3081-4ec9-901d-05bf55adc3fe`,
  `267ad715-e9b8-4824-862d-83d65910950e`, `272d0b8e-5988-4f7e-b032-51566bf52dd2`,
  `2742dbcf-84ae-4599-8aa6-a876cf457506`, `2af4490e-6b91-45b7-b0b0-2231a1b576fb`,
  `2b82673f-76b0-456c-91d3-3f68d0f15055`, `34384dc6-c649-43e2-8c81-a6436864d5b2`,
  `34fc4601-bf24-4df8-b015-06336b86a6fb`, `35d07e7a-67cd-42e3-a482-a9c1784f92f8`,
  `36b1e8d1-a320-4c20-8755-8fbba678d202`, `377d0dce-de9c-43ca-af38-0f6b9cc24ffd`,
  `37c1d214-1325-47ba-b376-14a75b3e71bd`, `3cd4f3de-7432-4855-8f69-1e78d7cb5f8b`,
  `3d50d443-e57f-458c-abd5-9e33caeced7f`, `3dbb7014-b521-49b1-9f57-e495ce5b0efe`,
  `40e26c18-cf12-41d4-ad47-754bc5316d67`, `442f6efb-4223-4880-a6a8-0397ec8686ba`,
  `46d69d0c-6b81-4e62-8c25-552615c2ef31`, `4a9d96f5-6339-4a4a-9ed3-e5fd718a0406`,
  `4b1e7dee-6e00-41d5-b5b4-32515bac9ffc`, `4eb39b54-7b14-4e18-9931-66d3b1dcb36b`,
  `4f91faf2-a1b8-4b49-bcb1-9a1e4625166b`, `558486ab-3176-4db9-813f-4ae63d558b81`,
  `59390d97-18f7-45b2-85ac-cc443f0c0927`, `5a070183-bc0a-4e88-b914-53b259ebaaa1`,
  `5a845d17-2e5f-4736-906f-9c6fecc94dbe`, `5c973e97-c2af-409e-8c9f-19cc901e3ac7`,
  `5d61aa0c-eb4d-489b-a3c0-cdb353d3deb6`, `5e49656d-7360-4463-8d52-ebf9cd3511be`,
  `5fb5ecb8-9b0a-4874-9e43-22365b289463`, `6137f87a-31f0-4dac-9d7f-6ff190b6fcac`,
  `6579f0c3-c36c-45e8-8d21-a74bcdca3e19`, `6691402d-8f08-44f4-9609-4e9e985833ac`,
  `68b7a21e-8b42-4b42-966d-e8fb40663155`, `6ac90dd6-acf0-4390-b234-37dc0348cc95`,
  `71b87ea8-0947-4768-ba51-39b3b1dd99c5`, `71ed8252-d7fc-4a08-8bc6-d7dc539a0d51`,
  `735b87a0-b7fd-4784-853c-e62b3698663e`, `776115f2-fb88-4a2d-bff2-154067fa08f6`,
  `79f84999-5c84-47b6-8da7-98da79951e7d`, `7d45050f-1e2f-4ce2-8a3a-09b4c4508583`,
  `7eabbf19-20ab-4b8c-adfd-f5dc70ab9303`, `8311fb9b-28ec-431e-a896-4093b76245c5`,
  `8615f9d8-6e87-4ea5-bd08-2d1143d838d3`, `8adb39a5-dfc8-4bf9-bb52-4d4deedde760`,
  `8ce00005-b5fa-4aec-9ab5-ffb7a3e665ad`, `91a5c3c3-f788-4bf3-ad54-1d5da1e7ad17`,
  `939dea14-1991-4795-9822-20d97ece6265`, `a733ac50-25d0-465b-aeb4-a7c8bcb95ecf`,
  `a8115ca1-eaf6-4062-883b-4ff3dab83064`, `a8fb30d0-454e-4bd4-ae60-b8eb6959f1ae`,
  `b02fd160-42d1-4227-9493-fc00298beada`, `b069a0ec-3830-451e-9469-64cca66c9a90`,
  `b2afa0c7-b7c9-427c-b686-a2d140c84348`, `c239aed7-8dab-40a9-8781-2b6672db0287`,
  `c3cb066b-fffa-4a83-adc9-46412b4062d9`, `c4f8c205-e276-4ba3-ade1-8c56cd2eca6d`,
  `c666da02-46f5-4aa2-a17d-5e8e99a6e750`, `c750f2c7-3928-4444-9f74-7e13480e4a30`,
  `c96198cc-adf9-46ce-9ebc-e46c273133bd`, `cd02fbe6-60d2-421c-b522-50ce516529ea`,
  `d36704c5-db7d-4eac-994b-36d3b8c71887`, `d47dfea9-237a-4959-9a1c-9bc1841e5df0`,
  `d506b04e-980e-407c-b99f-7b1577d5dd01`, `d5fd230e-ae00-4419-b999-36e8bb4e4011`,
  `d68b214a-0c26-4ec8-945b-3a4a348961e6`, `dc950cde-a0a0-42d3-9d41-9c15ff494e4b`,
  `ddbb665a-ffff-4a1e-bf8b-5ba602d0eb1b`, `df4d31bd-1dad-4082-b91e-530ec3710f5d`,
  `e14b51ed-e454-47d2-a946-33f5b63232eb`, `e54b0563-5e6f-4fe9-a81e-595d6375bc43`,
  `e8ae21d6-fa0a-4d4d-af6f-ac52079e2c18`, `e9705dd0-1bb3-4372-b519-93772ba04c24`,
  `e9e8d0de-c0de-4af0-978f-885b8dc58fd1`, `ec9fa697-13c0-4831-a556-9e49c1a2afa9`,
  `ef8441fb-1036-471a-bdee-8312748d06ee`, `f387db49-b775-4581-80d9-7ab79f086f85`,
  `f57002e4-763c-4da3-b831-e0d9bd524cc3`, `f5f6d149-7501-4b9d-ac2c-fadec1cfbb5c`,
  `f93ee351-d4b8-4d2c-bd29-34665aa4ff70`.
- Exact surviving legacy-row IDs (`50`):
  `04705b4f-9209-4579-aa9a-4c6e4d6680d0`, `058336da-6529-470c-a9d5-d3d53c6a6070`,
  `062e024e-38a7-46d6-b124-c552cbf52525`, `0724af16-5f34-4378-a148-a9bd28935591`,
  `0c8ad94e-a3a6-4e60-bd56-4c9a83c98b91`, `0ec52a89-dc72-428d-9c55-0595ded23d5a`,
  `1339e0bb-c828-4532-976d-80352cad9cc1`, `1546a0c3-442a-438f-b52e-6c055c235db2`,
  `18313ce5-e04d-4d9a-bb23-d31d448817cf`, `1f7c2f7c-e94c-46de-a595-5eaf51c574a6`,
  `2006899f-c661-4532-b4d8-bfe9a3acebc3`, `2334cfa8-21f0-4ecf-9e69-bf88266aba88`,
  `23bfa3d4-3643-49ec-8670-f966e13c4dfa`, `27f4d402-0947-4169-bdf7-66bec2f8d598`,
  `29b19ab4-1be6-4bb2-9f50-b8a428db8c10`, `2c2df60b-2de9-41dd-8810-c9749b498ab5`,
  `320d7d24-0d7e-4281-ab91-14334c9a457c`, `3303d05a-6c58-4dc0-8699-c7ec450639c2`,
  `3493e326-ecf9-4d8b-91ff-74a0c0db5f55`, `38d4516d-a4ae-4240-98d3-3e204fcc94a9`,
  `39398fa5-1e01-4069-946a-2f302bf8cec1`, `411d1528-9593-45db-809f-b1ae8d84e238`,
  `43315187-b1f9-49bb-9a10-8dc64caa9118`, `559634b0-2384-4450-b92f-008fdb25b95c`,
  `574cc46d-e6a8-4896-8c6e-c74b089c47dd`, `58640154-b700-490d-a2f1-5b3b515a8163`,
  `5a86f54e-25c7-4640-bebf-6719f1339b9a`, `69c1c123-af72-4740-818d-6cda79def236`,
  `72d4fbce-3dbe-401e-88e2-7889bae90bfc`, `79ad3a82-4d7c-4088-8a36-de4ce1e135c3`,
  `81410e60-ab09-447a-8e02-0599c86289d1`, `8e77edce-5b85-4688-a375-0c5ab06116fc`,
  `95e6ea56-e8ec-4cde-9c0a-0fbaf14ab2db`, `97cefe9f-a10b-4bc3-b882-a1e68fa27cac`,
  `983545a1-6b03-4380-9138-c5746d5f3498`, `98b47832-ef35-479c-82a6-aa755bc2e05f`,
  `a15df721-f2ba-4d27-a877-25bf7a02ed96`, `a2e8647a-00ae-4d50-b4a1-b55402664681`,
  `a82c5451-2c75-4b7b-8b32-46aba50e57a2`, `bcfddd28-28dd-4c8c-a7dd-d9cd174d967a`,
  `bef5f11e-f73e-46df-b411-d3f9e0711856`, `c8abbaac-86ba-4e42-982a-ec0c440ad561`,
  `cf2ce0be-35d2-4912-bd8b-7577a01668f7`, `e0be897b-680a-4aa7-9338-1242c122a23c`,
  `e5e23c71-d2c4-4ec9-a62b-bee9fde1f6ea`, `e67d9b68-bd89-4831-bd84-7d28ec897a8a`,
  `ef521638-0acf-4fba-a95c-279895e5f708`, `f0c154e8-8900-48f2-9dab-dd6591132661`,
  `f2f19497-ac61-49e3-9edb-2f0908a52811`, `f32afb67-dbc3-410a-9690-7bf6f17fd7a3`.
- Exact reservation row key is `group_id`; there are `50`, equal to the coach-
  bearing subset of the exact `55` group IDs above. The five unreserved groups are
  `0ce9dab5-bb62-496f-a485-aae50cbad2a9`,
  `1075cccd-227e-4b49-a8c8-d7162f88ff3b`,
  `42b4dcea-478e-47f3-bc85-10b22b1cb0f6`,
  `54a46a53-e115-4084-a624-727accc2e8bd`, and
  `9edbe1e6-fb74-46a7-8dcb-97728ad1dcf0` because their current exact group has no
  coach.
- No Source, migration, environment, feature flag, allowlist, attendance,
  check-in, teaching-hours, payroll, payment, wallet, or finance write occurred in
  the rollback round. Financial impact is **None**. The incident assignment rows
  remain untouched pending Owner review. New Source Production UAT is **Failed
  from real operations evidence**; Task Done is **No**. Next Gate requires
  separate approval for read-only Source diagnosis, followed by separate decisions
  for any forward fix or exact-row data repair.

## 2026-07-18 — Emergency Coach Assignment Write Containment

State observed at this containment closeout on 2026-07-18:

- Owner authorized only a minimal emergency write lock based on restored
  Production Source `0226e363f6677b078430f93459c2ee2ede6484e8`. Migration
  `20260717070225`, business data, attendance/check-in, teaching hours/payroll,
  payment/wallet/finance, environment, feature flags, allowlists, and the 3
  confirmed damaged slots were not changed or repaired.
- Scoped containment Source commit
  `3ad8a52dbda95b645608bce2f05917824e9763a6` was created and pushed non-force on
  `codex/emergency-coach-assignment-containment-20260718`. It changes only:
  `src/app/api/coach/assignment-groups/route.ts`,
  `src/app/api/admin/makeup/route.ts`,
  `src/lib/coach-assignment-write-containment.ts`, and
  `scripts/check-coach-assignment-write-containment.mjs`. Pre-existing dirty
  `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and `docs/performance/` were not
  staged, overwritten, or included.
- `POST /api/coach/assignment-groups` preserves authentication, Head Coach role,
  branch authorization, slot/branch validation, and the existing past-round lock,
  then returns `503` with code
  `COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED` before any group/member/legacy
  mutation. Admin Makeup preserves `requireAdminMenuAccess('makeup')` and returns
  the same `503` before the four approved exact-assignment actions. Generic
  `mark_attendance` is blocked only when no exact coach exists and the action would
  create a retrospective exact group; unrelated Makeup actions remain available.
- Local verification passed: containment checks `7/7`, existing Admin Schedules
  assignment checks `12/12`, TypeScript, full ESLint with zero warnings, mojibake
  `231`, `git diff --check`, Production Build `91/91`, and post-build clean restart.
  Local `/`, `/api/health`, and `/_next/static/css/app/layout.css` returned `200`;
  anonymous Head Coach POST and Admin Makeup PATCH remained `401`. Read-only route
  Source was not changed.
- Production deployment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti` reached Ready and was
  promoted. All four established aliases point to its deployment URL
  `new-athlete-badminton-school-cuqr5a2km-aachanin1s-projects.vercel.app`. `/`,
  `/api/health`, and generated static asset
  `/_next/static/css/866485655583332e.css` returned `200`.
- Authenticated Head Coach page rendering remained available with `36/39` assigned,
  `3` unassigned, and `135` learners. One Owner-authorized no-write containment
  check returned `503`; Vercel request log
  `jl2h8-1784356901567-cd2150f1cfc2` records the exact Production POST at
  `2026-07-18T06:41:41.567Z`. The Thai temporary-lock message was visible and the
  browser console had no warning/error. No Save was expected or allowed to succeed.
- Fresh protected Production totals and MD5 fingerprints matched before and after
  the containment check: groups `1022` /
  `36ff11873681dd9b550d8bfe61b078d9`; members `2426` /
  `ad6abedcd22ded678b45a42695cb03f8`; legacy assignments `996` /
  `649a57dd7cc12a2928e053243bb647e3`; reservations `230` /
  `182ea9769ece1c3deca0b4624351da41`. Successful
  `save_coach_assignment_groups` activity rows after containment activation were
  `0`.
- Migration history still contains `20260717070225` exactly once. The latest
  `coach_assignment_exact_group_name_check` database error in the inspected log
  occurred at `2026-07-18T06:24:04.104Z`, before containment activation; no new
  occurrence appeared after activation. The database migration was not rolled back.
- The prior `51` successful incident-window Saves across `47` slots remain broader
  investigation evidence; they do not prove all 47 slots are damaged. Confirmed
  damaged slots are `3`. Data Repaired is **No** for this containment round. Exact
  evidence and separate Owner approval are required before any repair.
- Production UAT for regression Source `1b995396...` remains **Failed**. Production
  Write Containment is **Active**. Production business data changed **No** in this
  round. Financial impact is **None**. Customer impact is that read-only assignment
  pages remain available, while Head Coach/Admin Makeup exact-assignment writes are
  intentionally blocked to prevent further loss. Task Done is **No**.
- Next action: correct the forward Source fix locally, then request exact evidence
  and separate Owner approval for each of the 3 damaged-slot repairs. Do not repair
  Production data, re-enable writes, roll back the migration, or start a Parking
  Lot task automatically.

## 2026-07-18 — Coach Assignment Forward Source Fix Local/Publish Gate

State observed at this local/publish closeout on 2026-07-18:

- Owner authorized a correct forward Source from exact parent
  `1b995396f432d11b133c1cf4b5604b6db875b63b`, Local verification, and scoped
  commit/push only. Deploy, Production containment removal, Production write/UAT,
  migration change, and repair of the 3 confirmed damaged slots were prohibited.
- Two release interactions caused the incident. Regression Source `1b995396...`
  classified some persisted exact-coach groups through placeholder/name-derived
  draft state and auto-split/blocked mixed or wide Level groups, causing real Head
  Coach assignment visibility and grouping failures. After rollback, restored old
  Source `0226e363...` still used separate group/member/legacy DML and could submit
  a stored `(N คน)` name against the already-active new check constraint; a later
  insert failure could therefore follow earlier committed deletion. The forward
  fix combines the applied atomic RPC contract with corrected classification and
  naming semantics.
- Forward Source/Test commit
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9`, tree
  `0fecabd92e2f2c65b7bd59227b8d6b743e6bd820`, was created directly on parent
  `1b995396f432d11b133c1cf4b5604b6db875b63b` and pushed non-force to
  `codex/coach-assignment-forward-fix-20260718`; local/remote ahead/behind is
  `0/0`.
- Changed Source/Test files were:
  `src/lib/admin-schedule-assignment-state.ts`,
  `src/lib/coach-assignment-group-naming.ts`,
  `src/lib/coach-assignment-atomic-save.ts`,
  `src/components/coach/assign-groups-client.tsx`,
  `src/app/api/admin/makeup/route.ts`,
  `scripts/check-admin-schedule-assignment-state.mjs`,
  `scripts/check-coach-assignment-conflicts.mjs`,
  `tests/admin-schedule-assignment/admin-schedule-assignment.spec.ts`, and
  `tests/booking-regression/local-supabase.ts`. No migration file changed.
- Existing valid exact `coach_id` is now authoritative even when the persisted name
  is blank, `ยังไม่จัดกลุ่ม`, or has a legacy member-count suffix. No exact coach
  means unassigned; suggested coach remains non-exact. Mixed/wide Level is warning-
  only. Blank/placeholder auto-names use the active Level program for one shared
  category, `กลุ่มผสม` for mixed/incomplete combinations, and `ยังไม่ประเมิน` when
  all members are unassessed. Valid manual names are preserved, and `(N คน)` is
  removed from stored names while UI count remains membership-derived.
- Normal Head Coach Save already uses `save_coach_assignment_groups_v1`. All five
  Production-active Admin Makeup exact-assignment paths now load the current slot
  snapshot and invoke that same RPC exactly once for group/member/legacy/
  reservation all-or-nothing behavior. Constraint and invalid-member simulations
  proved byte-for-byte-equivalent logical fingerprints across all four protected
  sets before/after failure; concurrent conflict allowed one winner only and left
  fixture residue `0`.
- Local verification passed: assignment/naming/authorization checks `30/30`;
  database conflict/backfill/concurrency/lifecycle checks `22/22` with residue `0`;
  authenticated Playwright desktop/mobile `3/3` with fixture residue `0` and no
  console/page/hydration error; Lesson Wallet regression `17/17`; TypeScript;
  ESLint with zero warnings; mojibake `234`; `git diff --check`; Production Build
  `91/91`; and post-build clean restart with `/`, `/api/health`, and generated
  static asset all `200`.
- Local migration verification reset/applied through `20260717070225`, rolled back
  only the last migration to `20260715060541`, and re-applied only
  `20260717070225`; final local conflict suite remained `22/22`. The committed
  migration blob checksum remains
  `2124C57725AA8891BD456927C37530F180019B8C0710EE73E6E9717174926EF8`.
- Fresh read-only Production verification found containment deployment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti` Ready on all four established aliases; `/`,
  `/api/health`, and static asset returned `200`. Migration `20260717070225`
  remains applied exactly once. Protected counts remain groups `1022`, members
  `2426`, legacy assignments `996`, reservations `230`; successful assignment
  Save activity after containment activation remains `0`.
- Production Write Containment is **Active**. Forward Source Deployed is **No**.
  Production UAT for the forward Source is **No**; the earlier regression Source
  UAT remains **Failed**. Production business data changed **No** in this round.
  Data Repaired is **No**; confirmed damaged slots remain `3`. Financial impact is
  **None**. Task Done is **No**.
- Direct deployment of exact commit `c70f5a4...` inherently removes the temporary
  `503` containment because the commit is based on `1b995396...` and intentionally
  contains the forward behavior rather than the containment patch. Therefore the
  next gate must explicitly approve direct deploy plus write re-enable and bounded
  Production UAT together. If Owner instead requires the `503` lock to remain
  during deployment, a separate containment-on-forward integration Source change
  must be authorized and tested first. In either plan, current containment
  deployment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti` is the proposed Source rollback
  target and database migration `20260717070225` must remain applied. Damaged-slot
  repair remains a separate evidence/approval gate.

## 2026-07-18 — Coach Assignment Dark Canary Read-Only Gate

State observed at this unpromoted Canary checkpoint on 2026-07-18:

- Owner confirmed the Head Coach operations freeze and authorized preflight,
  Production-target dark deployment without alias promotion, and authenticated
  read-only Canary UAT only. Controlled Write, alias promotion, containment
  removal, damaged-slot repair, Source change, and migration change remained
  prohibited.
- Fresh preflight confirmed exact forward commit
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9`, tree
  `0fecabd92e2f2c65b7bd59227b8d6b743e6bd820`; migration
  `20260717070225` applied exactly once; current/future blocking conflicts `0`;
  successful assignment Save activity after containment `0`; and protected totals
  groups `1022`, members `2426`, legacy `996`, reservations `230`.
- A clean detached worktree produced Ready Production-target deployment
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD` using the verified Vercel
  `--prod --skip-domain` flow. Its unique URL returned `200` for `/`,
  `/api/health`, and generated static CSS. No alias was promoted: all four
  Production aliases remain Ready on containment deployment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`.
- Authenticated Head Coach read-only checks confirmed persisted exact coaches
  remain selected; old `(N คน)` suffixes are removed from displayed group names;
  member counts are membership-derived; no-coach groups remain unassigned;
  suggested coaches remain non-exact; mixed/wide Level remains warning-only;
  manual names remain intact; and the blank mixed draft preview is `กลุ่มผสม`.
  Desktop and 390x844 mobile layout were usable without the Level warning covering
  controls. Coach Attendance, Teaching Programs, Lesson Wallet, and Head Coach
  role guarding rendered their expected data/authorization behavior.
- The first Head Coach navigation to `/admin/schedules` redirected correctly to
  `/coach` but produced one client React hydration error `#418`. A fresh Canary
  reproduction of the same guard and a containment Production baseline were clean.
  Canary runtime log queries returned no error/fatal/5xx. Because the approved gate
  explicitly requires zero console/page/hydration errors, read-only Canary UAT is
  **Not passed** and the Controlled Write/promotion gate was not opened.
- Pre/post read-only fingerprints were identical: groups
  `36ff11873681dd9b550d8bfe61b078d9`, members
  `ad6abedcd22ded678b45a42695cb03f8`, legacy
  `649a57dd7cc12a2928e053243bb647e3`, and reservation semantic fingerprint
  `3969e246d4ace794ca6562727fa8e80e`. No assignment activity row was created;
  Production business data and financial data changed **No/No**.
- Production Write Containment remains **Active**; forward Source Production-active
  is **No**; Controlled Write UAT is **Not run**; alias promotion is **No**; Data
  Repaired is **No**; confirmed damaged slots remain `3`; Task Done is **No**.
  Next Gate is Owner review and separate authorization for read-only
  diagnosis/retest of the single non-reproducible hydration signal. Exact payload
  collection, write UAT, promotion, containment removal, and repairs remain closed.

### Hydration `#418` bounded read-only diagnosis and deterministic retest

State observed at this bounded retest closeout on 2026-07-18:

- The original observation remains preserved: at
  `2026-07-18T09:25:12.810Z`, the first Head Coach navigation to Canary
  `/admin/schedules` redirected correctly to `/coach` and produced one minified
  React hydration `#418`. Its stack was confined to the shared React runtime chunk
  `/_next/static/chunks/4bd1b696-e356ca5ba0218e27.js`; no stack frame attributed
  the signal to a file changed between `1b995396...` and `c70f5a4...`.
- Owner authorized read-only diagnosis/retest only. Production aliases stayed
  `4/4` on Ready containment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; Ready Canary
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD` remained unpromoted. No Save, mutation,
  Controlled Write, Source change, containment removal, repair, or promotion was
  performed.
- Deterministic client results were clean on both environments: direct `/coach`
  `5/5`, hard reload `/coach` `5/5`, `/admin/schedules` guard redirect `10/10`,
  mobile 390x844 guard redirect `5/5`, and fresh login to `/coach` `3/3` per
  environment. Across `56/56` cycles, React `#418`, hydration, console
  warning/error, page error, and redirect loop counts were `0`.
- Canary assignment read-only regression checks also passed: persisted exact
  coach assignments remained assigned; no-coach groups remained unassigned;
  suggested coaches remained non-exact; blank mixed draft naming rendered
  `กลุ่มผสม`; wide/mixed Level remained warning-only; valid manual names remained;
  legacy `(N คน)` suffixes were removed from display; live member counts were used;
  and desktop/mobile rendering had no page/console/hydration error. Save was not
  clicked.
- The original `#418` is classified **Unknown / Non-reproducible**. The required
  clean label `NON-REPRODUCIBLE TRANSIENT OBSERVATION — BOUNDED RETEST CLEAN` was
  not used because a distinct containment runtime error occurred during the
  authorized fresh-login cycles.
- At `2026-07-18T10:06:40.831Z` (`17:06:40` Bangkok), containment middleware logged
  one `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` for `GET /`;
  the HTTP response was `200`. Canary runtime error/fatal/5xx was `0/0/0`;
  containment fatal/5xx was `0/0`, but error was `1`. This signal occurred on the
  containment deployment only and is not attribution to the forward assignment
  diff, but the explicit runtime-error `0` pass condition means the overall gate
  remains **Not passed**.
- Post-checks found groups `1022` /
  `36ff11873681dd9b550d8bfe61b078d9`, members `2426` /
  `ad6abedcd22ded678b45a42695cb03f8`, legacy `996` /
  `649a57dd7cc12a2928e053243bb647e3`, reservations `230`, migration
  `20260717070225` exactly once, and successful assignment Saves after containment
  `0`. All `230/230` reservation business rows matched exact group/coach/slot/date/
  time source fields with mismatch `0`. One reservation `updated_at` changed after
  normal real-world coach check-in and three attendance writes for slot
  `ab042e90-d93c-46c5-9e2b-74e129abaf5e`; the reservation business fields did not
  change and the retest did not perform those operations.
- Current result: Containment Active **Yes**; alias promotion **No**; Controlled
  Write UAT **Not run**; Production business data changed by this retest **No**;
  damaged slots `3`; Task Done **No**. Next Gate is Owner review of the distinct
  containment auth-session error. Controlled Write payload collection, promotion,
  containment removal, Source change, and data repair remain closed.

### Owner decision — accept Containment auth baseline and reopen Canary gate

State confirmed by Owner after reviewing the bounded retest evidence on
2026-07-18:

- The single Containment-only
  `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` is classified
  **ACCEPTED NON-BLOCKING CONTAINMENT AUTH-SESSION BASELINE**. The evidence remains
  preserved; it must not be rewritten as though it never occurred. It did not
  occur on Forward Canary, did not fail login or the HTTP request, and is unrelated
  to the Coach Assignment files in `c70f5a4...`.
- Owner confirms this baseline is not a blocker for the Coach Assignment release.
  Any auth-session investigation is a separate follow-up and is not authorized to
  start automatically.
- Forward Canary read-only UAT is **Passed** based on `56/56` clean client cycles,
  hydration/React `#418`/console/page/redirect errors `0`, Canary runtime
  error/fatal/5xx `0/0/0`, read-only assignment semantics passing, and protected
  business fingerprints unchanged. Original React `#418` remains **Unknown /
  Non-reproducible after clean bounded retest**.
- Production aliases remain `4/4` on containment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; dark Canary
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD` remains Ready and unpromoted. Controlled Write
  UAT is **Not run**; Production business data changed by this decision **No**;
  damaged slots remain `3`; Task Done is **No**.
- Next Gate is exact Owner/Head Coach confirmation of one damaged-slot payload:
  slot ID, date/time/branch, every learner in the round, each learner's group,
  group names, exact coach per group, and learners who must remain unassigned.
  Codex must not infer this payload from activity logs or incomplete screenshots.
  No Production write, alias promotion, containment removal, damaged-slot repair,
  Source change, auth follow-up, or Parking Lot task is authorized by this decision.

### Controlled Write UAT — atomic save succeeded, manual-name preservation failed

State observed at this controlled dark-Canary checkpoint on 2026-07-18:

- Owner/Head Coach confirmed slot `53c3556a-6067-4ad1-813c-ca8410d17994`,
  2026-07-21 17:00-19:00 Chaeng Watthana, with two exact groups and five active
  learners. Confirmed manual names were `ระดับสูง` for Coach
  `20b2f808-e6a5-4e9f-ae95-3cc6561e0fde` with three learners and `กลาง-สูง` for
  Coach `95bf2081-e9f9-4aa1-883c-7294d2b8ce33` with two learners; no learner was
  to remain unassigned.
- Fresh pre-write state was target groups/members/legacy/reservations `0/0/0/0`;
  global totals `1022/2426/996/230`; both coaches had exact conflicts `0` and
  legacy warnings `0`; successful assignment Saves after containment were `0`.
  The Owner/Head Coach clicked Save exactly once through dark Canary
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD`.
- The atomic write completed at `2026-07-18T10:46:16.416897Z`. It created exact
  groups `c56af2cf-d9da-464b-a1c6-602709eab7c1` and
  `ec77cf98-8768-4181-865d-ccad7befabc8`; five exact member rows; legacy rows
  `fc730760-e1f8-49c1-a832-9d3c424bdfa1` and
  `19b19c1a-b299-494c-b813-e8c881947a70`; and two matching reservations. Global
  totals became `1024/2431/998/232`. Activity log
  `7eaa3080-adc6-416a-ad8d-1b9e3e657980` records one Save by Head Coach
  `95bf2081-e9f9-4aa1-883c-7294d2b8ce33` with group/student counts `2/5`.
- Atomic safety passed: group/member/legacy/reservation rows are complete; target
  orphan and reservation mismatch counts are `0`; both coaches have no exact
  conflict or legacy warning after self-exclusion; no other assignment row was
  created/updated in the controlled window. Target attendance, check-in, teaching
  program, payment, and wallet fingerprints remained unchanged. Console
  warning/error count was `0`. Financial impact is **None**.
- Manual-name preservation failed. The server stored group `c56af2cf...` as
  `กลุ่มผสม` instead of submitted `ระดับสูง`, and group `ec77cf98...` as
  `ชุดพื้นฐาน` instead of submitted `กลาง-สูง`. The Canary client retained the
  submitted draft after refetch and showed `มีการแก้ไขยังไม่บันทึก`; the apparent
  contradiction is a client draft versus persisted server-name mismatch, not a
  partial database write.
- Read-only Source inspection attributes the failure to
  `src/lib/coach-assignment-group-naming.ts`: `LEGACY_AUTO_GROUP_NAMES` includes
  both `ระดับสูง` and `กลาง-สูง`, so `resolveAssignmentGroupName()` treats the
  submitted labels as auto-generated and derives `กลุ่มผสม` / `ชุดพื้นฐาน`
  before `save_coach_assignment_groups_v1`. No Source change was authorized or
  made in this checkpoint.
- Controlled Write UAT is **Failed**; aliases promoted **No**; containment remains
  active on `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; the forward artifact remains dark
  and unpromoted. Production data changed **Yes** by the one Owner/Head
  Coach-controlled Save. Data Repaired remains **No** because persisted names do
  not match the exact approved payload; confirmed damaged slots remain `3`; Task
  Done is **No**.
- Next Gate is Owner review. Separate approval is required for a scoped Local
  Source/Test correction, a new dark artifact/repeat UAT plan, and any exact
  name-only repair of the two groups. Do not retry Save, promote aliases, remove
  containment, repair Production data, or start another task automatically.

## 2026-07-18 — Manual Name Preservation Corrective Canary, Controlled Save, and Promotion

State observed at this corrective release closeout on 2026-07-18:

- Owner authorized a scoped correction from forward parent
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9`, full Local verification,
  non-force Source/Test publish, an unpromoted Production-target Canary, one
  repeat controlled Save for slot `53c3556a-6067-4ad1-813c-ca8410d17994`, and
  conditional promotion of the exact same artifact. Direct SQL repair, migration
  change, additional Production Saves, and repair of other slots remained out of
  scope.
- Root cause was `LEGACY_AUTO_GROUP_NAMES` in
  `src/lib/coach-assignment-group-naming.ts`: it classified legitimate submitted
  labels `ระดับสูง` and `กลาง-สูง` as generated names, so the server replaced
  them before the atomic RPC. Corrective contract now treats every trimmed,
  non-placeholder name as manual after removing a trailing `(N คน)` suffix.
  Auto-name runs only for blank, exact `ยังไม่จัดกลุ่ม`, or generic `กลุ่ม N`.
- Corrective Source/Test commit
  `9ef1ee30035a083426743aed3e326ad9676d65c4`, tree
  `94fe2410f0361acf639c47a4be7245c01128f21d`, parent
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9`, was pushed non-force on branch
  `codex/coach-assignment-manual-name-fix-20260718`; ahead/behind was `0/0`.
  Changed files were `src/lib/coach-assignment-group-naming.ts`,
  `scripts/check-admin-schedule-assignment-state.mjs`, and
  `tests/admin-schedule-assignment/admin-schedule-assignment.spec.ts`. Migration,
  API authorization, and client TSX files did not change.
- Local gates passed: assignment/naming/authorization `33/33`; database conflict,
  concurrency, lifecycle, and residue `22/22` / `0`; authenticated Playwright
  desktop/mobile `3/3` with residue `0`; Lesson Wallet regression `17/17`;
  TypeScript; ESLint; mojibake `234`; `git diff --check`; Production Build; and
  post-build clean restart with `/`, `/api/health`, and generated static asset
  `200`. The first clean-restart attempt lacked the ignored local environment in
  the detached worktree; after copying the ignored local env without committing
  it, the same exact Source passed. No secret or environment file entered Git.
- A clean detached worktree created Production-target, unpromoted Canary
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` with `--prod --skip-domain`. Its unique URL,
  `/api/health`, and generated CSS returned `200`; deployment was Ready. Before
  Controlled Write, all four aliases still pointed to containment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`.
- Fresh pre-write reconciliation confirmed the target remained exact
  groups/members/legacy/reservations `2/5/2/2`; coaches and learner mapping matched
  the Owner payload; persisted names were still `กลุ่มผสม` and `ชุดพื้นฐาน`; and
  no later assignment mutation had occurred. The Owner/Head Coach changed only
  the two names and clicked Save exactly once through the corrective Canary.
- Activity log `82086719-9171-4170-8f57-7dbc5ca2ba6e` records that single Save by
  Head Coach `95bf2081-e9f9-4aa1-883c-7294d2b8ce33` at
  `2026-07-18T14:48:21.129295Z`. Persisted result:
  - group `66a59351-19f4-41fd-b5f3-1e989b931237`, name `ระดับสูง`, Coach
    `20b2f808-e6a5-4e9f-ae95-3cc6561e0fde`, exact original three learners;
  - group `9757d065-2553-48b0-a4ba-81ceb4b50d2b`, name `กลาง-สูง`, Coach
    `95bf2081-e9f9-4aa1-883c-7294d2b8ce33`, exact original two learners;
  - legacy rows `db2baac1-a2b7-4f56-a4ef-38834e4559e8` and
    `8457aa44-cb0e-426b-9ca1-9e848e58b85e`;
  - two reservations linked to the new exact groups.
- Post-save target counts remained `2/5/2/2`. Exact coach/member mapping was
  unchanged; no partial deletion, orphan, reservation mismatch, conflict,
  unsaved-draft indicator, console error, runtime/500/name-constraint error, or
  change to attendance, check-in, teaching program, teaching hours, payroll,
  payment, wallet, or finance fingerprints was found. Financial impact is
  **None**. Controlled Write UAT is **Passed** and the 2026-07-21 17:00–19:00
  Chaeng Watthana damaged slot is repaired.
- The exact corrective Canary artifact was promoted without rebuild. Deployment
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` is Ready; all four established Production
  aliases point to it. Public `/`, `/api/health`, and static assets return `200`.
  Authenticated Head Coach read-only rendering shows `ระดับสูง` / `กลาง-สูง`,
  dynamic `3 + 2` counts, assigned state, and no unsaved indicator or console
  error. Post-promotion error/fatal/500/name-constraint log queries returned zero.
  Temporary `503` containment is inactive and normal authorized atomic assignment
  writes are enabled. Rollback was not required; containment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti` remains the rollback target.
- Migration `20260717070225` remains applied exactly once. Immediately after the
  controlled Save, current/future reservation candidates/rows reconciled
  `219/219`; after later live Saves they reconcile `221/221`. Missing, physical
  orphan, and field mismatch are `0/0/0`. Thirteen historical reservations are dated 2026-07-17 and
  were created before the repeat Save; they are not release-created stale rows.
  Before later live Saves, totals were groups `1024`, members `2429`, legacy `998`,
  reservations `232`; early member-count movement outside the target slot was
  traced to ordinary reschedule lifecycle activity.
- Three real Head Coach Saves occurred after promotion and before documentation
  closeout, all by user `5393eb51-46b1-4e15-890f-4dd139fdb78f`:
  - activity `396a890d-94dd-46ad-861c-0bf0f69e4f50`, slot
    `83adbc97-f7f0-4552-8e16-2215097e9eb7`, 2026-07-19 16:00–18:00
    Suvarnabhumi, two groups / nine learners;
  - activity `f243c7f2-8210-4ad7-ad41-02a265b69217`, slot
    `316c9e10-e05f-48f0-973e-04ea429a65dc`, 2026-07-22 15:00–17:00
    Suvarnabhumi, group `bf8284a1-352b-4bf6-8e78-817ba91f88ff` named `กลุ่มผสม`,
    Coach `61b94e69-b1d9-4342-91e8-e40b3015ea36`, three learners;
  - activity `11e5d7f4-3b2c-4be9-a6ee-8888d3be1d0f`, slot
    `d62b0bba-c9b9-4e0a-a6c1-d54ce7c73887`, 2026-07-29 15:00–17:00
    Suvarnabhumi, group `bc89970f-2b8b-4d82-b53f-bc0eccc94411` named `กลุ่มผสม`,
    Coach `61b94e69-b1d9-4342-91e8-e40b3015ea36`, three learners.
  Each affected slot has group/member/legacy/reservation completeness, and no
  post-promotion runtime/500/name-constraint error was found. Fresh totals became
  `1026/2436/1000/234`. The two previously damaged slots have technically complete
  data, but because their exact intended payloads were not supplied to Codex before
  the live Saves, repair correctness is **Unknown / Need Owner confirmation**.
- Current status: Source Complete **Yes**; Tests Passed **Yes**; Committed/Pushed
  **Yes**; Deployed/Production Active **Yes**; Forward Production UAT and
  Controlled Write UAT **Passed**; Data Repaired **Yes for the 21 July slot**;
  Production Data Changed **Yes by Owner/Head Coach controlled Saves only**;
  Financial Impact **None**; Task Done **No**. The 2026-07-22 and 2026-07-29
  Suvarnabhumi payloads remain pending Owner confirmation.
- Next Gate: Owner/Head Coach must confirm whether the two actual post-promotion
  payloads are intended. If confirmed, close them after read-only reconciliation;
  otherwise request separate exact corrective approval. Do not infer payloads,
  send another Save, use direct SQL,
  start the separate auth-session follow-up, or start another task automatically.

## 2026-07-18 — Owner Confirmation and Final Damaged-Slot Closeout

State observed at this final read-only closeout on 2026-07-18:

- Owner confirmed that the actual post-promotion payloads saved by Head Coach for
  2026-07-22 and 2026-07-29 Suvarnabhumi are correct. This confirmation changes
  status only; Codex sent no Save or mutation and changed no Production data.
- Fresh read-only reconciliation remained exact:
  - 2026-07-22 slot `316c9e10-e05f-48f0-973e-04ea429a65dc`, 15:00–17:00,
    group `bf8284a1-352b-4bf6-8e78-817ba91f88ff`, name `กลุ่มผสม`, Coach
    `61b94e69-b1d9-4342-91e8-e40b3015ea36`, booking-session members
    `686f6563-a655-45d3-899d-dbdee6f9b287`,
    `7de8af7f-a114-49e7-89b3-a0b3ae1315be`, and
    `89adc1f4-57dc-43f1-b5a2-329cc1638b8d`; counts `1/3/1/1`.
  - 2026-07-29 slot `d62b0bba-c9b9-4e0a-a6c1-d54ce7c73887`, 15:00–17:00,
    group `bc89970f-2b8b-4d82-b53f-bc0eccc94411`, name `กลุ่มผสม`, Coach
    `61b94e69-b1d9-4342-91e8-e40b3015ea36`, booking-session members
    `413c5fe2-4a64-48ca-a8f7-8a500a82a0ba`,
    `e4c67b10-5883-4b0b-86bb-e424f7aed6e5`, and
    `ef5210a7-156f-421f-9794-022af773fe53`; counts `1/3/1/1`.
- Matching successful activity rows remain
  `f243c7f2-8210-4ad7-ad41-02a265b69217` and
  `11e5d7f4-3b2c-4be9-a6ee-8888d3be1d0f`, both by Head Coach
  `5393eb51-46b1-4e15-890f-4dd139fdb78f`. Global protected totals remain groups
  `1026`, members `2436`, legacy `1000`, reservations `234`.
- Production deployment `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` remains Ready on all
  four established aliases. Corrective Source, atomic RPC, and reservation
  protection remain Production-active; migration `20260717070225` remains applied
  once. No rollback, Source, migration, environment, feature, allowlist, attendance,
  check-in, teaching-hours, payroll, payment, wallet, or financial change occurred
  in this confirmation round.
- Final result for the confirmed scope: all three damaged slots are repaired and
  Owner-confirmed; Source Complete **Yes**; Tests Passed **Yes**;
  Committed/Pushed/Deployed/Production Active **Yes**; Production UAT and
  Controlled Write UAT **Passed**; Data Repaired **Yes**; Financial Impact
  **None**; Customer Impact **Resolved**; Task Done **Yes**.
- Active Task is **NONE**. Next Action is to await Owner selection. The separate
  containment auth-session baseline, broader historical incident population,
  permanent dirty `AGENTS.md` work, and Parking Lot tasks remain unauthorized and
  must not start automatically.

## 2026-07-27 — Coach Notification Bangkok Date Consistency (Audit First + Source Fix + Local Test)

State observed at this local closeout on 2026-07-27:

### Owner Evidence and Authorized Gate

- Owner selected **Coach Notification Bangkok Date Consistency** as the single
  Active Task. Authorized scope was fresh Audit First, bounded Production
  notification/schedule SELECTs through existing access, narrow Source fix,
  deterministic Local tests, and current-state documentation.
- Commit, Push, branch change, Deploy/Promotion/alias/rollback, authenticated Coach
  Production pages, Controlled Write UAT, Production notification/data repair,
  migration/schema/RLS/RPC, environment, feature, allowlist, and dependency
  changes were not authorized and did not occur.
- The prior current documents still said Active Task `NONE`. This was classified
  as `DOCUMENTATION DRIFT — NEW OWNER DECISION NOT YET RECORDED` and corrected
  locally without committing.

### Gate 0 and Source Reproduction

- Repository root was exact. Fresh Git fetch confirmed branch
  `spike/next-major-security-upgrade`, Local/Remote HEAD
  `f8ef800398e7104b6b625f2c2720219cf874f6ce`, ahead/behind `0/0`, no staged or
  untracked files, and only the two known protected dirty paths.
- Protected SHA-256 fingerprints before Source work were and remain:
  `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`;
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
  Neither file was edited by this task.
- Every proposed Source/Test/Documentation file was clean at Gate 0. No unrelated
  active work or conflicting affected-file diff was found.
- Deterministic pre-fix reproduction of
  `new Date('2026-07-26T00:00:00+07:00').toLocaleDateString('th-TH', ...)`
  returned `25 ก.ค. 69` under `TZ=UTC` and `26 ก.ค. 69` under
  `TZ=Asia/Bangkok`. The same pre-fix lookback path returned `2026-07-12` for
  Bangkok today `2026-07-27` minus `14`, instead of the intended calendar date
  `2026-07-13`.
- Source inspection confirmed Coach assignment, check-in-window,
  check-in-success, and attendance-gap notifications share the unsafe label;
  assignment/attendance links preserve raw `slot.date`; NotificationsClient used
  UTC ISO keys; Coach Attendance absent/late and Lesson Wallet store/redeem labels
  repeated the unsafe formatter.
- Local and remote notification schema inspection found only primary/foreign-key
  constraints and per-user RLS policies; there is no notification-content unique
  constraint. Existing `notifyCoachOnce` is application-level idempotence by exact
  user/title/message/link. No migration, Supabase package/API, RLS, or schema
  change is required for this Source fix.

### Production Read-only Evidence

- Existing authorized Supabase access was used for SELECT statements only. No
  application route, authenticated Coach page, SQL mutation, RPC, repair SQL, or
  credential output occurred.
- Exact date/date+slot links prove one-day-early stored labels for:
  - `ได้รับมอบหมายรอบสอน`: `2,017` rows (`860` unread / `1,157` read); `2`
    additional unread rows have the correct label.
  - `เช็คอินสำเร็จ อย่าลืมเช็คชื่อ`: `885` rows (`402` unread / `483` read), all
    proven one day early in the audited population.
  - `ยังเช็คชื่อนักเรียนไม่ครบ`: `416` rows (`157` unread / `259` read); `6`
    rows (`5` unread / `1` read) have the correct label.
- Exact reported incident evidence is Ramintra slot
  `3c4a2227-0a0e-4134-9a1a-d382e124e6c8`, date `2026-07-26`,
  `17:00–19:00`: assigned learners `3`, exact attendance rows `1`, missing `2`.
  Matching notification links and `schedule_slots.date` are `2026-07-26`, while
  the audited stored message date is `25 ก.ค. 69`.
- Generic/month-only links cannot prove an individual stored message against an
  exact slot without guessing. Population only, label correctness
  `Unknown / Need verification`:
  - check-in-window `759` (`364` unread / `395` read);
  - Coach Attendance absent/late `138` (`124` unread / `14` read);
  - Lesson Wallet-related `1,242`: store `648`, group-review after store `109`,
    redeem `485`.
- Existing incorrect messages were not changed. Because corrected copy no longer
  equals old copy, a future post-deploy generation may create a corrected row next
  to an old wrong row under the existing idempotence contract. Repair/deduplication
  remains a later Owner decision.

### Local Source Implementation

- `src/lib/date-format.ts`: added UTC-stable `YYYY-MM-DD` calendar arithmetic and
  one Bangkok-safe notification slot label helper based on the established
  formatter.
- `src/lib/coach-notifications.ts`: all four Coach notification paths now format
  raw `slot.date` through the shared helper; attendance lookback uses date-key
  arithmetic; optional injected `now` keeps deterministic tests without changing
  runtime defaults.
- `src/components/dashboard/notifications-client.tsx`,
  `src/app/(coach)/coach/notifications/page.tsx`, and
  `src/app/(dashboard)/dashboard/notifications/page.tsx`: shared "วันนี้" count
  compares notification `created_at` Bangkok date keys against one server-derived
  Bangkok `todayDateKey` primitive.
- `src/app/api/coach/attendance/route.ts`: absent/late user notification label now
  uses the shared formatter; authorization, attendance write-through, recipient,
  copy, and link behavior are unchanged.
- `src/app/api/lesson-wallet/route.ts`: store/redeem old/new round labels now use
  the shared formatter; wallet cutoff, eligibility, store/redeem mutations,
  recipients, links, and business rules are unchanged.
- `scripts/check-notification-bangkok-date-consistency.mjs` and
  `scripts/ts-alias-loader.mjs`: added a local fake-client executable regression;
  `package.json` adds only its focused test command. No dependency changed.

### Local Test Evidence

- Focused notification date regression passed `13/13`: UTC/Bangkok formatter
  identity, all four Coach messages, date/link identity, lookback boundary,
  Bangkok early-morning "today", Coach Attendance label use, Lesson Wallet old/new
  labels, existing idempotence, unsafe-pattern absence, and notification-only fake
  mutation scope.
- Existing regressions passed: Lesson Wallet `17/17`; Progressive payment
  notifications `16/16`; attendance reconciliation dry-run checked `2,621`
  verified teaching sessions and `2,205` attendance rows with student-scope,
  status, and booking-without-attendance mismatches `0/0/0`.
- `npx tsc --noEmit` passed. `npm run lint` passed with zero warnings.
  Mojibake passed `247` files.
- Next.js `16.2.6` Production build passed and generated `91/91` pages. Before the
  build no port-3000 listener existed. After build, only this repository's exact
  `.next` was removed; dev restarted hidden on `127.0.0.1:3000`; `/` and
  `/_next/static/chunks/webpack.js` returned `200/200`.
- Final documentation consistency/mojibake/diff checks are recorded in the final
  handoff. No Production write test or write-capable attendance/wallet UAT script
  was run.

### Local Gate Closeout

- Source Complete **Yes**; Tests Passed **Yes**; Committed **No**; Pushed **No**;
  Deployed **No**; Feature Enabled **Not applicable/unchanged**; Allowlisted **Not
  applicable/unchanged**; Production Active for this fix **No**; Production UAT
  **Not run**; Controlled Write UAT **Not run**; Data Repaired **No**; Production
  Data Changed **No**; Customer Impact **current Production stored/future-generated
  labels remain affected until an approved release**; Financial Impact **None**;
  Task Done **No**.
- Active Task remains **Coach Notification Bangkok Date Consistency**. Remaining
  work is PM/Owner evidence review, then a separately approved Commit + Push gate;
  Deploy/UAT and any existing-message repair require later separate Owner gates.
  Next Action: **PM/Owner review before any Commit + Push approval**.

### Owner-approved Commit + Push Publication Gate

State observed at this publication closeout on 2026-07-27:

- Owner approved a fresh Commit + Push Gate 0, re-verification of the unchanged
  scoped worktree, one exact 10-file functional Source/Test/Package commit, one
  exact 3-file current-documentation commit, and exactly one normal non-force
  Push on the existing `spike/next-major-security-upgrade` branch. Source redesign,
  branch/PR operations, Deploy, Production/Supabase access, UAT/write/data repair,
  migration/schema/RLS/RPC, dependency, environment, feature, and allowlist
  changes remained prohibited and did not occur.
- Fresh Gate 0 reconfirmed repository root and branch, Local/upstream/live Remote
  HEAD `f8ef800398e7104b6b625f2c2720219cf874f6ce`, ahead/behind `0/0`, no staged
  files, exactly the intended 10 functional files plus 3 documentation files and
  the 2 protected dirty files, and no unrelated or untracked work. Added-line
  secret scanning found `0` hits; no migration, generated type, lockfile,
  dependency, credential, or private environment change was present.
- Protected files remained unstaged and checksum-exact throughout:
  `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`;
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Pre-commit re-verification passed notification date regression `13/13`, Lesson
  Wallet regression `17/17`, Progressive payment notification regression `16/16`,
  TypeScript with no incremental output, ESLint with zero warnings, mojibake `247`
  files, and `git diff --check`. Prior exact-worktree evidence retained without
  Production access: Next.js build `91/91` and attendance reconciliation dry-run
  `2,621` sessions / `2,205` rows with mismatches `0/0/0`.
- Functional commit `5e7df0c9e1001e6184c2a3f9bcb37f295d2b5b28`, tree
  `4f36ecc54ae9bf2fc09c589e3cedd97c86c50682`, parent
  `f8ef800398e7104b6b625f2c2720219cf874f6ce`, subject
  `fix(notifications): use Bangkok dates consistently`, contains exactly:
  `package.json`; `src/app/(coach)/coach/notifications/page.tsx`;
  `src/app/(dashboard)/dashboard/notifications/page.tsx`;
  `src/app/api/coach/attendance/route.ts`;
  `src/app/api/lesson-wallet/route.ts`;
  `src/components/dashboard/notifications-client.tsx`;
  `src/lib/coach-notifications.ts`; `src/lib/date-format.ts`;
  `scripts/check-notification-bangkok-date-consistency.mjs`; and
  `scripts/ts-alias-loader.mjs`. Committed-addition secret scanning found `0`
  hits; `git show --check` passed.
- The documentation commit containing this record contains exactly
  `PROJECT_STATE.md`, `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`; its exact
  SHA/tree/parent are reported in the final handoff. Exactly one normal non-force
  Push published the functional and documentation commits, and final live Remote
  verification converged Local/Remote at `0/0`.
- Source Complete **Yes**; Tests Passed **Yes**; Committed **Yes**; Pushed **Yes**;
  Deployed **No**; Migration Source **None**; Migration Applied **No**; Environment
  Change **No**; Feature Enabled **Not applicable/unchanged**; Allowlisted **Not
  applicable/unchanged**; Production Active for this fix **No**; Production UAT
  **Not run**; Controlled Write UAT **Not run**; Data Repaired **No**; Production
  Data Changed **No**; Customer Impact **Production behavior remains unchanged
  until deployment**; Financial Impact **None**; Task Done **No**.
- Active Task remains **Coach Notification Bangkok Date Consistency**. Remaining
  work is a separate Owner Deploy/UAT decision and a separate stored-message
  repair/deduplication policy decision. Next Action: **Owner review before Deploy**.

### Owner-approved Staged Deploy Gate

State observed at this staged artifact closeout on 2026-07-27:

- Owner authorized a fresh Deploy Gate 0, a clean detached exact-source worktree,
  focused Local re-verification, exactly one pinned Vercel CLI `56.5.0`
  `deploy --prod --skip-domain` command, read-only control-plane verification,
  public root/proven-read-only-health/static smoke, bounded exact-artifact logs,
  and local documentation updates. Promotion, alias/domain mutation, retry,
  force, rollback, authenticated Coach routes, application or Supabase mutation,
  Controlled Write UAT, stored-message repair, migration/schema/RLS/RPC,
  environment/feature/allowlist/project-setting change, Commit, and Push were not
  authorized and did not occur.
- Source safety inspection confirmed both `src/app/(coach)/layout.tsx` and
  `src/app/(coach)/coach/notifications/page.tsx` invoke
  `createCoachCheckinWindowNotifications()` and
  `createCoachAttendanceGapNotifications()` during GET hydration; those paths can
  reach `notifyCoachOnce()` and `notifications.insert()`. Authenticated Coach GET
  is therefore write-capable. No Coach route was opened in this gate, and Coach
  application UAT is classified **PARTIAL / NOT RUN — WRITE-CAPABLE GET REQUIRES
  SEPARATE OWNER DECISION**.
- Fresh Gate 0 verified repository root, branch
  `spike/next-major-security-upgrade`, Local/upstream/live Remote
  `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`, ahead/behind `0/0`, staged `0`,
  untracked `0`, and only the two protected dirty files. Release tree is
  `da1f7f8370bc96385fa347e02cf1501cb8139735`, parent functional commit
  `5e7df0c9e1001e6184c2a3f9bcb37f295d2b5b28`; functional tree/parent remain
  `4f36ecc54ae9bf2fc09c589e3cedd97c86c50682` /
  `f8ef800398e7104b6b625f2c2720219cf874f6ce`. Exact `3 + 10` commit membership,
  secret scan `0`, and no migration, lockfile, dependency, environment, or
  credential change were reconfirmed.
- Protected files remained checksum-exact:
  `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`;
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Pre-deploy Vercel control-plane evidence confirmed CLI `56.5.0`, project
  `new-athlete-badminton-school`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, and prior artifact
  `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E` as `production/READY/PROMOTED`, source
  `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`, region `icn1`, created/building/
  READY at `2026-07-24T16:57:43.411Z` / `2026-07-24T16:57:44.522Z` /
  `2026-07-24T16:58:54.970Z`. All four established Production aliases mapped to
  that artifact before Deploy.
- A new detached worktree was created at exact release
  `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`, remained Git-clean, received only
  ignored existing Vercel project-link metadata, and received no `.env.local` or
  Source modification. Exact-lock dependency installation used
  `npm ci --ignore-scripts`; no dependency or lockfile changed.
- Isolated Local verification passed: notification date regression `13/13`,
  Lesson Wallet regression `17/17`, Progressive payment notification regression
  `16/16`, TypeScript with no incremental output, ESLint with zero warnings,
  mojibake `247` files, and `git diff --check`.
- Exactly one deploy command ran from `2026-07-27T06:04:16.3051547Z` to
  `2026-07-27T06:05:37.5398014Z`, exit `0`, with pinned CLI `56.5.0`, `--prod`,
  `--skip-domain`, `--yes`, the exact team scope, and no `--force` or retry. New
  artifact `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z` has unique URL
  `https://new-athlete-badminton-school-j4ju33ftu-aachanin1s-projects.vercel.app`,
  exact Git SHA `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`, target/state/substate
  `production/READY/STAGED`, source `cli`, `autoAssignCustomDomains=false`, alias
  count `0`, and region `icn1`. Creation/build-start/READY timestamps are
  `2026-07-27T06:04:24.990Z` / `2026-07-27T06:04:26.317Z` /
  `2026-07-27T06:05:37.212Z`.
- Remote build passed Next.js `16.2.6`, compile, TypeScript, and static generation
  `91/91`; build executed in `cle1` and functions remain in `icn1`. Deployment
  inventory gained exactly the one new artifact. No additional deploy command and
  no Promotion, alias/domain mutation, rollback, or project-setting command ran;
  alias inspection was read-only.
- All four established Production aliases remained before/after on
  `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E`: `www.newathleteschool.com`;
  `new-athlete-badminton-school.vercel.app`;
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`; and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`.
  Missing/extra/wrong Production alias mappings were `0/0/0`; the new artifact
  remains unaliased and not Current.
- Safe smoke sent exactly three unauthenticated requests to the unique artifact:
  `GET /`, `GET /api/health`, and `GET /_next/static/chunks/webpack.js`. All
  returned Vercel Deployment Protection `302`; redirects were not followed. The
  health route was Source-proven to contain only GET plus SELECT/auth-read paths.
  No Coach or other authenticated application route was requested. Bounded exact-
  artifact logs contained one info-level `GET /`; error records `0`, attributable
  fatal `0`, and 5xx `0`.
- Source Complete **Yes**; Tests Passed **Yes**; Committed **Yes**; Pushed **Yes**;
  Deployed **Yes — exact READY/STAGED artifact only**; Promoted **No**; Feature
  Enabled **Not applicable/unchanged**; Allowlisted **Not applicable/unchanged**;
  Production Active for this fix **No**; Production UAT **Partial / application
  Coach UAT not run**; Controlled Write UAT **Not run**; Data Repaired **No**;
  Production Data Changed **No**; Customer Impact **Production behavior remains
  unchanged because aliases did not move**; Financial Impact **None**; Task Done
  **No**.
- Active Task remains **Coach Notification Bangkok Date Consistency**. Blocker is
  that authenticated Coach GET is write-capable and cannot supply read-only UAT.
  Next Action: **Owner chooses either Promote exact READY artifact
  `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z` or separately authorize a bounded Controlled
  Write UAT if live Coach-page evidence is required**. Stored-message repair/
  deduplication remains a separate later Owner decision.
- `PROJECT_STATE.md`, `TODO-CODEX.md`, and this dated record are updated locally
  only and remain unstaged, uncommitted, and unpushed in this gate.

### Owner-approved Promotion Gate and Safety Hard Stop

State observed at this Promotion closeout on 2026-07-27:

- Owner authorized exactly one Promotion of staged artifact
  `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z`, with no rebuild/new deployment, automatic
  movement of the four established Production aliases, read-only control-plane
  verification, safe non-Coach GET-only smoke, bounded logs, and local
  documentation updates. Deploy/build, retry, separate alias/domain mutation,
  rollback, force, Coach routes, application/Supabase writes, Controlled Write
  UAT, stored-message repair, migration/schema/RLS/RPC, environment/feature/
  allowlist/project-setting change, Commit, and Push were not authorized.
- Fresh Git Gate 0 verified repository root, branch
  `spike/next-major-security-upgrade`, Local/upstream/live Remote
  `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`, ahead/behind `0/0`, staged and
  untracked `0/0`, and exactly five unstaged files: the three Deploy-closeout
  documents plus protected `AGENTS.md` and `src/lib/schedule-slot-utils.ts`.
  Deploy documentation diff scope and secret scan passed; release tree/parent and
  functional ancestry remained exact.
- Protected hashes remained exact:
  `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`;
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Fresh Vercel Gate 0 verified pinned CLI `56.5.0`, exact project/team, target
  artifact `production/READY/STAGED`, Git SHA
  `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`, tree
  `da1f7f8370bc96385fa347e02cf1501cb8139735`, function region `icn1`, zero
  artifact aliases, and unchanged created/building/READY milliseconds
  `1785132264990/1785132266317/1785132337212`. No project deployment was newer.
  All four established Production aliases remained on prior artifact
  `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E` before Promotion.
- Exactly one command ran:
  `vercel promote dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z --yes --scope
  team_gw8Y6CPd602WAKRsVFobPGCL --no-color`, from
  `2026-07-27T06:34:06.2101419Z` to `2026-07-27T06:34:12.5317624Z`, exit `0`.
  No deploy/build/new artifact/retry/force/rollback/separate alias mutation ran.
- Post-promotion control-plane evidence verified the same artifact ID/SHA/tree and
  unchanged creation/build/READY timestamps, now `production/READY/PROMOTED`.
  Deployment inventory remained `20` on the compared page, latest artifact stayed
  `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z`, and newer artifact count remained `0`.
  All four established aliases moved from `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E`
  to the exact target with missing/extra/wrong `0/0/0`; prior artifact remains
  READY and available as the known rollback candidate.
- Codex safe smoke issued GET requests only and never requested `/coach/*`:
  canonical `/` `200`; source-proven SELECT-only `/api/health` `200`; obsolete
  `/_next/static/chunks/webpack.js` `404`; one root-discovery GET whose PowerShell
  client failed during response parsing; a successful curl root-discovery GET
  `200`; and existing `/_next/static/chunks/webpack-a1425f7572da71b3.js` `200`.
  No authenticated Coach session, notification UI, POST/PUT/PATCH/DELETE, or
  Supabase request was sent by Codex.
- The bounded 10-minute exact-artifact log window contained `35` records: `34`
  GET and one unexpected external
  `POST /api/progressive-payments/a13326b3-a13f-474f-826b-50b87ad60ff5/cancel`
  at `2026-07-27T06:34:18.08Z`. Coach-route records and error-level records were
  `0`. The POST was not sent by Codex's GET-only smoke, but its data and financial
  effects cannot be proven without prohibited Supabase access. The Safety Gate
  therefore Hard Stopped all Vercel/application operations; no retry or rollback
  was attempted.
- Source Complete **Yes**; Tests Passed **Yes — prior Deploy-gate exact-artifact
  evidence**; Committed/Pushed **Yes for release, No for current local docs**;
  Deployed **Yes**; Promoted **Yes**; Feature Enabled and Allowlisted **Not
  applicable/unchanged**; Production Active for future generation **Yes**;
  Production Coach UAT **Partial / not run**; Controlled Write UAT **Not run**;
  Data Repaired **No**; Production Data Changed **Unknown / Need verification for
  the external POST, with `0` mutation request from Codex**; Customer Impact
  **future generated labels use the Bangkok-consistent fix while stored messages
  remain unchanged**; Financial Impact **None from Promotion, external POST effect
  Unknown / Need verification**; Task Done **No**.
- Active Task remains **Coach Notification Bangkok Date Consistency**. Blocker is
  the Safety Hard Stop on the unexpected external POST plus write-capable Coach
  GET hydration. Next Action: **PM/Owner review, then a separate documentation
  publication and/or explicitly authorized SELECT-only observation gate**.
- `PROJECT_STATE.md`, `TODO-CODEX.md`, and this Promotion closeout remain local,
  unstaged, uncommitted, and unpushed.

### Owner-approved Historical Stored-message Display Source Fix + Local Test

State observed at this local closeout on 2026-07-27:

- Owner supplied visible incident evidence: a historical notification displayed
  `รอบ 25 ก.ค. 69 17:00-19:00`, while its internal attendance link carried
  `date=2026-07-26` and the destination displayed `อาทิตย์ 26 ก.ค. 69`. Owner
  authorized only a narrow presentation-layer Source fix, deterministic Local
  tests, and local documentation. Production/Supabase/Vercel access, stored-row
  repair, Commit, Push, Deploy, generator/deduplication changes, business
  mutations, migration/schema/RLS/RPC, dependency, environment, feature, and
  allowlist changes were prohibited and did not occur.
- Fresh Gate 0 verified repository root, branch
  `spike/next-major-security-upgrade`, Local/upstream/live Remote HEAD
  `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`, ahead/behind `0/0`, staged and
  untracked `0/0`, and exactly the five expected pre-existing dirty files:
  `AGENTS.md`, `DEVELOPMENT_TODO.md`, `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `src/lib/schedule-slot-utils.ts`. The three proposed tracked functional/test
  files and `package.json` were clean before editing. Protected hashes matched
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`
  and `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Fresh Source audit reconfirmed that generation-time messages already use the
  Bangkok-safe raw date-key formatter. The remaining cause was
  `NotificationsClient`: it displayed and searched `notification.message`
  directly, so a historical runtime-shifted stored date was not reconciled with
  the canonical exact date already present in `link_url`.
- Added pure `src/lib/notification-display.ts`. It accepts title, stored message,
  and link; permits only `ได้รับมอบหมายรอบสอน`, `เช็คอินสำเร็จ อย่าลืมเช็คชื่อ`,
  and `ยังเช็คชื่อนักเรียนไม่ครบ`; requires a relative internal `/coach/` URL
  with exactly one valid `date=YYYY-MM-DD`; recognizes only the known slot-date
  position before `HH:mm-HH:mm`; and formats the replacement through the shared
  `formatThaiShortDate()` helper. Invalid, absent, external, generic, unrelated,
  already-correct, or structurally unrecognized inputs return the original stored
  message. Only the date token is replaced; all remaining bytes are preserved.
- `NotificationsClient` derives `displayMessage` in its existing `useMemo`, uses
  that derived value for both local search and rendering, and does not mutate the
  Server notification object or persisted fields. `is_read`, `created_at`, title,
  type, link, ordering, row identity, notification generation, and deduplication
  behavior are unchanged.
- Fresh executable verification passed: focused notification date regression
  `26/26` (including the exact incident, assignment and attendance links,
  byte-identical no-op, generic/null/invalid/external/unrelated/no-token fail-
  closed cases, remainder preservation, UTC/Bangkok parity, and normalized search);
  Lesson Wallet regression `17/17`; Progressive payment notification regression
  `16/16`; TypeScript `npx.cmd tsc --noEmit --incremental false`; ESLint with zero
  warnings; mojibake `248` files; and Next.js production build with compile,
  TypeScript, and static generation `91/91`. The post-build protocol stopped the
  repository-owned port `3000` server, removed only this repository's generated
  `.next`, restarted the local dev server, and verified local `/` plus
  `/_next/static/css/app/layout.css` at `200/200`. Final `git diff --check`
  returned exit `0`, the untracked helper had zero trailing-whitespace hits, and
  the focused added-line secret scan found `0` hits.
- The previously observed external progressive-payment cancel POST is unrelated
  external traffic, explicitly out of scope, and not a blocker for this
  notification task. No payment or Supabase investigation was performed.
- Source Complete **Yes locally**; Tests Passed **Yes**; Committed **No**; Pushed
  **No**; Deployed for this display fix **No**; generation-time Bangkok fix
  Production Active **Yes**; stored-message display fix Production Active **No**;
  Production UAT **Not run**; Controlled Write UAT **Not run**; Data Repaired
  **No**; Production Data Changed **No**; Customer Impact **Production continues
  to show the original stored message until this display fix is published and
  deployed**; Financial Impact **None**; Task Done **No**.
- Active Task remains **Coach Notification Bangkok Date Consistency**. Remaining
  work is PM/Owner review followed by a separately approved Commit + Push and
  later Deploy gate. Production stored-message repair remains unapproved and is
  not performed by this presentation approach. Next Action: **PM/Owner review
  before Commit + Push**.

### Owner-approved Stored-message Display Commit + Push Publication

State observed at this publication closeout on 2026-07-27:

- Owner approved only a fresh Gate 0, unchanged-scope verification, one exact
  four-file functional commit, one exact three-file documentation publication
  commit, and exactly one normal non-force Push on existing branch
  `spike/next-major-security-upgrade`. Deploy, PR, Production/Supabase/Vercel/
  browser access, data repair, Source expansion, branch change, migration/schema/
  RLS/RPC, dependency/lockfile/environment/feature/allowlist change, and payment
  investigation were prohibited and did not occur.
- Fresh Gate 0 verified repository root; Local/upstream/live Remote baseline
  `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`; ahead/behind `0/0`; staged `0`;
  the exact functional tracked/untracked and three-document scope; remote
  `origin`; GitHub CLI `2.96.0` authenticated without exposing a credential; no
  migration, dependency, lockfile, or environment change; and focused added-line
  secret scan `0`.
- Protected dirty files remained unstaged and checksum-exact:
  `AGENTS.md` =
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`;
  `src/lib/schedule-slot-utils.ts` =
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Fresh unchanged-worktree verification passed notification date regression
  `26/26`, Lesson Wallet regression `17/17`, Progressive payment notification
  regression `16/16`, TypeScript with `--noEmit --incremental false`, ESLint with
  zero warnings, mojibake `248` files, `git diff --check`, and focused added-line
  secret scan `0`. The prior exact-worktree Next.js build `91/91` and required
  post-build cleanup/restart evidence were retained because Source did not change
  after Gate 0.
- Functional commit `c7f970a3f22cd7ba73f043f529c8bdbcb818da78`, tree
  `6dffe07c29b5a14c2a38d35a81536de00b180f89`, parent
  `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`, subject
  `fix(notifications): align displayed dates with links`, contains exactly:
  `scripts/check-notification-bangkok-date-consistency.mjs`;
  `src/components/dashboard/notifications-client.tsx`; `src/lib/date-format.ts`;
  and `src/lib/notification-display.ts`. Staged/committed secret scan returned
  `0`, and `git show --check` passed.
- The documentation publication commit containing this record contains exactly
  `PROJECT_STATE.md`, `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`; its exact
  SHA/tree/parent are reported in the final handoff. Exactly one normal non-force
  Push published both commits, and final Local/upstream/live Remote verification
  converged at `0/0` with staged and task-untracked files `0/0`.
- The previously observed progressive-payment cancel POST remains historical,
  unrelated external traffic and explicitly out of scope. It was not investigated
  and is not a blocker for this notification publication.
- Source Complete **Yes**; Tests Passed **Yes**; Committed **Yes**; Pushed **Yes**;
  Deployed for the display fix **No**; Feature Enabled and Allowlisted
  **Not applicable/unchanged**; generation-time Bangkok fix Production Active
  **Yes**; stored-message display fix Production Active **No**; Production UAT
  **Not run**; Controlled Write UAT **Not run**; Data Repaired **No**; Production
  Data Changed **No**; Customer Impact **Production continues to display the
  original stored message until a separate Deploy gate**; Financial Impact
  **None**; Task Done **No**.
- Active Task remains **Coach Notification Bangkok Date Consistency**. Remaining
  work is a separate Owner-approved Deploy gate; persisted notification repair
  remains unapproved and unnecessary for this display approach. Next Action:
  **Owner review before Deploy**.

### Owner-approved Stored-message Display Staged Deploy — Duplicate Artifact Hard Stop

State observed at this pre-Deploy Hard Stop on 2026-07-27:

- Owner authorized fresh Git/Vercel Gate 0, a clean detached disposable worktree,
  specified Local verification, and at most one Vercel CLI `56.5.0`
  `deploy --prod --skip-domain` command for exact release
  `11754057f9d82f71c7b69248a77997e491f5069c`. Promotion, alias/domain mutation,
  retry/force/rollback, Production/Supabase access, authenticated Coach routes,
  business-data requests, repair, Source/config changes, Commit, and Push were
  prohibited. The gate explicitly required a Hard Stop before Deploy if an exact-
  SHA artifact already existed.
- Git Gate 0 passed: repository root and branch were exact; Local/upstream/live
  Remote all equaled `11754057f9d82f71c7b69248a77997e491f5069c` at `0/0`;
  staged/untracked and task Source/Test/docs dirty were `0/0/0`; only protected
  `AGENTS.md` and `src/lib/schedule-slot-utils.ts` were dirty. Their SHA-256 values
  remained respectively
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Release identity was exact: SHA/tree/parent
  `11754057f9d82f71c7b69248a77997e491f5069c` /
  `275191b84e537e00a217dbc6a267528750f913c6` /
  `c7f970a3f22cd7ba73f043f529c8bdbcb818da78`. Functional identity remained
  SHA/tree/parent `c7f970a3f22cd7ba73f043f529c8bdbcb818da78` /
  `6dffe07c29b5a14c2a38d35a81536de00b180f89` /
  `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`. Commit membership was exact
  documentation `3/3`, functional `4/4`, combined `7/7`; combined added-line
  secret hits and forbidden migration/dependency/lockfile/environment paths were
  `0/0`.
- Vercel identity matched CLI `56.5.0`, project
  `new-athlete-badminton-school` / `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, and functions region `icn1`.
- The 100-item deployment inventory page already contained one exact-release
  artifact before Codex could create a worktree: deployment
  `dpl_CzbKmahkF22HWhHM7YLMkJ2E9AKK`, unique URL
  `https://new-athlete-badminton-school-ic6n4p3m8-aachanin1s-projects.vercel.app`,
  Git SHA `11754057f9d82f71c7b69248a77997e491f5069c`, target/state
  `preview/READY`, created/building/READY milliseconds
  `1785138794296/1785138795268/1785138863805`, and branch alias
  `new-athlete-badminton-school-git-spi-6a0ce4-aachanin1s-projects.vercel.app`.
  This was a Git-integrated Preview deployment, not a Codex Production-target
  staged deployment.
- Read-only build-log inspection showed the existing Preview cloned exact commit
  `1175405`, used Vercel CLI `56.5.0` and Next.js `16.2.6`, compiled successfully,
  passed TypeScript, generated static pages `91/91`, built in `cle1`, deployed
  functions to `icn1`, and completed READY. This evidence does not waive the
  explicit duplicate-artifact Hard Stop.
- All four established Production aliases remained on prior promoted artifact
  `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z`: `www.newathleteschool.com`;
  `new-athlete-badminton-school.vercel.app`;
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`; and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`.
  No alias moved, no artifact was promoted, and Production remains unchanged.
- The Safety Gate Hard Stopped before disposable-worktree creation, dependency
  installation, fresh isolated Local verification, deploy, smoke, or runtime-log
  requests. Deploy command count was `0`; no retry/force/rebuild/rollback,
  application request, authenticated session, `/coach/*`, POST/PUT/PATCH/DELETE,
  Supabase access, payment investigation, or Production-data operation occurred.
- Source Complete **Yes**; published Source Tests Passed **Yes**, while fresh
  isolated deploy-gate verification was **Not run due Gate 0 Hard Stop**;
  Committed **Yes**; Pushed **Yes**; Owner-approved Production-target staged
  Deploy **No**; existing exact-SHA Preview **Yes / READY**; Promoted for the
  display fix **No**; Feature Enabled and Allowlisted **Not applicable/unchanged**;
  generation-time Bangkok fix Production Active **Yes**; stored-message display
  fix Production Active **No**; Production UAT **Not run**; Controlled Write UAT
  **Not run**; Data Repaired **No**; Production Data Changed by Codex **No**;
  Customer Impact **Production still displays original stored messages**;
  Financial Impact **None**; Task Done **No**.
- `PROJECT_STATE.md`, `TODO-CODEX.md`, and this dated record were corrected
  local-only to resolve the exact-SHA Preview documentation drift. They remain
  unstaged, uncommitted, and unpushed. Active Task remains **Coach Notification
  Bangkok Date Consistency**. Blocker: the existing exact-SHA READY Preview
  artifact. Next Action: **Owner decides whether the Preview ends this attempt or
  explicitly authorizes a revised Production-target staged Deploy despite it;
  no Deploy or Promotion before that decision**.

### Revised Stored-message Display Staged Deploy — Failed POST Safety Hard Stop

State observed at this revised pre-Deploy Hard Stop on 2026-07-27:

- Owner superseded only the prior duplicate rule: exact-SHA Preview artifacts no
  longer block creation of a separate Production-target staged artifact. The
  existing `dpl_CzbKmahkF22HWhHM7YLMkJ2E9AKK` (`preview/READY`) was explicitly
  allowed; only a pre-existing exact-SHA `production/READY/STAGED` artifact would
  block. Promotion, alias mutation, retry/force/rebuild/rollback, application
  mutation requests, Supabase/Production data access, and Source/config changes
  remained prohibited.
- Fresh Git Gate 0 passed at release
  `11754057f9d82f71c7b69248a77997e491f5069c`, tree
  `275191b84e537e00a217dbc6a267528750f913c6`, with Local/upstream/live Remote
  converged at `0/0`, staged/untracked `0/0`, exact `4 functional + 3 docs`
  membership, forbidden path hits `0`, and protected hashes unchanged.
- Fresh Vercel Gate 0 passed revised duplicate semantics: CLI `56.5.0`, project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, region `icn1`; the existing exact-SHA artifact
  remained Preview only; pre-existing exact-SHA Production artifacts were `0`;
  and all four Production aliases remained on
  `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z`.
- A clean detached disposable worktree was created from the exact release and
  linked using only project/org/name identifiers. Lockfile-only dependency
  installation completed inside it. Fresh Local verification passed notification
  `26/26`, Lesson Wallet `17/17`, Progressive payment notifications `16/16`,
  TypeScript with `--noEmit --incremental false`, ESLint zero warnings, mojibake
  `248`, `git diff --check`, and focused added-line secret scan `0`. Worktree
  HEAD/tree/status remained exact and clean.
- While obtaining a bounded ID inventory before Deploy, the command
  `vercel api /v6/deployments -F ...` exited `1`. Generate-only inspection then
  proved that CLI `56.5.0` interpreted the helper as HTTP POST. Because the gate
  requires an immediate Hard Stop if Codex sends any POST/PUT/PATCH/DELETE
  request, the authorized `deploy --prod --skip-domain` command was not run.
- A subsequent explicit read-only GET proved no deployment state was created:
  deployments newer than baseline `1785138794296` were `0`, exact-SHA Production
  artifacts were `0`, and the only exact-SHA artifact remained Preview
  `dpl_CzbKmahkF22HWhHM7YLMkJ2E9AKK`. Production aliases and Production behavior
  therefore remained unchanged.
- Deploy command count `0`; promote/alias/retry/force/rebuild/rollback counts `0`;
  staged smoke and exact-artifact logs were not run because no new artifact
  exists. No application route, authenticated session, `/coach/*`, Supabase
  access, payment investigation, repair, or Production business-data operation
  occurred.
- Source Complete **Yes**; Tests Passed **Yes**; Committed **Yes**; Pushed **Yes**;
  revised Production-target staged Deploy **No**; existing Preview **Yes / READY**;
  Promoted for display fix **No**; generation-time fix Production Active **Yes**;
  stored-message display fix Production Active **No**; Production UAT **Not run**;
  Controlled Write UAT **Not run**; Data Repaired **No**; Production Data Changed
  **No**; Customer Impact **Production unchanged and continues to display original
  stored messages**; Financial Impact **None**; Task Done **No**.
- The first Preview Hard Stop record above remains valid historical evidence of
  that earlier gate. This revised record supersedes only its current blocker.
  Next Action: **Owner review and explicit revised authorization before any Deploy
  or Promotion**.

### Fresh Revised Stored-message Display Production-target Staged Deploy

State observed at this staged-Deploy closeout on 2026-07-27:

- Owner superseded only the preceding failed no-artifact POST Safety Hard Stop and
  approved a fresh staged Deploy from exact release
  `11754057f9d82f71c7b69248a77997e491f5069c`, tree
  `275191b84e537e00a217dbc6a267528750f913c6`. Every deployment inventory read
  used explicit `GET /v6/deployments` with `-X GET`, no `-F`, form data, or body.
- Fresh Git Gate 0 passed at branch `spike/next-major-security-upgrade`: Local,
  upstream, and live Remote were exact at `0/0`; staged/untracked `0/0`; task
  Source/Test clean; exact membership `4 functional + 3 docs`; forbidden paths
  and focused secret hits `0`; protected hashes unchanged.
- Baseline and final pre-Deploy GET inventories each contained 100 IDs with ID-set
  SHA-256 `67F5DB5ED406103F96507E9557415C7580106AF0970A181022617F2273D20395`.
  Pre-existing exact-SHA `production/READY/STAGED` artifacts were `0`. Existing
  Preview `dpl_CzbKmahkF22HWhHM7YLMkJ2E9AKK` remained allowed
  `preview/READY` with its branch alias.
- The immediately preceding exact-source Local results were retained rather than
  rerun because SHA/tree/status were unchanged: notification `26/26`, Lesson
  Wallet `17/17`, Progressive notifications `16/16`, TypeScript, ESLint zero
  warnings, mojibake `248`, diff check, and secret scan `0`. A fresh clean detached
  worktree reverified exact HEAD/tree/status and project/org-only linking.
- Exactly one pinned Vercel CLI `56.5.0` command
  `deploy --prod --skip-domain` ran from `2026-07-27T10:47:19.2212934Z` through
  `2026-07-27T10:48:38.2246951Z`, exit `0`, and created
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4` at
  `https://new-athlete-badminton-school-cr0k4vw6a-aachanin1s-projects.vercel.app`.
  Artifact created/building/READY timestamps were respectively
  `2026-07-27T10:47:28.769Z`, `2026-07-27T10:47:29.555Z`, and
  `2026-07-27T10:48:38.695Z`.
- Explicit GET postflight proved inventory added exactly one ID: the new artifact,
  source `cli`, exact Git SHA, `production/READY/STAGED`; the 100-item window
  dropped only its former oldest ID due pagination. V13 GET proved custom aliases
  `0` and `autoAssignCustomDomains=false`. No retry, force, rebuild, redeploy,
  Promotion, alias mutation, or rollback occurred.
- Build passed Vercel CLI `56.5.0`, Next.js `16.2.6`, compile, TypeScript, and
  static generation `91/91`; build ran in `cle1`, configured functions region was
  `icn1`, and bounded build-log error lines were `0`.
- Existing Preview and branch alias remained unchanged. All four Production
  aliases remained on promoted generation-time artifact
  `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z`; the new artifact owns no alias and is not
  Production-active.
- Safe smoke used only unauthenticated no-follow GET to the exact staged `/` and
  `/favicon.ico`; both returned Deployment Protection `302`, so staged smoke is
  Partial and no bypass occurred. `/api/health` was intentionally not requested
  because Source shows it performs Supabase SELECTs. Bounded exact-artifact runtime
  logs for the deploy/smoke interval returned `0` events and attributable 5xx `0`.
- Source Complete **Yes**; Tests Passed **Yes retained / not rerun**; Committed
  **Yes**; Pushed **Yes**; Deployed **Yes — staged artifact**; Existing Preview
  **Yes / unchanged**; Promoted for display fix **No**; Feature Enabled and
  Allowlisted **Not applicable/unchanged**; generation-time fix Production Active
  **Yes**; stored-message display fix Production Active **No**; Production UAT
  **Partial staged smoke only**; Controlled Write UAT **Not run**; Data Repaired
  **No**; Production Data Changed **No**; Customer Impact **Production unchanged**;
  Financial Impact **None**; Task Done **No**.
- Next Action: **Owner review before separate Promotion approval**.

### Owner-approved Stored-message Display Exact-artifact Promotion

State observed at this Promotion closeout on 2026-07-27:

- Owner approved exactly one Promotion of Production-target staged artifact
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`, exact release
  `11754057f9d82f71c7b69248a77997e491f5069c`, tree
  `275191b84e537e00a217dbc6a267528750f913c6`. Only control-plane writes generated
  inside that one pinned `vercel promote` command were authorized. Deploy/rebuild,
  retry/force/rollback, separate alias/domain mutation, Coach application UAT,
  `/api/health`, Supabase, application mutation, Production data repair, payment
  investigation, Source/config changes, and documentation Commit/Push remained
  prohibited.
- Fresh Git Gate 0 passed on `spike/next-major-security-upgrade`: Local, upstream,
  and fresh live Remote were exact release `11754057...` at `0/0`; staged and
  untracked counts were `0/0`; task Source/Test was clean; functional ancestor
  `c7f970a3f22cd7ba73f043f529c8bdbcb818da78` retained its exact reviewed four-file
  membership; the release commit retained its exact three-document membership;
  forbidden migration/dependency/lockfile/environment/credential diffs were `0`.
  Protected file hashes remained exact.
- Every Vercel API inventory/artifact/alias read used explicit `-X GET` with no
  `-F`, form data, request body, or mutation flag. Preflight proved pinned CLI
  `56.5.0`, project `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, configured functions region `icn1`, and target
  artifact `production/READY/STAGED` with exact Git SHA, custom aliases `0`, and
  `autoAssignCustomDomains=false`. Artifact created/building/READY timestamps were
  unchanged at `2026-07-27T10:47:28.769Z`, `2026-07-27T10:47:29.555Z`, and
  `2026-07-27T10:48:38.695Z`. No newer conflicting Production-target release was
  present.
- The pre-Promotion 100-item deployment ID set had SHA-256
  `C18475A9A31A9E1079023ECBA74A7BB86699E1F912291BFB6AD42569B93D2608`. Existing
  Preview `dpl_CzbKmahkF22HWhHM7YLMkJ2E9AKK` remained `preview/READY` with its
  branch alias. All four established Production aliases pointed to
  `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z` before Promotion.
- Exactly one command ran:
  `vercel promote dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4 --yes --scope
  team_gw8Y6CPd602WAKRsVFobPGCL --no-color`, from
  `2026-07-27T12:45:42.8265046Z` through `2026-07-27T12:45:49.7296714Z`, duration
  `6.903` seconds, exit `0`. Deploy, rebuild, retry, force, rollback, and separate
  alias mutation command counts were all `0`.
- Explicit GET-only postflight proved the same artifact ID, SHA, tree, and
  creation/build/READY timestamps, now `production/READY/PROMOTED`. The compared
  deployment inventory remained `100`; added and removed ID counts were `0/0`,
  and the ID-set hash remained unchanged. Promotion did not create or rebuild an
  artifact.
- All four established Production aliases moved to
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`: `www.newathleteschool.com`;
  `new-athlete-badminton-school.vercel.app`;
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`; and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`.
  Missing/extra/wrong mappings were `0/0/0`. The Preview branch alias remained
  unchanged. Previous artifact `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z` remained READY
  as a rollback candidate; no rollback was attempted.
- Safe canonical Production smoke ran from `2026-07-27T12:47:08.5725578Z` through
  `2026-07-27T12:47:10.7024221Z`. Unauthenticated no-follow `GET /` and
  `GET /favicon.ico` both returned `200`. No `/coach/*`, authentication,
  `/api/health`, application mutation, or Supabase access occurred.
- Bounded exact-artifact runtime logs covered `2026-07-27T12:45:42Z` through
  `2026-07-27T12:48:00Z`: parsed events `1`, error/fatal lines `0`, attributable
  5xx `0`, and known smoke events `1` (`GET /` `200`). No unrelated event required
  investigation.
- Exact-source verification was retained from the staged-Deploy gate and was not
  rerun during Promotion: notification `26/26`, Lesson Wallet `17/17`, Progressive
  payment notifications `16/16`, TypeScript passed, ESLint zero warnings,
  mojibake `248`, diff check passed, focused secret scan `0`, and artifact build
  compile/TypeScript/static generation `91/91` passed.
- Source Complete **Yes**; Tests Passed **Yes — retained exact-artifact evidence,
  not rerun**; Committed/Pushed **Yes for release, No for current local docs**;
  Deployed **Yes**; Promoted **Yes**; Existing Preview **Yes / unchanged**; Feature
  Enabled and Allowlisted **Not applicable/unchanged**; generation-time fix
  Production Active **Yes**; stored-message display fix Production Active **Yes**;
  Production UAT **Not run**; safe Production smoke **Passed**; Controlled Write
  UAT **Not run**; Data Repaired **No**; Production Data Changed **No**; Financial
  Impact **None**; Task Done **No**.
- Customer Impact: **Historical stored notification rows remain unchanged, but
  supported notification messages are now displayed and searched using the
  canonical date from `link_url`.** Active Task remains **Coach Notification
  Bangkok Date Consistency**. Blocker **None**. Remaining work is Owner/PM review,
  optional natural-use confirmation, and a separate documentation publication
  decision. Next Action: **Owner/PM review and optional natural-use confirmation
  before a separate documentation publication decision**.

### Owner-confirmed Natural-use Production UAT and Task Closeout

State observed at this documentation closeout on 2026-07-27:

- Owner directly confirmed normal Production behavior with the statement
  “ตรงกันครับผม”: the date displayed on the Coach notification and the date on
  the linked Attendance destination matched. This Owner-confirmed natural-use
  visual evidence closes the remaining Production business-confirmation gap.
- External evidence capture:
  `New Athlete Badminton School - Google Chrome 2569-07-27 19-58-29.mp4`,
  SHA-256
  `2EA696DF57D22188267BE86EB5A39A716B02186432CBBA7591524E64712A35B9`, size
  `6,074,326` bytes. The media is external evidence only; it was not copied,
  staged, or committed to Git.
- Confirmed Production artifact remains
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`, exact release
  `11754057f9d82f71c7b69248a77997e491f5069c`, tree
  `275191b84e537e00a217dbc6a267528750f913c6`, state
  `production/READY/PROMOTED`. This closeout did not access Vercel, Supabase, or
  Production application routes and did not deploy, promote, rebuild, retry,
  rollback, or change aliases/configuration.
- Production UAT / business confirmation **Passed through normal Owner use**.
  Controlled Write UAT was **Not run / not required** for this presentation fix.
  Historical notification rows were not repaired or rewritten.
- Production Data Changed: **No Codex repair or task-specific mutation; ordinary
  Owner natural-use side effects were not audited**. Data Repaired **No**.
  Financial Impact **None**.
- Final status: Source Complete **Yes**; Tests Passed **Yes — retained exact-source
  and exact-artifact evidence**; Committed/Pushed **Yes**; Deployed **Yes**;
  Promoted **Yes**; Generation-time fix Production Active **Yes**; Stored-message
  display fix Production Active **Yes**; Production UAT **Passed**; Controlled
  Write UAT **Not run / not required**; Data Repaired **No**; Task Done **Yes**.
- Customer Impact: historical stored rows remain unchanged, but supported
  notification messages display/search using the canonical `link_url` date;
  visible behavior was confirmed by Owner. Active Task is **NONE**. Blocker
  **None**. Remaining Work **None within this task**. Next Action: **Await Owner
  selection; do not start another task or Parking Lot item automatically**.

## 2026-07-27 — Reschedule-In Exact Coach Assignment / Legacy Fallback Isolation

Historical / superseded initial checkpoint from the first Owner-authorized Source
Fix + Local Test gate. Its claim that all Reschedule-in learners remained
unassigned proved only exact-model slots and did not cover genuine legacy-only
fallback. The current Owner Plan A decision and corrected local-only result are the
Decision Record and closeout appended below.

### Gate 0 and Owner decision

- Repository root was the required
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`.
  Branch was `spike/next-major-security-upgrade`; Local HEAD and upstream were
  both `cc48b03f79b916221e0d86099fa017d0c9cc57a6`, ahead/behind `0/0`.
- Pre-existing dirty files were `AGENTS.md` and
  `src/lib/schedule-slot-utils.ts`. Their diffs/content were inspected read-only
  and both were preserved. The schedule utility working content equalled HEAD
  blob `4521281d099efb189429a744909552d67871ff23`.
- The earlier `Active Task: NONE` was valid historical state but was superseded
  by the Owner's new single Active Task. No other unexplained Documentation Drift
  was found.
- Owner policy: the existence of any exact group row makes the slot exact-model,
  even if the group is empty. Legacy is authoritative only for a slot with zero
  exact rows. A rescheduled-in learner remains unassigned until Head Coach review
  and a successful save. Suggestions remain non-persisted suggestions. No
  auto-assignment, attendance, absence, makeup, payroll, or historical repair.

### Fresh Source audit

| Surface | Previous exact predicate | Previous Legacy predicate | Empty exact/new learner behavior | Confirmed risk |
| --- | --- | --- | --- | --- |
| Coach teaching schedule | Slot counted as exact only when a group joined at least one member | Any Legacy coach slot not in that member-bearing set | Empty exact group reopened Legacy and included all verified active learners | Incorrect schedule visibility and downstream authorization context |
| Coach check-in | Any exact row blocked Legacy; coach needed an exact group with a member | Only zero exact rows | Correctly denied empty exact group and new unassigned learner | Predicate was sound but independently implemented |
| Attendance read/write | Target learner exact membership for the coach | Used when that target membership was missing | New learner could authorize through stale Legacy despite another exact row | Unauthorized attendance read/write |
| Teaching Program read/write | Any exact group for the coach, without requiring a member | Used when the coach had no group | Empty group could grant access; stale Legacy could grant a new learner | Unauthorized program read/write; genuine Legacy picker omission |
| Coach-visible student/access | Any exact slot row suppressed Legacy per candidate, but source selection was global | Used only when the coach had no exact session anywhere | Incident path was blocked, but a coach with some exact work could lose genuine Legacy-only learners | Inconsistent visibility and compatibility |
| Coach student history/suggestion | Exact learner membership | Legacy when exact learner membership was absent | Stale Legacy could be presented as learner history in an exact-model slot | Suggestion could be based on invalid assignment evidence |
| Teaching Hours/payroll evidence | Exact joins filtered through coach-specific assignment results | Legacy candidates not independently checked against every slot's exact-model state | Exact rows outside the filtered result could allow Legacy evidence to reappear | Ghost teaching-hour/payroll evidence |
| Assignment notification/action state | Assignment page correctly classified new learners as red/unassigned or amber/changed; suggestions stayed draft-only | Not used for persisted page status | Reschedule emitted generic notifications to all branch coaches | Head Coach/Admin did not get an explicit save-required action; message could imply ordinary schedule change |
| Admin/Head Coach assignment status | Persisted learner membership plus current roster | Suggestions were display-only | Already preserved unassigned/red and changed/amber behavior | No Source change needed in assignment UI |
| Attendance Gap classification | Exact coach membership for target learner | Used when target membership was missing | Stale Legacy could be returned as the assigned coach for an exact-model slot | Gap could be misattributed and stale Legacy mistaken for teaching evidence |

The incident-equivalent Source path was therefore confirmed independently of the
Production report: an empty exact group was invisible to the teaching-schedule
exact-slot set, the surviving Legacy row became authoritative, and an active
unassigned reschedule-in learner was included. This is a Source/authorization
consistency defect, not a cache diagnosis.

### Source implementation

- Added `src/lib/coach-assignment-resolution.ts` as the pure shared definition of
  exact-model slot precedence, genuine Legacy-only compatibility, slot access,
  and learner access.
- Updated Coach teaching schedule, Check-in, Attendance, Teaching Programs,
  program schedule selection, student access/history, and Teaching Hours to use
  any exact group row as the Legacy suppression boundary. Exact-model learner
  access requires the relevant persisted exact membership; genuine zero-row
  Legacy-only slots retain their previous compatibility.
- Updated Admin makeup Attendance Gap coach resolution to return exact membership
  coaches, possibly none, whenever any exact row exists. It no longer treats a
  stale Legacy slot row as proof of who taught an exact-model learner.
- Preserved Reschedule eligibility and transaction/rollback structure. The old
  session deletes only its own exact membership; the new session creates no exact
  membership. Head Coach and Admin/Super Admin receive explicit action-required
  notification copy saying the roster changed, no coach was auto-assigned, and
  assignment must be reviewed and saved. No general branch-coach assignment
  notice is sent.
- Added a deterministic focused resolver regression script and npm command. No
  assignment UI change, Migration, RPC, schema, RLS, trigger, dependency,
  environment, feature-control, or allowlist change was required.

### Local verification

- `npm.cmd run test:coach-assignment-resolution` — passed `20/20`: incident empty
  exact group + stale Legacy, valid exact assignment, mixed groups, genuine
  Legacy-only, reschedule-out isolation, reschedule-in unassigned/action-required,
  past unassigned gap classification, and no ghost payroll evidence.
- `npm.cmd run test:admin-schedule-assignment` — passed `38/38`.
- `npm.cmd run test:lesson-wallet-regression` — passed `17/17`.
- `npm.cmd run test:notification-date-regression` — passed `26/26`.
- `npx.cmd tsc --noEmit --incremental false` — passed.
- `npm.cmd run lint` — passed with zero warnings.
- `npm.cmd run check:mojibake` — passed for `249` files before documentation
  closeout; rerun is recorded in the final current-state verification.
- `git diff --check` — passed; line-ending notices were informational only.
- High-confidence secret-like addition scan — `0` findings.
- `npm.cmd run build` — passed compile, type checking, and static generation
  `91/91`. Generated `.next` was removed afterward from this exact repo.
- DB-writing `test:coach-assignment-conflicts`, Local Playwright Admin assignment
  E2E, and Local Attendance Gap fixture UAT were **not run**. Their guards/config
  were inspected, but `supabase status` could not prove a live isolated Local
  origin because Docker Desktop's Linux engine was unavailable. Production ref
  `tvnhholicwjtxdhlxfqs` was never contacted. Fixture residue introduced by this
  gate is `0` / not applicable.
- The required post-build port-3000 restart/root/static smoke was **not run**.
  Port `3000` belonged to an unrelated `dragonsword-save-editor` development
  process, which was preserved rather than stopped. No Production hostname was
  opened.

### Superseded initial gate result

- Source Complete was reported **Yes at this superseded checkpoint**, before the
  genuine legacy-only path and notification/query failure requirements were added.
  All then-executed tests/checks passed; the isolated
  DB-writing/E2E suites and port-3000 smoke remain explicitly blocked/not run.
- Committed **No**; Pushed **No**; Deployed/Promoted **No**; Production Active
  **No** for this fix; Production UAT and Controlled Write UAT **Not run**;
  Migration **No**; Feature/Allowlist changes **No**; Data Repaired **No**;
  Production Data Changed **No**; Customer runtime change **No**; Financial/
  Payroll impact **None**.
- Historical Attendance Gaps are unchanged and remain queued for a later verified
  resolution. Task Done **No**. Next action is Owner/PM review before a separately
  authorized Commit + Push gate.

### Decision Record — PLAN A: USER RESCHEDULE-IN NEVER INHERITS LEGACY COACH

Status: **CURRENT OWNER DECISION — 2026-07-27**.

- User Reschedule-in moves only the learner's right to attend the destination
  round. It never moves or inherits coach responsibility automatically, including
  in a genuine legacy-only destination slot.
- Until Head Coach Save persists exact membership, Admin/Head Coach must see the
  learner as action-required/unassigned; a Legacy coach cannot gain that learner's
  roster, learner-level Attendance, Program, history/suggestion, Teaching Hours,
  Payroll, or Attendance Gap attribution.
- Genuine Legacy compatibility remains only for legitimate learners who are not a
  pending User Reschedule-in. In mixed slots, the Coach retains only those
  legitimate learners. A pending-only slot cannot create slot-level Coach evidence
  from a Legacy row alone.
- `rescheduled_from_id` is not a standalone provenance marker. User Reschedule,
  Lesson Wallet redemption, and Admin Makeup all write it. `is_makeup=true`
  identifies Makeup. A matching `lesson_wallet_credits.redeemed_session_id`
  identifies Wallet redemption. Wallet provenance must be batch-loaded and query
  failure must fail closed. Wallet and Makeup business semantics remain unchanged.
- Any Exact/provenance query failure fails closed. Write/authorization APIs deny or
  return 5xx; read surfaces expose unavailable/error state and never reinterpret a
  failed query as confirmed zero rows that reopen Legacy.
- Assignment-review notification recipient lookup, existence check, and insert
  failures must be observable and cannot be reported as delivery success. Because
  notification happens after Reschedule data commits, notification failure returns
  a success response with an explicit warning plus activity-log/console evidence;
  it does not return a retry-inducing post-commit 5xx.
- Historical Attendance Gaps are review-only. No auto-attendance, auto-absence,
  auto-makeup, auto-payroll, stale-coach attribution repair, or historical repair
  is authorized.

### Fresh Plan A Gate 0 and provenance audit

- Required repository root:
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`.
- Branch `spike/next-major-security-upgrade`; Local HEAD and locally known upstream
  HEAD both `cc48b03f79b916221e0d86099fa017d0c9cc57a6`; ahead/behind `0/0`.
  No fetch/network was used. Staged diff was empty.
- Protected files remained untouched: `AGENTS.md` SHA-256
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`;
  `src/lib/schedule-slot-utils.ts` SHA-256
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`,
  expected/current HEAD blob `4521281d099efb189429a744909552d67871ff23`.
- Documentation Drift was confirmed and explained: the superseded checkpoint
  claimed `Source Complete = Yes` and universal Reschedule-in isolation after
  proving only exact-model precedence. Owner Plan A added genuine legacy-only
  isolation, explicit provenance, fail-closed query behavior, and notification
  observability. No other unexplained current-state conflict was found.
- The prior PM command was stale for Plan A because most assertions checked source
  strings and did not behavior-test genuine legacy-only provenance, query failure,
  notification failure, Attendance Gap attribution, or payroll evidence.

| Session/assignment case | Reliable facts | Classification / result |
| --- | --- | --- |
| Normal booking session | `rescheduled_from_id IS NULL` | `normal`; Legacy-compatible when the slot is genuine legacy-only |
| User Reschedule-in | `rescheduled_from_id IS NOT NULL`, `is_makeup=false`, no matching Wallet `redeemed_session_id` | `user_reschedule`; pending until exact membership is saved; never Legacy-compatible |
| Lesson Wallet redeemed session | `lesson_wallet_credits.redeemed_session_id = booking_sessions.id` | `lesson_wallet`; not misclassified; existing Wallet semantics retained |
| Admin Makeup session | `is_makeup=true` | `admin_makeup`; not misclassified; existing Makeup semantics retained |
| Exact-assigned session | Exact group member row for the learner and coach | Exact is authoritative, including a User Reschedule-in after Head Coach Save |
| Exact-unassigned session | Slot has any exact group row but learner lacks persisted exact membership | No Legacy fallback; action-required/unassigned |
| Genuine legacy-only learner | Slot has zero exact group rows plus Legacy coach row | Allowed only when the learner is not pending User Reschedule-in |

### Consumer matrix after Plan A fix

| Surface | Exact predicate | Legacy predicate | Access/evidence level | Error behavior | Pending User Reschedule-in | Wallet / Makeup |
| --- | --- | --- | --- | --- | --- | --- |
| Coach schedule / Today / Check-in picker / Attendance picker | Any exact row is the slot boundary; Coach roster requires persisted member in Coach group | Zero exact rows + Legacy coach + at least one provenance-eligible active verified learner | Slot and learner roster | Exact, roster, attendance, check-in, or provenance error throws unavailable; no Legacy reopen | Filtered from Legacy roster; pending-only slot disappears and produces no Coach evidence | Remain eligible under existing lifecycle rules |
| Check-in write API | Exact group for Coach with persisted member | Zero exact rows + Legacy coach + eligible learner count > 0 | Slot-level write authorization | Exact/Legacy/learner/provenance error becomes 5xx; no permission grant | Pending-only Legacy slot denied; mixed legitimate slot still check-in eligible | Remain eligible |
| Attendance write API | Exact membership for exact learner + Coach | Zero exact rows + Legacy coach + target provenance not `user_reschedule` | Exact learner read/write | Exact/Legacy/provenance/check-in query error becomes 5xx | No read/write authorization | Remain eligible; Admin retrospective role bypass unchanged |
| Teaching Programs picker/write | Exact Coach group must have persisted member | Zero exact rows + Legacy coach + eligible learner count > 0 | Slot-level picker/write | Read throws unavailable; write returns 5xx on data failure | Pending-only slot absent/denied; mixed legitimate slot remains usable | Remain eligible |
| Coach student access / Levels | Exact member sessions for Coach | Genuine legacy-only slot plus provenance-eligible sessions | Learner-level read/manage | Query failure throws unavailable | Not visible through Legacy | Remain visible per existing rules; Head Coach branch authority unchanged |
| Learner history / Coach suggestion | Exact learner membership | Genuine legacy-only historical row only when provenance is eligible | Learner history/suggestion | Session/exact/Legacy/provenance failure throws unavailable | Current pending session does not claim stale Legacy coach; legitimate earlier history remains history | Remain valid history |
| Teaching Hours / Payroll | Exact Coach group with payable persisted members | Genuine legacy-only row plus provenance-eligible payable sessions | Slot/learner evidence | Assignment/session/provenance/check-in/attendance failure throws unavailable | Excluded from learner and attendance counts; pending-only slot emits no row | Existing evidence semantics retained |
| Admin Attendance Gap | Exact coach membership for the target learner | Genuine legacy-only coach only when target provenance is eligible | Learner attribution/review | Exact/Legacy/provenance failure becomes 5xx | Returns no stale Legacy coach attribution; stays review-only | Existing review semantics retained |
| Head Coach assignment page | Persisted exact learner membership only; Legacy is suggestion text | Never considered saved responsibility | Admin/Head Coach action state | Roster/exact/Legacy query failure throws unavailable | Remains unassigned/action-required until Save | Existing Wallet/Makeup roster semantics unchanged |
| Reschedule notifications | Not an assignment authorization predicate | Not applicable | Communication after data commit | Recipient/existence/insert failures aggregate as failed delivery; response remains success with warning and activity-log/console detail | Explicit Head Coach/Admin review action | No Wallet/Makeup change |

### Plan A Source implementation

- `src/lib/coach-assignment-resolution.ts` now owns pure provenance, pending User
  Reschedule-in, exact/Legacy access, Attendance Gap coach resolution, and
  fail-closed query rules. Wallet evidence is loaded in bounded batches; no
  per-learner N+1 query was introduced.
- `src/lib/coach-notification-delivery.ts` owns testable recipient/existence/insert
  delivery results. `src/lib/coach-notifications.ts` adapts the existing typed
  notification producers to it.
- Coach schedule, Check-in, Attendance, Teaching Programs, student access,
  student memory/suggestions, Teaching Hours/Payroll, Admin Attendance Gap, and
  Head Coach assignment loading now check exact/provenance errors and apply Plan A.
- `/api/reschedule` still removes only the old exact membership and creates no new
  exact membership. After commit it aggregates assignment-review delivery results,
  records them in `reschedule_booking_session` activity details, logs failed
  delivery, and returns warning code `ASSIGNMENT_REVIEW_NOTIFICATION_FAILED`
  without post-commit 5xx retry behavior.
- No Assignment UI redesign, auto-assignment, Migration, schema, RLS, trigger,
  RPC, Wallet/Makeup semantics, dependency, lockfile, environment, feature,
  allowlist, pricing, payment, entitlement, or historical repair change occurred.

### Plan A Local verification and closeout

- `npm.cmd run test:coach-assignment-resolution` passed behavior assertions
  `20/20`: exact empty/stale Legacy, genuine Legacy normal/User Reschedule, mixed
  roster, pending-only evidence, Head Coach exact Save, Wallet, Makeup, exact and
  Wallet query failures, batch provenance, notification recipient/existence/insert
  failures, delivery success, Attendance Gap, and no ghost Payroll evidence.
- `npm.cmd run test:admin-schedule-assignment` passed `38/38`.
- `npm.cmd run test:lesson-wallet-regression` passed `17/17`.
- `npm.cmd run test:notification-date-regression` passed `26/26`.
- `npx.cmd tsc --noEmit --incremental false`, ESLint zero warnings, mojibake,
  `git diff --check`, high-confidence secret-like addition scan, and Next.js build
  compile/type/static generation `91/91` passed. Final counts are recorded in the
  current `PROJECT_STATE.md` matrix after documentation closeout.
- Local DB-writing conflict/E2E and Attendance Gap fixture UAT were not run. Local
  config identifies `New-Athlete-Badminton-School` at ports `54321/54322`, but no
  Local Supabase CLI is installed and Docker `desktop-linux` has no reachable
  server/engine, so Local origin/project identity could not be proven. No remote
  fallback occurred; Production ref `tvnhholicwjtxdhlxfqs` was never contacted.
  Fixture residue is `0` / not applicable.
- Build-created `.next` was removed only from the target repository. Port `3000`
  is owned by unrelated `dragonsword-save-editor` Node PID `10416`; that process
  was preserved, so restart/root/static smoke was Blocked/Not run.
- Source Complete **Local only**. Tests Passed **Yes for every permitted executed
  check**; DB-writing/E2E and port smoke remain explicitly Blocked/Not run.
  Committed **No**; Pushed **No**; Deployed/Promoted **No**; Production Active
  **No**; Production UAT/Controlled Write **Not run**; Feature/Allowlist changes
  **No**; Data Repaired **No**; Production Data Changed **No**; Customer runtime
  change **No**; Financial/Payroll change **None**. Historical gaps remain
  unrepaired. Task Done **No**. Next action: Owner/PM fresh worktree review and
  await explicit direction; do not start another gate automatically.

### Correction Round — Required Assignment-Review Notification Correctness

State observed at this local closeout on 2026-07-27. This record remains under
the current **PLAN A: USER RESCHEDULE-IN NEVER INHERITS LEGACY COACH** Decision
Record above. Owner authorized notification correctness, deterministic tests, and
current documentation only; learner UI, Commit, Push, Deploy, Production access/
write, migration/schema/RLS/RPC, feature/allowlist, and business-policy expansion
remained prohibited.

- Fresh Gate 0 remained at repository root
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, Local/upstream HEAD
  `cc48b03f79b916221e0d86099fa017d0c9cc57a6`, ahead/behind `0/0`, with no staged
  files. No fetch or network access occurred. The pre-existing scoped Plan A
  worktree was preserved.
- Protected files remained byte-identical: `AGENTS.md` SHA-256
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`;
  `src/lib/schedule-slot-utils.ts` SHA-256
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`, expected/
  current HEAD blob `4521281d099efb189429a744909552d67871ff23`.
- Correction root cause: zero Admin/Super Admin or branch Head Coach recipients
  were treated as successful delivery; Admin lookup and insert shared one opaque
  stage; an insert exception was mislabeled `existence_check`; and Reschedule
  activity counts excluded the Admin/Super Admin audience.
- Admin/Super Admin and Head Coach delivery now use the same structured report:
  recipient IDs, `recipientLookupError`, `recipientEmpty`, and a per-recipient
  delivery result carrying `success`, `skipped`, `stage`, and error. Returned and
  thrown recipient lookup, existence-check, and insert failures remain distinct.
  A thrown insert is now `stage=insert`.
- Required audiences are Admin/Super Admin and new-branch Head Coach, plus old-
  branch Head Coach only when an Exact membership was removed. An empty required
  recipient set is a `recipient_empty` failure. The combined report records
  required audience, recipient, attempt, successful recipient, skipped, failed
  recipient, audience failure, total failure, and detailed failure data across
  every included audience.
- After the Reschedule mutation commits, any notification failure remains
  non-retry-inducing: the API response is `success:true` with warning code
  `ASSIGNMENT_REVIEW_NOTIFICATION_FAILED`; the activity log receives the complete
  totals/details and a console error is emitted. No new Exact membership or
  auto-assignment is created. Successful delivery returns `warning:null`.
- The warning is **API/operator-visible only** in this gate through the JSON
  response, activity detail, and console error. Learner-visible warning UI was not
  changed and requires separate Owner authorization.
- Deterministic focused behavior passed `29/29`, covering zero recipients for all
  required audiences, returned/thrown recipient lookup, existence, and insert
  failures with exact stages, structured Admin results, complete three-audience
  totals, post-commit success-with-warning, successful no-warning, and all prior
  Plan A provenance/Exact/Legacy/Attendance Gap/Payroll safeguards.
- Additional permitted verification passed: Admin assignment `38/38`, Lesson
  Wallet `17/17`, notification-date `26/26`, TypeScript `--noEmit --incremental
  false`, ESLint zero warnings, mojibake `250` files, `git diff --check`, high-
  confidence secret-like addition scan `0` findings across `21` dirty files,
  documentation consistency matrix bad fields `0/29`, and Next.js build compile/
  type/static generation `91/91`. Build-created `.next` was removed only from this
  repository.
- Local DB-writing/E2E and Attendance Gap fixture UAT remained Blocked/Not run:
  no trusted isolated Local Supabase runtime could be proven and no remote fallback
  was allowed. Fixture residue is `0`. Port `3000` still belongs to unrelated
  `dragonsword-save-editor` Node PID `10416`, so it was preserved and post-build
  root/static smoke remained Blocked/Not run.
- Source Complete **Local only**; Tests Passed **Yes for every permitted executed
  check**; Committed/Pushed/Deployed/Production Active **No**; Feature/Allowlist
  changes, Data Repair, Production Data Change, customer runtime impact, and
  financial/payroll change **None**. Historical gaps remain unrepaired. Task Done
  **No**. Active Task remains **RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY
  FALLBACK ISOLATION**. Next action is Owner/PM fresh worktree review; do not
  propose Commit + Push or start another gate automatically.

### 2026-07-28 Follow-up — Post-Build Local Smoke / Documentation Reconciliation

State observed at this follow-up closeout. Owner authorized only a fresh read-only
Gate 0, conditional existing regression/build/local smoke, cleanup, and current
documentation reconciliation under the existing Plan A Active Task. Source/Test/
package changes, learner UI, Commit, Push, Deploy, Production/Vercel/Supabase
remote access, DB writes, migration/schema/RLS/RPC, feature/allowlist, data repair,
and Parking Lot work remained prohibited.

- Gate 0 confirmed repository root
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, Local and locally known upstream HEAD
  `cc48b03f79b916221e0d86099fa017d0c9cc57a6`, ahead/behind `0/0`, no staged
  files, and `.next` absent. No fetch or network access occurred.
- The PM snapshot had observed port `3000` free. Fresh Gate 0 and a second bounded
  read-only recheck instead found the unrelated `dragonsword-save-editor` Node
  process PID `10416` listening from
  `C:\Users\aacha\Documents\Codex\2026-07-27\z\work\dragonsword-save-editor`.
  This process was not started by this gate and was not stopped.
- The mandatory free-port precondition failed before implementation step A.
  Therefore the follow-up did **not** rerun the focused regression, build, dev
  server, loopback root request, Next static-asset request, or browser verification.
  Dev-server PID started by this gate: **None**. Root/static status: **Blocked/Not
  run**. Previous `29/29` focused and build `91/91` evidence remains dated prior
  evidence and was not relabeled as a new run.
- No build ran, no generated cleanup was needed, and `.next` remained absent.
  Final port `3000` state remained the unrelated PID `10416`; no process tree was
  terminated.
- `AGENTS.md` and `src/lib/schedule-slot-utils.ts` retained their protected hashes
  and the schedule utility retained HEAD blob
  `4521281d099efb189429a744909552d67871ff23`. All 17 dirty Source/Test/package
  files were hashed before documentation edits and remained byte-identical after
  the follow-up. Only `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md` changed in this follow-up.
- Local Supabase DB-writing/E2E remains Blocked/Not run: Supabase CLI was absent,
  Docker context was `desktop-linux`, and no Docker server/engine was reachable.
  No remote fallback, fixture, DB read/write, or authenticated/API route was used.
  Fixture residue is `0`.
- Plan A and notification policy did not change. User Reschedule-in still never
  inherits a coach automatically, and the notification warning remains API/
  operator-visible only; learner-visible UI still requires separate Owner scope.

Safety/status at this follow-up: Source Complete **Local only**; new focused test
and build **Blocked/Not run by the port precondition**; prior deterministic/build
evidence remains passed; root/static smoke **Blocked/Not run**; Committed **No**;
Pushed **No**; Deployed/Promoted **No**; Production accessed/active **No**;
Production UAT and Controlled Write UAT **Not run**; Migration **No**; Feature/
Allowlist changes **No**; Data Repaired **No**; Production Data Changed **No**;
customer runtime impact **No**; financial/payroll impact **None**; historical
Attendance Gaps remain unrepaired; Task Done **No**. Active Task remains
**RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Next action
is Owner/PM review; no Commit + Push or later gate is implied or authorized.

### 2026-07-28 Publish Closeout — Plan A Source/Test and Documentation

State observed at this publish closeout. Owner accepted the unresolved local
root/static smoke and isolated Local Supabase DB-writing/E2E risks and authorized
exactly one 16-file functional commit/push followed by one three-file
documentation closeout commit/push on the existing branch. Deploy, Promotion,
Production/Vercel/Supabase remote access, migration/schema/RLS/RPC, feature/
allowlist, Controlled Write, data repair, learner-visible warning UI, and Parking
Lot work remained prohibited.

- Fresh Gate 0 confirmed repository root
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, Local and fetched remote HEAD
  `cc48b03f79b916221e0d86099fa017d0c9cc57a6`, ahead/behind `0/0`, no staged
  files, and the expected `18` modified plus `3` untracked worktree. The fetch was
  limited to the exact current branch on configured `origin`; remote preflight
  remained unchanged, so no merge/rebase/reset/force operation was needed.
- Protected dirty files stayed outside both commits. Before functional staging,
  `AGENTS.md` SHA-256 was
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`;
  `src/lib/schedule-slot-utils.ts` SHA-256 was
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`;
  its filtered working blob and HEAD blob were both
  `4521281d099efb189429a744909552d67871ff23`.
- Fresh pre-stage verification passed: focused Plan A behavior `29/29`, Admin
  assignment `38/38`, Lesson Wallet `17/17`, notification-date `26/26`, TypeScript
  `--noEmit --incremental false`, ESLint zero warnings, mojibake `250` files, and
  `git diff --check`. The prior build compile/type/static generation `91/91` is
  retained dated evidence and was not rerun in this Commit Gate.
- Functional staged scope was exactly the Owner-approved 16 files: missing `0`,
  extra `0`, cached diff check passed, and high-confidence staged secret-like
  addition scan returned `0` findings. No documentation or protected file was
  included.
- Functional commit evidence: SHA
  `54752bcc2a914b7d2f67f344c62e50f642f890ac`; tree
  `a3fc7b3d01a3fd6a9a0eb7eae4403e427a13dfac`; parent
  `cc48b03f79b916221e0d86099fa017d0c9cc57a6`; subject
  `fix(coach): isolate reschedule-in assignments`. The normal non-force push to
  `origin/spike/next-major-security-upgrade` succeeded, fetched remote HEAD matched
  the functional SHA, and ahead/behind returned `0/0` before documentation work.
- Documentation closeout scope was exactly `PROJECT_STATE.md`, `TODO-CODEX.md`,
  and `DEVELOPMENT_TODO.md`. Its subject is
  `docs: record reschedule assignment publish`; the commit containing this record
  was pushed normally as the branch head, with the functional commit as its direct
  ancestor. Exact documentation SHA/tree/parent are recorded in final Git evidence
  because a commit cannot embed its own content-derived SHA.
- Post-build root/static smoke remains Blocked/Not run. Port `3000` ownership is
  intermittent: PID `10416` from unrelated `dragonsword-save-editor` was observed
  again at documentation closeout and preserved, but this is not asserted as a
  permanent listener state. `.next` was absent. Local Supabase DB-writing/E2E and
  Attendance Gap fixture UAT also remain Blocked/Not run because Supabase CLI was
  absent and Docker `desktop-linux` had no reachable server/engine. No remote
  fallback or fixture was used; fixture residue is `0`.
- Plan A remains unchanged: User Reschedule-in never auto-inherits a coach in any
  slot; normal genuine Legacy, Wallet, and Makeup compatibility remains; exact/
  provenance failures fail closed; and notification warning is API/operator-
  visible only. Historical Attendance Gaps were not repaired.

Status at this publish closeout: Source Complete **Yes**; fresh required checks
**Passed**; prior build `91/91` **retained/not rerun**; root/static smoke and Local
DB/E2E/fixture UAT **Blocked/Not run**; Committed **Yes**; Pushed **Yes**;
Deployed/Promoted **No**; Production accessed/active **No**; Production UAT and
Controlled Write UAT **Not run**; Migration **No**; Environment change **No**;
Feature/Allowlist change **No**; Data Repaired **No**; Production Data Changed
**No**; customer runtime impact **No**; financial/payroll impact **None**. Task
Done remains **No**. Active Task remains **RESCHEDULE-IN EXACT COACH ASSIGNMENT /
LEGACY FALLBACK ISOLATION**. Next action is Owner/PM review before a separately
authorized Deploy/Release Readiness gate; no Deploy is automatic.

### 2026-07-29 Fresh Release Readiness — Owner-Accepted Local Environment Limitation

State observed at this documentation closeout on 2026-07-29. Owner authorized
only publication of the completed Fresh Release Readiness evidence in the three
current documentation files, one documentation commit, and one normal non-force
Push on the existing branch. Source/Test/package/dependency/lockfile/environment,
PR, Deploy/Promotion/rebuild/rollback, Vercel/Supabase/Production access,
Production UAT, Controlled Write, migration/schema/RLS/RPC, feature/allowlist,
data repair, residual-Junction cleanup, and Parking Lot work remained prohibited.

- Fresh Gate 0 confirmed repository root
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, exact release Source
  `7286748824c06cffb3650c9897028f7e7015d722`, tree
  `475c97c36df541f523635f3425a90b3f4efd98a8`, parent
  `065c9c0574e4a9ea419939b602d92e52db4846d9`, and Local/upstream/origin-
  tracking/live Remote convergence at `0/0`. Functional commit
  `54752bcc2a914b7d2f67f344c62e50f642f890ac`, tree
  `a3fc7b3d01a3fd6a9a0eb7eae4403e427a13dfac`, parent
  `cc48b03f79b916221e0d86099fa017d0c9cc57a6`, remained an ancestor with exact
  16-file membership, missing/extra `0/0`.
- Source-policy audit passed: any Exact group row, including an empty group,
  keeps the slot in the Exact model; User Reschedule-in never auto-inherits a
  Legacy coach; genuine Legacy-only compatibility remains limited to eligible
  learners; Lesson Wallet and Admin Makeup provenance remain distinct; Exact and
  provenance failures fail closed; notification failure remains observable; and
  historical Attendance Gaps remain unrepaired.
- Fresh deterministic verification passed: Coach assignment resolution `29/29`,
  Admin schedule assignment `38/38`, Lesson Wallet `17/17`, notification Bangkok
  date `26/26`, TypeScript `--noEmit --incremental false`, ESLint zero warnings,
  mojibake `250` files, `git diff --check`, and a high-confidence secret-like scan
  with `0` findings across `1,974` functional added lines. Two deterministic
  scripts emitted `MODULE_TYPELESS_PACKAGE_JSON` runtime notices; both suites
  exited `0`, and the notices were not ESLint warnings.
- Fresh Next.js `16.2.6` webpack build passed compile and TypeScript. Static
  generation completed `91/91`; this is fresh Release Readiness evidence, not the
  earlier retained build result. No dependency install/update or lockfile change
  occurred.
- Isolated loopback root smoke did **not** pass: `GET /` returned HTTP `500` after
  the authorized Supabase-environment scrub, and the static-asset request was not
  run after that root gate failed. The sanitized cause was absence of the Supabase
  URL/key configuration required to create the middleware client. No credential
  value was read, recorded, supplied, or displayed.
- The root result is not evidence of this task's functional Source regression.
  `src/proxy.ts` invokes `updateSession()` before the public-route branch, and
  unchanged `src/lib/supabase/middleware.ts` requires the Supabase configuration.
  Functional commit `54752bcc...` changed neither file; root/proxy functional-diff
  membership was `0`. Owner accepts the HTTP `500` as a **Known Local Environment
  Limitation** and classifies Release Readiness as **ACCEPTED WITH KNOWN LOCAL
  ENVIRONMENT LIMITATION**. Root smoke is not described as passed, and no remote
  fallback was used.
- Supabase, Vercel, Production application, `/api/health`, authenticated routes,
  DB-writing/E2E, Attendance Gap fixture UAT, Production UAT, and Controlled Write
  UAT were not accessed or run. Fixture residue is `0`; Production/data/customer/
  financial/payroll changes attributable to this gate are `0`.
- The detached disposable worktree used exact release Source and was tracked-clean
  after verification. `git worktree remove` completed and unregistered it, leaving
  one local housekeeping residual only:
  `C:\Users\aacha\AppData\Local\Temp\codex-release-readiness-7286748-audit\node_modules`.
  It is a Junction, not a dependency copy, targeting
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School\node_modules`.
  It does not change tracked repository or Production state, is not a Deploy
  blocker, and must not be recursively deleted. Junction cleanup was not attempted
  in this documentation closeout and remains outside scope.
- This dated record, the authoritative current matrix, and the short execution
  index are published by the documentation-only commit containing this record.
  Exact commit SHA/tree and the single normal non-force Push result are recorded in
  the final handoff because a commit cannot embed its own content-derived SHA.

Final safety matrix at this closeout: Source Complete **Yes**; Fresh deterministic/
static/build verification **Passed**; Release Readiness **Accepted with Known Local
Environment Limitation**; isolated root smoke **HTTP 500 / not passed / Owner-
accepted limitation**; Committed/Pushed **Yes** for Source and documentation
closeout; Deployed/Promoted **No**; Production accessed/active **No**; Production
UAT and Controlled Write UAT **Not run**; Migration **No**; Environment,
Feature, and Allowlist changes **No**; Data Repaired **No**; Production Data
Changed **No**; Customer Impact **None**; Financial/Payroll Impact **None**; Task
Done **No**. Active Task remains **RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY
FALLBACK ISOLATION**. Next action is Owner/PM review before a separately authorized
Staged Deploy decision; no Deploy or Production action is automatic.

### 2026-07-29 Staged Deploy — Local Vercel CLI Invocation Hard Stop

State observed at this staged-Deploy Hard Stop on 2026-07-29. Owner authorized
one Production-target `deploy --prod --skip-domain` command from exact Source
`39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, read-only Vercel control-plane
verification, safe disposable-worktree cleanup, and local-only documentation.
Promotion, alias movement, retry/rebuild/rollback, application requests,
Supabase/Production access, Source/Test/package/migration/environment changes,
Commit, and Push remained prohibited.

- Git Gate 0 passed at repository
  `C:\Users\aacha\Documents\Codex\CMS NASC\New-Athlete-Badminton-School`, branch
  `spike/next-major-security-upgrade`, exact HEAD
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, tree
  `bc436dac861c8a5748b150efdb6c49f84881201d`, parent
  `7286748824c06cffb3650c9897028f7e7015d722`. Local/upstream/origin-tracking/live
  Remote matched at ahead/behind `0/0`; functional commit `54752bcc...` remained an
  ancestor with exact 16-file membership. Staged/untracked were `0/0`; unstaged
  files were only the two protected paths with their expected hashes.
- Source-scope audit found migration/schema/RLS/RPC, lockfile, dependency-version,
  environment, and `vercel.json` changes `0`. Functional `package.json` changed
  only by the approved `test:coach-assignment-resolution` script. Fresh Release
  Readiness evidence was retained and not rerun: deterministic checks
  `29/29`, `38/38`, `17/17`, and `26/26`; TypeScript; ESLint zero warnings;
  mojibake `250`; secret-like scan `0/1,974`; fresh build/static generation
  `91/91`; root smoke HTTP `500` remained the Owner-accepted Known Local
  Environment Limitation.
- Vercel preflight used cached CLI `56.5.0`, project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, project `new-athlete-badminton-school`, Node
  `24.x`, and configured functions region `icn1`. Every manual API request used
  explicit `-X GET`; no `-F`, input/body, or mutation method was used.
- The final preflight deployment window contained `100` IDs with ID-set SHA-256
  `E6F84457053D4D06EE22B59D23D8330F2EE10AEA1D3803B48829A1ED7610F0CE`.
  Exact-SHA Preview count was `1`: pre-existing Git Preview
  `dpl_ZKyt3Qj28EoVjN9Rph3jEHfq4fgZ`, `preview/READY/STAGED`. Exact-SHA
  Production-target READY/STAGED count was `0`, so duplicate-artifact Gate 0
  passed. All four established Production aliases pointed to prior promoted
  artifact `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; missing/wrong mappings were `0/0`.
- A new detached disposable worktree at
  `C:\Users\aacha\AppData\Local\Temp\codex-staged-deploy-39a56d3-20260729-01`
  was exact and tracked-clean with no `node_modules`. Its local ignored
  `.vercel/project.json` contained only the verified project/org/name linkage.
- The authorized deploy command was invoked once at
  `2026-07-29T04:49:42.8662984Z`, but PowerShell resolved `vercel` to the cached
  `vercel.ps1` shim and Windows Execution Policy blocked that shim before the
  deploy process entered Vercel CLI. The attempt ended locally at
  `2026-07-29T04:49:42.9672204Z`, after `0.101` seconds. No Vercel deployment
  request, authorized control-plane write, deployment record, remote build, or
  artifact resulted. Gate policy prohibited retry, and no retry or alternate
  invocation method was attempted.
- Explicit-GET postflight proved the inventory count and ID-set hash remained
  `100` and
  `E6F84457053D4D06EE22B59D23D8330F2EE10AEA1D3803B48829A1ED7610F0CE`;
  added/removed deployment IDs were `0/0`. The exact-SHA Preview remained
  unchanged and no exact-SHA Production-target artifact existed. Alias inventory
  remained `8/8`; all four Production mappings and all four branch Preview
  mappings were byte-for-byte equivalent as structured evidence. Promotion and
  alias mutation counts were `0/0`.
- Application request, smoke, Vercel runtime-event generation, Supabase access,
  Production application/data access, Production UAT, Controlled Write UAT,
  feature/allowlist change, migration, data repair, customer impact, and
  financial/payroll impact were all `0`/Not run/None as applicable.
- The disposable worktree remained exact and tracked-clean after the local block.
  `git worktree remove` succeeded against the validated exact path; the path no
  longer exists and its worktree registration count is `0`. The separate protected
  residual Junction at
  `C:\Users\aacha\AppData\Local\Temp\codex-release-readiness-7286748-audit\node_modules`
  remained untouched and still targets this repository's `node_modules`.

Final safety matrix at this Hard Stop: Source Complete **Yes**; retained Fresh
Release Readiness **Accepted with Known Local Environment Limitation**; current
staged Deploy **No artifact created**; deploy invocation count **1**; deploy-
process/control-plane write count **0/0**; Deployed/Promoted **No/No** for this
exact Source; Production Active **No**; Production UAT and Controlled Write UAT
**Not run**; Commit/Push **No/No** for this gate; Data Repaired **No**; Production
Data Changed **No**; Customer Impact **None**; Financial/Payroll Impact **None**;
Task Done **No**. Active Task remains **RESCHEDULE-IN EXACT COACH ASSIGNMENT /
LEGACY FALLBACK ISOLATION**. Blocker is the local PowerShell Execution Policy;
next action is Owner/PM review and separate authorization before any new staged-
Deploy attempt, staged UAT, Promotion, documentation publication, or Production
action. No retry is automatic.

### 2026-07-29 Staged Deploy Retry — Production-Target Artifact Ready/Staged

State observed at this separately authorized retry closeout on 2026-07-29. The
preceding **Local Vercel CLI Invocation Hard Stop** remains valid historical
evidence: that first invocation never entered the deploy process and created no
artifact. Owner then authorized fresh Gate 0, one retry through an explicit
Windows `.cmd` or exact Node/CLI entrypoint, one Production-target
`deploy --prod --skip-domain`, read-only postflight/build evidence, safe cleanup,
and local-only documentation. Staged application UAT, Promotion, alias mutation,
application requests, Supabase/Production access, Source/Test/config/package/
migration/environment changes, Commit, and Push remained prohibited.

- Fresh Git Gate 0 passed at branch `spike/next-major-security-upgrade`, exact HEAD
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, tree
  `bc436dac861c8a5748b150efdb6c49f84881201d`, parent
  `7286748824c06cffb3650c9897028f7e7015d722`. Local/upstream/origin-tracking/live
  Remote matched at ahead/behind `0/0`. Functional commit `54752bcc...` remained an
  ancestor with exact 16-file membership, missing/extra `0/0`. Root staged and
  untracked counts were `0/0`; modified files were exactly the three local Hard
  Stop documents plus the two protected pre-existing paths.
- Protected hashes remained exact before Deploy: `AGENTS.md`
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `src/lib/schedule-slot-utils.ts`
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
  Source/Test/package/lockfile/migration/schema/RLS/RPC/environment and
  `vercel.json` had no post-HEAD drift.
- `Get-Command vercel -All` and `where.exe vercel` found no PATH command. Cached
  candidate inspection found explicit `.cmd` launcher
  `C:\Users\aacha\AppData\Local\npm-cache\_npx\630ee44d7c586e3f\node_modules\.bin\vercel.cmd`
  and sibling `vercel.ps1`; exact chosen invocation used
  `C:\Program Files\nodejs\node.exe` with entrypoint
  `C:\Users\aacha\AppData\Local\npm-cache\_npx\630ee44d7c586e3f\node_modules\vercel\dist\vc.js`.
  Local version verification returned `56.5.0`. Bare `vercel`, `vercel.ps1`,
  `npx`, PATH mutation, `Set-ExecutionPolicy`, and Execution Policy bypass/change
  counts were all `0`.
- Vercel project linkage contained only `projectId`, `orgId`, and `projectName`,
  matching `prj_v034HOI6AjaMpBezWvuvT0W24pTp`,
  `team_gw8Y6CPd602WAKRsVFobPGCL`, and
  `new-athlete-badminton-school`; configured functions region remained `icn1`.
  Every manual Vercel API request used explicit `-X GET`; no `-F`, request body,
  input file, or mutation method was used.
- Preflight inventory contained `100` IDs with ID-set SHA-256
  `E6F84457053D4D06EE22B59D23D8330F2EE10AEA1D3803B48829A1ED7610F0CE`.
  Exact-SHA Preview count was `1`: allowed Git Preview
  `dpl_ZKyt3Qj28EoVjN9Rph3jEHfq4fgZ`, `preview/READY/STAGED`. Exact-SHA
  Production-target READY/STAGED count was `0`. All four established Production
  aliases pointed to `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; missing/extra/wrong
  mappings were `0/0/0`, and all four branch Preview mappings were snapshotted.
- New disposable path
  `C:\Users\aacha\AppData\Local\Temp\codex-staged-deploy-39a56d3-20260729-02`
  did not exist and had no prior registration. The detached worktree was exact and
  tracked-clean with staged/untracked `0/0`, no `node_modules`, no Source/config/
  environment modification, and only the verified three-property ignored
  `.vercel/project.json`.
- Exactly one authorized deploy invocation ran through the exact Node/CLI paths
  from `2026-07-29T05:25:52.1750386Z` to
  `2026-07-29T05:27:34.9923756Z`, duration `102.817` seconds, exit `0`. It created
  artifact `dpl_7g4Kt6VrZKrzugttUCNrqVDa2nDM` at unique URL
  `https://new-athlete-badminton-school-3i6af9gtj-aachanin1s-projects.vercel.app`.
  Deployment metadata is exact SHA
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, ref `HEAD`, local exact tree
  `bc436dac861c8a5748b150efdb6c49f84881201d`, target/state/substate
  `production/READY/STAGED`, source `cli`, Node `24.x`, region `icn1`,
  `autoAssignCustomDomains=false`, and alias count `0`. Creation/building/Ready
  timestamps were `2026-07-29T05:25:59.339Z`,
  `2026-07-29T05:26:00.227Z`, and `2026-07-29T05:27:34.751Z`.
- Remote build ran in `cle1` with Vercel CLI `56.5.0` and Next.js `16.2.6`.
  `npm ci`, optimized compile, TypeScript, build traces, and output deployment
  completed; static generation passed `91/91`. Bounded read-only `inspect --logs`
  covered `163` lines and found build error lines `0`. The existing broad Node
  engine warning and remote npm audit notice `7 vulnerabilities` (`1 low`,
  `6 high`) did not fail the build; no install/update or dependency/lockfile write
  occurred locally, and this gate did not attempt remediation.
- Postflight inventory remained a bounded `100` items with ID-set SHA-256
  `48B6A74DE8D1C53BEEA2160BDDEDFBAA6EEF8217522825CCD4AEECEE45DCC8C4`.
  Added ID was exactly `dpl_7g4Kt6VrZKrzugttUCNrqVDa2nDM`; former oldest ID
  `dpl_2Ptn416TvF5zKt1cGUoHxXCWXZsK` left only because the 100-item pagination
  window advanced. Exact-SHA counts became Preview `1` and Production-target
  READY/STAGED `1`; no retry/rebuild artifact was created.
- Alias inventory remained `8/8`. All four Production aliases still point to
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; all four branch Preview mappings, including
  `dpl_ZKyt3Qj28EoVjN9Rph3jEHfq4fgZ`, remained unchanged. New-artifact custom/
  Production alias count was `0`; missing/extra/wrong mappings were `0/0/0`.
- Deploy invocation and deploy-process/authorized-control-plane-command counts were
  `1/1/1`. Retry/force/redeploy/rebuild/rollback counts were `0/0/0/0/0`.
  Promotion/alias/manual-API mutation counts were `0/0/0`. Application, staged
  smoke, runtime-event generation, Supabase, Production application/data request,
  Production UAT, Controlled Write, and data-repair counts were all `0`/Not run.
- The retry worktree remained exact and tracked-clean after Deploy, with no local
  `node_modules` or tracked diff. Validated normal `git worktree remove` succeeded;
  the path no longer exists and registration is `0`. The separate residual
  Junction at
  `C:\Users\aacha\AppData\Local\Temp\codex-release-readiness-7286748-audit\node_modules`
  remained untouched and still targets the repository `node_modules`.

Final safety matrix at this retry closeout: Source Complete **Yes**; retained
Fresh Release Readiness **Accepted with Known Local Environment Limitation**;
Tests **Passed retained / not rerun**; Committed/Pushed **Yes** through exact HEAD,
but current documentation **No/No**; Deployed **Yes — READY/STAGED artifact only**;
Promoted **No**; Feature/Allowlist change **No/No**; Production Active **No**;
Production UAT and Controlled Write UAT **Not run**; Data Repaired **No**;
Production Data Changed **No**; Customer Impact **None**; Financial/Payroll Impact
**None**; Task Done **No**. Active Task remains **RESCHEDULE-IN EXACT COACH
ASSIGNMENT / LEGACY FALLBACK ISOLATION**. No artifact blocker remains; residual
risks are the Owner-accepted local root-smoke limitation and retained remote npm
audit notice. Next action is Owner/PM review before separately authorized staged
UAT, Promotion, documentation publication, or any Production action. No next gate
starts automatically.

### 2026-07-29 Authenticated Read-Only Staged UAT — Safety Hard Stop

State observed at this separately authorized staged-UAT gate on 2026-07-29:

- Owner authorized fresh Git/Vercel read-only preflight, existing-session
  authenticated GET/HEAD access to exact staged artifact
  `dpl_7g4Kt6VrZKrzugttUCNrqVDa2nDM`, Head Coach read-only pages, optional existing
  Admin-session pages, desktop/mobile and natural-row verification, bounded
  exact-artifact logs, control-plane postflight, and local-only documentation.
  Application mutation, direct Supabase/Production data access, fixture creation,
  Deploy/retry/rebuild, Promotion/alias movement, Source/Test/config/package/
  migration/environment changes, Commit, and Push remained prohibited.
- Fresh Git Gate 0 matched branch `spike/next-major-security-upgrade`, exact local/
  upstream/origin-tracking/live Remote HEAD
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, tree
  `bc436dac861c8a5748b150efdb6c49f84881201d`, parent
  `7286748824c06cffb3650c9897028f7e7015d722`, and ahead/behind `0/0`.
  Functional commit `54752bcc2a914b7d2f67f344c62e50f642f890ac`
  remained an ancestor with exact 16-file membership. Root staged/untracked were
  `0/0`; status contained exactly the three local documentation files plus
  protected `AGENTS.md` and `src/lib/schedule-slot-utils.ts`. Protected SHA-256
  values remained
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
  No Source/Test/package/lockfile/migration/schema/RLS/RPC/environment or
  `vercel.json` drift was found.
- The exact Node launcher
  `C:\Program Files\nodejs\node.exe` and cached Vercel entrypoint
  `C:\Users\aacha\AppData\Local\npm-cache\_npx\630ee44d7c586e3f\node_modules\vercel\dist\vc.js`
  reported CLI `56.5.0`. Project/team/region linkage remained
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp` /
  `team_gw8Y6CPd602WAKRsVFobPGCL` / `icn1`. Every manual Vercel API request used
  explicit `-X GET`; there was no form/body or mutation method.
- Control-plane preflight reconfirmed exact artifact SHA
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, target/state/substate
  `production/READY/STAGED`, source `cli`, configured region `icn1`,
  `autoAssignCustomDomains=false`, and alias count `0`. Creation/building/Ready
  timestamps remained `2026-07-29T05:25:59.339Z`,
  `2026-07-29T05:26:00.227Z`, and `2026-07-29T05:27:34.751Z`. Exact-SHA
  Production READY/STAGED count was `1`; allowed Preview
  `dpl_ZKyt3Qj28EoVjN9Rph3jEHfq4fgZ` remained `READY/STAGED` for the same SHA and
  retained its branch Preview mapping. There was no newer conflicting
  Production-target artifact.
- Alias inventory remained eight entries. All four established Production aliases
  still pointed to `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; missing/extra/wrong
  mappings were `0/0/0`. No deployment, rebuild, Promotion, alias, domain, or
  rollback command was run. Using the same canonicalization within this gate, the
  bounded 100-ID deployment inventory hash was unchanged before/after at
  `510777DF135260DF74BF9B42F61349B0BC1A9A6357F2BDB619FF1357A90C192C`; no
  newer conflicting Production-target artifact appeared.
- Source audit triggered the mandatory Hard Stop before browser access. Every Head
  Coach `/coach/*` page is wrapped by `src/app/(coach)/layout.tsx`. For role
  `head_coach`, that layout obtains a service-role client and awaits
  `createCoachCheckinWindowNotifications()` plus
  `createCoachAttendanceGapNotifications()` before rendering. Both use
  `deliverCoachNotificationOnce()`, which checks for an existing notification and
  inserts a missing row. A Head Coach page GET can therefore change Production
  business data even though the browser method itself is GET.
- This conflicts with the gate's required application mutation count `0` and
  no-data-change contract. The staged hostname was not opened. No Chrome tab,
  cookie, storage, credential, token, profile, or session state was inspected;
  existing authenticated role/session availability was not evaluated. Head Coach
  and Admin routes, desktop `1920x855`, mobile `390x844`, natural representative
  User Reschedule/Exact/Wallet/Makeup rows, console/network/hydration/overlay, and
  business-row behavior are **Not run / Not observable**. Application GET/HEAD/
  POST/PUT/PATCH/DELETE counts attributable to this gate were all `0`.
- A bounded read-only exact-artifact log query covered
  `2026-07-29T05:28:50.908Z` through `2026-07-29T05:58:50.906Z` with `--no-follow`.
  It returned events/error/fatal/4xx/5xx `0/0/0/0/0`; no runtime event was created
  by this gate.
- No Deploy/retry/rebuild/Promotion/alias mutation, direct Supabase access,
  Production application/data request, Controlled Write, fixture, or repair
  occurred. Production Data Changed **No**; Customer Impact **None**;
  Financial/Payroll Impact **None**. The staged artifact remained unpromoted and
  Production Active remained **No** for this fix.

Final safety matrix at this Hard Stop: Source Complete **Yes**; retained tests and
Release Readiness **Passed / not rerun; Accepted with Known Local Environment
Limitation**; Committed/Pushed **Yes** through exact HEAD, current documentation
**No/No**; Deployed **Yes — READY/STAGED artifact only**; Promoted **No**;
Feature/Allowlist change **No/No**; Staged UAT **BLOCKER / Not run**; Production
UAT and Controlled Write UAT **Not run**; Data Repaired **No**; Production Data
Changed **No**; Task Done **No**. Active Task remains **RESCHEDULE-IN EXACT COACH
ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Blocker: authenticated Head Coach GET
rendering may insert notifications and cannot meet a strictly read-only gate.
Next action is Owner/PM direction on a separately authorized bounded write-capable/
Controlled Write staged UAT, promotion without Head Coach staged application
proof, or separate Source work. Do not retry UAT, Promote, access Supabase/
Production, publish documentation, or start another gate automatically.

### 2026-07-29 Super Admin-Only Read-Only Staged UAT Retry — Pre-Browser Safety Hard Stop

State observed at this separately authorized read-only audit on 2026-07-29. Owner
authorized an authenticated staged-UAT retry only through an already-existing,
positively proven Super Admin session. Coach/Head Coach use, login/logout,
impersonation, role change, new credentials, direct Supabase access, application
mutation, Source/config change, Deploy/retry/rebuild, Promotion/alias movement,
Commit, and Push remained prohibited. The complete automatic request/imported call
path had to prove zero possible writes before Chrome or staged application access;
Head Coach role-specific UAT was explicitly accepted as Not run.

- Fresh Git Gate matched repository, branch `spike/next-major-security-upgrade`,
  exact HEAD `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, tree
  `bc436dac861c8a5748b150efdb6c49f84881201d`, parent
  `7286748824c06cffb3650c9897028f7e7015d722`, upstream/origin-tracking/live
  Remote, and ahead/behind `0/0`. Functional commit `54752bcc...` remained an
  ancestor with exact 16-file membership, missing/extra `0/0`. Staged/untracked
  were `0/0`; modified paths were exactly the three local documentation files plus
  the two protected pre-existing files. Protected SHA-256 values remained
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Exact approved Node/CLI paths reported Vercel CLI `56.5.0`; every manual API
  request used explicit `-X GET`. Preflight and postflight both confirmed artifact
  `dpl_7g4Kt6VrZKrzugttUCNrqVDa2nDM`, exact SHA `39a56d3...`,
  `production/READY/STAGED`, aliases `0`, and
  `autoAssignCustomDomains=false`. The 100-ID inventory hash remained
  `510777DF135260DF74BF9B42F61349B0BC1A9A6357F2BDB619FF1357A90C192C`;
  no newer conflicting Production-target artifact appeared. All four established
  Production aliases remained on `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4` with
  missing/extra/wrong `0/0/0`.
- The primary route trace first confirmed the intended Super Admin safeguard:
  `src/app/(coach)/layout.tsx` invokes Coach notification generators only when
  `profile.role` is `coach` or `head_coach`; `super_admin` does not enter that
  condition. Proxy/session handling and layout profile/unread-count operations are
  read/auth paths; no business-table mutation was found there for Super Admin.
- The `/coach/assign-groups` server page and imported assignment/memory/provenance
  helpers use SELECT-only data access. `AssignGroupsClient` imports no
  `useEffect`, performs no automatic fetch on mount/hydration/filter change, and
  contains one mutation request only inside explicit `saveSlot()`: POST
  `/api/coach/assignment-groups`, bound to the Save button. No Save or draft
  interaction would have been used.
- Complete automatic-request tracing found a separate unresolved write path in
  shared navigation. `CoachSidebar` renders a visible `/coach/notifications`
  Next.js `<Link>` without `prefetch={false}`. The installed Next.js `16.2.6`
  runtime sets `prefetchEnabled = prefetchProp !== false`, observes visible links,
  and schedules prefetch tasks. The destination
  `src/app/(coach)/coach/notifications/page.tsx` does not role-guard its hydration:
  for any authenticated `user.id` it creates a service-role client and awaits both
  Coach notification generators. Their shared delivery function can insert a
  missing `notifications` row. Whether the dynamic destination Server Component
  would execute during default partial/viewport prefetch could not be ruled out.
- This possible implicit write violated the mandatory zero-data-change gate. The
  entire UAT therefore stopped before browser connection. No existing tab/session
  was inspected, so Super Admin status was not evaluated; this was not a session-
  proof failure because the earlier call-path gate had already failed. The staged
  hostname and canonical Production aliases were never opened. Routes actually
  opened: none. Desktop/mobile, natural Pending User Reschedule, Exact precedence,
  Legacy fallback, Wallet/Makeup, console, hydration, overlay, and browser network
  evidence were **Not run / Not observable**.
- Application GET/HEAD/POST/PUT/PATCH/DELETE counts were all `0`; assignment Save,
  Attendance, Check-in, Makeup, Reschedule, and notification mutation counts were
  all `0`. Direct Supabase, Production application/data, fixture, and repair counts
  were `0`. A bounded exact-artifact log query from
  `2026-07-29T08:29:44.621Z` through `2026-07-29T08:49:44.619Z` returned
  events/error/fatal/4xx/5xx `0/0/0/0/0`.
- Deploy/retry/rebuild/rollback/Promotion/alias/manual-API mutation counts were all
  `0`. Source/Test/package/lockfile/migration/schema/RLS/RPC/environment/config
  changes were `0`. Production Data Changed **No**; Customer Impact **None**;
  Financial/Payroll Impact **None**. The first Head Coach read-only staged-UAT
  Hard Stop remains preserved immediately above as historical evidence.

Final safety matrix at this retry: classification **BLOCKER — POSSIBLE WRITE PATH
FOUND DURING PRE-BROWSER SOURCE AUDIT**. Source Complete **Yes**; retained tests
**Passed / not rerun**; existing Source Committed/Pushed **Yes/Yes**, current
documentation **No/No**. Deployed **Yes — READY/STAGED artifact only**; Promoted **No**;
Production Active **No**; Feature/Allowlist change **No/No**; Super Admin staged UAT **Not run**;
Head Coach role-specific staged UAT **Not run — Owner-accepted limitation**;
Production UAT and Controlled Write UAT **Not run**; Data Repaired **No**;
Production Data Changed **No**; Task Done **No**. Active Task remains
**RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Next action
is Owner/PM direction on separate Source work to remove the unsafe prefetch/write
path, a bounded write-capable/Controlled Write staged UAT, or another release
decision. Do not retry, Promote, mutate aliases, access Supabase/Production,
publish documentation, or start another gate automatically.

### Detailed Diagnostic Evidence — 2026-07-29 Exact-membership Request-size Diagnosis and Local Fix

Detailed evidence for the separately authorized Source Fix + Local Test gate whose
current closeout is appended after the two staged-UAT records below. Those two
physically later records predate this diagnostic and remain valid historical
evidence. Owner authorized read-only Vercel/Supabase/PostgREST diagnosis, one exact
SELECT reproduction if needed, bounded-query comparison, a narrow fix only after
request-size Root Cause proof, focused Local tests/build, and local-only current
documentation. Business-rule changes, migration/schema/grant/RLS/RPC, package/
lockfile/environment/Vercel configuration, browser/application UAT, Supabase data
mutation/repair, Commit, Push, Deploy/rebuild, Promotion/alias/rollback, Production
application access, and documentation publication remained prohibited.

- Fresh documentation/Git Gate 0 passed. Branch was
  `spike/next-major-security-upgrade`; local/upstream/origin/live Remote HEAD were
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, tree
  `bc436dac861c8a5748b150efdb6c49f84881201d`, parent
  `7286748824c06cffb3650c9897028f7e7015d722`, ahead/behind `0/0`. Functional
  ancestor `54752bcc2a914b7d2f67f344c62e50f642f890ac` retained exact 16-file
  membership, missing/extra `0/0`. Staged/untracked were `0/0`; the five expected
  pre-existing dirty paths and protected SHA-256 values were exact.
- Read-only Vercel preflight passed through exact Node/CLI paths. Artifact
  `dpl_7g4Kt6VrZKrzugttUCNrqVDa2nDM` remained exact SHA `39a56d3...`,
  `production/READY/STAGED`, `autoAssignCustomDomains=false`, aliases `0`, with no
  newer deployment. All four Production aliases remained on prior artifact
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`. Exact-window logs retained one attributable
  GET `/coach/assign-groups` runtime error with
  `CoachAssignmentDataUnavailableError`, context `Coach student history exact
  membership query failed: Bad Request`, and digest `233653541`.
- Supabase project/log access was read-only. The project was ACTIVE_HEALTHY.
  Management log retrieval returned no usable API/Postgres records: three bounded
  log-read attempts returned `INVALID_ARGUMENT / Failed to get project's logs`.
  The diagnostic therefore used the Owner-authorized SELECT reconstruction. No
  credential, token, raw session UUID, or PII was printed or recorded.
- Read-only catalog SELECT confirmed named FK
  `coach_assignment_groups_coach_id_fkey` is
  `FOREIGN KEY (coach_id) REFERENCES profiles(id) ON DELETE SET NULL`.
  `booking_sessions`, `coach_assignment_group_students`,
  `coach_assignment_groups`, `coach_branches`, and `profiles` were exposed with
  SELECT grants for the inspected API roles. RLS was enabled on all five tables;
  policy counts were respectively `4/2/2/2/5`. No grant, RLS, policy, schema,
  relationship, or cache reload command was run.
- Reconstructed staged characteristics contained two Head Coach candidates with
  identical seven-branch sets, 328 future assignment-page sessions, 117 unique
  learners (`105` child, `12` adult), and 1,048 returned historical sessions
  (`1,000` child due the configured Data API row cap plus `48` adult), all session
  IDs distinct. Counts only were retained; UUIDs/PII were not published.
- The exact full membership SELECT was executed once with the existing source
  columns and relationship. Its 1,048-ID encoded GET was 41,125 bytes and returned
  HTTP `400 Bad Request`, content type `text/plain; charset=utf-8`. Complete
  sanitized response fields were `code=null`, `message=Bad Request`,
  `details=null`, and `hint=null`; the supabase-js error fields matched exactly.
- The identical select/relation was then executed as 11 batches: ten batches of
  100 IDs and one of 48. Request lengths were 2,125–4,153 bytes; all 11 returned
  HTTP `200`, no batch error. Combined results were 1,041 rows / 1,041 distinct
  membership session IDs with deterministic set MD5
  `6071ed50a4986e3557ace397b45729ef`. Independent paginated SELECT of all 2,575
  membership rows in three pages filtered to the same 1,041 rows and exact hash.
  Therefore no target batch showed `PGRST200`, missing FK, stale relationship,
  permission/grant/RLS, missing table/column, or query-syntax failure.
- One auxiliary first pagination attempt—not a target exact-membership batch—used
  an incomplete diagnostic `select` while filtering the embedded `bookings`
  resource and returned `PGRST108`. The diagnostic query was corrected to include
  the relation; no Source change was made for that harness error. A SQL-only
  comparison was also not used as final equivalence evidence because the 1,000-row
  child-history boundary has nondeterministic same-date ties. The independent
  paginated membership baseline above supplied the conclusive count/hash proof.
- Root Cause is **confirmed oversized single PostgREST `.in()` request**. The full
  41,125-byte request failed before a structured PostgREST JSON error, while every
  otherwise identical bounded request succeeded and the combined result was
  complete. Relationship/schema/grant/RLS causes were ruled out by catalog and
  successful embedded-relation evidence.
- Local functional changes were exactly two files. In
  `src/lib/coach-student-memory.ts`, a fixed
  `COACH_STUDENT_HISTORY_EXACT_MEMBERSHIP_BATCH_SIZE = 100` applies only to the
  history exact-membership lookup; session IDs are deduplicated, successful batch
  rows are combined, and any error still throws
  `CoachAssignmentDataUnavailableError` with `batch N failed` context. No Legacy
  fallback, empty-data substitution, ordering/business-rule change, or unrelated
  query refactor was added. `scripts/check-coach-assignment-resolution.mjs` added
  four deterministic tests for one-query `<=100`, bounded multi-query `>100`, row
  completeness/deduplication, and failed-batch fail-closed context.
- Fresh verification passed: Coach assignment resolution `33/33`; Admin schedule
  assignment `38/38`; Lesson Wallet `17/17`; notification Bangkok date `26/26`;
  `npx tsc --noEmit`; ESLint `--max-warnings=0`; mojibake `250` files; Next.js
  `16.2.6` optimized compile and TypeScript; static generation `91/91`; `git diff
  --check`; cached diff check. Admin and Wallet deterministic scripts retained one
  `MODULE_TYPELESS_PACKAGE_JSON` warning each and exited `0`; no ESLint/build
  warning or error occurred. Port 3000 had no listener before build, so no existing
  dev server/browser session required restart handling.
- Supabase Data API request counts attributable to diagnostics/verification were
  SELECT `45`, mutation `0`; read-only SQL SELECT count was `4`, for total Supabase
  SELECT `49` and mutation `0`. The counts include the auxiliary `PGRST108`
  diagnostic attempt. Separate Supabase management reads were project inventory
  `1` and unsuccessful log reads `3`. The actual patched helper verification used
  1,048 IDs and produced exactly 11 GETs, all HTTP `200`, request lengths
  2,125–4,153 bytes, 1,041 rows, and the expected MD5; its mutation count was `0`.
- Migration/schema/grant/RLS/policy/RPC, package/lockfile/environment/config,
  feature/allowlist, and additional functional-file changes were `0`. Commit/Push,
  Deploy/redeploy/rebuild, Promotion/alias mutation, browser/staged/Production UAT,
  data repair, and Supabase mutation were all `0`/Not run. The existing staged
  artifact remains unchanged, unpromoted, and broken because it contains the
  unbatched Source.

Final matrix at this gate: classification **PASS — LOCAL SOURCE/TEST FIX ONLY**.
Source Complete **Yes — local only**; Tests Passed **Yes**; current fix
Committed/Pushed **No/No**; existing broken artifact Deployed **Yes — READY/STAGED
only**; current fix Deployed/Promoted **No/No**; Feature/Allowlist change **No/No**;
Production Active **No**; Production UAT **Not run**; prior Controlled Write staged
UAT **Failed / not retried**; Data Repaired **No**; Production Data Changed
**Unknown / Need verification from the prior reminder window, with `0` mutation in
this gate**; Customer Impact **no new runtime impact from the local fix; prior
possible reminder-only impact remains Unknown / Need verification**; Financial/
Payroll Impact **None**; Task Done **No**. Active Task remains **RESCHEDULE-IN
EXACT COACH ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Exact next action: Owner/PM
reviews the proven batching fix and fresh Local evidence, then separately decides
whether to authorize Commit/Push. No Commit, Push, Deploy, UAT retry, Promotion,
documentation publication, repair, or Parking Lot work starts automatically.

### 2026-07-29 Owner-Approved Bounded Head Coach Controlled-Write Staged UAT — Existing Session Hard Stop

State observed at this separately authorized staged-UAT gate on 2026-07-29. This
record does not replace the two prior Hard Stops above; they remain valid dated
historical evidence. Owner superseded only the prior Super Admin-only and strict
zero-data-change constraints. The new gate permitted an existing Head Coach Chrome
session and only natural `notifications` reminder INSERTs from
`createCoachCheckinWindowNotifications()`,
`createCoachAttendanceGapNotifications()`, and
`deliverCoachNotificationOnce()` during initial Coach-layout/page rendering. The
approved fingerprints were title `ถึงเวลาเช็คอินรอบสอน` with link
`/coach/checkin`, or title `ยังเช็คชื่อนักเรียนไม่ครบ` with natural
`/coach/attendance?date=<date>&slot=<slot-id>`. Save, assignment POST, Check-in,
Attendance, Makeup, Reschedule, Wallet, notification read/delete, every other
mutation, Source/config change, Commit, Push, Deploy/rebuild, Promotion, alias
mutation, Direct Supabase access, Production UAT, and data repair remained
prohibited.

- Fresh documentation/Git Gate 0 passed. Active Task remained exact. Branch was
  `spike/next-major-security-upgrade`; local/upstream/origin-tracking/live Remote
  HEAD were `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, tree
  `bc436dac861c8a5748b150efdb6c49f84881201d`, parent
  `7286748824c06cffb3650c9897028f7e7015d722`, ahead/behind `0/0`. Functional
  ancestor `54752bcc2a914b7d2f67f344c62e50f642f890ac` retained exact 16-file
  membership, missing/extra `0/0`. Staged/untracked were `0/0`; status contained
  only the three local documentation files and the two protected pre-existing
  paths. Protected SHA-256 values matched exactly.
- Read-only Vercel preflight passed through exact `node.exe` and cached CLI
  `56.5.0`. Project/team matched. Artifact
  `dpl_7g4Kt6VrZKrzugttUCNrqVDa2nDM` matched exact SHA `39a56d3...`, URL,
  `production/READY/STAGED`, `autoAssignCustomDomains=false`, and aliases `0`.
  The bounded 100-ID inventory hash was
  `510777DF135260DF74BF9B42F61349B0BC1A9A6357F2BDB619FF1357A90C192C`, newer
  deployment count `0`, and all four Production aliases pointed to prior artifact
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`.
- Fresh Source call-path audit passed the authorized mutation boundary. Head Coach
  renders through the Coach layout, which calls exactly the two allowed generators.
  Their only write is `deliverCoachNotificationOnce()` inserting one missing
  `notifications` row with type `reminder` and the approved title/link values.
  `/coach/assign-groups` and its server helpers are SELECT-only.
  `AssignGroupsClient` has no `useEffect` or automatic fetch; its only assignment
  POST is inside `saveSlot()` behind the explicit Save button. Shared navigation
  can prefetch `/coach/notifications`, but that destination invokes only the same
  allowed generators and no additional automatic mutation path was found.
- Observation began at `2026-07-29T09:41:00.251Z`. A new tab in the existing Chrome
  state opened the exact staged `/coach/assign-groups` URL directly once at
  `1920x855`. It redirected within the exact staged hostname to
  `/auth/login?redirect=%2Fcoach%2Fassign-groups`. Visible state was the New Athlete
  login form, not Head Coach application identity. This triggered the mandatory
  **BLOCKER — EXISTING HEAD COACH SESSION CANNOT BE PROVEN**. No login, account or
  role switch, credential/storage/cookie inspection, reload, retry, sidebar/menu
  click, form/control change, Save, or second application navigation occurred.
- Head Coach assignment-page access, branch scope, desktop business rendering,
  mobile `390x844`, natural Pending User Reschedule isolation, Exact-membership
  precedence, genuine Legacy fallback, Wallet preservation, and Makeup
  preservation were **Not observable**. The blocked login page produced browser
  console/hydration/overlay errors `0/0/0`.
- The bounded exact-artifact runtime window from
  `2026-07-29T09:41:00.251Z` through `2026-07-29T09:42:23.021Z` contained eight
  application GETs: `/coach/assign-groups` `307`, `/auth/login` `200`, and six
  automatic `/auth/register` prefetch requests `200`. HEAD was `0`;
  POST/PUT/PATCH/DELETE were `0/0/0/0`; assignment POST/Save, Check-in,
  Attendance, Makeup, Reschedule, Wallet, and notification read/delete mutations
  were all `0`. Runtime error/fatal/4xx/5xx counts were `0/0/0/0`.
- Because authentication redirected before the Coach layout rendered, allowed
  notification-generator invocation evidence was `0` and notification delta was
  `0` from available Source/browser/runtime evidence. Non-notification mutation
  count was `0`. Direct Supabase/API/SQL/MCP access was not used. Production Data
  Changed **No**; Customer Impact **None**; Financial/Payroll Impact **None**;
  Data Repaired **No**.
- Read-only Vercel and Git postflight passed. Artifact identity/state/aliases,
  100-ID deployment inventory hash, four Production aliases, branch/HEAD/tree/
  parent/live Remote, protected hashes, and staged/untracked `0/0` were unchanged.
  No Source/Test/package/lockfile/API/config/environment/migration/schema/RLS/RPC
  change, Commit, Push, Deploy/redeploy/rebuild, Promotion, alias/domain mutation,
  rollback, Production UAT, or data repair occurred.

Final safety matrix at this gate: Source Complete **Yes**; retained tests **Passed /
not rerun**; existing Source Committed/Pushed **Yes/Yes**, current documentation
**No/No**; Deployed **Yes — READY/STAGED artifact only**; Promoted **No**; Feature/
Allowlist change **No/No**; Controlled Write staged UAT **Blocked before business-
page render**; Production Active **No**; Production UAT **Not run**; Data Repaired
**No**; Production Data Changed **No**; Customer Impact **None**; Financial/
Payroll Impact **None**; Task Done **No**. Active Task remains **RESCHEDULE-IN EXACT
COACH ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Exact next action: Owner/PM
establishes an existing Head Coach Chrome session for the exact staged hostname
outside this gate, then separately authorizes a fresh bounded staged-UAT retry.
Do not login, retry, modify Source, Promote, access Supabase/Production, publish
documentation, or start another gate automatically.

### 2026-07-29 Owner-Approved Existing Head Coach Staged-UAT Retry — Exact-route Runtime Hard Stop

State observed at this separately authorized retry on 2026-07-29. This record
preserves and does not overwrite the earlier Head Coach zero-write, Super Admin
prefetch, and unauthenticated-session Hard Stops. Owner confirmed that an existing
Head Coach staged session was ready and authorized one bounded retry on the same
artifact. Only natural reminder INSERTs with the previously approved check-in or
attendance-gap fingerprints were permitted; every other mutation, Source/config
change, Commit, Push, Deploy/rebuild, Promotion, alias mutation, Direct Supabase
access, Production UAT, and data repair remained prohibited.

- Fresh documentation/Git Gate 0 passed. Branch was
  `spike/next-major-security-upgrade`; local/upstream/origin/live Remote HEAD were
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, tree
  `bc436dac861c8a5748b150efdb6c49f84881201d`, parent
  `7286748824c06cffb3650c9897028f7e7015d722`, ahead/behind `0/0`. Functional
  ancestor `54752bcc2a914b7d2f67f344c62e50f642f890ac` retained exact 16-file
  membership with missing/extra `0/0`. Staged/untracked were `0/0`; the five
  expected dirty paths and both protected SHA-256 values were unchanged.
- Read-only Vercel preflight through exact `node.exe` and cached CLI `56.5.0`
  passed. Artifact `dpl_7g4Kt6VrZKrzugttUCNrqVDa2nDM` matched exact SHA
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, exact URL,
  `production/READY/STAGED`, `autoAssignCustomDomains=false`, and aliases `0`.
  The 100-item inventory contained no newer deployment. All four Production
  aliases remained on prior artifact `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`.
- Fresh Source call-path audit again passed the bounded mutation boundary. The
  shared Coach layout calls the two approved generators; their only write is
  `deliverCoachNotificationOnce()` inserting a missing `notifications` reminder
  with an approved title/link. Assignment page/helper queries are read-only;
  `AssignGroupsClient` has no mount mutation and its assignment POST remains
  behind the explicit Save button.
- Existing visible Chrome state at the exact staged `/coach` route proved the
  authenticated identity as `โค้ช Super Head Coach(หัวหน้า)`, exposed the Head
  Coach-only `แบ่งกลุ่มนักเรียน` menu, and showed unread badge `99+` before the
  observation window. No cookie, storage, credential, login, logout, or account/
  role-switch inspection or action occurred.
- Observation ran from `2026-07-29T10:05:55.383Z` through
  `2026-07-29T10:06:19.196Z`. The same staged tab was set to desktop `1920x855`
  and navigated directly to the exact `/coach/assign-groups` URL once. It stayed
  on the exact hostname but showed `This page couldn’t load — A server error
  occurred`, digest `233653541`, before business content rendered. The mandatory
  runtime-error Hard Stop ended the gate without reload/retry, mobile `390x844`
  resize, sidebar/menu click, passive business scroll, form/control change, Save,
  or any second application navigation.
- Exact-artifact runtime evidence identified
  `CoachAssignmentDataUnavailableError: Coach student history exact membership
  query failed: Bad Request` on GET `/coach/assign-groups`; HTTP response status
  was `200`, but Server Component rendering failed. The bounded window contained
  GET/HEAD `9/0`; POST/PUT/PATCH/DELETE `0/0/0/0`; assignment POST/Save,
  Check-in, Attendance, Makeup, Reschedule, Wallet, and notification read/delete
  mutations `0`. Browser attributable Server Component error was `1`, hydration
  error `0`, visible error page/overlay `1`; runtime error/fatal/4xx/5xx counts
  were `1/0/0/0`.
- Head Coach identity proof **Passed**. Exact staged route business rendering and
  desktop rendering **Failed**. Mobile rendering, branch scope, natural-row
  availability, Pending User Reschedule isolation, Exact-membership precedence,
  genuine Legacy fallback, Wallet preservation, and Makeup preservation were
  **Not observable** due the Hard Stop. No fixture or direct data access was used.
- Source proves only the two approved automatic notification paths are possible,
  but available browser/runtime evidence did not expose generator invocation or
  notification-row delta. The pre-window badge was saturated at `99+` and could
  not provide a numeric delta. Allowed notification invocation/delta,
  Production Data Changed, and Customer Impact are therefore **Unknown / Need
  verification** without prohibited Direct Supabase access. Non-notification
  mutation count was `0`; Data Repaired **No**; Financial/Payroll Impact **None**.
- Read-only Vercel/Git postflight passed. Artifact identity/state/aliases, absence
  of newer deployments, all four Production aliases, branch/HEAD/tree/parent,
  ahead/behind, protected hashes, expected dirty paths, and staged/untracked
  `0/0` remained unchanged. Source/Test/package/lockfile/API/config/environment/
  migration/schema/RLS/RPC changes were `0`; Commit/Push, Deploy/redeploy/rebuild,
  Promotion/alias mutation, Production UAT, and Direct Supabase access were all
  `0`/Not run.

Final safety matrix at this retry: classification **BLOCKER — EXACT STAGED
ASSIGNMENT PAGE SERVER COMPONENT FAILED**. Source Complete **Yes**; retained tests
**Passed / not rerun**; existing Source Committed/Pushed **Yes/Yes**, current
documentation **No/No**; Deployed **Yes — READY/STAGED artifact only**; Promoted
**No**; Feature/Allowlist change **No/No**; Controlled Write staged UAT **Failed /
Hard Stopped before business content**; Production Active **No**; Production UAT
**Not run**; Data Repaired **No**; Production Data Changed **Unknown / Need
verification**; Customer Impact **Unknown / Need verification for possible natural
Head Coach reminders only**; Financial/Payroll Impact **None**; Task Done **No**.
Active Task remains **RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY FALLBACK
ISOLATION**. Exact next action: Owner/PM reviews digest `233653541` and the exact-
membership query `Bad Request`, then separately authorizes any diagnostic/
remediation gate. Do not retry, modify Source, Promote, access Supabase/Production,
publish documentation, or start another gate automatically.

### 2026-07-29 Owner-Approved Exact-membership Request-size Diagnosis and Local Fix — Current Closeout

State observed at the current closeout. The full sanitized diagnostic, counts,
catalog evidence, exact two-file patch, verification totals, and Supabase request
accounting are recorded in **Detailed Diagnostic Evidence — 2026-07-29 Exact-
membership Request-size Diagnosis and Local Fix** above. The intervening staged-
UAT records are older preserved history and do not override this closeout.

Root Cause is confirmed as the 41,125-byte, 1,048-ID single PostgREST `.in()`
request. Eleven identical-relation batches at no more than 100 IDs all returned
HTTP `200`; their 1,041-row deterministic hash matched independent pagination.
The local two-file fix deduplicates and batches only this lookup while remaining
fail-closed with batch context. Fresh Local verification passed assignment
`33/33`, Admin `38/38`, Wallet `17/17`, notification `26/26`, TypeScript,
zero-warning ESLint, mojibake `250`, build, and static generation `91/91`.

Current classification is **PASS — LOCAL SOURCE/TEST FIX ONLY**. Source Complete
**Yes — local only**; Tests Passed **Yes**; current fix Committed/Pushed **No/No**;
existing broken artifact Deployed **Yes — READY/STAGED only**; current fix
Deployed/Promoted **No/No**; Feature/Allowlist change **No/No**; Production Active
**No**; Production UAT **Not run**; prior Controlled Write staged UAT **Failed /
not retried**; Data Repaired **No**; Production Data Changed **Unknown / Need
verification from the prior reminder window, with `0` mutation in this gate**;
Customer Impact **no new runtime impact; prior possible reminder-only impact
remains Unknown / Need verification**; Financial/Payroll Impact **None**; Task
Done **No**. Active Task remains **RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY
FALLBACK ISOLATION**. Exact next action: Owner/PM reviews the local batching fix
and separately decides whether to authorize Commit/Push. No later gate starts
automatically.

### 2026-07-29 Owner-Approved Membership-query Fix Commit + Push — Current Publication Closeout

State observed for the current publication gate. Owner authorized exactly one
functional Source/Test commit, one documentation publication commit, and one
normal non-force push on existing branch
`spike/next-major-security-upgrade`. Deploy/rebuild, Promotion/alias movement,
staged-UAT retry, Supabase/Vercel/browser access, PR/tag/release creation, and
every other file remained prohibited.

- Read-only `git fetch origin` completed without remote movement. Preflight local,
  upstream, origin-tracking, and live Remote were all
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, tree
  `bc436dac861c8a5748b150efdb6c49f84881201d`, parent
  `7286748824c06cffb3650c9897028f7e7015d722`, ahead/behind `0/0`. Functional
  ancestor `54752bcc2a914b7d2f67f344c62e50f642f890ac` retained exact 16-file
  membership, missing/extra `0/0`. Staged/untracked were `0/0`; the exact seven
  expected modified paths and both protected hashes matched.
- Fresh verification passed before staging: Coach assignment `33/33`; Admin
  assignment `38/38`; Lesson Wallet `17/17`; notification Bangkok date `26/26`;
  TypeScript; ESLint with zero warnings; mojibake `250`; Next.js `16.2.6` build;
  static generation `91/91`; and diff checks. The Admin and Wallet deterministic
  scripts retained one `MODULE_TYPELESS_PACKAGE_JSON` warning each; both exited
  `0`. Build warnings/errors were `0/0`. Port 3000 had no listener before build.
- Functional commit `8166d669165e1dc51e71897423c7aeab524d9050`, tree
  `3529036eab4e90e6b0ad68af8fe3fcbca67b80c5`, parent
  `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`, subject
  `fix(coach): batch student history memberships`, contains exactly
  `scripts/check-coach-assignment-resolution.mjs` and
  `src/lib/coach-student-memory.ts`; missing/extra `0/0`.
- The following documentation publication commit contains exactly
  `PROJECT_STATE.md`, `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`. Its own
  content-derived SHA/tree, parent order, single-push result, and verified
  local/upstream/origin/live-Remote equality are reported in the final handoff;
  its subject is `docs: record membership query fix`.
- The two protected pre-existing dirty files remain excluded from both commits.
  Package/lockfile, migration/schema/grant/RLS/policy/RPC, environment/config,
  business rules, and additional Source/Test files changed `0`. Supabase, Vercel,
  and browser access/mutation counts in this publication gate were all `0`.

Final published classification is **PASS — SOURCE/TEST + DOCUMENTATION COMMITTED
AND PUSHED; NOT DEPLOYED**. Source Complete **Yes**; Tests Passed **Yes**;
Committed/Pushed **Yes/Yes** after verified push; current fix Deployed/Promoted
**No/No**; existing broken artifact remains unchanged `READY/STAGED` and
unpromoted; Feature/Allowlist change **No/No**; Production Active **No**;
Production UAT **Not run**; prior Controlled Write staged UAT **Failed / not
retried**; Data Repaired **No**; Production Data Changed **Unknown / Need
verification from the prior reminder window, with no data access or mutation in
this gate**; Customer Impact **no new runtime impact; prior possible reminder-only
impact remains Unknown / Need verification**; Financial/Payroll Impact **None**;
Task Done **No**. Active Task remains **RESCHEDULE-IN EXACT COACH ASSIGNMENT /
LEGACY FALLBACK ISOLATION**. Exact next action: Owner separately decides whether
to authorize a new staged deployment. No later gate starts automatically.

### 2026-07-29 Owner-Approved Exact-HEAD Staged Deploy — Pre-Deploy Gate Script Hard Stop

State observed at this staged-Deploy gate. Owner authorized at most one new
Production-target artifact from exact HEAD
`7b7dd912d46b28d4ca299c9221f53abe4c67d075`, tree
`b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e`, using only the pinned Node/Vercel
CLI `56.5.0` entrypoint with `deploy --prod --skip-domain`. Exact-SHA Preview
artifacts were permitted; a pre-existing exact-SHA Production `READY/STAGED`
artifact, any Gate/build mismatch, or any need to retry required a Hard Stop.
Promotion, alias/domain mutation, Source/config/package/environment change,
Commit, Push, browser/application access, staged UAT, Supabase/Production data
access, and every data mutation remained prohibited.

- Mandatory documents and the latest task history were read. Fresh Git evidence
  matched branch `spike/next-major-security-upgrade`, local HEAD/tree/parent
  `7b7dd912d46b28d4ca299c9221f53abe4c67d075` /
  `b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e` /
  `8166d669165e1dc51e71897423c7aeab524d9050`. Functional commit
  `8166d669...` was an ancestor. Local/upstream/origin-tracking/fresh live Remote
  were equal. Git's raw ahead/behind output was literal tab-delimited `0\t0`,
  which normalizes to `0/0`. Root staged/untracked counts were `0/0`; status had
  only the two protected paths. Protected SHA-256 values remained
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- `.vercel/project.json` matched project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, and name
  `new-athlete-badminton-school`. `vercel.json` retained framework `nextjs`,
  install `npm ci`, build `npm run build`, and functions region `icn1`. Pinned
  launcher files existed; CLI was `56.5.0`, local Node was `v24.16.0`, and the
  Vercel project reported Node `24.x` and framework `nextjs`.
- Explicit-GET preflight returned a bounded 100-deployment inventory with maximum
  created time `1785332518781`. Exact-SHA count was one allowed Preview:
  `dpl_o3jCUwo95Mt8hHSQm3Wrx7QPnbbx`, `READY/STAGED`, URL
  `https://new-athlete-badminton-school-7xlv2rfz6-aachanin1s-projects.vercel.app`.
  Exact-SHA Production `READY/STAGED` count was `0`, and Production-target
  artifacts newer than old staged artifact `dpl_7g4Kt6...` were `0`.
- Preflight alias inventory contained eight mappings. The four Production aliases
  all targeted `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; the branch mappings targeted
  `dpl_2T8K7Ser4wGk2jRchEw7gxDshkZq`,
  `dpl_7uqAnvUVsNk5XNs4UBeZ9pQ6cy8u`,
  `dpl_Cnu2A6W7uhLqVKcJp9QpnHwzpTjr`, and exact-SHA Preview
  `dpl_o3jCUwo95Mt8hHSQm3Wrx7QPnbbx`. The attempted preflight ID-set hash did not
  complete because this Windows PowerShell/.NET runtime lacks the selected static
  `SHA256.HashData` and `Convert.ToHexString` helpers. The control-plane evidence
  itself remained readable and no mutation occurred.
- A unique detached disposable worktree was created at
  `C:\Users\aacha\AppData\Local\Temp\codex-staged-deploy-7b7dd912-20260729-210901589`.
  It matched exact HEAD/tree, staged/untracked/status `0/0/clean`, excluded both
  root protected modifications, and contained only the verified three-property
  ignored `.vercel/project.json` linkage.
- The final immediate Gate 0 process exited `1` before reaching the deploy line.
  Its equality expression compared Git's literal tab-delimited ahead/behind value
  `0\t0` with the space-delimited string `0 0`. Read-only diagnosis immediately
  proved branch, HEAD, tree, parent, upstream, origin-tracking, live Remote, and
  normalized ahead/behind all matched. Owner's explicit no-retry rule nevertheless
  required the gate to stop. The pinned deploy command was not invoked.
- Deploy invocation/process/authorized-control-plane-command counts were `0/0/0`;
  deploy exit, deployment ID/URL/SHA/target/state/substate, created/building/Ready
  timestamps, remote install/compile/TypeScript/static generation, build region,
  and build error count are all **Not applicable — no new artifact exists**.
  Retry/force/redeploy/rebuild/rollback counts were `0/0/0/0/0`; Promotion,
  separate alias mutation, and manual API mutation counts were `0/0/0`.
- Explicit-GET postflight retained deployment count `100`, maximum created time
  `1785332518781`, exact-SHA Preview count `1`, and exact-SHA Production count
  `0`. Its sorted ID-set SHA-256 was
  `0DDB90A44E80ADA7C8CB171BD391A3E1D4BB9ABF5656FF98B39C84278365A189`.
  Because the failed preflight hash routine did not retain the original ID set,
  exact added/removed ID-set comparison is **Unknown / Need verification**;
  however no deployment was invoked and postflight contained no record newer than
  the observed preflight maximum.
- Postflight alias count/hash were `8` /
  `BEC3771B0B721090AA765678B701EC66187FD1A7C33E866E241CD08EAA919644`.
  The eight name-to-deployment mappings matched the preflight snapshot exactly:
  all four Production aliases and all four branch Preview mappings were unchanged.
  The older artifact `dpl_7g4Kt6VrZKrzugttUCNrqVDa2nDM` remains the only
  Production-target staged artifact for this task, contains SHA `39a56d3...`, and
  remains broken/unpromoted with zero aliases. No artifact contains the current
  request-size fix.
- The disposable worktree remained exact and tracked-clean. Its absolute path and
  one worktree registration were validated before normal `git worktree remove`.
  Removal succeeded; the path no longer exists and registration count is `0`.
  The separate protected residual Junction under
  `codex-release-readiness-7286748-audit` was not touched.
- Source/Test/config/package/lockfile/environment/migration/schema/grant/RLS/RPC
  changes were `0`. Application, browser, staged UAT, Supabase, Production
  application/data requests, and data mutations were `0`. Current documentation
  changed locally in only `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`; it was not staged, committed, or pushed.

Final classification is **BLOCKER — PRE-DEPLOY GATE SCRIPT EXITED BEFORE DEPLOY
INVOCATION; NO RETRY PER OWNER RULE**. Source Complete **Yes**; retained Tests
Passed **Yes**; Committed/Pushed **Yes/Yes for the published Source, No/No for
current local documents**; current fix Deployed/Promoted **No/No**; older broken
artifact remains `READY/STAGED`; Feature/Allowlist change **No/No**; Production
Active **No**; Staged UAT **Not run in this gate**; prior Controlled Write staged
UAT **Failed / not retried**; Production UAT **Not run**; Data Repaired **No**;
Production Data Changed **No in this gate**; Customer Impact **None from this
gate; prior reminder-only uncertainty remains Unknown / Need verification**;
Financial/Payroll Impact **None**; Task Done **No**. Active Task remains
**RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Exact next
action: Owner/PM reviews this pre-deploy Gate-script Hard Stop and separately
decides whether to authorize a fresh staged-deployment attempt. No Deploy retry,
staged UAT, Promotion, repair, or Parking Lot work starts automatically.

### 2026-07-29 Fresh Exact-HEAD Staged Deploy — Remote Builder CLI Acceptance Blocker

State observed at this fresh Owner-authorized staged-deployment attempt. Owner
authorized exact HEAD `7b7dd912d46b28d4ca299c9221f53abe4c67d075`, tree
`b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e`, allowed correction/rerun of only
ephemeral validation helpers for formatting/tooling errors before deploy-process
launch, and allowed at most one pinned Vercel CLI `deploy --prod --skip-domain`
process. After launch, retry/force/rebuild/redeploy/rollback were prohibited.
Promotion, alias/domain mutation, browser/application access, staged UAT,
Supabase/Production data access, Source/Test/config/package/environment change,
Commit, and Push remained prohibited. Remote build acceptance explicitly required
Vercel CLI `56.5.0`.

- Phase A was isolated from the deploy command. Helper correction/run/rerun counts
  were `1/1/0`: raw whitespace comparison was replaced with numeric parsing of the
  two ahead/behind values, and compatible instance SHA-256 APIs replaced unsupported
  static .NET APIs. No repository file was changed by the helper.
- Fresh Git evidence passed: branch
  `spike/next-major-security-upgrade`, HEAD/tree/parent
  `7b7dd912d46b28d4ca299c9221f53abe4c67d075` /
  `b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e` /
  `8166d669165e1dc51e71897423c7aeab524d9050`; functional commit
  `8166d669...` was an ancestor. Local/upstream/origin-tracking/fresh live Remote
  were equal and ahead/behind parsed as numeric `0/0`. Root modified files were
  exactly the expected five; staged/untracked were `0/0`.
- Protected hashes remained exact: `AGENTS.md`
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `src/lib/schedule-slot-utils.ts`
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
  Root `.vercel/project.json`, project/team/name, `vercel.json` Next.js/install/
  build/`icn1` configuration, pinned Node/CLI files, CLI `56.5.0`, project Node
  `24.x`, and framework `nextjs` all matched.
- Explicit-GET preflight contained 100 sorted deployment IDs, ID-set SHA-256
  `0DDB90A44E80ADA7C8CB171BD391A3E1D4BB9ABF5656FF98B39C84278365A189`, and
  maximum creation time `1785332518781`. Exact-SHA Preview count was `1`, allowed
  artifact `dpl_o3jCUwo95Mt8hHSQm3Wrx7QPnbbx`; exact-SHA Production
  `READY/STAGED` and newer conflicting Production counts were `0/0`.
- Preflight alias count/hash were `8` /
  `BEC3771B0B721090AA765678B701EC66187FD1A7C33E866E241CD08EAA919644`.
  All four Production aliases targeted
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; branch mappings targeted
  `dpl_2T8K7Ser4wGk2jRchEw7gxDshkZq`,
  `dpl_7uqAnvUVsNk5XNs4UBeZ9pQ6cy8u`,
  `dpl_Cnu2A6W7uhLqVKcJp9QpnHwzpTjr`, and exact-SHA Preview
  `dpl_o3jCUwo95Mt8hHSQm3Wrx7QPnbbx`.
- The actual sorted ID list and alias mappings were persisted before Deploy at
  `C:\Users\aacha\AppData\Local\Temp\codex-staged-deploy-7b7dd912-evidence-20260729-212417541.json`.
  JSON count/order/content hashes validated, and file SHA-256 was
  `A6BED672F5E0D4145AE252C222161DDD6B4F2E75FF330D57668EC93BC20D5A2F`.
- A unique detached worktree at
  `C:\Users\aacha\AppData\Local\Temp\codex-staged-deploy-7b7dd912-20260729-212609734`
  matched exact HEAD/tree, status/staged/untracked `clean/0/0`, excluded all root
  dirty changes, and contained only the verified three-property ignored
  `.vercel/project.json` linkage.
- Exactly one pinned deployment process launched at
  `2026-07-29T14:27:07.8449093Z` and ended at
  `2026-07-29T14:28:49.0788429Z`, duration `101.234` seconds, exit `0`.
  Deploy invocation/process/authorized-control-plane-command counts were
  `1/1/1`. Retry/force/redeploy/rebuild/rollback counts were `0/0/0/0/0`;
  Promotion/separate alias/manual API mutation counts were `0/0/0`.
- The command created `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`, unique URL
  `https://new-athlete-badminton-school-7zqvx0cel-aachanin1s-projects.vercel.app`.
  Explicit GET proved exact Git SHA, local tree, target/state/substate
  `production/READY/STAGED`, `autoAssignCustomDomains=false`, and artifact aliases
  `0`. Created/building/Ready timestamps were
  `2026-07-29T14:27:14.964Z`, `2026-07-29T14:27:16.669Z`, and
  `2026-07-29T14:28:48.948Z`.
- Remote build in `cle1` passed `npm ci`, Next.js `16.2.6` compile, TypeScript,
  static generation `91/91`, trace/output completion, and build-error count `0`.
  Project runtime remained Node `24.x`; functions region remained `icn1`. The
  remote install retained the prior audit notice `7 vulnerabilities` (`1 low`,
  `6 high`) and broad Node engine warning; no dependency changed.
- The pinned local invocation and read-only inspection CLI were `56.5.0`, but the
  exact timestamped remote build log says
  `2026-07-29T14:27:18.102Z Vercel CLI 58.1.0`. This violates the explicit remote
  build CLI `56.5.0` acceptance criterion. The artifact otherwise passed every
  identity/state/build/alias condition, but the gate classification is therefore
  **BLOCKER**, and no staged UAT or further release action was started.
- The first postflight helper stopped read-only inspection because PowerShell
  converted the CLI stderr banner to `NativeCommandError` under
  `ErrorActionPreference=Stop`. The first corrected parser completed but matched
  only the untimestamped local `56.5.0` banner and missed the timestamped remote
  `58.1.0` line. A second read-only parser correction separated both sources.
  Postflight helper correction/rerun counts were `2/2`; neither rerun invoked
  Deploy or any mutation.
- Postflight deployment count/hash/max-created were `100` /
  `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C` /
  `1785335234964`. Added ID was exactly the new artifact; removed ID was only the
  former bounded-window oldest `dpl_4sJBJPvPJTumPNYWywcTqSC4pvUw`. Exactly one
  deployment was newer than preflight, and exact-SHA Production `READY/STAGED`
  count changed from `0` to `1`.
- Postflight alias count/hash remained `8` /
  `BEC3771B0B721090AA765678B701EC66187FD1A7C33E866E241CD08EAA919644`.
  All four Production aliases and all four branch Preview mappings were byte-for-
  byte equivalent to the preflight evidence. No alias/domain was attached to the
  new artifact.
- The disposable worktree remained exact and tracked-clean. Its absolute path and
  one registration were validated before normal `git worktree remove`; the path
  no longer exists and registration is `0`. The validated evidence file remains
  in Temp. The protected residual Junction under
  `codex-release-readiness-7286748-audit` was not touched.
- Source/Test/config/package/lockfile/environment/migration/schema/grant/RLS/RPC
  changes were `0`. Application/browser/staged-UAT/Supabase/Production-data
  request and mutation counts were `0`. Current documentation changed locally in
  only `PROJECT_STATE.md`, `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`; stage,
  Commit, and Push counts were `0/0/0`.

Final classification is **BLOCKER — NEW EXACT-HEAD ARTIFACT IS READY/STAGED, BUT
REMOTE BUILDER CLI `58.1.0` FAILS REQUIRED `56.5.0`; NOT PROMOTED**. Source
Complete **Yes**; functional/build Tests Passed **Yes**, full release acceptance
**No**; published Source Committed/Pushed **Yes/Yes**, current local documents
**No/No**; Deployed **Yes — staged artifact only**; Promoted **No**; Feature/
Allowlist change **No/No**; Production Active **No**; Staged UAT **Not run**;
Production UAT **Not run**; Controlled Write UAT **Not run for the new artifact**;
Data Repaired **No**; Production Data Changed **No**; Customer Impact **None**;
Financial/Payroll Impact **None**; Task Done **No**. Active Task remains
**RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Exact next
action: Owner/PM reviews remote builder CLI `58.1.0` versus required `56.5.0` and
separately decides whether the artifact may proceed or a new remediation/release
gate is required. Do not retry Deploy, run staged UAT, Promote, change aliases,
repair data, or start Parking Lot work automatically.

### 2026-07-29 Owner-Accepted CLI Exception + Bounded Head Coach Staged UAT — Session Gate Blocker

State observed at this bounded staged-UAT gate. Owner accepted remote builder CLI
`58.1.0` as an exception only for exact artifact
`dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`; local deployment/inspection CLI remained
`56.5.0`. Owner authorized use of an existing Head Coach Chrome session and only
the natural reminder INSERTs produced by
`createCoachCheckinWindowNotifications()` or
`createCoachAttendanceGapNotifications()` through
`deliverCoachNotificationOnce()`. Login/re-authentication, Save, assignment POST,
every other mutation, reload/retry, Direct Supabase, Deploy/rebuild, Promotion,
alias change, Source/config change, Commit, and Push remained prohibited.

- Fresh Git evidence matched branch `spike/next-major-security-upgrade`, exact
  HEAD/tree/parent `7b7dd912d46b28d4ca299c9221f53abe4c67d075` /
  `b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e` /
  `8166d669165e1dc51e71897423c7aeab524d9050`. Upstream, origin-tracking, and
  fresh live Remote were equal; ahead/behind was numeric `0/0`; staged/untracked
  were `0/0`; root status contained exactly the five expected modified paths.
  Protected hashes remained exact.
- Source audit proved the shared Coach layout invokes only the two approved
  generators for `coach/head_coach`. Both call `notifyCoachOnce()` and then
  `deliverCoachNotificationOnce()`; the only automatic write is its deduplicated
  `notifications.insert` with the approved reminder title/type/link. The
  assignment server page and `getCoachStudentMemoryMap()` are SELECT-only.
  `AssignGroupsClient` has no mount effect; its only assignment POST is inside
  `saveSlot()`, which is called only by the explicit Save button.
- Explicit-GET artifact preflight matched exact ID/URL/SHA,
  `production/READY/STAGED`, `autoAssignCustomDomains=false`, and aliases `0`.
  The bounded 100-ID inventory hash was
  `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C`, maximum
  creation time `1785335234964`, and newest ID was the target artifact. Alias
  count/hash were `8` /
  `8ECD70644E1E8BB70E7137804BBA482CEC9DA9FA78C8E48014AFCA607EE23D30`.
  All four Production aliases targeted
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; all four branch Preview mappings were
  unchanged. No newer or replacement deployment existed.
- Chrome used the existing browser profile; no new profile or login was created.
  The exact staged `/coach/assign-groups` route was launched once at desktop
  `1920x855` at `2026-07-29T14:50:44.489Z`. It initially displayed
  `/auth/login?redirect=%2Fcoach%2Fassign-groups`, so visible Head Coach role/menu
  proof was unavailable and the required Hard Stop triggered. No login, reload,
  route retry, Save, drag/drop, group/coach change, notification-page access,
  mobile resize, business-page render, or natural-row inspection occurred. During
  subsequent read-only evidence collection the tab automatically moved to
  `/coach`; the assignment route was not reopened and UAT did not resume.
- Route-open count was `1`. Desktop business rendering, mobile `390x844`, branch
  scope, Pending User Reschedule isolation, Exact-membership precedence, genuine
  Legacy fallback, Wallet preservation, and Makeup preservation are **Not run / Not
  observable — session Hard Stop before business page**. Digest `233653541` was
  not shown in the observed login state, but no business-page digest conclusion is
  claimed. Visible application error overlay/page was `0`; browser console
  warnings/errors were `0`. Server Component and hydration results for the target
  business page are **Not run / Unknown**.
- Bounded artifact logs for `2026-07-29T14:50:44.489Z` through
  `2026-07-29T14:51:22.502Z` returned repeated pagination rows; deduplication by log
  ID produced 50 unique log IDs and 49 canonical request groups. Request methods
  GET/HEAD/POST/PUT/PATCH/DELETE were `49/0/0/0/0/0`; one canonical
  `GET /coach/assign-groups` returned `200`; assignment Save POST and all forbidden
  methods were `0`. All canonical statuses were `200`; fatal/error/4xx/5xx were
  `0/0/0/0`. No non-notification mutation was observed.
- Notification delta is **Unknown / Need verification — Direct Supabase
  prohibited**. Any possible data change is limited to the Owner-approved natural
  reminder INSERT path; there is no evidence of a forbidden mutation. Direct
  Supabase/API/SQL/MCP data inspection and data repair counts were `0`.
- Read-only postflight preserved artifact identity/state/substate/zero aliases,
  the 100-ID inventory count/hash/max-created/newest ID, the eight-alias mapping
  hash, all four Production aliases, and all four branch Preview mappings exactly.
  Added/removed deployment IDs were `0/0`. Deploy/rebuild/redeploy/rollback/retry,
  Promotion, separate alias mutation, Source/Test/config/package/environment,
  Commit, and Push counts were all `0` in this UAT gate.
- Current documentation changed locally only in `PROJECT_STATE.md`,
  `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`; it remained unstaged, uncommitted,
  and unpushed. Protected files were not edited.

Final classification is **BLOCKER — EXISTING HEAD COACH ROLE/SESSION COULD NOT BE
PROVED AFTER INITIAL LOGIN REDIRECT; BUSINESS/MOBILE UAT NOT RUN**. Source Complete
**Yes**; retained functional/build Tests Passed **Yes**, staged UAT **No**;
published Source Committed/Pushed **Yes/Yes**, current documents **No/No**;
Deployed **Yes — READY/STAGED only**; Promoted **No**; Production Active **No**;
Production UAT **Not run**; Controlled Write UAT **BLOCKER / not completed**; Data
Repaired **No**; Production Data Changed **Unknown / Need verification — Direct
Supabase prohibited**; Customer Impact **no Production-active impact; possible
staged reminder-only impact Unknown / Need verification**; Financial/Payroll
Impact **None**; Task Done **No**. Active Task remains **RESCHEDULE-IN EXACT COACH
ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Exact next action: Owner re-establishes
or independently confirms an existing staged Head Coach session, then separately
authorizes a fresh bounded UAT attempt on the same artifact. No login, retry,
Promotion, repair, or next gate starts automatically.

### 2026-07-29 Owner-Confirmed Session Retry — Partial Bounded Head Coach Staged UAT

State observed at this bounded staged-UAT retry closeout. Owner confirmed that an
existing authenticated Head Coach session was ready on the exact staged hostname
and authorized one assignment-route navigation on existing artifact
`dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`. The artifact-specific remote builder CLI
`58.1.0` exception remained accepted; local deployment/inspection CLI remained
`56.5.0`. Login/re-authentication, reload/retry, Save, assignment POST, every
non-notification mutation, Direct Supabase, Deploy/rebuild, Promotion, alias
change, Source/config change, Commit, and Push remained prohibited.

- Fresh Git evidence matched branch `spike/next-major-security-upgrade`, exact
  HEAD/tree/parent `7b7dd912d46b28d4ca299c9221f53abe4c67d075` /
  `b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e` /
  `8166d669165e1dc51e71897423c7aeab524d9050`. Upstream, origin-tracking, and
  fresh live Remote were equal; ahead/behind was numeric `0/0`; staged/untracked
  were `0/0`; root status contained exactly the five expected modified paths.
  Protected hashes remained exact.
- Fresh Source audit reconfirmed that the assignment page and imported data
  helpers are SELECT-only. `AssignGroupsClient` has no mount mutation; its only
  assignment POST is inside `saveSlot()` and is reachable only from the explicit
  Save button. The shared Coach layout invokes only the two Owner-approved natural
  reminder generators for `coach/head_coach`; their deduplicated INSERT path is
  `deliverCoachNotificationOnce()`. No other automatic write path was found.
- Read-only artifact preflight matched exact ID/URL/SHA,
  `production/READY/STAGED`, `autoAssignCustomDomains=false`, and aliases `0`.
  The bounded deployment count/hash/max-created/newest ID were `100` /
  `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C` /
  `1785335234964` / `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`. Alias count/hash were
  `8` / `8ECD70644E1E8BB70E7137804BBA482CEC9DA9FA78C8E48014AFCA607EE23D30`.
  All four Production aliases targeted
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; all four branch Preview mappings were
  unchanged. No newer or replacement deployment existed.
- Chrome attached to the Owner's already-open exact-host `/coach` tab. Before any
  navigation or viewport change, visible proof showed exact staged hostname,
  `โค้ช Super Head Coach(หัวหน้า)`, the Head Coach-only
  `แบ่งกลุ่มนักเรียน` menu, and unread badge baseline `99+`. No new tab/profile,
  login, logout, re-authentication, or notification-page access occurred.
- Browser capture began at `2026-07-29T15:07:02.492Z`. The same tab navigated to
  exact `/coach/assign-groups` once. Route-open/reload/retry counts were `1/0/0`.
  Desktop `1920x855` rendered the real assignment page with 27 selectable coaches,
  334 learners, 14 visible rounds for the selected day, assignment groups, learner
  rows, branch labels, and Save controls. No control was clicked or changed.
- Desktop had no `This page couldn't load`, digest `233653541`,
  `CoachAssignmentDataUnavailableError`, Next error portal, document/main
  horizontal overflow, console error, hydration error, or visible error overlay.
  Branch-scoped cards rendered for the visible Head Coach multi-branch scope.
- Natural Exact-membership precedence was observable: the selected business slot
  explicitly labelled its Legacy coach as `ยังไม่ใช่ผู้รับผิดชอบกลุ่ม` while
  Exact groups and their assigned coaches remained authoritative. Pending User
  Reschedule isolation, genuine Legacy-only fallback, Wallet preservation, and
  Makeup preservation were **Not observable — no natural representative row**.
  Prohibited test-data creation and Direct Supabase inspection were not used to
  manufacture coverage.
- The same tab resized to mobile `390x844` without navigation or reload. Assignment
  cards, labels, counts, branches, groups, learners, and disabled historical-slot
  controls remained readable. Document/body/main client and scroll widths were
  all `375/375`; clipped text elements were `0`; responsive crash, hydration
  error, overlay, and horizontal overflow were `0`. The viewport override was
  reset and the Owner's authenticated tab was left open with its session intact.
  Browser evidence ended at `2026-07-29T15:09:55.576Z`.
- Bounded exact-artifact logs contained `26` unique log IDs and `25` canonical
  requests. GET/HEAD/POST/PUT/PATCH/DELETE were `25/0/0/0/0/0`; all canonical
  responses were HTTP `200`. `/api/coach/assignment-groups` POST, Save clicks,
  Check-in/Attendance/Makeup/Reschedule/Wallet mutations, and non-notification
  mutations were all `0`. Runtime fatal/error/4xx/5xx were `0/0/0/0`; captured
  browser console and visible Server Component/hydration/error counts were all
  `0`.
- Notification delta is **Unknown / Need verification — Direct Supabase
  prohibited**. Any possible staged data change is limited to the two approved
  natural reminder INSERT paths; no forbidden mutation was observed. Direct
  Supabase/API/SQL/MCP data inspection and data repair counts were `0`.
- Read-only postflight preserved exact artifact ID/SHA/target/state/zero aliases,
  the bounded `100`-ID inventory count/hash/max-created/newest ID, and all eight
  Production/Preview alias mappings. Added/removed deployment IDs were `0/0`.
  Deploy/rebuild/redeploy/rollback/retry, Promotion, separate alias mutation,
  Source/Test/config/package/environment, Commit, and Push counts were all `0` in
  this UAT retry.
- Current documentation changed locally only in `PROJECT_STATE.md`,
  `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`; it remained unstaged, uncommitted,
  and unpushed. Protected files were not edited.

Final classification is **PARTIAL — PAGE RENDER AND SAFETY PASSED; SOME BUSINESS
CASES NOT OBSERVABLE**. Source Complete **Yes**; retained functional/build Tests
Passed **Yes**, staged page-render/safety UAT **Yes**, business-case coverage
**Partial**; published Source Committed/Pushed **Yes/Yes**, current documents
**No/No**; Deployed **Yes — READY/STAGED only**; Promoted **No**; Production Active
**No**; Production UAT **Not run**; Controlled Write UAT **Partial**; Data Repaired
**No**; Production Data Changed **Unknown / Need verification — Direct Supabase
prohibited**; Customer Impact **no Production-active impact; possible staged
reminder-only impact Unknown / Need verification**; Financial/Payroll Impact
**None**; Task Done **No**. Active Task remains **RESCHEDULE-IN EXACT COACH
ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Exact next action: Owner reviews the
partial evidence and separately decides whether to accept the unobservable
natural-row cases or authorize a future observation gate. No Deploy, Promotion,
Production access, test-data creation, repair, residual-Junction cleanup, or next
gate starts automatically.

### 2026-07-29 Owner-Accepted Partial Staged UAT + Exact Artifact Promotion

State observed at this Promotion closeout. Owner accepted the Partial bounded Head
Coach staged-UAT result because Pending User Reschedule, genuine Legacy-only
fallback, Wallet, and Makeup retain deterministic regression coverage. Owner then
authorized exactly one pinned `vercel promote` command for exact artifact
`dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`, including only the control-plane alias writes
inside that command. Deploy/rebuild/redeploy/retry/rollback, separate alias/domain
mutation, Source/config change, Commit/Push, Production application/browser UAT,
Supabase/data access, feature/allowlist change, and repair remained prohibited.

- Fresh Git Gate 0 matched branch `spike/next-major-security-upgrade`, exact
  HEAD/tree/parent `7b7dd912d46b28d4ca299c9221f53abe4c67d075` /
  `b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e` /
  `8166d669165e1dc51e71897423c7aeab524d9050`. Upstream, origin-tracking, and
  fresh live Remote were equal; ahead/behind was numeric `0/0`; staged/untracked
  were `0/0`; root status contained exactly the five expected modified paths.
  Protected hashes remained exact.
- Project linkage remained exactly project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`, team
  `team_gw8Y6CPd602WAKRsVFobPGCL`, name
  `new-athlete-badminton-school`, with only those three linkage properties.
  `vercel.json` retained Next.js, `npm ci`, `npm run build`, and functions region
  `icn1`. Pinned Node/CLI files existed and reported Node `24.16.0` and local
  Vercel CLI `56.5.0`. Owner's remote-builder CLI `58.1.0` artifact-specific
  exception remained accepted.
- Explicit GET preflight proved exact artifact ID/URL/SHA, target/state/substate
  `production/READY/STAGED`, aliases `0`,
  `autoAssignCustomDomains=false`, and unchanged created/building/Ready timestamps
  `2026-07-29T14:27:14.964Z`, `2026-07-29T14:27:16.669Z`, and
  `2026-07-29T14:28:48.948Z`. Its retained build remained `READY`; prior remote
  install/compile/TypeScript/static generation `91/91` evidence remained accepted.
- Bounded preflight deployment count/hash/max-created were `100` /
  `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C` /
  `1785335234964`. The target was newest and present; newer conflicting Production
  artifacts were `0`.
- Preflight alias count and canonical `alias|deploymentId` hash were `8` /
  `BEC3771B0B721090AA765678B701EC66187FD1A7C33E866E241CD08EAA919644`.
  Production aliases `www.newathleteschool.com`,
  `new-athlete-badminton-school.vercel.app`,
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app` all
  targeted `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`. The four branch Preview mappings
  targeted `dpl_2T8K7Ser4wGk2jRchEw7gxDshkZq`,
  `dpl_7uqAnvUVsNk5XNs4UBeZ9pQ6cy8u`,
  `dpl_Cnu2A6W7uhLqVKcJp9QpnHwzpTjr`, and
  `dpl_o3jCUwo95Mt8hHSQm3Wrx7QPnbbx` respectively. Preflight missing/wrong/extra
  mappings were `0/0/0`.
- Read-only helper parser corrections handled PowerShell native stderr, the Vercel
  deployment-list `uid` field, and wrapped documentation wording before Promotion.
  They changed no underlying evidence and launched no control-plane command.
  Promotion invocation remained separate and unused until every real gate passed.
- Exactly one pinned Promotion process launched at
  `2026-07-29T15:30:02.7083065Z` and ended at
  `2026-07-29T15:30:08.2740790Z`, duration `5.566` seconds, exit `0`.
  Promotion invocation/process/authorized-control-plane-command counts were
  `1/1/1`. No retry was attempted or permitted.
- Explicit GET postflight proved the same ID/URL/SHA is now
  `production/READY/PROMOTED`; created/building/Ready timestamps, retained build,
  and `autoAssignCustomDomains=false` are unchanged. No new deployment or build
  exists.
- Postflight deployment count/hash/max-created remained `100` /
  `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C` /
  `1785335234964`; added/removed IDs were `0/0`, and the target remained newest.
- Alias count remained `8`; postflight canonical hash became
  `C95897ED7724906A94437688EE2C858C1D4867F5F5E924E5FD4960F5D88C9D02`
  solely because all four established Production aliases now target
  `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`. Missing/extra/wrong Production mappings were
  `0/0/0`. All four branch Preview mappings remained unchanged. Previous artifact
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4` remains `READY` and is still listed as a
  rollback candidate; rollback count was `0`.
- Deploy/rebuild/redeploy/retry/rollback counts were `0/0/0/0/0`. Separate alias
  command/manual alias API mutation counts were `0/0`. Production application/
  browser requests, Supabase/API/SQL/MCP data requests, and data mutations were all
  `0` in this Promotion gate. Source/Test/config/package/lockfile/environment,
  migration/schema/grant/RLS/policy/RPC, feature/allowlist, Commit, and Push changes
  were all `0`.
- Production is now Active on the exact promoted fix. Production UAT and any
  Controlled Write Production UAT were not authorized or run. Production Data
  Changed remains **Unknown / Need verification** only because the prior staged
  natural-reminder allowance was not directly inspected; this Promotion gate made
  no application-data request or mutation. Financial/Payroll impact is None.
- Current documentation changed locally only in `PROJECT_STATE.md`,
  `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`; it remained unstaged, uncommitted,
  and unpushed. Protected files and the residual Junction were not touched.

Final classification is **PASS — EXACT ARTIFACT PROMOTED; ALL FOUR PRODUCTION
ALIASES MOVED; STOPPED FOR SEPARATE OWNER-APPROVED PRODUCTION UAT**. Source
Complete **Yes**; retained functional/build Tests Passed **Yes**; staged page-
render/safety UAT **Passed**, staged business-case coverage **Partial / Owner-
accepted**; published Source Committed/Pushed **Yes/Yes**, current documents
**No/No**; Deployed **Yes**; Promoted **Yes**; Feature/Allowlist change **No/No**;
Production Active **Yes**; Production UAT **Not run**; Controlled Write UAT
**Partial staged only / Production not run**; Data Repaired **No**; Production
Data Changed **Unknown / Need verification from prior staged reminder allowance,
no change in this Promotion gate**; Customer Impact **exact fix is now Production-
active, Production UAT pending**; Financial/Payroll Impact **None**; Task Done
**No**. Active Task remains **RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY
FALLBACK ISOLATION**. Exact next action: Owner separately authorizes bounded
Production UAT on exact promoted artifact
`dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`. No Production application request, Deploy,
Promotion retry, rollback, separate alias mutation, repair, residual-Junction
cleanup, or next gate starts automatically.

### 2026-07-29 Canonical Production Head Coach UAT — Runtime-Log Hard Stop

State observed at this bounded Production-UAT closeout. Owner confirmed an
existing authenticated Head Coach session on `https://www.newathleteschool.com`
and authorized one canonical assignment-route navigation against exact promoted
artifact `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`. Only natural reminder INSERTs from
`createCoachCheckinWindowNotifications()` or
`createCoachAttendanceGapNotifications()` through
`deliverCoachNotificationOnce()` were allowed. Login/re-authentication,
reload/retry, Save, assignment POST, any other mutation, direct Supabase/data
inspection, Deploy/rebuild/redeploy/rollback/Promotion, Source/config change,
Commit, and Push remained prohibited.

- Fresh Git evidence matched branch `spike/next-major-security-upgrade`, exact
  HEAD/tree/parent `7b7dd912d46b28d4ca299c9221f53abe4c67d075` /
  `b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e` /
  `8166d669165e1dc51e71897423c7aeab524d9050`. The functional commit was an
  ancestor. Upstream, origin-tracking, and fresh live Remote were equal;
  ahead/behind was numeric `0/0`; staged/untracked were `0/0`; root status
  contained exactly the five expected modified files. Protected file hashes were
  unchanged.
- Fresh exact-HEAD Source audit proved the Coach layout invokes only the two
  Owner-approved natural reminder generators for `coach/head_coach`, both through
  `deliverCoachNotificationOnce()`. The assignment page and imported data helpers
  are SELECT-only. `AssignGroupsClient` has no mount mutation; its sole assignment
  POST is inside `saveSlot()` and is reachable only from the explicit Save button.
  No other automatic write path was found before browser navigation. Deterministic
  regression evidence retained Exact precedence, User Reschedule isolation,
  genuine Legacy-only fallback, Wallet, Makeup, batching, and fail-closed coverage.
- Explicit GET preflight proved exact artifact ID/URL/SHA,
  `production/READY/PROMOTED`, `autoAssignCustomDomains=false`, and unchanged
  created/building/Ready timestamps `2026-07-29T14:27:14.964Z`,
  `2026-07-29T14:27:16.669Z`, and `2026-07-29T14:28:48.948Z`. Owner's exact-
  artifact remote-builder CLI `58.1.0` exception remained accepted; pinned local
  inspection CLI was `56.5.0` on Node `24.16.0`.
- Preflight deployment count/hash/max-created were `100` /
  `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C` /
  `1785335234964`; the target remained newest and no newer conflicting Production
  artifact existed. Alias count/hash were `8` /
  `C95897ED7724906A94437688EE2C858C1D4867F5F5E924E5FD4960F5D88C9D02`.
  All four established Production aliases targeted the exact artifact, and the
  four branch Preview mappings remained unchanged.
- Chrome claimed the Owner's existing canonical `/coach` tab without creating a
  new tab/profile. Before navigation or viewport change, visible proof showed
  exact `www.newathleteschool.com`, `โค้ช Super Head Coach(หัวหน้า)`, the Head
  Coach-only `แบ่งกลุ่มนักเรียน` menu, and unread badge baseline `99+`. No login,
  logout, re-authentication, cookie/local-storage/password/session-file inspection,
  or notification-page access occurred.
- Browser evidence began at `2026-07-29T15:50:15.407Z`. The exact canonical
  `/coach/assign-groups` route opened once; route-open/reload/retry counts were
  `1/0/0`. Desktop `1920x855` rendered the real assignment page with 27 selectable
  coaches, 334 learners, 14 visible selected-day rounds, assignment groups,
  learner rows, multiple branch cards, and Save controls. Codex clicked or changed
  no assignment control; Save-click count was `0`.
- Desktop had no `This page couldn't load`, digest `233653541`,
  `CoachAssignmentDataUnavailableError`, Next error portal, document/body
  horizontal overflow, console error, hydration error, Server Component error, or
  visible error overlay. Natural Exact-membership precedence was observable: a
  Legacy coach was explicitly labelled `ยังไม่ใช่ผู้รับผิดชอบกลุ่ม` while the
  Exact group and assigned coach remained authoritative.
- Pending User Reschedule, genuine Legacy fallback, Wallet, and Makeup were **Not
  observable — Owner-accepted deterministic regression coverage**. No data or UI
  state was created to manufacture representative rows.
- The same tab resized to mobile `390x844` without reload. The heading, metrics,
  date/filter controls, labels, cards, and assignment content remained readable;
  document/body client and scroll widths were all `375/375`, clipped visible-text
  elements were `0`, and responsive crash/hydration/overlay/overflow counts were
  `0`. The viewport override was reset, the Owner tab/session was left intact, and
  browser evidence ended at `2026-07-29T15:52:53.953Z`.
- The bounded exact-artifact/canonical-domain runtime log gate failed. After log-ID
  and exact-content deduplication, `37` unique/canonical records remained.
  GET/HEAD/POST/PUT/PATCH/DELETE were `30/0/7/0/0/0`; all seven POST records were
  `/api/coach/assignment-groups`. HTTP `200/500` were `34/3`; the seven assignment
  POST records were four `200` and three `500`. Log-level fatal/error were `0/0`,
  HTTP 4xx was `0`, and HTTP 5xx was `3`. The POST initiator and row-level effects
  cannot be established inside the authorized scope. Under the mandatory Safety
  Gate, their presence triggered an immediate Hard Stop despite zero Codex Save
  clicks and zero UI-control changes. No route reload or retry followed.
- Notification delta is **Unknown / Need verification — Direct Supabase
  prohibited**. Production Data Changed and customer/data impact are also
  **Unknown / Need verification** because four assignment POST log records returned
  `200`; no direct data inspection or repair was authorized. Financial/Payroll
  impact remains None; no payment, booking entitlement, wallet, coupon, finance,
  attendance, payroll, or accounting action was performed by Codex.
- Explicit GET postflight preserved exact artifact ID/URL/SHA,
  `production/READY/PROMOTED`, timestamps, retained build, deployment count/hash/
  max-created `100` /
  `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C` /
  `1785335234964`, alias count/hash `8` /
  `C95897ED7724906A94437688EE2C858C1D4867F5F5E924E5FD4960F5D88C9D02`, all four
  Production mappings, and all four Preview mappings. Added/removed deployment
  IDs were `0/0`. Deploy/rebuild/redeploy/retry/rollback/Promotion/separate-alias/
  manual-control-plane-mutation counts were all `0` in this UAT gate.
- Source/Test/config/package/lockfile/environment, migration/schema/grant/RLS/
  policy/RPC, feature/allowlist, Commit, and Push changes were all `0`. Current
  documentation changed locally only in `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`; it remained unstaged, uncommitted, and unpushed. Protected
  dirty files and the residual Junction were not touched.

Final classification is **BLOCKER — CANONICAL PAGE RENDER PASSED, BUT BOUNDED
RUNTIME LOGS CONTAINED FORBIDDEN ASSIGNMENT POST AND HTTP 500 EVIDENCE**. Source
Complete **Yes**; retained functional/build Tests Passed **Yes**; Production
desktop/mobile render **Passed**; Production runtime safety **Failed**; published
Source Committed/Pushed **Yes/Yes**, current documents **No/No**; Deployed **Yes**;
Promoted **Yes**; Production Active **Yes**; Production UAT **BLOCKER / not
passed**; Controlled Write UAT **BLOCKER**; Data Repaired **No**; Production Data
Changed **Unknown / Need verification — Direct Supabase prohibited**; Customer
Impact **Unknown / Need verification for the observed assignment POST window**;
Financial/Payroll Impact **None**; Task Done **No**. Active Task remains
**RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY FALLBACK ISOLATION**. Exact next
action: Owner reviews the bounded assignment POST/HTTP `500` evidence and
separately decides whether to authorize read-only diagnosis or a future bounded
Production UAT. No retry, direct data inspection, repair, Deploy, Promotion,
rollback, alias mutation, residual-Junction cleanup, or next task starts
automatically.

### 2026-07-29 Exact-Window Assignment POST Attribution — Other-User Traffic / Task Closeout

State observed at this read-only attribution closeout. After the canonical
Production Head Coach UAT page-render/safety checks passed but its runtime gate
Hard Stopped on seven assignment POST records, Owner authorized one urgent bounded
read-only diagnosis. The authorization allowed exact-window Vercel GET evidence and
Supabase SELECTs restricted to `activity_logs`, only the involved `profiles`, and
only-if-needed assignment groups. Browser/session access, UAT retry, request bodies,
Production writes/RPC, repair, Source/Test/config changes, Commit/Push, Deploy,
Promotion, rollback, alias mutation, and automatic Parking Lot work remained
prohibited.

- Fresh Git Gate 0 matched branch `spike/next-major-security-upgrade`, exact HEAD/
  tree/parent `7b7dd912d46b28d4ca299c9221f53abe4c67d075` /
  `b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e` /
  `8166d669165e1dc51e71897423c7aeab524d9050`; the functional commit remained an
  ancestor. Upstream, origin-tracking, and fresh live Remote were equal with numeric
  ahead/behind `0/0`. Root modified/staged/untracked were the expected five files /
  `0/0`; protected SHA-256 values were unchanged.
- Exact-HEAD Source re-audit reconfirmed that `AssignGroupsClient` has no mount
  effect or automatic mutation. `saveSlot()` remains the only client caller of
  `POST /api/coach/assignment-groups` and is reachable only through the explicit
  Save-button `onClick`. Successful API processing invokes
  `save_coach_assignment_groups_v1` and then attempts activity action
  `save_coach_assignment_groups`. Passive page render cannot produce the POST.
- Fresh pre/post Vercel GET evidence preserved artifact
  `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`, exact SHA, unique URL,
  `production/READY/PROMOTED`, `autoAssignCustomDomains=false`, and original
  created/building/Ready timestamps. Deployment count/hash/max-created remained
  `100` / `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C` /
  `1785335234964`; no newer Production artifact existed. Alias count/hash remained
  `8` / `C95897ED7724906A94437688EE2C858C1D4867F5F5E924E5FD4960F5D88C9D02`; all four
  Production aliases and four Preview mappings were unchanged.
- Exact-window Vercel structured evidence retained `37` distinct request IDs:
  GET/HEAD/POST/PUT/PATCH/DELETE `30/0/7/0/0/0`. The single UAT navigation and its
  RSC/prefetch cluster comprised `26` GET-only requests from
  `2026-07-29T15:50:16.200Z` through `2026-07-29T15:50:21.983Z`, with hashed user
  agent `6235D36597D64FC0` and composite fingerprint `30E6AF2FB89ADE62`.
- Every assignment POST belonged to the other fingerprint
  `F12B551451608526` with hashed user agent `0EEBAA9A4B1B8294`. That same client
  generated four assignment-page GETs following its save attempts. Both groups had
  no exposed Vercel session ID; Vercel exposed no client IP field. Sensitive values
  were hashed in PowerShell memory before comparison and were not printed, stored,
  or documented raw.
- Four HTTP `200` POSTs correlated one-for-one within their request durations with
  exact-window activity rows:
  - request `xtqgx-1785340285720-b3a71ec3b9f1`, `15:51:25.720Z`, duration
    `2,671 ms` -> activity `15:51:28.319Z`;
  - request `pjrjl-1785340306241-1c77c757e9bb`, `15:51:46.241Z`, duration
    `791 ms` -> activity `15:51:46.981Z`;
  - request `vwk98-1785340350003-d460b05374a7`, `15:52:30.003Z`, duration
    `1,529 ms` -> activity `15:52:31.430Z`;
  - request `vwk98-1785340357236-e762a570df6c`, `15:52:37.236Z`, duration
    `853 ms` -> activity `15:52:38.023Z`.
- Those four `save_coach_assignment_groups` rows used one sanitized actor hash
  `B2B9A3B9B9EF92B1`, role `head_coach`, and one in-memory IP hash
  `AEEADFF7FFB06C92`. The involved profile did not match the visible UAT identity
  `Super Head Coach`; raw actor/profile/IP values were not printed or documented.
  The activity entity hashes were `6F32A68A0653296C` twice,
  `8F2FAD1919E41F5B`, and `F631689721FA913B`; no assignment-group SELECT was needed.
- The three HTTP `500` requests—`9qht6-1785340321855-dd56903fa48d`,
  `hqgn6-1785340329553-2205c461f410`, and
  `fdddd-1785340339455-87abed3c0027`—shared the same external client fingerprint.
  They had no successful activity rows, trace ID, error code, crash marker, runtime
  diagnostic text, or request body exposure. Cause diagnosis was intentionally not
  attempted.
- The exact Supabase time window required no widening. Successful data-read
  responses were five bounded `activity_logs` SELECT GETs and one involved-profile
  SELECT GET; repeated activity reads only corrected local PowerShell date/array
  parsing and did not broaden the filter. Vercel produced ten successful GET data
  responses across identity/alias preflight, exact-window schema/fingerprint/error
  evidence, and postflight; two additional local CLI attempts against an unsupported
  log endpoint yielded no data. Raw PII exposure count was `0`.
- Browser/application requests were `0`. Supabase INSERT/UPDATE/DELETE/UPSERT/RPC
  were `0/0/0/0/0`; Source/Test/config changes, Commit/Push, Deploy/rebuild/redeploy/
  rollback/Promotion, alias mutation, and data repair counts were all `0`.
  Notification delta remains **Unknown / Need verification** because it was not
  inspected and no scope expansion was authorized.
- Only `PROJECT_STATE.md`, `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md` changed for
  closeout. They remain local-only, unstaged, uncommitted, and unpushed; protected
  files and the residual Junction were not touched.

Final classification is **PASS / OTHER USER TRAFFIC**. Source Complete **Yes**;
retained functional/build Tests Passed **Yes**; Deployed **Yes**; Production Active
**Yes**; Production UAT **Passed**; Controlled Write UAT **Passed within the Owner-
approved natural-notification limitation**; Data Repaired **No**. Production Data
Changed by Codex/UAT: **No assignment or non-notification mutation; possible natural
reminder remains Unknown / Need verification**. External-user Production activity:
**four ordinary successful assignment saves and three failed attempts observed**.
Customer Impact: exact fix is Production-active and UAT passed; cause/impact of the
three external HTTP `500` attempts was not diagnosed. Financial/Payroll Impact:
**None**. Documentation Drift: **No after local-only reconciliation**. Task Done:
**Yes**. Active Task: **NONE**. The three external HTTP `500` attempts are
**PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**. Exact next
action: await Owner selection; do not start Parking Lot work or another task
automatically.

### 2026-08-01 — Progressive Slip Upload Owner Test Cleanup and Exact-Artifact Production Closeout

State observed at this closeout: **TASK DONE**. Owner approved removal of only the
Production-backed `TEST System` / `น้อง Test` child
`4209ef39-21cd-494e-9e1f-507e3f0a92d1` and directly owned test dependencies,
followed by Promotion of the already Owner-tested exact artifact. Parent profile
and Auth account `e8a4b5c9-880d-4a43-b693-96cb0ce26316`, real learners,
shared/protected Coach and schedule data, all 70 activity logs, and the existing
informational `schedule_slots.current_students` cache state remained protected.
Owner explicitly authorized fresh resolution of target-only assignment UUIDs by
child ownership under lock and prohibited investigating the prior Coach Save.

#### Backup and Locked Cleanup Evidence

- The encrypted backup at
  `C:\Users\aacha\AppData\Local\CodexBackups\New-Athlete-Badminton-School\owner-test-cleanup-20260731T171012Z`
  passed DPAPI/AES-256-GCM restore verification, archive integrity verification,
  and exact Storage manifest verification `9/9`. Archive SHA-256 was
  `8bacc225c2cc2928f288f31a8da621b1efda18b43d2f7e4b9d4e11fcfb5ffd73`.
  Plaintext verification material was removed. A second DPAPI-wrapped encrypted
  snapshot captured the exact rows resolved under lock; no encryption key or
  Production credential was printed or stored in Git.
- Fresh bounded ownership audit returned child `1`, Parent profile/Auth `1/1`,
  bookings `14`, sessions `48`, payments `2`, scopes `2`, mutation receipts `21`,
  batches `18`, batch members `25`, verification attempts `3`, allocations `3`,
  target assignment memberships/groups `4/4`, notifications `7`, Storage objects
  `9`, and approved test Ledger `5 / ฿4,450`. Every target session belonged to the
  child; every assignment membership matched the target child/session; every
  deletable group had no other learner, Coach, or reservation.
- The controlled transaction locked all `45` distinct target schedule slots in
  ordered UUID sequence with bounded timeout, then locked and revalidated every
  target container and relationship. Slot-lock acquisition took `63.123 ms`, no
  timeout occurred, and no new target Group/Membership row appeared after lock.
  Current assignment Membership IDs were `89002a9e-c6b5-4f34-b2de-128a2b8dee43`,
  `b03d1ca7-ee18-488c-9fc6-c67f5b72e996`,
  `c625ea0d-21d8-43ce-8e45-8d8e3ad88f1e`, and
  `cd0624ad-4c52-4d43-b741-048c2c1dd171`. Current Group IDs were
  `1ae2261f-96e4-48de-9325-6c697273d315`,
  `6b64f79c-63cf-4c63-ad75-ab3e528bbae8`,
  `9c31787c-296d-4bde-9fa7-d8c19bc74989`, and
  `f49290e7-6cd0-4579-bf06-291f141a671d`. The superseded old UUIDs were absent.
- Exact committed DB deletes were: `children 1`, `bookings 14`,
  `booking_sessions 48`, `payments 2`, `booking_pricing_scopes 2`,
  `progressive_booking_mutation_receipts 21`,
  `progressive_payment_batches 18`,
  `progressive_payment_batch_bookings 25`,
  `progressive_payment_verification_attempts 3`,
  `progressive_payment_allocations 3`,
  `coach_assignment_group_students 4`, `coach_assignment_groups 4`, and
  `notifications 7`.
- While DB state was still guarded, the Supabase Storage API deleted exactly the
  six approved `payment-slips` paths and three approved
  `progressive-payment-slips` paths recorded in the backup manifest. Independent
  Storage API and metadata checks returned absent `9/9`. DB/Storage postconditions
  passed before DB commit; rollback and Storage compensation were not used.
- Protected fingerprint comparisons passed inside the transaction: target
  schedule slots, legacy Coach assignments, Coach check-ins, non-target sessions,
  protected group `7f464902-42ec-411d-a939-f0749e45ecd3`, and protected
  memberships `5301d3bf-21e3-4995-a2de-ae29adcba1fe` /
  `f91917b1-b1fe-471c-a2e9-6caa5c45e974` were unchanged. No shared schedule cache
  was edited or reconciled.

#### Independent Reconciliation and Financial Effect

- Independent post-commit and post-Promotion reads returned `0` for the target
  child, both target names, bookings, sessions, payments, pricing scopes, mutation
  receipts, batches, batch members, verification attempts, allocations,
  assignment memberships/groups, seven notifications, nine Storage objects,
  target Ledger rows/value, and payment-review rows.
- Parent profile/Auth remained `1/1`; Parent other children remained `0`; Parent
  notifications remained `13`; protected group/memberships remained `1/2`.
  The cleanup issued no write against `activity_logs`, shared slots, Coach
  assignments/check-ins, attendance, levels, achievements, coupons, wallet,
  expenses, payroll, or real customer records.
- Test Ledger derived reporting decreased by exactly `5` approved rows / `฿4,450`
  to `0 / ฿0`. This removed test reporting only. Customer Impact: **None**.
  Financial Impact: **no real cash movement, refund, credit, expense, coupon,
  wallet, attendance, or payroll effect**.

#### Exact-Artifact Promotion and Production Verification

- Owner Controlled Write UAT was **PASS** on exact staged artifact
  `dpl_2SCF7xZMovQ1SGkyqJrqf86Rmzne` at Source SHA
  `1cb6daa4c4186fae55d3312d6199c1a47ca4ffa4`. Fresh pre-Promotion metadata
  reconfirmed Production target, `READY/STAGED`, zero aliases, exact SHA, and no
  intervening Source/configuration change.
- Exactly one `vercel promote` invocation succeeded. Promotion/retry/rebuild/
  redeploy/separate-alias/rollback counts were `1/0/0/0/0/0`. Artifact created,
  building, and ready timestamps remained unchanged. All four established
  Production aliases moved to this exact artifact: `www.newathleteschool.com`,
  `new-athlete-badminton-school.vercel.app`,
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`. No new
  deployment was created.
- Canonical `/` and `/api/health` returned HTTP `200`; a real deployed
  `_next/static/*` CSS asset returned `200 text/css`; unauthenticated
  `/dashboard/history` preserved the expected `307` redirect to login. Bounded
  task-attributable Vercel error/fatal/5xx/database/storage failures were `0`.
  Authenticated read-only Coach, Children, History, Schedule, and Ranking checks
  after cleanup and the promoted public Ranking check contained neither target
  name. Independent Production DB reconciliation remained passed.
- Application Source/Test/Migration/Configuration changed `0/0/0/0`; Environment,
  feature controls, pricing, allowlists, and the booking system were unchanged.
  Only `PROJECT_STATE.md`, `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md` changed for
  this closeout. Pre-existing dirty `src/lib/schedule-slot-utils.ts` remained
  untouched and excluded. A documentation-push Automatic Preview, if created by
  Git integration, is not inspected, retried, promoted, or aliased.

Final classification: Source Complete **Yes**; Tests Passed **Yes**; Committed and
Pushed **Yes after the single normal documentation push**; Deployed **Yes**;
Feature Enabled **unchanged / Production-active**; Allowlisted **unchanged**;
Production Active **Yes**; Production UAT **Passed**; Controlled Write UAT
**PASS on the exact staged artifact/SHA**; Data Repaired **Yes**; Production Data
Changed **Yes, exact test data only**; Customer Impact **None**; Financial Impact
**test Ledger -5 rows / -฿4,450 only, no cash movement**; Task Done **Yes**;
Active Task **None**; Blocker **None**. Next action: await Owner selection; do not
start Parking Lot work automatically.

### 2026-08-02 — Mobile Payment Slip CTA Visibility and Scrollability — READY FOR OWNER UAT

State observed at this closeout: Owner approved a one-functional-file correction
to the shared User History Payment Dialog. The single existing
`ส่งสลิปชำระเงิน` action was to move next to the latest confirmed total, remain
visible and disabled before file selection, retain its existing eligibility,
loading, and duplicate-submit conditions, and remain reachable while the account,
file input, preview, errors, and status content scrolls. Progressive and Legacy
payment semantics, APIs, amounts, SlipOK behavior, and lifecycle transitions were
explicitly protected.

#### Root Cause and Scoped Implementation

- Rendered `360×640` evidence confirmed that the Radix dialog overlay locks the
  page body while the Payment Dialog itself had no dynamic-viewport height bound
  or scrolling region. Its CTA appeared after bank information, the file input,
  and a fixed `h-64` image preview, so the preview could push the action outside
  the mobile viewport.
- Progressive and Legacy both use the same Payment Dialog and the same
  `handleSubmitPayment` handler. The correction changed exactly
  `src/components/dashboard/history-client.tsx`: a `100dvh`-bounded dialog, pinned
  responsive amount/action region, and one `overflow-y-auto` content region were
  added. The original CTA and handler were moved; no second submit action or
  handler was introduced. Cancel and the Radix close control remain accessible.
- `tests/history-payment-regression/history-payment.spec.ts` gained coverage for
  the small mobile viewport, visible-disabled and file-enabled states, real
  overflow, preview/file reachability, persistent action position, single CTA,
  Legacy WebP selection, and desktop same-row layout. The existing valid
  image/JPG Test Mode transition, rapid single-flight submission, stale conflict,
  cancel failure, eligibility guard, and payment-lifecycle tests remained intact.
- Before the fix, the focused regression failed `1/1` because the action/scroll
  region did not exist; disposable residue was `0`. After the fix it passed
  `1/1`. The final full History payment E2E passed `10/10`, with failed/skipped/
  flaky/retry `0/0/0/0` and residue `0`.

#### Verification, Publication, and Staged Artifact

- `npx.cmd tsc --noEmit --incremental false`, zero-warning ESLint,
  `npm.cmd run check:mojibake` over `250` files, and `git diff --check` passed.
  Next.js `16.2.6` Production build passed compilation, TypeScript, and static
  generation `91/91`. After build, the exact repo `.next` directory was removed,
  the local dev server was restarted, and root/static asset checks returned
  `200/200`.
- Source/Test commit `1c43a160a15932844a7c9fcee5e1cf0d30792f60`
  (tree `f9d59376bebc7e337c4c19f7c00109e4c70f2046`) contains exactly the one
  functional file and one test file and was pushed normally to
  `spike/next-major-security-upgrade`.
- Exact staged artifact `dpl_8qh3E8rEfVbWFyArqc48qNJW8arG` is
  `production/READY/STAGED`, has zero aliases, and is tied by `gitCommitSha` to
  exact tested Source `1c43a160...`. Its URL is
  `https://new-athlete-badminton-school-397fiatpo-aachanin1s-projects.vercel.app`.
  The remote build passed compilation, TypeScript, and `91/91` pages. Staged root,
  health, and a real CSS asset returned `200`; unauthenticated History returned
  the expected `307`; bounded error/fatal/5xx logs were `0/0/0`.
- Production was not promoted. It remains on artifact
  `dpl_2SCF7xZMovQ1SGkyqJrqf86Rmzne`, Source
  `1cb6daa4c4186fae55d3312d6199c1a47ca4ffa4`, across the four established
  aliases. Owner PASS must identify the exact staged artifact/SHA, after which it
  may be promoted without rebuild and followed by automated Production checks.

#### Protected State and Next Gate

- Hard protected rule: slip upload is prohibited after a relevant teaching round
  starts. The existing Progressive server eligibility guard for attendance,
  wallet evidence, and Bangkok-time session start remains unchanged and was not
  bypassed. No API, Migration, RPC, configuration, Environment, feature control,
  allowlist, pricing, coupon, Ledger, Finance, accounting, booking/payment status,
  SlipOK, or Production-data change occurred.
- Functional/Test/Migration/Configuration counts are `1/1/0/0`. Production Data
  Changed: **No**. Data Repaired: **No**. Customer Impact: **no new Production
  impact; the prior Production UI remains active until Owner-approved Promotion**.
  Financial Impact: **None**. Owner UAT and Controlled Write UAT: **Not run**.
- The pre-existing dirty `src/lib/schedule-slot-utils.ts` was not edited, staged,
  reset, checked out, or included. Added-line secret/customer-data scan returned
  zero findings. The Owner-attached HTML script was not added to the repository.
- Documentation Drift: **No after the containing documentation-only closeout
  commit is published**. Task Done: **No**. Active Task remains **MOBILE PAYMENT
  SLIP CTA VISIBILITY AND SCROLLABILITY**. Next gate: Owner UAT on the exact staged
  URL as User/Parent; any Progressive UAT that would write payment-lifecycle data
  still requires an exact disposable target and separate controlled-write
  authorization.
- **PARKING LOT — LINE EXTERNAL-BROWSER HANDOFF AUDIT; OWNER SELECTION REQUIRED;
  NOT AUTHORIZED TO START.** No LINE detection, redirect, deep-link, browser
  handoff audit, or implementation was performed.

### 2026-08-02 — Mobile Payment Slip CTA Exact-Artifact Production Closeout — TASK DONE

State observed at this closeout: Owner UAT passed at viewport `430×932` on exact
artifact `dpl_8qh3E8rEfVbWFyArqc48qNJW8arG`, URL
`https://new-athlete-badminton-school-397fiatpo-aachanin1s-projects.vercel.app`,
and exact Application Source SHA
`1c43a160a15932844a7c9fcee5e1cf0d30792f60`. Owner confirmed that the CTA is
next to the latest confirmed amount, clearly visible, accepts a selected image and
shows its preview, and remains reachable while the Dialog content scrolls. This
PASS authorized Promotion only of that exact artifact without rebuild.

#### Fresh Gate 0 and Exact Promotion

- Repository, branch, Local/upstream/origin/live Remote HEAD, and ahead/behind
  passed at `558dcbb4f0824fbb9b3842a6ff226ece58ce5e5b` on
  `spike/next-major-security-upgrade`, `0/0`. Source/Test commit `1c43a160...`
  contains exactly `src/components/dashboard/history-client.tsx` and
  `tests/history-payment-regression/history-payment.spec.ts`; the only later
  commit before Promotion was documentation-only across the three current-state
  documents. Repository configuration blobs were unchanged from the tested Source.
- The pre-existing dirty `src/lib/schedule-slot-utils.ts` remained unstaged and
  checksum-exact at SHA-256
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Fresh Vercel metadata confirmed the target as exact ID/SHA,
  `production/READY/STAGED`, aliases `0`, and immutable created/building/ready
  timestamps `1785652847980/1785652848839/1785652928082`. Prior Production
  artifact `dpl_2SCF7xZMovQ1SGkyqJrqf86Rmzne`, Source
  `1cb6daa4c4186fae55d3312d6199c1a47ca4ffa4`, remained `READY` with all four
  established aliases and therefore remained a valid rollback candidate.
- Exactly one pinned Vercel CLI `58.4.4` Promotion invocation ran from
  `2026-08-02T07:51:09.0248867Z` through `07:51:15.9161178Z` and exited `0`.
  Promotion/retry/rebuild/redeploy/separate-alias/rollback counts were
  `1/0/0/0/0/0`. No new deployment or artifact was created. Postflight retained
  the exact SHA and all three timestamps and classified the artifact
  `production/READY/PROMOTED`.

#### Production Verification and Protected State

- Alias inventory remained eight rows. The four established Production aliases
  moved to the exact artifact with missing/extra/wrong counts `0/0/0`:
  `www.newathleteschool.com`, `new-athlete-badminton-school.vercel.app`,
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`.
  No separate alias action occurred.
- Canonical `/` and `/api/health` returned `200`. Real CSS
  `/_next/static/css/40506b9f4110c0bb.css?dpl=dpl_8qh3E8rEfVbWFyArqc48qNJW8arG`
  returned `200 text/css`. Unauthenticated `/dashboard/history` returned the
  expected `307` to `/auth/login?redirect=%2Fdashboard%2Fhistory`.
- Bounded exact-artifact logs from `2026-08-02T07:51:09Z` through `07:54:36Z`
  contained `22` records. Error/fatal/HTTP 5xx and deployment/runtime/database/
  storage/payment-related failure matches were `0/0/0/0`. One successful
  `POST /api/coach/assignment-groups 200` was unrelated concurrent Production
  traffic and was separated from this UI Promotion; no task-attributable
  regression was found and rollback was not used.
- The server-side started-round rule and `PROGRESSIVE_BOOKING_NOT_PENDING` guard
  remain unchanged. No UI evidence bypasses backend eligibility. Progressive and
  Legacy amounts, requests, SlipOK, accounting, lifecycle transitions, APIs,
  Migration, RPC, configuration, Environment, feature controls, and allowlists
  were unchanged. Controlled Write UAT, prepare, submit, slip upload, and every
  Production-data write were not run.
- Promotion-gate Functional/Test/Migration/Configuration counts are `0/0/0/0`;
  total task Functional/Test counts remain `1/1`. Accepted exact-Source tests
  remain focused `1/1`, full History payment E2E `10/10` with failed/skipped/
  flaky/retry `0/0/0/0`, TypeScript, zero-warning lint, mojibake `250`, Production
  build `91/91`, and diff compliance. Tests were not rerun because no Source/Test
  bytes changed after Owner PASS.

Final classification at this closeout: Source Complete **Yes**; Tests Passed
**Yes**; Owner UAT **PASS**; Deployed/Production Active **Yes**; Controlled Write
UAT **Not run / prohibited**; Migration/Environment/Feature/Allowlist
**unchanged**; Data Repaired **No**; Production Data Changed **No**; Customer
Impact **the corrected mobile Payment Dialog is now Production-active, with no
customer-data mutation**; Financial Impact **None**; Documentation Drift **No
after the containing closeout commit is published**; Blocker **None**; Task Done
**Yes**; Active Task **None**. Next action: await Owner selection and do not start
another task automatically. **PARKING LOT — LINE EXTERNAL-BROWSER HANDOFF AUDIT;
OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START.**

### 2026-08-02 — Admin Payroll Accuracy + Performance — READY FOR OWNER UAT

State observed at this handoff: Owner approved one continuous-delivery task to
make Admin Payroll complete for a bounded selected month, aggregate before RSC
serialization, and load Coach/week evidence only when requested while retaining
all existing teaching-hour, employment, threshold, rate, OT/payable, assignment,
booking, attendance, check-in, photo, GPS, Wallet, Reschedule, Makeup, and weekly-
close semantics. Migration, RPC/View/Function/Trigger/Index, Supabase `max_rows`,
Environment, secrets, feature controls, allowlists, Production writes, weekly-
summary repair/backfill, and unrelated refactors were prohibited.

#### Fresh Gate 0 and Confirmed Root Cause

- Repository Gate 0 passed on `spike/next-major-security-upgrade` at baseline HEAD
  `61d264ffbd871af1f5c70c1118700000b5341a71`, upstream `0/0`. The only
  pre-existing dirty path was `src/lib/schedule-slot-utils.ts`, SHA-256
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`;
  it remained byte-exact, unstaged, and excluded throughout.
- Independent Production SELECT-only reproduction showed the annual one-shot
  `coach_assignment_groups` query returned exactly `1,000` rows while stable
  ordered pages returned `1,000 + 332 = 1,332`. Thus `332` current assignments
  were omitted after the Data API cutoff at this observation. The old annual
  helper took `10.809s`, made `74` Data API calls, returned `945` full detail
  source rows, and read about `2.500 MB` of raw Data API response bytes.
- Dome's 2026-08-01 17:00–18:00 Private assignment was at stable annual position
  `1,158`, after the cutoff. A bounded source read confirmed the full Dome day at
  `3` rounds / `5` hours including the missing Private `1` hour. Cake
  2026-07-20..26 independently reconciled to `5` evidence-complete rounds / `10`
  hours; the old annual output had only `3` / `6`.
- Authenticated Production browser Gate 0 warm navigation samples were
  `3.485/3.439/3.110/3.697/4.399s`, P95 `4.399s`; RSC script characters were
  `923,820` and DOM size was about `1.059 MB`. The old month selector was client-
  only and did not change URL; one clean first switch measured `0.309s`, while a
  later Radix automation sequence was nondeterministic and was excluded rather
  than adjusted.
- Current Supabase JavaScript documentation was checked before implementation:
  `.range()` is zero-based/inclusive and depends on explicit ordering, and
  repeated `.order()` calls provide deterministic multi-column ordering. A
  Production SELECT-only probe confirmed joined slot date/start expressions work
  for parent ordering. Admin Schedules was inspected only as a summary-first,
  bounded-detail, metric-instrumentation pattern and was not edited.

#### Scoped Implementation and Bounded Correction

- `src/lib/coach-teaching-hours.ts` now rejects source ranges over `62` days,
  pages all potentially capped reads at `1,000` with exact-count, terminal-page,
  duplicate-row, and changed-count assertions, and orders assignments by joined
  date, start time, slot, sort order, and ID. Query or incomplete-page failures
  throw descriptive errors instead of returning partial hours.
- Exact groups remain authoritative. All exact groups in the bounded period are
  loaded before genuine Legacy-only slot resolution. Multiple exact groups for
  one Coach + slot union eligible learners deterministically and produce one
  teaching round, so hours cannot double-count. Duplicate learner membership or
  duplicate Legacy assignment data fails closed into `review`; zero eligible
  learners is emitted as `excluded` for Admin rather than disappearing. Protected
  callers retain their prior default of omitting zero-eligible rows.
- Related IDs are batched without Coach-chunk × slot-chunk fan-out. Independent
  phases run in parallel, ID batches use bounded concurrency, and metrics expose
  operation, duration, calls, rows, and phases without photo URL, GPS, learner PII,
  secret, or financial detail values.
- New `src/lib/admin-payroll-read.ts` parses server-authoritative `year/month`,
  defaults invalid/missing values to the current Bangkok month, expands to full
  Monday–Sunday weeks intersecting the month, applies unchanged
  `calculateTeachingPayEntries`, and returns Coach/week summaries only. Initial
  RSC props contain no full slot/evidence collection.
- New Admin-protected, `private, no-store`
  `GET /api/admin/coach-teaching-hours` validates UUID plus one canonical Monday–
  Sunday range and returns only the requested Coach/week detail. Service-role
  access remains server-only after Payroll authorization.
- `src/components/admin/payroll-client.tsx` now navigates month through URL state
  with a pending/disabled state, renders summaries first, and fetches detail only
  on expansion. AbortController plus a request generation guard prevents an old
  Coach/week response from overwriting a new selection/month. Loading, error,
  empty, and success states are distinct; browser-native alert/confirm/prompt was
  not introduced.
- A preliminary final-server sample had warm P95 `3.057s`, exceeding the exact
  `3.0s` ceiling by `57ms`. Bounded Source correction round `1/2` increased the
  safe UUID batch from `100` to `150` and bounded concurrency from `4` to `6`.
  No second correction was required. Final warm P95 became `1.886s` and calls
  fell from `49` to `34`, with identical returned rows and accuracy totals.

#### Accuracy, Performance, and Protected Verification

- New completeness regression passed `18/18`: more than 1,000 assignments with a
  payable target after 1,000; Dome Private `1h`; Cake `5/10`; Group/Private;
  unchanged Full-/Half-/Part-Time thresholds and rates; back-to-back slots;
  year-crossing week; multiple exact groups counted once; duplicate fail-closed;
  Exact precedence; genuine Legacy fallback; verified/unverified booking; Wallet,
  User Reschedule, and Makeup provenance; each missing evidence reason; no
  eligible learner; query/incomplete pagination fail-closed; summary/detail
  equality; weekly-close and Coach Hours protected source usage.
- New Payroll performance architecture regression passed `13/13`: bounded week-
  expanded reads, stable exact pagination, summary-only initial RSC model, lazy
  detail endpoint, server URL state/pending UI, abort/stale protection, Payroll
  authorization/no-store, bounded concurrency/no nested fan-out, PII-safe metrics,
  no unrelated-month growth, and distinct detail states.
- Protected regressions passed: Admin Schedule assignment `38/38`, Admin Schedules
  performance `24/24`, Coach assignment resolution `33/33`, and Lesson Wallet
  `17/17`. TypeScript, zero-warning lint, mojibake over `252` files,
  `git diff --check`, and Next.js 16.2.6 Production compile/type/static generation
  `91/91` passed. After each relevant build, the exact repo `.next` was removed,
  dev restarted on `127.0.0.1:3000`, and root/static assets returned `200/200`.
- Final bounded same-source samples: cold July `3.125s`; warm July
  `1.666/1.886/1.339/1.246/1.273s` (P95 `1.886s`); month changes
  `1.059/1.347/1.075/1.306/1.059s` (P95 `1.347s`); Cake detail
  `0.571/0.605/0.585/0.598/0.570s` (P95 `0.605s`). No final warm/detail sample
  exceeded `5s`. July used `34` calls, `6,699` returned rows across phases, and a
  `60,039`-byte summary payload, with no annual/full-detail browser serialization.

#### Publication, Exact Preview, and Owner UAT Gate

- Source/Test commit `fe424bbaa0e0366773cded241e78a0bcee71e43a` contains exactly
  eight allowed files: five functional (`coach-teaching-hours.ts`, new
  `admin-payroll-read.ts`, Payroll page/client, and new detail route), two new
  regression scripts, and `package.json`. It was pushed normally to
  `spike/next-major-security-upgrade`; Migration/Environment/data deltas were zero.
- Git integration created exact Preview `dpl_G2Dc6u94oJTzGDeextAM9bKB1svA`,
  URL `https://new-athlete-badminton-school-1tymwijlz-aachanin1s-projects.vercel.app`,
  `READY`, target `null`, region `icn1`, with metadata Git SHA `fe424bbaa0e...`.
  Remote build completed; staged `/api/health` returned `200`; the Vercel-
  protected login shell rendered; bounded Preview error/fatal logs were `0`.
- The available Super Admin Chrome session is host-scoped to Production. Local
  and Preview payroll navigation correctly reached the app login guard. Browser
  policy prohibits reading/copying cookies, storage, passwords, or session data,
  so Codex did not repurpose Production credentials. Authenticated staged wire
  P95, desktop/mobile rendering, pending-state perception, and console/hydration
  confirmation remain Owner-UAT-visible checks and are not falsely reported as
  Developer PASS.
- Production remains unchanged on `dpl_8qh3E8rEfVbWFyArqc48qNJW8arG`, Source
  `1c43a160a15932844a7c9fcee5e1cf0d30792f60`. Promotion, retry, rebuild,
  redeploy, separate alias, rollback, feature/allowlist action, Controlled Write,
  weekly close, repair/backfill, and Production data-write counts are all zero.

Owner UAT requires Super Admin: (1) open July 2026 and confirm fast URL-driven
navigation; (2) confirm Cake week 20–26 July shows `5` counted rounds / `10`
hours; (3) open August and confirm Dome 1 August 17:00–18:00 Private `1` hour;
(4) expand Coach/week and confirm detail loads only then and equals summary;
(5) confirm incomplete evidence shows a reason rather than disappearing; and
(6) test desktop/mobile plus loading states and report console/hydration failure.
**Do not press Close Week.** Owner PASS must name exact artifact/SHA. Only then may
that same artifact be promoted without rebuild, followed by Production health,
static/auth/Payroll read-only checks, runtime error/5xx scan, and SELECT-only
Cake/Dome reconciliation. No repair/backfill is authorized.

Final classification at this handoff: Active Task **ADMIN PAYROLL ACCURACY +
PERFORMANCE**; Task Status **READY FOR OWNER UAT**; Source Complete **Yes**;
Tests Passed **Yes**; server/data Performance Gate **Passed**; authenticated
staged browser gate **Owner-UAT pending**; Accuracy Reconciliation **Passed**;
Committed/Pushed **Yes**; Staged Artifact/SHA **READY/exact**; Owner UAT
**Pending**; Promoted/Production Active for this task **No**; Migration/
Environment/Feature/Allowlist **unchanged**; Controlled Write UAT **Not run /
prohibited**; Production Data Changed/Data Repaired **No/No**; Customer Impact
**None yet**; Financial Impact **None**; Scope Expansion/Breach **No/No**;
Documentation Drift **No after containing documentation commit is published**;
Blocker **Owner UAT/sign-in**; Task Done **No**; Next Action **Owner UAT, then exact
artifact Promotion only after explicit PASS**.

### 2026-08-03 — Admin Payroll Owner-UAT Bounded Copy Correction — READY FOR OWNER UAT

State observed at this handoff: Owner rejected the ambiguous Admin Payroll copy
`ไม่เข้าเกณฑ์เดิม` and authorized one presentation-only correction within the
existing Payroll task. The internal `no_eligible_learner` key, classification,
calculation, query, payload, lazy-detail, stale-response, authorization, and Close
Week contracts remain unchanged. Assignment Group lifecycle work was recorded as
Parking Lot only and was not started.

#### Scoped Source and Regression Evidence

- Functional file: `src/components/admin/payroll-client.tsx`. Excluded detail now
  reads `ไม่มีผู้เรียนที่นับได้ในรอบนี้ (เช่น ผู้เรียนย้ายออกจากรอบแล้ว)`, its
  classification badge is `ไม่นับชั่วโมง`, and overall/weekly copy keeps
  `รอหลักฐาน/ตรวจสอบ` distinct from
  `ไม่มีผู้เรียนที่นับได้/ไม่นับชั่วโมง`. Admin Payroll contains zero occurrences
  of `ไม่เข้าเกณฑ์เดิม` or standalone ambiguous `ไม่เข้าเกณฑ์`.
- Test file: `scripts/check-admin-payroll-performance.mjs`. Regression-first
  execution failed on the old reason text, then passed after the UI correction.
  The new check asserts the exact truthful copy, absence of the rejected copy,
  distinct counted/review/excluded states, retention of the internal reason key,
  canonical calculation/read entry points, and absence of client-side payroll or
  Supabase reads.
- Exact Source/Test commit is
  `03d08a93e77189d56b733bda009d9526400fa9b3`, containing only those two files,
  pushed normally to `spike/next-major-security-upgrade`. Read/calculation/API/
  Coach consumer hashes remained identical to the pre-correction baseline.
  Pre-existing dirty `src/lib/schedule-slot-utils.ts` remained unstaged and
  checksum-exact at
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.

#### Verification and Retained Performance Gate

- Payroll performance architecture passed `14/14`; Teaching Hours completeness
  passed `18/18`, including Cake `5` rounds / `10` hours, Dome Private `1h`, more
  than 1,000 assignments without loss, and summary/detail equality. TypeScript,
  ESLint with zero warnings, mojibake `252`, Next.js 16.2.6 build/static
  generation `91/91`, `git diff --check`, exact allowlist, protected-hash, banned-
  copy, and secret-addition gates passed.
- After build, the exact repository `.next` was removed, dev restarted on
  `127.0.0.1:3000`, and root/static returned `200/200`.
- The measured Payroll server/data performance gate is retained unchanged because
  every data-read, calculation, endpoint, pagination, request, and payload-model
  file remained byte-identical: Gate 0 warm P95 `4.399s`; staged warm P95
  `1.886s`; month-change P95 `1.347s`; detail P95 `0.605s`; July `34` external
  calls, `6,699` returned rows, and `60,039`-byte summary payload. No new annual
  read, Data API call, pagination branch, N+1 path, or detail preload was added.

#### Exact Preview and UAT Gate

- Git integration created exact Preview `dpl_7xuum5V7aFNxMeYSFnLqD2H8kdbY`,
  URL `https://new-athlete-badminton-school-pi4tpz8dp-aachanin1s-projects.vercel.app`,
  `READY`, target `null`, region `icn1`, metadata SHA `03d08a93e771...`. Remote
  build completed; root, `/api/health`, and a deployment-stamped CSS asset returned
  `200`; bounded Preview error/fatal/HTTP 5xx logs were zero.
- Prior Payroll artifact `dpl_G2Dc6u94oJTzGDeextAM9bKB1svA` is superseded for
  Owner UAT. Production remains unchanged on
  `dpl_8qh3E8rEfVbWFyArqc48qNJW8arG` / Source `1c43a160...`. Promotion, rebuild,
  retry, rollback, alias, Environment, feature, allowlist, Migration, Close Week,
  Production write, repair, and backfill counts are zero.
- Owner UAT requires Super Admin: confirm Cake 20–26 July remains `5/10`; open
  Golf 20–26 July and confirm 25 July 12:00–14:00 shows `ไม่นับชั่วโมง` plus the
  exact truthful detailed reason; confirm rejected copy is absent; confirm Dome
  Private `1h`; verify desktop/mobile, speed, lazy detail, and console/hydration;
  and do not press Close Week. Only an explicit PASS on this exact artifact/SHA
  authorizes Promotion without rebuild.

#### Parking Lot — Not Authorized

**ASSIGNMENT GROUP LIFECYCLE INTEGRITY — OWNER SELECTION REQUIRED; NOT AUTHORIZED
TO START.** Candidate scope: preserve `absent` learners and prevent false unsaved
state; prevent misleading empty active group headers after the last learner
reschedules or stores a session in Wallet; cover assignment save, Reschedule,
Wallet, Attendance, Exact/Legacy resolution, Payroll, and audit-history
preservation. No Production repair, deletion, or migration is authorized.

Final classification at this handoff: Active Task **ADMIN PAYROLL ACCURACY +
PERFORMANCE**; Task Status **READY FOR OWNER UAT**; Source Complete **Yes**;
Tests Passed **Yes**; Performance Gate **Passed/retained with byte-identical read
contract**; Accuracy Reconciliation **Passed**; Committed/Pushed **Yes**; Staged
Artifact/SHA **READY/exact**; Owner UAT **Pending**; Promoted/Production Active for
this task **No**; Production Checks **Preview build/health/static/logs passed**;
Migration/Environment/Feature/Allowlist **unchanged**; Controlled Write UAT **Not
run / prohibited**; Production Data Changed/Data Repaired **No/No**; Customer
Impact **None yet**; Financial Impact **None**; Scope Expansion/Breach **No/No**;
Documentation Drift **No after the containing documentation commit is published**;
Blocker **Owner UAT**; Task Done **No**; Next Action **Owner UAT on
`dpl_7xuum5V7aFNxMeYSFnLqD2H8kdbY`, then exact-artifact Promotion only after
explicit PASS**.

### 2026-08-03 — Admin Payroll Exact-Promotion Material Hard Stop — OWNER DECISION REQUIRED

State observed at this safe handoff: Owner UAT passed on exact Preview
`dpl_7xuum5V7aFNxMeYSFnLqD2H8kdbY`, URL
`https://new-athlete-badminton-school-pi4tpz8dp-aachanin1s-projects.vercel.app`,
and Application Source SHA
`03d08a93e77189d56b733bda009d9526400fa9b3`. Owner authorized one direct,
no-rebuild Promotion of only that immutable artifact. Source, tests, Migration,
configuration, Environment, feature controls, allowlists, and Production data
were not authorized to change.

#### Fresh Gate 0 and Invocation Evidence

- Git root/branch/HEAD/upstream/ahead-behind passed at documentation HEAD
  `d98a6672ea455cf3c989cc844efcbd83ff4ee213` on
  `spike/next-major-security-upgrade`, `0/0`. Application Source `03d08a93...` is
  its ancestor; the documentation HEAD contains only the three current-state
  documents. The sole pre-existing dirty
  `src/lib/schedule-slot-utils.ts` remained unstaged and checksum-exact at
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Preflight confirmed the approved Preview as `READY`, target `null`, region
  `icn1`, exact metadata SHA `03d08a93...`, and immutable created/building/ready
  timestamps `1785764415527/1785764416691/1785764490157`. Root, health, real CSS,
  and bounded Preview error/fatal/5xx checks passed. Documentation-only Preview
  `dpl_HbGYxvzBJHE7Jua97AuDXdXdjGSP` was separately identified at SHA
  `d98a667...` and was not promoted.
- Prior Production artifact `dpl_8qh3E8rEfVbWFyArqc48qNJW8arG`, Source
  `1c43a160...`, remained `READY` and was verified as the rollback candidate.
  Alias inventory had eight rows; its four established Production aliases pointed
  to that artifact before the invocation.
- Exactly one pinned Vercel CLI `58.4.4` command addressed immutable ID
  `dpl_7xuum5V7aFNxMeYSFnLqD2H8kdbY` from
  `2026-08-03T14:11:07.3952104Z` through `14:11:12.9220953Z` and exited `0`.
  No branch alias, documentation Preview, old Preview, HEAD deployment, or other
  artifact was supplied to the command.

#### Non-Conforming Vercel Result

- Vercel did not change the approved Preview to Production in place. It created
  distinct Production deployment `dpl_5KVSd4jqNB3tqYA1t9qHjb4VBHZC` with
  metadata `action=promote`,
  `originalDeploymentId=dpl_7xuum5V7aFNxMeYSFnLqD2H8kdbY`, and the same Git SHA
  `03d08a93...`, then cloned the repository, ran `npm ci`, and ran a complete
  `next build`. The new record's created/building/ready timestamps are
  `1785766273206/1785766274341/1785766349724`. Build logs prove a new build and
  deployment, so the required exact-ID/no-rebuild condition failed.
- Final alias inventory remained eight rows and no separate alias command was
  used. `www.newathleteschool.com` and
  `new-athlete-badminton-school.vercel.app` moved to the derived deployment, and
  the branch Preview alias moved automatically. The two established team aliases
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app` and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app` remained
  on `dpl_8qh3...`. Thus all four established Production aliases did not converge
  on the approved artifact.
- Promotion/retry/rebuild/redeploy/separate-alias/rollback counts are
  `1/0/1/0/0/0`; platform-created derived Production deployment count is `1`.
  No automatic rollback authorization exists, so no corrective Vercel write was
  attempted after this result.

#### Read-Only Containment and Protected State

- On primary Production, `/` returned `200`, `/api/health` returned
  `200 application/json`, rebuilt CSS
  `/_next/static/css/be7cc4444a49344a.css` returned `200 text/css`, and
  unauthenticated `/admin/payroll` returned the expected `307` login redirect.
  Bounded derived-deployment error/fatal/HTTP 5xx and database/auth/payroll
  failure-term queries returned zero. Supabase API/Auth/Postgres log queries
  returned no post-Promotion records in their available window.
- Deterministic post-Promotion reruns passed Teaching Hours completeness `18/18`
  and Payroll architecture `14/14`, including no loss after 1,000, Cake `5`
  rounds / `10` hours, Dome Private `1h`, the truthful excluded wording, and
  summary/detail equality. Owner UAT remains PASS for the exact tested Preview,
  but it does not authorize the distinct rebuilt artifact identity.
- Authenticated Production Payroll was not opened because Owner credentials were
  not read, copied, or repurposed. Close Week, weekly-summary mutation, Production
  business-data write, repair, and backfill counts are zero. Functional/Test/
  Migration/Configuration changes in this gate are `0/0/0/0`; Source changed
  **No**; financial data changed **No**.

Material Hard Stop classification: Active Task **ADMIN PAYROLL ACCURACY +
PERFORMANCE**; Task Status **DEVELOPING — OWNER DECISION REQUIRED**; Source
Complete **Yes**; Tests Passed **Yes**; Owner UAT **Passed on exact Preview/SHA**;
exact-artifact/no-rebuild Promotion **Failed**; Deployed/Production Active
**non-conforming and mixed across aliases**; Controlled Write UAT **Not run /
prohibited**; Migration/Environment/Feature/Allowlist **unchanged**; Production
Data Changed/Data Repaired **No/No**; Customer Impact **primary Production domains
serve the Payroll Source through a derived rebuild while two secondary aliases
remain on prior Production; no customer data changed**; Financial Impact **None**;
Scope Expansion **No**; Scope Breach **Yes at Vercel platform outcome**;
Documentation Drift **No after this safe-handoff commit is published**; Blocker
**Owner decision before rollback or remediation**; Task Done **No**; Next Action
**do not retry, rollback, alias, deploy, or start a new task until Owner directs**.

#### Parking Lot — Owner Selection Required

**THAI UI TERMINOLOGY & SHARED HELPER — OWNER SELECTION REQUIRED; NOT AUTHORIZED
TO START.** Candidate scope: one shared user-visible terminology helper covering
`kids_group = กลุ่มเด็ก`, `adult_group = กลุ่มผู้ใหญ่`, `private = ส่วนตัว`,
`Present = มาเรียน`, `Late = สาย`, `Absent = ขาดเรียน`, context-appropriate
Attendance wording, employment types, and other exposed technical codes; audit
and adopt it across Admin, Coach, and User portals, including Admin Payroll, in
one future task. Do not create a temporary Payroll-local mapping first. No audit,
implementation, deploy, Migration, Production change, or data action is
authorized. Assignment Group Lifecycle Integrity, LINE External-Browser Handoff
Audit, and every existing Parking Lot item remain unchanged and unauthorized.

### 2026-08-03 — Admin Payroll Production Acceptance and Alias-Convergence Final Closeout

State observed at this final closeout: the earlier exact-Promotion Hard Stop above
remains preserved as dated historical evidence. Owner subsequently accepted the
derived Production artifact and confirmed from Super Admin screenshots and real
Production use that Admin Payroll works normally. Owner Production UAT therefore
passed on `dpl_5KVSd4jqNB3tqYA1t9qHjb4VBHZC`, URL
`https://new-athlete-badminton-school-q0xng3m0d-aachanin1s-projects.vercel.app`,
at unchanged Application Source SHA
`03d08a93e77189d56b733bda009d9526400fa9b3`. Owner also accepted the Production
rebuild as normal Preview-to-Production Promotion behavior and authorized only
the two remaining established alias reassignments. No rollback, rebuild,
redeploy, Promotion, Source change, test change, or Parking Lot work was
authorized in this final gate.

#### Alias-Convergence Evidence

- Fresh Git preflight passed at documentation HEAD
  `0dd6aebe18e00227cd2e50a09c7016a4ec595ff3` on
  `spike/next-major-security-upgrade`, ahead/behind `0/0`. The only dirty path was
  the pre-existing unstaged `src/lib/schedule-slot-utils.ts`, checksum-exact at
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Preflight reconfirmed the derived artifact as `production/READY`, exact Source
  SHA `03d08a93...`, and unchanged created/building/ready timestamps
  `1785766273206/1785766274341/1785766349724`. The two primary aliases already
  pointed to it; the two approved team aliases still pointed to prior artifact
  `dpl_8qh3E8rEfVbWFyArqc48qNJW8arG`. Alias inventory was exactly eight rows.
- Pinned Vercel CLI `58.4.4` reassigned
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app` to
  `new-athlete-badminton-school-q0xng3m0d-aachanin1s-projects.vercel.app` from
  `2026-08-03T14:35:11.0566087Z` through `14:35:13.8330551Z`; exit code `0`.
  Immediate read-only verification passed before the second command.
- The same pinned CLI reassigned
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app` to the
  same exact derived hostname from `2026-08-03T14:35:38.0910464Z` through
  `14:35:40.6823614Z`; exit code `0`. Neither command used `--force`.
- Final alias inventory remained exactly eight rows. All four established
  Production aliases—`www.newathleteschool.com`,
  `new-athlete-badminton-school.vercel.app`,
  `new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and
  `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`—pointed
  to the accepted derived artifact. No alias was added or removed.
- The pre-alias latest-deployment timestamp baseline was `1785766830639`; querying
  after `1785766830640` returned zero deployments. The accepted artifact stayed
  `READY` at the exact SHA and its created/building/ready timestamps were
  unchanged. Alias-gate Promote/Retry/Rebuild/Redeploy/Alias Set/Rollback counts
  were `0/0/0/0/2/0`.

#### Production and Accuracy Verification

- `https://www.newathleteschool.com/` and the project Production alias returned
  `200`. `/api/health` returned `200 application/json`. Deployment-stamped CSS
  `/_next/static/css/be7cc4444a49344a.css` returned `200 text/css`. An
  unauthenticated `/admin/payroll` request returned the expected `307` login
  redirect. Both team aliases returned the expected Vercel-protected `302` to
  Vercel SSO.
- Bounded exact-deployment Vercel queries returned zero error/fatal/HTTP 5xx and
  zero database/auth/payroll failure logs. Corrected timestamp parsing of
  post-alias Supabase logs found API/Auth entries `0/0`, Postgres entries `2`
  with informational severity `LOG`, and failures `0`.
- Teaching Hours completeness passed `18/18` and Payroll performance architecture
  passed `14/14`. The deterministic checks retained no loss after 1,000, Cake
  `5` rounds / `10` hours, Dome Private `1h`, the truthful excluded wording, and
  summary/detail equality. Owner Production UAT independently confirmed normal
  Payroll behavior with Super Admin.
- Functional/Test/Migration/Configuration changes in this alias gate were
  `0/0/0/0`. Environment, feature controls, allowlists, permissions, Source SHA,
  and financial data were unchanged. Controlled Write UAT was not run and was
  prohibited. Close Week was not invoked. Production Data Changed/Data Repaired
  remained `No/No`.

#### Corrected Vercel Release Workflow

Owner accepted this as a release-workflow correction, not a Payroll Source defect.
Current Vercel Preview-to-Production Promotion creates a distinct Production
deployment and new Production build; Preview UAT is therefore not immutable
Production-artifact UAT. A future no-rebuild exact-artifact contract must first
create a staged Production deployment with `vercel --prod --skip-domain`, UAT
that exact staged Production artifact, and then Promote that exact staged
Production artifact. The project must not set another no-rebuild contract against
a Preview artifact.

Final classification at this closeout: Owner Preview UAT **Passed** on
`dpl_7xuum5V7aFNxMeYSFnLqD2H8kdbY` / `03d08a93...`; Owner Production UAT
**Passed** on accepted `dpl_5KVSd4jqNB3tqYA1t9qHjb4VBHZC` / `03d08a93...`;
Source Complete **Yes**; Tests Passed **Yes**; Committed/Pushed **Yes after the
containing documentation/policy closeout commit is published**; Deployed and
Production Active **Yes**; Feature/Allowlist change **No/No**; Controlled Write
UAT **Not run / prohibited**; Production Data Changed/Data Repaired **No/No**;
Customer Impact **Payroll accuracy/performance correction is Production-active
and Owner-verified, with no customer-data mutation**; Financial Impact **None**;
Scope Expansion/Breach **No/No by Developer**; Documentation Drift **No after
the containing closeout commit is published**; Blocker **None**; Active Task
**None — Awaiting Owner Selection**; Task Done **Yes**; Next Action **await Owner
selection and do not start another task automatically**. Thai UI Terminology &
Shared Helper, Assignment Group Lifecycle Integrity, LINE External-Browser
Handoff Audit, and every other Parking Lot candidate remain OWNER SELECTION
REQUIRED and NOT AUTHORIZED TO START.

### 2026-08-04 — Admin Notifications Recommendations Documentation Registration

This is a dated decision record for a Parking Lot candidate, not an implementation
closeout and not a new Active Task.

#### Fact

- Source inspection found that “ติดตามลูกค้าเก่า” rebuilds its eligible list on
  each server render and applies `.slice(0, 30)`. Sending a recommendation creates
  rows in `notifications`; the client then refreshes the page. There is no
  recommendation completion state, exclusion, or cooldown in this flow, so a
  newly eligible customer can refill the visible list after one send.
- Source inspection found that “รอบเรียนคนน้อย” combines eligible rounds across
  branches into one flat list and applies `.slice(0, 20)`.
- Source inspection found that the current near-course calculation derives usage
  from the page's session input, while that input query is limited to session dates
  from Bangkok `today` onward. The source therefore does not supply the complete
  past-session population to that calculation.
- The prior PM SELECT-only diagnostic snapshot reported: Customer follow-up
  eligible `150` customers (`110` from the previous month and `40` older); at
  least `4` already had a sent reminder Notification but remained eligible; Low-
  enrollment eligible `141` rounds across `8` branches while the UI shows at most
  `20`; past session rows excluded from the current formula input `178` across
  `115` current bookings; current Source percentage differed from the diagnostic
  full-session predicate for `114/168` bookings; current formula candidate `1`
  versus diagnostic predicate candidate `25`; `21` bookings had more physical
  session rows than `total_sessions`; and `14` bookings had rescheduled rows.
- Those diagnostic counts are a point-in-time SELECT-only snapshot and supporting
  evidence only. No Production write occurred.

#### Owner Intended Behavior

- After one customer is actioned, the currently viewed follow-up queue should
  decrease `30 → 29`; it should not immediately pull the next eligible customer
  into that same viewed queue.
- Low-enrollment recommendations should be separated or grouped by branch so the
  Admin can read branch context and understand the real eligible volume.

#### Risk / Inference

- Without durable action/exclusion semantics, refresh-based recomputation makes a
  send action appear not to reduce the follow-up workload.
- The flat cross-branch cap can hide eligible rounds and overrepresent whichever
  rows happen to enter the first `20`.
- The difference between the current formula and the diagnostic predicate shows a
  material renewal-accuracy risk, but it does not prove that the diagnostic
  predicate is the correct business formula.

#### Unknown / Need Owner Decision

- “ผู้เรียนใกล้หมดคอร์ส” does not yet have an approved business meaning. Owner
  decision is required on entitlement, progress, and remaining-session semantics.
- If Owner selects this task, the Scope Contract must first audit entitlement,
  Lesson Wallet, Reschedule, Private, and multi-attendee semantics. Physical
  session-row counts, `total_sessions`, rescheduled descendants, and the diagnostic
  full-session predicate must not be promoted into business truth without that
  decision.

#### Authorization State

Status: **PARKING LOT — OWNER SELECTION REQUIRED; ANALYZED; NOT AUTHORIZED TO
START**.

The latest Owner selection queue is:

1. Assignment Group Lifecycle Integrity
2. Thai UI Terminology & Shared Helper
3. Admin Notifications Recommendations — Actionability, Branch Grouping &
   Renewal Accuracy

Only documentation registration, an explicit three-file documentation stage, one
documentation commit, and one normal push were authorized. No Application Source,
test, Migration, configuration, database, Production, deployment, Promotion,
feature-control, allowlist, permission, data, customer, or financial action was
authorized or performed. Notifications implementation remains **NOT AUTHORIZED TO
START**.

### 2026-08-04 — Assignment Group Lifecycle Historical-Month Correction Safe Handoff

This dated record supersedes the prior Parking Lot status for this task. Owner
selected **ASSIGNMENT GROUP LIFECYCLE INTEGRITY** as the single Active Task,
accepted the earlier lifecycle migration state, rejected staged artifact
`dpl_8sYvgzXSEZfUKgfi6fd2ViQrxinJ` / Source `fa78857...` for Promotion because
the Assignment page could not open historical July, and authorized a Source-only,
SELECT-only bounded correction with a mandatory performance guard.

#### Fact

- Gate 0 verified branch `spike/next-major-security-upgrade`, starting HEAD and
  upstream `fa78857b9fa762866dad41c6cfd9e100eb6ad4bc`, ahead/behind `0/0`, empty
  stage/untracked set, and only pre-existing stat-dirty
  `src/lib/schedule-slot-utils.ts`. That protected file remained content-identical
  to index blob `4521281d099efb189429a744909552d67871ff23`, SHA-256
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Root cause was exact: the Server page ignored `searchParams.month` and queried
  `.gte('date', today)` without an upper bound, while Client controls changed only
  local month state. Existing Reschedule/Wallet links already supplied
  `?month=YYYY-MM`. Baseline migration Source proves the B-tree
  `idx_booking_sessions_date`; no query loop or new N+1 was introduced.
- Regression-first source-only execution failed before any Local Supabase setup on
  the missing Promise `searchParams.month` assertion. After correction, source-only
  lifecycle checks passed `22/22`. Full fixture mode was not run; DB fixture/write
  count was `0/0`.
- Exact functional/test paths were `src/app/(coach)/coach/assign-groups/page.tsx`,
  `src/components/coach/assign-groups-client.tsx`, and
  `scripts/check-coach-assignment-lifecycle.mjs` (`2/1` files; `153` insertions,
  `24` deletions). Migration/API/config/dependency changes were `0/0/0/0`.
- Source now validates canonical `YYYY-MM`, falls back to the current Bangkok
  month, applies the exact half-open selected-month range, and sends the validated
  month to the Client. Client navigation uses canonical URL-driven Server reads,
  timezone-stable adjacent-month arithmetic, always-visible controls/empty state,
  existing Sonner fail-closed behavior for genuine edits/saves, no Client Supabase
  read, and unchanged past-slot lock and lifecycle semantics.
- Verification passed: source-only lifecycle `22/22`, Admin Schedule assignment
  `38/38`, Admin Schedules performance architecture `24/24`, TypeScript, zero-
  warning ESLint, mojibake, Next.js 16.2.6 build/static generation `91/91`, clean
  post-build dev restart, root/health/static/auth smoke, and `git diff --check`.
  Protected hashes, migration SHA-256
  `47D1B3FD43F8E9F115AD72917C87BDD2DFE3D83FECB0FCE4419DF3593CC4ECC8`,
  package, APIs, and the schedule helper remained exact.
- Functional/test commit `4102cc51e1d95257a43b0c10abb54e5627890df9`
  (`fix: load assignment groups by selected month`) was normally pushed; branch
  HEAD/upstream was `0/0`. New staged Production artifact
  `dpl_9RE8BF4LL1awvGfWH5V2nTsCzFDm`, URL
  `https://new-athlete-badminton-school-kgxcskso6-aachanin1s-projects.vercel.app`,
  is `production/READY`, Source-exact, region `icn1`, source `cli`, aliases `[]`.
  Root, health, CSS, and unauthenticated route-protection smoke passed; bounded
  error/fatal/HTTP 5xx logs were zero.
- Authenticated read-only Head Coach evidence on the new artifact showed July
  label/URL correct, `315` slots / `1000` learner-sessions, and past controls
  disabled with `ล็อกย้อนหลัง`. June/July/August URL navigation, invalid-month
  Bangkok fallback, and empty September controls/state were observable. No Save,
  Reschedule, Wallet, Attendance, Close Week, Controlled Write UAT, fixture, or
  Production business-data write occurred. Existing absent visual evidence was
  not separately labeled in the UI; deterministic/source evidence remains the
  available proof for absent inclusion.

#### Performance Evidence and Material Hard Stop

Identical route/role/sampler warm measurements were:

| Route | min | P50 | P95 | max | learner-session rows | slots | rendered-document proxy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rejected baseline current/today-forward | 2.794s | 3.107s | 3.593s | 3.593s | 929 | 305 | 1,059,319-1,060,368 chars |
| Corrected current/full August | 2.977s | 3.531s | 4.281s | 4.281s | 1000 | 325 | 1,150,070 chars |
| Corrected historical July | 2.790s | 3.044s | 4.551s | 4.551s | 1000 | 315 | 1,176,304 chars |
| Corrected empty September | 1.073s | 1.113s | 1.294s | 1.294s | 0 | 0 | 97,996-98,488 chars |

Historical July passed its required 5-second P95 ceiling. Source inspection shows
no new fixed DB/Data API call site and no N+1; Client-observed Data API calls
remain `0 -> 0`. The exact Server-side round-trip total, including the existing
100-ID coach-history membership batches, is **Unknown / not exposed by the staged
browser metrics**, so that mandatory numeric gate is not claimed as proven.
Current-month P50/P95, row count, and payload proxy also exceed the mandatory
baseline limits. The extra `71` learner-sessions and `20` slots are
real 1-3 August rows required by the approved `date >= first day of selected
month` range and excluded by the old 4-August-forward baseline. Removing them
would violate the approved full-month behavior. Reducing payload without dropping
the rows would require scope expansion such as another read/API/pagination model,
which is not authorized.

This is therefore a **Material Hard Stop — conflicting Owner requirements**, not
a claim that architecture alone is fast. No second Source change was made after
the measured failure because no bounded change within the exact two functional
files can satisfy both conditions truthfully. The new staged artifact is blocked
from Owner UAT and Promotion. The old rejected artifact remains historical and
must never be Promoted. Current Production remains unchanged at
`dpl_5KVSd4jqNB3tqYA1t9qHjb4VBHZC` / Source
`03d08a93e77189d56b733bda009d9526400fa9b3`.

#### State Observed at This Safe Handoff

Source Complete **Yes for approved behavior**; Tests Passed **Yes except the
mandatory Performance Gate**; Committed/Pushed **Yes**; staged artifact **READY
but blocked**; Production Active **No for this task**; Owner UAT **failed on the
old artifact and not started on the new blocked artifact**; Feature/Environment/
Allowlist/Migration change **No/No/No/No**; Controlled Write UAT **Not run /
prohibited**; DB fixture/write **0/0**; Data Repaired/Production Data Changed
**No/No**; Customer Impact **None direct because Production is unchanged**;
Financial Impact **None**; Scope Expansion/Breach **No/No**; Task Done **No**;
Active Task remains **ASSIGNMENT GROUP LIFECYCLE INTEGRITY**. Next Action:
**Owner decides between accepting a documented current-month performance/volume
exception for full-month behavior, or changing the current-month semantics/scope;
do not deploy, Promote, alias, mutate data, or start another task automatically**.

### 2026-08-04 — Assignment Lifecycle Today-Forward + Complete Pagination Safe Handoff

This dated record supersedes the immediately preceding Assignment Group safe
handoff. Owner approved Bangkok today-forward for the selected current month,
full historical/future selected months, complete reads beyond 1,000 rows, and a
navigation pending/double-click guard. Work remained Source-only/SELECT-only and
never authorized Promotion before exact-artifact Owner PASS.

#### Fact — Gate 0, Audit, and Root Cause

- Fresh Gate 0 matched the expected branch and Source exactly: branch
  `spike/next-major-security-upgrade`, starting HEAD/upstream
  `bfe8abe82d5912124aef91053a58353a4a0c0d49`, ahead/behind `0/0`, and only the
  protected pre-existing stat-dirty `src/lib/schedule-slot-utils.ts`. That file
  remained SHA-256
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`, index
  blob `4521281d099efb189429a744909552d67871ff23`, and was never edited/staged.
- Migration Source remained
  `supabase/migrations/20260804000000_assignment_group_lifecycle_integrity.sql`,
  SHA-256
  `47D1B3FD43F8E9F115AD72917C87BDD2DFE3D83FECB0FCE4419DF3593CC4ECC8`.
  Existing B-tree `idx_booking_sessions_date` was confirmed. No migration/config/
  schema/RLS/grant/function/trigger command ran.
- Source Root Cause was three-part: the selected current month started at day 1;
  the primary `booking_sessions` read had no range pagination despite Supabase
  `max_rows = 1000`; and month buttons called `router.push()` without a pending
  state or synchronous repeated-click lock. Current official Supabase select,
  range, and order documentation confirmed a default 1,000-row cap, inclusive
  zero-based range pagination, and order-dependent range semantics.
- Complete SELECT-only audit returned July roster `1,415` learner-sessions /
  `437` slots / `2` pages, August 4-forward `929/305/1`, and full August
  `1,098/354/2`. July top-level Legacy/groups/embedded memberships/student levels
  were `576/595/1,412/512`, below the cap. July coach history was a separate
  request-size/completeness risk: `2,520` session rows / `806` slots, child/adult
  pages `3+1`, Legacy `1,083` rows, and exact-boundary `1,107` rows.

#### Fact — Regression-First Source and Bounded Correction

- Regression-first source-only execution failed on the missing today-forward
  assertion before Source correction. Source now computes Bangkok today/current
  month once, uses today only when selected month equals the Bangkok current
  month, otherwise month start, and always uses exclusive next-month start.
  Invalid/missing month falls back to current today-forward.
- Primary and coach-memory `booking_sessions` reads use exact counts, page size
  `1,000`, bounded maximum pages, stable `date -> start_time -> id` ordering for
  the roster and stable secondary `id` ordering for memory, and fail closed on
  query error, missing/inconsistent count, early completion, duplicate session
  ID, count drift, or exceeded bounds. A short first page creates no fixed second
  roster request.
- Client navigation uses React transition state plus a synchronous ref lock,
  visible `กำลังโหลดข้อมูลเดือน...`, `aria-busy`, polite live status, and both
  month buttons disabled during save/navigation. Existing dirty-draft and active-
  Save guards, historical lock, lifecycle reconciliation, no Client fetch/
  Supabase read, and protected Reschedule/Wallet/Attendance/Payroll semantics
  remain unchanged.
- First functional/test commit
  `dd2595ebdb0eebc430f8ea4ac8e6eddac2ed35f9` staged artifact
  `dpl_DBnGPPV6ioBt4jpkonC4TMXqL173`. Current month rendered correctly, but July
  failed closed with an oversized coach-history Legacy `.in(schedule_slot_id)`
  request. This artifact is rejected for UAT/Promotion.
- Bounded correction 1 added non-overlapping, deduplicated 100-ID batches only
  when a supporting `.in` collection exceeds 100; short supporting reads retain
  one call. It bounds batch dimensions/count, requests exact counts, and fails
  closed on any incomplete/error result. July SELECT-only proof returned Legacy
  `1,083/9` batches, exact-boundary `1,107/9`, exact membership `2,508/26`, and
  wallet provenance `30/3` from `296` candidates. This is bounded collection
  batching, not a query per slot/student/group and not N+1.

#### Fact — Verification, Git, and Artifacts

- Final deterministic rerun passed lifecycle source-only `28/28`, Admin Schedule
  assignment `38/38`, Admin Schedules performance `24/24`, Lesson Wallet `19/19`,
  Coach Teaching Hours `20/20`, and Assignment Resolution `33/33`: `162` total.
  TypeScript, zero-warning ESLint, mojibake over `253` files, Next.js 16.2.6
  build/static generation `91/91`, post-build `.next` cleanup/dev restart,
  root/health/CSS/auth smoke, and staged/unstaged diff checks passed.
- Functional/Test scope is exactly `2/1` files, `405` insertions / `41` deletions
  from starting Source. Package/API/config/migration delta, DB fixture/write,
  Production write, feature/environment/allowlist change, Scope Expansion, and
  Scope Breach are all `0` or No.
- Functional/test commits
  `dd2595ebdb0eebc430f8ea4ac8e6eddac2ed35f9` and
  `b9b2bd7094080c3d1aa4710b1acd8922054421a1` were normally pushed; branch Source
  was `0/0`. Corrected clean-worktree Production-target artifact
  `dpl_EY91eHqAk58Dqc7akvsUNLztsNjM`, URL
  `https://new-athlete-badminton-school-81fhn33yl-aachanin1s-projects.vercel.app`,
  is `READY`, exact Source metadata, `icn1`, aliases `[]`, unpromoted. Root,
  health, login, CSS, and unauthenticated Assignment protection passed; bounded
  unauthenticated error/fatal/5xx logs were zero.
- Older blocked/rejected artifacts
  `dpl_9RE8BF4LL1awvGfWH5V2nTsCzFDm` and
  `dpl_8sYvgzXSEZfUKgfi6fd2ViQrxinJ`, plus runtime-failed
  `dpl_DBnGPPV6ioBt4jpkonC4TMXqL173`, remain evidence only and must never be
  Promoted. Current Production remains
  `dpl_5KVSd4jqNB3tqYA1t9qHjb4VBHZC` / Source
  `03d08a93e77189d56b733bda009d9526400fa9b3`.

#### Fact / Unknown — Browser and Performance Hard Stop

- Authenticated client-identical artifact evidence showed current 4-31 August
  exactly `929` learner-sessions / `305` slots, one same-tick double-click moving
  only to September, visible pending status, `aria-busy=true`, both buttons
  disabled during navigation, clean recovery afterward, correct empty September
  controls/state, desktop/mobile controls without horizontal overflow, and zero
  warnings/errors in a clean client tab. No Save or protected-domain action ran.
- The corrected candidate unique origin redirected to login and had no reusable
  authenticated Head Coach session. Historical July UI/completeness/read-only,
  browser Back/Forward, candidate console/hydration, desktop/mobile candidate,
  and 20-sample candidate current/July metrics are therefore **Unknown / Need
  verification**. Authenticated RSC/document wire bytes and exact Server metric
  are Unknown; no DOM proxy is mislabeled as wire bytes.
- A valid 20-sample warm current/today-forward comparison artifact with stable
  `929/305` population measured min/P50/P95/max
  `5.874/6.215/6.918/7.573s`. Its P95 exceeds the mandatory absolute `5s` ceiling.
  Candidate comparison cannot be calculated without authenticated samples.

#### State Observed at This Safe Handoff

Source Complete **Yes for scoped Source**; Tests Passed **Yes**; Performance Gate
**Not passed**; Committed/Pushed **Yes/Yes**; corrected staged artifact
**READY/unaliased but not READY FOR OWNER UAT**; Owner/Production UAT **Not run**;
Promoted/Production Active **No/No for this task**; Migration retained with no
task change; Environment/Feature/Allowlist **unchanged**; Controlled Write UAT
**Not run/prohibited**; DB fixture/write **0/0**; Production Data Changed/Data
Repaired **No/No**; Customer/Financial Impact **None/None**; Scope Expansion/
Breach **No/No**; Documentation Drift **No after publication**; Task Done **No**.

Material Hard Stop: Owner must sign in on the corrected unique URL and ask
Developer Codex to resume exact-artifact read-only verification, or explicitly
change the performance contract. If the corrected artifact still exceeds the
5-second P95 ceiling, stop for Owner decision. Never Promote or alias without
Owner PASS on exact artifact `dpl_EY91eHqAk58Dqc7akvsUNLztsNjM` / exact Source
`b9b2bd7094080c3d1aa4710b1acd8922054421a1`.

### 2026-08-04 — Authenticated Exact-Artifact Technical Gate Material Hard Stop

Owner supplied an authenticated Head Coach session on exact staged artifact
`dpl_EY91eHqAk58Dqc7akvsUNLztsNjM`, exact Application Source
`b9b2bd7094080c3d1aa4710b1acd8922054421a1`, and authorized only read-only
technical verification. No Save, Reschedule, Wallet, Attendance, Close Week,
Source, Migration, configuration, Environment, feature, allowlist, DB/data,
alias, Promotion, or repair action was authorized or performed.

#### Fact — Identity, Completeness, and UI

- Fresh Git state was branch `spike/next-major-security-upgrade`, local/remote
  containing documentation HEAD `82413d5667d2a13ea4b111fb54016e1d48ad4bcf`,
  ahead/behind `0/0`, and only protected pre-existing stat-dirty
  `src/lib/schedule-slot-utils.ts`. Its SHA-256/index blob remained
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181` /
  `4521281d099efb189429a744909552d67871ff23`. Migration SHA-256 remained
  `47D1B3FD43F8E9F115AD72917C87BDD2DFE3D83FECB0FCE4419DF3593CC4ECC8`.
- Vercel returned exact Source metadata, `production/READY`, region `icn1`, and
  aliases `[]` for the candidate. Current Production remained
  `dpl_5KVSd4jqNB3tqYA1t9qHjb4VBHZC` / Source
  `03d08a93e77189d56b733bda009d9526400fa9b3`; no Promotion occurred.
- Corrected-candidate current view showed Bangkok today-forward 4–31 August and
  exact aggregate `929` learner-sessions / `305` slots in all `20` samples.
  Corrected-candidate historical view showed July 1–31 and exact aggregate
  `1,415/437` in all `20` samples, proving the UI result did not stop at `1,000`.
  The audited Server plan remains roster pages `1` current / `2` July with stable
  ordering, no duplicate IDs, no N+1, and Client Data API calls `0`.
- July showed `ล็อกย้อนหลัง`; the three visible assignment write actions and
  active group-name input were disabled. No historical write was attempted.
- Same-tick double-click on July next-month moved to August exactly once. During
  navigation, visible status was `กำลังโหลดข้อมูลเดือน... สิงหาคม 2569`,
  `aria-busy=true`, and both month buttons were disabled. After commit, status
  disappeared, `aria-busy=false`, both buttons re-enabled, and aggregate was
  `929/305`. Browser Back returned July `1,415/437`; Forward returned August
  `929/305`; buttons were enabled after both.
- Mobile `390×844` July and desktop `1440×900` current checks had no horizontal
  overflow, kept the month controls inside the viewport, and exposed both
  32×32 navigation buttons. Browser console warning/error, hydration, and runtime
  fatal counts were `0/0/0/0`.

#### Fact — Performance, Runtime, and Data Safety

- Sampler was fixed before measurement: same Head Coach role, exact origin,
  `icn1`, exact route, full document/RSC reload to visible month controls with
  `aria-busy=false`, one uncounted warm-up, then `20` warm samples per month.
  Percentiles use nearest rank.
- Corrected candidate current min/P50/P95/max was
  `5.875/6.379/7.683/10.636s`. Comparison baseline was
  `5.874/6.215/6.918/7.573s`: current P50 increased `0.164s`, within the
  `0.311s` tolerance, but P95 increased `0.765s`, above the allowed `0.346s`,
  and exceeded the absolute `5s` ceiling.
- Corrected candidate July min/P50/P95/max was
  `11.771/13.412/14.822/15.223s`, also exceeding the absolute `5s` P95 ceiling.
- Vercel server-side grouped visible buckets for the bounded authenticated window
  returned at least `1,211` records: displayed status groups were `1,034` HTTP
  200 and `177` HTTP 304. Reported top request-path groups included `136`
  Assignment routes and only non-API Coach/sidebar-prefetch paths. Direct
  filtered HTTP 5xx, error, and fatal counts were `0/0/0`. Raw log enumeration
  exceeded the `1,000` line cap and grouped output is top-limited, so exact total
  and complete path inventory are not reported.
- Notifications remained `25,154 → 25,154`, delta `0`, during the bounded test
  window. Shared Coach layout sources
  `createCoachCheckinWindowNotifications` / `createCoachAttendanceGapNotifications`
  therefore created `0/0` new rows in this window. DB fixture/write remained
  `0/0`; Production business data changed/repaired remained No/No.

#### Inference / Unknown

- The stable complete browser populations plus prior exact SELECT-only page proof
  support complete roster delivery on the candidate. Exact outbound Supabase call
  timing is not exposed by the available instrumentation.
- Authenticated RSC/document transferred bytes, exact wire bytes, and exact
  per-request Server metric are **Unknown**. No DOM-size proxy is labeled as wire
  bytes. Exact HTTP-method totals are also Unknown because the CLI query is
  full-text only and raw enumeration hit `1,000`; no API route appeared in the
  reported top path groups, and the browser workflow invoked no write control.
  Exact complete runtime total and path inventory are also **Unknown**.

#### State Observed at This Safe Handoff

Source Complete **Yes for scoped behavior**; Tests Passed **Yes — prior exact
Source suite `162` plus TypeScript/lint/mojibake/build/diff**; Performance Gate
**Failed**; Committed/Pushed **Yes for Source; containing documentation-only
safe-handoff commit follows**; staged artifact **READY/unaliased but blocked**;
READY FOR OWNER UAT **No**; Owner/Production UAT **Not run**;
Promoted/Production Active **No/No for this task**; Migration Source/Applied
**unchanged/retained**; Environment/Feature/Allowlist **unchanged**; Controlled
Write UAT **Not run/prohibited**; DB fixture/write **0/0**; Production Data
Changed/Data Repaired **No/No**; Customer/Financial Impact **None/None**; Scope
Expansion/Breach **No/No**; Documentation Drift **No after publication**; Task
Done **No**.

Material Hard Stop: mandatory current and July P95 gates failed after the
authorized bounded correction sequence, and this verification round prohibited
Source changes. Owner must decide whether to amend the Performance contract or
authorize a separate bounded performance-correction scope. Do not start Owner
UAT, Promote, alias, mutate data, alter Source, or begin another task.

### 2026-08-05 — Assignment Coach-Memory On-Demand Performance Correction Safe Handoff

This dated record supersedes the preceding Material Hard Stop as the current task
history. Owner retained the 5-second P95 contract and authorized a Source-only,
SELECT-only correction: authoritative roster/saved groups/assigned coaches/exact
memberships render first; historical pages never load Coach Memory; current
editable unassigned slots load it on demand with localized loading, single-flight,
and edited-draft protection. Promotion remains prohibited before exact-artifact
Owner PASS.

#### Fact — Gate 0, Audit, and Root Cause

- Fresh Gate 0 matched branch `spike/next-major-security-upgrade`, starting HEAD
  and upstream `10db4ea5670d76eb4d4648f5efacff9560dc423c`, ahead/behind `0/0`,
  and only protected stat-dirty `src/lib/schedule-slot-utils.ts`. Its SHA-256,
  worktree blob, and index blob remain
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181` /
  `4521281d099efb189429a744909552d67871ff23` /
  `4521281d099efb189429a744909552d67871ff23`; it was never edited, staged,
  reset, checked out, stashed, or normalized.
- Lifecycle migration Source remains
  `supabase/migrations/20260804000000_assignment_group_lifecycle_integrity.sql`,
  SHA-256 `47D1B3FD43F8E9F115AD72917C87BDD2DFE3D83FECB0FCE4419DF3593CC4ECC8`.
  Migration/config/package/environment/feature/allowlist changes and DB writes
  were zero. Official current Supabase documentation confirmed authenticated RLS
  context and that `.range(from,to)` is zero-based, inclusive, and depends on a
  deterministic order.
- Old-source non-PII phase sampling proved Coach Memory was initial critical-path
  fan-out. Current `[2026-08-05,2026-09-01)` had `905` roster rows / `295` slots /
  `1` page: auth/profile/branch `0.373s`, roster `0.663s`, groups/Legacy/levels
  `1.872s`, Coach Memory `1.825s`, assembly `0.003s`; memory alone made `35`
  outbound calls and returned `1,390,545` response-entity bytes. July
  `[2026-07-01,2026-08-01)` had `1,415/437/2`: phases
  `0.552/1.019/0.426/2.419/0.003s`; memory made `51` calls / `7,302` rows /
  `2,030,461` response-entity bytes. A direct July 437-ID supporting `.in(...)`
  request also failed locally with `TypeError: fetch failed`, proving a bounded
  request-size correction was required in primary supporting reads.

#### Fact — Regression-First Implementation and Verification

- Regression-first lifecycle source-only execution failed on the old initial
  `getCoachStudentMemoryMap` call. Final suite passes `33/33`, including zero
  historical/initial memory requests, SELECT-only typed endpoint guards,
  single-flight/deduplication, localized `กำลังโหลดประวัติโค้ช...`, `aria-busy`,
  edited-draft preservation, untouched-draft recommendation adoption, and all
  protected lifecycle assertions.
- Exact functional paths are
  `src/app/(coach)/coach/assign-groups/page.tsx`,
  `src/components/coach/assign-groups-client.tsx`,
  `src/lib/coach-student-memory.ts`, and new GET-only
  `src/app/api/coach/assignment-memory/route.ts`; exact test path is
  `scripts/check-coach-assignment-lifecycle.mjs`. The endpoint authenticates the
  server session, mirrors `head_coach/super_admin`, enforces exact Head Coach
  branch access, derives slot/roster scope server-side, rejects invalid,
  out-of-branch, historical/future/started/already-assigned/empty requests, uses
  no service role or mutation/RPC/logActivity/notification path, and returns only
  bounded non-PII aggregate metrics.
- Final deterministic gates passed lifecycle `33`, Admin Schedule assignment
  `38`, Admin Schedules performance `24`, Lesson Wallet `19`, Coach Teaching Hours
  `20`, and Assignment Resolution `33`: `167` assertions total. TypeScript,
  zero-warning ESLint, mojibake over `254` files, Next.js 16.2.6 production build
  and static generation `92/92`, and `git diff --check` passed. Functional/test
  commit `5d7c5c675f2dd5818e5b7116848385624cd8969a` (`842` insertions / `344`
  deletions) was normally pushed; branch was then `0/0`.
- Fresh corrected SELECT-only initial-read evidence retained complete populations:
  current `905/295/1`, `13` calls / `2,113` rows, phase durations auth
  `1.115s`, parallel coach+roster `1.052s`, groups/Legacy/levels `1.584s`,
  assembly `0.002s`; July `1,415/437/2`, `19` calls / `3,273` rows, phases
  `0.279/1.022/0.484/0.004s`. Supporting batches were current Legacy/groups/
  levels `3/3/2`, July `5/5/3`; no duplicate roster IDs, initial Coach Memory
  calls, Client Data API call, or N+1 existed. DB response entity bytes were
  `903,108` current / `1,435,742` July. Assembled JSON sizes `878,009` /
  `1,398,605` are explicitly not wire-byte evidence.
- Representative current unassigned-slot memory core had `11` learners and used
  `7` memory reads / `493` rows (`2` booking pages, `5` supporting batches).
  After one uncounted warm-up, 20 warm samples measured min/P50/P95/max
  `0.688/0.706/0.752/0.754s`. This passes the core 5-second bound but does not
  substitute for the required authenticated staged endpoint/browser gate.

#### Fact — Git, Staged Artifact, and Current Blocker

- Staged Production-target artifact
  `dpl_9MhH8A612dc3nXZBZBAeTPcsz7mV`, URL
  `https://new-athlete-badminton-school-6h76r0e9q-aachanin1s-projects.vercel.app`,
  is `production/READY`, runtime region `icn1`, aliases `[]`, source `cli`, and
  exact metadata `githubCommitSha=5d7c5c675f2dd5818e5b7116848385624cd8969a`.
  Metadata `gitDirty=1` reflects the protected stat-dirty helper whose worktree
  content equals its index; no task or unrelated content delta entered the
  functional/test commit. Current Production remains unchanged at
  `dpl_5KVSd4jqNB3tqYA1t9qHjb4VBHZC` / Source
  `03d08a93e77189d56b733bda009d9526400fa9b3`.
- The new hostname is Vercel-SSO protected. In-app browser SSO succeeded and the
  application reached `/auth/login?redirect=%2Fcoach%2Fassign-groups`; prior
  artifact application auth did not transfer. No credential was read or supplied.
  Before authenticated sampling, bounded runtime logs contained `7` HTTP 200 and
  `1` HTTP 307, with error/fatal/5xx counts `0/0/0`.
- Performance-failed `dpl_EY91eHqAk58Dqc7akvsUNLztsNjM`, runtime-failed
  `dpl_DBnGPPV6ioBt4jpkonC4TMXqL173`, blocked
  `dpl_9RE8BF4LL1awvGfWH5V2nTsCzFDm`, and rejected
  `dpl_8sYvgzXSEZfUKgfi6fd2ViQrxinJ` remain evidence only and must never be
  Promoted.

#### Inference / Unknown and State Observed at This Safe Handoff

- Proven initial fan-out removal and sub-second on-demand core evidence support
  the selected correction, but staged initial/endpoint P95 remains Unknown until
  authenticated browser sampling. Required current and July 20-sample
  min/P50/P95/max, exact navigation/RSC transferred bytes, current initial and
  historical memory request counts, on-demand endpoint request count/timing,
  desktop/mobile, repeated-click, Back/Forward, console/hydration, authenticated
  method inventory, notification delta/source, and protected-set pre/post evidence
  are Unknown / pending. No DOM proxy is reported as wire bytes.
- Source Complete **Yes for scoped Source**; Tests Passed **Yes**; Performance Gate
  **Pending authenticated staged proof**; Committed/Pushed **Yes/Yes**; staged
  artifact **READY/unaliased, not READY FOR OWNER UAT**; Owner/Production UAT
  **Not run**; Promoted/Production Active **No/No for this task**; Migration
  Source/Applied **unchanged/retained**; Environment/Feature/Allowlist
  **unchanged**; Controlled Write UAT **Not run/prohibited**; DB fixture/write
  **0/0**; Production Data Changed/Data Repaired **No/No**; Customer/Financial
  Impact **None/None**; Scope Expansion/Breach **No/No**; Documentation Drift
  **No after publication**; Task Done **No**.

Current blocker is external authentication, not a measured Performance failure.
Owner signs in as Head Coach on exact artifact
`dpl_9MhH8A612dc3nXZBZBAeTPcsz7mV` / exact Source
`5d7c5c675f2dd5818e5b7116848385624cd8969a`; Developer then resumes only the
approved read-only staged gates. Do not Promote, alias, mutate data, alter Source,
or start another task.

### 2026-08-05 — Authenticated On-Demand Candidate Performance Material Hard Stop

Owner authenticated Head Coach on exact staged Production-target artifact
`dpl_9MhH8A612dc3nXZBZBAeTPcsz7mV`, exact functional Source
`5d7c5c675f2dd5818e5b7116848385624cd8969a`, and authorized the remaining
read-only technical gates. No credential was inspected. No Save, Reschedule,
Wallet, Attendance, Check-in, Close Week, mutation API, Source, DB, data repair,
Migration, config, Environment, feature, allowlist, alias, or Promotion action
was authorized or performed.

#### Fact — Authenticated Current Gate

- Current Bangkok month rendered 5–31 August with live population `908` learner-
  sessions / `295` slots. The authenticated warm-up reached authoritative roster,
  groups, month controls, and month-level `aria-busy=false` in `2.718s`. Browser
  asset inventory contained zero `/api/coach/assignment-memory` request and zero
  task Supabase Data API request; browser console was empty.
- The first 15 measured full-document current loads were stable at `908/295` and
  completed with provisional nearest-rank min/P50/P95/max
  `1.995/2.367/2.748/2.748s`. They are diagnostic evidence only, not a compliant
  20-sample result.
- Sample 16 remained at the route-level `กำลังเปิดเมนู...` loading UI beyond the
  30-second readiness bound. It did not recover after an additional five seconds.
  A fresh recovery navigation repeated the same timeout. After allowing 30
  seconds for background prefetch/shared-route work to drain, a third navigation
  still failed inside the total 60-second harness bound. All three failures had
  zero observed initial Coach Memory asset, zero Client task Data API asset, and
  zero browser console error.
- Required 20 successful current samples were therefore not obtained. A valid
  current P95 cannot be reported. Under the Scope Contract the mandatory initial-
  load Performance Gate failed, so July 20-sample, staged on-demand memory,
  historical UI/read-only, repeated-click, Back/Forward, desktop/mobile, and
  interaction gates were stopped rather than used to mask the failure.
- Exact authenticated document/RSC transferred bytes are **Unknown**. The
  available browser capability exposed asset identities and kinds but no transfer
  sizes; DOM length was not used or relabeled as wire bytes.

#### Fact — Runtime, Method, and Data-Safety Evidence

- Bounded Vercel runtime evidence for the exact deployment reported Assignment
  path count `27`; raw Assignment entries were GET only. Top status groups were
  HTTP `200=105`, `307=12`, and `304=7`; direct error/fatal/5xx queries returned
  `0/0/0`. No `/api/coach/assignment-memory` or
  `/api/coach/assignment-groups` record was found in the bounded window. Route
  middleware records appeared for the late hangs without corresponding completed
  application readiness; no fatal/logged 5xx explained them.
- SELECT-only pre/post counts were groups `1,532 → 1,532`, exact memberships
  `3,504 → 3,504`, and Legacy assignments `1,504 → 1,504`. Task-attributable
  assignment/data writes were zero. `activity_logs` changed `11,088 → 11,091`,
  with aggregate actions `create_progressive_booking|booking=2` and
  `create_teaching_program|program=1`; booking sessions changed
  `4,365 → 4,370`. These are unrelated concurrent Production activity.
- Notifications changed `25,177 → 25,184`, all seven new rows typed `system`.
  Shared Coach layout functions create `reminder` notifications; observed
  `reminder` delta was zero, so their measured creation count was `0`. The seven
  concurrent system rows were retained and not deleted or repaired.
- Branch remained `spike/next-major-security-upgrade`; containing documentation
  HEAD/upstream before this closeout was
  `89379286064df7e406131db4c9a844e2d4981c7a`, `0/0`, with only protected stat-
  dirty `src/lib/schedule-slot-utils.ts`. Its SHA-256/index/worktree identity and
  lifecycle migration SHA-256 remained exact. Current Production was reverified
  unchanged at `dpl_5KVSd4jqNB3tqYA1t9qHjb4VBHZC` / Source
  `03d08a93e77189d56b733bda009d9526400fa9b3`.

#### Inference / Unknown — Root Cause and Stop Decision

- Old-source phase metrics proved initial Coach Memory was a major critical-path
  fan-out, and the first 15 authenticated candidate loads show that removing it
  materially improved normal-case latency. The three later hangs occur with zero
  initial memory request, however, so initial Coach Memory cannot explain the
  blocking condition by itself.
- Exact phase and outbound Supabase timing for the hung requests are **Unknown**.
  Potential shared-route/prefetch saturation or another Server read dependency is
  only a hypothesis. Selecting a second Source correction without new phase
  evidence would be speculative and would violate the approved Root Cause/scope
  discipline. This is a **Material Root Cause change / Material Hard Stop**, not
  a request to relax the `P95 <= 5.000s` contract.

#### State Observed at This Safe Handoff

Source Complete **Yes for scoped Source**; Tests Passed **Yes — `167` assertions
plus TypeScript/lint/mojibake/build/diff**; Performance Gate **Failed**;
Committed/Pushed **Yes for functional Source and prior safe handoff; containing
Material Hard Stop documentation commit follows**; staged artifact
**production/READY, aliases `[]`, Performance-failed and blocked**; READY FOR
OWNER UAT **No**; Owner/Production UAT **Not run**; Promoted/Production Active
**No/No for this task**; Migration Source/Applied **unchanged/retained**;
Environment/Feature/Allowlist **unchanged**; Controlled Write UAT **Not run /
prohibited**; DB fixture/task write **0/0**; Production Data Changed
**Task-attributable No; unrelated concurrent activity Yes as disclosed**; Data
Repaired **No**; Customer/Financial Impact **None/None**; Scope Expansion/Breach
**No/No**; Documentation Drift **No after publication**; Task Done **No**.

Next Action: Owner decides whether to authorize a new bounded investigation and
correction scope for the materially changed non-memory route hang. Do not resume
July/on-demand/Owner UAT, change Source, Promote, alias, mutate or repair data, or
start another task automatically. All five blocked/rejected artifacts remain
ineligible for Promotion.
