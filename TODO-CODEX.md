# TODO-CODEX.md - Active Execution Index

Last updated: 2026-08-21

This is the short current queue. Read `AGENTS.md`, `PROJECT_STATE.md`, and this
file first. Use `DEVELOPMENT_TODO.md` for detailed history and decision records;
use `TODO.md` only as stale legacy reference after code verification. Current
mutable state is authoritative only in `PROJECT_STATE.md`.

## Current Active Work

Status: **READY FOR OWNER UAT — NOT PROMOTED**.

- Active Task: **SCHEDULE LEARNING DETAILS — PARENT PROGRAM VISIBILITY + ADMIN
  FULL PROGRAM MODAL + USER/COACH LEVEL PARITY**. Owner selected Priority `1`
  and now approved the fixed 14-path UAT correction Scope Contract.
- Owner UAT rejected previous artifact `dpl_52gKBAoDW42zRcbGfsiKv9RG2EWE` /
  Application Source `7c32e924fdd76d88ce853dfde531f84a2123bc22`.
  It remains retained and unpromoted; Production aliases remain on
  `dpl_9bJyCeRVqy8wFz38zXqsjsCkB1JV`.
- The three corrections are committed and pushed: Parent visibility permits
  `submitted/approved/rejected` but hides `draft`; Coach Today shows exact-group
  Level range, nickname and exact-slot program/status/modal; Admin Review uses a
  validated Bangkok month/range server query with range-scoped stats and explicit
  errors. Proven Admin Runtime Root Cause was an ignored oversized schedule-slot
  `.in()` URI error after an all-history 800-row read, not Database/RLS/Schema.
- Owner superseded the high-variance dev-server certification with isolated
  Production builds and reverse order. Both complete sets passed: no User, Coach,
  Admin Schedule, Admin Review current-month, or historical scenario met both
  `>10%` and `>=100 ms` in the same direction. Product performance correction
  count remained `0`.
- Deterministic suites passed `215/215`; focused E2E `8/8`; full E2E `13/13`;
  skip/unexpected/retry/flaky `0`; fixture residue `0`; TypeScript, zero-warning
  lint, mojibake, and Production build passed. A non-visible User Schedule
  hydration-mismatch console observation is retained as a known limitation.
- Owner accepted the already-completed read-only hosted-Supabase `prod:check` as
  a valid Release Gate. The historical no-remote scope breach remains recorded;
  `prod:check` was not rerun and no additional Supabase read, remote write,
  repair, Environment change, customer impact, or financial impact occurred.
- Application commit `a63f4f5ab2ba89c8f54014b69c9eb9eeee594222`
  contains exactly the authorized Functional/Test/Config `7/3/1` paths and is
  pushed. The protected unrelated dirty file remains excluded and content-exact.
- Replacement staged Production-target artifact
  `dpl_rRAc546SKNMxSxFVAgkGYUofVkEg` is `READY` at
  `https://new-athlete-badminton-school-h3mjmme04-aachanin1s-projects.vercel.app`,
  has aliases `0`, and carries exact Application SHA `a63f4f5...`.
- Staged read-only smoke passed root/health/login/static `200`, protected schedule
  `307`, and anonymous program API `401` with `private, no-store`. Bounded
  warning/error/fatal/5xx counts were `0/0/0/0`; no Controlled Write UAT or
  Production data write occurred.
- Production aliases are unchanged on
  `dpl_9bJyCeRVqy8wFz38zXqsjsCkB1JV`; previous rejected artifact
  `dpl_52gKBAoDW42zRcbGfsiKv9RG2EWE` remains retained and unpromoted.
- Next action: Owner runs UAT against the exact replacement artifact/SHA and
  returns PASS or FAIL. Do not Promote automatically.

`PROJECT_STATE.md` is authoritative for the full mutable-state matrix.

## Recently Completed

Each entry below is a historical summary of state observed at that task's
closeout; artifact and alias wording does not override the current mutable state
in `PROJECT_STATE.md`.

### PROGRESSIVE PAYMENT — MANDATORY FULL PENDING-SCOPE BATCH

Status: **TASK DONE — OWNER UAT PASS; EXACT ARTIFACT PROMOTED WITHOUT REBUILD;
PRODUCTION VERIFICATION PASSED**.

- Owner passed `dpl_9bJyCeRVqy8wFz38zXqsjsCkB1JV` / Source
  `83c51d15b8bbde63ba4a22dcb409b1dfd3a17005`: two August Progressive members,
  `625 + 2,500 = 3,125` baht, no partial selection, mandatory-payment copy/button,
  and mobile layout passed.
- Promotion/retry/rebuild/redeploy/new-deployment counts are `1/0/0/0/0`; all
  four established aliases resolve to the exact artifact. Root/health/static/
  auth/API/log checks passed.
- Linked migration inventory remains `29`, v2 is present once, capability is
  ready, and all task payment/Storage fingerprints were unchanged. Four
  concurrent external Attendance writes were conclusively attributed and were
  not task-related. Production Data Changed/Repaired by this task is `No/No`.
- Environment, feature, allowlist, SlipOK, Source, tests, migration, and config
  were unchanged during closeout. Protected `src/lib/schedule-slot-utils.ts`
  remained excluded. See `PROJECT_STATE.md` and the dated closeout in
  `DEVELOPMENT_TODO.md`.

### ADMIN NOTIFICATIONS — AUTOMATIC DYNAMIC CUSTOMER FOLLOW-UP QUEUE

Status: **TASK DONE — OWNER UAT PASS; EXACT ARTIFACT PROMOTED WITHOUT REBUILD;
PRODUCTION VERIFICATION PASSED**.

- Exact Production artifact/SHA is `dpl_FG52gCxZhcfKsUdHuxSQ1eBwsGqq` /
  `21e45eed576014b8989ecc697c624ff2efc9122a`. Promotion/retry/rebuild/redeploy/
  new-deployment counts are `1/0/0/0/0`; all four Production aliases resolve to
  it. Rejected artifact `dpl_8jqKAnStXm1CxNXNu4x1kCuCHpx4` was not Promoted.
- Production root/health/static/auth/API/log and read-only data gates passed.
  Tracking remained `1/1/125/4`, status `115/6/4`, linked/current Sent `6/6`,
  actionable `77`, anomalies `0`; Developer Requests/Notifications/data writes
  were `0/0/0`. See `PROJECT_STATE.md` and the 2026-08-12 closeout in
  `DEVELOPMENT_TODO.md`.

### ADMIN NOTIFICATIONS RECOMMENDATIONS — FULL ROSTER + SEARCH + LEARNER NAMES + INELIGIBLE SYNC

Status: **TASK DONE — OWNER UAT PASS; EXACT ARTIFACT PROMOTED WITHOUT REBUILD;
PRODUCTION VERIFICATION PASSED**.

- Owner passed exact artifact `dpl_9V1fwFzFFgcuKUXHueFGFrDa4gED` / Source
  `a23915959e393b760bb6b0f1c8f57a0054a839de`, accepted `ประวัติคอร์ส:`, and
  confirmed the two-recipient Bulk Send as the Owner's UAT action. Owner accepted
  baseline `1/1/125/4`, status `119/6/0`, linked Notifications `6`, and preserved
  all six Sent rows without Sync or rollback.
- One exact `vercel promote` invocation moved the same deployment to Production.
  All four established aliases point to it; deployment ID, build identity,
  timestamps, Git SHA, and URL remained unchanged, so rebuild/new deployment was
  `0/0`.
- Root, health, promoted static asset, normal Admin auth redirect, protected API,
  post-Promotion logs, and Supabase before/after invariants passed. Promotion
  Requests/Notifications, Sync/Reconcile, tracking writes, errors/fatal/5xx/POST,
  and rollback were all `0`.
- Promotion-closeout Functional/Test/Documentation/Migration/Config/Dependency
  changes were `0/0/3/0/0/0`; Environment, feature, allowlist, permission, and
  secret state did not change. See `PROJECT_STATE.md` and the dated
  `DEVELOPMENT_TODO.md` closeout for exact evidence.

### ASSIGNMENT GROUP LIFECYCLE INTEGRITY

Status: **TASK DONE — OWNER UAT PASSED; EXACT ARTIFACT PROMOTED WITHOUT REBUILD;
PRODUCTION VERIFICATION PASSED**.

- Owner passed exact artifact `dpl_76Bc1Qi8F6au7zEYiwCpCztu1JRP` / Application
  Source `19471d9a3a728e42def5500a86cc91ce1da4a1e8`. One Promote invocation moved
  the same deployment to Production; retry/rebuild/redeploy/separate alias/
  rollback counts were `0/0/0/0/0`.
- All four established Production aliases point to that exact artifact. Identity
  and creation/build/ready timestamps were unchanged; no deployment was created
  by Promotion. Production root/health/real CSS/auth protection and bounded
  runtime log gates passed.
- Promotion-closeout functional/test/migration/config changes were `0/0/0/0`.
  DB fixture/write was `0/0`; Production data, Environment, Feature, Allowlist,
  customer data, and financial state were unchanged. The old timeout Root Cause
  remains an Owner-accepted Unknown historical limitation.
- Next action: await a new Owner-selected task. `PROJECT_STATE.md` is authoritative.

### ADMIN PAYROLL ACCURACY + PERFORMANCE

Status: **DONE — OWNER PREVIEW UAT PASSED; OWNER PRODUCTION UAT PASSED; ACCEPTED
PRODUCTION ARTIFACT ACTIVE; FOUR ESTABLISHED ALIASES CONVERGED**.

- Owner passed Preview `dpl_7xuum5V7aFNxMeYSFnLqD2H8kdbY` and accepted/passed
  Production artifact `dpl_5KVSd4jqNB3tqYA1t9qHjb4VBHZC`, both at Application
  Source `03d08a93e77189d56b733bda009d9526400fa9b3`.
- Two and only two authorized `vercel alias set` actions exited `0`. All four
  established Production aliases now point to the accepted artifact; alias
  inventory remains eight. No deployment/build, Promotion, retry, redeploy,
  rollback, alias addition, or alias deletion occurred in the convergence gate.
- Production root/health/real-CSS/Payroll-auth/log checks passed. Deterministic
  completeness and Payroll performance reruns passed `18/18` and `14/14`,
  including Cake `5/10`, Dome Private `1h`, and summary/detail equality.
- Functional/Test/Migration/Configuration changes were `0/0/0/0`. Environment,
  feature controls, allowlists, Production data, financial data, and Close Week
  were unchanged. The accepted Vercel rebuild is recorded as a release-workflow
  correction, not a Payroll Source defect.
- Future no-rebuild exact-artifact releases must stage Production with
  `vercel --prod --skip-domain`, UAT that exact staged Production artifact, and
  Promote that staged artifact. Preview artifacts must not carry a no-rebuild
  contract.
- Assignment Group Lifecycle Integrity was subsequently selected by the Owner;
  its current blocked state is recorded above. LINE External-Browser Handoff
  Audit, Thai UI Terminology & Shared Helper, and every other Parking Lot
  candidate remain Owner-selection-only and unauthorized.

### MOBILE PAYMENT SLIP CTA VISIBILITY AND SCROLLABILITY

Status: **DONE — OWNER UAT PASSED; EXACT ARTIFACT PROMOTED WITHOUT REBUILD;
PRODUCTION ALIAS, HEALTH, CSS, ROUTE-PROTECTION, AND RUNTIME-LOG GATES PASSED**.

- Owner passed exact artifact `dpl_8qh3E8rEfVbWFyArqc48qNJW8arG` at Application
  Source `1c43a160a15932844a7c9fcee5e1cf0d30792f60`. One Promotion invocation
  succeeded; retry/rebuild/redeploy/separate-alias/rollback counts were all zero.
- All four established Production aliases now serve the exact artifact. Root,
  health, real CSS, unauthenticated History protection, and bounded error/fatal/
  5xx/payment-related failure checks passed.
- Promotion-gate Functional/Test/Migration/Configuration changes were `0/0/0/0`.
  Environment, feature controls, allowlists, payment semantics, and Production
  data were unchanged. Customer-visible mobile Dialog behavior is now active;
  financial impact is none.
- The pre-existing dirty `src/lib/schedule-slot-utils.ts` remains excluded.
  LINE external-browser handoff remains Parking Lot only and unauthorized.

### PROGRESSIVE SLIP UPLOAD — OWNER TEST CLEANUP + EXACT-ARTIFACT PRODUCTION CLOSEOUT

Status: **DONE — EXACT TEST DATA REMOVED; ARTIFACT
`dpl_2SCF7xZMovQ1SGkyqJrqf86Rmzne` / SOURCE
`1cb6daa4c4186fae55d3312d6199c1a47ca4ffa4` PROMOTED WITHOUT REBUILD;
PRODUCTION RECONCILIATION, HEALTH, RUNTIME LOGS, AND SURFACE CHECKS PASSED**.

- Verified encrypted backup and in-transaction encrypted snapshot passed restore
  and integrity checks before commit. The transaction locked `45` target schedule
  slots, resolved the current target-only assignment UUIDs by child ownership,
  and detected no timeout, shared real learner, or post-lock concurrent target row.
- Committed deletes: child `1`, bookings `14`, sessions `48`, payments `2`, scopes
  `2`, receipts `21`, batches `18`, members `25`, attempts `3`, allocations `3`,
  target assignment memberships/groups `4/4`, and notifications `7`. Storage
  removed exactly `6 + 3 = 9` backed-up objects. Rollback/restore was not used.
- Parent profile/Auth remained `1/1`; Parent notifications remained `13`; the
  Owner-approved 70 activity logs were not deleted or updated. Shared/protected
  groups, memberships, slots, Coach assignments/check-ins, and non-target sessions
  were unchanged. Existing `schedule_slots.current_students` cache state was
  explicitly outside scope and was neither repaired nor reconciled.
- Independent reconciliation returned target child and all exact dependencies,
  Storage objects, Ledger/payment-review rows, and target names as zero. Test
  Ledger reporting decreased exactly `5` rows / `฿4,450`; no customer data, real
  cash, refund, credit, coupon, wallet, Finance, attendance, or payroll changed.
- Exact artifact Promotion invocation/retry/rebuild/redeploy/separate-alias/
  rollback counts were `1/0/0/0/0/0`. All four Production aliases map to the exact
  artifact; creation/build/ready timestamps were unchanged. Root, health, static
  asset, route protection, bounded logs, post-Promotion DB reconciliation, and
  authenticated/public target-name surface checks passed.
- Functional/Test/Migration/Configuration file changes: `0/0/0/0`. This closeout
  changes only `PROJECT_STATE.md`, `TODO-CODEX.md`, and `DEVELOPMENT_TODO.md`.
  The pre-existing dirty `src/lib/schedule-slot-utils.ts` remains excluded.
- Production Data Changed: Yes, exact test data only. Customer Impact: None.
  Financial Impact: test Ledger `-5 / -฿4,450`; no refund or cash movement.
- Next action: await Owner selection; Parking Lot remains unchanged and
  unauthorized.

### POLICY RESET — OWNER UAT + CONTINUOUS DELIVERY

Status: **DONE IN THE PUBLISHED STATE — PM-NA HAS ONE LOCAL INITIAL COMMIT; TARGET
HAS THREE EXACT POLICY/DOCUMENTATION COMMITS AND ONE NORMAL PUSH; APPLICATION AND
PRODUCTION UNCHANGED**.

- Owner approved One Task, One Approval, Continuous Delivery with a strict Scope
  Contract, bounded corrections, Code Complete, READY FOR OWNER UAT, exact
  artifact/SHA Owner PASS and Promotion, automated post-Promotion checks, one
  closeout update, material Hard Stops, and No Yes-Man rules.
- Target baseline commit is
  `ddc2a15805f75b83234bca217ab6cf2e90608334`; Target policy commit is
  `230085958466558cce493e0a6226b1f361320de3`; the containing closeout commit has
  exact membership `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`. Its SHA and post-Push equality are reported in the final
  handoff; no fourth documentation commit is authorized.
- PM-NA local Initial Commit
  `ec810411157dfb72bc27fc5986a087fc1d1334ac` contains exactly `AGENTS.md` and
  byte-unchanged `TARGETS.md`; PM-NA has no remote and was not pushed.
- Functional File Count is `0`. Application Source, tests, Migration,
  configuration, Environment, Production, and data are unchanged. Application
  tests/build/browser UAT were Not Run because they are outside Scope.
- Manual Deploy/Promotion/Alias/Environment/Production action: **No**. Automatic
  Preview from the Target Push is an accepted Git-integration side effect only;
  it is not Production and receives no manual retry, Promotion, or Alias.
- Production Data Changed: No. Customer/Financial impact: None. Speed Insights:
  Not started. Documentation Drift: No.
- Next action: await Owner selection of a product task.

### PROGRESSIVE KIDS GROUP MULTI-BRANCH CREATE + PENDING EDIT

Status: **DONE — SOURCE/TEST COMMITTED AND PUSHED; EXACT ARTIFACT
PRODUCTION/READY/PROMOTED; RENDERED PRODUCTION UAT PASSED AFTER READ-ONLY POST
ATTRIBUTION; CONTROLLED RESTORE AND POST-UAT SELECT-ONLY VERIFICATION PASSED;
FINANCIAL IMPACT NONE**.

- Published release Source is
  `244853f5132393f0336d504362e81a45dec19101`, tree
  `b20afa51a2fd31e7ab5e8ae0ab973dbcd0c83f2f`; Functional/Test Commit A is
  `7110e6a49ce909635057c06bf0bcb7cf1b371ae6`. Accepted Local evidence remains
  rendered focused `1/1 + 1/1`, full booking E2E `11/11`, skipped/unexpected/
  flaky/retries/residue `0/0/0/0/0`, TypeScript, zero-warning ESLint, mojibake
  `250`, and build/static generation `91/91`.
- Exact artifact `dpl_9aqADgizA8jdh5WXsT84LPgb4gyt` is
  `production/READY/PROMOTED` with all four established Production aliases. The
  one Promotion invocation exited `0`; retry/rebuild/rollback/separate alias
  counts were `0/0/0/0`. Remote builder CLI `58.4.0` remains an Owner-accepted
  exception for this artifact only.
- Source proves automatic Edit-draft POSTs to `/api/bookings/availability` and
  `/api/bookings/preview` are authenticated read-only validation/calculation; the
  only RPC is SELECT-only `STABLE` `progressive_legacy_baseline_v1`. Actual Edit
  Save uses `PUT /api/bookings`.
- Exact Production UAT logs contain one `200` for each expected read-only POST and
  no PUT, booking-create POST, PATCH, DELETE, unexpected write endpoint, 4xx/5xx,
  or runtime error. Rendered UAT showed 10 sessions, all three branches, 4,330
  baht, restored 7 August row, no 11 August replacement, and no
  `PROGRESSIVE_INVALID_REQUEST` or console/page error.
- Post-UAT `BEGIN TRANSACTION READ ONLY` returned `transaction_read_only=on` and
  verified the target booking at 10 sessions/3 branches/4,330 baht, entitlement
  `10`, rate `433`, canonical links `10/10`, original/replacement tuple counts
  `1/0`, and all protected-domain/UAT-attributable mutation counts `0`.
- Functional File Count is `0` for this closeout. No Source/Test/config,
  environment, feature, allowlist, booking, DB/RPC, payment, coupon, Ledger,
  Finance, or customer-data mutation occurred. Automatic Preview from the docs-
  only Push is an accepted Git-integration side effect only and must not be
  promoted or aliased.
- Customer impact: the correction is Production-active and verified. Financial
  impact: none. Documentation Drift: none after the closeout commit/push.
- Next action: await Owner selection; Parking Lot remains unchanged and
  unauthorized.

### RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY FALLBACK ISOLATION

Status: **DONE — REQUEST-SIZE FIX COMMITTED/PUSHED; OWNER-ACCEPTED PARTIAL STAGED
UAT COMPLETE; EXACT ARTIFACT READY/PROMOTED AND PRODUCTION-ACTIVE; CANONICAL
PRODUCTION RENDER/SAFETY PASSED; READ-ONLY ATTRIBUTION PROVED ALL SEVEN ASSIGNMENT
POSTS WERE CONCURRENT OTHER-USER TRAFFIC; PRODUCTION UAT AND CONTROLLED WRITE UAT
PASSED WITHIN THE OWNER-APPROVED NATURAL-NOTIFICATION LIMITATION**.

- Owner Plan A: User Reschedule-in never inherits a coach automatically, including
  genuine legacy-only slots. Legacy remains compatible only for legitimate
  non-User-Reschedule learners; Head Coach Save persists the Exact membership.
  `rescheduled_from_id` is shared provenance, so Makeup uses `is_makeup` and Wallet
  uses batched `lesson_wallet_credits.redeemed_session_id`; Wallet/Makeup semantics
  are unchanged.
- Scoped Coach/Admin consumers now exclude pending User Reschedule-in from Legacy
  roster/access/history/program/check-in/payroll/Attendance Gap attribution while
  preserving mixed-slot legitimate learners. Exact/provenance failures fail closed.
  Assignment-review reports now keep Admin/Super Admin and Head Coach recipient
  lookup, empty required set, existence, insert, success, and skipped results
  distinct. Required Admin/new-branch Head Coach audiences—and old-branch Head
  Coach when Exact membership was removed—fail with `recipient_empty` when empty.
  A post-commit Reschedule still returns `success:true` with
  `ASSIGNMENT_REVIEW_NOTIFICATION_FAILED`, complete activity totals/details, and
  console evidence rather than a retry-inducing 5xx.
- Exact staged-Deploy Source `39a56d3ad6fa79322ad7cb534b68a12214d4b99f`
  contains functional ancestor `54752bcc2a914b7d2f67f344c62e50f642f890ac`.
  Fresh Release Readiness passed focused behavior `29/29`, Admin assignment
  `38/38`, Wallet
  `17/17`, notification date `26/26`, TypeScript, ESLint with zero warnings,
  mojibake `250`, diff check, secret-like scan `0` across `1,974` functional added
  lines, and fresh Next.js compile/type/static generation `91/91`. Two deterministic
  scripts emitted `MODULE_TYPELESS_PACKAGE_JSON` notices but exited `0`; these were
  not ESLint warnings.
- Isolated loopback root smoke returned HTTP `500` after the authorized Supabase-
  environment scrub; root smoke did not pass. Owner accepts the unchanged proxy/
  middleware configuration requirement as a Known Local Environment Limitation,
  not evidence of this task's Source regression. No Supabase, Vercel, Production,
  credential, or remote fallback was used. Local DB/E2E and Attendance Gap fixture
  UAT remain Not run; fixture residue is `0`.
- Local housekeeping residual: `C:\Users\aacha\AppData\Local\Temp\codex-release-readiness-7286748-audit\node_modules`
  remains a Junction to this repository's `node_modules`. It is not a dependency
  copy or Deploy blocker, does not affect tracked/Production state, and must not be
  recursively deleted; cleanup is outside this gate.
- The Owner-approved staged-Deploy command was invoked once from a clean detached
  exact-source worktree, but Windows PowerShell Execution Policy blocked the
  selected cached `vercel.ps1` shim before the deploy process entered Vercel CLI
  or any authorized control-plane write began. No retry was attempted. Explicit-
  GET postflight found deployment inventory added/removed `0/0`, exact-SHA
  Production-target READY/STAGED artifacts `0`, and all four Production aliases
  plus branch Preview
  mappings unchanged. The disposable deploy worktree was removed safely.
- A separately Owner-authorized retry then used exact `node.exe` plus cached Vercel
  CLI `56.5.0` entrypoint once—never bare `vercel`, `.ps1`, `npx`, PATH change, or
  Execution Policy bypass—and created exact Production-target artifact
  `dpl_7g4Kt6VrZKrzugttUCNrqVDa2nDM`. It is `READY/STAGED`, unpromoted,
  `autoAssignCustomDomains=false`, and has zero aliases. Remote Next.js `16.2.6`
  compile/TypeScript/static generation `91/91` passed with bounded build-log error
  count `0`. The retained remote install audit notice was `7 vulnerabilities`
  (`1 low`, `6 high`); no dependency was changed. Production aliases remain on
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`, Preview mappings are unchanged, no
  application request occurred, and the retry worktree was removed safely.
- The Owner-approved authenticated read-only staged-UAT gate passed fresh Git and
  Vercel artifact/alias preflight, then Hard Stopped before browser access. Exact
  Source proves every Head Coach `/coach/*` render passes through the shared Coach
  layout, which invokes service-role notification generators; their delivery path
  can insert a missing `notifications` row. The no-data-change contract therefore
  cannot be guaranteed. Chrome/session inspection, application requests,
  desktop/mobile and natural-row UAT, and bounded application runtime logs were
  not run. Bounded exact-artifact logs for the closed evidence window contained
  events/error/fatal/4xx/5xx `0/0/0/0/0`. Application GET/HEAD/mutation counts
  were `0/0/0`; artifact and Production aliases remained unchanged.
- Owner then authorized a Super Admin-only zero-data-change retry and explicitly
  accepted that Head Coach role-specific UAT would remain Not run. Fresh Git and
  Vercel preflight passed. Static tracing confirmed Super Admin bypasses the shared
  Coach-layout generator and that the assignment page/client does not mutate on
  render or mount. The gate nevertheless Hard Stopped before Chrome connection:
  the visible `/coach/notifications` sidebar `<Link>` retains default Next.js
  viewport prefetch, while that destination page invokes service-role notification
  generators for any authenticated user and may insert. Session role, staged pages,
  desktop/mobile, natural rows, and browser network/console were not inspected.
  Application requests and mutations were `0`; bounded exact-artifact logs were
  empty, and artifact/Production aliases remained unchanged.
- Owner superseded only the Super Admin-only and zero-data-change constraints and
  authorized a bounded retry through an existing Head Coach session. The only
  permitted writes were natural `notifications` reminder INSERTs from the two
  Coach-layout generators through `deliverCoachNotificationOnce()` with the exact
  approved check-in/attendance-gap title-link fingerprint. Save and every other
  mutation remained prohibited. Fresh Git/documentation/Source/Vercel preflight
  passed, including the exact 16-file membership and unchanged artifact/aliases.
- The exact staged `/coach/assign-groups` URL was opened once at `1920x855`, but
  Chrome redirected to `/auth/login?redirect=%2Fcoach%2Fassign-groups`. The visible
  login form could not prove Head Coach identity, so the gate Hard Stopped without
  login, reload, retry, controls, business-page render, mobile UAT, or natural-row
  inspection. Exact-artifact logs recorded GET `8`, HEAD `0`, and
  POST/PUT/PATCH/DELETE `0/0/0/0`; errors/fatal/4xx/5xx were `0/0/0/0`.
  Coach-layout generator invocation and notification delta were `0` from available
  evidence; non-notification mutation was `0`; no Direct Supabase access occurred.
  Postflight reconfirmed exact Git/artifact identity, zero staged aliases, unchanged
  deployment inventory, and all four Production aliases on the prior artifact.
- Owner then confirmed the staged Head Coach session and authorized one retry on
  the same artifact. Fresh Git/documentation/Source/Vercel gates passed. Existing
  visible staged `/coach` state proved `โค้ช Super Head Coach(หัวหน้า)` and the
  Head Coach-only assignment menu; the unread badge was already `99+` before the
  window. The exact `/coach/assign-groups` URL opened once and stayed on the staged
  hostname, but failed before business content rendered with `This page couldn’t
  load`, digest `233653541`. Exact-artifact logs identified
  `CoachAssignmentDataUnavailableError: Coach student history exact membership
  query failed: Bad Request`. The gate Hard Stopped without reload/retry, mobile
  resize, control interaction, Save, or natural-row inspection. Desktop business
  rendering Failed; mobile, branch scope, Pending User Reschedule isolation, Exact
  precedence, genuine Legacy fallback, Wallet, and Makeup were Not observable.
  Bounded requests were GET/HEAD `9/0`, POST/PUT/PATCH/DELETE `0/0/0/0`, and all
  non-notification mutations `0`; attributable browser/runtime errors were `1/1`,
  fatal/4xx/5xx `0/0/0`. Allowed notification invocation/delta, Production Data
  Changed, and Customer Impact are `Unknown / Need verification` without
  prohibited Direct Supabase access. Postflight preserved exact Git/artifact and
  Production alias state.
- Owner then authorized read-only Vercel/Supabase/PostgREST diagnosis, a narrow
  Source fix only after proof, focused Local tests/build, and local documentation.
  Gate 0 passed. The exact full membership query reproduced the staged failure
  once: 1,048 distinct IDs, 41,125-byte GET, HTTP `400 Bad Request`, and sanitized
  fields `code/details/hint=null`, `message=Bad Request`. The identical select and
  named FK succeeded in 11 batches of at most 100 IDs with 2,125–4,153-byte URLs
  and HTTP `200` throughout. Combined `1,041` rows and deterministic ID-set MD5
  `6071ed50a4986e3557ace397b45729ef` matched independent paginated SELECT evidence.
  FK, grants/exposure, RLS, and policies were present; no target batch had a
  relationship, permission, schema-cache, or syntax error.
- Local `src/lib/coach-student-memory.ts` now deduplicates history session IDs and
  batches only the proven failing exact-membership lookup at 100, combines rows,
  and keeps `CoachAssignmentDataUnavailableError` fail-closed with batch-number
  context. `scripts/check-coach-assignment-resolution.mjs` adds four deterministic
  regressions. Fresh results: assignment `33/33`, Admin `38/38`, Wallet `17/17`,
  notification `26/26`, TypeScript pass, ESLint zero warnings, mojibake `250`, and
  Next.js build/static generation `91/91`. The actual helper repeated the same
  1,048-ID workload as 11 successful GETs and returned the expected 1,041-row/hash
  result. Two retained `MODULE_TYPELESS_PACKAGE_JSON` notices occurred in the
  Admin/Wallet scripts; no test failed.
- Owner authorized and completed the publication gate as two exact commits followed
  by one normal non-force push. Functional commit
  `8166d669165e1dc51e71897423c7aeab524d9050` contains only
  `src/lib/coach-student-memory.ts` and
  `scripts/check-coach-assignment-resolution.mjs`; the following documentation
  publication commit contains only the three current-state documents. Its exact
  content-derived SHA/tree and verified post-push local/upstream/origin/live-Remote
  equality are reported in the gate handoff. No PR, tag, release, Deploy,
  Promotion, alias movement, staged-UAT retry, browser, Vercel, or Supabase access
  occurred.
- Owner then authorized at most one new Production-target staged deployment from
  exact HEAD `7b7dd912d46b28d4ca299c9221f53abe4c67d075`, tree
  `b488c57e9eec3a1e746a2b9d9a37bbd8288b1e7e`, through the pinned Node/Vercel
  CLI `56.5.0` entrypoint and `--skip-domain`. Fresh Git/live-Remote, protected
  hashes, project/linkage, duplicate-artifact, alias, and newer-Production checks
  matched. Exact-SHA Preview `dpl_o3jCUwo95Mt8hHSQm3Wrx7QPnbbx` was allowed;
  exact-SHA Production `READY/STAGED` count was `0`.
- The clean detached worktree matched exact HEAD/tree and staged/untracked `0/0`.
  The immediate Gate 0 script nevertheless exited `1` before the deploy line
  because it compared Git's literal tab-delimited ahead/behind output `0\t0` with
  `0 0`. Read-only diagnosis proved every Git identity matched and normalized
  ahead/behind was `0/0`, but the Owner's no-retry rule required a Hard Stop.
  Deploy invocation/process/control-plane counts are `0/0/0`; no new artifact or
  remote build exists.
- Explicit-GET postflight retained bounded deployment count/hash `100` /
  `0DDB90A44E80ADA7C8CB171BD391A3E1D4BB9ABF5656FF98B39C84278365A189`, maximum
  created time `1785332518781`, exact-SHA Production count `0`, and alias
  count/hash `8` /
  `BEC3771B0B721090AA765678B701EC66187FD1A7C33E866E241CD08EAA919644`.
  All four Production aliases still target
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; all four branch Preview mappings are
  unchanged. Promotion/alias/manual mutation and application/Supabase/data
  request counts are `0`. The disposable worktree was safely removed and its
  registration is `0`; the protected residual Junction was untouched.
- Owner authorized a fresh attempt and allowed only ephemeral helper corrections
  for formatting/tooling errors before deploy launch. Phase A helper correction/
  run/rerun was `1/1/0`: it parsed ahead/behind numerically and used compatible
  instance SHA-256 APIs. Fresh Git/live-Remote, five-file root status, protected
  hashes, project/linkage, exact-SHA duplicate, alias, and newer-Production gates
  passed. The validated temporary evidence file retained the sorted 100-ID list
  and eight alias mappings.
- Exactly one pinned `deploy --prod --skip-domain` process ran, exit `0`, and
  created exact-HEAD artifact `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M` at
  `https://new-athlete-badminton-school-7zqvx0cel-aachanin1s-projects.vercel.app`.
  It is `production/READY/STAGED`, `autoAssignCustomDomains=false`, aliases `0`,
  exact SHA/tree, unpromoted, and not Production-active. Created/building/Ready
  were `2026-07-29T14:27:14.964Z`, `2026-07-29T14:27:16.669Z`, and
  `2026-07-29T14:28:48.948Z`.
- Remote `npm ci`, Next.js `16.2.6` compile, TypeScript, and static generation
  `91/91` passed in `cle1`, with build-error count `0`, project Node `24.x`, and
  functions region `icn1`. The gate nevertheless Hard Stopped because exact build
  logs show remote Vercel builder CLI `58.1.0`, not the required `56.5.0`; local
  invocation/inspection CLI remained pinned at `56.5.0`. No deploy retry is
  allowed after process launch.
- Postflight added exactly the new artifact and removed only bounded-window oldest
  ID `dpl_4sJBJPvPJTumPNYWywcTqSC4pvUw`; pre/post inventory hashes were
  `0DDB90A44E80ADA7C8CB171BD391A3E1D4BB9ABF5656FF98B39C84278365A189` /
  `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C`.
  Exact-SHA Production `READY/STAGED` changed `0 → 1`. Alias count/hash and all
  eight Production/branch Preview mappings remained unchanged. Postflight helper
  correction/rerun was `2/2`: stderr `NativeCommandError` handling, then correct
  separation of timestamped remote CLI from the local banner. The worktree was
  safely removed and unregistered; evidence file was retained in Temp.
- No business rule, migration/schema/grant/RLS/RPC, package/lockfile/environment,
  additional functional file, Supabase data, Commit, Push, rebuild/redeploy,
  Promotion/alias, browser, or UAT changed. The new artifact contains the fix but
  is blocked by the remote CLI acceptance mismatch; Production aliases and runtime
  remain unchanged. Authoritative current state and the full evidence are in
  `PROJECT_STATE.md` and the latest dated `DEVELOPMENT_TODO.md` record.
- Owner accepted remote builder CLI `58.1.0` only for
  `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M` and authorized a bounded existing-Head-Coach
  staged UAT. Fresh Git/live-Remote, Source automatic-write, artifact, inventory,
  and alias gates passed. The exact route opened once at `1920x855` but initially
  displayed `/auth/login?redirect=%2Fcoach%2Fassign-groups`; Head Coach identity
  was therefore unproved and the gate Hard Stopped without login, reload, retry,
  mobile resize, business-row inspection, Save, or any control interaction.
  During read-only evidence collection the tab automatically moved to `/coach`,
  but the assignment route was not reopened and UAT did not resume.
- Bounded canonical artifact logs recorded GET/HEAD/POST/PUT/PATCH/DELETE
  `49/0/0/0/0/0`, assignment Save POST `0`, status `200` throughout, and
  fatal/error/4xx/5xx `0/0/0/0`; browser console warnings/errors were `0`.
  Forbidden mutations were `0`. Notification delta is **Unknown / Need
  verification — Direct Supabase prohibited**. Artifact/inventory/Production and
  Preview alias postflight remained unchanged; no Deploy/rebuild, Promotion,
  alias movement, Source change, Commit, or Push occurred.
- Owner confirmed the existing staged Head Coach session was ready and authorized
  a fresh bounded retry on the same artifact. Before assignment navigation, the
  existing exact-host `/coach` tab visibly proved `โค้ช Super Head Coach(หัวหน้า)`,
  the Head Coach-only `แบ่งกลุ่มนักเรียน` menu, exact staged hostname, and unread
  badge `99+`. No new tab/profile or login/re-authentication was used.
- The exact `/coach/assign-groups` route opened once at desktop `1920x855`, with
  reload/retry `0/0`, and rendered real branch-scoped business content. The prior
  digest `233653541`, `CoachAssignmentDataUnavailableError`, Server Component,
  console, hydration, visible overlay, and responsive errors were all `0`. The
  same tab then passed mobile `390x844` without reload, horizontal overflow, or
  clipped text; viewport override was reset and the Owner tab was left open.
- Natural evidence showed a Legacy coach explicitly labelled as not responsible
  while Exact groups and assigned coaches remained authoritative, so Exact-
  membership precedence passed. Pending User Reschedule isolation, genuine
  Legacy-only fallback, Wallet preservation, and Makeup preservation were **Not
  observable — no natural representative row**. No control was clicked or changed.
- Bounded artifact logs for `2026-07-29T15:07:02.492Z` through
  `2026-07-29T15:09:55.576Z` contained `26` unique log IDs and `25` canonical
  requests. GET/HEAD/POST/PUT/PATCH/DELETE were `25/0/0/0/0/0`; every canonical
  response was `200`; assignment Save POST, Save clicks, and non-notification
  mutations were `0/0/0`; fatal/error/4xx/5xx were `0/0/0/0`. Notification delta
  is **Unknown / Need verification — Direct Supabase prohibited**.
- Read-only postflight preserved exact artifact/SHA/`production/READY/STAGED`/
  zero-alias state, bounded inventory count/hash/max-created/newest ID, and all
  eight Production/Preview alias mappings. Added/removed deployment IDs were
  `0/0`; Deploy/rebuild/redeploy/rollback/retry, Promotion, alias mutation,
  Source/Test/config, Commit, and Push counts were all `0` in this UAT retry.
- Owner accepted the Partial staged-UAT result because Pending User Reschedule,
  genuine Legacy-only fallback, Wallet, and Makeup retain deterministic regression
  coverage, then authorized exactly one pinned Promotion of
  `dpl_GWfmXNEHFQCeSQZZfqRh1BZnPg7M`. No Production application/browser UAT was
  authorized in that gate.
- Fresh Promotion Gate 0 matched exact Git/local/upstream/live Remote, five-file
  root status, protected hashes, project/team linkage, local CLI `56.5.0`, artifact
  `production/READY/STAGED`, retained timestamps/build, deployment inventory, and
  all eight alias mappings. The target was newest and no newer conflicting
  Production artifact existed.
- Exactly one pinned `vercel promote` process/control-plane command ran from
  `2026-07-29T15:30:02.7083065Z` through `2026-07-29T15:30:08.2740790Z`, duration
  `5.566` seconds, exit `0`. Promotion invocation/process/control-plane counts were
  `1/1/1`; retry/Deploy/rebuild/redeploy/rollback/separate-alias/manual-mutation
  counts were all `0`.
- GET-only postflight proved the same exact artifact is
  `production/READY/PROMOTED`; SHA/URL/created/building/Ready timestamps and build
  are unchanged. Deployment count/hash/max-created remained `100` /
  `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C` /
  `1785335234964`; added/removed IDs were `0/0`.
- All four established Production aliases moved from
  `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4` to the exact target, with missing/extra/wrong
  mappings `0/0/0`. All four branch Preview mappings remained unchanged. The prior
  artifact remains `READY` and listed as a rollback candidate; no rollback ran.
  Production is now Active.
- Owner then authorized one bounded canonical Production UAT using the existing
  authenticated Head Coach tab. Fresh Git/live-Remote, Source automatic-write,
  artifact, deployment, and alias gates passed. Before navigation, exact hostname,
  visible `โค้ช Super Head Coach(หัวหน้า)`, the Head Coach-only
  `แบ่งกลุ่มนักเรียน` menu, and unread badge `99+` proved the required session.
  No new tab/profile, login, re-authentication, cookie/session inspection, or
  notification-page access occurred.
- The canonical `/coach/assign-groups` route opened once, with reload/retry `0/0`.
  Desktop `1920x855` and same-tab mobile `390x844` rendered real multi-branch
  business content without digest `233653541`,
  `CoachAssignmentDataUnavailableError`, Server Component/console/hydration/
  visible overlay error, clipped text, or horizontal overflow. Natural evidence
  showed Exact groups/coach ownership remained authoritative while a Legacy coach
  was labelled not responsible. Pending User Reschedule, genuine Legacy fallback,
  Wallet, and Makeup were **Not observable — Owner-accepted deterministic
  regression coverage**. Save clicks and assignment-control changes were `0/0`.
- The initial runtime-log gate Hard Stopped. From
  `2026-07-29T15:50:15.407Z` through `2026-07-29T15:52:53.953Z`, the exact
  artifact/canonical domain had `37` unique/canonical log records after ID/content
  deduplication: GET/HEAD/POST/PUT/PATCH/DELETE `30/0/7/0/0/0`, HTTP `200/500`
  `34/3`, and all seven POST records targeted
  `/api/coach/assignment-groups`. Log-level fatal/error and HTTP 4xx were `0/0`
  and `0`; HTTP 5xx was `3`. Attribution and data delta were then Unknown within
  that gate's prohibited-direct-data scope. This triggered the mandatory Hard Stop
  despite zero Codex Save clicks; no route reload/retry followed.
- GET-only postflight preserved exact artifact/SHA/
  `production/READY/PROMOTED`, timestamps, deployment count/hash/max-created
  `100` / `C849ED9BFA716AF9F133098529203F3F922D459EF93A0FC5D6DF24284C229A0C` /
  `1785335234964`, alias count/hash `8` /
  `C95897ED7724906A94437688EE2C858C1D4867F5F5E924E5FD4960F5D88C9D02`, all four
  Production mappings, and all four Preview mappings. Added/removed deployment
  IDs and Deploy/Promotion/rollback counts were `0/0` and `0/0/0`.
- Owner then authorized one exact-window read-only attribution audit. Exact-HEAD
  Source again proved passive render cannot POST: `saveSlot()` is the only client
  caller and is reachable only from the explicit Save button. Sanitized Vercel
  evidence separated the GET-only UAT navigation/RSC cluster on fingerprint hash
  `30E6AF2FB89ADE62` from all seven POSTs and the other client's assignment-page
  GETs on `F12B551451608526`.
- The four HTTP `200` POSTs aligned one-for-one by timestamp/duration with four
  exact-window `save_coach_assignment_groups` activity rows from one Head Coach
  actor whose sanitized profile did not match the visible UAT identity. The three
  HTTP `500` attempts shared the same external fingerprint and had no success
  activity rows; Vercel exposed no trace ID, diagnostic text, crash marker, or
  error code for those failures. No window widening or assignment-group query was
  needed. Raw PII exposure was `0`.
- Read-only Vercel postflight preserved artifact `production/READY/PROMOTED`, the
  bounded `100`-ID deployment inventory/hash/max-created, all four Production
  aliases, and all four Preview mappings. No deployment, Promotion, rollback,
  alias mutation, browser/application request, Supabase mutation/RPC, repair,
  Source/Test/config change, Commit, or Push occurred.
- Production UAT is **Passed**. Controlled Write UAT is **Passed within the Owner-
  approved natural-notification limitation**. No assignment or non-notification
  mutation is attributable to Codex/UAT; possible natural-notification delta
  remains **Unknown / Need verification**. Four ordinary successful assignment
  saves by another Head Coach were observed. The three unrelated external HTTP
  `500` attempts are a Parking Lot item and are not authorized for investigation.
- Authoritative mutable state and the consistency matrix are in `PROJECT_STATE.md`.
- The warning is API/operator-visible only in this gate. Learner-visible warning UI
  was not changed and requires separate Owner scope.
- Next action: await Owner selection. Do not start the external assignment-POST/
  HTTP `500` Parking Lot diagnosis, retry UAT, repair data, clean the residual
  Junction, or begin another task automatically.

### Coach Notification Bangkok Date Consistency

Status: **DONE — EXACT SOURCE DEPLOYED/PROMOTED; DISPLAY FIX
PRODUCTION-ACTIVE; OWNER-CONFIRMED NATURAL-USE PRODUCTION UAT PASSED;
DOCUMENTATION PUBLISHED**.

- Generation-time and stored-message display fixes are Production-active in exact
  artifact `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`, release
  `11754057f9d82f71c7b69248a77997e491f5069c`.
- Owner confirmed through normal Production use on 2026-07-27 that the displayed
  Coach notification date and linked Attendance destination date match.
- Historical stored rows remain unchanged. No Codex data repair, Controlled Write
  UAT, financial change, or task-specific Production mutation occurred.
- Historical final state: `PROJECT_STATE.md` → **Historical / Superseded Project Matrix — Coach
  Notification Bangkok Date Consistency**. Detailed dated evidence is in
  `DEVELOPMENT_TODO.md`.

### Coach Assignment Status Communication + Save Feedback

Status: **DONE — EXACT SOURCE COMMITTED/PUSHED/DEPLOYED/PROMOTED;
PRODUCTION-ACTIVE; LOCAL, STAGED, AND READ-ONLY POST-PROMOTION PRODUCTION UAT
PASSED; DOCUMENTATION PUBLISHED**.

- `/coach/assign-groups` exposes mutually exclusive red `unassigned/empty`, amber
  `changed`, and green `saved`; `ต้องดำเนินการ` includes red plus amber. HTTP Save
  success feedback and refresh-gap behavior remain covered by the prior Local E2E.
- Functional Source/Test is `fc9f228fa5fc165a3b961636267c6d8614f852cf`.
  Production artifact `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E` contains exact clean
  source `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`, is `READY/PROMOTED`, and owns all
  four established Production aliases.
- Read-only Production UAT passed natural red/amber/green, exclusive
  `85/11/25 = 121` counts, filters, exact amber copy, reload, desktop/mobile,
  console/runtime, and zero-mutation gates. Controlled Write was unauthorized,
  not run, and not required. Production Data Changed and financial impact were
  both `0`.
- One documentation-only closeout commit containing this summary and the
  authoritative matrix was published by normal non-force Push. Exact commit SHA,
  tree, and parent are reported in the final handoff.
- Historical final state: `PROJECT_STATE.md` → **Historical / Superseded Project Matrix — Coach
  Assignment Status Communication + Save Feedback**. Detailed dated evidence is in
  `DEVELOPMENT_TODO.md`.

### Coach Assignment Mixed-Level Save Regression

Status: **DONE — AUTHORITATIVE-NAME SOURCE COMMITTED/PUSHED/DEPLOYED/PROMOTED;
PRODUCTION-ACTIVE; LOCAL AND STAGED GATES PASSED; PRIOR EXACT REPAIR PASSED;
OWNER POST-PROMOTION LIVE SAVE AND READ-ONLY PRODUCTION RECONCILIATION PASSED**.

- Owner's post-promotion Production Save on exact เทพารักษ์ slot
  `6e27b409-27e8-4b67-966b-75b27248c13d`, 2026-07-25 09:00–11:00, is accepted
  business UAT evidence. `กลุ่มโค้ชชาติ` / Coach ชาติ / 5 learners / LV `3–11`
  and `กลุ่มโค้ชเบล` / Head Coach เบล / 4 learners / LV `7–35` persisted exactly.
  Mixed-Level remained warning-only and the UI settled to `มอบหมายแล้ว`.
- Vercel request `d2wlk-1784886263183-64f29b35ccf7` was the exact
  `POST /api/coach/assignment-groups` `200`; activity row
  `468e0e9f-7032-480a-8e17-43c779ae50de` records `2` groups / `9` students.
  Groups/members/legacy/reservations reconcile `2/9/2/2`, active verified
  learners are `9/9` exactly once, and all orphan/duplicate/identity/range/legacy/
  reservation mismatch counts are `0`. Notification delta was `0`.
- The observed 16:00–18:00 count change `5 → 4` was independent: learner session
  `cf4c224a-fe4c-4a5b-a24d-bd6a7b3f72fd` was rescheduled at
  `2026-07-24T09:18:32Z`, with activity `26ca576d-a53f-45be-8096-b919af161ce6`,
  about 26 minutes before the 09:44 Assignment Save. The successful Save's
  `router.refresh()` exposed that already-current count; Assignment Source/RPC
  has no booking/session/payment/wallet/attendance/payroll write path.

- Owner superseded the automatic Coach Save naming rule after Controlled Write
  UAT: every cleaned non-empty name visible at Save is authoritative; only outer
  whitespace and trailing `(N คน)` may be removed. Empty names must fail before a
  write. Mixed/incomplete Level remains warning-only and actual members own the
  saved Level range.
- Root cause: the deployed Coach-only resolver still interpreted `กลุ่ม N` and
  other placeholders from Level during draft initialization and Save. Owner
  reports staged Save changed `กลุ่ม 1`/`กลุ่ม 2` to Level-derived names.
- Coach-only forward fix commit `a3a573975bb0b8874baf2557aa3fcf9f0786229a`
  and its documentation closeout are committed and pushed. Shared/default naming
  and Admin Makeup remain unchanged; existing Coach client/API call sites consume
  the corrected resolver without requiring their own diff.
- Fresh Commit + Push gate Local evidence passed: deterministic assignment/isolation `32/32`, Local
  Supabase browser/API E2E `6/6` with residue `0`, conflict DB `21/21` with residue
  `0`, Admin Schedules performance `24/24`, Lesson Wallet `17/17`, TypeScript,
  ESLint with zero warnings, mojibake `247`, secret-addition scan, and diff check.
  The prior unchanged-worktree Production build `91/91` was not rerun; its
  post-build `.next` cleanup/clean restart remains not claimed.
- Exact HEAD `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, tree
  `271908ac3f84be95391819fb01a47ac197460489`, is deployed as Production-target
  artifact `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`, now `READY` / `PROMOTED`, Current,
  and Production-active through all four established aliases. Pinned Vercel CLI
  `56.5.0` promoted the existing exact artifact once with exit `0`; no deployment,
  rebuild, force, retry, rollback, or separate alias command occurred.
- Exactly four Production aliases moved from
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H` to `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`;
  missing/extra aliases were `0/0` and branch-preview aliases were unchanged. No
  application route, Production API/database, environment, feature, allowlist,
  migration, or business-data write was exercised. Existing staged deployment
  `dpl_vsnYY1QWBybnR3rF51DsqamnQLg7` contains superseded behavior, remains
  unaliased/unpromoted, and must not be promoted.
- Owner-approved Chrome read-only staged UAT passed on the exact new artifact.
  Existing Head Coach authentication/authorization, page/data load, exact 24 July
  17:00–19:00 Thepharak slot, 2 groups / 7 learners, current persisted names,
  Coach/member mapping, desktop `1920x855`, and mobile `390x844` rendering passed.
  Console, page, hydration, Next.js overlay, 4xx/5xx, Vercel warning/error, and
  application mutation counts were `0`; all 50 unique Vercel requests were `GET`.
  That gate did not exercise Save; the later controlled gate below supplies the
  write proof.
- Read-only Production reconciliation found exact slot
  `8e2ede37-f7d3-4733-b63a-bd8504503f6f`, เทพารักษ์, 2026-07-24 17:00–19:00.
  Current groups/members/legacy/reservations reconcile `2/7/2/2` with all orphan,
  duplicate, range, identity, legacy, and reservation mismatches `0`.
- Owner-approved combined Controlled Write + exact repair then used the staged
  artifact once. The only mutation was request
  `xdlkj-1784881343649-b67b7bea8a1e`, `POST /api/coach/assignment-groups`, `200`.
  New group `bc51314c-7708-4ecb-bf56-98f3813fbdd5` persists `กลุ่ม 1` with the
  original Coach/four sessions/range `38–57`; new group
  `17df9379-0b77-49b2-a6ae-3d79569323e6` persists `กลุ่ม 2` with the original
  Coach/three sessions/range `9–22`.
- Post-write groups/members/legacy/reservations remained `2/7/2/2`; old group IDs
  were absent; all orphan/duplicate/range/identity/legacy/reservation mismatches
  were `0`. Exactly one activity row was added, notification delta was `0`, and
  booking/payment/wallet/attendance/check-in/teaching/payroll fingerprints were
  unchanged. No retry or restoration Save occurred.
- Data Repaired: **Yes — exact approved slot/two names only**. Production Data
  Changed: **Yes — atomic assignment-row replacement by the one approved Save**.
  Financial Impact: **None detected**. Production data changed by the Promotion
  gate: **0**. The authoritative-name Source is Production-active by control-plane
  evidence.
- The earlier read-only checkpoint's four deployment-wide booking availability/
  preview POSTs remain historical attribution evidence only. They did not match
  the Coach burst, and Source confirms both endpoints are SELECT-only; Owner
  accepted the later live Save as the closing business UAT evidence.
- Production UAT: **Passed — Owner post-promotion live Save**. Authoritative Save
  behavior and Controlled Write UAT: **Passed**. Data Repaired: **Yes — prior
  exact two-name repair only; this Save was normal Owner use**. Production Data
  Changed: **Yes — expected Owner Assignment Save; `0` from the read-only audit
  and documentation gate**. Financial Impact: **None detected**. Blocker:
  **None**. Task Done: **Yes**.
- Historical closeout next action: **Await Owner selection; do not start another
  task automatically.** This was superseded by the Active Work above.
- Historical release detail: `PROJECT_STATE.md` → **Historical / Superseded
  Project Matrix — Coach Assignment Mixed-Level Save Regression**.

### Admin Schedules Performance Phase B

Status: **DONE — PERMANENT `icn1` PRODUCTION-ACTIVE; READ-ONLY PRODUCTION UAT
PASSED WITH OWNER-ACCEPTED LIMITATIONS**.

- Permanent configuration commit `77db099607dd7ee8dfe265929a6720818e2015d1`
  is included in Production deployment `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`, which
  is `READY` in `icn1`; all four established Production aliases map to it.
- Deployment-protection-aware smoke, Super Admin, Standard Admin, and verified
  mobile `390x844` read-only Production UAT passed. UAT business mutations and
  relevant application 5xx/runtime errors were `0`; rollback was not required.
- Owner accepted unavailable page-internal timing and unrun live forced
  error/retry. Prior Local error/loading/empty/stale evidence passed; live retry
  interaction remains unknown/not explicitly proven.
- Task Done: **Yes — Phase B**. Detailed final report:
  `docs/performance/admin-schedules-phase-b-final-production-closeout-2026-07-23.md`.

### Admin Schedules — Coach Overlap Guard and Ungrouped Coach Semantics

Status: **DONE — CORRECTIVE FORWARD SOURCE PRODUCTION-ACTIVE; READ-ONLY AND
CONTROLLED WRITE UAT PASSED; WRITE CONTAINMENT REMOVED; ALL 3 CONFIRMED DAMAGED
SLOTS REPAIRED AND OWNER-CONFIRMED**.

- Shared exact-overlap validation, legacy-only warnings, ungrouped display
  semantics, Level-source auto-name, dynamic member counts, atomic normal save,
  standalone read-only preflight, existing-group reservation backfill, lifecycle
  synchronization, and the concurrent-write migration are implemented and
  verified.
- Source/Test/Migration commit
  `1b995396f432d11b133c1cf4b5604b6db875b63b` remains pushed but is not
  Production-active after the confirmed Head Coach assignment and mixed-Level
  grouping regression and rollback. Emergency containment commit
  `3ad8a52dbda95b645608bce2f05917824e9763a6` was built from restored Source
  `0226e363f6677b078430f93459c2ee2ede6484e8`, pushed non-force on its scoped
  branch, and was deployed as Ready deployment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`.
  It is now the verified rollback target; all four Production aliases have since
  moved to the corrective Forward deployment recorded below. The Owner-authorized
  Nice/Ratchada repair is
  complete: exact group update `1` and matching legacy delete `1`. Three later
  Production-user actions intentionally moved its learners into Coach Base group
  `2e7...`; Owner confirmed Coach Base now owns all five learners and they must not
  be moved back. Former group `924...` has no coach and zero members. All five
  current Coach Base learners resolve to `basic / ชุดพื้นฐาน`. A fresh exact
  preflight passed and one conditional Production update changed only group
  `2e7...` name from `ยังไม่จัดกลุ่ม` to `ชุดพื้นฐาน`; affected rows `1`.
  Coach, five members, target legacy row, former group, Ramintra/Nice, attendance,
  check-in, teaching-hours/payroll, and financial evidence reconciled unchanged.
  Authenticated read-only Admin Schedules UAT shows Coach Base, `ชุดพื้นฐาน`, and
  the dynamic five-member count without console/page/hydration errors. Fresh
  migration-apply checkpoint preflight reported active exact groups `966`, current/future
  candidates `235`, blocking conflicts `0`, and historical report-only conflicts
  `8`. At the migration-apply checkpoint, approved migration `20260717070225`
  applied exactly once; remote pending was empty, reservations reconciled
  `235/235`, and missing/stale/orphan/mismatch rows were `0`. Production business
  data fingerprints and Coach/member/legacy targets
  remained unchanged. Exact Source `1b995396f432d11b133c1cf4b5604b6db875b63b`
  remains pushed but is no longer Production-active. At the containment checkpoint,
  containment infrastructure passed: deployment Ready, aliases `4/4`, `/`, `/api/health`, and static asset all
  `200`. Migration `20260717070225` remains applied exactly once. Protected totals
  and fingerprints matched before/after the no-write check: groups `1022`, members
  `2426`, legacy `996`, reservations `230`.
  At that checkpoint, authenticated Head Coach rendering was available at `36/39` assigned, `3`
  unassigned, and `135` learners. One authorized containment check returned `503`
  with code `COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED`; successful assignment
  Save activity after activation remained `0`.
  Incident activity logs show `51` successful normal Save operations across `47`
  slots, six Head Coaches, and six branches. Current surviving incident-window
  rows are `55` exact groups, `97` members, `50` legacy assignments, and `50`
  derived reservations. These operational writes were not controlled UAT and were
  not repaired. The 47 slots are the broader incident-window Save population;
  confirmed damaged slots were `3` at that incident checkpoint. Exact repair evidence is still required for
  each remaining damaged slot; row IDs and evidence limitations are in `DEVELOPMENT_TODO.md`.
  Pre-existing dirty
  `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and `docs/performance/` remain
  excluded; permanent `AGENTS.md` rule work remains separate.
- Historical failed-name checkpoint: Forward candidate Source/Test commit
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9` (tree
  `0fecabd92e2f2c65b7bd59227b8d6b743e6bd820`) is pushed non-force on
  `codex/coach-assignment-forward-fix-20260718`. It is based directly on
  `1b995396...`, passes the full Local gate recorded in `PROJECT_STATE.md`, and is
  deployed only as Ready unpromoted dark artifact
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD`. Production aliases remain `4/4` on
  containment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; assignment writes remain
  disabled. Read-only Canary assignment semantics, mobile layout, Attendance,
  Teaching Programs, Wallet, DB fingerprints, and runtime 5xx checks otherwise
  passed, but one client React hydration `#418` occurred during the first Head
  Coach `/admin/schedules` guard redirect. It did not reproduce on a fresh Canary
  run or containment baseline. The Owner-authorized bounded retest then completed
  `56/56` clean client cycles across Canary and containment: direct `/coach`, hard
  reload, role-guard redirect, mobile 390x844, and three fresh logins per
  environment all had React `#418`/hydration/console/page errors and redirect loops
  `0`. Canary assignment semantics re-passed read-only. However, containment
  emitted one distinct middleware `refresh_token_not_found` error on `GET /`
  during the logout/login cycles, with response `200`; Canary runtime
  error/fatal/5xx remained `0/0/0`. At that intermediate checkpoint the overall
  zero-runtime-error gate was not passed; Owner later accepted this distinct
  containment baseline as non-blocking. Protected assignment counts/fingerprints remained groups
  `1022`, members `2426`, legacy `996`, reservations `230`; reservation business
  fields reconciled `230/230` with mismatch `0`; successful assignment Saves after
  containment remained `0`. One reservation timestamp-only refresh was traced to
  normal coach check-in/attendance activity, not an assignment mutation. No
  Controlled Write, promotion, or damaged-slot repair occurred.
- Historical bounded-retest Owner decision: Owner classified the one Containment-only
  `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` as
  **ACCEPTED NON-BLOCKING CONTAINMENT AUTH-SESSION BASELINE**. It did not occur on
  Forward Canary, did not fail login or HTTP, and is unrelated to the Coach
  Assignment diff. Preserve it as an unauthorized separate follow-up. Forward
  Canary read-only UAT is **Passed**; original React `#418` remains **Unknown /
  Non-reproducible after clean bounded retest**; aliases promoted **No**.
- Historical first Controlled Write checkpoint: Owner/Head Coach then confirmed and saved one exact dark-Canary payload for slot
  `53c3556a-6067-4ad1-813c-ca8410d17994` exactly once. The Save was atomic:
  groups/members/legacy/reservations changed from `0/0/0/0` to `2/5/2/2`, global
  totals are `1024/2431/998/232`, and no orphan, mismatch, conflict, partial
  deletion, console error, or attendance/check-in/program/payment/wallet change
  was found. Controlled Write UAT nevertheless **Failed** because submitted manual
  names `ระดับสูง` and `กลาง-สูง` were stored as `กลุ่มผสม` and `ชุดพื้นฐาน` on
  groups `c56af2cf...` and `ec77cf98...`. The Source treats those legacy labels as
  auto-generated before the RPC. At that checkpoint another Save and promotion
  were prohibited; the slot was not closed as repaired and damaged slots remained
  `3`. The corrective checkpoint below supersedes this historical gate.
- Corrective manual-name Source/Test commit
  `9ef1ee30035a083426743aed3e326ad9676d65c4`, tree
  `94fe2410f0361acf639c47a4be7245c01128f21d`, is pushed non-force from parent
  `c70f5a4...`. It preserves every trimmed non-placeholder manual name and
  auto-names only blank, exact `ยังไม่จัดกลุ่ม`, or generic `กลุ่ม N` input after
  removing a trailing `(N คน)` suffix. Local gates passed: assignment/naming/
  authorization `33/33`, DB conflict/concurrency/lifecycle `22/22`, Playwright
  desktop/mobile `3/3`, Lesson Wallet `17/17`, TypeScript, ESLint, mojibake, diff
  check, Production Build, clean restart, and residue `0`.
- Owner/Head Coach performed one corrective Save on slot
  `53c3556a-6067-4ad1-813c-ca8410d17994` through dark Canary
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`. Controlled Write UAT passed: persisted names
  are `ระดับสูง` and `กลาง-สูง`; exact coach/member mapping remained `2/5`; legacy
  and reservation rows remained complete `2/2`; no partial write, orphan,
  mismatch, conflict, unsaved indicator, console/runtime/500/constraint error, or
  attendance/check-in/payroll/financial change was found. The 21 July Chaeng
  Watthana slot is repaired.
- The exact same Canary artifact was promoted without rebuild and is now Ready on
  all four Production aliases. Corrective Forward Source is Production-active;
  assignment writes are enabled and temporary containment is inactive. Public
  `/`, `/api/health`, static assets, authenticated Head Coach rendering, and
  post-promotion logs passed. Three later real Head Coach Saves succeeded without
  runtime/500/constraint errors. Current/future reservations reconcile `221/221`;
  missing/physical orphan/mismatch `0/0/0`. Fresh totals are groups `1026`, members
  `2436`, legacy `1000`, reservations `234`. Rollback target
  remains `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; migration remains applied once.
- The later activity includes the 22 and 29 July Suvarnabhumi slots. Each now has
  one `กลุ่มผสม`, three members, one exact coach, one legacy row, and one matching
  reservation. These rows are technically complete, but Codex did not receive the
  intended payloads before the real-user Saves, so correctness initially remained
  Unknown. Owner subsequently confirmed both actual payloads are correct. All
  three confirmed damaged slots are repaired and Task Done is **Yes**.
- Exact current matrix, Owner decisions, affected row ids, local test evidence,
  and controlled Production repair evidence are authoritative in `PROJECT_STATE.md` under
  **Admin Schedules — Coach Overlap Guard and Ungrouped Coach Semantics**.

This completed section does not define current mutable state or next action. See
Current Active Work above and the authoritative current matrix in
`PROJECT_STATE.md`.

## Earlier Completed

### Admin Schedules — Unassigned Coach Group Incorrectly Shown as Green

Status: **DONE — EXACT SOURCE DEPLOYED; AUTHENTICATED READ-ONLY PRODUCTION UAT
PASSED**.

- Exact functional Source `0226e363f6677b078430f93459c2ee2ede6484e8` is active in
  Ready deployment `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8` on all four established
  Production aliases.
- Exact 2026-07-16 Rama 2 Kids Group 17:00–19:00 read-only UAT passed with
  `7 มีโค้ช / 5 รอจัดโค้ช / 2 อยู่ในกระเป๋า`; the no-coach group is red and both
  valid assigned groups remain green. Desktop, mobile 390x844, console/hydration,
  and runtime gates passed.
- No migration, environment/feature-control/allowlist change, auto-assignment,
  assignment/attendance/check-in write, Production business-data change, repair,
  or financial effect occurred for this task. Rollback was not used.
- Authoritative current state and the full consistency matrix are in
  `PROJECT_STATE.md`; detailed deployment/UAT evidence is in
  `DEVELOPMENT_TODO.md`.

### Admin Teaching Programs — Default Today + Date/Time/Branch Ordering

Status: **DONE — EXACT SOURCE DEPLOYED; READ-ONLY PRODUCTION UAT PASSED**.

- At its 2026-07-15 release closeout, subsystem-origin Source
  `039ad6e03ca0cb8c8c4334c81818c570b03b9287` was active in Ready deployment
  `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr`. The feature remains included in the newer
  global Production Source; authoritative current deployment state is only in
  `PROJECT_STATE.md`.
- Authenticated read-only Production UAT passed default Bangkok today, date/time/
  same-time แจ้งวัฒนะ ordering, manual one-/two-sided date filters, search/status/
  coach/branch/course filters, pagination, detail selection, reload stability,
  console/hydration, and no-write/runtime gates.
- No migration, environment/feature-control/allowlist change, Review action,
  Production business-data write, data repair, or financial impact occurred.
- Authoritative current state and the full consistency matrix are in
  `PROJECT_STATE.md`; dated deployment/UAT evidence is in `DEVELOPMENT_TODO.md`.

### Production Lesson Wallet Canonical Recurring-Round Redemption

Status: **DONE — SOURCE DEPLOYED; NO-WRITE AND OWNER-VERIFIED CONTROLLED WRITE
PRODUCTION UAT PASSED**.

- At its 2026-07-15 closeout, Functional Source
  `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae` was active in Ready deployment
  `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` on all four aliases. Current Production
  deployment state is authoritative only in `PROJECT_STATE.md`.
- Read-only reconciliation distinguished exactly one successful redemption and a
  separate subsequent Owner Wallet-store action. Canonical target evidence is
  intact; active duplicate/overlap, orphan, Payment, coupon, Ledger, allocation,
  Finance, and repair counts attributable to the redemption are `0`.
- Authoritative current detail and the final consistency matrix are in
  `PROJECT_STATE.md`; dated evidence is in the 2026-07-15 Lesson Wallet record in
  `DEVELOPMENT_TODO.md`.

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

Priority `1` below was selected on 2026-08-19 and is the current Active Task; the
other six candidates remain unauthorized and retain their prior relative state.

### Priority 1 — Schedule Learning Details

Canonical name: **SCHEDULE LEARNING DETAILS — PARENT PROGRAM VISIBILITY + ADMIN
FULL PROGRAM MODAL + USER/COACH LEVEL PARITY**.

Status: **SELECTED / ACTIVE — READY FOR OWNER UAT; NOT PROMOTED**.

- User/parent correction: pushed Source permits only on-demand `submitted`,
  `approved`, and `rejected` teaching programs resolved from the learner's exact
  assignment group and that real group's `coach_id + schedule_slot_id`; `draft`,
  review metadata, Legacy-only, and non-owned programs remain hidden.
- Admin corrections: the previously published Admin Schedule full-content modal
  remains unchanged; pushed Admin Teaching Program Review now uses validated
  server-side Bangkok date-range filtering, selected-range stats, bounded results,
  and explicit read-error handling.
- Coach correction: pushed Today Schedule preserves individual Level and adds the
  exact group's Level range, child nickname, and exact coach/slot program status,
  preview, and full-content modal without per-group or per-student queries.
- Protected rule: one coach may own only one group in the same teaching time and
  cannot teach two overlapping groups. Current Client/API/DB guards must not be
  weakened or changed without a new Owner Decision.
- Commercial note: **12,000 บาท applies only to the User/parent program-visibility
  item**. The Admin modal and User/Coach Level parity are completeness
  corrections. This is a project/commercial record, not application pricing, and
  does not authorize Payment or `pricing_tiers` changes.
- The latest 2026-08-21 Owner command accepted the completed read-only hosted
  Supabase `prod:check` as a valid Release Gate. Application Source `a63f4f5...`
  is committed/pushed; replacement staged artifact
  `dpl_rRAc546SKNMxSxFVAgkGYUofVkEg` is exact-SHA, unaliased, and `READY` with
  smoke/log checks passed. The previous Owner-rejected artifact remains retained
  and unpromoted. Current mutable detail and the exact Owner UAT next gate are
  authoritative in the first matrix of `PROJECT_STATE.md`.

Existing six candidates retained below without a new relative order: Adult Group
+ Family Private 10-Month Entitlement / Cross-Month Booking; Private Self + Child
Identity Integrity / Name-Level Separation; LINE External-Browser Handoff Audit;
Thai UI Terminology & Shared Helper; External Head Coach Assignment Save HTTP 500
Attempts; and Homepage LV Copy Audit/Fix.

### Adult Group + Family Private — 10-Month Entitlement / Cross-Month Booking

Canonical name: **ADULT GROUP + FAMILY PRIVATE 10-MONTH ENTITLEMENT / CROSS-MONTH BOOKING**.

Status: **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.

- This existing Parking Lot candidate remains unselected and unauthorized. Active
  Task is **None — Awaiting Owner Selection**.
- This decision is durably registered/published. Product audit and implementation
  remain unauthorized until the Owner selects it under a new Scope Contract.
- Adult Group must continue to use the package/session rates in authoritative
  `pricing_tiers`. A purchased Adult Group package creates a remaining-session
  entitlement that the user can schedule across months within `10 เดือน`.
- Owner example: an Adult Group 16-session package paid on 1 January 2026
  (`1 ม.ค. 2569`) is usable through 31 October 2026 (`31 ต.ค. 2569`). This
  example does not resolve the mid-month expiry formula below.
- Private is intended to be Family Private for children and adults. It must
  continue to use the package/hour rates in authoritative `pricing_tiers`, with
  the Family Private entitlement usable within `10 เดือน`.
- Cross-month future implementation must separate package purchase and
  entitlement creation from selecting all teaching dates immediately. Users must
  be able to spend the remaining entitlement on cross-month schedule selections
  without creating a new payment for each use.
- Current Booking UI/API still binds each booking request to one `month`/`year`.
  Adult Group and Private remain in the Legacy booking/payment flow; “Legacy”
  does not authorize a pricing-tier or formula change.
- This future entitlement/cross-month work is not automatically a tier change,
  reprice, migration, backfill, or Product implementation. No `pricing_tiers`
  value or fallback is changed by this documentation publication.

#### Unknown / Need Owner Decision

- Expiry-date formula when payment occurs mid-month.
- Entitlement start date: payment date, approval date, or first lesson date.
- Family Private membership boundary and entitlement-sharing rules.
- Whether the entitlement may be used across branches.
- Number of learners allowed per Private session.
- Interaction with Reschedule and Lesson Wallet.
- Cancellation, refund, coupon, and expiry semantics.
- Treatment of remaining entitlement when the 10-month period ends.
- Treatment of existing Adult/Private bookings and whether migration/backfill is
  required.
- Attendance, Coach, Payroll, Finance, and Accounting effects.

Detailed Owner decision, Source evidence, and Unknowns: see the dated 2026-08-07
Adult Group + Family Private record in `DEVELOPMENT_TODO.md`.

### Private Self + Child Identity Integrity / Name-Level Separation

Canonical name: **PRIVATE SELF + CHILD IDENTITY INTEGRITY / NAME-LEVEL SEPARATION**.

Status: **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.

- This existing Parking Lot candidate is separate from the Adult/Family 10-month
  entitlement candidate and remains unselected and unauthorized. Active Task is
  **None — Awaiting Owner Selection**.
- This decision is durably registered/published. Product audit, implementation,
  regression work, Production audit, and data repair remain unauthorized.
- Visible symptom: self plus one child across two time slots produced the expected
  four attendee/session rows, but every visible row and the Head Coach view used
  the booking owner's name/Level. This is an identity/name/Level separation
  symptom, not evidence of duplicate attendee rows.
- Intended behavior: self uses the user/profile identity, name, and Level; each
  child uses `booking_sessions.child_id`, the child's name, and the child's Level.
  Attendance uses `bookings.user_id` for self and `child_id` for the child.
- Root Cause is **Unknown / Need Verification**. Any Owner-authorized future task
  must start with a bounded audit of exact Source/deployment provenance and the
  affected identity path; no Production SELECT is authorized by this record.
- Protected flows remain unchanged: time-slot count, hours, `total_sessions`,
  pricing, Payment, Attendance policy, Coach grouping/assignment, Reschedule,
  Lesson Wallet, Makeup, Payroll, Finance, and the separate Adult/Family
  entitlement candidate.

Detailed Fact, Source evidence, Inference, Unknowns, and audit requirements: see
the dated 2026-08-07 Private Self + Child record in `DEVELOPMENT_TODO.md`.

### LINE External-Browser Handoff Audit

Status: **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.

- No LINE user-agent detection, redirect, deep-link, external-browser handoff,
  attached HTML script, Source audit, or implementation was included in the
  mobile Payment Dialog task.
- Await explicit Owner selection and a separate Scope Contract before any audit or
  change.

### Historical Assignment Group Lifecycle Integrity Registration — Superseded

Status: **HISTORICAL / SUPERSEDED — TASK LATER SELECTED AND COMPLETED**.

- Preserve `absent` learners in assignment groups and prevent false changed/
  unsaved state.
- Audit and permanently prevent misleading empty active group headers after the
  last learner reschedules or stores a session in Wallet.
- A future Scope Contract must cover assignment save, Reschedule, Wallet,
  Attendance, Exact/Legacy resolution, Payroll, and audit-history preservation.
- This was the pre-selection registration only. Current mutable state is in
  `PROJECT_STATE.md`; do not use this historical paragraph to imply a current
  Active Task or expand any future Scope Contract.

### Thai UI Terminology & Shared Helper

Status: **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.

- Create a shared helper for user-visible terminology with standard Thai labels:
  `kids_group = กลุ่มเด็ก`, `adult_group = กลุ่มผู้ใหญ่`, `private = ส่วนตัว`,
  `Present = มาเรียน`, `Late = สาย`, `Absent = ขาดเรียน`, and context-appropriate
  `Attendance = ข้อมูลการเข้าเรียน/บันทึกการเข้าเรียน`.
- Include course type, attendance status, employment type, and technical codes
  that are currently user-visible.
- A future single Scope Contract must audit and apply the helper across Admin,
  Coach, and User portals, including Admin Payroll.
- Do not add a Payroll-local mapping first and refactor it later.
- No audit, implementation, deploy, migration, Production change, or data action
  is authorized by this Parking Lot registration.

### Historical Registration — Admin Notifications Recommendations

Status: **HISTORICAL / SUPERSEDED — TASK LATER COMPLETED**.

- This paragraph preserves the pre-selection registration only. The Owner later
  selected the task and supplied the exact actionability, branch-grouping, and
  renewal rules.
- The first mandatory Gate 0 used a per-learner interpretation and stopped before
  implementation when Private attendee rows could not reconcile to a shared
  booking-level entitlement denominator. That stopped state remains dated history.
- The Owner then approved booking/package semantics for Private. Revised Gate 0
  reconciled `71/71` canonical purchased units and produced a staged artifact,
  but that artifact was later superseded by the full-roster corrective scope.
- Fresh Production audit for that corrective scope found an active `1/1/30/0`
  tracking cycle and triggered the earlier Owner-mandated Material Hard Stop.
  The Owner then authorized Preserve & Extend; Source, Migration, one atomic
  reconciliation, and a new staged artifact completed without a notification
  send. This is historical evidence only; current mutable state is authoritative
  in `PROJECT_STATE.md`, and detailed dated evidence is in `DEVELOPMENT_TODO.md`.

### External Head Coach Assignment Save HTTP 500 Attempts

Status: **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.

- During the completed canonical Production UAT window, three assignment Save POST
  attempts from the same conclusively external Head Coach client fingerprint
  returned HTTP `500`.
- The bounded attribution audit intentionally did not diagnose cause, inspect
  request bodies, retry, repair data, or change Source/config/deployment state.
- Await explicit Owner selection before any diagnosis or fix.

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
- The only pre-existing unrelated dirty path is protected
  `src/lib/schedule-slot-utils.ts`; it remains excluded and content-invariant.
- Schedule Learning Details Application Source is committed/pushed and its exact
  staged artifact is READY without aliases; only the protected unrelated dirty
  file remains local. Exact state is authoritative in the first
  `PROJECT_STATE.md` matrix.
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
- This checklist does not define current mutable state or next action. See Current
  Active Work above and the authoritative current matrix in `PROJECT_STATE.md`.
