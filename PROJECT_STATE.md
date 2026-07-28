# PROJECT_STATE.md - Current Project Snapshot

Last updated: 2026-07-28
Source: current local/upstream Git metadata, fresh scoped Source/Test/Migration
inspection, local non-writing verification, and prior documented release state.
No Production, Supabase remote, Vercel, or Production browser access occurred in
the current gate. Prior context includes the
Owner-approved Admin Schedules Phase B Production promotion/UAT evidence through
2026-07-23, plus the Coach Assignment mixed-Level publish/deploy history,
Owner-reported staged UAT result, read-only Production reconciliation, the
authoritative-name publish/deploy/read-only UAT, and the exact Controlled Write +
two-name repair closeout on 2026-07-24, plus the Owner-approved Coach Assignment
Status Communication + Save Feedback Source/Local, Commit + Push, staged
Production-target artifact, authenticated read-only staged UAT closeout, exact-
artifact Promotion, and successful read-only post-promotion Production UAT retry.
Items not confirmed are marked `Unknown / Need verification`.

The single Active Task is **RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY
FALLBACK ISOLATION**. Owner authorized **SOURCE FIX + LOCAL TEST only**. Fresh
Source audit confirmed inconsistent exact/Legacy predicates across Coach schedule,
Attendance, Teaching Program, student access/history, Teaching Hours, Reschedule
notifications, and Attendance Gap classification. It also confirmed the previously
missed genuine legacy-only path: a new User Reschedule-in inherited the slot's
Legacy coach unless provenance was checked. The Plan A Source/Test package is now
complete, committed, and pushed in functional commit
`54752bcc2a914b7d2f67f344c62e50f642f890ac`; this documentation closeout is the
second Owner-authorized publish commit. Fresh deterministic/static verification
passed before staging. The prior build `91/91` is retained dated evidence and was
not rerun in the Commit Gate. Local Supabase write/E2E, Attendance Gap fixture UAT,
and post-build root/static smoke remain Blocked/Not run as accepted residual risks.
At documentation closeout, port `3000` was again owned by intermittent external
`dragonsword-save-editor` PID `10416`; it was not stopped and `.next` was absent.
Deploy, Production access/UAT, Controlled Write, migration, and data repair remain
prohibited and were not performed. Task Done is **No**; the next action is Owner/PM
review before any separately authorized Deploy/Release Readiness gate.

## Current Source of Truth

New Athlete Badminton School is a multi-portal badminton school management app.
The repo currently uses Next.js 16.2.6 App Router, React 18, TypeScript 5,
TailwindCSS 3.4, shadcn/Radix UI, Supabase, and SlipOK.

### Owner Policy

- Owner selected **RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY FALLBACK
  ISOLATION** as the single Active Task on 2026-07-27 and authorized Source Fix +
  Local Test only. A slot enters the exact model when at least one
  `coach_assignment_groups` row exists, including an empty group; all Coach
  visibility/authorization/evidence surfaces must then ignore Legacy fallback.
  Legacy remains compatible only for legitimate non-User-Reschedule learners in a
  genuine legacy-only slot with zero exact group rows. User Reschedule-in moves only
  the lesson entitlement and must never inherit a coach automatically, including in
  genuine legacy-only slots; it remains pending until Head Coach Save persists exact
  membership. `rescheduled_from_id` alone is not provenance because Lesson Wallet
  redemption and Admin Makeup also use it. Makeup is distinguished by `is_makeup`;
  Wallet is distinguished through batched `lesson_wallet_credits.redeemed_session_id`
  evidence. Wallet and Makeup semantics do not change. Exact/provenance query errors
  fail closed. Assignment-review notification lookup/delivery failure must be
  observable without returning a retry-inducing 5xx after the Reschedule commit.
  Admin/Super Admin, new-branch Head Coach, and—when Exact membership was
  removed—old-branch Head Coach are required recipient audiences; an empty
  required set is a `recipient_empty` failure. The warning is API/operator-visible
  through the JSON response, activity details, and console error. Learner-visible
  warning UI requires separate Owner scope and is not authorized in this gate.
  Historical Attendance Gaps remain queued without auto-attendance, auto-absence,
  makeup, payroll, attribution repair, or any historical repair. Commit, Push, Deploy,
  Production/Vercel/Supabase access, Production UAT/write/data repair, migration/
  schema/RLS/RPC, policy expansion, environment/feature/allowlist/dependency
  changes, and the protected dirty files remain prohibited.
- Owner selected **Coach Notification Bangkok Date Consistency** as the single
  Active Task on 2026-07-27. This gate authorizes fresh Audit First, bounded
  Production SELECT-only notification/schedule evidence, a narrow Source fix,
  deterministic Local tests, and current-state documentation only. Commit, Push,
  branch change, Deploy/Promotion/alias/rollback, authenticated Coach Production
  pages, Controlled Write UAT, Production notification/data repair, migration,
  schema/RLS/RPC, environment, feature, allowlist, and dependency changes remain
  prohibited. Stored incorrect messages are a later Owner repair/deduplication
  decision and must not be rewritten in this gate.
- Owner then approved the stored-message display **Commit + Push** gate: fresh
  Gate 0, unchanged-scope verification, one exact four-file functional commit,
  one exact three-file documentation publication commit, and exactly one normal
  non-force Push on the existing `spike/next-major-security-upgrade` branch.
  Source expansion, branch change, PR, Deploy/Promotion/alias/rollback,
  Production/Supabase/Vercel/browser access, Production UAT/write/data repair,
  migration/schema/RLS/RPC, dependency/lockfile/environment/feature/allowlist
  changes, and payment investigation remained prohibited.
- Owner then approved an exact-source staged Deploy gate for release
  `11754057f9d82f71c7b69248a77997e491f5069c`: fresh Git/Vercel Gate 0, a clean
  detached disposable worktree, specified Local verification, and at most one
  pinned Vercel CLI `56.5.0` `deploy --prod --skip-domain` command. Promotion,
  alias/domain mutation, retry/force/rollback, Production/Supabase access,
  authenticated Coach routes, business-data requests, data repair, Source/config
  changes, Commit, and Push were prohibited. The gate requires a Hard Stop before
  Deploy when any exact-SHA artifact already exists, to prevent duplication.
- Owner revised only that duplicate rule: exact-SHA Preview artifacts do not
  block a separate Production-target staged Deploy; only a pre-existing exact-SHA
  `production/READY/STAGED` artifact blocks it. The existing Preview
  `dpl_CzbKmahkF22HWhHM7YLMkJ2E9AKK` was explicitly allowed. Every other guard,
  including immediate Hard Stop if Codex sends a POST/PUT/PATCH/DELETE request,
  remained in force.
- Owner then superseded only the failed no-artifact POST Safety Hard Stop and
  approved a fresh revised staged Deploy from exact release `11754057...`.
  Inventory reads must use explicit `GET /v6/deployments` with `-X GET`, no `-F`
  or body; control-plane writes are allowed only inside exactly one pinned
  `deploy --prod --skip-domain` command. Promotion, alias mutation, retry/force/
  rebuild/rollback, application mutation, Coach/authenticated access, Supabase,
  Production data repair, Source/config changes, Commit, and Push remain
  prohibited.
- Owner subsequently approved exactly one Promotion of stored-message display
  artifact `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`, allowing only the control-plane
  writes performed inside that one pinned `vercel promote` command to move the
  four established Production aliases. Deploy/rebuild/retry/force/rollback,
  separate alias/domain mutation, Coach application UAT, `/api/health`, Supabase,
  application mutation, Production data repair, payment investigation, Source or
  configuration changes, and documentation Commit/Push remained prohibited.
- Owner then directly confirmed normal Production use with “ตรงกันครับผม”: the
  date displayed on Coach notifications matched the linked Attendance destination
  date. Owner authorized this documentation-only closeout, Task completion, one
  exact three-file documentation commit, and one normal non-force Push on the
  existing branch. The external MP4 remains evidence only and must not enter Git;
  Source, Deploy, Production access, repair, data operations, PR, and Parking Lot
  work remain prohibited.
- After PM review of the exact local worktree, Owner approved a fresh Commit +
  Push Gate 0, unchanged-scope re-verification, one exact 10-file functional
  Source/Test/Package commit, one exact 3-file current-documentation commit, and
  exactly one normal non-force Push of both commits on the existing branch.
  Source redesign, scope expansion, branch change, force Push, PR, Deploy,
  Production access/UAT/write, Supabase access, migration/schema/RLS/RPC,
  dependency, environment, feature, allowlist, Controlled Write UAT, and stored-
  notification repair remain unauthorized.
- Owner then approved one exact-source staged Deploy gate for release
  `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`: a clean detached worktree, focused
  Local re-verification, and exactly one pinned Vercel CLI `56.5.0`
  `deploy --prod --skip-domain` command. Read-only control-plane inspection,
  bounded exact-artifact logs, public root/read-only-health/static smoke, and
  local current-documentation updates were authorized. Promotion, alias movement,
  retry/force/rollback, authenticated Coach routes, application mutation,
  Supabase access/write, Controlled Write UAT, stored-message repair, migration,
  environment/feature/allowlist/project-setting change, Commit, and Push were not
  authorized. Source proves that Coach layout and `/coach/notifications` GET
  hydration call notification generators that may insert rows; Coach application
  UAT is therefore write-capable and not a read-only operation.
- Owner subsequently approved exactly one Promotion of staged artifact
  `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z`, with no rebuild or new deployment, automatic
  movement of the four established Production aliases, read-only control-plane
  verification, safe non-Coach GET-only smoke, bounded logs, and local
  documentation updates. Deploy/rebuild, Promotion retry, separate alias/domain
  mutation, rollback, force, Coach routes, application/Supabase write, Controlled
  Write UAT, stored-message repair, migration/schema/RLS/RPC, environment/feature/
  allowlist/project-setting change, Commit, and Push remained unauthorized.
- Owner then supplied visible evidence that a pre-Deploy stored notification still
  displayed `25 ก.ค. 69` while its exact internal attendance link and destination
  used `2026-07-26`, and authorized a presentation-only Source Fix + Local Test.
  The display/search layer may normalize only three proven Coach slot-date titles
  from a valid `date=YYYY-MM-DD` on a relative `/coach/` link. Production access,
  stored-row repair, generator/deduplication change, Commit, Push, Deploy, schema,
  dependency, environment, feature, allowlist, and business mutations remain
  prohibited. The unrelated external payment-cancel POST is not a blocker and is
  outside this gate.
- Owner selected **Coach Assignment Status Communication + Save Feedback** as the
  single Active Task on 2026-07-24 and first authorized Source Fix + Local Test.
  The Coach assignment page must expose three mutually exclusive user-facing
  states: red `ยังไม่ได้มอบหมาย` for internal `unassigned`/`empty`, amber
  `มีการเปลี่ยนแปลง รอตรวจและบันทึก` for internal `changed`, and green
  `มอบหมายแล้ว` for `saved`. The action filter is `ต้องดำเนินการ` and includes
  red plus amber. HTTP Save success must show an immediate success toast and
  saved UI without masking later draft edits or newer Server props. Owner later
  authorized the exact functional Commit + normal non-force Push, one retry after
  the first GitHub Internal Server Error, and a separate documentation closeout
  Commit + normal non-force Push. Owner then authorized exactly one Production-
  target Vercel deployment from clean commit `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`
  with `--prod --skip-domain`, leaving the artifact staged and unpromoted. Alias
  promotion, application writes, migrations, environment/feature-control/
  allowlist changes, and another task remained prohibited. After the public smoke
  was blocked by Vercel Deployment Protection, Owner authorized authenticated
  read-only staged UAT through an existing authorized Head Coach/Vercel browser
  session, including only local draft editing followed by reload. Save, Controlled
  Write, Production aliases/UAT, deploy/rebuild, direct Production API/database
  access, and Commit/Push remained prohibited.
- The first Promotion attempt on 2026-07-25 stopped before any Vercel command
  because `TODO-CODEX.md` retained a contradictory present-tense `Deploy gate`
  next action. Owner then authorized correction of that Documentation Drift and
  conditional resumption of the exact-artifact Promotion gate for
  `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E`. The fresh Git/Vercel/control-plane gate
  passed and that exact artifact was promoted once without rebuild. Production
  application UAT, Controlled Write, Save, deploy/rebuild, rollback/retry,
  separate alias commands, Production data access/write, and Commit/Push remain
  unauthorized.
- Owner then authorized read-only post-promotion Production UAT through the
  canonical Production alias, using only an existing authorized Head Coach browser
  session and non-editing filter/date/slot navigation. The gate Hard Stopped before
  Vercel or browser access because the managed Developer environment could not
  connect to `github.com:443`, so live Remote HEAD could not be freshly verified.
  No Production route, browser session, Vercel control plane, application request,
  draft, Save, mutation, data access/write, or release operation was opened by
  this UAT attempt.
- Owner approved a fresh retry on 2026-07-25 for exact artifact
  `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E`. Fresh live GitHub and Vercel gates passed,
  and the authenticated read-only Production UAT passed at the canonical alias.
  Natural red/amber/green states, exclusive counts, filters, exact amber detail
  copy, reload stability, desktop/mobile layout, browser console, bounded runtime
  logs, and no-mutation evidence passed. Save, client draft changes, Controlled
  Write, Production data access/write, deploy/rebuild/Promotion/rollback/alias
  mutation, environment/feature/allowlist change, and Commit/Push remained
  prohibited and did not occur.
- Owner then approved one documentation-only closeout Commit and normal non-force
  Push containing only `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`. This publication closes Coach Assignment Status
  Communication + Save Feedback as Done and returns Active Task to `NONE` after
  the containing commit reaches the live Remote. Protected dirty files, Source/
  Test/API/RPC/migration/package/config, Browser/Vercel/Production access, Save,
  data write, deploy/rebuild/Promotion/rollback/alias mutation, PR, and every other
  task remain prohibited.
- Owner selected **Coach Assignment Mixed-Level Save Regression** as the single
  Active Task on 2026-07-24 and confirmed that Coach/Head Coach may intentionally
  place learners from different Level categories in one group. Mixed categories,
  wide Level gaps, assessed plus unassessed learners, and incomplete Level
  definitions remain warning-only in the Coach assignment flow.
- After staged Controlled Write UAT exposed automatic renaming, Owner superseded
  the earlier Coach Save naming rule on 2026-07-24: every non-empty name visible in
  the Coach name field at Save is authoritative, including `กลุ่ม 1`, `กลุ่ม 2`,
  and other Thai/English names. Coach Save may trim surrounding whitespace and
  remove only a trailing dynamic `(N คน)` suffix; it must not derive or substitute
  a Level-based name. Empty names must fail before any database write. `จัดตาม
  Level` may change the visible draft before Save, and `levelMin/levelMax` must
  still come from actual members. Shared/default naming and Admin Makeup remain
  unchanged.
- Owner approved the new Coach Source Fix + Local Test gate, the exact two-commit
  normal non-force Commit + Push gate, the staged deployment/read-only UAT, and one
  combined Controlled Write UAT + exact name repair on slot
  `8e2ede37-f7d3-4733-b63a-bd8504503f6f`. That one staged Save completed on
  2026-07-24 and repaired only the two approved visible names while preserving the
  exact coach/member mapping. Owner subsequently approved exact-artifact Promotion
  of `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9` with no rebuild; that Promotion completed
  on 2026-07-24 and moved exactly the four established Production aliases. At that
  checkpoint, another Save, deploy/rebuild, rollback, post-promotion UAT,
  migration, feature-control, allowlist, environment, branch, Admin Makeup, and
  Admin Schedules runtime changes remained prohibited pending a separate Owner
  gate.
- Owner subsequently accepted the 2026-07-25 post-promotion live Save as business
  UAT evidence and authorized read-only Production reconciliation plus one
  documentation-only Commit + normal non-force Push closeout. The exact live Save
  preserved `กลุ่มโค้ชชาติ` / `กลุ่มโค้ชเบล`, kept mixed-Level warning-only,
  and completed as `มอบหมายแล้ว`; the reconciliation and final current matrix
  below supersede the earlier incomplete network-attribution checkpoint.

- Owner confirmed on 2026-07-12 that Progressive replaces Legacy for general Kids
  Group Production traffic. Deploy, environment/flag/allowlist changes, Production
  UAT writes, and Production data repair were not approved in that audit round; the
  later one-row repair approval is recorded separately below.
- Owner-approved Progressive Kids Group pricing is booking-level pricing, not
  Legacy monthly true-up:
  - `previousActiveSessions` = active entitlement sessions ordered before the new booking.
  - `cumulativeAfter = previousActiveSessions + newBookingSessions`.
  - `grossBookingPrice = newBookingSessions * rateOf(cumulativeAfter)`.
  - Apply the current booking's coupon after gross pricing; do not retroactively
    reprice prior bookings or create a monthly price-difference credit.
- Owner selected Option A on 2026-07-13 for Legacy-to-Progressive compatibility.
  After Entry activation, every new general Kids Group booking must use Progressive.
  Active Legacy bookings in the same user/course/month period contribute only their
  stable entitlement-session count to the initial `previousActiveSessions` baseline.
  Legacy stored/paid money is never deducted, and old Legacy rows are not repriced,
  credited, refunded, assigned Progressive scopes/snapshots, or backfilled.
- Historical review and any future repair proposal are limited to genuinely unpaid
  Kids Group bookings. Paid, approved-payment, and verified bookings must not be
  reopened or repriced in this round.
- Owner-approved one-row Production repair for unpaid booking
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40`, `550 -> 625`, completed on 2026-07-13
  after a fresh dependency audit. No paid or verified booking was reopened.
- Owner approved a source-only Progressive payment notification correction on
  2026-07-13. A successful first approval must continue notifying the booking
  owner once and must also notify every current `admin` and `super_admin` profile
  once with operational, amount-free copy linked to `/admin/payments`. No deploy,
  remote migration, Entry activation, repeat payment, or Production data write was
  approved in that round.
- Owner approved final general Kids Group Entry activation on 2026-07-13 using
  the exact already deployed functional source, with no Booking or Payment write,
  and required immediate primary rollback to Entry `false` if the authenticated
  Kids Group routing/price proof could not be completed. Activation was attempted,
  that proof gate could not be satisfied from the available Chrome identity, and
  the approved rollback was completed as recorded below.
- Owner then confirmed an existing Chrome User session and approved only read-only
  User/Parent identity, child, entitlement-history, browser-local draft, and
  Entry-off preview verification. No Entry activation, deploy, Booking confirmation,
  Payment action, account/child change, or Production business-data write was
  approved in this follow-up round.
- After the later migration/deploy Gate 0 found the unexpected Production Entry
  variable, Owner approved one isolated environment cleanup only: remove exactly
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` from Vercel Production, preserve every other
  variable, do not deploy or migrate, and then restart the migration/deploy gate
  from Gate 0 under separate approval.
- Owner then approved the final Option A activation attempt from exact clean
  functional source `d4574a7`, authenticated no-write `4+4` Production UAT, bounded
  monitoring/reconciliation, and immediate rollback to the known-good Entry-absent
  deployment if any mandatory proof failed. No source, migration, Booking, Payment,
  or Production business-data write was approved.
- Owner subsequently approved one combined closeout round for the localized
  Progressive Kids Group Summary rendering fix, narrow deterministic tests, source
  commit/push, corrected Entry-absent deployment, exact-source Entry activation,
  authenticated no-write `4+4` UAT, and documentation closeout. Booking confirmation,
  Payment/business-data writes, API/RPC/migration/tier changes, Legacy changes, and
  Adult Group/Private changes remained prohibited.
- Owner superseded the rollback discussion on 2026-07-14 and approved one combined
  Production Booking Regression closeout: continue fixing the current source,
  require Localhost and disposable-database gates before commit/deploy, deploy the
  exact tested source, and then perform Production no-write UAT. Source/database
  rollback, migrations, environment/Entry/allowlist changes, Production writes,
  pricing/tier/formula changes, and unrelated work remained prohibited.
- After authenticated evidence verified the Booking price UI and exposed a History
  payment-selection incident, Owner authorized a strictly read-only Production
  audit plus documentation only. Source/tests, deploy, migration, environment,
  payment/batch actions, slip upload/submission, Booking/coupon/Ledger/Finance
  changes, data repair, and payment grouping/prefix policy changes were not
  authorized. The existing History payment action must not be replayed.
- Owner then approved the narrow History lifecycle/error-contract source fix,
  executable disposable/local browser coverage, exact-source commit/push/deploy,
  and controlled Production UAT consisting only of two prepare/cancel cycles for
  the exact `3,464 + 866` prefix. Slip upload/submission, Payment/attempt/allocation/
  Ledger/Finance/coupon/Booking changes, migration/environment/Entry/allowlist/
  dependency changes, guard weakening, and Production data repair remained
  prohibited.
- Owner selected the Production Lesson Wallet recurring-round regression as the
  single urgent active task on 2026-07-15 and approved one gated round covering
  read-only audit, narrow Source fix, disposable verification, commit/push,
  exact-source Production deployment, Production verification, and documentation
  closeout. Production business-data repair, real-customer credit consumption,
  Production test-data creation, migration, pricing/payment/coupon/Ledger/Finance/
  payroll/attendance/SlipOK changes, and Reschedule/Makeup redesign remain
  prohibited. A controlled Production redeem requires independently proven
  Owner-controlled test data.
- Owner subsequently confirmed on 2026-07-15 that the Owner personally completed
  a real Production Lesson Wallet redemption successfully and accepted the release.
  This confirmation supersedes the prior documentation-only statement that
  controlled-write UAT had not run. Codex is authorized only to reconcile the
  existing actions read-only and close documentation; no replay, repair, new
  credit, migration, deploy, environment change, or next-task selection is
  authorized.
- Owner selected **Admin Schedules — Unassigned Coach Group Incorrectly Shown as
  Green** as the single urgent active task on 2026-07-17. This supersedes the prior
  `NONE` active-task state. Authorized scope is read-only Production/Git audit,
  narrow Source fix, executable/local browser verification, and documentation.
  Commit, push, deploy, migration, Production data repair/write UAT, auto-assignment,
  Admin Schedules Performance, and Homepage LV remain prohibited.
- Owner subsequently approved re-verification, Production Build, post-build clean
  restart, scoped Source/Test commit and push, and a separate documentation commit
  and push for this exact fix. Deploy, Production UAT, Production data changes,
  migration, auto-assignment, Admin Schedules Performance, and Homepage LV remain
  prohibited.
- Owner then approved exact-source Production deployment of functional Source
  `0226e363f6677b078430f93459c2ee2ede6484e8`, convergence of the four established
  Production aliases, authenticated read-only Production UAT, runtime monitoring,
  and final documentation closeout. Source/Test changes, migration, environment/
  feature-control/allowlist changes, Production business-data writes, assignment
  saves, attendance/check-in/payroll writes, auto-assignment, Admin Schedules
  Performance, Homepage LV, and all other new work remained prohibited.
- Owner subsequently authorized documentation correction only for stale
  post-release current-state wording. Read-only Git/Vercel verification and a
  scoped commit/push of `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md` are authorized; Source/Test changes, deploy/alias actions,
  Production UAT repetition, migration, environment/feature-control/allowlist
  changes, Production writes, and Parking Lot work remain prohibited.
- Owner selected **Admin Schedules — Coach Overlap Guard and Ungrouped Coach
  Semantics** as the single urgent active task on 2026-07-17. The Owner confirmed
  six remediation decisions: (1) Coach Nice must remain at Ramintra for the
  2026-07-17 17:00–19:00 collision; (2) one coach may own only one active exact
  group in any overlapping interval, including the same slot/branch; (3)
  `ยังไม่จัดกลุ่ม` must never communicate an exact responsible coach, and any
  legacy/suggested coach must be explicitly non-exact; (4) exact/current conflicts
  hard-block while legacy-only conflicts warn and are never auto-deleted; (5)
  protect current/future writes first and report historical conflicts separately;
  and (6) historical attendance, check-in, teaching hours, and payroll remain
  unchanged unless separately approved.
- Authorized scope for this round is Source, local-only migration, local tests,
  Production repair dry-run, and documentation only. Commit, push, Production
  migration, Production data repair/write, deploy, historical evidence changes,
  Performance, Homepage LV, and other Parking Lot work remain prohibited.
- Owner subsequently authorized one controlled Production data repair only for
  Coach Nice at Ratchada on 2026-07-17 17:00–19:00. The repair is complete: the
  exact Ratchada group was unassigned and only its matching legacy row was
  deleted. Source/Test, migration, commit, push, deploy, Ramintra, Coach Base,
  group membership, historical evidence, and financial data remained out of
  scope and unchanged.
- Owner then confirmed the local auto-group naming and migration-safety policy:
  the three Nice/Ratchada learners may intentionally remain without a replacement
  coach and display `ยังไม่ได้มอบหมายโค้ช`; Coach Base is the real exact coach of
  the other two Ratchada learners and must keep its coach, members, and legacy row,
  but its placeholder name must later be repaired to a real group name. Exact
  coached groups with blank/placeholder names must auto-name from the learners'
  current active Level definition, stored names must not embed member counts, and
  valid user-authored names must not be overwritten. This round authorizes only
  local Source/migration/tests, a Coach Base rename dry-run, and documentation;
  commit, push, Production migration, Coach Base Production repair, and deploy
  remain prohibited.
- Owner subsequently accepted the Coach Base dry-run name `ชุดพื้นฐาน` and
  authorized only a scoped two-commit publish round: re-verify, commit the exact
  Source/Test/Migration set, commit the three current-state documents separately,
  and push both commits non-force. Production rename, Production migration,
  deploy/aliases, Production UAT/write, feature/environment/allowlist changes,
  historical cleanup, and Parking Lot work remain prohibited.
- Owner then confirmed that the three Production-user moves from unassigned group
  `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a` into Coach Base group
  `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc` were intentional. Coach Base now owns all
  five active learners; they must not be moved back. All five resolve to active
  `basic / ชุดพื้นฐาน`, so the proposed exact name remains `ชุดพื้นฐาน`.
  Documentation correction only is authorized in this round; Production rename,
  Production migration, Source changes, deploy/UAT, and every Production write
  remain prohibited.
- Owner subsequently approved one exact name-only Production repair for Coach Base
  group `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc`: change only `name` from
  `ยังไม่จัดกลุ่ม` to `ชุดพื้นฐาน` when the exact group, Coach Base id, five raw/
  active members, and all five active `basic / ชุดพื้นฐาน` Level definitions still
  matched. The conditional repair completed with affected row count `1`; coach,
  membership, legacy assignment, the empty former waiting group, Ramintra/Nice,
  operational evidence, and financial data remained unchanged. Production
  migration, Source deploy, controlled application-write UAT, and every other
  Production action remain prohibited pending separate approval.
- Owner subsequently approved applying only committed migration
  `20260717070225_coach_assignment_conflict_guards.sql` after a fresh zero-blocker
  read-only preflight. The migration was applied exactly once and reconciled;
  Source deploy and Production write UAT remain prohibited pending a separate
  approval.
- Owner subsequently approved only exact-source Production deployment of
  `1b995396f432d11b133c1cf4b5604b6db875b63b` from a clean detached worktree,
  infrastructure-only health checks, and documentation closeout. The deployment
  completed and all four aliases converged. Authenticated Production UAT and every
  controlled write remain prohibited and are scheduled for tomorrow by Owner.
- On 2026-07-18, real Head Coach operations confirmed a Production regression in
  deployment `dpl_Ga9NvYaYCcNG4BzVdqeCt3pBbQ4F`: assignment visibility and
  mixed-Level grouping were blocked. Owner authorized an emergency alias-only
  rollback to known-good deployment `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`, narrow
  authenticated read-only incident verification, activity-log reconciliation,
  and documentation closeout. Database migration `20260717070225` must remain
  applied; Source/data repair, forward fix, mutation UAT, environment/feature/
  allowlist changes, and all financial/attendance/payroll writes remain prohibited.
- Owner then authorized an emergency write-containment release only, based on
  restored Production Source `0226e363f6677b078430f93459c2ee2ede6484e8`. The
  Head Coach assignment Save and the exact-group-writing Admin Makeup actions must
  authenticate and authorize normally, then return `503` before the first database
  mutation. Migration rollback/change, data repair, forward-fix behavior,
  attendance/check-in/payroll/financial writes, and unrelated Source remain
  prohibited. If the local/deployment/no-write gates pass, this minimal containment
  may be deployed immediately and documented; the task must remain open.
- Owner then authorized a forward Source correction based exactly on
  `1b995396f432d11b133c1cf4b5604b6db875b63b`, with Local tests plus scoped
  commit/push only. That historical policy preserved valid exact `coach_id`
  assignments regardless of placeholder/legacy names, treats wide or mixed Level
  as non-blocking, used `กลุ่มผสม` as the mixed fallback, preserved manual
  names, strips stored member-count suffixes, and requires all exact-assignment
  writes to use the atomic RPC contract. Deploy, containment removal, Production
  mutation/UAT, migration change, and repair of the 3 damaged slots remain
  prohibited pending separate Owner approval. Its automatic naming rule was
  superseded by the latest 2026-07-24 Owner decision recorded above.
- Owner subsequently authorized a scoped manual-name-preservation correction,
  Local verification and publish, a new unpromoted Production-target Canary,
  one repeat Owner/Head Coach controlled Save for exact slot
  `53c3556a-6067-4ad1-813c-ca8410d17994`, and conditional promotion of that same
  artifact only after complete reconciliation. The corrective Save and promotion
  passed. Direct SQL repair, migration change, and repair of the remaining two
  damaged slots remain prohibited without separate evidence and approval.
- Owner selected **Admin Schedules Performance** as the next single Active Task on
  2026-07-19 and authorized **Phase A only**: read-only Source review, evidence
  reconciliation, performance design, and documentation. The primary scope is
  `/admin/schedules`; the approved UX is a true monthly-summary-first flow that
  loads detail only after a date is selected. Initial performance budget is normal
  load at or below 3 seconds and P95 at or below 5 seconds. Cache is allowed only
  for low-volatility reference data within 5–15 minutes. Admin/Super Admin and
  Coach slowness are Owner-confirmed observations; system-wide User impact remains
  Unknown / Need verification and must be measured separately. Region relocation
  is not the first fix. Source/Test changes, migration, commit, push, deploy,
  Production UAT/write, and changes to Coach/User/Payments behavior remain
  prohibited until a separate Phase approval.
- Owner explicitly approved **Admin Schedules Performance Phase B Source Fix +
  Local Test** on 2026-07-20 and confirmed authenticated month-wide server-side
  Search on demand for learner, parent, Coach, branch, course, and booking status.
  The initial page must be a true monthly summary, detail must load only after date
  selection, and the default low-volatility reference-cache window is 10 minutes.
  Migration/RPC/index work, commit, push, branch change, deploy, Production access/
  UAT/write, environment/feature/allowlist change, and Coach/User/Payments portal
  changes remain prohibited.
- Owner approved the Phase B Source and documentation Commit + Push gate on
  2026-07-21. After the first publish attempt stopped because Docker was unavailable,
  the resumed disposable local E2E passed `5/5` with residue `0`. Owner then
  explicitly waived repeat `.next` cleanup/clean-restart for this gate because it
  is an ignored local-generated artifact. Deploy, Production access/UAT/write,
  migration, environment, feature-control, and allowlist actions remain prohibited.
- Owner later approved one Production-target, unpromoted Phase B Canary and then a
  read-only performance-diagnosis gate. Canary
  `dpl_5x2vzwUxAmxNaT8HZGJeBQ32JVr4` is `READY` on exact commit
  `b0bada3d076302d24ebe3b594c03b22bf0997869`; Super Admin functional UAT passed,
  but the performance gate failed. Warm navigation P95 was `5.344 s`, July summary
  Server duration was `2.766–3.447 s`, selected-day exceeded `3 s` in `3/5`
  samples, and Search was `4.654–5.937 s`. Owner prohibited promotion, Source fix,
  migration/index/RPC, infrastructure/config change, and Production writes in the
  diagnosis gate.
- Owner then approved a **Source-only Canary Performance Remediation + Local Test**
  gate. The remediation and local tests completed on 2026-07-21 without commit,
  push, deploy, Production access, or database/Infrastructure change. The next
  action at that checkpoint was Owner/PM review before any separate Commit + Push
  authorization. Owner subsequently approved that scoped two-commit, non-force
  publish and waived repeat `.next` cleanup/clean-restart for the exact verified
  worktree without claiming that smoke was rerun.
- Owner subsequently approved one Production-target, unpromoted remediation Canary
  from exact branch HEAD `67a08fa5a11ee714d8ec23be3fb125732e255b54`
  plus bounded authenticated read-only performance UAT. Deployment
  `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` became `READY`, but warm navigation P95 was
  `7.907 s`, above the `5.000 s` mandatory budget. The gate stopped before month,
  selected-day, Search, mobile, or Standard Admin checks; no promotion, alias move,
  or business-data write occurred.
- Owner approved **Phase B Closure Gate B1 — Final Read-only Bottleneck Diagnosis**
  on 2026-07-22, then separately approved an Infrastructure Region Experiment and
  authenticated read-only continuation. Treatment deployment
  `dpl_DvJ2gVNSqmqUCcdgcoiPTwJVSYh2` ran the same business Source in `icn1` and
  passed the 20/20 monthly gate without promotion or alias movement.
- Owner then approved permanent `icn1` repository configuration, Local validation,
  and two scoped non-force publishes. Configuration commit
  `77db099607dd7ee8dfe265929a6720818e2015d1` is pushed. No new deployment,
  promotion, Production UAT/write, migration/index/RPC, environment/feature-control/
  allowlist change, or data repair is authorized by this documentation closeout.
- Confirmed examples from the supplied Owner instruction and executable Progressive
  scenario checks:
  - one booking of 10 sessions = `5,000`;
  - split `5+5` = `3,125 + 2,500 = 5,625`;
  - ten separate one-session bookings = `5,825`.
- Evidence: `src/lib/progressive-booking-pricing.ts`,
  `scripts/check-progressive-booking-pricing.js`, and the 2026-07-12 Owner
  documentation-reconciliation instruction. A separately named design document
  containing “Formula And Ordering / Scenario Matrix” was not present in the repo:
  `Unknown / Need verification`.

### Current Project Matrix — Reschedule-In Exact Coach Assignment / Legacy Fallback Isolation

| Field | Current value |
| --- | --- |
| Active Task | `RESCHEDULE-IN EXACT COACH ASSIGNMENT / LEGACY FALLBACK ISOLATION` |
| Task Status | SOURCE COMPLETE — COMMITTED AND PUSHED; functional Source/Test commit `54752bcc2a914b7d2f67f344c62e50f642f890ac` and this documentation closeout were published on the existing branch. Fresh required Commit-Gate checks passed. Deploy/Production remain unchanged; accepted smoke and isolated DB/E2E residual risks remain; Owner/PM review is required |
| Branch | `spike/next-major-security-upgrade` |
| Local HEAD | Documentation closeout commit containing this matrix, with functional commit `54752bcc2a914b7d2f67f344c62e50f642f890ac` as its parent; exact documentation SHA is verified in final Git evidence |
| Remote HEAD | Same documentation closeout commit on `origin/spike/next-major-security-upgrade`; functional commit `54752bcc2a914b7d2f67f344c62e50f642f890ac` is its direct ancestor |
| Ahead/Behind | `0/0` after the documentation push |
| Protected dirty files | Preserved and not edited in this task: `AGENTS.md` SHA-256 `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`; `src/lib/schedule-slot-utils.ts` SHA-256 `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`, expected/current HEAD blob `4521281d099efb189429a744909552d67871ff23` |
| Documentation Drift | Reconciled. Current mutable state now records the exact functional publish and separates fresh Commit-Gate verification from retained build evidence and Blocked/Not run smoke/DB suites. Port `3000` ownership is recorded only as an intermittent observation: PID `10416` was present at this closeout, not asserted as permanent. Earlier Plan A drift remains corrected |
| Owner Policy | Any `coach_assignment_groups` row places the slot in the exact model, including an empty group. Exact membership is authoritative. In zero-exact-row genuine legacy-only slots, Legacy remains valid only for legitimate non-User-Reschedule learners. User Reschedule-in never auto-assigns; it stays pending until Head Coach Save. `rescheduled_from_id` is shared by User Reschedule, Wallet, and Makeup, so Makeup uses `is_makeup` and Wallet uses batched `lesson_wallet_credits.redeemed_session_id` evidence. Wallet/Makeup semantics remain unchanged. Exact/provenance errors fail closed; notification failures remain observable; historical gaps are not repaired |
| Root Cause | The first local fix corrected exact-row precedence but left genuine legacy-only fallback slot-wide, so every active session—including a new User Reschedule-in—still inherited the Legacy coach. Consumers also ignored several Supabase errors and treated failed exact/provenance queries as empty data, reopening Legacy. The notification follow-up still treated zero required recipients as success, conflated Admin recipient lookup with insert, classified thrown inserts as existence-check failures, and counted only Head Coach recipients in activity details |
| Provenance classification | Normal = no `rescheduled_from_id`; User Reschedule-in = `rescheduled_from_id` present + `is_makeup=false` + no Wallet redemption row; Lesson Wallet = `lesson_wallet_credits.redeemed_session_id` matches the session; Admin Makeup = `is_makeup=true`. Wallet evidence is loaded in bounded batches, never one query per learner |
| Source Complete | **Yes — committed and pushed.** Functional commit `54752bcc2a914b7d2f67f344c62e50f642f890ac`, tree `a3fc7b3d01a3fd6a9a0eb7eae4403e427a13dfac`, parent `cc48b03f79b916221e0d86099fa017d0c9cc57a6`, subject `fix(coach): isolate reschedule-in assignments`. Shared Plan A provenance/assignment rules, exact/Legacy isolation, fail-closed consumers, and structured notification failure behavior are published. This is Source publication only, not Deployment or Production activation |
| Tests Passed | Fresh Commit-Gate checks passed: focused behavior `29/29`; Admin assignment `38/38`; Lesson Wallet `17/17`; notification-date `26/26`; TypeScript `--noEmit --incremental false`; ESLint zero warnings; mojibake `250` files; `git diff --check`; staged checks and high-confidence staged secret scan `0` findings. Prior build compile/type/static generation `91/91` is retained dated evidence and was not rerun. Post-build root/static smoke, Local DB-writing/E2E, and Attendance Gap fixture UAT remain Blocked/Not run |
| Committed | Yes — exact 16-file functional commit `54752bcc2a914b7d2f67f344c62e50f642f890ac` plus exact three-file documentation closeout commit containing this matrix |
| Pushed | Yes — functional commit and the documentation closeout commit were pushed normally, non-force, to `origin/spike/next-major-security-upgrade` |
| Current Source | Published branch Source with functional commit `54752bcc2a914b7d2f67f344c62e50f642f890ac` as the exact Plan A Source/Test artifact |
| Deployed | No — prohibited and not run |
| Promoted | No — prohibited and not run |
| Deployed Source | Unchanged from the prior documented deployment; not accessed or reverified in this gate |
| Deployment ID | Prior documented current artifact `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; not accessed or changed in this gate |
| Migration Source | None |
| Migration Applied | No — prohibited and not required |
| Environment Change | No |
| Feature Enabled | No change; no task-specific feature control was enabled |
| Allowlisted | No change; no task-specific allowlist was changed |
| Production Active | No — the exact-assignment fix is committed and pushed in functional commit `54752bcc2a914b7d2f67f344c62e50f642f890ac`, but has not been deployed or promoted and is not active in Production |
| Production UAT | Not run — prohibited |
| Controlled Write UAT | Not run — prohibited |
| Data Repaired | No |
| Production Data Changed | No; no Production access occurred |
| Customer Impact | No new runtime impact from this gate. The Production incident and any equivalent stale-Legacy exposure remain unchanged until a separately approved release and verified UAT |
| Financial Impact | None from this gate; no payment, booking entitlement, wallet, coupon, finance, payroll, or Production data changed |
| Attendance Gap status | Source now returns no stale Legacy coach attribution for a pending User Reschedule-in. Historical and newly classified unassigned past rounds remain in review only; no auto-attendance, auto-absence, auto-makeup, auto-payroll, attribution repair, or historical repair occurred |
| Blocker | No blocker to the completed Source publish. Accepted residual verification gaps remain: no trusted isolated Local Supabase runtime for DB-writing/E2E or Attendance Gap fixture UAT, and post-build root/static smoke was not run because port `3000` ownership was intermittent. PID `10416` was observed at this closeout and preserved; `.next` was absent |
| Remaining Work | Owner/PM review before any separately authorized Deploy/Release Readiness gate. Optional future residual-risk closure requires a stable free local port and a provable isolated Local Supabase runtime. Learner-visible warning UI and historical repair remain outside scope |
| Task Done | No |
| Next Gate / Next Action | Owner/PM review and decision for a separate Deploy/Release Readiness gate; do not Deploy automatically |
| Parking Lot authorization state | No Parking Lot task is authorized |

### Historical / Superseded Project Matrix — Coach Notification Bangkok Date Consistency

| Field | Current value |
| --- | --- |
| Active Task | NONE |
| Task Status | DONE — SOURCE/TEST PUBLISHED; EXACT ARTIFACT DEPLOYED/PROMOTED; DISPLAY FIX PRODUCTION-ACTIVE; OWNER-CONFIRMED NATURAL-USE PRODUCTION UAT PASSED; DOCUMENTATION CLOSEOUT PUBLISHED |
| Branch | `spike/next-major-security-upgrade` |
| Local HEAD | Documentation-only closeout commit containing this record; parent `11754057f9d82f71c7b69248a77997e491f5069c`. Exact SHA/tree are reported in the final handoff |
| Remote HEAD | Same documentation-only closeout commit after exactly one successful normal non-force Push; exact live Remote SHA is reported in the final handoff |
| Ahead/Behind | `0/0` after final Local/upstream/live Remote convergence verification |
| Protected dirty files | Preserved checksum-exact: `AGENTS.md` = `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`; `src/lib/schedule-slot-utils.ts` = `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181` |
| Documentation Drift | No — current state records Owner-confirmed natural-use Production UAT and Task completion; staged-Deploy, Promotion, and both earlier Hard Stop records remain dated historical evidence; external payment traffic remains historical and unrelated/out of scope |
| Root Cause | Generation-time formatting is fixed, but historical `notifications.message` values retain the old runtime-shifted Thai date. `NotificationsClient` displayed and searched that stored string directly instead of deriving the slot date from the canonical exact `date` in `link_url` |
| Source Complete | Yes — functional commit `c7f970a3f22cd7ba73f043f529c8bdbcb818da78`, tree `6dffe07c29b5a14c2a38d35a81536de00b180f89`, parent `a6a876528b43557cf9b8d0cf5f52bfacdeb725c4`. A pure display normalizer accepts only three proven titles, a relative internal `/coach/` link with one valid exact date key, and a recognizable slot-date token; it replaces only that token through the shared Bangkok formatter. UI display and local search use the derived message without mutating the Server object, link, generator, dedupe, or persisted row |
| Tests Passed | Yes — retained from the immediately preceding exact-source gate because SHA/tree/status remained unchanged: notification `26/26`, Lesson Wallet `17/17`, Progressive payment notifications `16/16`, TypeScript with `--noEmit --incremental false`, ESLint zero warnings, mojibake `248`, diff check, and secret scan `0`. These tests were not rerun in this gate; fresh worktree identity/status and focused secret scan `0` were reverified |
| Committed | Yes — functional commit `c7f970a3f22cd7ba73f043f529c8bdbcb818da78`, release/documentation commit `11754057f9d82f71c7b69248a77997e491f5069c`, and the exact documentation-only Task-closeout commit containing this record |
| Pushed | Yes — release and this exact documentation-only Task closeout are published on `origin/spike/next-major-security-upgrade` by normal non-force Push; final Local/upstream/live Remote converge at `0/0` |
| Current Source | Exact committed/pushed release `11754057f9d82f71c7b69248a77997e491f5069c`, tree `275191b84e537e00a217dbc6a267528750f913c6`; no Source change occurred in this gate |
| Deployed | Yes — exactly one pinned `deploy --prod --skip-domain` command created a Production-target staged artifact; Deploy command count `1`, retry/force/rebuild/redeploy count `0` |
| Promoted | Yes — exactly one pinned `vercel promote` command ran from `2026-07-27T12:45:42.8265046Z` through `2026-07-27T12:45:49.7296714Z`, exit `0`; deploy/rebuild/retry/force/rollback/separate alias mutation counts were all `0` |
| Deployed Source | Production-active promoted display artifact: exact release `11754057f9d82f71c7b69248a77997e491f5069c`, tree `275191b84e537e00a217dbc6a267528750f913c6`. Functional ancestor `c7f970a3f22cd7ba73f043f529c8bdbcb818da78` contains the exact reviewed four-file display fix |
| Deployment ID | Current promoted artifact `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`; unique URL `https://new-athlete-badminton-school-cr0k4vw6a-aachanin1s-projects.vercel.app`; target/state/substate `production/READY/PROMOTED`; source `cli`; `autoAssignCustomDomains=false`; configured functions region `icn1`. Previous `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z` remains READY as an unmodified rollback candidate |
| Existing Exact-SHA Preview | `dpl_CzbKmahkF22HWhHM7YLMkJ2E9AKK`; unique URL `https://new-athlete-badminton-school-ic6n4p3m8-aachanin1s-projects.vercel.app`; exact Git SHA `11754057f9d82f71c7b69248a77997e491f5069c`; target/state `preview/READY`; Git branch alias `new-athlete-badminton-school-git-spi-6a0ce4-aachanin1s-projects.vercel.app`; functions region `icn1`; created/building/READY milliseconds `1785138794296/1785138795268/1785138863805` |
| Deployment Timestamps | Deploy command `2026-07-27T10:47:19.2212934Z`–`2026-07-27T10:48:38.2246951Z`; artifact created `2026-07-27T10:47:28.769Z`, build started `2026-07-27T10:47:29.555Z`, READY `2026-07-27T10:48:38.695Z` |
| Artifact Build | Passed — Vercel CLI `56.5.0`, Next.js `16.2.6`, compile and TypeScript passed, static generation `91/91`, build ran in `cle1`, configured functions region `icn1`, and bounded build-log error lines `0` |
| Production Alias Baseline | Before Promotion, all four established aliases were on `dpl_7usUQp6R6GqKGoxu5xc6RYTS699Z`; after the one Promotion, all four map to `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4`: `www.newathleteschool.com`; `new-athlete-badminton-school.vercel.app`; `new-athlete-badminton-school-aachanin1s-projects.vercel.app`; `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`. Missing/extra/wrong mappings `0/0/0`; Preview branch alias remained unchanged and the previous artifact remains READY as a rollback candidate |
| Migration Source | None — not required |
| Migration Applied | No — not required and prohibited |
| Environment Change | No |
| Feature Enabled | Not applicable; no feature control exists or changed for this correction |
| Allowlisted | Not applicable; no allowlist exists or changed for this correction |
| Production Active | Generation-time Bangkok fix: **Yes**. Stored-message display fix: **Yes** — exact artifact `dpl_61EJHnLchXS8KjcMXh3GEBR1jiF4` is `production/READY/PROMOTED` and owns all four established Production aliases; historical stored messages remain unchanged |
| Production Read-only Audit | Completed through authorized Supabase SELECTs only. Proven one-day-early rows with exact date/slot evidence: assignment `2,017` (`860` unread / `1,157` read), check-in-success `885` (`402/483`), attendance-gap `416` (`157/259`). Correct-label rows: assignment `2` unread and attendance-gap `6` (`5/1`). Generic-link populations remain `Unknown / Need verification` per row: check-in-window `759` (`364/395`), absent/late `138` (`124/14`), and wallet-related `1,242` across generic/month-only links |
| Incident Evidence | Ramintra slot `3c4a2227-0a0e-4134-9a1a-d382e124e6c8`, `2026-07-26 17:00–19:00`, has assigned `3`, attendance `1`, missing `2`; exact notification link/slot date is `2026-07-26` while audited stored messages say `25 ก.ค. 69` |
| Production UAT | Passed — Owner-confirmed natural-use visual confirmation on 2026-07-27 proved the displayed Coach notification date and linked Attendance destination date match. This documentation gate did not repeat Production access or inspect ordinary natural-use side effects |
| Unrelated External Traffic | A payment-cancel POST observed during the historical Promotion closeout remains historical evidence, but Owner classified it as unrelated/out of scope and not a blocker for this notification display gate; no payment or Supabase investigation occurred |
| Controlled Write UAT | Not run / not required for this presentation fix |
| Data Repaired | No |
| Production Data Changed | No Codex repair or task-specific mutation; ordinary Owner natural-use side effects were not audited |
| Existing-message Decision | Display normalization does not repair, rewrite, hide, merge, reorder, or deduplicate stored rows. Existing messages remain unchanged; any persisted-data repair remains a separate Owner decision |
| Customer Impact | Historical stored rows remain unchanged, but supported notification messages display/search using the canonical `link_url` date; visible behavior was confirmed by Owner |
| Financial Impact | None — no payment, booking, attendance, wallet, entitlement, payroll, accounting, or Production-data mutation occurred |
| Blocker | None |
| Remaining Work | None within this task |
| Task Done | Yes |
| Next Gate / Next Action | Await Owner selection; do not start another task or Parking Lot item automatically |
| Parking Lot authorization state | No Parking Lot task is authorized |

### Historical / Superseded Project Matrix — Coach Assignment Status Communication + Save Feedback

| Field | Current value |
| --- | --- |
| Active Task | NONE |
| Task Status | DONE — SOURCE/LOCAL, FUNCTIONAL COMMIT + PUSH, ARTIFACT BUILD, AUTHENTICATED STAGED UAT, EXACT-ARTIFACT PROMOTION, PRODUCTION-ACTIVE VERIFICATION, READ-ONLY POST-PROMOTION PRODUCTION UAT, AND DOCUMENTATION PUBLICATION COMPLETE |
| Branch | `spike/next-major-security-upgrade` |
| Local HEAD | Documentation closeout commit containing this record; exact SHA/tree/parent are reported in the final handoff. Its parent is `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`; functional ancestor is `fc9f228fa5fc165a3b961636267c6d8614f852cf` |
| Remote HEAD | Same documentation closeout commit after one successful normal non-force Push; exact live Remote SHA is reported in the final handoff |
| Ahead/Behind | `0/0` after documentation publication verification |
| Protected dirty files | Excluded and checksum-exact before/after: `AGENTS.md` = `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`; `src/lib/schedule-slot-utils.ts` = `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181` |
| Root Cause | Coach UI counted every state other than `saved` as unassigned and then counted `changed` again; Save success had warning handling plus `router.refresh()` but no success toast or local saved evidence during the refresh gap |
| Source Complete | Yes — functional commit `fc9f228fa5fc165a3b961636267c6d8614f852cf`, tree `d75793ad61fc0c02dbbc2631cfb957fd8f4ae5d7`, parent `b79e4d5a2bf31c232f55ceba921012635a357807`. Red/amber/green counts are mutually exclusive at page/date/date-card/slot-card levels; filter/copy are Owner-approved; a per-slot normalized saved signature provides immediate success feedback and is accepted only while the Server baseline and current draft signatures still match |
| Tests Passed | Yes — Local only: deterministic assignment checks `38/38`; Local Supabase Playwright E2E `6/6` with residue `0`; focused save-state E2E `1/1` with residue `0`; Lesson Wallet `17/17`; TypeScript; ESLint with zero warnings; mojibake `247` files; Next.js 16.2.6 build `91/91` static pages; post-build `.next` cleanup, clean dev restart, localhost `/` `200`, static CSS `200`; final `git diff --check` passed |
| Committed | Yes — exact functional commit `fc9f228fa5fc165a3b961636267c6d8614f852cf`; prior documentation baseline `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`; and the documentation-only closeout commit containing this record with subject `docs: close coach assignment status release` |
| Pushed | Yes — functional and prior documentation commits were already pushed; the documentation-only closeout commit containing this record was published once by normal non-force Push and verified against the live Remote in the final handoff |
| Current Source | Functional Source/Test commit `fc9f228fa5fc165a3b961636267c6d8614f852cf`, prior release documentation baseline `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`, and the documentation-only closeout commit containing this record |
| Artifact Build | Passed — exact staged artifact build completed with Next.js `16.2.6`, static generation `91/91`, and no build error |
| Previous Deploy Gate | Partial — artifact creation/build/control-plane verification passed, but mandatory unauthenticated application smoke did not pass because Vercel Deployment Protection redirected application paths to SSO |
| Deployed | Yes — the previously built Production-target artifact was promoted without a new deployment or rebuild |
| Promoted | Yes — exact command `vercel promote dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E --yes --scope team_gw8Y6CPd602WAKRsVFobPGCL --no-color` ran once from `2026-07-25T07:23:14.0186485Z` to `2026-07-25T07:23:19.4718722Z`, exit `0` |
| Deployed Source | Production-active artifact contains exact clean commit `5544c8a3509fd2ca8e2c2cfc8c6aae871304e216`, tree `56cd0afb02f64aedba047caef205725a56381b06`; Vercel metadata reports the same Git SHA |
| Deployment ID | Current exact artifact `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E`, unique URL `https://new-athlete-badminton-school-255g5cr3r-aachanin1s-projects.vercel.app`, target/state/substate `production/READY/PROMOTED`, source `cli`, `autoAssignCustomDomains=false`, region `icn1`. Creation `2026-07-24T16:57:43.411Z`, build start `2026-07-24T16:57:44.522Z`, and Ready `2026-07-24T16:58:54.970Z` timestamps remained unchanged |
| Production Alias Baseline | Current `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E`: `www.newathleteschool.com`; `new-athlete-badminton-school.vercel.app`; `new-athlete-badminton-school-aachanin1s-projects.vercel.app`; `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`. All four moved from prior baseline `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`; missing/extra/wrong `0/0/0` |
| Migration Source | None |
| Migration Applied | No — not required |
| Environment Change | No |
| Feature Enabled | Not applicable; no feature control changed |
| Allowlisted | Not applicable; no allowlist changed |
| Production Active | Yes — fresh preflight/postflight kept exact artifact `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E` `production/READY/PROMOTED`, Git SHA exact, Current through all four established Production aliases, region `icn1`, and authenticated application rendering at the canonical hostname |
| Production UAT | Passed — Owner-approved read-only post-promotion Production UAT from `2026-07-25T09:29:46.145Z` to `2026-07-25T09:33:01.353Z`; existing Head Coach session, desktop `1920x855`, mobile `390x844`, natural green/red/amber, exclusive counts, filters, exact amber copy, reload, no-overflow, console/overlay/hydration, bounded logs, and no-mutation gates passed |
| Controlled Write UAT | Not run / unauthorized / not required for this read-only release closeout |
| Data Repaired | No |
| Production Data Changed | No |
| Customer Impact | Exact Source is Production-active and verified readable for Head Coach; this documentation-only closeout causes no runtime or customer-data change |
| Financial Impact | None |
| Performance / Call Count | No API/query/polling/timer added. Existing Local E2E external-call assertions remained summary/day/search `4/7/6`; no call-count regression was observed |
| Staged Deploy Verification | Vercel CLI `56.5.0`; one deploy command, zero retry/force/promotion/alias/rollback commands; Next.js `16.2.6` build passed with static generation `91/91`; build ran in `cle1`, functions configured for `icn1`; control plane found exactly one post-gate production-target deployment, no error-level runtime log record, and no alias mismatch. Unauthenticated requests to `/`, `/api/health`, and `/_next/static/*` were redirected `302` to Vercel SSO, so the previous gate was Partial pending authorized session-based application verification |
| Staged Application UAT | Passed — existing authorized Chrome session loaded the exact staged hostname as Head Coach without login/authorization redirect. Desktop `1920x855` and mobile `390x844` passed. Natural states were green `27 ก.ค. 69 10:00–12:00`, red `27 ก.ค. 69 20:00–22:00`, and existing amber `27 ก.ค. 69 17:00–19:00`. Client-only rename of green group `พื้นฐาน / เริ่มต้น` to `พื้นฐาน / เริ่มต้น [UAT-READONLY]` changed counts from saved/changed/unassigned `8/6/6` to `7/7/6` with total `20`, exact amber label/detail and action-filter behavior passed, and reload restored `8/6/6`, original name, green/disabled state, and removed the marker. Save clicks `0`; bounded logs contained `26` unique requests, all `GET`, assignment POST `0`, all application mutations `0`, console warning/error `0`, overlay/hydration/page error `0`, runtime error/fatal/4xx/5xx `0`. Save-success toast/refresh-gap staged proof was not run because Save was prohibited; prior Local E2E remains its evidence |
| Promotion Verification | Passed — pinned CLI `56.5.0`, exact artifact promoted once with no deploy/build/rebuild/retry/force/rollback/separate alias command. Pre/post deployment inventory page count remained `20`; latest deployment ID/timestamp remained `dpl_93iqL8StYmUCqpZzZNYmdcAXzw4E` / `1784912263411`; target creation/build/Ready timestamps were unchanged. Production aliases moved `4/4`; four branch-preview mappings were unchanged; bounded post-promotion error/fatal/5xx logs were `0/0/0`. No application route or synthetic request was opened, so this is not Production UAT |
| Post-promotion Production UAT | Passed — Fresh Git/live Remote and Vercel preflight passed; canonical hostname remained exact with Head Coach role. Global saved/changed/unassigned was `85/11/25`, total `121`; 25 July was `16/4/0 = 20`, while 26 July was `14/2/2 = 18`. `ต้องดำเนินการ` showed red + amber and excluded saved, `มอบหมายแล้ว` showed only saved, `ทั้งหมด` restored all. Exact amber detail copy matched. Reload preserved Server state. Mobile/desktop overflow, Next overlay, hydration/page/console warnings/errors were `0`. Bounded Vercel logs contained `27` unique requests, all `GET/200/info`; application POST/PUT/PATCH/DELETE, assignment POST, 4xx/5xx, error/fatal were `0`. Save clicks and client draft changes were `0` |
| Documentation Publication | Complete — one documentation-only commit containing this record, exact three-file scope, one normal non-force Push, and live Remote convergence; exact commit SHA/tree/parent are reported in the final handoff |
| Blocker | None |
| Remaining Work | None for Coach Assignment Status Communication + Save Feedback |
| Task Done | Yes |
| Documentation Drift | No — authoritative current matrix, short execution index, and dated evidence agree after this documentation publication closeout |
| Documentation State | Published by the documentation-only closeout commit containing this record; exact SHA and normal non-force Push result are reported in the final handoff |
| Next Gate / Next Action | Await Owner selection; do not start another task automatically |
| Parking Lot authorization state | No Parking Lot task is authorized |

## Historical / Superseded Completed Task Records

All task sections and matrices below preserve their dated closeout state. Any
`Active Task`, `Current`, `Remaining Work`, or `Next Action` wording inside them is
historical and is superseded by the current matrix above.

### Historical Execution State (superseded snapshot through 2026-07-23)

The present-tense and `Current` wording retained inside this section describes the
state observed at its individual earlier checkpoints. Its prior Coach Assignment
Status Communication matrix is also historical; current decisions come only from
**Current Project Matrix — Reschedule-In Exact Coach Assignment / Legacy Fallback
Isolation** above.

- Active Task: **ADMIN SCHEDULES PERFORMANCE**.
- Task Status: **REGION EXPERIMENT PERFORMANCE GATE PASSED; PERMANENT `icn1`
  CONFIGURATION COMMITTED/PUSHED; CANARY UNPROMOTED; PRODUCTION UAT NOT RUN**.
- Control `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` (`iad1`) and Treatment
  `dpl_DvJ2gVNSqmqUCcdgcoiPTwJVSYh2` (`icn1`) are `READY`, Production-target,
  unpromoted, and have zero custom/Production aliases. They contain the same Admin
  Schedules business Source; functional remediation identity is
  `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`.
- Paired monthly A/B completed `20/20` samples per environment. Treatment Browser
  P50/P95 was `2.203/2.640 s`, Server P95 improved approximately `57.46%`, Browser
  P95 improved `59.82%`, and residual P95 improved approximately `46.55%`.
  Selected-day, corrected Search `21/21` GET `200`, verified mobile `390x844`, and
  functional read-only smoke passed. Standard Admin was not run. No business-data
  mutation occurred.
- Permanent repository configuration `"regions": ["icn1"]` passed Local tests and
  build, then was committed/pushed as
  `77db099607dd7ee8dfe265929a6720818e2015d1`. It has not been deployed and is not
  Production-active. Browser/RSC residual remains material and must be remeasured
  on a Canary built from the committed configuration.
- Git publish: documentation branch `spike/next-major-security-upgrade`; exact functional Source/
  Test/Migration commit is `1b995396f432d11b133c1cf4b5604b6db875b63b`,
  initial documentation commit is `20721178ae1924fd594d3ba5ce3a232f33925e7c`,
  Owner-confirmed membership-drift correction is
  `33b9d1888977e4e0fdbbc86d864f03d6e1c6aadc`, name-repair documentation closeout
  is `90be20707d3a8ef8f2f3459d0721412295742c59`, followed by the Production
  migration documentation closeout is
  `86fbdc5331011de4caee8164d769c20bba9a5ef0`, followed by the exact-source
  deployment documentation closeout `005cea2f278d9148e4542362c24f62d0a064a80f`,
  followed by emergency rollback documentation closeout
  `6ecf79eaf7cc8373979f57dab5ac2b7a43ef6181`. Emergency containment Source commit
  `3ad8a52dbda95b645608bce2f05917824e9763a6` was created from exact base
  `0226e363f6677b078430f93459c2ee2ede6484e8` and pushed non-force on branch
  `codex/emergency-coach-assignment-containment-20260718`. The documentation
  closeout is the commit containing this current-state matrix. Forward-fix Source/Test
  commit `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9`, tree
  `0fecabd92e2f2c65b7bd59227b8d6b743e6bd820`, was created directly on parent
  `1b995396f432d11b133c1cf4b5604b6db875b63b` and pushed non-force on branch
  `codex/coach-assignment-forward-fix-20260718`. Corrective manual-name Source/Test
  commit `9ef1ee30035a083426743aed3e326ad9676d65c4`, tree
  `94fe2410f0361acf639c47a4be7245c01128f21d`, was created directly on parent
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9` and pushed non-force on branch
  `codex/coach-assignment-manual-name-fix-20260718`. The B1 documentation closeout
  is the commit containing the current Admin Schedules Performance matrix.
  Pre-existing unrelated dirty paths `AGENTS.md` and
  `src/lib/schedule-slot-utils.ts` remain preserved and excluded.
- Exact remediation Source `1b995396f432d11b133c1cf4b5604b6db875b63b`, tree
  `24504017e59e597fc66d8d467186249290981bb6`, was deployed in
  `dpl_Ga9NvYaYCcNG4BzVdqeCt3pBbQ4F` and then rolled back after confirmed real
  operations regression. Rollback performed: **Yes**. The subsequently approved
  containment-only Source `3ad8a52dbda95b645608bce2f05917824e9763a6`, based on
  restored Source `0226e363f6677b078430f93459c2ee2ede6484e8`, is now active in
  Ready deployment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; all four established
  Production aliases resolve to it.
- Authenticated Super Admin read-only Production UAT passed the exact 2026-07-16
  Rama 2 Kids Group 17:00–19:00 reproduction: `7 มีโค้ช / 5 รอจัดโค้ช /
  2 อยู่ในกระเป๋า`. The no-coach group is red with
  `ยังไม่ได้มอบหมายโค้ช`, while both exact valid groups remain green. Desktop and
  390x844 mobile checks passed with console, hydration, and page errors `0`.
- At the prior deployment/UAT checkpoint, monitoring found no errors or 5xx and
  no assignment, attendance, or check-in mutation attributable to that release.
  Two concurrent Production
  `POST /api/reschedule` requests belonged to unrelated user traffic; the UAT made
  no mutation request. At that checkpoint, no environment, feature-control,
  allowlist, migration, Production business-data, repair, or financial state had
  changed for this task; the later controlled repair is recorded below.
- Current Production includes corrective Forward Source
  `9ef1ee30035a083426743aed3e326ad9676d65c4` in the later global deployment
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`; all four established aliases point to that
  later exact artifact. Coach-remediation deployment
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` remains the exact pre-Phase-B rollback
  target. The temporary `503` write containment is no longer active,
  and normal authorized atomic assignment writes are enabled. Containment
  deployment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti` remains the verified rollback
  target. Regression Source `1b995396...` was not redeployed. The
  separately authorized exact Nice/Ratchada
  data repair is Production-active. The Owner-confirmed Production-user moves put
  five active learners under Coach Base and left the former waiting group empty;
  those moves were not made by Codex. The separately approved conditional
  name-only repair changed Coach Base group `2e7...` from `ยังไม่จัดกลุ่ม` to
  `ชุดพื้นฐาน` with affected row count `1`. Authenticated read-only Admin Schedules
  UAT shows Coach Base, the five unchanged learners, and the dynamic `5 คน` count,
  with no old placeholder label or console/page/hydration error. Production
  migration `20260717070225` is now applied exactly once: at the migration-apply
  checkpoint, the fresh preflight found
  active exact groups `966`, current/future candidates `235`, blocking conflicts
  `0`, and historical report-only conflicts `8`; backfill produced `235`
  reservations with no missing, stale, orphan, or mismatched row. Production
  business data remained unchanged during migration apply. Containment deployment
  checks confirm Ready status, aliases `4/4`, and public `/`, `/api/health`, and
  generated static asset `200`. Migration `20260717070225` remains applied exactly
  once and was not rolled back. Fresh protected totals after the corrective Save
  and subsequent live Head Coach use are groups `1026`, members `2436`, legacy
  assignments `1000`, and reservations `234`. The first member-count movement
  outside the controlled slot came from ordinary Production reschedule lifecycle
  activity; three later post-promotion assignment Saves are recorded below.
- Forward base `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9` plus corrective commit
  `9ef1ee30035a083426743aed3e326ad9676d65c4` is **Source Complete and
  Production-active**. It preserves
  exact assignments by valid persisted
  `coach_id`, makes mixed/wide Level non-blocking, normalizes blank/placeholder and
  legacy count-suffix names and was intended to preserve valid manual names, displays
  member counts from live membership, and routes all five active Admin Makeup
  exact-assignment paths through the same atomic RPC used by normal Save. Local
  verification passed assignment/naming checks `30/30`, database conflict and
  concurrency checks `22/22` with fixture residue `0`, authenticated Playwright
  desktop/mobile `3/3` with residue `0`, Lesson Wallet regression `17/17`,
  TypeScript, ESLint, mojibake `234`, `git diff --check`, Production Build `91/91`,
  local migration reset/down/re-apply, and post-build clean restart with `/`,
  `/api/health`, and static asset `200`. Corrective Local verification passed
  assignment/naming/authorization `33/33`, database conflict/concurrency/lifecycle
  `22/22` with residue `0`, authenticated desktop/mobile Playwright `3/3` with
  residue `0`, Lesson Wallet regression `17/17`, TypeScript, ESLint, mojibake
  `234`, `git diff --check`, Production Build, and post-build clean restart.
- Fresh dark-canary preflight found migration `20260717070225` applied exactly
  once, successful assignment activity after containment `0`, no active
  assignment DML, current/future blocking conflicts `0`, and protected totals
  groups `1022`, members `2426`, legacy `996`, reservations `230`. Exact commit
  `c70f5a4...` was deployed from a clean detached worktree to Ready deployment
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD` with `--prod --skip-domain`; `/`,
  `/api/health`, and its generated static asset returned `200`. At that preflight
  checkpoint all four Production aliases still pointed to containment
  `dpl_HTeRJn...`.
- Authenticated Head Coach dark-canary read-only checks confirmed that persisted
  exact coaches remain selected, count-suffix names render normalized, member
  counts come from live membership, no-coach draft groups remain unassigned,
  suggested coaches remain suggestions, mixed/wide Level is warning-only, manual
  names remain intact, and blank mixed draft naming resolves to `กลุ่มผสม`.
  Desktop and 390x844 mobile layout, Coach Attendance, Teaching Programs, Lesson
  Wallet, and the Head Coach Admin guard otherwise rendered without page or
  server error. However, the first `/admin/schedules` guard redirect produced one
  client React hydration error `#418`. A fresh Canary reproduction and the
  containment Production baseline did not reproduce it, and Canary runtime logs
  contained no error/fatal/5xx. At that intermediate checkpoint the explicit
  zero-error gate was **not passed**; the later bounded retest and Owner decision
  superseded that blocker before the separately recorded Controlled Write.
- The Owner-authorized bounded retest preserved that original observation and
  completed deterministic client checks on both environments: direct `/coach`
  `5/5`, hard reload `/coach` `5/5`, `/admin/schedules` role-guard redirect
  `10/10`, mobile 390x844 redirect `5/5`, and fresh login to `/coach` `3/3` per
  environment. All `56/56` client cycles were clean: React `#418`, hydration,
  console warning/error, page error, and redirect loop counts were `0`. Canary
  assignment semantics and desktop/mobile rendering also re-passed read-only.
  The original `#418` is therefore **Unknown / Non-reproducible**, and its shared
  React runtime stack does not attribute it to a file changed by `c70f5a4...`.
- Owner reviewed the bounded retest and accepted the distinct Containment auth
  signal as **ACCEPTED NON-BLOCKING CONTAINMENT AUTH-SESSION BASELINE**.
  Containment emitted one middleware error at
  `2026-07-18T10:06:40.831Z` (`17:06:40` Bangkok):
  `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` on `GET /`, with
  response `200`, during the authorized logout/login cycles. Canary had
  error/fatal/5xx `0/0/0`; Containment had fatal/5xx `0/0` but error `1`. This
  signal occurred only on the containment Source, did not fail login or the HTTP
  request, and is unrelated to the Forward Source assignment diff. Owner confirms
  it is not a Coach Assignment release blocker. Forward Canary read-only UAT is
  therefore **Passed**. The auth baseline remains preserved as a separate follow-up
  that is not authorized to start. The later successful corrective Controlled
  Write and exact-artifact promotion supersede the prior failed-name release gate.
- Owner/Head Coach confirmed the exact 2026-07-21 17:00-19:00 Chaeng Watthana
  payload for slot `53c3556a-6067-4ad1-813c-ca8410d17994` and performed exactly
  one Save through dark Canary `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD`. Pre-write
  target state was groups/members/legacy/reservations `0/0/0/0`; global protected
  totals were `1022/2426/996/230`; both selected coaches had zero exact conflicts
  and zero legacy warnings. The atomic Save created exactly two groups, five
  members, two legacy assignments, and two reservations; post-write totals are
  `1024/2431/998/232`. Activity log
  `7eaa3080-adc6-416a-ad8d-1b9e3e657980` records one Save by Head Coach
  `95bf2081-e9f9-4aa1-883c-7294d2b8ce33`. No orphan, reservation mismatch,
  coach conflict, console error, partial deletion, or change to target attendance,
  check-in, teaching program, payment, or wallet evidence was found.
- The first Controlled Write UAT was **Failed** because manual names were not preserved.
  Submitted UI names `ระดับสูง` and `กลาง-สูง` were stored as `กลุ่มผสม` on group
  `c56af2cf-d9da-464b-a1c6-602709eab7c1` and `ชุดพื้นฐาน` on group
  `ec77cf98-8768-4181-865d-ccad7befabc8`. Source inspection attributes this to
  `LEGACY_AUTO_GROUP_NAMES` treating both submitted labels as auto-generated;
  `resolveAssignmentGroupName()` then derives category/program names before the
  atomic RPC. The Canary UI retains the submitted draft names after refetch and
  therefore showed `มีการแก้ไขยังไม่บันทึก`. At that failed-name checkpoint,
  another Save, alias promotion, and repair were prohibited pending Owner approval.
  The slot assignment was
  atomically present, but it does not satisfy the exact approved payload, so it is
  not closed as repaired at that checkpoint. The corrective repeat below
  supersedes that checkpoint.
- Corrective Source inspection confirmed the regression came from
  `LEGACY_AUTO_GROUP_NAMES` treating legitimate non-placeholder names as generated
  names. Commit `9ef1ee30035a083426743aed3e326ad9676d65c4` now auto-names only
  blank, exact `ยังไม่จัดกลุ่ม`, or generic `กลุ่ม N` input after stripping a
  trailing `(N คน)` suffix; every other nonblank name is preserved as manual.
- Owner/Head Coach then performed exactly one repeat Save through Ready dark
  Canary `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` for the same exact payload. Immediate
  pre-write target state remained groups/members/legacy/reservations `2/5/2/2`,
  with the same coach/member mapping and persisted names `กลุ่มผสม` /
  `ชุดพื้นฐาน`. Activity log `82086719-9171-4170-8f57-7dbc5ca2ba6e` records the
  one repeat Save by Head Coach `95bf2081-e9f9-4aa1-883c-7294d2b8ce33` at
  `2026-07-18T14:48:21.129295Z`.
- Corrective Controlled Write UAT is **Passed**. Persisted group
  `66a59351-19f4-41fd-b5f3-1e989b931237` is `ระดับสูง` with Coach
  `20b2f808-e6a5-4e9f-ae95-3cc6561e0fde` and the exact original three learners;
  group `9757d065-2553-48b0-a4ba-81ceb4b50d2b` is `กลาง-สูง` with Coach
  `95bf2081-e9f9-4aa1-883c-7294d2b8ce33` and the exact original two learners.
  Legacy rows are `db2baac1-a2b7-4f56-a4ef-38834e4559e8` and
  `8457aa44-cb0e-426b-9ca1-9e848e58b85e`; both reservations match the new exact
  groups. Counts remained `2/5/2/2`; no partial deletion, conflict, physical
  orphan, field mismatch, unsaved-draft indicator, console error, 500, or check-
  constraint error was found. Attendance, check-in, teaching program, payment,
  wallet, teaching-hours, payroll, and finance fingerprints were unchanged.
- At that coach-remediation checkpoint, the exact same Canary artifact was
  promoted without rebuild. Deployment `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` was
  Ready and all four Production aliases pointed to it. Public `/`, `/api/health`,
  and generated static assets returned `200`;
  authenticated Head Coach read-only rendering shows both correct names, dynamic
  `3 + 2` member counts, assigned state, and no unsaved indicator or console error.
  Post-promotion runtime error/fatal/500/name-constraint searches returned zero.
  Current/future reservation candidates and rows initially reconciled `219/219`;
  after later live Head Coach Saves they reconcile `221/221`. Physical
  orphan and field mismatch counts are `0/0`. Thirteen historical reservations
  dated 2026-07-17 predate the repeat Save and are not stale rows from this release.
  Slot 2026-07-21 Chaeng Watthana is confirmed repaired. After promotion, Head
  Coach `5393eb51-46b1-4e15-890f-4dd139fdb78f` made three successful atomic
  Saves at `14:59:08Z`, `14:59:41Z`, and `15:00:01Z`: one ordinary 2026-07-19
  Suvarnabhumi slot and both previously damaged 2026-07-22 / 2026-07-29
  Suvarnabhumi slots. The two damaged slots each now contain one `กลุ่มผสม`, three
  learners, one exact coach, one legacy row, and one reservation, with no missing,
  mismatch, orphan, 500, or constraint error. Because their exact payloads were
  not supplied to Codex before those real-user Saves, repair correctness initially
  remained Unknown. Owner subsequently confirmed that both actual payloads are
  correct; all three confirmed damaged slots are now closed as repaired.
- Pre/post read-only Canary fingerprints were identical: groups
  `36ff11873681dd9b550d8bfe61b078d9`, members
  `ad6abedcd22ded678b45a42695cb03f8`, legacy
  `649a57dd7cc12a2928e053243bb647e3`, and reservation semantic fingerprint
  `3969e246d4ace794ca6562727fa8e80e`. No assignment activity row was created.
- Bounded-retest post-checks still found groups `1022` /
  `36ff11873681dd9b550d8bfe61b078d9`, members `2426` /
  `ad6abedcd22ded678b45a42695cb03f8`, legacy `996` /
  `649a57dd7cc12a2928e053243bb647e3`, reservations `230`, migration
  `20260717070225` exactly once, and successful assignment Saves after
  containment `0`. Reservation business fields reconciled `230/230` against
  their exact group/coach/slot/date/time source with mismatch `0`. One reservation
  `updated_at` timestamp changed during normal real-world coach check-in and three
  attendance writes for slot `ab042e90-d93c-46c5-9e2b-74e129abaf5e`; its
  business fields did not change. This was not an assignment mutation and was not
  performed by the retest.
- Authenticated Head Coach verification after containment activation shows the
  read-only assignment page still renders `36/39` assigned slots, `3` unassigned,
  and `135` learners. One Owner-authorized containment check attempted the normal
  Save and received `503` with code
  `COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED`; Vercel request logs confirm the
  response status, the Thai lock message rendered, successful assignment activity
  logs after activation remained `0`, and protected fingerprints did not change.
- Admin Schedules Performance Phase B Source/Test commit
  `3d32401b13873592d5462e6776b0e847335d2d43` was pushed non-force to
  `origin/spike/next-major-security-upgrade`. Production-target Canary
  `dpl_5x2vzwUxAmxNaT8HZGJeBQ32JVr4` contains exact commit
  `b0bada3d076302d24ebe3b594c03b22bf0997869` and remains unpromoted after its
  performance gate failed. The diagnosis documentation closeout contained the
  prior diagnosis matrix; the current remediation matrix below records the later
  scoped publish.
- The remediation Source/Test is committed at
  `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`. Remediation `24/24`, assignment
  `24/24`, wallet `17/17`, TypeScript, ESLint, mojibake, diff check, build, and
  disposable browser `5/5` with residue `0` passed. Repeat post-build `.next`
  cleanup/clean-restart smoke was explicitly waived for this exact worktree and
  is not claimed as rerun.
- Activity logs prove `51` successful `save_coach_assignment_groups` operations
  during the bad-deployment incident window, covering `47` distinct slots, six
  Head Coaches, and six branches. Submitted payload totals were `62` groups and
  `118` learner placements; four saves contained no coach. Current surviving rows
  from those slots are `55` exact groups, `97` group-member rows, `50` legacy
  assignments, and `50` derived reservations, all created during the incident
  window. The atomic RPC replaces prior slot groups/members and legacy rows, so
  deleted/replaced pre-save row IDs and their exact before-values are not present
  in `activity_logs`; these rows require Owner review and must not be repaired from
  inference. Those `47` slots are the broader incident-window Save population, not
  proof that all `47` are damaged. All three confirmed damaged slots are repaired
  and Owner-confirmed; the remaining incident-window population is report-only and
  must not be changed without separate evidence and approval. Exact
  current incident IDs remain in the dated incident record in `DEVELOPMENT_TODO.md`.
- Admin Schedules Performance Phase B is complete. The Region Experiment compared
  the existing `iad1` Control with same-business-Source `icn1` Treatment. Treatment
  passed 20/20 monthly samples at Browser P50/P95 `2.203/2.640 s`, plus selected-
  day, corrected Search, mobile, and functional read-only smoke. The permanent-
  config artifact later passed protection-aware Production smoke and authenticated
  Super Admin/Standard Admin read-only UAT.
- Permanent `"regions": ["icn1"]` repository configuration passed Local tests/build,
  is committed/pushed as `77db099607dd7ee8dfe265929a6720818e2015d1`, and is
  Production-active in `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`.
- Homepage LV remains parked and must not start until the Owner explicitly selects
  it as the next single active task.
- Next Action: **Await Owner selection; do not start another task automatically.**

### Admin Schedules — Coach Overlap Guard and Ungrouped Coach Semantics

Status: **DONE — CORRECTIVE FORWARD SOURCE PRODUCTION-ACTIVE; READ-ONLY AND
CONTROLLED WRITE UAT PASSED; WRITE CONTAINMENT REMOVED; ALL THREE CONFIRMED
DAMAGED SLOTS REPAIRED AND OWNER-CONFIRMED**
(Owner decisions 2026-07-17).

- Root cause confirmed: normal Head Coach group saves checked duplicate coaches
  only inside one submitted slot and wrote group/member/legacy rows in separate
  calls. Admin Makeup exact-assignment actions had same-slot checks in selected
  paths but no shared cross-slot interval rule. The database had no exclusion or
  reservation guard, so concurrent exact writes could race. Admin Schedules also
  treated a persisted group named `ยังไม่จัดกลุ่ม` with a valid `coach_id` as an
  exact assignment, while the Head Coach draft builder copied a suggested coach
  into a newly created ungrouped bucket.
- Shared server validation now checks active exact groups by coach, Bangkok date,
  strict interval overlap, same/different branch, same-slot multiple groups, self
  exclusion, and full-slot replacement. Exact conflicts return `409` with date,
  time, branch, group name, and group id. Legacy-only overlap returns a warning
  and does not block or delete the legacy row.
- The normal Head Coach save is now one local database RPC transaction. A derived
  exact-reservation table with a GiST exclusion constraint closes concurrent-write
  races. After a separately runnable read-only preflight proves zero current/future
  blockers, the migration backfills reservations for every current/future active
  exact group, including pre-existing placeholder-named groups; it does not repair
  names or historical rows. Triggers resynchronize reservations after group coach/
  slot changes, member insert/move/delete, slot date/time changes, booking-session
  lifecycle/slot changes, and booking lifecycle changes. The exact committed
  migration and corrective Forward Source are active in Production.
- A valid exact `coach_id` is authoritative even when an existing persisted name
  is blank, `ยังไม่จัดกลุ่ม`, or has a legacy `(N คน)` suffix. Only a group with no
  exact `coach_id` is unassigned; suggested and legacy slot coaches remain non-
  exact. A newly created ungrouped draft starts with `coachId = null`. Existing
  legacy coach display reads `ข้อมูลโค้ชเดิมของรอบ — ยังไม่ใช่ผู้รับผิดชอบกลุ่ม`.
- The currently Production-active historical Source auto-name uses each learner's
  latest `student_levels` row joined to an active
  `levels` definition and uses the confirmed `levels.program_name` when all members
  share one category/program. All-unassessed groups use the existing
  `ยังไม่ประเมิน` label. Mixed categories, mixed assessed/unassessed membership,
  or incomplete/inactive Level definitions use fallback `กลุ่มผสม`. That automatic
  Coach Save naming behavior is superseded Owner policy and is not present in the
  committed/pushed forward fix; it remains runtime evidence until a separately
  approved Deploy gate.
  Valid manual names are preserved, legacy
  `(N คน)` suffixes are removed, and both Coach/Admin UIs derive the count from the
  current member arrays.
- Production-active corrective Source exact-write coverage:
  `POST /api/coach/assignment-groups` and
  the authorized Admin Makeup actions `move_learner_to_existing_coach_group`,
  `replace_coach_for_past_round`, `assign_coach_to_round`,
  `resolve_unassigned_round`, plus retrospective `mark_attendance` when it creates
  an exact group. Existing route/menu/branch authorization remains intact.
- Corrective Local verification passed: conflict/concurrency database checks `22/22`;
  deterministic display/authorization/naming checks `33/33`; authenticated disposable
  Playwright desktop/mobile and anonymous write-route checks `3/3`; fixture and
  reservation residue `0`; TypeScript; full ESLint; mojibake guard `234`; Production
  Build 91/91 static pages; and `git diff --check`. Browser console, page, hydration,
  and layout errors were `0`. Existing counters, attendance labels, teaching
  program, and wallet display remained unchanged.
- At the earlier local-only gate, migration reset/apply, rollback of the last local
  migration, re-apply, and test passed. The exact standalone Production read-only
  preflight then reported active exact groups `968`, current/future reservation
  candidates `237`, current/future blocking conflicts `0`, and historical
  report-only conflicts `8`. At that checkpoint, Production migration history
  ended at `20260715060541`; the later migration record below supersedes that
  historical state.
- Exact controlled Production repair completed at `2026-07-17 15:23 ICT`:
  - Keep Coach Nice `4bad40cc-7367-49a2-aa81-42f35d840d79` at Ramintra exact group
    `d0b68d67-1ae3-416c-b2f2-99e9ee994449`, slot
    `98f60622-d02b-4333-9d65-8f4f7a86d8b1`, 17:00–19:00, one learner; keep legacy
    row `b31c3bce-d319-489b-b7a2-ff5382497c0c`.
  - Cleared only the Nice `coach_id` from
    Ratchada exact group `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a`, slot
    `150b25ba-b55a-448f-9aad-19748ba36b93`, 17:00–19:00, three learners, and remove
    only matching legacy row `3bcafc20-f927-4814-a586-da7819445d60`. Exact affected
    counts were group update `1` and legacy delete `1`.
  - At the controlled repair checkpoint, the three Ratchada learners remained in
    the same group and were intentionally unassigned under the policy at that
    time: ปฐพี จินตานนท์
    (`35d68dc4-ddcb-4dd4-8b6e-52af8e27f321`), ญาณพัฒน์ คูศุภรเจริญ
    (`5477519d-9447-41f5-aea1-17e3815b3ae1`), and นภิสา จินตานนท์
    (`d64ea638-d350-4d96-9793-d75309a82139`). The Ramintra learner remains
    wynn udompanit (`8563888b-b813-4b7b-a617-772da1658178`).
  - At the later naming dry-run, Ratchada placeholder group
    `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc` had exact Coach Base
    `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe` and two learners. Their LV 6 and LV 3
    both resolved to active `basic / ชุดพื้นฐาน`; no Production rename was
    performed.
- At the controlled repair closeout, transaction assertions and independent
  post-write reconciliation confirmed that group memberships, Ramintra, Coach
  Base, and the other group/member totals had not changed. Attendance, check-in, teaching
  program, teaching-hours, weekly-summary, and payout dependencies for this
  target were empty before and after that repair. Historical evidence and all
  financial data remained unchanged.
- Fresh read-only reconciliation after the publish found three normal Production
  user actions at 20:14:17, 20:14:39, and 20:14:53 ICT moving booking sessions
  `3919671b-805d-4cb4-b1cd-ee7b24267e91`,
  `e1aae95f-1698-4262-99ee-c246b42211b7`, and
  `11a55e1b-b01c-404f-89b9-c790b026b5ea` from group `924...` into Coach Base
  group `2e7...`. Activity logs `1db62d59-1ae9-4ae6-8129-1da7fdb7f0c1`,
  `51bb003e-6d0c-4867-8f23-60a60b4e80fe`, and
  `727b2194-cf2d-47d9-9ee3-7a79086e13c1` identify Production user
  `860c4d76-ca08-4252-8e18-68f9802ca60e`, not Codex, and each records
  `attendanceWritten = false`, `bookingSessionStatusChanged = false`, and
  `coachEvidenceDeleted = false`.
- Owner confirmed those three moves are correct. Coach Base group `2e7...` now
  has coach `c1a5...` and five active members at
  LV 15, 6, 6, 3, and 8; all five resolve to active
  `basic / ชุดพื้นฐาน`. Former waiting group `924...` has `coach_id = null` and
  zero raw/active members. Do not move the learners back.
- At `2026-07-17 21:23:20 ICT`, a fresh read-only preflight reconfirmed the exact
  target group, Coach Base `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe`, stored name
  `ยังไม่จัดกลุ่ม`, raw/active members `5/5`, and all five active
  `basic / ชุดพื้นฐาน` Level definitions. One conditional exact-id/coach/name
  update changed only the group name to `ชุดพื้นฐาน`; affected rows were exactly
  `1`. The five member rows and learner/session ids, Coach Base id, target-slot
  legacy row `9943df09-2e07-4cd6-9b52-112cc0fb51a0`, former group `924...`, and
  Ramintra/Nice exact and legacy rows reconciled unchanged. Attendance, check-in,
  teaching-program, teaching-hours, weekly-summary, payout, payment, and finance
  fingerprints also matched before and after.
- Authenticated read-only Admin Schedules UAT for Ratchada on 2026-07-17 passed:
  the card shows `ชุดพื้นฐาน`, Coach Base, the same five learners, and dynamic
  `ผู้เรียนในกลุ่มนี้ 5 คน`; `ยังไม่จัดกลุ่ม` locator count is `0`, and console,
  page, and hydration errors are `0`. No application mutation was triggered.
- Fresh Production migration preflight reported active exact groups `966`,
  current/future reservation candidates `235`, current/future blocking conflicts
  `0`, and historical report-only conflicts `8`. The committed migration blob
  SHA-256 was
  `2124C57725AA8891BD456927C37530F180019B8C0710EE73E6E9717174926EF8`; the
  pending remote set contained only `20260717070225`.
- Migration `20260717070225_coach_assignment_conflict_guards.sql` applied
  successfully exactly once. Remote history now ends at `20260717070225`, and a
  second dry-run reports no pending migration. Reservation backfill reconciles
  `235/235`, with missing `0`, stale/orphan `0`, field mismatch `0`, and
  current/future conflict `0`.
- Production schema verification found the reservation table, GiST exclusion
  constraint, five enabled synchronization triggers, twelve expected functions,
  fixed `search_path = public`, and committed service-role grants. RLS is enabled
  with no anon/auth table DML grant. Supabase advisors report the intentional
  no-policy RLS table as informational and `btree_gist` in `public` as a warning;
  neither changed the approved migration or required an ad-hoc repair.
- Before/after fingerprints matched for groups, group members, legacy assignments,
  attendance, booking sessions, bookings, coach check-ins, teaching hours, weekly
  summaries, payouts, teaching programs, payments, wallet credits, and finance
  expenses. Coach Base remains `ชุดพื้นฐาน` with `5/5`; former group `924...`
  remains empty/unassigned; Ramintra/Nice exact and legacy rows remain unchanged.
  Production business and financial data did not change.
- At the migration-only checkpoint, read-only runtime checks passed: `/` `200`,
  `/api/health` `200`, static asset
  `200`, unauthenticated Admin Schedules guard `307` to login, and authenticated
  Admin Schedules rendering with Coach Base, `ชุดพื้นฐาน`, five learners, and no
  new console/page/hydration error. Production deployment at that checkpoint was
  `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`; no deploy or application write UAT occurred
  in that migration-only round.
- Exact-source deployment used a clean detached worktree at commit
  `1b995396f432d11b133c1cf4b5604b6db875b63b`, tree
  `24504017e59e597fc66d8d467186249290981bb6`. Vercel Production Build completed
  TypeScript and `91/91` static pages. Deployment
  `dpl_Ga9NvYaYCcNG4BzVdqeCt3pBbQ4F` reached Ready and was promoted; at that
  deployment checkpoint, all four established Production aliases resolved to it.
- At that deployment checkpoint, infrastructure-only checks passed on both public
  Production aliases: `/` `200`,
  `/api/health` `200` with `status = ok`, and generated
  `/_next/static/css/4e4fe59c9141653c.css` `200` as CSS. Migration
  `20260717070225` was applied once and derived reservations were `235`.
  No authenticated page was opened, no Save or mutation request was sent, and no
  environment, feature-control, allowlist, database, business-data, or financial
  change occurred in this deployment round.
- A first non-interactive Vercel pull in the randomly named worktree created an
  unintended empty Vercel project named after the temp directory. It contained no
  deployment and was immediately deleted; read-only follow-up confirms it no
  longer exists. The worktree was then explicitly linked to project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`. Local prebuilt build was abandoned after the
  Windows CLI returned `spawn cmd.exe ENOENT`; no deployment resulted from that
  attempt. The successful deployment used Vercel's remote Production build. The
  temporary detached worktree and its downloaded environment files were removed
  after verification.

#### Historical Coach Assignment Remediation Matrix (state observed at its prior closeout)

| Field | Value observed at that closeout |
| --- | --- |
| Active Task | NONE |
| Task Status | Done — corrective Forward Source Production-active; Canary read-only and Controlled Write UAT passed; exact artifact promoted; write containment removed; all 3 confirmed damaged slots repaired and Owner-confirmed |
| Branch | `spike/next-major-security-upgrade` |
| Local HEAD | Documentation closeout commit containing this matrix; corrective Source is separately committed at `9ef1ee30035a083426743aed3e326ad9676d65c4` |
| Remote HEAD | Same documentation closeout after non-force push; corrective Source branch also pushed non-force |
| Ahead/Behind | `0/0` after publish verification |
| Source Complete | Yes — corrective Forward Source `9ef1ee30035a083426743aed3e326ad9676d65c4`, tree `94fe2410f0361acf639c47a4be7245c01128f21d`, on forward parent `c70f5a4...` |
| Tests Passed | Yes — naming/assignment/authorization `33/33`; DB conflict/concurrency/lifecycle `22/22`; Playwright `3/3`; Lesson Wallet `17/17`; TypeScript, ESLint, mojibake, diff check, build, clean restart; corrective Controlled Write and post-promotion gates passed |
| Committed | Yes — containment Source `3ad8a52...`; forward Source `c70f5a4...`; corrective Source `9ef1ee30035a083426743aed3e326ad9676d65c4`; documentation closeout is the commit containing this matrix |
| Pushed | Yes — containment, forward, corrective Source, and documentation scoped commits, non-force |
| Current Source | Production: corrective Forward Source `9ef1ee30035a083426743aed3e326ad9676d65c4` on parent `c70f5a4...` |
| Deployed | Yes — exact corrective Canary artifact promoted without rebuild |
| Deployed Source | `9ef1ee30035a083426743aed3e326ad9676d65c4` |
| Deployment ID | At the coach-remediation checkpoint, aliases `4/4` used `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`. Current global Production is `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`; authoritative current deployment detail is in the Admin Schedules Performance matrix |
| Migration Source | `20260717070225_coach_assignment_conflict_guards.sql`; SHA-256 `2124C57725AA8891BD456927C37530F180019B8C0710EE73E6E9717174926EF8`; standalone preflight is read-only |
| Migration Applied | Yes — Production applied exactly once; not rolled back; current reservations `234` after controlled and later live atomic Saves |
| Feature Enabled | Not applicable; no feature flag changed |
| Allowlisted | Not applicable; no allowlist changed |
| Production Active | Corrective Forward Source and database reservation protection: Yes. Emergency write containment: No after exact-artifact promotion |
| Production UAT | Passed — bounded read-only Canary plus authenticated post-promotion rendering. Original hydration `#418`: Unknown / Non-reproducible after `56/56` clean cycles. Containment auth baseline remains accepted non-blocking |
| Controlled Write UAT | Passed — one corrective Owner/Head Coach Save on slot `53c3556a...` persisted `ระดับสูง` / `กลาง-สูง`, retained exact `2/5/2/2` mapping, and left no partial state or unsaved indicator |
| Data Repaired | Yes — 2026-07-21 Chaeng Watthana plus 2026-07-22 and 2026-07-29 Suvarnabhumi are reconciled and Owner-confirmed |
| Production Data Changed | Yes — by Owner/Head Coach controlled and live Saves only. Corrective Save atomically replaced target `2/5/2/2`; three later live Saves were recorded. Fresh totals `1026/2436/1000/234`; current/future reservation reconciliation `221/221`, missing/orphan/mismatch `0/0/0` |
| Customer Impact | Resolved for the confirmed incident scope — assignment writes are enabled, live atomic Saves are succeeding, and all 3 confirmed damaged slots are correct |
| Financial Impact | None — no attendance/check-in/teaching-hours/payroll/payment/wallet/finance write occurred |
| Blocker | None for this task |
| Remaining Work | None for the confirmed task scope. Auth follow-up, broader historical incident review/cleanup, and permanent dirty `AGENTS.md` work remain separate and unauthorized |
| Task Done | Yes |
| Next Gate / Next Action | Await Owner selection; do not start another task automatically |
| Parking Lot authorization state | No Parking Lot task is authorized automatically |

### Admin Schedules — Exact Coach Assignment Classification

Status: **DONE — EXACT SOURCE DEPLOYED; AUTHENTICATED READ-ONLY PRODUCTION UAT
PASSED** (Owner decisions 2026-07-17).

- Confirmed root cause: `src/app/(admin)/admin/schedules/page.tsx` added every
  exact group member to `assignedSessionIds` without validating the group's
  `coach_id` or resolved coach profile. `src/components/admin/schedules-client.tsx`
  then treated every non-empty group as coached, counted all of its active learners
  in `มีโค้ชแล้ว`, and rendered the group with green assignment styling. Grouped
  therefore incorrectly meant Assigned.
- Read-only Production snapshot for 2026-07-17 currently has no invalid grouped
  learner: all visible exact memberships resolve to a `coach` or `head_coach`
  profile. No data was changed. The supplied screenshot cannot be uniquely mapped
  to a currently invalid 2026-07-17 row after later assignment saves, so that exact
  historical row remains `Unknown / Need verification`.
- The exact Production reproduction is 2026-07-16, Rama 2 Kids Group,
  17:00–19:00, slot `b2c6ec1a-2136-48c5-b0ba-4141d5923d94`. Group
  `476fb938-af93-4689-82cb-377acd108d0d` (`พื้นฐาน / เริ่มต้น (3 คน)`) has five
  active exact learner memberships but `coach_id = null` and no coach profile.
  Two same-slot legacy coaches belong to other valid groups and are not exact
  evidence for these five learners. Before this deployment Production classified
  the round as `12 coached / 0 waiting / 2 walleted`; deployed Production now
  correctly reports `7 coached / 5 waiting / 2 walleted`.
- The narrow fix adds `hasExactValidCoachAssignment` and one shared round bucketer.
  Assigned now requires exact group membership plus matching resolved profile id,
  non-empty coach name, and role `coach|head_coach`. Invalid groups stay visible as
  learner groups but use a red border and `ยังไม่ได้มอบหมายโค้ช`; their active
  learners count in `รอจัดโค้ช`. Walleted learners remain separate and excluded.
  Legacy slot assignments are not inputs to the predicate.
- Valid assigned groups retain their green styling, coach label, attendance labels,
  learner LV display, and teaching-program box. No assignment workflow, query
  waterfall/performance work, attendance, check-in, payroll, Booking, Payment,
  Pricing, Wallet, Makeup, API mutation, schema, migration, or Production data
  changed.
- Local verification passed: deterministic assignment-state checks `12/12`;
  disposable authenticated Playwright desktop/mobile regression `1/1` with
  database residue `0`; TypeScript; targeted ESLint; full ESLint; mojibake guard
  `231` files; and `git diff --check`. The browser fixture verified valid green,
  invalid red, standalone waiting, wallet exclusion,
  `1 coached / 2 waiting / 1 walleted`, teaching-program box preservation, 390px
  warning containment, and zero console/page/hydration errors.
- Production Build passed with 91/91 static pages. Per the post-build protocol,
  the repo-local `.next` directory was verified and removed, a clean dev server
  restarted on `127.0.0.1:3000`, root and a generated static asset returned `200`,
  and `/admin/schedules` returned the expected `307` login redirect without a
  server error.
- Functional commit `0226e363f6677b078430f93459c2ee2ede6484e8` contains exactly
  the seven approved Source/Test files and is pushed. It was deployed from a clean
  detached worktree to Ready deployment `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`;
  root, health, static asset, auth guard, and four-alias convergence checks passed.
- Authenticated read-only Production UAT verified the exact invalid group in red,
  five active learners in `รอจัดโค้ช`, two walleted learners excluded, and both
  exact valid groups in green. Learner LV, attendance labels, and teaching-program
  boxes remained visible. Desktop and mobile 390x844 layouts passed; the red
  warning stayed inside its card with no horizontal overflow. Browser console,
  hydration, and page errors were `0`.
- Runtime monitoring for the UAT window found errors/5xx `0`; no assignment,
  attendance, or check-in mutation occurred. Two unrelated user reschedule POSTs
  were visible in the shared Production logs and were not attributable to this
  Admin Schedules UAT. No migration, environment/feature-control/allowlist change,
  auto-assignment, Production business-data write, data repair, or financial
  effect occurred for this task. Rollback was not used.

#### Historical Admin Schedules Assignment State Matrix (state observed at the prior release closeout)

| Field | Current value |
| --- | --- |
| Active Task | NONE |
| Task Status | Done — exact Source deployed; authenticated read-only Production UAT passed |
| Branch | `spike/next-major-security-upgrade` |
| Local HEAD | Documentation correction branch tip; functional Source is `0226e363f6677b078430f93459c2ee2ede6484e8` |
| Remote HEAD | Matching pushed documentation correction branch tip; exact SHA verified in final Git closeout |
| Ahead/Behind | `0/0` after final documentation push |
| Source Complete | Yes — functional Source pushed |
| Tests Passed | Yes — deterministic 12, disposable browser E2E 1 with residue 0, TypeScript, targeted/full ESLint, mojibake 231, diff check, and authenticated read-only Production UAT |
| Build Passed | Yes — local and exact Vercel Production builds passed with 91/91 static pages; root/health/static/auth checks passed |
| Committed | Yes — functional Source `0226e363f6677b078430f93459c2ee2ede6484e8` |
| Pushed | Yes — functional Source, release closeout, and documentation correction |
| Current Source | `0226e363f6677b078430f93459c2ee2ede6484e8` |
| Deployed | Yes — exact functional Source |
| Deployed Source | `0226e363f6677b078430f93459c2ee2ede6484e8` |
| Deployment ID | `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8` — Ready on all four established Production aliases |
| Migration Source | None; not required and prohibited |
| Migration Applied | No; not required |
| Feature Enabled | Not applicable; no feature control added or changed |
| Allowlisted | Not applicable; no allowlist added or changed |
| Production Active | Yes — exact valid groups remain green and grouped learners without an exact valid coach are red/waiting |
| Production UAT | Passed — authenticated read-only exact reproduction plus valid-group regression, desktop/mobile, console/hydration, and runtime gates |
| Controlled Write UAT | Not required/not run |
| Data Repaired | No |
| Production Data Changed | No — no business-data write attributable to deployment/UAT; unrelated normal user reschedule traffic was observed separately |
| Customer Impact | Admin/Head Coach classification is corrected in Production; unassigned grouped learners are visible as waiting instead of green/assigned |
| Financial Impact | None |
| Task Done | Yes |
| Blocker | None |
| Remaining Work | None for this task |
| Next Gate / Next Action | Await Owner selection; do not start a Parking Lot task automatically |
| Parking Lot authorization state | Admin Schedules Performance and Homepage LV remain not authorized |

### Admin Teaching Programs — Default Today + Date/Time/Branch Ordering

Status: **DONE — EXACT SOURCE DEPLOYED; READ-ONLY PRODUCTION UAT PASSED**
(Owner decisions 2026-07-15).

- Root cause: `/admin/teaching-programs` initialized both date inputs to blank,
  so its client-only date filter admitted every loaded row. The server query loaded
  at most 800 programs ordered by `teaching_programs.created_at DESC`; the client
  filtered that inherited order and sliced pagination without a date/slot-time/
  branch sort contract.
- Existing one-sided date behavior remains intact: start-only means `date >= start`,
  end-only means `date <= end`, and both blank means no date filter. The normal
  initial render now receives one server-computed `Asia/Bangkok` calendar date and
  initializes both start and end to that value. No UTC date slicing is used. The
  existing page has no URL date-query contract, so no user-selected URL state was
  removed or reset.
- `schedule_slots.start_time` is parsed as a real `HH:mm[:ss]` time value for sort;
  displayed time text is not used. The complete filtered set is sorted before the
  unchanged 18-item pagination slice: `date ASC -> start_time ASC -> branch slug
  chaengwattana first at the same time -> Thai branch name ASC -> branch slug ->
  schedule_slot_id -> teaching_program.id`.
- `branches` has no `sort_order`. `/admin/schedules` uses branch name as its stable
  branch order after date/time; Teaching Programs retains that fallback while using
  the unique persisted slug `chaengwattana` to identify แจ้งวัฒนะ reliably. No
  `/admin/schedules` source changed.
- Search and the existing status, coach, branch, course type, and one-/two-sided
  date filters remain client-side and unchanged apart from deterministic ordering.
  Review API, approval/return actions, permissions, detail panel, page size, schema,
  and database data are unchanged.
- Functional Source commit
  `039ad6e03ca0cb8c8c4334c81818c570b03b9287` contains exactly the three scoped
  Source files and is pushed to `origin/spike/next-major-security-upgrade`.
- Verification on the committed Source passed: deterministic ordering fixtures
  with 9 contract rows and 40 pagination rows at page size 18; 2 Bangkok UTC-
  boundary cases; `npx tsc --noEmit`; full `npm run lint`;
  `npm run check:mojibake` (230 files); `npm run build` with 91/91 static pages;
  and `git diff --check`. After the build, the old Next dev server was stopped,
  the verified repo-local `.next` was removed, and a clean dev server restarted at
  `127.0.0.1:3000`. Root and a generated static asset returned `200`; the Admin
  route returned the expected `307` login redirect; dev stderr and browser console
  errors/warnings were `0`.
- Exact-source deployment used a clean detached worktree pinned to functional
  Source `039ad6e03ca0cb8c8c4334c81818c570b03b9287`, tree
  `1d716a275505ffbc688487f0f245920c31a5619b`. The Vercel Production build passed
  91/91 static pages and produced Ready deployment
  `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr`. At that 2026-07-15 release closeout, all
  four Production aliases resolved to that artifact; public root, `/api/health`,
  and generated static JavaScript returned
  `200`. The two protected project aliases retained their existing Vercel SSO
  behavior while their deployment mapping converged correctly.
- Authenticated Super Admin read-only Production UAT passed. Fresh/reloaded entry
  set both date fields to Bangkok `2026-07-15` and showed only the five rows for
  that date. A `2026-07-14` single-day selection showed seven rows for that day;
  the `2026-07-14` through `2026-07-15` range showed twelve rows ordered by date
  then start time. At both `15:00` and `17:00` on July 14, แจ้งวัฒนะ preceded other
  branches at the same time. Start-only, end-only, both-clear, search, status,
  coach, branch, and course-type filters passed.
- Pagination was exercised with 362 visible rows: page 1 ended at June 6 `09:00`
  and page 2 began at `10:00`, with 18 rows on each page and zero overlapping row
  labels. Selecting the June 6 `10:00` Ratchaphruek-Taling Chan row opened the
  matching coach/date/branch detail, while the existing Approve/Return buttons
  remained present and were not clicked. Two fresh reloads produced identical
  five-row today ordering.
- Browser console warnings/errors, hydration errors, and React #418 were `0`.
  Deployment runtime logs contained only GET requests during UAT; focused queries
  found zero POST/PUT/PATCH/DELETE and zero 4xx/5xx. No migration, environment,
  feature-control, allowlist, schema, Review action, Production business-data
  write, or data repair occurred. Customer impact is the corrected Admin display
  behavior; financial impact is none.

#### Historical Admin Teaching Programs State Matrix (state observed 2026-07-15)

| Field | Value at that closeout |
| --- | --- |
| Active Task | NONE at that closeout |
| Task Status | DONE — Exact Source deployed; read-only Production UAT passed |
| Branch | `spike/next-major-security-upgrade` |
| Local HEAD | Documentation consistency correction commit containing this matrix; functional Source is `039ad6e03ca0cb8c8c4334c81818c570b03b9287` |
| Remote HEAD | Matching pushed documentation consistency correction commit; exact SHA verified in final Git closeout |
| Ahead/Behind | `0/0` after final documentation push |
| Source Complete | Yes |
| Tests Passed | Yes — ordering 9, pagination 40, Bangkok boundary 2, TypeScript, ESLint, mojibake 230, diff check |
| Build Passed | Yes — 91/91 static pages; clean dev restart/root/static/auth-redirect/runtime checks passed |
| Committed | Yes — functional Source `039ad6e03ca0cb8c8c4334c81818c570b03b9287` |
| Pushed | Yes — functional Source and documentation closeout |
| Current Source | `039ad6e03ca0cb8c8c4334c81818c570b03b9287` |
| Deployed | Yes |
| Deployed Source | `039ad6e03ca0cb8c8c4334c81818c570b03b9287` |
| Deployment ID | `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr` — Ready on all four Production aliases |
| Migration Source | None; not required and prohibited this round |
| Migration Applied | No; not required |
| Feature Enabled | Not applicable; no feature control added or changed |
| Allowlisted | Not applicable; no allowlist added or changed |
| Production Active | Yes — corrected default-date and ordering behavior is active on all four aliases |
| Production UAT | Passed — authenticated read-only UAT |
| Controlled Write UAT | Not required/not run |
| Data Repaired | No |
| Production Data Changed | No |
| Customer Impact | Admin display behavior corrected; no customer data changed |
| Financial Impact | None |
| Task Done | Yes |
| Blocker | None |
| Remaining Work | None for this task |
| Next Gate / Next Action | At that closeout: await Owner selection; do not start a Parking Lot task automatically |
| Parking Lot authorization state | Admin Schedules Performance and Homepage LV remain not authorized |

### Production Lesson Wallet Canonical Redemption Regression

Status: **DONE — SOURCE DEPLOYED; NO-WRITE AND OWNER-VERIFIED CONTROLLED WRITE
PRODUCTION UAT PASSED** (Owner decision 2026-07-15).

- Gate 0 verified branch `spike/next-major-security-upgrade`; starting local and
  remote HEAD were both `9a678b9224ea3941db0727071d2337aaf714fcd1`, ahead/
  behind `0/0`. The pre-existing unrelated `AGENTS.md` and `docs/performance/`
  changes remain excluded. Prior Production deployment
  `dpl_DX9gCUMG4XeWtT27cFHXJgKwbAkm` was Ready on all four aliases and still served
  functional Source `4ab6a69e23de6f7989b51dfaf624ff631dde420f` at this gate.
- Read-only incident evidence found exactly one Production
  `POST /api/lesson-wallet` `400` at `2026-07-15T11:20:10.294Z`, matching the
  supplied Thai recurring-round mismatch error. Production request logs did not
  retain the POST body, so the exact historical `scheduleTemplateId` is
  `Unknown / Need verification`; current client construction would send the
  selected template hint. One click produced one request.
- The exact visible incident target is **Ramintra** (`ram-intra`), Private, Sunday
  2026-07-19, 17:00-18:00. The active canonical template is
  `508d96b1-c160-4127-87e1-353577ec4990`; a matching pre-existing open dated slot
  `fa0f0797-023d-44c1-a137-b2b253fb7539` links to it. A separate valid Rama 2
  template also exists, but the supplied visible-branch evidence and exact credit
  scope identify Ramintra; no cross-branch template mix was proved.
- The two sanitized candidate credits originated from Private Saturday 2026-07-25
  16:00-17:00. Both were active at the failed incident and were later consumed by
  the real user in two successful redemptions at `11:27:56Z` and `11:28:10Z` to a
  different Ramintra target. They are real-customer entitlements and are not safe
  controlled-write UAT data.
- Incident-window read-only checks found zero changes to the candidate credits,
  booking sessions, target slot, assignments, notifications, activity logs,
  payments, coupon usages, payment Ledger, or Finance. The API failed before
  canonical slot resolution or any business mutation.
- Exact root cause: the API built `2026-07-19T00:00:00+07:00` but called host-local
  `Date#getDay()`. On Vercel's UTC runtime that timestamp is Saturday
  `2026-07-18T17:00:00Z`, producing weekday `6`; both the supplied-ID lookup and
  canonical fallback therefore filtered Saturday and missed the valid Sunday
  template. The earlier stale-ID fallback and no-`kids_group`-default fixes were
  still present and were not the regression.
- Functional Source commit `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`, tree
  `c29de52987297e316d046faabcaee630878525dd`, is committed and pushed to
  `origin/spike/next-major-security-upgrade`. It derives weekday from validated
  Bangkok calendar components, normalizes plain and timezone-bearing times,
  treats `scheduleTemplateId` only as a hint, falls back by authoritative credit
  course + branch + Bangkok weekday + exact normalized interval, verifies the real
  dated slot against canonical evidence, keeps learner overlap before slot
  creation, returns typed Thai course/template/conflict/stale-credit errors, and
  reconciles informational occupancy after concurrent CAS cleanup.
- No migration Source changed and no migration is required. Pricing, payments,
  coupons, Ledger, Finance, payroll, attendance, SlipOK, Reschedule, Makeup,
  capacity policy, and customer data are unchanged.
- Verification passed on the exact functional tree: 17 deterministic Wallet
  checks; extended `npm run uat:lesson-wallet` against disposable local data; all
  10 serial rendered booking regressions with auth/database residue `0`; exact
  Ramintra Private Sunday UI selection; correct/stale/cross-branch/cross-course
  template hints; time normalization; inactive/cancelled/past/month guards;
  exact and overlapping learner conflicts; historical-capacity entry; one-winner
  double redemption; canonical slot persistence; no target assignment; unchanged
  Payment/coupon/Ledger/Finance counts; TypeScript; ESLint; mojibake; production
  build; `git diff --check`; and post-build root/health/static responses `200`.
- The fix was deployed from a clean detached worktree pinned to functional commit
  `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`, tree
  `c29de52987297e316d046faabcaee630878525dd`. Deployment
  `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` reached Ready. All four Production aliases
  resolve to that artifact; root, `/api/health`, and generated static asset checks
  returned `200`. No migration, environment, feature-control, allowlist, or
  SlipOK change occurred, and post-release logs contained no 5xx.
- Protected pre-deploy and post-no-write-UAT state matched: two candidate credits
  and their two redeemed target sessions, one active canonical template, one open
  dated target slot, one related payment, zero coupon usage, zero Progressive
  batch members/allocations, and one protected Finance row retained their captured
  fingerprints. The release and no-write UAT produced no business-data write.
- Authenticated Production no-write UAT displayed and selected Ramintra / Private /
  Sunday 2026-07-19 / 17:00-18:00 from the canonical active template. The selected
  evidence matched branch/date/time, the confirm action became enabled, no
  capacity/full block appeared, and console/hydration/network-preflight errors were
  absent. The dialog was cancelled without confirmation. Deployment logs show
  only `GET /dashboard/lesson-wallet` `200` for this UAT and no redemption POST.
- The later Owner-controlled Production action is distinguishable without personal
  data. Deployment logs contain two `POST /api/lesson-wallet` responses with `200`:
  `13:29:23Z` and `13:30:14Z`. Database activity evidence identifies exactly one
  `redeem_lesson_wallet_credit` at `13:29:31Z`, followed by a distinct
  `store_lesson_wallet_credit` at `13:30:19Z` for the same sanitized account. The
  second action is not a second redemption; it is the Owner subsequently storing
  the newly redeemed target back into the Wallet. Codex did not replay either
  action.
- The redemption changed exactly one active credit to `redeemed` and created
  exactly one target booking session. The session/credit booking relationship is
  intact and the target links to the real canonical open slot and active recurring
  template for Ramintra / Private / Sunday 2026-07-19 / 17:00-18:00. The current
  target-session status is `walleted` only because of the Owner's immediately
  subsequent store action; the resulting active credit points back to that session
  with complete booking/user/course evidence.
- No active exact duplicate or overlapping learner round was created. One matching
  walleted session pre-existed since 2026-07-05, remains non-active under the Wallet
  contract, and has its own active credit; it was not created by this UAT. Target
  orphan count, target assignment-student rows, and active overlapping-session
  count are all `0`.
- The combined action window created `0` related Payment rows, coupon usages,
  payment-Ledger allocations, Progressive allocations, Progressive batch members,
  Finance expenses, or Bookings. No financial effect, partial residue, or repair
  was found. Production business data changed only through the Owner's normal
  successful redemption and subsequent Wallet-store actions.
- This reconciles the prior **DOCUMENTATION DRIFT**. Classification:
  **PASS — LESSON WALLET PRODUCTION REDEMPTION OWNER-VERIFIED; TASK DONE**.

#### Historical Lesson Wallet Final Closeout Matrix (state observed 2026-07-15)

| Field | Value at that closeout |
| --- | --- |
| Active Task | NONE |
| Task Status | Done; Source deployed; no-write and Owner-verified controlled-write Production UAT passed |
| Branch | `spike/next-major-security-upgrade` |
| Local HEAD | `spike/next-major-security-upgrade` documentation-closeout branch tip |
| Remote HEAD | Same documentation-closeout branch tip after push |
| Ahead/Behind | `0/0` |
| Source Complete | Yes |
| Tests Passed | Yes |
| Committed | Yes |
| Pushed | Yes |
| Current Source | `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae` |
| Deployed | Yes |
| Deployed Source | `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae` |
| Deployment ID | `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` |
| Migration Source | None |
| Migration Applied | Not required |
| Feature Enabled | Existing controls unchanged |
| Allowlisted | No; existing allowlist remains absent |
| Production Active | Yes on all four aliases |
| Production UAT | No-write UAT passed |
| Controlled Write UAT | Passed — Owner verified; read-only evidence reconciled one redemption |
| Data Repaired | No |
| Production Data Changed | Yes — Owner's normal redemption and subsequent Wallet store only; no Codex write or repair |
| Customer Impact | Regression resolved; Lesson Wallet redemption works normally |
| Financial Impact | None; related Payment/coupon/Ledger/allocation/Finance creation was `0` |
| Task Done | Yes |
| Blocker | None |
| Remaining Work | None for this task |
| Next Gate / Next Action | Await Owner selection; do not start a Parking Lot task automatically |
| Parking Lot authorization state | Admin Schedules Performance and Homepage LV remain not authorized |

### Dashboard Booking Unlimited Slot Entry + Customer Price UX

Status: **DONE — REMOTE MIGRATION APPLIED; EXACT SOURCE DEPLOYED;
NO-WRITE PRODUCTION UAT PASSED**
(Owner decision 2026-07-15).

- Owner permanently removed the fixed learner-capacity ceiling from normal teaching
  rounds. Occupancy may remain informational, but `max_students`,
  `current_students`, a derived `full` state, or counts such as `x/6` must not block
  or discourage valid slot entry. The Head Coach groups learners and assigns coaches
  after booking.
- The rule applies consistently to five entry paths: new User booking,
  pending-payment booking edit, User reschedule, Lesson Wallet redemption, and
  Admin/User makeup or replacement-date target selection. Admin booking on behalf
  of users remains disabled.
- Existing safety contracts remain mandatory: exact-learner duplicate and overlapping
  time prevention, ownership/role authorization, active template and real slot
  resolution, future/not-started checks, same-month wallet/reschedule rules,
  payment/status requirements, idempotency/concurrency/atomicity, Option A pricing
  revision/baseline checks, coupon, Ledger, Finance, attendance, and coach evidence.
- Booking learner headings must use `{nickname} - {fullName}` when a distinct,
  nonblank nickname exists, otherwise `{fullName}` once. Do not invent a nickname,
  duplicate equal names, or render a blank separator. This applies to children,
  self/adult learners, and multi-child selections.
- Customer pricing copy must not require the terms Progressive, Legacy, baseline,
  scope, revision, ordered pricing, or true-up. The selected authoritative
  `pricing_tiers` range and price must be explained in plain Thai, including bounded,
  one-session, and open-ended tiers. The client must not hardcode Production tier
  values or infer the selected tier independently from fallback tables.
- Pricing policy is unchanged: no tier/formula/history reprice; Progressive Kids
  Group remains booking-level Option A; historical payments remain attached to
  earlier bookings and are not deducted from a new Progressive booking; Adult Group,
  Private, coupon, payment, Ledger, and Finance semantics remain unchanged.
- Committed and pushed Source now removes capacity as a booking decision across User
  create/pending edit, Reschedule, Lesson Wallet, and Admin Makeup target entry.
  Occupancy remains informational; cancelled/lifecycle, future, active-template,
  canonical-slot, ownership, status/payment, same-month, and learner-overlap guards
  remain enforced. Admin booking remains disabled.
- Booking now uses one shared learner display formatter and renders the exact tier
  selected by the server from authoritative `pricing_tiers`. Steps 4-5 use plain
  Thai customer copy, preserve Option A's no-deduction meaning, retain coupon/final
  totals and zero-charge behavior, and avoid Progressive/Legacy as required customer
  terminology.
- New additive migration Source
  `20260715060541_unlimited_normal_slot_entry.sql` replaces only the effective
  Progressive slot lock/refresh helpers and capability contract. It removes the
  occupancy ceiling, keeps row/advisory locking and learner-overlap protection,
  makes `current_students` informational, preserves cancelled slots, and exposes
  capability version `2` with
  `slotEntryPolicy=unlimited_learner_v1`. It has no table-data rewrite, tier change,
  reprice, or historical backfill. It passed disposable local Supabase verification
  before release and is now applied exactly once to the linked Production database.
- Source commit is `4ab6a69e23de6f7989b51dfaf624ff631dde420f`, tree
  `397618a391f968ec1135084978ce3589a43f1d89`, on
  `origin/spike/next-major-security-upgrade`. The commit contains the approved
  functional Source, Tests, exactly one new additive migration, and only the exact
  permanent unlimited-capacity hunk from `AGENTS.md`. The unrelated `AGENTS.md`
  remainder and `docs/performance/` remain excluded.
- Local verification passed: full migration-chain reset; runtime `6+1`, `20+1`,
  pending edit, duplicate/overlap, cancelled-slot, Option A rollback and concurrency
  fixtures; 265 deterministic checks; 9 rendered Booking E2E cases with residue
  `0`; TypeScript, ESLint, mojibake, and production build. The post-build test server
  restarted from a clean `.next` and served the app/static assets during E2E.
- Owner approved and the coordinated Production release completed on 2026-07-15.
  Remote migration `20260715060541` is applied exactly once. The effective lock,
  refresh, and capability hashes are respectively
  `40dd9123d4d7f2fecd06011fe0c27958`,
  `1849aee5282c7f0e4af3a5a6281ceed4`, and
  `7dbea01c93c1e29ee987d2ebd6a018d2`; capability returns `ready=true`, version `2`,
  `slotEntryPolicy=unlimited_learner_v1`, and
  `legacyBaselineContract=immutable_scope_v1`. Fixed search path and execute grants
  remain limited to `postgres` and `service_role`.
- Exact clean Source `4ab6a69e23de6f7989b51dfaf624ff631dde420f`, tree
  `397618a391f968ec1135084978ce3589a43f1d89`, is deployed as Production deployment
  `dpl_DX9gCUMG4XeWtT27cFHXJgKwbAkm`. It reached Ready about four minutes after the
  migration verification gate, inside the approved 15-minute bridge, and all four
  Production aliases point to it.
- Authenticated no-write Production UAT passed with an existing Owner-controlled
  User session. A real future Kids Group slot with aggregate active occupancy `15`
  remained enabled/selectable without `x/6`, remaining-seat, full, or capacity
  copy. The booking was not confirmed. The restored `4+1` draft showed range
  `2–6`, rate `625`, gross `625`; a no-write `4+4` selection showed range `7–10`,
  rate `500`, gross `2,000`. Steps 4-5 matched, used plain Thai explanation, kept
  prior payments attached to prior bookings, and exposed none of the prohibited
  internal pricing terms.
- Available learner-name UAT passed for distinct child nickname/full name and
  self/adult full name. The account had no existing no-nickname, equal-name, or
  multi-child case, so those cases rely on the already-passed rendered Local E2E
  evidence as approved. Adult Group remained `1` session / `600`, and Private
  self-attend remained `1` hour / `900`. No existing safe coupon or zero-price
  Production case was manufactured.
- Browser console errors, hydration errors, and Next error overlays were `0`.
  Deployment monitoring from `09:16:23Z` through `09:33:15Z` sampled `52` events:
  error-level `0`, 5xx `0`, unexpected Booking `409/500/503` `0`, capacity error
  `0`, capability/dependency/pricing-guard fault `0`, SlipOK activity `0`, and
  business mutation requests `0`. Availability/preview requests used only the
  approved read-only UAT contract and returned `200`.
- Gate 1 and immediate post-migration protected evidence matched. Final counts
  remained unchanged for every protected business/financial set except six
  unrelated `reminder` notifications: four to two Head Coach recipients and two
  to one Coach recipient between `09:21:01Z` and `09:46:49Z`; those were not
  emitted by Booking preview/UAT.
  Bookings, sessions, scopes, snapshots, receipts, coupons, payments, batches,
  attempts, allocations, Ledger, wallet, attendance, tiers, and Finance counts
  remained at the Gate 1 values. Release/UAT-attributable business-data and
  financial delta are `0`.
- Production Entry and four dependencies remain `true`; allowlist remains absent;
  shared `SLIPOK_TEST_MODE=true` remains unchanged. No environment, tier, formula,
  historical booking, payment, coupon, Ledger, Finance, wallet, attendance, or
  business-data repair was performed. Controlled write UAT was not run and was not
  required or authorized. Rollback was not used; any future rollback or forward fix
  remains a separate Owner decision.

### Legacy Runtime

- Legacy Kids Group pricing remains a different monthly true-up formula in
  `src/lib/pricing.ts` and `src/lib/booking-pricing.ts`:
  - count only settled `paid` and `verified` bookings for existing history;
  - `cumulativeAfter = existingSettledSessions + newSessions`;
  - `targetMonthlyTotal = cumulativeAfter * rateOf(cumulativeAfter)`;
  - `charge = max(0, targetMonthlyTotal - existingSettledTotal)`;
  - an overpaid result becomes `creditDifference`; it is not the Progressive formula.
- With the fallback tier examples used by deterministic tests:
  - Legacy `5+5` = `3,125 + 1,875 = 5,000`;
  - Legacy ten settled one-session bookings total `5,000` after true-up/credit effects;
  - Legacy `8+8` = `4,000 + 2,496 = 6,496`.
- DB `pricing_tiers` remains price authority; the figures above are verified test
  examples, not permission to hardcode Production tiers.
- Historical / superseded state (verified 2026-07-12): Progressive controls and the
  UUID allowlist were absent at that checkpoint, so general users still entered
  Legacy. This is dated activation history, not current runtime.
- Current Production state (verified read-only 2026-07-15): Entry is `true`, the
  allowlist is absent, and all four Progressive dependencies are `true`. New general
  Kids Group bookings use Progressive; Adult Group and Private remain Legacy.

### Progressive Runtime

- Current global Production functional Source is
  `0226e363f6677b078430f93459c2ee2ede6484e8` in Ready deployment
  `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`. It descends from subsystem-origin Source
  `039ad6e03ca0cb8c8c4334c81818c570b03b9287`, which introduced the Lesson Wallet
  and Admin Teaching Programs release changes while leaving Progressive routing/
  pricing behavior unchanged. `039ad6e...` is retained as historical Progressive
  subsystem provenance, not the current global Production artifact.
- Current source entry decision is server-only and default deny:
  - Entry disabled -> all new bookings remain Legacy.
  - Entry enabled + server-resolved `kids_group` -> Progressive for general users;
    no per-user UUID allowlist is required.
  - Entry enabled + missing pricing-write, coupon-lifecycle, or payment-batch
    dependency -> typed `503`, no Legacy fallback or partial write.
  - Option A compatible source from
    `f8568a6d9c18da3745492d47c01d3ca22da156c8` is deployed through its
    Progressive Summary correction commit
    `aa64adfb765139ca38908ca2409fa2127ffe4a29`; migration `20260713210000` is
    applied. Entry is enabled, so this compatibility path is Production-active for
    new general Kids Group traffic.
  - `adult_group` and `private` -> Legacy.
  - Existing Progressive edit/cancel remains routed by stored `pricing_scope_id`.
    Payment prepare/upload/submit/status/cancel uses authenticated ownership and
    dependency readiness, so existing bookings can drain after Entry is disabled.
- UUID allowlist parsing remains available as staged/test infrastructure, but it is
  not a general-customer eligibility or authorization boundary.
- Source complete: **yes** for the general Kids Group gate and **yes** for Option A
  active-Legacy compatibility. Commit `f8568a6d9c18da3745492d47c01d3ca22da156c8`
  adds the TypeScript contracts, additive migration source, capability version `2`,
  and deterministic/disposable verification. Commit
  `aa64adfb765139ca38908ca2409fa2127ffe4a29` completes the customer Summary by
  branching on authoritative preview `mode`, preserving full Progressive preview
  evidence, and excluding Legacy monthly true-up copy from Progressive mode.
- Source complete: **yes** for the Admin/Super Admin payment-success notification
  correction. Commit `60688a340d473b2bb64f0bee9b1e68cb8cf47c1a`
  adds a `CREATE OR REPLACE FUNCTION` migration and deterministic tests.
  The approval RPC now inserts one amount-free `/admin/payments` notification for
  every extant profile whose current role is `admin` or `super_admin`; the profile
  schema has no separate active/inactive field. The existing user notification is
  unchanged.
- Unlimited Slot Entry originated in Source
  `039ad6e03ca0cb8c8c4334c81818c570b03b9287`, tree
  `1d716a275505ffbc688487f0f245920c31a5619b`; migration `20260715060541` remains
  applied remotely exactly once. That subsystem contract is included unchanged in
  current global Production deployment
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`. The older deployment identities in this
  paragraph are historical task checkpoints, not the current artifact. The later
  Admin Schedules changes did not alter the Unlimited Slot contract or require
  another migration.
- Historical / superseded booking-regression evidence: commit `be61b68`, tree
  `22296e88b9dafbfe369ae559257ac5900aac3c36`, deployment
  `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn`, and its earlier rollback reference
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`. None is the current runtime or an automatic
  rollback target for the Production-active Unlimited Slot Entry release.
  Restoring old Source or old DB helpers would restore some or all of
  the Owner-rejected capacity behavior and requires explicit Owner approval.
- Dependency controls enabled: **yes** for pricing writes, coupon lifecycle,
  payment batch, and payment review based on the last value-level verification;
  all four names remain present in the read-only Production environment listing.
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` is present as a non-sensitive Production
  variable and readback confirmed the exact value `true`. The allowlist remains
  absent.
- Allowlisted: **no**; `PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS` is absent. No UUID
  values were read or exposed.
- Production active for new general Kids Group entry: **yes**. Authenticated
  no-write UAT on the final forced-build activation artifact returned and visibly
  rendered Progressive Legacy baseline `4`, previous Progressive `0`, new `4`,
  cumulative `8`, rate `500`, coupon `0`, and gross/final `2,000`, with no Legacy
  deduction wording. No confirmation or business write occurred. UAT Stage B
  payment previously completed on the one approved Progressive booking in shared
  Test Mode. The staff
  notification correction is now deployed and its migration is applied, but it is
  intentionally future-event-only: no historical notification was backfilled.
  Super Admin and Standard Admin read-only Production UAT both passed. Standard
  Admin received the approved batch operational context once without structured
  amount, booking-total, allocation, revenue, or Finance fields in the rendered UI
  or the technically inspectable server payload.
- Local verification passed: Option A deterministic `32`, Option A real concurrency
  `8`, booking entry `31`, pricing `17`, transactions `33`, coupon `38`, payment
  batches `39`, payment integration/Finance/redaction `18`, notifications `16`,
  shared SlipOK `6`, and Legacy pricing/payment regression `14`. The full disposable
  migration chain, rollback-only mixed/progressive/edit/cancel/coupon/payment-drain
  runtime fixture, TypeScript, ESLint, mojibake (`225` files), Production build, and
  `git diff --check` passed. Post-build checks returned `/` `200`, generated
  `/_next/static/*` `200`, unauthenticated booking preview `401`, zero console
  errors, and no visible Next error overlay.
- Migrations `20260713210000` and `20260715060541` are each applied remotely exactly
  once. Pricing-write capability is Ready at version `2` with contracts
  `immutable_scope_v1` and `unlimited_learner_v1`; payment batch and integration
  capabilities remain Ready at version `1`.

### Production

- Current global Production deployment:
  `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H`, `READY`, from exact input HEAD
  `a39424bdbd0f78dee10d367800b833d8d3544d5d`, tree
  `a2a391a36b28e250dece4317e050ba52cb89f42e`, containing the permanent
  `icn1` configuration and prior business Source. All four established Production
  aliases map to this artifact. Exact pre-gate deployment
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` is the verified rollback target for the
  Phase B promotion history; rollback was not required after corrected
  protection-aware re-promotion.
- Production aliases: `https://www.newathleteschool.com`,
  `https://new-athlete-badminton-school.vercel.app`,
  `https://new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and
  `https://new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`.
- Production controls: last value-level verification found pricing writes `true`,
  coupon lifecycle `true`, payment batch `true`, payment review `true`, and shared
  SlipOK Test Mode `true`; read-only closeout listing confirms those five encrypted
  names remain present. Production Entry is present with exact non-sensitive value
  `true`; the UUID allowlist remains absent. No dependency or shared Test Mode value
  changed during activation.
- Shared Owner-approved payment policy remains server-side
  `SLIPOK_TEST_MODE=true` for both Legacy and Progressive. A successful upload uses
  the normal auto-approve/verify transition and makes no live SlipOK request.

### Admin Schedules Performance (Audit 2026-07-14; Phase A 2026-07-19; Phase B 2026-07-20)

- Current authorization supersedes the original Parking Lot state: Owner selected
  this as the single Active Task on 2026-07-19, then explicitly authorized Phase B,
  Source remediation, publish, B1 diagnosis, the unpromoted Region Experiment,
  authenticated read-only measurement, permanent `icn1` configuration, Local
  validation, the two scoped publishes, permanent-config Canary deployment/UAT,
  exact-artifact promotion, corrected protection-aware re-promotion, and final
  documentation closeout recorded here. Phase B is now Production-active and its
  read-only Production UAT passed with the Owner-accepted limitations below.
- Read-only Supabase inspection found a 100-request API snapshot spanning `24.816`
  seconds; every request returned `200`. The project remained `ACTIVE_HEALTHY`, and
  no schedules-correlated timeout, deadlock, connection exhaustion, or 5xx was found.
- At the 2026-07-14 audit checkpoint, July 2026 had `1,373` verified
  non-rescheduled booking sessions, `418` distinct schedule slots, and `252`
  distinct learners in the schedules scope.
- At the Phase A checkpoint, source chunked related ids by `100` and loaded monthly sessions, wallet
  credits, assignment groups, slot sessions, teaching programs, levels, and
  attendance in several dependent phases. The observed July shape produces about
  `50` Supabase data requests per schedules render before Auth/Profile/Layout work.
- Historical query statistics do not show one 20-second SQL statement. Relevant
  monthly-session fingerprints had weighted mean `247.46 ms` and observed max
  `1,226.20 ms`; the confirmed root pattern is request fan-out plus sequential
  network/API round trips. RLS init-plan, multiple permissive-policy, and selected
  foreign-key index advisories remain possible secondary costs, not proven primary
  root causes.
- Admin latency is confirmed. System-wide User impact remains **Unknown / Need
  verification**: shared-capacity risk is credible, but the inspected window had no
  failures and did not include User-portal end-to-end latency or connection-pool
  saturation evidence.
- The 2026-07-01 client render fix remains valid and is not contradicted: it avoided
  rendering full-month detail by default but explicitly did not change server query,
  chunk, or pagination behavior.
- Full report:
  `docs/performance/admin-schedules-supabase-log-analysis-2026-07-14.md`.
- This investigation changed source/tests/deployment/environment/migration/
  Production business data: **no / no / no / no / no / no**. Only read-only logs,
  advisors, counts, and query statistics were inspected.

#### Phase A Source Review (2026-07-19)

- Phase A Source review confirmed that the existing UI was summary-first only at
  render time. The Server still loaded full-month wallet, assignment-group/member, slot-session,
  teaching-program, Level, and attendance detail before `SchedulesClient` is sent.
  Therefore selecting a day does not trigger a new bounded read; it only filters
  arrays already loaded into the Browser.
- Confirmed primary Code causes are full-month overfetch, serial chunk loops, and
  dependent query phases. Secondary review findings are the second monthly
  `booking_sessions` read, full-month RSC serialization, possible Layout/Page auth
  duplication, and selective Link prefetch. Region distance, RLS advisories, and
  index gaps remain amplifiers or secondary candidates, not the first fix.
- Recommended Phase B design is a bounded monthly-summary read plus an
  authenticated selected-day detail read. Low-volatility branches and active
  Level definitions may use a 5–15 minute cache; attendance, wallet, assignments,
  payment state, and per-user auth context must not use a shared stale cache.
- At the Phase A checkpoint, month-wide Search depended on full learner/parent/
  Coach detail in the Browser. Phase A recommended authenticated server-side search on demand so this
  capability could remain without preloading every person's detail. Owner decision
  on this search contract was the next gate at that Phase A checkpoint and was
  superseded by the 2026-07-20 Phase B authorization above.
- Detailed Phase A report:
  `docs/performance/admin-schedules-phase-a-code-review-2026-07-19.md`.
- Owner additionally classifies Admin/Super Admin and Coach slowness as confirmed
  operational observations. Only Admin schedules is in the Source-fix scope;
  Coach and system-wide User impact remain separate correlated measurements.

#### Phase B Source + Local Test (2026-07-20)

- Initial navigation now returns only a bounded monthly aggregate. Authenticated
  no-store boundaries load one selected day or bounded month-wide Search on demand.
  Search preserves learner, parent, Coach, branch, course, booking status,
  one-character Thai input, selected-month bounds, and branch/course filters.
- Existing Attendance, Wallet, and exact coach-assignment helpers preserve the
  business invariants. Auth/Profile work is request-memoized; only active branches
  and active Level definitions use a 10-minute non-PII reference cache.
- Local verification passed: Phase B `17/17`, assignment-state `24/24`, Lesson
  Wallet `17/17`, disposable browser `5/5` with residue `0`, TypeScript, full
  ESLint, mojibake `241`, local Production build, post-build clean restart/static
  smoke, and diff check.
- On the 2026-07-21 resume, Docker and repo-local Supabase were verified on
  `127.0.0.1`; E2E passed `5/5` with residue `0`. Latest cold/warm-P95/month/day/
  Search were `2512.8/1187.8/220.8/187.3/473.7 ms`. Owner explicitly waived the
  repeat `.next` cleanup/clean-restart for this publish gate; the exact Phase B
  worktree had already passed clean restart/static smoke on 2026-07-20.
- Local cold/warm-P95/month/day/Search were
  `2780.1/1039.9/211.0/230.9/463.3 ms`. Boundary data calls were `4/8/3` for
  summary/day/Search. Initial RSC/document body was `91,089` bytes and local-dev
  transferred bytes were `3,248,407`. Production P95 remains Unknown / Need
  verification.
- Detailed Phase B report:
  `docs/performance/admin-schedules-phase-b-source-local-test-2026-07-20.md`.

#### Phase B Canary Performance Diagnosis (2026-07-21)

- Production-target Canary `dpl_5x2vzwUxAmxNaT8HZGJeBQ32JVr4` is `READY` on
  exact commit `b0bada3d076302d24ebe3b594c03b22bf0997869`. Super Admin
  functional UAT passed, but performance failed: warm navigation P95 `5.344 s`,
  July summary Server duration `2.766–3.447 s`, selected-day over `3 s` in `3/5`
  samples, and Search `4.654–5.937 s`.
- Read-only Production counts for July were 1,437 qualifying sessions, 54 walleted
  session IDs, and 439 unique schedule-slot IDs. Warm summary calls are exactly
  two session pages + one wallet chunk + five group chunks + zero branch calls on
  a cache hit = eight. Search repeats the two detailed pages, one wallet chunk,
  and five group chunks for every query.
- Vercel Admin Schedule functions run in `iad1`; Supabase is in
  `ap-northeast-2`. Bounded SQL plans used the session date index and completed in
  milliseconds with shared-buffer hits and no disk/temp spill. The proven primary
  issue is Data API fan-out/dependent phases; cross-region RTT is a credible but
  not directly measured amplifier. Current evidence does not support claiming an
  index as the primary fix.
- Canary is unpromoted. All four Production aliases still point to
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`. No Source, Test, migration, index, RPC,
  environment, feature, allowlist, alias, Production data, or financial data was
  changed by the diagnosis.
- Detailed diagnosis:
  `docs/performance/admin-schedules-phase-b-canary-performance-diagnosis-2026-07-21.md`.

#### Phase B Canary Source Remediation + Local Test (2026-07-21)

- Owner authorized a Source-only remediation and Local Test gate. The local
  worktree now replaces slot-ID assignment-group chunks with one explicitly
  paginated date-scoped relational read, derives selected-day slot attendance
  scope from the already-loaded exact day sessions, and uses bounded
  candidate-first Search instead of loading detailed person/group data for the
  whole month.
- The July-equivalent deterministic formula changed from `2 session pages + 1
  wallet chunk + 5 slot-ID group chunks = 8` warm calls to `2 session pages + 1
  wallet chunk + 1 date-scoped group page = 4`. A disposable local integration
  fixture with 205 dated slots/groups produced one group page. Selected-day warm
  samples used 5–6 calls; the cold Level-reference path used 7.
- Local verification passed: Admin Schedules `24/24`, assignment `24/24`, Lesson
  Wallet `17/17`, TypeScript, ESLint, mojibake `243`, diff check, Production build,
  and disposable browser E2E `5/5` with fixture residue `0`. Final-worktree local
  cold/warm-P95/month-change were `2359.8/2745.9/433.4 ms`; selected-day
  low/medium/high client samples were `153.5/100.6/121.6 ms`; representative
  learner/Coach/status Search samples were `614.3/204.8/198.1 ms`.
- Post-build deletion of the exact repo-local `.next` directory was rejected by
  execution policy before execution. No bypass was attempted, so the repeat clean
  restart/static-asset smoke is **not claimed** in this gate. Normal final-worktree
  E2E still passed after the build.
- The remediation Source/Test is committed at
  `62ac775d81aa8a702cbab744fdfb2a7ab15791b7` and is included in the scoped
  non-force branch publish recorded by this documentation closeout. No migration,
  index, RPC, View,
  Function, dependency, environment, feature, allowlist, Infrastructure,
  Production query/write, deploy, or promotion occurred; the only later actions
  were the approved scoped commits and non-force branch push.
- Detailed local evidence:
  `docs/performance/admin-schedules-phase-b-canary-source-remediation-local-test-2026-07-21.md`.

#### Remediation Canary Performance Gate (2026-07-21)

- Production-target Canary `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` is `READY` and
  unpromoted. It was deployed from a clean detached worktree at exact branch HEAD
  `67a08fa5a11ee714d8ec23be3fb125732e255b54`, tree
  `ad1a35b38d19bd1b203bb8d644946ea73db3c466`, containing functional Source
  `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`. Vercel `gitCommitSha` was `null`, so
  exactness comes from deploy input/worktree identity rather than Vercel Git
  metadata.
- Target/status was `production/READY`; build duration was `81.021 s`, build region
  `cle1`, function region `iad1`, and deployment metadata region `sfo1`. Custom/
  Production alias count was `0`. All four Production aliases remained on
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` before and after the gate.
- Infrastructure smoke passed: `/`, `/api/health`, one generated static asset, and
  anonymous Admin auth behavior returned the expected non-5xx responses. Super
  Admin monthly-summary-first, no-detail-before-selection, desktop layout, and
  console checks passed before the mandatory performance stop.
- Cold/reference-cache-miss navigation was `5.889 s` with `3.0914 s` summary server
  time and five calls. Ten warm browser samples were
  `4.365/4.145/3.989/3.910/7.907/4.125/5.664/5.228/3.969/5.130 s`; nearest-rank
  P95 was `7.907 s`, above the `5.000 s` budget. Nine samples used the designed
  four-call summary path; one branch-cache miss used five. The worst sample still
  used four calls.
- The mandatory failure stopped month-change, selected-day, Search, mobile, and
  Standard Admin checks. Deployment-scoped bounded logs contained only GET,
  schedule/business mutations `0`, 5xx/fatal `0`, and no PII/search-term marker.
  No promotion, alias change, Production data write, or customer/financial change
  occurred.
- Function region `iad1` and the previously verified Supabase region
  `ap-northeast-2` are observations, not proven causality. No direct RTT/comparison
  proof was collected in this gate.
- Detailed evidence:
  `docs/performance/admin-schedules-remediation-canary-performance-gate-2026-07-21.md`.

#### Phase B Closure Gate B1 — Final Read-only Bottleneck Diagnosis (2026-07-22)

- Result: **PASS — PHASE B CLOSURE BOTTLENECK DIAGNOSED; NO CHANGES MADE**.
  B1 reused remediation Canary `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF`, which remained
  `READY`, unpromoted, and assigned zero custom/Production aliases. All four
  Production aliases remained on `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`.
- Twenty warm July samples confirmed the query-shape remediation in `18/20`
  four-call paths; the other two were branch-reference cache misses. Browser
  min/P50/P90/P95/max was `3.926/4.905/6.329/6.574/7.577 s`; Server P95 was
  `4.171 s`; Browser-residual P95 was `3.406 s`. The normal `3 s` and P95 `5 s`
  budgets still failed.
- Three month-navigation cycles showed that low-volume August Server duration fell
  to `0.359–0.752 s` while Browser total remained `4.600–5.029 s`. Selected-day
  combined P50/P95/max was `2.827/3.874/3.874 s`. Search client total P50/P95/max
  was `5.795/7.868/7.930 s`, including the fixed `0.300 s` debounce; post-debounce
  P50/P95/max was `5.495/7.568/7.630 s`. Standard Admin and mobile remain
  **Unknown / Need verification** because no existing Standard Admin session was
  available and the controlled mobile viewport could not be established reliably.
- Bounded Vercel evidence was GET-only with business mutation methods and 5xx/
  error/fatal counts `0`. The route-level aggregate showed low Active CPU relative
  to duration and average outbound Supabase latency `620 ms`, but that panel covered
  all environments/deployments and is not Canary-only. Supabase remained
  `ACTIVE_HEALTHY` in `ap-northeast-2`; no timeout, deadlock, exhaustion, or lock
  pressure was found. Bounded read-only plans completed in `0.817–31.341 ms` with
  no disk/temp spill.
- **Strongly Supported primary Server contribution:** Vercel-to-Supabase Data API/
  network wait, with cross-region `iad1 → ap-northeast-2` as the leading hypothesis
  and remaining request waves as a multiplier. SQL execution and Active CPU are
  not primary bottlenecks. **Separate material contribution:** Browser/RSC residual.
  A region move has not been tested and is not a guaranteed fix; Browser residual
  may still keep the overall budget failing after Server improvement.
- Detailed B1 evidence:
  `docs/performance/admin-schedules-phase-b-closure-b1-bottleneck-diagnosis-2026-07-22.md`.
- B1 changed Source, Test, configuration, migration, deployment, aliases,
  Production data, customer behavior, and financial state: **No**. This later
  Owner-approved closeout records the B1 result in documentation only.

#### Infrastructure Region Experiment + Permanent `icn1` Configuration (2026-07-22)

- Same-business-Source A/B compared Control
  `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` in `iad1` with Treatment
  `dpl_DvJ2gVNSqmqUCcdgcoiPTwJVSYh2` in `icn1`. Both remain `READY`, Production-
  target, unpromoted, and had zero custom/Production aliases at that experiment
  checkpoint. The four established Production aliases remained on
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` at that checkpoint.
- Paired monthly measurement completed `20/20` samples per environment. Treatment
  Browser P50/P95 was `2.203/2.640 s`; Server P95 improved approximately `57.46%`,
  Browser P95 improved `59.82%`, and residual P95 improved approximately `46.55%`.
  Treatment passed the `3 s` normal and `5 s` P95 Browser budgets.
- Treatment selected-day passed all 15 samples with combined P50/P95/max
  `1.058/1.436/1.436 s`; corrected Search returned `21/21` GET `200`; verified
  mobile `390x844` and functional read-only smoke passed. Standard Admin was not
  run. Business-data mutation, Production data change, console/runtime error,
  promotion, and alias movement were all zero/no.
- Permanent repository configuration now contains only `"regions": ["icn1"]` as
  the scoped `vercel.json` change. JSON assertion, Admin Schedules `24/24`,
  assignment `24/24`, wallet `17/17`, TypeScript, ESLint, mojibake, build (`91/91`
  pages), and diff check passed on the exact configuration worktree. Configuration
  commit `77db099607dd7ee8dfe265929a6720818e2015d1` is pushed non-force.
- At that checkpoint, the permanent configuration was not deployed or
  Production-active. The experiment supported regional alignment as a major
  Server improvement, not as a guarantee for every future deployment. The final
  Production outcome is recorded below.
- Detailed evidence:
  `docs/performance/admin-schedules-phase-b-region-experiment-permanent-icn1-2026-07-22.md`.

#### Phase B Final Production Closeout (2026-07-23)

- Exact permanent-config deployment `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H` is
  `READY` in `icn1`. Fresh read-only inspection confirmed all four established
  Production aliases map to that exact deployment; public health returned `200`
  with `icn1` Function routing evidence.
- The exact artifact was initially promoted, then conservatively rolled back when
  smoke automation misclassified expected Vercel Deployment Protection `302`
  responses on the two protected project aliases as application failures. No
  application 5xx, runtime error, Source failure, Region failure, or business write
  was proven. After Owner approval, the same artifact was re-promoted without a
  rebuild. Protection-aware smoke classified the protected `302`, application auth
  `307`, and anonymous API `401` responses correctly and passed.
- Authenticated read-only Production UAT passed for both Super Admin and Standard
  Admin, including monthly summary, month navigation, selected day, Search,
  permission/filter behavior, stale-response protection, and verified mobile
  `390x844`. Application 5xx, relevant runtime/console/hydration errors, and
  UAT-initiated business mutations were `0`.
- Five post-warm-up monthly observations per role produced Super Admin outer/server
  P95 `1.540/0.860 s` and Standard Admin outer/server P95 `2.450/1.523 s`.
  Outer samples above `5 s` and Server samples above `3 s` were `0/5` for each
  role. These outer timings are bounded Production observations, not a substitute
  for unavailable page-internal timing.
- Owner accepted the Performance Evidence Exception: page-internal timing was
  unavailable; live forced error/retry was not run; Local error/loading/empty/stale
  evidence had passed previously; the retry handler is present; and live retry
  interaction remains **Unknown / not explicitly proven**.
- Rollback was not required after corrected re-promotion. Production data changed
  by UAT **No**; Controlled Write UAT **No / not applicable**; Data Repaired **No /
  not applicable**; Financial Impact **None**. Customer impact is the active
  `icn1` Admin Schedules performance remediation.
- Detailed final evidence:
  `docs/performance/admin-schedules-phase-b-final-production-closeout-2026-07-23.md`.

#### Historical / Superseded Project Matrix — Coach Assignment Mixed-Level Save Regression

State observed at that completed release closeout. It is preserved as historical
evidence and is not the current Active Task or current mutable matrix.

| Field | Current value |
| --- | --- |
| Active Task | NONE |
| Task Status | DONE — COACH AUTHORITATIVE-NAME SOURCE IS COMMITTED, PUSHED, DEPLOYED, PROMOTED, AND PRODUCTION-ACTIVE; LOCAL TESTS, STAGED READ-ONLY/CONTROLLED-WRITE UAT, EXACT TWO-NAME REPAIR, OWNER POST-PROMOTION LIVE SAVE, AND READ-ONLY PRODUCTION RECONCILIATION PASSED |
| Branch | `spike/next-major-security-upgrade` |
| Local HEAD | Documentation closeout commit containing this matrix; parent `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, tree `271908ac3f84be95391819fb01a47ac197460489`; functional Source/Test commit is `a3a573975bb0b8874baf2557aa3fcf9f0786229a`, tree `84a2494919f87ed9e8b2f1fd78c1d8d53860f40e` |
| Remote HEAD | Same documentation closeout commit as Local HEAD on `origin/spike/next-major-security-upgrade` after normal non-force Push verification |
| Ahead/Behind | `0/0` after normal non-force Push verification |
| Root Cause | The previously deployed Coach-only resolver still treated blank/`ยังไม่จัดกลุ่ม`/generic `กลุ่ม N` names as placeholders and re-derived names from Level during persisted-draft initialization and Save normalization. The Coach client and API both call that resolver, so Owner UAT observed `กลุ่ม 1` → `ชุดเตรียมนักกีฬา ชุด C` and `กลุ่ม 2` → `ชุดพื้นฐาน` despite the visible Save names |
| Source Complete | Yes — Coach flow only under the superseding Owner rule. The Coach resolver now treats the cleaned visible non-empty name as authoritative, rejects empty names, preserves actual-member `levelMin/levelMax`, and leaves warning calculation separate. Shared/default naming and Admin Makeup are unchanged |
| Tests Passed | Yes — Local only. Fresh Commit + Push gate reruns passed `npm.cmd run test:admin-schedule-assignment` `32/32`, Local Supabase browser/API E2E `6/6` with residue `0`, Coach conflict DB `21/21` with residue `0`, Admin Schedules performance `24/24`, Lesson Wallet `17/17`, TypeScript, ESLint with zero warnings, mojibake (`247` files), high-confidence secret-addition scan, and `git diff --check`. The prior Next.js 16.2.6 Production build passed `91/91` static pages on the same unchanged functional Source/Test worktree and was not rerun in this publish gate; its previously unrun post-build `.next` cleanup/clean restart is still not claimed |
| Committed | Yes — Source/Test commit `a3a573975bb0b8874baf2557aa3fcf9f0786229a`, tree `84a2494919f87ed9e8b2f1fd78c1d8d53860f40e`, plus the documentation closeout commit containing this matrix |
| Pushed | Yes — Source/Test and documentation closeout commits after Owner-approved normal non-force Push and read-only remote verification |
| Current Source | Committed and pushed Coach-only forward fix in `a3a573975bb0b8874baf2557aa3fcf9f0786229a`; existing Coach client/API call sites consume the corrected resolver without their own diff. Shared/default naming and Admin Makeup remain unchanged |
| Deployed | Yes — exact Production-target artifact; the existing artifact was promoted without rebuild and is Current |
| Deployed Source | Exact detached-worktree input HEAD `b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, tree `271908ac3f84be95391819fb01a47ac197460489`; functional Source/Test commit `a3a573975bb0b8874baf2557aa3fcf9f0786229a` |
| Deployment ID | `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`; unique URL `https://new-athlete-badminton-school-5p92e6c1p-aachanin1s-projects.vercel.app`; target `production`; `READY` / `PROMOTED`; configured and Coach assignment Function region `icn1` |
| Deployment Metadata | Pinned Vercel CLI `56.5.0`; original deployment command ran once with `--skip-domain`, exit `0`, without force/retry; source `cli`, actor `codex`, `gitCommitSha=b6d974cdc8bee7966ca5d18e012bf069f1fe0e67`, ref `HEAD`; build duration `79.057 s`; remote build execution `cle1`; build metadata `sfo1`; Next.js `16.2.6`; Node.js `24.x` / `nodejs24.x`; static pages `91/91`; deployment-level `autoAssignCustomDomains=false`. Promotion reused this exact artifact and did not rebuild or create a deployment |
| Promotion | Yes — exact command `vercel promote dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9 --yes --scope team_gw8Y6CPd602WAKRsVFobPGCL --no-color` ran once from `2026-07-24T16:01:20.7047308+07:00` to `16:01:25.8707679+07:00`, exit `0`; deploy/build/rollback/alias-command/force/retry counts were all `0` |
| Production Alias Deployment | Fresh pre/post control-plane evidence: exactly four Production aliases moved from `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H` to Current `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9`: `www.newathleteschool.com`, `new-athlete-badminton-school.vercel.app`, `new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`. Missing/extra moved Production aliases were `0/0`; branch-preview aliases were unchanged. Superseded `dpl_vsnYY1QWBybnR3rF51DsqamnQLg7` remains `READY` / `STAGED` |
| Migration Source | None for the new Coach fix |
| Migration Applied | No — not required |
| Environment Change | No |
| Feature Enabled | Not applicable; no feature control changed |
| Allowlisted | Not applicable; no allowlist changed |
| Production Active | Yes by Vercel control-plane evidence — exact artifact `dpl_9Hb6invegeJEFo7o8Tt7EJ95Y6t9` is Current and owns all four established Production aliases |
| Production UAT | Passed — Owner post-promotion live Save through Production on 2026-07-25 09:00–11:00 Bangkok preserved both custom Thai names, showed mixed-Level warning-only, returned `POST /api/coach/assignment-groups` `200`, and settled to `มอบหมายแล้ว`. Fresh read-only reconciliation matched the exact visible result and complete atomic assignment state. The earlier four deployment-wide booking availability/preview POSTs remain a historical attribution limitation only: Source confirms both endpoints are read-only and unrelated to Coach assignment Save |
| Performance Gate | Not applicable to this Coach-only fix; prior Admin Schedules Phase B gate remains passed |
| Controlled Write UAT | Passed — prior staged controlled Save and the Owner's post-promotion live Save both passed. The Production Save reconciled to exact slot `6e27b409-27e8-4b67-966b-75b27248c13d`, request `d2wlk-1784886263183-64f29b35ccf7` at `2026-07-24T09:44:23.183Z`, `POST /api/coach/assignment-groups`, status `200`, with one exact `save_coach_assignment_groups` activity row `468e0e9f-7032-480a-8e17-43c779ae50de` for `2` groups / `9` students |
| Authoritative Save Behavior | Passed — post-promotion Production Save kept visible custom names `กลุ่มโค้ชชาติ` and `กลุ่มโค้ชเบล`; actual member ranges persisted as `3–11` and `7–35`; the mixed group remained warning-only and Save completed without renaming |
| UAT Network / Runtime | Exact Production Save request `d2wlk-1784886263183-64f29b35ccf7` was `POST /api/coach/assignment-groups` `200` on `www.newathleteschool.com`; matching activity and database creation timestamps followed at `09:44:24Z`. The earlier read-only checkpoint's four deployment-wide `POST 200` requests to `/api/bookings/availability` and `/api/bookings/preview` remain historical non-blocking attribution evidence: their Source paths are SELECT-only and have no Coach assignment write path |
| Production Reconciliation | Complete. Prior exact repaired slot remains reconciled. Fresh post-promotion Save reconciliation for slot `6e27b409-27e8-4b67-966b-75b27248c13d`, เทพารักษ์, 2026-07-25 09:00–11:00 found sort-0 group `bcd619de-1138-4a90-9504-e11332b8d729`, `กลุ่มโค้ชชาติ`, Coach ชาติ, five learners, range `3–11`; sort-1 group `6edff27a-6d34-44b6-a00f-8a4403ad4544`, `กลุ่มโค้ชเบล`, Head Coach เบล, four learners, range `7–35`. Groups/members/legacy/reservations are `2/9/2/2`; active verified learners are `9/9` exactly once; group/member/session orphan, duplicate, identity, range, legacy, and reservation mismatch counts are all `0` |
| Data Repair Candidates | Resolved for the exact two approved names. The former groups `a6bac691-d7d1-4a4d-acdc-e22d0f417c78` / `f460017e-4a6f-44e7-8068-b82a6a2af5b2` were atomically replaced as expected by the RPC and no longer remain |
| Data Repaired | Yes — prior exact 2026-07-24 slot/two-name repair only. The Owner's 2026-07-25 Production Save was normal assignment use, not a new Codex repair |
| Production Data Changed | Yes cumulatively: prior exact repair plus the Owner's normal post-promotion Assignment Save. The latter atomically recreated `2` groups, `9` members, `2` legacy rows, and `2` reservations and added one expected activity row; notification delta was `0`. This read-only reconciliation/Commit + Push gate produced `0` Production application or SQL mutations |
| Customer Impact | Fixed and verified in Production: authoritative custom Thai group names remain unchanged after Save, mixed-Level remains warning-only, and the exact `2/9` assignment is complete. The 16:00–18:00 display changed `5 → 4` because session `cf4c224a-fe4c-4a5b-a24d-bd6a7b3f72fd` was independently rescheduled at `2026-07-24T09:18:32Z`, before the 09:44 Assignment Save; the post-Save `router.refresh()` exposed the already-current count |
| Financial Impact | None detected. Current post-Save fingerprints are booking sessions `9`, bookings `6`, payments `5`, wallet credits `0`; attendance, check-in, teaching program/hours, weekly-summary, and payout rows are each `0`. Production RPC write targets are only assignment groups/members/legacy plus reservation synchronization; protected/financial write targets are `0` |
| Blocker | None |
| Remaining Work | None for this task. Await Owner selection; do not start a Parking Lot or other task automatically |
| Task Done | Yes |
| Documentation Drift | No — current state, dated evidence, Git, Vercel, Owner screenshots, and read-only Production reconciliation are aligned in this closeout |
| Next Gate / Next Action | Await Owner selection; do not start another task automatically |
| Parking Lot authorization state | No Parking Lot task is authorized automatically |

## Historical / Superseded 2026-07-13–14 Records

The dated audit, deployment, rollback, Entry, blocker, “current classification,”
and next-task statements below describe their individual historical checkpoints.
They are superseded for current-state decisions by `Current Source of Truth` above.

### Historical History Payment Selection 409 Audit (2026-07-14; Superseded)

- Historical pre-fix classification:
  **PRODUCTION REGRESSION AUDITED - VALID SERVER 409 + CLIENT MODAL BUG; SOURCE
  FIX OWNER APPROVAL REQUIRED**. This classification was superseded by the History
  Payment Lifecycle Fix Closeout below and must not be used as current state.
  At that 2026-07-14 checkpoint, History Payment later closed as **DONE;
  Production UAT passed**, and Homepage LV was parked because Unlimited Slot Entry
  was then the active task. That historical priority is superseded by **Current
  Execution State** above.
- Scoped Booking price result is now:
  **PASS - PRODUCTION STEP 4/STEP 5 PRICE UI VERIFIED**. Owner-supplied
  authenticated evidence shows Step 4 `2,000`, Step 5 `2,000`, Legacy baseline
  `4`, new sessions `4`, cumulative `8`, rate `500`, and no historical Legacy-
  money deduction. This closes the price-display proof only; it does not close the
  newly discovered History payment blocker.
- The failing route was `POST /api/progressive-payments/prepare` on deployment
  `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn`. From 13:40:50.201 through 13:41:32.788
  Asia/Bangkok, Vercel recorded `11` prepare requests: `5` returned `200` and `6`
  returned `409`. Five matching batch-cancel POSTs returned `200`. There were no
  upload, submit, status, 5xx, error-level, or SlipOK events. The log cadence and
  source contain no server retry loop; whether one physical click emitted more
  than one browser request remains `Unknown / Need verification` because the
  Chrome connector failed before the existing Network panel could be read.
- The original sanitized payload, response JSON/headers, trace id, and
  idempotency keys remain `Unknown / Need verification`. Source plus the exact
  database/action timeline proves the internal 409 cause was
  `PROGRESSIVE_SCOPE_REVISION_CONFLICT`: every 409 followed a successful
  `user_cancelled` batch cancellation that incremented the scope revision while
  the rendered page still submitted the earlier revision. The route returns the
  mapped RPC message in `{ error }`; the locked scope/revision guard behaved as
  designed and no payment selection/prefix policy should be weakened.
- Exact selected records, reported without personal data:

  | Booking | Kind | Status | Amount | Entitlement / sequence | Scope result |
  | --- | --- | --- | ---: | --- | --- |
  | `c917f5f6...` | Progressive Kids Group, July 2026 | `pending_payment` | `3,464` | `8` / `1` | same owner/scope; first pending prefix member |
  | `1a7d58f8...` | Progressive Kids Group, July 2026 | `pending_payment` | `866` | `2` / `2` | same owner/scope; second pending prefix member |

  Both are owned by the authenticated User, use the same child and course/month/
  user pricing scope, and use different branches. They have no coupon reservation,
  coupon use, Legacy payment, allocation, verification attempt, attendance, wallet
  credit, or started session. Their selected total is `4,330`; together they are
  the exact valid contiguous pending prefix. They are not a Legacy/Progressive mix
  and not a cross-scope selection.
- Two authoritative `4,330` prepared batches existed during the incident, at
  scope revisions `11` and `13`. Each was valid when its modal opened, contained
  both selected bookings, had no slip metadata, and was then cancelled normally
  with reason `user_cancelled`. The other three successful prepares covered only
  the first `3,464` prefix member. All five incident batches are now cancelled,
  all seven incident membership rows are inactive, current scope revision is `15`,
  and `locked_by_payment_batch_id` / `locked_at` are null. No Production batch or
  scope repair is currently required.
- Client source does not open the dialog on a failed prepare. In
  `src/components/dashboard/history-client.tsx`, the modal opens only after a
  successful response with `result.batch` (lines 465-496); the catch path only
  stores an error (497-500). Therefore the visible `4,330 / 2 items` modal came
  from a real `200` prepared batch, not from a 409. The client defect is lifecycle
  state: closing a prepared modal cancels and increments the scope revision but
  does not enter a cancel/refresh loading state or clear the previous batch,
  selected ids, and authoritative total (540-550). The payment button can therefore
  submit a stale prop revision before `router.refresh()` completes. A prepare error
  is stored, but the only error surfaces are inside dialogs that remain closed on
  failure (1108-1112 and 1252-1255), so the customer receives no useful visible
  explanation. Rapid re-entry is guarded only by React `loading` state, not a
  synchronous in-flight lock.
- The six 409 transactions stopped before batch insert and rolled back their row/
  advisory locks; they created or changed zero batches, members, scope fields,
  bookings, sessions, receipts, payments, attempts, allocations, coupon rows,
  Ledger, wallet, attendance, notification, Finance, activity log, or storage
  object. The successful incident actions are separate and did change Production:
  `5` prepared batches, `7` member rows, `5` cancellations, `10` activity logs,
  and scope revision `10 -> 15`. No slip object exists for any incident batch.
- Reconciliation from the prior 05:25:27Z protected baseline also found real
  authenticated activity outside the failed requests: this User created four
  Progressive bookings (`18` sessions), cancelled two of them, and created/
  cancelled nine total prepared batches across the wider UAT window. One unrelated
  User created one booking/four sessions and one Legacy payment; `50` notifications
  and four activity rows were unrelated. Current counts include bookings `524`,
  sessions `2,815`, scopes `3`, batches/members `13/17`, attempts/allocations `1/1`,
  payments/Ledger `471/472`, wallet `61`, attendance `1,630`, notifications
  `16,373`, tiers `11`, and Finance expenses `1`.
- Upload from a stale/cancelled modal would not be safe or valid. The upload route
  rechecks the server batch before reading/storing the file and returns `409` when
  status is not `prepared`, so the audited cancelled batches cannot create a slip
  object. No upload was attempted.
- The prepare contract also contains valid guards for ownership/scope, contiguous
  prefix, expiry, active batch membership, existing payment, future/unused
  sessions, coupon snapshot, amount, revision, idempotency, dependencies, and
  capability version. Under the current HTTP mapper, `*_EXPIRED`, `*_CONFLICT`,
  and `*_REQUIRED` become 409; unauthorized/user mismatch becomes 403;
  dependency absence becomes 503; several other valid guards such as
  `PROGRESSIVE_SCOPE_LOCKED`, `PROGRESSIVE_PAYMENT_EXISTS`,
  `PROGRESSIVE_BOOKING_NOT_PENDING`, and `PROGRESSIVE_BATCH_AMOUNT_MISMATCH`
  currently fall through to 500. That mapping gap was not the observed 409 but
  should be covered by any approved source correction.
- Smallest safe later source boundary: add a synchronous prepare/cancel in-flight
  guard; disable selection through cancel plus refresh; clear stale batch/member/
  total state; refresh on revision conflict; expose structured typed errors with
  Thai customer copy outside the modal; and require a current `prepared` batch id
  before rendering/enabling Progressive upload. Retain same-scope contiguous-prefix
  policy and every server/RPC guard. No migration or Production data repair is
  indicated by this audit.
- This audit changed source/tests/deployment/environment/migration/Production data:
  **no / no / no / no / no / no**. The incident itself changed Production through
  the successful prepare/cancel actions listed above; the failed 409 requests did
  not. Customer impact is confusing repeated retry behavior and invisible stale-
  revision feedback. Financial impact is **none**: no slip, payment, allocation,
  Ledger, coupon, or Finance entry was created.

### History Payment Lifecycle Fix Closeout (2026-07-14)

- Final classification:
  **PASS - HISTORY PAYMENT LIFECYCLE FIXED; LOCAL E2E AND CONTROLLED PRODUCTION
  UAT PASSED; TASK DONE**. At this historical closeout, Homepage LV became the next
  queued task and was not started; it was later superseded while Unlimited Slot
  Entry was active. Current authorization is recorded only in **Current Execution
  State** above.
- Root causes were the missing cancel/refresh lifecycle state, stale batch/member/
  total evidence retained behind a closed modal, stale rendered scope revision
  reused before `router.refresh()` completed, an error surface confined to closed
  dialogs, and React-state-only re-entry protection. The valid RPC revision and
  contiguous-prefix guards were not weakened.
- Source commit `7d98b062f850a4210fae052cefddd92b994889b8`, tree
  `73294ca5419582492fa558623d395c5b3801af5e`, changed the History client, shared
  Progressive payment error mapper, prepare route validation response, package/
  Playwright configuration, and four disposable History E2E support/spec files.
  It is pushed to `origin/spike/next-major-security-upgrade`.
- The client now uses lifecycle states `idle`, `preparing`, `prepared`,
  `cancelling`, `refreshing`, `conflict`, and `failed`; a synchronous ref lock and
  generation guard prevent duplicate/stale responses. Cancel clears upload
  eligibility immediately and waits for a newer server revision. Revision conflict
  keeps the selection, closes stale modal evidence, refreshes once without auto-
  retry, and displays typed Thai copy on the main surface. Upload is available only
  for the current authoritative prepared batch with exact scope/member/total
  evidence.
- Executable verification passed `248` unique checks: payment batches `39`, payment
  integration `18`, notifications `16`, pricing transactions `33`, coupon `38`,
  Legacy true-up/payment `14`, shared SlipOK `6`, booking entry `31`, Option A
  baseline `32`, Progressive pricing `17`, plus rendered History E2E `4`. The E2E
  suite passed before and after the required build/dev restart. TypeScript, ESLint,
  mojibake (`227` files), Production build (`91` routes), and `git diff --check`
  passed. Browser console/page/hydration errors were `0`; disposable fixture
  residue was `0`.
- Local History E2E proved rapid double-click single-flight, authoritative
  `4,330 · 2 รายการ` prepared modal, cancel/revision wait/re-prepare, real stale-
  revision 409 with visible Thai recovery and no modal, cancel-failure safe resume,
  and real RPC valid/skipped-prefix behavior. No local slip, Payment, attempt,
  allocation, Ledger, or Finance artifact remained.
- Final deployment `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9` is Ready on all four
  aliases. `/` and generated static asset returned `200`; authenticated History
  rendered the new lifecycle; unauthenticated prepare with valid origin returned
  `401`. Two earlier deployment attempts (`dpl_2x6buY9UgAacgLBsAZ4EZHvPBL8t` and
  `dpl_GyFfc9KgfK9bGU3hSDCWBrpaweVk`) were rolled back before UAT because Vercel
  link metadata left the detached worktree failing the exact-clean provenance
  gate. They caused no Production business-data write. The final deploy used the
  verified clean detached worktree and exact tested tree.
- Controlled Production UAT used the existing Owner-controlled User session and
  exact valid pending prefix `c917f5f6...` (`3,464`) plus `1a7d58f8...` (`866`).
  Two physical prepare clicks produced exactly two prepare `200` responses and two
  current modals showing `4,330 · 2 รายการ`; no 409 occurred. Closing each modal
  produced exactly one cancel `200`, controls stayed disabled through cancel and
  RSC revision reconciliation, and the second prepare succeeded only after the
  first revision refresh. No file was selected and upload/submit was never called.
- Production reconciliation at `2026-07-14T08:14Z` found the exact authorized
  lifecycle delta: batches `16 -> 18` (both new rows `cancelled`, amount `4,330`,
  member count `2`, no slip metadata), members `20 -> 24` (all four new rows
  inactive), activity logs `+4`, and scope revision `15 -> 17` with lock owner/time
  null. Booking `525`, sessions `2,819`, receipts `10`, coupon reservations/usages
  `0/0`, attempts `2`, allocations `2`, payments `472`, Ledger `474`, wallet `61`,
  attendance `1,636`, tiers `11`, and Finance `1` retained their complete protected
  fingerprints. One coach check-in activity and one reminder notification during
  the window belonged to a different user/entity and were separated as real
  operational activity.
- Entry and all four Progressive dependencies remain exactly `true`; allowlist is
  absent; shared `SLIPOK_TEST_MODE=true`; migration `20260713210000` remains applied
  once. Capabilities remain Ready: pricing version `2`/
  `immutable_scope_v1`, coupon version `1`, payment batch version `1`/
  `batch_authority_with_allocations`, and integration version `1`/30-minute TTL.
  Vercel/console monitoring found prepare `200 x2`, cancel `200 x2`, and zero 409,
  5xx, error-level, hydration, upload, submit, or SlipOK events.
- Customer impact: repeat payment selection now waits for authoritative revision
  refresh, stale/duplicate actions cannot reopen invalid slip evidence, and typed
  Thai errors are visible outside the modal. Financial impact: none. Production
  data repair: none. The only UAT writes were the approved temporary lifecycle
  batches/members/activity/revision changes above. No final deployment-health
  rollback was required.

### Historical Production Booking Regression Fix Deployment (2026-07-14)

- Historical classification before the Owner supplied authenticated price proof
  and before the History blocker was fixed:
  **BLOCKER - PRODUCTION AUTHENTICATED NO-WRITE UAT COULD NOT BE COMPLETED;
  DEPLOYMENT HEALTHY, PRODUCTION DATA DELTA 0; TASK NOT DONE**.
  Source, executable tests, Localhost E2E, disposable create, commit/push, exact-
  source deploy, deployment health, and read-only reconciliation passed. The
  authenticated Production UI proof remains `Unknown / Need verification` because
  the available browser-control systems failed before safe navigation and then
  explicitly stopped the Computer Use turn when they could not establish the
  current Chrome URL with sufficient confidence. No Booking confirmation or
  Production mutation was attempted.
- Source commit `be61b684b8d278c9e3ca69e5cf4f0f313bd4813e` fixes the two audited
  defects without changing formulas or mutation semantics. One draft fingerprint
  now owns the Progressive preview state across Steps 4 and 5; relevant input
  changes abort/invalidate stale work, no Legacy fallback amount is displayed,
  and Summary/confirm require a fresh successful authoritative preview. Gross,
  discount, final amount, and create evidence come from that same preview.
- New authenticated read-only endpoint `/api/bookings/availability` returns only
  canonical slot/template ids plus capacity, active occupancy, remaining seats,
  and full state. Its helper counts the same active booking/session states as the
  locked RPC and excludes cancelled, rescheduled-source, walleted, expired-pending,
  and otherwise inactive rows. It does not trust
  `schedule_slots.current_students` or expose learner identities. Full slots show
  `full/capacity` evidence and are disabled; restored/raced full selections block
  Summary while preserving other valid selections. The locked RPC remains final
  authority, and `PROGRESSIVE_CAPACITY_EXCEEDED` is mapped to customer-facing Thai
  copy before availability is refreshed.
- Exact source/test boundary: `.gitignore`, `package.json`, `package-lock.json`,
  `playwright.booking.config.ts`, four booking regression scripts,
  `src/app/api/bookings/availability/route.ts`, `src/app/api/bookings/route.ts`,
  `src/components/dashboard/booking-client.tsx`,
  `src/lib/booking-slot-availability.ts`, and four files under
  `tests/booking-regression/`. No migration, tier, environment, Entry, allowlist,
  Legacy formula, Adult/Private route, payment, coupon policy, or SlipOK behavior
  changed.
- Executable verification passed: `255` deterministic/runtime checks plus `6/6`
  rendered Playwright booking scenarios. The actual post-build restarted
  `/dashboard/booking` flow proved Step 4 `2,000`, Step 5 `2,000`, disposable
  Booking total `2,000`, coupon gross/discount/final `2,000/200/1,800`, restored-
  draft recalculation without a `1,500` fallback, stale-response rejection,
  Adult/Private and Entry-off Legacy preservation, `5/6` selection/create,
  `6/6` disabled UI and forced atomic `409`, multi-date preservation, and the
  capacity-race Thai UX. Application console/page/hydration errors were zero.
  TypeScript, lint, mojibake (`227` files), build (`91` routes), generated static
  asset smoke, and `git diff --check` passed.
- The local controlled fixture contained one parent, one child, Legacy entitlement
  `4` with historical total `2,500`, four new sessions, pricing tiers, templates,
  slots, and a separate full slot. The created Progressive booking stored exactly
  `2,000`, baseline/cumulative `4/8`, rate `500`, scope/revision `1`, and four
  sessions. The Legacy row and `2,500` remained unchanged and unscoped; payment,
  batch, allocation, attempt, Ledger, wallet, Finance, and live SlipOK counts stayed
  zero. Global teardown reset the disposable database and reported fixture/auth
  residue `0`.
- The exact source was deployed from a clean detached worktree. Deployment
  `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn` is Ready and all four aliases resolve to it;
  `/` and generated `/_next/static/*` returned `200`, while unauthenticated preview
  and availability returned `401`. Entry remains exactly `true`, allowlist absent,
  all four Progressive dependencies and shared `SLIPOK_TEST_MODE` exactly `true`,
  migration `20260713210000` applied once, and capabilities unchanged.
- Protected pre/post count plus SHA-256 fingerprint comparison passed all `23`
  groups. The snapshots covered bookings `519`, sessions `2,793`, scopes `2`,
  receipts `3`, coupon reservations/usages `0/0`, batches/members `4/4`, attempts
  `1`, allocations `1`, payments `470`, Ledger `471`, wallet `61`, attendance
  `1,630`, notifications `16,323`, tiers `11`, Finance expenses `1`, snapshots,
  existing Progressive records, approved batch, and repaired booking. Production
  UAT-attributable business-data delta is exactly `0`.
- Deployment logs contained no 5xx, error-level events, baseline/revision/dependency
  faults, or SlipOK activity. No create request was issued by this Production UAT
  attempt. Because authenticated rendering was not safely reachable, Production
  Step 4/Step 5 `2,000`, full-slot disabled state, Adult/Private UI, History/batch
  readability, and browser console/hydration results remain
  `Unknown / Need verification` for this deployment.
- Customer impact: the deployed source is designed to remove the misleading Step 4
  price and reject known-full choices earlier. Financial impact in this round is
  **none**; Production data did not change and no payment/slip action occurred.
  No rollback criterion was observed, so deployment rollback was not used. At that
  historical checkpoint the task remained active pending authenticated no-write
  UAT; the later evidence and History lifecycle closeout supersede that status.

### Production Booking Regression Audit (2026-07-14)

- Historical pre-fix classification, superseded by the fix deployment record above:
  **PRODUCTION REGRESSION AUDITED - SOURCE FIX OWNER APPROVAL REQUIRED**.
  The 2026-07-13 successful no-write Summary UAT remains valid dated evidence, but
  it did not close the end-to-end booking flow at that checkpoint. This historical
  `Task Done = no` state was superseded by the later booking evidence and History
  lifecycle closeout; it is not the current Unlimited Slot Entry task status.
- Fresh Git and runtime preflight passed without documentation/source drift:
  branch `spike/next-major-security-upgrade`, matching local/remote starting HEAD
  `8a78d5d7c917787b29cf65425445ed4932179f65`, functional source
  `aa64adfb765139ca38908ca2409fa2127ffe4a29`, Ready Production deployment
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS` on all four aliases, Entry `true`, allowlist
  absent, four Progressive dependencies `true`, shared `SLIPOK_TEST_MODE=true`,
  migration `20260713210000` applied once, pricing capability Ready/version `2`/
  `immutable_scope_v1`, and payment capabilities Ready/version `1`. The only dirty
  file remained the unrelated unstaged `AGENTS.md` remainder (`72` additions /
  `3` deletions).
  Current Vercel inspection exposes deployment identity/state/aliases but no Git
  SHA metadata; exact `aa64adf` provenance remains the prior clean-detached deploy
  record plus the unchanged functional tree, not a new platform SHA assertion.
- Price divergence is a client render-path defect in
  `src/components/dashboard/booking-client.tsx`. Step 4 does not call the booking
  preview API. It filters settled `paid`/`verified` Kids Group history, calls the
  Legacy monthly true-up helper, and renders `totalBatchPrice`; the exact Owner
  case therefore renders `8 x 500 - 2,500 = 1,500`. Advancing to Step 5 calls
  `/api/bookings/preview`, stores its authoritative Progressive result, and renders
  baseline `4`, previous Progressive `0`, new `4`, cumulative `8`, rate `500`, and
  gross/final `2,000`. Draft restoration did not corrupt the price; it restored the
  selection and exposed the deterministic Step 4 path. This is not a cache/build
  artifact.
- The previous booking-entry regression checks passed because they are source-text
  assertions over the Step 5 Summary contract. They neither execute/render Step 4
  nor assert equality across the date-selection card and Summary. Required later
  coverage is an executable component/browser transition test for calendar ->
  Summary, including Legacy baseline, coupon, draft restore, and a full-slot case.
- The `409 PROGRESSIVE_CAPACITY_EXCEEDED` is an independent, correct database guard,
  not a pricing or Legacy-baseline calculation. `progressive_lock_booking_slots_v1`
  acquired row locks and rejected 2026-07-22 17:00-19:00 because configured
  capacity was `6`, active occupancy was already `6`, and the new learner would
  make `7`. The other selected slots were 2026-07-20 `5/6`, 2026-07-21 `4/6`, and
  2026-07-23 `1/6`.
- All counted occupants were other users' active verified Legacy bookings with
  scheduled sessions. The current user's four-session Legacy baseline was not
  treated as physical occupancy. No duplicate learner was counted. The one
  reschedule descendant on 2026-07-21 was counted once while its 2026-07-20
  `rescheduled` predecessor was excluded. Walleted, cancelled, expired-pending,
  makeup, and Progressive rows contributed zero. The restored draft's four
  template ids matched the current active templates and resolved to the current
  slots; the full slot predated the incident.
- Step 4 availability and atomic create use different read models. Step 4 exposes
  recurring template dates and does not query authoritative slot occupancy. The
  RPC counts active `booking_sessions` under locks. `schedule_slots.current_students`
  was stale at `0` for all four slots, but the client did not read that cache and
  the RPC correctly counted live booking/session rows instead. This is a stale-
  availability UX defect, not an incorrect capacity calculation.
- Bounded Vercel logs found three unique preview `200` requests and two unique
  create `409` requests at 09:27:48.849 and 09:30:45.172 Asia/Bangkok. Every event
  was served by the current Production deployment. There were no 5xx or payment/
  slip paths. The available Vercel events had no response body, selected-slot id,
  or trace id; the screenshot supplied the typed error. The existing Chrome
  incident tab could not be attached through the approved Chrome bridge, so the
  original sanitized payload, response headers, and Session Storage record remain
  `Unknown / Need verification`; the create was not reproduced and the draft was
  not changed.
- Read-only database checks spanning both failed requests proved zero attributable
  creates or updates for bookings, booking sessions/snapshots, July pricing scope,
  mutation receipts, coupon reservations/usages, payment batches/members,
  verification attempts, allocations, Legacy payments, Ledger, wallet, attendance,
  notifications, Finance, and activity logs. There is no orphan scope, booking,
  session, receipt, notification, payment artifact, or partial capacity update.
- Customer impact: Progressive Kids Group customers with settled Legacy history can
  see a lower Legacy-derived total on Step 4 and the correct Progressive total on
  Step 5. A customer may also select a slot that the atomic RPC later rejects as
  full. Financial impact from the observed requests is **none**: no booking or
  payment was created, and the server remained authoritative.
- Immediate Entry rollback is **not recommended** from the current evidence. It
  would route new Kids Group traffic back to the Owner-rejected Legacy pricing
  formula while the authoritative Progressive price and capacity guard are
  protecting writes. The smallest later source boundary is to make Step 4 consume
  the same authoritative Kids Group preview as Step 5 and expose authoritative
  occupancy/preflight before confirmation while retaining the RPC as final guard.
  Any source/test work, deploy, or Entry decision requires new Owner approval.
- Source changed: **no**. Tests changed: **no**. Deployment/environment/Entry:
  **unchanged**. Production business data changed by this audit: **no**. Homepage
  LV work is paused again behind this active blocker.

### Progressive Summary Fix and Successful Option A Activation (2026-07-13)

- Git preflight started from branch `spike/next-major-security-upgrade` at matching
  local/remote HEAD `817794a4aaefe885aa46f30f4765e7e8a20902e4`; core Option A
  source `f8568a6` was an ancestor. The only dirty file was the unrelated unstaged
  `AGENTS.md` remainder (`72` additions / `3` deletions), which stayed excluded.
- Root cause was localized to `src/components/dashboard/booking-client.tsx`: the
  component kept only price/revision fields from the authoritative preview and
  unconditionally rendered the Legacy monthly true-up explanation for Kids Group.
  The server price was already correct; only customer-facing explanation was wrong.
- Source commit `aa64adfb765139ca38908ca2409fa2127ffe4a29` changes only the
  booking component and `scripts/check-progressive-booking-entry.js`. The component
  now preserves the discriminated preview contract and renders Progressive-only
  booking-level evidence when `mode === 'progressive'`; Legacy, Adult Group,
  Private, coupon, and zero-price semantics remain unchanged. The commit was pushed
  to `origin/spike/next-major-security-upgrade`.
- Deterministic/source verification passed: booking entry `31`, Option A baseline
  `32`, Progressive pricing `17`, transactions `33`, coupon `38`, Legacy pricing/
  payment `14`, TypeScript, lint, mojibake `225`, build `90` routes, and
  `git diff --check`. Post-build cleanup/restart returned home/static assets `200`
  and unauthenticated preview `401`; no local Next error overlay was observed.
- Corrected Entry-absent deployment `dpl_GyGnKWq49mTU6NYNavWRVYLwmo3P` reached
  Ready on all four aliases from exact clean `aa64adf`. Authenticated Entry-off UAT
  preserved the exact Legacy explanation/result: previous `4` / `2,500`, new `4`,
  cumulative `8`, rate `500`, target `4,000`, deduction `2,500`, charge `1,500`.
- Activation added only `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`. Final deployment
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS` reached Ready on all four aliases from the
  same exact clean source. A forced rebuild was required after ordinary unchanged-
  source deployments reused the Entry-off build cache; Entry readback was exact
  `true` before the forced build.
- Authenticated no-write UAT confirmed July eligible Legacy history `2+2=4`,
  preserved historical amounts `1,250+1,250=2,500`, cancelled rows excluded,
  previous Progressive `0`, selected new sessions `4`, and no coupon. The
  authoritative and visible Progressive result was baseline `4`, previous
  Progressive `0`, new `4`, cumulative `8`, rate `500`, gross `2,000`, discount
  `0`, final `2,000`.
- The customer Summary visibly showed
  `คำนวณราคา Progressive สำหรับการจองครั้งนี้`, the separate baseline/previous/
  new/cumulative/rate fields, `ราคาการจองใหม่: 4 × 500 = 2,000 บาท`, and
  `ยอดชำระเดิมเป็นประวัติของรายการเดิม และไม่ถูกนำมาหักจากราคาการจองครั้งนี้`.
  Legacy target-total, prior-payment deduction, and credit-difference wording were
  absent. Historical `2,500` did not participate in or appear as a deduction.
- Adult Group and Private remain Legacy under the unchanged server decision and
  passing deterministic route checks. Unauthenticated preview returned `401`;
  User History, the approved Progressive batch, and all four database capabilities
  remained readable/Ready. Both existing scopes remained unlocked.
- Protected pre/post counts and SHA-256 fingerprints matched exactly for all
  checkpoint tables/records: bookings `519`, sessions `2,785`, scopes `2`, virtual
  snapshots `519`, receipts `3`, coupon reservations/usages `0/0`, batches/members
  `4/4`, attempts/allocations `1/1`, payments `470`, Ledger `471`, wallet `60`,
  attendance `1,622`, notifications `16,147`, tiers `11`, Finance expenses `1`,
  existing Progressive bookings `2`, approved batches `1`, and the repaired booking.
  UAT-attributable business-data delta is `0`.
- Final activation logs sampled `28` requests: error `0`, 5xx `0`, baseline fault
  `0`, dependency fault `0`, SlipOK `0`, booking-create POST `0`, and successful
  preview `1`. Browser console warnings/errors and hydration errors were `0`.
- Rollback was not used after the successful final activation. At that historical
  checkpoint, corrected Entry-off deployment
  `dpl_GyGnKWq49mTU6NYNavWRVYLwmo3P` was the rollback target; it is not an automatic
  rollback target for the current committed-but-undeployed Unlimited Slot Entry
  release candidate. No
  Booking/Payment/business row, Legacy row, pricing tier, coupon policy, wallet,
  attendance, Ledger, Finance, Adult Group, or Private data changed.
- Historical closeout classification recorded on 2026-07-13 and superseded by
  the 2026-07-14 Production Booking Regression audit:
  **PASS — PROGRESSIVE SUMMARY FIXED; OPTION A ENTRY ACTIVE; PRODUCTION 4+4=2,000 UAT PASSED; PRICING RECONCILIATION DONE**.
  Source complete, tests passed, committed, pushed, migration applied, deployed,
  enabled, Production active, Production UAT passed, and Task Done are **yes**.
  Data repaired this round is **no**. The next documented task is the unstarted
  Homepage LV copy audit/fix.

### Final Option A Activation Attempt and Rollback (2026-07-13)

- Git preflight started from branch `spike/next-major-security-upgrade` at matching
  local/remote HEAD `9ecc6181c093e23fb2b75e30c6ed1b9332051b06` with only the
  unrelated unstaged `AGENTS.md` remainder (`72` additions / `3` deletions).
  Functional source `f8568a6` is an ancestor, and the deployed clean commit
  `d4574a7` has an identical functional tree.
- Production started at Ready deployment `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE` on
  all four aliases. Migration `20260713210000` was applied exactly once;
  pricing-write capability was Ready/version `2`/`immutable_scope_v1`; payment
  capabilities remained Ready/version `1`; both existing Progressive scopes were
  unlocked and had authoritative eligible Legacy baseline `0`.
- The Production environment changed from `10` to `11` names by adding only
  Sensitive `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`. The allowlist stayed absent;
  four Progressive dependencies and shared `SLIPOK_TEST_MODE` stayed unchanged.
  A clean detached worktree at exact `d4574a7` produced Ready activation deployment
  `dpl_Hqz23xUgUXYSH1FtoVZUXSgS2Bqh` on all four aliases.
- Authenticated read-only evidence confirmed one `user`, the existing owned child,
  and July active Legacy history `2+2=4` sessions / `1,250+1,250=2,500`; cancelled
  bookings were excluded and no matching July Progressive booking existed.
  The browser-local no-coupon draft selected exactly four active template-backed
  July sessions and did not call booking create.
- The authoritative Entry-on preview selected Progressive and produced Legacy
  baseline `4`, previous Progressive active sessions `0`, new sessions `4`,
  cumulative `8`, rate `500`, coupon discount `0`, and gross/final `2,000`.
  However, the same customer summary also rendered stale Legacy true-up text:
  `ยอดรวมตามเรทใหม่: 8 × ฿500 = ฿4,000`, `หักยอดที่จ่ายแล้ว: ฿2,500`, and
  `ยอดที่ต้องชำระเพิ่ม: ฿2,000`. That incorrectly tells the customer the historical
  Legacy `2,500` was deducted, so mandatory pass condition 12 failed even though
  the server-authoritative Progressive price itself was correct.
- The immediate approved rollback removed only
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` (it was not replaced with `false`) and promoted
  known-good deployment `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE`. It is Ready on all
  four aliases; the final environment is back to the original `10` names with Entry
  and allowlist absent. Kids Group again returns Entry-off Legacy `1,500`;
  Adult/Private remain Legacy; unauthenticated booking preview returns `401`; User
  History and existing Progressive records remain readable/drain-capable.
- Protected pre/post counts and fingerprints matched for bookings `519`, booking
  sessions `2,785`, scopes `2`, pricing snapshots `519`, mutation receipts `3`,
  coupon reservations/usages `0/0`, payment batches/members `4/4`, attempts `1`,
  allocations `1`, legacy payments `470`, Ledger rows `471`, wallet credits `60`,
  attendance `1,622`, pricing tiers `11`, Finance expenses `1`, both existing
  Progressive bookings, the documented UAT booking/batch, and repaired booking
  `d6dad7aa...`. Notifications changed `16,144 -> 16,147`; the three exact rows
  were timestamp-correlated real coach-assignment notifications, not UAT writes.
  Activation/UAT-attributable business-data delta is `0`.
- Bounded activation-deployment and restored-deployment monitoring found error `0`,
  5xx `0`, baseline/dependency conflict `0`, and SlipOK activity `0`; browser errors,
  hydration errors, and a Next error overlay were absent. Customer and financial
  impact from the attempted activation is `0`; rollback was used.
- Current classification:
  **BLOCKER — OPTION A ACTIVATION UAT FAILED; ENTRY ROLLED BACK TO ABSENT**.
  Core Option A source/migration remain complete and deployed, but activation-ready
  customer summary source is not complete. Next work requires separate Owner
  approval to correct the Progressive-only summary copy and tests, followed by a
  separately approved activation/UAT retry. Pricing reconciliation stays blocked.

### Option A Compatibility Audit

- Read-only source and Production audit completed on 2026-07-13. No source,
  migration, environment, deployment, browser draft, or Production data changed.
- Root incompatibility exists in both layers, not preview alone:
  `src/lib/progressive-booking-preview.ts` rejects any active booking whose scope is
  not the current Progressive scope, and
  `progressive_assert_scope_membership_v1()` repeats that rejection inside the
  atomic create/edit/cancel path. `progressive_reprice_scope_v1()` then starts its
  cumulative count at zero and reads only scope-owned Progressive bookings.
- Canonical Legacy entitlement source is `bookings.total_sessions` for active
  Legacy rows in the same user/course/month period. All `423` active Legacy Kids
  Group bookings lacked `entitlement_sessions`, but every booking's
  `total_sessions` matched its original/root session-row count. Raw session-row
  counting would overcount `87` rescheduled bookings; `25` active Legacy bookings
  also have wallet dependencies. No active Legacy root session was outside its
  booking month. Legacy monetary fields are not read for the baseline.
- Production query scope was all `459` Kids Group bookings and `2,647` related
  session rows across all recorded periods. Active means `verified`, `paid`, or
  non-expired `pending_payment`; cancelled and expired pending rows are excluded.
  Results by user/month period: `373` active Legacy-only, `1` Progressive-only,
  `0` mixed, `23` active-Legacy-plus-cancelled-Legacy, `0`
  active-Legacy-plus-pending-Progressive, `68` multiple-child, `96` with wallet or
  reschedule history, `0` coupon-affected, and `0` existing-scope periods with
  unmatched active Legacy rows. The `423` active Legacy bookings comprise `419`
  verified and `4` pending-payment bookings, all child learner bookings, totaling
  `2,416` entitlement sessions.
- Current/future July-August exposure is `185` Legacy-only user/month periods,
  `219` active Legacy bookings, and `1,283` entitlement sessions; there is also one
  separate Progressive-only period. This is the potential compatibility population,
  not a repair list and not evidence that every period will create another booking.
- The smallest safe implementation is a TypeScript preview/read-model change plus
  an additive migration that records an immutable Legacy entitlement baseline on
  the Progressive scope and replaces the membership/repricing/create functions.
  Source-only removal of the guard is insufficient because the current atomic RPC
  would still reject the write and the current repricer would still start at zero.
  No Legacy booking backfill or Production business-data repair is required. A
  fresh pre-deploy audit must confirm the two existing Progressive scopes still
  have no unmatched active Legacy rows before their zero baseline is accepted.
- The existing advisory scope lock, expected revision, and mutation receipt remain
  the concurrency/idempotency boundary. Preview reports the current scope revision;
  create acquires the user/course/month lock, captures the Legacy baseline exactly
  once when the scope is first initialized, rejects a stale revision, and prices
  Progressive bookings from that baseline in `created_at`, then booking-id order.
  Coupon, payment-batch membership/drain, Finance/Ledger, edit/cancel stored-scope
  routing, and Entry-off rollback behavior remain unchanged.
- Exact preserved draft result: Legacy history `4` sessions / `2,500`, new `4`,
  cumulative `8`, rate `500`, Progressive gross/final without coupon `2,000`.
  The Legacy `2,500` remains historical evidence and is never deducted. The
  browser-local confirmation remains untouched.
- Audit classification, superseded by the accepted Gate 0A continuation:
  **OWNER APPROVAL ACCEPTED — OPTION A SOURCE IMPLEMENTATION AUTHORIZED**.
- Documentation audit commit
  `b0cab81014a2dde2e245fd4e156a98b1048f1dfc` is committed and pushed to
  `origin/spike/next-major-security-upgrade`. Source remains unchanged.
- Owner approved the audited TypeScript plus additive-migration implementation
  scope on 2026-07-13. Gate 0 stopped before source implementation because the
  previously recorded full audit-commit hash above did not exist in Git. Fresh
  fetch proved local and remote HEAD both at `e61d612118b57fb36137e4bb2306715feee5f43f`,
  whose direct parent is the corrected audit commit. No source, migration,
  Production, deploy, Entry, allowlist, customer, or financial state changed.
- The Owner subsequently accepted corrected audit commit
  `b0cab81014a2dde2e245fd4e156a98b1048f1dfc` and documentation correction commit
  `21e32c7c5ee3254b981f8dabf19f515c6c77e8eb`, and explicitly authorized Gate 1
  source implementation to resume. Migration application, deploy, Entry activation,
  and Production business-data changes remain unapproved.
- Option A source implementation completed and pushed in
  `f8568a6d9c18da3745492d47c01d3ca22da156c8`. Additive migration source
  `20260713210000_add_progressive_legacy_baseline_compatibility.sql` adds only three
  nullable scope fields (`legacy_baseline_sessions`, fingerprint, initialized-at),
  a constraint/immutability trigger, one authoritative Legacy baseline helper, and
  compatible replacements for scope acquire/membership/repricing/create/capability.
  It contains no Legacy booking, Payment, Ledger, Finance, coupon, wallet, or
  accounting DML and adds no Legacy monetary baseline field.
- `progressive_legacy_baseline_v1()` selects only null-scope Kids Group rows in the
  exact user/course/year/month with `paid`, `verified`, or non-expired
  `pending_payment` status. It sums `bookings.total_sessions`; raw session,
  reschedule, wallet, stored-price, paid-amount, and accounting fields do not enter
  the calculation. The SHA-256 fingerprint is built from the booking-id-sorted
  complete eligible set and detects membership, eligibility/status/expiry, and
  entitlement changes.
- First scope acquisition initializes the count/fingerprint once under the existing
  advisory lock. Initialized scopes compare the current fingerprint and fail with
  `PROGRESSIVE_LEGACY_BASELINE_DRIFT`; pre-compatibility scopes may initialize to
  zero only when the eligible Legacy set is empty. Create additionally compares the
  previewed count/fingerprint, fingerprints them into mutation idempotency, and
  fails stale baseline input with `PROGRESSIVE_LEGACY_BASELINE_CONFLICT`.
- Preview now separates `legacyBaselineSessions`,
  `previousProgressiveActiveSessions`, and `newBookingSessions`, while preserving
  cumulative-after, rate, gross, coupon/final, source/mode, scope, and revision.
  Repricing begins at the stored Legacy session baseline and iterates active
  scope-owned Progressive bookings only in `created_at`, then booking-id order.
  Legacy rows remain outside membership and are never written or snapshotted.
- Disposable Supabase `db reset` applied the complete local migration chain through
  `20260713210000`. A rollback-only runtime fixture proved Legacy-only/mixed and
  Progressive-only scopes, multi-child `2+2`, cancelled/expired exclusion,
  reschedule/wallet invariance, exact `4+4 = 2,000`, coupon-after-gross, mutation
  replay/conflict, stale/no-partial-write, edit/cancel, immutable drift, safe
  pre-compat zero initialization, and prepare/cancel payment drain. A separate real
  two-connection race produced exactly one first booking/scope/receipt and one typed
  stale-revision loser. Fixtures rolled back or were deleted; the local stack was
  stopped without backup.
- Migration applied remotely: **yes**, exactly `20260713210000`. Deploy performed:
  **yes**, exact Option A functional source with Entry absent. Production-active
  Option A behavior remains **no** because Entry is not enabled. No migration- or
  deploy-attributable business row changed; customer and financial impact are
  **none**. Entry activation and authoritative no-write `4+4 = 2,000` Production
  UAT require the next separate Owner approval.

### Pricing Reconciliation Status

**PASS — OPTION A MIGRATION APPLIED AND ENTRY-ABSENT SOURCE DEPLOYED; ACTIVATION UAT PENDING**

- Owner policy, Progressive formula, pushed source, and the approved one-row repair
  agree. The earlier scoped `PASS` covered source readiness and that data repair,
  not the incomplete Production rollout.
- Fresh audit found `373` Legacy-only, `1` Progressive-only, and `0` mixed active
  Kids Group periods; both existing Progressive scopes had eligible Legacy baseline
  `0`. Current/future exposure is `185` Legacy-only plus `1` Progressive-only period,
  with `219` active Legacy bookings and `1,283` entitlement sessions.
- Pre/post migration protected fingerprints were identical across all `21`
  checkpoints. Final counts remained equal for Booking, sessions, scopes,
  snapshots, receipts, Payment/batches/allocations, coupon, wallet, pricing tiers,
  Ledger, and Finance. Five attendance rows and one coach reminder appeared after
  the baseline from real coach operations and were timestamp-correlated as
  unrelated to migration/deploy; attributable business-data delta is `0`.
- Entry-off smoke returned home `200`, generated assets from the new deployment,
  unauthenticated preview `401`, preserved Kids draft Legacy `1,500`, readable User
  History/approved Progressive booking, and zero browser warnings. Bounded error,
  5xx, and SlipOK searches returned no rows. Existing stored-scope payment drain
  remains capability-ready; no Booking, Payment, edit, cancel, or batch action ran.
- Data repaired: **yes**, exactly one unpaid booking. Source/deploy/activation state
  did not change during the repair.
- `DOCUMENTATION DRIFT` was found: the previous snapshot said `56daabf` was not
  deployed and current Vercel state was unknown. Read-only CLI verification proves
  it is deployed, while enabled/allowlisted/Production-active states remain false.
- UAT payment continuation completed for the same booking only. Original batch
  `eb5a1c73-fceb-4fd1-b6e6-414fc3fe1410` expired normally and was lazily cancelled
  with reason `prepared_expired`; replacement batch
  `d65dc3b8-5a48-4b4a-bea5-b64f2a1133ac` is the one effective approved batch.
- Booking `89533cdf-76cf-4ee5-bb66-ce7bf7bbf5fe` is now `verified`, still `700`,
  with unchanged scope `f4acca6c-86b9-44da-88cc-86d8222f28c3`, complete sequence
  `1` / cumulative `0 -> 1` / rate-gross-final `700` snapshots, and scheduled
  session `34ad024d-59f3-409d-b431-36e2765f9737`.
- Test-mode attempt `7da5e1dd-1c5d-436a-8c62-a1f06b67d51c` resolved `approved`
  for `700`; allocation `7ec8d0e1-a3fa-4e27-9c6e-5e6779c50e9d` and the single
  Progressive ledger row both allocate `700`. No legacy `payments` row, duplicate
  allocation/ledger source, coupon reservation/usage, or orphan scope lock exists.
- Finance read-model reconciliation is cash received `+700`, booking net value
  `700`, allocation total `700`, and one distinct Progressive batch transaction;
  the batch header is not counted separately. User History shows one successful
  booking card and no stale upload state. User notification
  `e62d9e2f-f49f-49f1-a138-9ee427655d14` exists exactly once.
- Historical payment evidence before the notification correction showed only the
  user notification; the two other notifications in that earlier audit window were
  unrelated coach attendance reminders. That dated finding caused the source fix.
  It does not describe the current deployed function: migration `20260713153000`
  and source `60688a3` are now deployed and add future-event-only staff copies.
- Root cause is corrected and deployed from source commit `60688a3`. Migration
  `20260713153000` keeps
  notification creation after the first successful approval transition and before
  commit, selects only `admin`/`super_admin` profiles, and returns on an approved
  replay before notification inserts. Route-level notification was rejected because
  it would sit outside the atomic approval transaction and the existing helper's
  check-then-insert behavior is race-prone. Standard Admin copy contains no amount;
  Super Admin receives the same amount-free copy, so no visibility policy expands.
- Final activation-round classification:
  **BLOCKER — ENTRY DISABLED; PROGRESSIVE ACTIVATION ROLLED BACK SAFELY**.
  Entry-on deployment `dpl_HBTap8Rv72uDN1NFHSg3CyR6GqZp` reached Ready on the
  exact source and all aliases. Adult Group and Private authenticated previews
  returned normally and remained Legacy by the server-only routing contract;
  unauthenticated preview returned `401`. The available Standard Admin identity
  had no child learner, so it could not reach a Kids Group preview without a
  prohibited data write. The originally observed User/Parent `4 + 4` draft was not
  available, so Progressive routing and the exact `1,500 -> 2,000` result were not
  runtime-proven. The Chrome identity later changed externally to Super Admin,
  further proving that the browser context was not a stable substitute for the
  required Owner-controlled User/Parent context.
- The approved primary rollback set Entry to `false` and redeployed the same clean
  source as `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G`; all four aliases point to it and
  it is Ready. The four dependency controls remain `true`, allowlist remains absent,
  and shared `SLIPOK_TEST_MODE=true` remains unchanged. No old-source rollback was
  performed.
- Activation baseline and final counts were identical for bookings `519`, scopes
  `2`, batches `4`, attempts `1`, allocations `1`, legacy payments `469`, ledger
  rows `470`, and coupon reservations/usages `0`. Booking status/course/source-scope
  distribution was unchanged. Pricing tiers remained `11` with fingerprint
  `5c665704b2f0adffd67d9c7ec3a337db`; protected fingerprints remained UAT booking
  `b3ace1823603773273d19783fecfa9f4`, effective batch
  `dbcdcb47fde7f6b59d0244bf90b6b7f6`, and repaired booking
  `e99a8144b0c0af731aad4d4ae3c81025`.
- Notifications changed `16032 -> 16034` only because real operational coach
  assignment activity by other users created rows
  `8f8cae4d-5ea2-4c6c-95d3-11da26a3e0bb` and
  `142ae692-96ac-4dfe-a7dd-abea07b3b79d`; their timestamps correlate to
  `save_coach_assignment_groups` activity-log rows. They are not UAT-created and
  were not modified. Activation/redeploy/preview attributable business-data delta
  was `0`.
- Bounded logs sampled `100` requests from the activation deployment and `100`
  from the rollback deployment: error-level events `0`, 5xx `0`, typed dependency
  503 responses `0`, and SlipOK activity `0`. The activation deployment recorded
  two authenticated preview `200` responses (Adult and Private) plus the expected
  unauthenticated `401`. Browser console errors/warnings and observed hydration
  errors were `0`.
- Customer and financial impact from this round: none. No Booking, Payment, pricing
  scope, batch, attempt, allocation, ledger, coupon, wallet, attendance, entitlement,
  Finance, notification, refund, payroll, or accounting write was performed by the
  UAT. Task Done: **no**. The identity/draft blocker from that activation attempt is
  resolved by the User/Parent follow-up below. Option A now resolves the business
  decision; the audited source plus additive-migration implementation still prevents
  an activation retry until separately approved, built, and verified.
- User/Parent safe-draft follow-up passed on the current rollback deployment. The
  uniquely matched authenticated profile is
  `e8a4b5c9-880d-4a43-b693-96cb0ce26316`, role `user`, with one existing owned
  child. No profile, role, account, or child row was created or changed.
- July deterministic active order is verified booking
  `9634dca8-d3ce-4922-aaa4-f743edf3dd86` (`2` sessions, `1,250`) followed by
  `db5c80c2-5b5d-42c2-b569-7be643a9da6c` (`2` sessions, `1,250`), ordered by
  `created_at`, then booking id. Both are `verified`; total active and settled
  history is `4` sessions / `2,500`. Two later cancelled four-session bookings do
  not contribute.
- No usable restored draft appeared in the booking UI. A new browser-local draft
  selected the existing child, Chaengwattana, and four valid template-backed future
  sessions: July `17` 10:00-12:00, `18` 09:00-11:00, `19` 09:00-11:00, and `20`
  10:00-12:00. Coupon input remained empty. The summary reached exactly `4 + 4 = 8`
  at the authoritative `7-10` tier rate `500` and showed the correct Entry-off
  Legacy calculation `8 * 500 - 2,500 = 1,500`. The booking confirmation button
  was not clicked; the unconfirmed summary tab remains available for handoff.
- Owner-policy Progressive arithmetic for the same sequence is `4 * 500 = 2,000`,
  with no prior-payment deduction. However, this is not currently a safe Entry-on
  runtime expectation for this account: both active bookings have
  `pricing_scope_id=null`, `entitlement_sessions=null`, and the matching July
  `booking_pricing_scopes` count is `0`. Source inspection proves
  `previewProgressiveKidsGroupBooking()` will return
  `PROGRESSIVE_LEGACY_SCOPE_NOT_READY` before pricing rather than `2,000`.
  Activation must not be retried until the Owner separately decides and approves
  the compatibility policy/source scope for active Legacy bookings. No source fix,
  migration, or data repair was performed in this round.
- Before/after counts were identical: bookings `519`, booking sessions `2782`,
  scopes `2`, batches `4`, attempts `1`, allocations `1`, payments `470`, ledger
  rows `471`, coupon reservations/usages `0`, and notifications `16088`. Profile,
  child, User booking, and User session fingerprints were unchanged. One unique
  authenticated `POST /api/bookings/preview` returned `200`; booking write requests,
  sampled error events, and sampled 5xx responses were `0`. Browser console errors,
  warnings, and observed React/hydration errors were `0`.
- Scoped result:
  **PASS — USER/PARENT SAFE 4+4 DRAFT VERIFIED**. Overall activation remains
  blocked by the proved Legacy-active-scope guard; Entry stays configured `false`,
  Production remains Legacy for general Kids Group, and customer/financial impact
  from this read-only round is `0`.
- Fresh Standard Admin read-only UAT on 2026-07-13 proved the authenticated visible
  profile is uniquely role `admin`, not `super_admin`, without creating, changing,
  or repurposing an account. `/admin` loaded without aggregate revenue or Finance
  totals. `/admin/payments` showed target batch `d65dc3b8...` exactly once with
  approved status and permitted operational context; no structured payment amount,
  Progressive total, booking total, allocation amount, approved/incomplete total,
  aggregate revenue, or Finance field was rendered or present in the technically
  inspectable server payload. The known `700` was not exposed as a structured value.
- `/admin/notifications` loaded the recipient-specific Standard Admin inbox with no
  Super Admin financial summary. No historical Progressive staff notification was
  present, as expected because the migration performs no backfill. Existing dated
  Legacy/booking notification messages can contain operational free-text amounts;
  these are historical message strings under the existing contract, not structured
  Progressive amount fields. The deployed future Progressive staff copy remains
  amount-free and links to `/admin/payments` for both `admin` and `super_admin`.
- Direct Standard Admin requests to `/admin/finance` and `/admin/settings` redirected
  to `/admin` and exposed no restricted content. Browser console errors/warnings,
  React/hydration errors, and observed network 5xx were `0`. Bounded Vercel logs for
  the UAT window sampled `100` requests from deployment `dpl_3tW1GQdx...`: error
  level `0`, 5xx `0`; `/admin`, `/admin/payments`, and `/admin/notifications`
  returned `200`, while `/admin/settings` returned the expected `307` guard.
- No user navigation or click opened `/admin/coupons`. Vercel logs did show automatic
  Next.js background prefetch requests for that menu route. Read-only follow-up
  proved both current coupons have no expiry or usage cap, have zero usages, and
  produce zero render-time auto-close candidates, so the prefetch could not execute
  the page's guarded `is_active = false` update; coupon data remained unchanged.
- This read-only UAT's before/after counts were identical: bookings `519`, scopes
  `2`, batches `4`, attempts `1`, allocations `1`, legacy payments `469`, ledger
  rows `470`, coupon reservations/usages `0`, and notifications `15978`. Protected
  row fingerprints were unchanged: UAT booking
  `b3ace1823603773273d19783fecfa9f4`, effective batch
  `dbcdcb47fde7f6b59d0244bf90b6b7f6`, and repaired booking
  `e99a8144b0c0af731aad4d4ae3c81025`. The batch remains `approved`; no future staff
  copy was backfilled. No Production row or control changed.
- Before/after counts attributable to this continuation: bookings `514 -> 514`,
  scopes `2 -> 2`, batches `3 -> 4`, attempts `0 -> 1`, allocations `0 -> 1`,
  legacy payments `465 -> 465`, coupon reservations/usages `0 -> 0`, ledger rows
  `465 -> 466`, and notifications `15889 -> 15892`. Of the three new notifications,
  one is the UAT user payment notification and two are unrelated coach reminders.
- Existing repaired booking `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40` remains
  `pending_payment`, `625`. No additional repair or second UAT booking occurred.

### 2026-07-12 Read-Only Unpaid Kids Group Audit

- Exact scope: all `454` Production Kids Group bookings across 2026-05 through
  2026-08; status counts were `415 verified`, `33 cancelled`, and
  `6 pending_payment`. Dependencies checked for every pending candidate:
  `payments`, `coupon_usages`, `progressive_coupon_reservations`,
  `lesson_wallet_credits`, `booking_sessions`, `attendance`, Progressive payment
  batch links/allocations, `payment_ledger_allocations_v1`, and `pricing_tiers`.
- All six candidates are genuinely unpaid: zero payment/ledger evidence, coupons,
  wallet rows, attendance, batch links, or allocations. Their booking sessions are
  still `scheduled`. Legacy rows have no Progressive pricing snapshots, so expected
  amounts were reconstructed from current authoritative Production `pricing_tiers`
  and active ordering by `created_at`, then booking id.

| Booking | Period/order | Sessions | Legacy | Progressive | Difference | Dependency result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `e63fd262-fa64-4d8c-96ae-e0ff979a29e3` | 2026-06, #1 | 4 | `2,500` | `2,500` | `0` | 4 scheduled sessions; all checked dependencies `0` |
| `fbdf5523-0cb6-4a4f-985d-f5c5cea4abd7` | 2026-06, #1 | 7 | `3,500` | `3,500` | `0` | 7 scheduled sessions; all checked dependencies `0` |
| `4b0813ef-f386-4e6f-9b8d-1b11f861ec5c` | 2026-07, #1 | 2 | `1,250` | `1,250` | `0` | 2 scheduled sessions; all checked dependencies `0` |
| `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40` | 2026-07, #2 after one verified session | 1 | `550` | `625` | Repaired `+75` on 2026-07-13 | 1 scheduled session; all checked dependencies `0` |
| `9634dca8-d3ce-4922-aaa4-f743edf3dd86` | 2026-07, #1 | 2 | `1,250` | `1,250` | `0` | 2 scheduled sessions; all checked dependencies `0` |
| `6be6b3cf-f072-4e65-8a27-2656fcfd3390` | 2026-07, #1 | 6 | `3,750` | `3,750` | `0` | 6 scheduled sessions; all checked dependencies `0` |

- Original candidate totals were Legacy `12,800` versus Progressive `12,875`.
  After the one-row repair, all six audited unpaid candidates match Progressive;
  current stored total is `12,875`.
- Excluded: all `415` verified Kids Group bookings have direct `approved` payment
  rows and are out of scope. There are no Kids Group bookings in `paid` status.
  The `33 cancelled` rows are inactive and also excluded. Approved payments were
  not reopened or repriced.
- The previously proposed deploy scope was performed under later Owner approval;
  current rollout state and the safe Entry rollback are recorded above.
- Completed data repair: exactly `d6dad7aa...` changed from `550` to `625`; status
  and sessions were preserved. Activity log
  `98359d52-4da1-4ef2-bc75-a9b3a29db830` records the Owner approval, formula,
  dependency audit, deployed/source state, and no-deploy/no-activation result.
- Post-write verification found payments, coupon usage/reservations, wallet,
  attendance, Progressive batches/allocations, finance ledger, and refund/credit/
  accounting dependencies still `0`. The other five unpaid candidates, all paid/
  verified bookings, and pricing tiers were fingerprint-unchanged.
- Customer impact: the unpaid amount due increased by `75`; no cash was received or
  refunded. Financial impact: booking receivable/net value increased by `75`, while
  payment ledger/cash/accounting allocations remain unchanged.
- Recorded rollback, not executed: `625 -> 550` only if no later payment, coupon,
  wallet, attendance, refund, credit, entitlement, or accounting dependency exists.

### Production Repair History

All rows below are **historical data-repair records**, not proof of current booking
status. Each repair used the then-active **Legacy settled-history monthly true-up**,
not Progressive booking-level pricing.

| Booking | Old -> repaired | Historical state/dependencies | Progressive-policy impact |
| --- | ---: | --- | --- |
| `ff0728dd-066a-417a-aeaa-0049fed6b931` | `3,248 -> 2,496` | `pending_payment`; no payment/coupon rows; sessions unchanged | For the documented second `8` in an `8+8` sequence, Progressive would charge `3,248`; the Legacy repair is `752` lower. |
| `5d1d9a43-afcd-4d26-8817-68ab948443f2` | `2,800 -> 1,169` | July repair; payment evidence preserved; no payment/refund/coupon row created; sessions unchanged | `Unknown / Need verification` without the original ordered entitlement/pricing snapshots. |
| `3f95767e-8418-4b0b-b87d-2cd18811825b` | `14,700 -> 13,600` | Same repair constraints as above | `Unknown / Need verification`. |
| `f565a552-65f3-44e0-8826-22a4c9cb0dbb` | `1,299 -> 763` | Same repair constraints as above | `Unknown / Need verification`. |
| `ff9cf27f-6415-444d-90b6-89ab05fc2d47` | `2,000 -> 1,500` | Same repair constraints as above | `Unknown / Need verification`. |
| `9112a5cb-006c-4fdd-838d-5534c15b6fb1` | `0 -> 500` | `pending_payment`; payments/coupons/wallet/attendance `0`; sessions unchanged | Documented `8 + 1` sequence is also `500` under current Progressive tiers; no formula difference for this case. |
| `60779d60-ac26-4eaf-a34f-703157a32300` | `196 -> 500` | Same dependency state as the preceding row | Same documented `8 + 1` result: `500`. |

- Current row statuses, later payments, coupon/wallet/accounting actions, and whether
  any rollback condition has since changed: `Unknown / Need verification`.
- Do not rewrite these rows again from documentation alone. Any future repair needs
  a read-only exact-row report, the explicitly selected formula, dependency impact,
  and separate Owner approval before Production write.

### Operational Snapshot

Observed scripts:

- `npm run dev`: Next dev with webpack.
- `npm run build`: Next build with webpack.
- `npm run lint`: ESLint against `src` with max warnings 0.
- `npm run check:mojibake`: Thai copy/mojibake guard.
- `npm run prod:check`: read-only production readiness checker.
- `npm run attendance:reconcile:dry-run`: attendance/session status drift report.
- `npm run attendance:reconcile:write`: repair tool. Requires owner confirmation before production write.

## Historical Records

The dated sections below preserve audit history. They are superseded for current
pricing/rollout status by **Current Source of Truth** above unless a section is
explicitly cited as the latest verified evidence. Historical `PASS` labels apply
only to their stated scope and date, not to the current policy-vs-Production result.

## 2026-07-12 - Progressive Normal Booking Entry (Kids Group Only)

- Final status: `PASS` for source integration and disposable local runtime. Source commit `56daabf30ad60c07b3c3ccb98fe42028e33de1be` was pushed to `spike/next-major-security-upgrade`. No deploy or Production UAT was performed.
- Normal Booking now uses a server-only decision: Entry flag off or user not allowlisted keeps every course on Legacy; allowlisted `kids_group` uses Progressive only when pricing-write, coupon-lifecycle, and payment-batch dependencies are ready; a missing dependency returns typed `503` with no Legacy fallback. Allowlisted `adult_group` and `private` remain Legacy and do not call Progressive pricing/write helpers.
- A read-only `/api/bookings/preview` path uses the Progressive kids calculator and current scope revision. Progressive create recomputes atomically in the existing RPC and returns authoritative booking id, total, pending status, scope id, revision, and source kind. Client mode/user/price fields are not authority.
- Progressive edit/cancel routing is selected only from DB `bookings.pricing_scope_id`. Existing Progressive bookings can still edit/cancel/drain when only the Entry flag is later disabled. Legacy edit/cancel remains unchanged.
- Create request UUIDs persist in the session draft. Existing mutation receipts restore the original expected revision for timeout/refresh retries; the RPC fingerprint rejects reuse of the same key with different input, and advisory/scope locks serialize concurrent duplicates.
- Disposable local Supabase runtime passed 9 scenarios: flags off Legacy; non-allowlisted Legacy; adult/private Legacy; Progressive create with scope/snapshots/sessions and no payment artifacts; edit; soft cancel; dependency fail-closed/no write; concurrent duplicate one-booking result; and History/payment-prepare eligibility. Local shadow audit found 2/2 active bookings `MATCH`, with 0 entitlement drift and 0 missing tiers. Containers were stopped afterward.
- Verification passed: booking entry 18, pricing 17, transactions 33, coupon 38, payment batches 39, payment integration 18, shared SlipOK mode 6, local shadow audit, TypeScript, ESLint, mojibake, production build, and `git diff --check`. Local attendance reconciliation reported 0 mismatches. `prod:check` was intentionally pointed at the empty disposable DB and therefore reported expected fixture blockers (no branches/templates/tiers/core buckets), not a Production readiness result.
- Post-build dev restart passed: home 200, generated `_next/static` CSS 200, unauthenticated booking preview 401, meaningful home HTML, and no Next error-overlay marker. Visual automation was unavailable because the agent-browser CLI/browser-control runtime was not installed.
- No migration was added/changed/applied remotely; no environment or feature flag changed; no Production/remote DB write/read, deploy, Production UAT, live SlipOK call, general-user enablement, Adult/Private pricing change, direct implementation SQL shortcut, or force push occurred.

## 2026-07-11 - Shared SlipOK Test Mode Corrective Production Release

- Final status: `PASS`. Corrective source commit `0fbf98fe7a03f71ecb61642ebb20458e4a6480de` was pushed and deployed as Production deployment `dpl_P5BQcazfbWjReuuLkGXkZpGoG1Gz`, Ready and aliased to `https://www.newathleteschool.com`.
- Current Owner-approved Production policy is global server-side `SLIPOK_TEST_MODE=true`, shared by Legacy and Progressive. Successful slip upload auto-approves/verifies through each flow, and the current Production policy makes no live SlipOK network call.
- The Progressive-only SlipOK Test Mode flag was removed. Client mode overrides are not accepted. Live verification must wait for a future Owner policy after branch-specific receiving accounts are designed.
- Progressive infrastructure remains preparation for future use. All Progressive feature flags and the UUID allowlist are unset; general users cannot enter the flow. The five remote Progressive migrations remain applied and capability RPC reports Ready.
- Corrective tests passed: pricing 17, transactions 33, coupon 38, payment batch 39, integration 18, shared SlipOK mode 6, pricing shadow, mojibake, TypeScript, ESLint, production build, production readiness, and attendance reconciliation with 0 mismatches.
- Production smoke passed: home/login/static 200, protected routes redirected to login, Legacy verification route loaded, and unauthenticated Progressive prepare failed closed with 403.
- Read-only before/after reconciliation was unchanged: profiles 309; children 291; bookings 503 (`cancelled` 38, `pending_payment` 8, `verified` 457); booking sessions 2736; payments 457 approved; approved cash 1,248,238. Progressive batches/attempts/allocations/locks/storage objects remained 0.
- Known Legacy booking `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40` remains `pending_payment` with `total_price = 550`; no booking repair, payment creation, slip upload, UAT, migration write, or live SlipOK call occurred.
- This section supersedes earlier readiness notes that described Production Test Mode as a warning or required live SlipOK mode; those older entries are historical records only.

## 2026-07-11 - Slice 4B Progressive Payment FAST-TRACK MVP

- Scope completed locally: additive integration migration, default-deny server controls/UUID allowlist, private progressive slip storage, 30-minute prepared TTL/lazy expiry, durable verification attempts, Test Mode result recovery, Parent History contiguous-prefix flow, Admin whole-batch review, Standard Admin amount omission, and progressive Finance/Notifications reads.
- Progressive user routes are separate from legacy `/api/verify-slip`: prepare, upload, submit, status, and cancel. The legacy verification route and `src/lib/slipok.ts` were not changed.
- Feature controls are server-only: `PROGRESSIVE_PAYMENT_ENTRY_ENABLED`, `PROGRESSIVE_PAYMENT_REVIEW_ENABLED`, and `PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS`. Existing pricing/coupon/batch flags are still required. Default or malformed values deny access. Entry and drain/review controls remain separate.
- Progressive slips use private bucket `progressive-payment-slips`, deterministic user/batch/SHA-256 paths, server-side JPEG/PNG/WebP magic-byte validation, a 5 MB limit, and five-minute signed URLs. Retention is centralized in `progressive_payment_retention_config`: approved 84 months, rejected/under-review 180 days, orphan policy 7 days; no scheduled deletion worker was added.
- Prepared batches expire after 30 minutes through lazy API expiry, become cancelled, release the pricing-scope lock, keep bookings `pending_payment`, and do not release coupon reservations.
- One durable verification attempt is allowed per batch. Test Mode performs no SlipOK network call, stores deterministic `TEST-{attemptId}` evidence, and uses the same atomic batch approval RPC as future live resolution. Resolved retries reuse the stored attempt/result.
- Admin Payments combines legacy rows and progressive batches. Progressive actions approve/reject the whole batch only. Standard Admin serializers omit amount/total-price fields; Super Admin receives batch/allocation amounts. Admin Notifications uses the same visibility rule and no longer exposes the legacy pending total to Standard Admin.
- Finance treats `cash_received` and `booking_net_value` separately. Progressive cash comes only from approved allocations and transaction count uses distinct progressive batch IDs; batch headers are not added to allocation totals.
- Full local migration chain compiled twice against disposable Supabase. Synthetic runtime transaction passed prepare, upload metadata, submit, resolved-attempt replay, atomic approval, under-review lock, Admin rejection, TTL expiry/unlock, private bucket checks, and ledger reconciliation (`1325` cash, one distinct batch), then rolled back. Local Supabase containers were stopped.
- Verification passed: TypeScript, ESLint, production build, mojibake guard, pricing 17, transactions 33, coupon 38, Slice 4B integration 18, and the local migration/runtime gates. Slice 4A payment-batch check was updated only to stop treating the newly authorized Admin/History integration files as forbidden; legacy verify-slip/SlipOK immutability remains enforced.
- Browser smoke passed for public content, no Next error overlay, home/static asset HTTP 200, and unauthenticated redirects for History, Admin Payments, and Finance. Authenticated allowlisted browser UAT remains pending because no confirmed local allowlisted identity was supplied; synthetic DB runtime covers the critical transaction path.
- No production DB write, remote migration, deploy, production environment/feature-flag change, live SlipOK call, booking repair, or hardcoded production user/booking exception was performed. Known legacy booking `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40` remains untouched.

## 2026-07-10 - Owner-Approved Kids Group Pricing Booking Repair

- Final classification: `PASS` for the production DB repair. Exact affected-booking UI verification remains `NEED REVIEW` because no authenticated session for the affected parent was available; this does not invalidate the DB repair.
- Repair completed at `2026-07-10 09:35 ICT` for exactly two owner-approved `kids_group` bookings:
  - `9112a5cb-006c-4fdd-838d-5534c15b6fb1`: `total_price` `0 -> 500`.
  - `60779d60-ac26-4eaf-a34f-703157a32300`: `total_price` `196 -> 500`.
- Pre-write checks passed for both rows: status was `pending_payment`, course was `kids_group`, each booking contained one session for child `1723ca34-71cf-4af5-a459-fcd1f0f4773d` at branch `aa77eba0-d05e-4539-9606-f55fe8a530ca` (แจ้งวัฒนะ), payment rows were 0, coupon usage rows were 0, lesson-wallet rows were 0, and attendance rows were 0. The original `updated_at` matched `created_at`, so no later manual correction was observed.
- Deployed source recalculation was confirmed against current production pricing data for each target: settled history was 8 sessions / `4000`, the target added 1 session, the 7-10 tier was `500` per session, target monthly total was `4500`, and corrected charge was `500`.
- The booking repair used one PostgREST PATCH filtered to the exact two IDs. It returned exactly 2 updated rows, so both booking price changes ran in one database transaction. Status stayed `pending_payment`; normal DB `updated_at` changed to `2026-07-10T02:35:12.033883+00:00`.
- Post-write verification passed: both exact IDs now have `total_price = 500`; the targeted read found no remaining `0` or `196` value; all other booking fields were unchanged; booking-session, payment, coupon-usage, lesson-wallet, attendance, profile, and child fingerprints were unchanged. Related counts stayed sessions 2, payments 0, coupon usages 0, wallet rows 0, and attendance rows 0.
- Activity log `5dc4dc45-8083-4033-86fc-d048150c3d34` was created with action `owner_pricing_booking_repair`. It records owner approval, both old/new amounts, source fix commit `1701a0474ae1fdcf742f6db4c3e3c8c26d39ec2b`, production deployment `dpl_2FKH4GbJ1wa3fSn4xnsxehW6pRdB`, preserved `pending_payment` status, and unchanged related-table scope.
- Production Admin read-only smoke passed on `/admin/logs`: the new activity-log row and full JSON details rendered for Super Admin with browser console warnings/errors 0. No upload, payment, booking submit, or admin write action was clicked. The affected parent's booking cards were not visually verified because that user session was unavailable.
- Exact rollback record, not executed: booking `9112a5cb-006c-4fdd-838d-5534c15b6fb1` `500 -> 0`; booking `60779d60-ac26-4eaf-a34f-703157a32300` `500 -> 196`.
- Local pre-write/write/post-write evidence is stored under ignored backup folder `backups/pricing-booking-repair-20260710T023354Z`.
- No source code, API, migration, deploy, payment/coupon/session/profile/child/wallet/attendance data, status, learner, parent, branch, schedule, course, month, or year was changed. Historical next task was Step 4.1 Homepage LV Copy Audit/Fix; **superseded by Current Source of Truth / Pricing Reconciliation**.

## 2026-07-10 - Kids Group Pricing Pending-Booking True-Up Fix

- Scope: urgent source fix for kids_group monthly pricing true-up only. No adult pricing rule, pricing tier row, DB schema, migration, SlipOK, coupon semantics, lesson wallet, reschedule, attendance, ranking/users/history/makeup, payment row, or existing booking repair was changed.
- Root cause: the booking flow counted active `pending_payment` bookings inside the kids_group monthly true-up as if they were already paid. This could subtract unpaid booking totals and undercharge future additions.
- Fix: kids_group monthly true-up now counts only settled booking statuses `paid` and `verified` for `existingSettledSessions` and `existingSettledTotal`. `pending_payment` bookings remain available for calendar/conflict display but are excluded from paid true-up math.
- Current formula after the fix:
  - `existingSettledSessions = paid/verified sessions only`
  - `existingSettledTotal = paid/verified booking totals only`
  - `totalSessionsAfter = existingSettledSessions + newSessions`
  - `targetTotal = totalSessionsAfter * rateOf(totalSessionsAfter)`
  - `charge = max(0, targetTotal - existingSettledTotal)`
- Zero-baht kids_group true-up behavior: when the source calculation returns `0`, the booking is created as `verified`, the user flow uses the "ใช้สิทธิ์เรียนรอบนี้" action, the slip-upload instructions are hidden, no coupon is applied, and no 0-baht payment row is created by `/api/bookings`.
- Booking UI explains the true-up with the title `คำนวณตามเรทราคารวมของเดือนนี้`, shows paid sessions/amount, new sessions, total-after-booking, new tier rate, target total, deducted paid total, `ยอดที่ต้องชำระเพิ่ม`, and uses `เครดิตส่วนต่าง` for overpaid true-up credit.
- Dry-run pricing proof passed with `node scripts/check-pricing-true-up.js`:
  - new kids_group 1 session = `700`
  - paid 1 session `700` + add 1 = `550`
  - paid 2 sessions `1250` + add 1 = `625`
  - paid 6 sessions `3750` + add 1 = `0` with `เครดิตส่วนต่าง` `250`
  - paid 6 sessions `3750` + add 2 = `250`
  - previous pending 1 session is ignored and does not reduce the next price
  - affected booking scenarios `9112a5cb...` and `60779d60...` recompute to `500` after excluding pending rows
  - prior 8 + 8 sibling true-up remains `4000 + 2496 = 6496`
  - adult pricing checks remain unchanged.
- Local smoke reached `/dashboard/booking` with the provided User account and previewed pricing only; no booking submit, slip upload, DB write, payment/coupon creation, or admin write action was clicked. The visible positive-charge summary showed the new true-up explanation and preserved the slip-required flow.
- The owner-approved production DB repair for `9112a5cb-006c-4fdd-838d-5534c15b6fb1` and `60779d60-ac26-4eaf-a34f-703157a32300` is complete as recorded above. Both rows now have `total_price = 500` and remain `pending_payment`.

## 2026-07-09 - Phase 3 Production Role Smoke Readiness

- Final classification: `NEED REVIEW`.
- Environment: production `https://www.newathleteschool.com`, deployment `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC` inspected with Vercel CLI and reported Ready.
- Scope was read-only browser smoke plus docs-only closeout. No source code, API, DB, migration, package/config, deploy, booking/payment/slip/coupon/check-in/attendance/wallet/reschedule/payroll/ranking-write/user-edit action was performed.
- Pre-smoke verification passed:
  - `git status --short` was clean.
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `git diff --check`
- Public/unauthenticated production smoke passed:
  - `/`, `/ranking`, `/auth/login`, and `/auth/register` loaded.
  - Homepage displayed `080-252-7227` and `tel:0802527227`; the old phone was absent.
  - Public `/ranking` search input was visible; `LV 67`, `Athlete`, no-match, and cleared search behavior were verified read-only.
  - Unauthenticated protected routes redirected to `/auth/login?redirect=...`.
- Authenticated production role smoke covered the provided accounts only through browser UI; passwords were not written to docs:
  - User/Parent loaded `/dashboard`, `/dashboard/schedule`, `/dashboard/history`, `/dashboard/booking`, `/dashboard/reschedule`, `/dashboard/lesson-wallet`, `/dashboard/progress`, `/dashboard/children`, `/dashboard/notifications`, and `/profile`; direct `/admin` and `/coach` redirected back to `/dashboard`.
  - Coach loaded `/coach`, `/coach/today`, `/coach/checkin`, `/coach/attendance`, `/coach/students`, `/coach/levels`, `/coach/programs`, `/coach/hours`, and `/coach/notifications`; direct `/admin` redirected back to `/coach`. Direct `/dashboard` rendered a dashboard shell for this account and is an observed access behavior.
  - Head Coach loaded `/coach`, `/coach/today`, `/coach/attendance`, `/coach/assign-groups`, `/coach/hours`, `/coach/students`, `/coach/levels`, and `/coach/programs`; direct `/admin` redirected back to `/coach`.
  - Standard Admin loaded `/admin`, `/admin/schedules`, `/admin/users`, `/admin/ranking`, `/admin/payments`, `/admin/complaints`, and `/admin/notifications`; `/admin/payments` did not show baht symbols or amount wording. `/admin/coupons` redirected to `/admin`, so coupon access for this Standard Admin remains `NEED REVIEW` if it is expected.
  - Standard Admin direct checks for Super Admin-only pages mostly redirected to `/admin` or showed only the Admin shell; `/admin/makeup` and `/admin/coach-checkins` stayed on the URL with shell-only body during this smoke and should be rechecked if direct-deny UI must be explicit.
  - Super Admin loaded `/admin`, `/admin/schedules`, `/admin/makeup`, `/admin/payments`, `/admin/users`, `/admin/ranking`, `/admin/payroll`, `/admin/finance`, `/admin/notifications`, `/admin/settings`, and `/admin/logs`; `/admin/makeup` displayed makeup/review markers.
  - Admin ranking search was visible and worked in production; Super Admin verified `LV 67`, `Athlete`, no-match, and cleared search restore on `/admin/ranking`.
- Production browser console NEED REVIEW:
  - React minified error `#418` reproduced for Head Coach `/coach/programs` and `/coach`.
  - React minified error `#418` appeared during Standard Admin restricted `/admin/finance` redirect.
  - React minified error `#418` appeared on Super Admin `/admin/logs`.
- Vercel check:
  - `npx.cmd vercel inspect https://www.newathleteschool.com --scope team_gw8Y6CPd602WAKRsVFobPGCL` reported Ready deployment `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC`.
  - `npx.cmd vercel logs https://www.newathleteschool.com --scope team_gw8Y6CPd602WAKRsVFobPGCL --since 30m` fetched recent production logs showing info-level 2xx/3xx requests only; no server error/fatal entries were visible in the fetched output.
  - Vercel connector runtime error/log endpoints were permission-blocked with 403, and connector deployment alias lookup returned 404, so CLI output is the usable Vercel source for this pass.
- No production write action was clicked. No DB write, migration, deploy, source-code change, or package/config change was performed.

## 2026-07-09 - Phase 3 React #418 Triage / Root-Cause Audit

- Final classification: `PASS` for the read-only triage: the previously reported React minified `#418` console errors did not reproduce in fresh production tabs after hard refresh.
- Scope was read-only audit plus docs-only closeout. No source code, API, DB, migration, package/config, deploy, settings save, coupon/finance/program/check-in/attendance/payment/payroll/ranking/user-edit action was performed.
- Pre-browser verification passed:
  - `git status --short` was clean.
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `git diff --check`
- Production browser reproduction results:
  - Super Admin `/admin/logs`: rendered `Activity Log`, final URL stayed `/admin/logs`, React `#418` not present, console warning/error count 0.
  - Head Coach `/coach/programs`: rendered `โปรแกรมสอน`, final URL stayed `/coach/programs`, React `#418` not present, console warning/error count 0.
  - Head Coach `/coach`: rendered `หน้าหลักโค้ช`, final URL stayed `/coach`, React `#418` not present, console warning/error count 0.
  - Standard Admin direct `/admin/finance`: redirected to `/admin`, rendered Admin overview, React `#418` not present, console warning/error count 0.
  - Standard Admin direct `/admin/coupons`: redirected to `/admin`, rendered Admin overview, React `#418` not present, console warning/error count 0.
- Most likely explanation for the Step 2 React `#418` findings: stale or cross-tab accumulated browser console logs during the long multi-role smoke, not a currently reproducible route-level hydration failure. Confidence: medium, because the exact old browser-log source cannot be replayed after the fresh-tab retest.
- Source files inspected:
  - `src/app/(admin)/admin/logs/page.tsx`
  - `src/components/admin/logs-client.tsx`
  - `src/app/(coach)/coach/programs/page.tsx`
  - `src/components/coach/programs-client.tsx`
  - `src/app/(coach)/coach/page.tsx`
  - `src/app/(coach)/layout.tsx`
  - `src/components/layout/coach-sidebar.tsx`
  - `src/components/layout/admin-sidebar.tsx`
  - `src/components/layout/navigation-pending.ts`
  - `src/app/(admin)/layout.tsx`
  - `src/app/(admin)/admin/page.tsx`
  - `src/app/(admin)/admin/finance/page.tsx`
  - `src/app/(admin)/admin/coupons/page.tsx`
  - `src/lib/admin-navigation.ts`
  - `src/lib/auth/admin.ts`
  - `src/proxy.ts`
  - `src/lib/date-format.ts`
  - `src/lib/utils.ts`
  - `src/lib/coach-slot-display-status.ts`
- Source audit notes:
  - `/admin/logs` uses deterministic `formatThaiDateTimeWithWeekday`; remaining minor hardening candidate is replacing first-render `new Date().toISOString()` for the `วันนี้` stat/filter comparison with a shared Bangkok date key if this ever reproduces around date boundaries.
  - `/coach/programs` has timezone-less client date formatting (`toLocaleDateString('th-TH')`) in `ProgramsClient` and timezone-less server `formatSlotLabel`; this is a good source-only hardening candidate even though production did not reproduce the error.
  - `/coach` current dashboard uses server-side Bangkok date/month calculations and the client sidebar only uses `usePathname`/pending-navigation state; no active mismatch was reproduced.
  - Standard Admin restricted `/admin/finance` is handled by `src/proxy.ts` before the finance page renders, then falls back to the first allowed Admin menu href. No finance component hydration issue was reproduced for the tested Standard Admin.
  - Standard Admin `/admin/coupons` redirect is expected for the tested production permission set: the sidebar did not show Coupon access and `src/proxy.ts` redirects disallowed Admin menu paths via `isAdminMenuPathAllowed(...)`.
  - Important future safety note: `src/app/(admin)/admin/coupons/page.tsx` currently auto-closes expired/maxed coupons by updating rows during page render. Do not render this page under an allowed account in read-only smoke unless the owner approves that write-on-read behavior or it is refactored first.
- Local dev reproduction was not attempted because fresh production reproduction cleared every target route; local dev would not prove the previous production-only console entries.
- Recommended next source-only hardening, only if owner approves:
  - Replace `/coach/programs` client/server date formatting with shared deterministic Bangkok helpers.
  - Replace `/admin/logs` `today`/filter date key logic with shared Bangkok date helpers.
  - Review `/admin/coupons` render-time auto-close write and move it behind an explicit owner-approved Admin/API action if product policy requires read-only page load.

## 2026-07-09 - Owner-Approved Admin Coupons Controlled Smoke

- Final classification: `PASS`.
- Scope was owner-approved controlled production smoke for `/admin/coupons`, including the approved page-load write-on-read auto-close path only. No source code, API, migration, deploy, manual DB edit, coupon create/edit/delete/toggle/save action, or other write action was performed.
- Source audit confirmed:
  - Auto-close logic lives in `src/app/(admin)/admin/coupons/page.tsx` during server page render.
  - It selects active coupons and closes only rows where `valid_to < today` using the page's UTC `new Date().toISOString().split('T')[0]` date key, or where `max_uses !== null` and actual `coupon_usages` count is greater than or equal to `max_uses`.
  - The only auto-close update is `coupons.is_active = false` for matching coupon ids.
  - The render-time auto-close path does not write an activity log or notification. Manual POST/PATCH coupon API actions do log `create_coupon` / `update_coupon`, but those actions were not clicked.
  - Successful auto-close is guarded from repeated writes because inactive coupons are excluded on later page loads. If an update failed, the current source does not inspect the update error, so a still-active candidate could be retried on a later render.
  - Super Admin can open `/admin/coupons`; Standard Admin access depends on `system_settings.admin_menu_permissions` via `src/lib/admin-navigation.ts`, `src/lib/auth/admin.ts`, and `src/proxy.ts`.
- Pre-smoke read-only DB snapshot, saved locally under ignored `backups/coupons-controlled-smoke-20260709-173156/pre.json`:
  - total coupons 0, active coupons 0, inactive/disabled/closed coupons 0.
  - active expired-by-date coupons 0.
  - active maxed-by-usage coupons 0.
  - `coupon_usages` total 0.
  - auto-close candidate coupon ids: `[]`.
- Production smoke used an allowed Super Admin session on `https://www.newathleteschool.com/admin/coupons`:
  - Page loaded and rendered the coupons surface, zero-count stats, search input, status filter trigger, create button, and the expected empty state `ไม่พบคูปองตามเงื่อนไข`.
  - With zero coupon rows, edit/delete/toggle row controls were not present.
  - Search input accepted a no-match query and kept the empty-state/count display at 0 rows.
  - No create/edit/delete/save/toggle/manual coupon action was clicked.
  - React `#418` did not appear. Browser log capture contained one browser-automation clipboard bridge error from the login URL, not an application error from `/admin/coupons`; no application warning/error was observed on the coupons page.
- Post-smoke read-only DB comparison, saved locally under ignored `backups/coupons-controlled-smoke-20260709-173156/post.json`:
  - total coupons remained 0.
  - `coupon_usages` remained 0.
  - changed coupon rows: 0.
  - changed coupon ids: `[]`.
  - auto-close write occurred: no, because there were no candidate coupons.
- Vercel verification:
  - `npx.cmd vercel inspect https://www.newathleteschool.com --scope team_gw8Y6CPd602WAKRsVFobPGCL` reported production deployment `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC` as Ready.
  - Narrow post-smoke `vercel logs --since 3m` showed `/admin/coupons` returning 200 with info-level entries only and no error-level entries.
  - The wider 30-minute log window contained one pre-coupons `/ranking` `Invalid Refresh Token` error from stale auth state, separate from the `/admin/coupons` smoke window.
- Verification before smoke passed: clean `git status --short`, `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check`.

## 2026-07-09 - Phase 3 Deploy Readiness / Production Readiness Gate

- Final classification: `NEED REVIEW`.
- Scope was read-only production readiness. No source code, API, DB write, migration, deploy, data create/update/delete, slip upload, check-in, attendance save, booking/payment/coupon/payroll/finance/settings/Admin Makeup write action, reset password, or role change was performed.
- Local command readiness passed:
  - `git status --short` was clean before the gate.
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run prod:check` returned READY WITH WARNINGS/PASSES with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run attendance:reconcile:dry-run` checked 2389 verified teaching sessions and 1438 attendance rows with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `git diff --check`
- Production alias/deployment readiness:
  - `https://www.newathleteschool.com` resolves to Ready Vercel deployment `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC`.
  - Vercel production env names are present without exposing values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SLIPOK_TEST_MODE`, `SLIPOK_API_URL`, and `SLIPOK_API_KEY`.
- SlipOK readiness result:
  - Local `prod:check` still warns `SLIPOK_TEST_MODE=true`, which is acceptable only for local testing.
  - Production SlipOK env names are present in Vercel, but the encrypted value of `SLIPOK_TEST_MODE` cannot be verified without exposing/pulling secrets. Production live mode remains `NEED REVIEW` until confirmed from Vercel settings or a safe owner-approved live SlipOK test.
  - No slip upload or `/api/verify-slip` live file verification was performed.
- Remote DB migration state:
  - `npx.cmd supabase migration list --linked` could not confirm remote migration state because Supabase CLI access token/login is not available in this environment.
  - No migration command, reset, push, or DB write was run. Remote migration state remains `NEED REVIEW`.
- Public/guard production route smoke:
  - Browser smoke: `/` loaded, displayed `080-252-7227`, and exposed `tel:0802527227`.
  - Browser smoke: `/ranking` loaded and public search for `LV 67` filtered to 1 result with no console warnings/errors.
  - No-cookie HTTP checks: `/`, `/ranking`, `/auth/login`, and `/auth/register` returned 200; `/auth/login` and `/auth/register` HTML contained form signals.
  - No-cookie HTTP guard checks: `/dashboard`, `/coach`, `/admin`, and `/admin/ranking` returned 307 to `/auth/login?redirect=...`.
- Authenticated production smoke coverage:
  - Existing browser session was Super Admin only.
  - Super Admin read-only surfaces loaded without React `#418` or captured browser warning/error entries: `/admin`, `/admin/ranking`, `/admin/payments`, `/admin/users`, `/admin/logs`, and `/admin/settings`.
  - Super Admin `/admin/ranking` search was visible and `LV 67` filtered to 1 result; Admin reward controls remained visible and no achievement/write action was clicked.
  - `/admin/makeup` returned 200 in Vercel logs, but the in-browser sample was still on the loading state when captured, so visual coverage is partial and remains `NEED REVIEW` for this gate.
  - User, Coach, Head Coach, and Standard Admin role sessions were not covered in this Step 4 run. Prior Step 2/3 coverage still exists, but this gate does not claim fresh role coverage for those accounts.
- Vercel logs:
  - Post-smoke `vercel logs --since 10m` returned info-level 200/304 entries only in the fetched window. No production error-level log tied to this smoke was visible.
- Readiness issue found:
  - Production homepage currently displays `70+ ระดับพัฒนาการ` and `LV 71+` / `ชุดนักกีฬา A`; source is `src/app/page.tsx`.
  - This conflicts with the current hard production business rule that active levels are LV 0-70 unless the owner confirms LV 71+ as active behavior. No source fix was made in this read-only gate.
- Gate result rationale:
  - Commands, attendance reconciliation, core public/guard routes, Super Admin sampled routes, Vercel deployment status, and Vercel logs are healthy.
  - Gate remains `NEED REVIEW` because remote migration state is unconfirmed, production SlipOK live-mode value is not safely visible, fresh role smoke did not cover User/Coach/Head Coach/Standard Admin sessions, `/admin/makeup` visual sample was partial, and homepage LV71+ copy conflicts with the LV 0-70 production rule.

## Observed Architecture

- `src/proxy.ts` handles Supabase session refresh, role route prefixes, auth redirects, and standard Admin menu permission redirects.
- `src/lib/supabase/middleware.ts` wraps Supabase SSR session handling for proxy.
- `src/app/(dashboard)` contains User portal routes.
- `src/app/(coach)` contains Coach and Head Coach routes.
- `src/app/(admin)` contains Admin and Super Admin routes.
- `src/app/api` contains public/user/coach/admin APIs.
- Admin page access uses `src/lib/auth/admin.ts`; API-level Admin menu checks use `requireAdminMenuAccess`.
- Admin menu permissions use `src/lib/admin-navigation.ts` and `system_settings` key `admin_menu_permissions`.
- Service role access is centralized in `getServiceRoleClient()`.

## Database and Migrations Observed

Key tables/types observed in `supabase/schema.sql` and `src/types/database.ts`:

- `profiles`, `children`, `branches`, `course_types`
- `schedule_templates`, `schedule_slots`
- `pricing_tiers`, `levels`
- `bookings`, `booking_sessions`, `payments`
- `coupons`, `coupon_usages`
- `coach_assignments`, `coach_assignment_groups`, `coach_assignment_group_students`
- `attendance`, `coach_checkins`, `teaching_programs`, `coach_program_templates`
- `student_levels`, `student_achievements`
- `lesson_wallet_credits`
- `coach_teaching_hours`, `coach_payouts`, `coach_weekly_teaching_summaries`
- `notifications`, `complaints`, `activity_logs`, `system_settings`, `finance_expenses`

Observed migrations include:

- Baseline remote schema: `20260506082635_current_remote_baseline.sql`
- Schedule template seed from hardcoded schedules.
- Level expansion to 70 and LV 0 support.
- Extensible level constraints for future LV 71+.
- Coach assignment groups.
- Student achievements.
- Coach weekly teaching summaries.
- Coach program templates.
- Lesson wallet credits.

## Confirmed Business State (Historical/Observed)

Pricing and rollout statements in this section are **superseded by Current Source
of Truth**. Non-pricing observations remain historical evidence until reverified.

### Levels

- Current business state from owner and code: LV 0 through LV 70.
- LV 0 is unassessed.
- Current ranges in `src/constants/levels.ts`:
  - LV 1-34: Basic.
  - LV 35-58: Athlete C.
  - LV 59-70: Athlete B.
- Code can technically support LV 71+ after the extensibility migration, but current active production rule is 1-70 unless owner confirms otherwise.

### Attendance

- `attendance` is source of truth for present/late/absent.
- `booking_sessions.status` is kept as lifecycle/cache state and must be synced after attendance writes.
- Shared status helper: `src/lib/session-attendance-status.ts`.
- Admin shared scope/status helper: `src/lib/admin-attendance-state.ts`.
- Exact learner matching uses `booking_session_id + expected student_id`.
- Write-through helper: `src/lib/attendance-write-through.ts`.
- Coach attendance API currently calls write-through after insert/update.
- Admin makeup retrospective attendance API currently calls write-through after insert/update.
- Admin makeup attendance-gap review treats `activity_logs` action `attendance_gap_closed_no_action` as a terminal review marker. Closing a review must not mark the session `completed`.

### Booking, Payment, and Scheduling

- User booking API resolves sessions through DB `schedule_templates` and real `schedule_slots`.
- New booking sessions should persist `schedule_slot_id`.
- Admin booking on behalf of users is disabled.
- Slip upload API stores payment rows and updates booking status based on SlipOK/test-mode result.
- `SLIPOK_TEST_MODE=true` auto-approves locally; production must use real SlipOK env.
- `/admin/payments` learner display is now resilient for multi-child bookings. It still reads `bookings.child_id -> children` first for single-child bookings, then falls back to unique learner names from `booking_sessions.child_id` when `bookings.child_id` is null by design.
- Pricing reads DB `pricing_tiers` through `src/lib/booking-pricing.ts` and falls back to defaults only if rows are missing.
- Kids group combines sibling sessions for monthly tier pricing.
- Kids group incremental pricing now true-ups split bookings in the same month to the final monthly tier total. It subtracts existing persisted `bookings.total_price` for the same user/course/month/year/status scope before charging the next booking.
- User Reschedule (`/dashboard/reschedule` and `/api/reschedule`) now uses a 12-hour cutoff before the original lesson start time. The cutoff is computed against the lesson start in Asia/Bangkok (`+07:00`).

### Coach and Attendance Evidence

- Coach assignments now use assignment groups by learner/slot, with legacy assignment fallback.
- Coach check-in is per teaching slot and requires photo/GPS.
- Coach attendance is locked until check-in for the exact slot, except Admin/Super Admin retrospective paths.
- Admin Makeup displays round branch names from `booking_sessions.branch_id` / the session branch relation, not from the booking package branch.
- Coach teaching hour source rows are verified only with students, check-in, photo, location, and attendance.
- Coach teaching hour source reads must chunk large `.in()` filters. Production-scale grouped assignments can exceed Supabase/PostgREST request limits and row caps when `booking_session_id` or `schedule_slot_id` arrays are sent in one request.
- Weekly teaching summaries are stored in `coach_weekly_teaching_summaries`.

### Lesson Wallet

- `lesson_wallet_credits` exists.
- User can store verified scheduled sessions before the 48-hour cutoff when no attendance exists.
- Redemption is same-month, future-slot, no new payment.
- Walleted sessions are excluded from absence, makeup, and coach-payable evidence.
- Wallet redemption must validate against active `schedule_templates` by branch, course, day, and time. A client-provided `scheduleTemplateId` is only a hint; if it is stale or does not cover the selected time, the API must fall back to the canonical branch/course/day/time template lookup before rejecting.

## Observed Current Routes

Public:

- `/`
- `/ranking`
- `/auth/login`, `/auth/register`, `/auth/callback`

User:

- `/dashboard`, `/dashboard/booking`, `/dashboard/history`, `/dashboard/schedule`
- `/dashboard/reschedule`, `/dashboard/lesson-wallet`, `/dashboard/progress`
- `/dashboard/children`, `/dashboard/complaint`, `/dashboard/notifications`
- `/profile`

Coach/Head Coach:

- `/coach`, `/coach/today`, `/coach/checkin`, `/coach/attendance`
- `/coach/students`, `/coach/levels`, `/coach/programs`, `/coach/hours`
- `/coach/assign-groups`, `/coach/notifications`

Admin/Super Admin:

- `/admin`, `/admin/users`, `/admin/coaches`, `/admin/branches`
- `/admin/schedules`, `/admin/schedule-templates`, `/admin/payments`
- `/admin/payments/settings`, `/admin/coupons`, `/admin/complaints`
- `/admin/notifications`, `/admin/ranking`, `/admin/makeup`
- `/admin/coach-checkins`, `/admin/payroll`, `/admin/finance`
- `/admin/teaching-programs`, `/admin/settings`, `/admin/settings/pricing`
- `/admin/settings/levels`, `/admin/settings/coach-ot`
- `/admin/settings/admin-menus`, `/admin/logs`

## Historical Risk Snapshot (Superseded by Current Source of Truth)

Latest attendance reconciliation result:

- Owner confirmed production repair on 2026-06-04.
- `npm run attendance:reconcile:write` updated 1 stale row:
  - session `1b9d1b2b-2078-4c47-a042-46d74ae41fa6`
  - `booking_sessions.status`: `scheduled` -> `completed`
  - source of truth: `attendance.status=present`
- Follow-up `npm run attendance:reconcile:dry-run` reported:
  - Student-scope attendance mismatches: 0
  - Status mismatches: 0
  - Booking status without attendance: 0

Current active production risk:

- No known attendance/session status drift after the confirmed reconciliation.
- Public contact phone number is deployed as `080-252-7227` with `tel:0802527227` as of commit `983e998` (`fix(site): update contact phone number`):
  - Deployment id `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/app/page.tsx`; no DB write, API change, migration, package/config change, business logic change, or deploy after docs was performed.
- `/admin/ranking` Phase 2.5 follow-up search enablement is deployed in production as of commit `67aa4f1` (`fix(ranking): enable search in admin view`):
  - Deployment id `dpl_4FCzBixNfSrEiWaiwf6xbfU9DDvL`; deployment URL `https://new-athlete-badminton-school-5olbmc8mo-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Final status: PASS after owner-verified production smoke.
  - Source scope was limited to `src/app/(admin)/admin/ranking/page.tsx`.
  - Exact source change: Admin Ranking now calls `<RankingContent mode="admin" enableSearch />`, enabling the existing shared `RankingBoard` dynamic search for `/admin/ranking`.
  - Search is now enabled on both `/ranking` and `/admin/ranking`. Search implementation, fields, empty state, rank preservation, branch fallback, and Admin achievement controls remain the shared Phase 2.5 behavior.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check` with only the known Windows LF/CRLF warning for the touched admin ranking page.
  - Local authenticated smoke passed on `/ranking` and `/admin/ranking`: search input visible on both; dynamic search worked by typed name, nickname, branch, and `LV 67`; branch+search and level+search still combine on public; no-match state displayed `ไม่พบนักเรียนที่ตรงกับคำค้นหา`; whitespace/empty search restored the list; original rank `#1` stayed `#1`; Admin reward controls stayed visible; the achievement modal opened/closed read-only without submitting; browser warnings/errors were 0.
  - Production verification completed for deploy health and route reachability: Vercel inspect reported Ready, `https://www.newathleteschool.com/ranking` returned 200, unauthenticated `/admin/ranking` returned the expected 307 auth redirect, and `vercel logs --level error --since 1h` returned no logs.
  - Owner-verified production smoke completed after deploy: public `/ranking` had the search input visible and the ranking list rendered normally; authenticated Super Admin `/admin/ranking` had the search input visible, Admin sidebar/control still visible, reward/Admin controls still visible, and the ranking list rendered normally.
  - No Admin write action was clicked during owner verification. No new source deploy was needed for this docs-only PASS closeout.
  - Production deploy was run from a detached clean worktree at commit `67aa4f1`, so the then-unrelated `src/app/page.tsx` phone-number change was not included in that ranking deploy. That phone update was later completed separately in commit `983e998`. No DB write, migration, API route change, ranking sort/rank semantic change, branch fallback semantic change, student level/achievement write, booking/payment/attendance/wallet change, storage deletion, or Admin write action was performed.
- `/ranking` + `/admin/ranking` Phase 2.5 Option 1 safe read transport cleanup and public dynamic search is deployed in production as of commit `1cef3b7` (`fix(ranking): add search and range reads`):
  - Deployment id `dpl_9mvhkgVdPags1Ko5Z6W2TRXeyycA`; deployment URL `https://new-athlete-badminton-school-mnggq3uty-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/components/shared/ranking-content.tsx`, `src/components/shared/ranking-board.tsx`, and `src/app/ranking/page.tsx`.
  - Top-level Ranking reads for `children`, paid/verified `bookings`, active `branches`, and `levels` now use explicit ranged pagination with explicit read errors.
  - Large `.in(...)` reads for parent `profiles`, `student_levels.student_id`, and active `student_achievements.student_id` now use chunked+ranged reads with id dedupe. Existing child session branch fallback remains chunked+ranged and now fails explicitly on read error.
  - At this source commit, public `/ranking` gained client search through the shared `RankingBoard` and `/admin/ranking` intentionally still had search disabled. That admin-search gap was superseded and closed by follow-up commit `67aa4f1`, so current production has search enabled on both `/ranking` and `/admin/ranking`.
  - Ranking semantics were preserved: sort order, rank maps, public/Admin visibility, branch fallback precedence, LV 0-70 behavior, student level display, and achievement write flow were not changed. Search filters the visible list but does not re-rank results.
  - Read-only post-fix counts: children 290, adult visible rows from paid/verified bookings 24, visible ranking rows 314, paid/verified bookings 439, session fallback rows 2422, `student_levels` rows 459, child latest-level rows 238/52 missing, adult latest-level rows 13/11 missing, visible level buckets LV0/Basic/Athlete C/Athlete B/LV71+ = 63/195/55/1/0, active achievements 0, active branches 7, active levels 70.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check` with only known Windows LF/CRLF warnings for touched ranking files.
  - Local smoke passed on `/ranking`: search by full name, nickname, branch, and `LV 67` worked; no-match showed the search empty state; branch+search and level+search combinations worked; rank `#1` stayed `#1`; browser warnings/errors were 0. At this commit only, local `/admin/ranking` authenticated smoke passed with the search input absent, ranking rows rendered, achievement buttons available, and the achievement modal opened/closed read-only; the later follow-up enabled admin search.
  - Production smoke passed on `https://www.newathleteschool.com/ranking` and `/admin/ranking` with the same public/admin checks; production browser warnings/errors were 0. Vercel deployment inspect reported Ready, and `vercel logs --level error --since 1h` returned no logs.
  - Production deploy was run from a detached clean worktree at commit `1cef3b7` so the then-unrelated `src/app/page.tsx` phone-number change was not included in that ranking deploy. That phone update was later completed separately in commit `983e998`. No DB write, migration, API route change, student level/achievement write, booking/payment/attendance/wallet change, storage deletion, or Admin write action was performed.
- `/dashboard/history` Phase 2.3 Option 1 safe read transport cleanup is deployed in production as of commit `3cc3ddc` (`fix(history): range large read queries`):
  - Deployment id `dpl_EXvDn6rkpRKCohjEmTcgg3XweyMM`; deployment URL `https://new-athlete-badminton-school-e3nssxdhj-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/app/(dashboard)/dashboard/history/page.tsx` and `src/components/dashboard/history-client.tsx`.
  - Added local read helpers `readAllRangePages`, `readChunkedRangePages`, and `dedupeRowsById`.
  - Top-level `bookings` and `payments` reads now use explicit ranged pagination while preserving the existing Admin/global and User/self scopes, field selection, and created-at ordering.
  - Related reads now chunk and range `.in(...)` filters for `coupon_usages`, `booking_sessions`, `attendance`, and `lesson_wallet_credits`; rows are deduped by id where chunk/range reads can overlap.
  - Profile and payment-transfer setting reads now fail explicitly on read error instead of silently masking the problem.
  - Client optimization included: `/dashboard/history` memoizes payments by booking id and latest rejected payment by booking id, preserving `HistoryClient` props and UI behavior.
  - Read-only post-fix counts: bookings 475, booking_sessions 2669, payments 438, lesson_wallet_credits 55, attendance 1411, multi-child bookings with null `bookings.child_id` and session children 69, rescheduled rows with `rescheduled_from_id` 202, booking session statuses completed/rescheduled/walleted/scheduled/absent 1316/193/55/1011/94.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check` with only the known Windows LF/CRLF warnings for touched files.
  - Authenticated local smoke passed on `/dashboard/history` as Super Admin: August and July groups rendered, July expanded, normal detail modal opened, walleted private booking showed wallet summary/section for `onlineman2522@gmail.com`, and reschedule-heavy multi-child booking `ikqjaa@gmail.com` showed reschedule history, no-double-count copy, learners, and attendance statuses. Browser warnings/errors were 0.
  - Authenticated production smoke passed on `https://www.newathleteschool.com/dashboard/history`: same read-only list/detail/wallet/reschedule/multi-child checks passed, production browser warnings/errors were 0, and Vercel logs for the smoke window showed 200 responses with no error-level logs.
  - No API route, DB write, migration, schema change, SlipOK change, payment/slip upload action, payment/booking status transition change, pricing/coupon semantic change, lesson wallet/reschedule/attendance source-of-truth change, storage deletion, booking/payment/slip/coupon creation, or write action click was performed.
- `/admin/payments` Phase 2.2 Option 1 safe read transport cleanup is deployed in production as of commit `33161c6` (`fix(payments): range large read queries`):
  - Deployment id `dpl_5Kdb3ahBbpd89NTEs4pvv7Eq75ED`; deployment URL `https://new-athlete-badminton-school-n047jvmd6-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/app/(admin)/admin/payments/page.tsx`.
  - Added local read helpers `readAllRangePages`, `readChunkedRangePages`, and `dedupeRowsById`.
  - Top-level `payments` and incomplete `bookings` reads now use explicit ranged pagination while preserving the existing status/order/role-specific field selection. Super Admin still receives financial amount fields; standard Admin does not receive `payments.amount` or `bookings.total_price`.
  - Multi-child learner fallback reads now chunk booking ids by 100 and range every `booking_sessions` page; fallback child-name reads and verifier profile reads are also chunked/ranged and deduped.
  - Payment transfer setting reads now fail explicitly on read error instead of silently masking the problem.
  - Read-only post-fix counts: payments 433; incomplete bookings 8; payment-scope booking ids 441; fallback session rows 2574 across chunk rows 456, 727, 299, 746, 346; unique child ids 271; child rows 271; duplicate payment booking ids 0; approved/pending/rejected payments 433/0/0.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check` with only the known Windows LF/CRLF warning for the touched file.
  - Authenticated local smoke passed on `/admin/payments` as Super Admin: list showed 433 rows, incomplete section showed 8 rows, amount visibility was preserved, search returned current-data results for `เอมี่` (1), `ภูเมธ` (2), and `Tigger` (2), and current data returned 0 for `ปันนา`; detail and slip modals opened read-only. No approve/reject/send-back/cancel/write action was clicked.
  - Local browser logs had one dev-only Next image LCP warning from the slip modal image; no functional error, hydration error, or React #418 was observed.
  - Authenticated production smoke passed on `https://www.newathleteschool.com/admin/payments`: list showed 433 rows, incomplete section showed 8 rows, amount visibility was preserved for Super Admin, search/detail/slip modal read-only checks passed, production-origin browser warnings/errors were 0, and Vercel error logs found no logs.
  - No API route, DB write, migration, schema change, client redesign, server pagination behavior change, SlipOK change, payment status/booking status/pricing/learner fallback semantic change, financial visibility regression, storage deletion, booking/payment/slip/coupon creation, or payment write action was performed.
- `/admin/payments` multi-child learner display fix is deployed in production as of commit `abe01e11324bbb1d5bc29034fe516f0bfa655220` (`fix(payments): show session learners for multi-child bookings`):
  - Deployment id `dpl_CdVyyJMkYWcSJJBZrWY6aajcZ1Mf`; deployment URL `https://new-athlete-badminton-school-fpasc3joj-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Root cause: `/admin/payments` displayed `ไม่ทราบผู้เรียน` for multi-child kids_group bookings because the read model used only `bookings.child_id -> children`. Multi-child bookings intentionally have `bookings.child_id = null`, while the real learners are stored on `booking_sessions.child_id`.
  - Source scope was limited to `src/app/(admin)/admin/payments/page.tsx` and `src/components/admin/payments-client.tsx`.
  - Fix is display/read-model only: single-child booking display still uses `bookings.child_id -> children` first; multi-child display falls back to unique learner names from `booking_sessions.child_id`; search and the payment detail modal use the derived learner name.
  - Production smoke passed on `/admin/payments`: `4b0813ef...` showed `ปันนา, ปีนัง`; `5ebae341...` showed `เอมี่, เอลซ่า`; `9b7bd3f5...` showed `ภูเมธ, ซานต้า, ซันเดย์, ตุลย์`; a single-child row still showed `Tigger`; search by `ปันนา`, `เอมี่`, `ภูเมธ`, and `Tigger` worked; the detail modal for `9b7bd3f5...` showed `ผู้เรียน: ภูเมธ, ซานต้า, ซันเดย์, ตุลย์`; console errors/warnings were 0.
  - No DB changes, migrations, payment approval/reject/send-back/cancel logic changes, pricing changes, SlipOK changes, `booking_sessions`/`payments`/coupon data changes, booking/payment/slip/coupon creation, or payment write action clicks were performed.
  - Remaining risk for this display bug after production smoke: none known.
- Lesson wallet redemption fallback fix, added 2026-06-09:
  - Reported pattern: `/dashboard/lesson-wallet` could return HTTP 400 with `รอบเรียนที่เลือกไม่ตรงกับรอบเรียนประจำในระบบ` even when the selected branch/date/time/course had an active recurring template.
  - Root cause proved read-only: `/api/lesson-wallet` treated client `scheduleTemplateId` as a hard filter. A stale/mismatched id caused the canonical branch/course/day/time lookup to be skipped.
  - Scoped source fix: `src/app/api/lesson-wallet/route.ts` now first tries the provided template id, then falls back to active templates for the selected branch, course, day, and time. It still rejects when no active matching template exists.
  - Business rules unchanged: same-month redemption, future-slot requirement, duplicate learner guard, capacity guard, no new payment, and wallet status transitions remain intact.
- Continue to treat `attendance` as the source of truth and keep write-through required on every runtime attendance write path.
- `21.6.19` follow-up code now guards future child bookings by requiring child learner sessions to carry `childId` and by persisting `bookings.child_id`.
- `21.6.20` owner-confirmed exact-row historical child FK repair was run on 2026-06-04:
  - booking `080c8a56-9b67-4a83-a44b-5a0394f4b73f` updated to child `65a94ede-296e-4bbe-9bab-2aaf03b99c7e`.
  - 16 related `booking_sessions` rows updated to the same `child_id`.
  - Post-write verification found 0 target sessions with missing/wrong `child_id`.
  - No other bookings or sessions were targeted by this repair.
- Admin coach check-in audit now chunks active `booking_sessions` lookups and surfaces load errors in the UI instead of silently showing a false empty state.
- Admin makeup coach-checkin evidence now requires the exact assigned coach pair (`schedule_slot_id + coach_id`) before showing coach evidence as complete. Same-slot check-ins from other coaches must not be treated as evidence for the assigned coach.
- Admin makeup attendance-gap review now reads review request/closed metadata from `activity_logs` in chunks, hides closed review sessions from the review queue, sends coach review/evidence requests to every learner session in the selected round, and provides a round-level close action.
- Admin makeup no-coach past rounds are now resolved at round scope only. The UI hides per-learner action buttons for these rounds and opens a round-level resolution dialog. The taught path creates a retrospective `coach_assignment_groups` record, links every learner session in the round, writes attendance per learner, and syncs session status through the attendance write-through helper. Return-entitlement and close-round paths run across all eligible sessions in the selected round.
- Admin makeup Tabs + Filters MVP is deployed in production as of commit `7e1bae818e42e4bbf24368363f0821ae04b2c308`:
  - Deployment id `dpl_3wRJjCqExkPPEEqUzBxxJSC3WuCD`; production alias `https://www.newathleteschool.com`; production smoke on `/admin/makeup` passed.
  - The page is split client-side into `ต้องตรวจสอบ` and `เลือกวันชดเชย` tabs.
  - `ต้องตรวจสอบ` keeps the existing review round cards and action surfaces; `เลือกวันชดเชย` keeps the existing learner/month entitlement cards.
  - Filters are client-only and tab-specific. No API route, DB, migration, write behavior, attendance/write-through logic, wallet/return-entitlement logic, or duplicate coach group guard behavior changed.
  - Production smoke confirmed duplicate coach group UI and assigned-coach action cards remained visible, console errors/warnings were 0, the font/preload warning flood did not return, and no write action was clicked.
- Phase 1 standardized Thai date display is deployed in production as of commit `73d465ca1bef5881bb6e6a9c7f52d9046db8a08d` (`fix(ui): standardize thai date display`):
  - Deployment id `dpl_GYpjsdSxAMQfWJBjFZqhF1ZNeAUe`; deployment URL `https://new-athlete-badminton-school-hpbojsf73-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/lib/date-format.ts`, `src/components/admin/schedules-client.tsx`, `src/components/admin/payroll-client.tsx`, `src/components/admin/makeup-client.tsx`, `src/app/(coach)/coach/today/page.tsx`, `src/app/(coach)/coach/attendance/page.tsx`, `src/app/(coach)/coach/hours/page.tsx`, and `src/components/coach/assign-groups-client.tsx`.
  - New shared display helper `src/lib/date-format.ts` centralizes deterministic Asia/Bangkok date formatting with `getBangkokDateKey`, `parseBangkokDate`, `formatThaiDateWithWeekday`, `formatThaiShortDate`, `formatThaiDateRangeWithWeekday`, `formatThaiDateTimeWithWeekday`, `formatThaiCompactDateWithWeekday`, `formatThaiMonthYear`, and `formatThaiShortMonthYear`.
  - Admin/Coach operational pages now use the same weekday date display style, for example `จันทร์ 29 มิ.ย. 69`; date ranges display weekday on both ends, for example `จันทร์ 1 มิ.ย. 69 - อาทิตย์ 7 มิ.ย. 69`.
  - This was display formatting only. It did not change query date ranges, filtering, grouping, payroll calculations, payroll Monday-Sunday week boundary logic, close API behavior, booking/reschedule/wallet/attendance logic, Admin Makeup write behavior, DB/API/migrations, or write actions.
  - Verification before deploy passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
  - Production smoke passed with one `NEED REVIEW` note only for `/coach/hours` visual weekly/date rows because the smoke coach session had no row data. `/admin/schedules` showed `จันทร์ 29 มิ.ย. 69`; `/admin/payroll` coach-hours modal showed `จันทร์ 1 มิ.ย. 69 - อาทิตย์ 7 มิ.ย. 69`, `จันทร์ 8 มิ.ย. 69 - อาทิตย์ 14 มิ.ย. 69`, `จันทร์ 15 มิ.ย. 69 - อาทิตย์ 21 มิ.ย. 69`, `จันทร์ 22 มิ.ย. 69 - อาทิตย์ 28 มิ.ย. 69`, and `จันทร์ 29 มิ.ย. 69 - อาทิตย์ 5 ก.ค. 69`; `/admin/makeup` showed `อาทิตย์ 28 มิ.ย. 69` and `เสาร์ 27 มิ.ย. 69`; `/coach/today` and `/coach/attendance` showed `จันทร์ 29 มิ.ย. 69`; `/coach/assign-groups` showed `จันทร์ 29 มิ.ย. 69`, `พฤหัสบดี 18 มิ.ย. 69`, and `อาทิตย์ 14 มิ.ย. 69`.
  - Hydration/console smoke passed: hard refresh/fresh load checks on `/admin/schedules`, `/admin/payroll`, and `/coach/today` found no React #418, no hydration error, no text mismatch, and console errors/warnings 0.
  - No DB/API/migration changes, source changes after smoke, extra deploy after smoke, write action clicks, or `ปิดสัปดาห์` clicks were performed.
- Phase 2 standardized Thai date display is deployed in production as of commit `2eebfef5ee1b4dc5da9cd34f05baa2b19efa3eda` (`fix(ui): standardize remaining thai date displays`):
  - Deployment id `dpl_ED8kxqLF3aEhPBCNq4AeUADGnbQX`; deployment URL `https://new-athlete-badminton-school-6u58bndez-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope covered remaining User/Admin/Public/support date displays in `src/components/admin/admin-overview-schedule.tsx`, `src/components/admin/branches-client.tsx`, `src/components/admin/coach-checkins-client.tsx`, `src/components/admin/coach-ot-settings-client.tsx`, `src/components/admin/complaints-client.tsx`, `src/components/admin/coupons-client.tsx`, `src/components/admin/finance-client.tsx`, `src/components/admin/levels-settings-client.tsx`, `src/components/admin/logs-client.tsx`, `src/components/admin/notifications-admin-client.tsx`, `src/components/admin/payments-client.tsx`, `src/components/admin/teaching-programs-client.tsx`, `src/components/admin/users-client.tsx`, `src/components/dashboard/children-client.tsx`, `src/components/dashboard/complaint-client.tsx`, `src/components/dashboard/dashboard-calendar.tsx`, `src/components/dashboard/history-client.tsx`, `src/components/dashboard/lesson-wallet-client.tsx`, `src/components/dashboard/notifications-client.tsx`, `src/components/dashboard/reschedule-client.tsx`, `src/components/dashboard/schedule-calendar-client.tsx`, `src/components/shared/ranking-board.tsx`, and `src/components/shared/student-achievement-manager.tsx`.
  - The change reused the existing `src/lib/date-format.ts` helper from Phase 1. Default date display is `จันทร์ 29 มิ.ย. 69`; date-time display is `จันทร์ 29 มิ.ย. 69 14:33`; compact weekday is reserved for tight UI such as dashboard quick cards and reschedule date tiles.
  - This was display formatting only. It did not change query/filter/grouping/calendar selection, booking/reschedule/wallet/attendance/payroll logic, payroll Monday-Sunday boundary logic, close API behavior, financial visibility gating, ranking sort/filter/rank logic, low-enrollment logic, React #418 deterministic date-key logic, DB/API/migrations, or write actions.
  - Verification before deploy passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
  - Production smoke passed with `NEED REVIEW` notes only where the smoke account had no real row/date data. `/dashboard/notifications` showed `จันทร์ 29 มิ.ย. 69 14:33`; `/admin/payments` showed `จันทร์ 29 มิ.ย. 69 14:33` and `เสาร์ 27 มิ.ย. 69 19:30`; `/admin/notifications` showed weekday notification dates and the low-enrollment card rendered without crashing; `/admin/ranking` and `/ranking` showed `ประเมินล่าสุด: พฤหัสบดี 25 มิ.ย. 69`; `/admin/finance` showed `จันทร์ 1 มิ.ย. 69`; `/admin/complaints` showed `พฤหัสบดี 28 พ.ค. 69 23:28`; `/admin/users` showed `สมัคร จันทร์ 29 มิ.ย. 69`; `/admin/logs` showed `จันทร์ 29 มิ.ย. 69 15:18`; `/admin/settings/levels` showed `อัปเดต พุธ 13 พ.ค. 69 18:03`.
  - Fresh-tab/cache-buster hydration checks on `/dashboard/schedule`, `/admin/payments`, `/admin/notifications`, and `/ranking` found no React #418, no hydration error, no text mismatch, and console errors/warnings 0.
  - `/dashboard/booking` was intentionally not changed in this phase because it is booking/calendar selection/write-heavy and out of scope at that time. It was closed later by the scoped booking date-display release below.
- `/dashboard/booking` Thai date display closeout is deployed in production as of commit `a9ffcf74019f69424e288a1698910444b4e58a8c` (`fix(booking): standardize thai date display`):
  - Deployment id `dpl_27LUxvWCa7UmZwwUdyZXHMZaw55W`; deployment URL `https://new-athlete-badminton-school-q05rf1358-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/components/dashboard/booking-client.tsx` and reused the existing `src/lib/date-format.ts` helper from the Phase 1/2 date-display work.
  - This closes the final date-display path intentionally skipped from Phase 2. Standardized Thai date display is now complete across the system, including `/dashboard/booking`.
  - Display changes: raw error dates and expanded slot headers use `formatThaiDateWithWeekday(...)`; selected-session chips/badges use `formatThaiCompactDateWithWeekday(...)`; month selector and summary month/year use `formatThaiMonthYear(...)`.
  - Calendar weekday headers and calendar day cells intentionally remain compact/calendar UI (`อา จ อ พ พฤ ศ ส` and day numbers such as `30`).
  - This was display formatting only. It did not change calendar selection logic, selected date/date key logic, current month logic, past-date disabling, bookable slot logic, schedule template matching, `scheduleTemplateId`, `POST/PUT /api/bookings` payloads, booking/payment behavior, DB/API/migrations, or write actions.
  - Verification before deploy passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
  - Production smoke on `https://www.newathleteschool.com/dashboard/booking` passed with a real user session and no unexpected redirect. Confirmed display examples: month selector `มิถุนายน 2569`; expanded slot header `อังคาร 30 มิ.ย. 69 — เลือกรอบเรียน:`; selected-session chip `อ. 30 มิ.ย. 69 08:00-09:00`; summary month/year `มิถุนายน 2569`; summary selected date `อ. 30 มิ.ย. 69 08:00-09:00`.
  - Production smoke also confirmed calendar weekday header `อา จ อ พ พฤ ศ ส`, day cell `30`, console errors/warnings 0, no React #418, no hydration error, and no text mismatch.
  - Smoke interaction was read-only UI selection only: `Private`, learner `A'Arm Chanin`, branch `แจ้งวัฒนะ`, date `30`, slot `08:00 - 09:00`, then summary display review. `ยืนยันการจอง` was not clicked; no booking/payment/write action was performed; no extra deploy was performed after smoke.
- User Reschedule 12-hour cutoff Phase 1 is deployed in production as of commit `c6b470dbba646f5b4db023a7dedf0df8d7b08f37`:
  - Deployment id `dpl_3gm8uhsKrmm6Zxe69R9GsBHq1yMk`; production alias `https://www.newathleteschool.com`; production smoke passed with a `NEED REVIEW` note only for live eligibility/action examples because the smoke account had no sessions.
  - `/dashboard/reschedule` displays `ล่วงหน้าอย่างน้อย 12 ชั่วโมง`, and no `24 ชั่วโมง` copy was found in the reschedule page.
  - `/api/reschedule` and the client eligibility gate both use the 12-hour cutoff and parse lesson start times as Asia/Bangkok (`+07:00`).
  - Lesson Wallet is intentionally unchanged in this phase: `/dashboard/lesson-wallet` still shows the 48-hour policy, and `/api/lesson-wallet` still uses `STORE_CUTOFF_HOURS = 48`.
  - No DB writes, migrations, write behavior changes beyond the reschedule validation threshold, Admin Makeup changes, Lesson Wallet logic changes, or production write actions were performed.
- Admin Payroll / Coach Hours Monday-Sunday teaching week boundary is deployed in production as of commit `56dc769e6b817d645f5cf08523070b64d3ce6f02` (`fix(payroll): use monday teaching weeks`):
  - Deployment id `dpl_FgzX1ZCovmSoj1q9KcL5YYknuZjE`; deployment URL `https://new-athlete-badminton-school-7fipynggk-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/lib/coach-teaching-rules.ts`, `src/components/admin/payroll-client.tsx`, `src/app/api/admin/coach-payouts/route.ts`, `src/app/(coach)/coach/hours/page.tsx`, `src/app/(coach)/coach/page.tsx`, and `src/lib/coach-teaching-hours.ts`.
  - Teaching/payroll week boundaries now use Monday-Sunday instead of Sunday-Saturday, with deterministic Asia/Bangkok date keys shared by Admin Payroll, Coach Hours, and Coach Dashboard.
  - Expected June 2026 week mapping is now `2026-06-01 - 2026-06-07`, `2026-06-08 - 2026-06-14`, `2026-06-15 - 2026-06-21`, `2026-06-22 - 2026-06-28`, and `2026-06-29 - 2026-07-05`.
  - The coach payout close API validates client `weekStart/weekEnd` against the canonical Monday-Sunday teaching week and blocks overlapping legacy closed summaries before upsert. Existing `coach_weekly_teaching_summaries` records were not repaired, migrated, deleted, or rewritten.
  - `src/lib/coach-teaching-hours.ts` chunks `coach_checkins` reads as a read-only query transport fix for large queries; payroll rates, evidence requirements, attendance logic, and payable formula semantics were not changed beyond weekly grouping.
  - Production smoke passed for `/admin/payroll`: the `รายละเอียดชั่วโมงสอนโค้ช` modal loaded, Coach Tony NA Rama 2 showed Monday-Sunday ranges `1 มิ.ย. 69 - 7 มิ.ย. 69`, `8 มิ.ย. 69 - 14 มิ.ย. 69`, `15 มิ.ย. 69 - 21 มิ.ย. 69`, `22 มิ.ย. 69 - 28 มิ.ย. 69`, and `29 มิ.ย. 69 - 5 ก.ค. 69`; legacy ranges `31 พ.ค. 69 - 6 มิ.ย. 69` and `7 มิ.ย. 69 - 13 มิ.ย. 69` were not found.
  - Production smoke for `/coach` and `/coach/hours` loaded without crash and with console errors/warnings 0. Coach weekly visual rows remain `NEED REVIEW` only because the smoke coach session had no real weekly rows visible.
  - No DB changes, migrations, closed-summary repair/migration/delete, payroll rate changes, coach evidence requirement changes, attendance logic changes, payment/booking/wallet/Admin Makeup/SlipOK changes, write action clicks, `ปิดสัปดาห์` clicks, or extra deploys after smoke were performed.
- Admin financial visibility gating is deployed in production as of commit `846fb8097bee086c994c21b039568bc61592d08c`:
  - Deployment id `dpl_Gg64CoEQmxEuzj11bPqqCSVG1nxv`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/payments/page.tsx`, and `src/components/admin/payments-client.tsx`.
  - Owner policy: standard Admin does not need complete per-item amount redaction; the goal is to avoid easy visibility of revenue totals, aggregate summaries, and total amounts. `payment.notes` remains visible and is not sanitized/redacted in this scope.
  - `/admin` gates the monthly revenue query/card by role. Super Admin still sees `รายได้เดือนนี้`; standard Admin does not query/render the revenue card.
  - `/admin/payments` uses server-side role gating. Standard Admin does not receive/render approved amount summaries, incomplete booking total summaries, payment row amounts, incomplete booking row amounts, or detail/review amount fields; Super Admin sees amounts as before.
  - Standard Admin still sees payment/booking status, slip, payer info, Booking ID, Payment ID, branch/course/date/time, and the existing `สลิป` / `รายละเอียด` workflow controls.
  - Production smoke passed for Super Admin and standard Admin. Super Admin saw dashboard revenue `฿591,672`, payment approved amount `฿594,872`, incomplete total `฿8,500`, row amounts, and detail amounts. Standard Admin did not see those totals/amount fields and saw `ซ่อนยอดเงินตามสิทธิ์ผู้ใช้` where applicable.
  - Console errors were 0; the only warning was the existing unrelated Next dev LCP logo warning. No DB changes, migrations, payment status logic changes, SlipOK logic changes, write action clicks, or extra deploys after smoke were performed.
- Admin notifications low-enrollment count and hydration fixes are deployed in production:
  - Low-enrollment source commit `9b88fbdf98e9146941dd5ea01c32fa6abc79bfc3` (`fix(admin): align low-enrollment alert counts`) changed `src/app/(admin)/admin/notifications/page.tsx`; deployment id `dpl_JDhvkyBxHzzSmMNqmpoUvHPJ6CqX`; production alias `https://www.newathleteschool.com`; status Ready.
  - React hydration source commit `953edc93266ea81f3b84afd0ee0fbe3cd3de3f05` (`fix(admin): stabilize notifications hydration`) changed `src/app/(admin)/admin/notifications/page.tsx` and `src/components/admin/notifications-admin-client.tsx`; deployment id `dpl_FFzuVkJqFGNrAnHFzbpBBySzc3Jz`; production alias `https://www.newathleteschool.com`; status Ready.
  - Low-enrollment root cause: the old alert counted only `booking_sessions.status === scheduled` and did not require `bookings.status = verified`, so the 2026-06-21 10:00 Ratchaphruek-Taling Chan kids_group round excluded 4 verified completed learners and counted 1 pending_payment scheduled learner.
  - Low-enrollment alert logic now counts only verified bookings, counts real learner statuses `scheduled`, `completed`, and `absent`, excludes `rescheduled`, `walleted`, `cancelled`, and non-verified bookings, groups by `schedule_slot_id` first, and falls back to `date + start_time + end_time + branch_id + course_type_id`. It also uses Asia/Bangkok-safe date logic and paginates/range-batches instead of relying on `.limit(700)`.
  - Data proof for schedule slot `02aa539d-b602-4a95-9ade-5a0285e0ae6f`: old alert count was 1, new verified real learner count is 4, and 4 is above the low-enrollment threshold of 2, so the round should not show as low-enrollment.
  - After deploying the low-enrollment fix, production `/admin/notifications` reproduced React minified error #418 on initial load. The root cause was non-deterministic client/server date rendering: `toLocaleString('th-TH')` without fixed timezone, `todayCount` using runtime `new Date().toDateString()`, and locale sorting without an explicit deterministic tie-breaker.
  - Hydration fix: notification date formatting now uses `Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', ... })`, the server sends a deterministic Bangkok `todayDateKey`, `todayCount` compares against Bangkok date keys, and sort paths use explicit `th-TH` locale plus stable id tie-breakers.
  - Verification passed before final deploy: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings where applicable.
  - Local authenticated `/admin/notifications` smoke passed after two hard refreshes: console errors/warnings were 0, no React hydration error, no React #418, no text mismatch, and sections rendered for urgent work, recommendations, customer follow-up, and low-enrollment.
  - Production smoke after final deploy passed: `/admin/notifications` loaded with Admin session and no redirect; fresh cache-buster load, two hard refreshes, and a read-only click on the recommendations tab produced console errors/warnings 0, no React #418, no hydration error, no text mismatch, and all notification sections rendered. The old 2026-06-21 UI case is `NEED REVIEW` only because it is outside the current window; source/data proof confirms the new count is 4 and above threshold.
  - No DB changes, migrations, write actions, Admin Makeup changes, Lesson Wallet changes, SlipOK changes, payment/booking write logic changes, docs changes before smoke, or extra deploys after final smoke were performed.
- Attendance display derivation no longer treats a learner as absent merely because another learner in the same slot/group has attendance. A past session without exact learner attendance now stays in `attendance_gap_review`; `absent` requires exact attendance/source-of-truth evidence or an explicitly synced absent session.
- Admin makeup check-in evidence regression guard, added 2026-06-08:
  - The review section "ต้องตรวจสอบการเช็คชื่อก่อนสรุปขาดเรียน" must not show coach check-in evidence for a learner session unless that learner is linked to a `coach_assignment_groups` row and the `coach_checkins` row matches the exact `schedule_slot_id + coach_id`.
  - A same-slot check-in from another coach must not be displayed as evidence when the learner session still says "ยังไม่พบโค้ชในกลุ่ม".
  - If a future report shows "ยังไม่พบโค้ชในกลุ่ม" together with "ได้เช็คอินแล้ว", first run read-only debug against `booking_sessions`, `coach_assignment_groups`, `coach_assignment_group_students`, `coach_checkins`, and `attendance` before changing code or data.
  - Expected proof table should include: `booking_session_id`, learner name, `schedule_slot_id`, group id, group coach id/name, slot check-in coach id/name, exact-pair check-in result, slot-only check-in result, and attendance status.
  - Safe fix direction, if root cause is confirmed again: remove slot-only check-in evidence from the Admin makeup review display and require exact group coach evidence only; keep slot-only data as diagnostic metadata at most.
  - Read-only proof on 2026-06-08 confirmed this exact pattern for 2026-06-07 16:00-18:00 at สุวรรณภูมิ: learner session `7513b5d0-f5c4-43d8-bb61-bac051c97e09` had no `coach_assignment_group_students` link and no exact coach evidence, while the same `schedule_slot_id` had check-ins from other assigned coaches. This is a slot-only fallback contamination bug, not proof that the ungrouped learner's coach checked in.
  - Scoped source fix on 2026-06-08 removed the slot-only check-in fallback from `src/app/(admin)/admin/makeup/page.tsx`. Admin makeup now passes coach check-in evidence only when the learner session is linked to a coach assignment group and the check-in matches the exact `schedule_slot_id + coach_id`.
  - Post-fix read-only proof for session `7513b5d0-f5c4-43d8-bb61-bac051c97e09` showed `slot_only_has_checkin=true` but `new_server_would_show_checkin_for_no_group=false`.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, and `npm run build`.
  - No DB writes, migration, commit, push, or deploy were run for this scoped fix.
- Admin schedules vs Admin makeup assignment-source regression guard, added 2026-06-08:
  - Reported pattern: `admin/schedules` can show coach names on a learner row while `admin/makeup` says the same learner session has no coach in group / no exact coach check-in.
  - This must be debugged before any source or DB change because `admin/schedules` may display slot-level or legacy coach fallback while `admin/makeup` intentionally requires exact learner-group evidence.
  - Required invariant: learner-level coach display must come from exact `coach_assignment_group_students.booking_session_id -> coach_assignment_groups.coach_id` when deciding whether that learner has an assigned coach.
  - `coach_assignments` or other slot-level coach lists may be diagnostic/legacy context only; they must not prove that a specific learner is assigned to that coach.
  - Read-only proof table must include: `booking_session_id`, learner name, `schedule_slot_id`, branch/course/time, exact group id/name, exact group coach id/name, all same-slot groups/coaches, legacy `coach_assignments` coaches, exact-pair coach check-in result, and exact learner attendance status.
  - Safe fix direction if confirmed: make `admin/schedules` distinguish exact learner coach assignment from slot-level/legacy coach context, and do not weaken `admin/makeup` exact-evidence rules.
  - Read-only proof on 2026-06-08 for Tin session `fcd3e6ea-bac1-4513-8261-ff26e931f7ce`: exact `coach_assignment_group_students` count is 0, exact check-ins count is 0, and exact attendance count is 0. The same `schedule_slot_id` has other groups and legacy slot coaches for other learners only. Therefore `admin/makeup` is correct to show no coach in group; `admin/schedules` must not show same-slot or legacy coaches as Tin's assigned coaches.
  - Scoped source fix on 2026-06-08 removed slot-level/legacy coach fallback from `src/app/(admin)/admin/schedules/page.tsx` and from `adminAttendanceState.getCoachNames`. Admin schedules now shows coach names only from exact learner assignment groups (`coach_assignment_group_students.booking_session_id -> coach_assignment_groups.coach_id`).
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, and `npm run build`.
  - No DB writes, migration, commit, push, or deploy were run for this scoped fix.
- Admin payroll teaching-hours regression guard, added 2026-06-08:
  - Reported pattern: `/admin/payroll` showed 0 coaches / 0 assigned rounds / 0 payable hours for June 2026 even though production data had assigned groups, verified bookings, coach check-ins, and attendance.
  - Read-only proof showed June 2026 source data existed: hundreds of schedule slots and assignment groups, 908 payable grouped sessions by status, 86 coach check-ins, 208 attendance rows, and about 394 potential payroll source rows.
  - Root cause: the payroll page used the normal user-session Supabase client for sensitive payroll source tables and did not run an explicit Admin page guard, while `getCoachTeachingHourSourceRows` ignored Supabase query errors and could silently return empty rows.
  - Source fix on 2026-06-08: `src/app/(admin)/admin/payroll/page.tsx` now requires Admin page access and uses `getServiceRoleClient()` server-side for payroll summaries, teaching rules, and teaching-hour source rows. The service key remains server-only.
  - Source fix on 2026-06-08: `src/lib/coach-teaching-hours.ts` now throws descriptive errors for every Supabase query failure instead of silently treating failed reads as empty payroll data.
  - Payroll business rules were not changed: verified teaching evidence still requires active assigned learners, verified bookings, valid session lifecycle status, exact coach/slot check-in, photo, GPS, and attendance.
  - Verification passed locally: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
  - No DB writes, migration, cleanup, commit, push, or deploy were run for this scoped fix.
- Read-only verification on 2026-06-04 for June 2026 coach assignment groups:
  - groups: 197
  - group session ids: 422
  - chunks: 6
  - active grouped sessions: 405
  - query errors: 0
- Commit `48e3faa` (`fix(prod): stabilize coach checkin audit and child booking guards`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-04.
- Commit `86aa087` (`fix(makeup): improve attendance gap round handling`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-05.
  - Vercel deployment id reported by CLI: `dpl_G79NWgVY7R4PMC2FsiMArXRhN4SS`.
  - Production alias reported by Vercel CLI: `https://www.newathleteschool.com`.
  - Pre-deploy checks passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
  - Scope: Admin makeup attendance-gap round handling, exact coach evidence, no-coach round resolution, and round-level Admin actions.
  - Remaining risk: manual production/local smoke for Admin makeup round-level flows is still pending. Do not perform production write actions for smoke unless the owner explicitly confirms the exact case.
- Documentation sync verification on 2026-06-05:
  - `npm run check:mojibake` passed.
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed.
  - `npm run attendance:reconcile:dry-run` passed with 0 student-scope attendance mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm run build` passed.
  - `npm run prod:check` passed with warning that local `SLIPOK_TEST_MODE=true`; production must keep real SlipOK env configured.
  - `git diff --check` reported only LF/CRLF warnings for the documentation files.
- False-absent display fix verification on 2026-06-05:
  - `npm run check:mojibake` passed.
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed.
  - `npm run attendance:reconcile:dry-run` passed with 0 student-scope attendance mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm run build` passed.
- Production alias reported by Vercel CLI: `https://www.newathleteschool.com`.
- Historical child FK/name integrity repair on 2026-06-04 fixed one target booking where Admin schedule displayed the parent name as learner:
  - parent profile: `211069ab-7a7d-457d-8b22-f76e8d3ecae3`
  - child row: `65a94ede-296e-4bbe-9bab-2aaf03b99c7e`
  - booking: `080c8a56-9b67-4a83-a44b-5a0394f4b73f`
  - affected `booking_sessions`: 16 rows, repaired from `child_id=null` to the target child id
  - post-write sample join resolves to child name `สัจจธร ธิติศักดิ์สกุล` / nickname `น้องอองเดร`
- Admin schedule now has a UI guard for child bookings with missing `child_id`, so it flags missing child linkage instead of silently showing the parent as the learner. Coach assignment state is also color-coded: assigned coach is green, missing coach is red.
- Next production focus should be role smoke testing and any broader historical child FK audit only if new evidence appears.
- Auth UX polish on 2026-06-06 added password visibility toggles to login/register password fields in the Home auth modal and direct auth pages. This is UI-only and does not change Supabase auth, redirects, email confirmation, or validation behavior.

## Worktree Notes

- Historical note: before the documentation sync after `86aa087`, `git status --short` showed an untracked `SlipOK API Guide.docx`.
- Current note for the 2026-07-09 documentation verification pass: `git status --short` was clean before edits, and `SlipOK API Guide.docx` was not present in the workspace.

If a local guide/document appears again in future work, treat it as out of scope unless the owner explicitly asks to commit, delete, or move it.

## 2026-06-12 - New Machine Handoff Readiness

- Local repo was re-checked after moving to the new machine.
- Current branch: `spike/next-major-security-upgrade`.
- Current HEAD: `cec49fd fix(user): align dashboard learner colors`.
- `node` is available as `v24.16.0`, which satisfies the repo engine requirement `>=20.9.0`.
- `npm.cmd` is available as `11.13.0`.
- Direct `npm` from PowerShell is blocked by Windows Execution Policy because `npm.ps1` cannot be loaded. Use `npm.cmd` and `npx.cmd` in this shell unless the owner changes the policy.
- `node_modules`, `package-lock.json`, `.env.local`, and `.next` are present locally.
- Local `.env.local` values were not printed or inspected directly, but `npm.cmd run prod:check` confirmed the required Supabase environment variables are present.
- Verification after the move passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run prod:check`
- Historical result at that time: `npm.cmd run prod:check` reported `SLIPOK_TEST_MODE=true` as a warning and recommended live mode. This guidance is superseded by the 2026-07-11 Owner-approved shared Test Mode policy above.
- `npm.cmd run build` was not run in this readiness pass because no source code changed and the project handoff guide requires a dev-server/static-chunk cleanup cycle after build work.

## 2026-06-12 - Phase 3 Read-Only Role Smoke Readiness

- Read-only scope only: no source code changes, no DB writes, no migrations, no payment/booking/wallet/coupon/assignment/payroll-close actions.
- Read `PRODUCTION_READINESS.md` and `DEVELOPMENT_TODO.md` section `21. Phase 3 Deploy Readiness`.
- Local dev server was started only for smoke testing at `http://127.0.0.1:3000` and stopped after the smoke pass.
- Public page smoke passed:
  - `/` loaded with non-empty content and no browser console errors captured.
  - `/ranking` loaded with non-empty ranking content and no browser console errors captured.
  - `/auth/login` loaded the login form.
  - `/auth/register` loaded the registration form.
- Unauthenticated auth-guard smoke passed:
  - `/dashboard`, `/dashboard/schedule`, `/dashboard/lesson-wallet`
  - `/coach`, `/coach/today`, `/coach/checkin`, `/coach/attendance`
  - `/admin`, `/admin/schedules`, `/admin/makeup`, `/admin/payroll`
  - All protected routes redirected to `/auth/login?redirect=...` and loaded the login page.
- Authenticated role page-load/empty-state smoke remains `Need verification` because the in-app browser did not have an authenticated test session and no role-specific test credentials were provided in this read-only round.
- Read-only verification passed:
  - `npm.cmd run prod:check` with the expected local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run check:mojibake`
- Dev server log showed one non-blocking Next.js LCP image recommendation for `/logo new-athlete-school.jpg`. No code change was made.

## 2026-06-12 - Authenticated Role Smoke Readiness Partial

- Owner approved opening Coach/Head Coach pages even though `src/app/(coach)/layout.tsx` may create coach notification rows on page load.
- Test credentials were used only through the browser UI. Passwords were not written to files or documentation.
- Local dev server was started only for smoke testing at `http://127.0.0.1:3000` and stopped after the smoke pass.
- User smoke passed:
  - Login redirected to `/dashboard`.
  - `/dashboard`, `/dashboard/schedule`, and `/dashboard/lesson-wallet` loaded with non-empty content.
  - User guard redirected `/coach` and `/admin` back to `/dashboard`.
  - No browser console errors were captured for the User routes.
  - Lesson wallet showed real action buttons such as `ใช้วันเรียน`; they were not clicked.
- Coach/Head Coach smoke partially passed:
  - The supplied Coach account displayed as `Super Head Coach (หัวหน้า)`, not as a standard Coach account.
  - `/coach`, `/coach/today`, `/coach/checkin`, and `/coach/attendance` loaded.
  - `/coach/assign-groups` was accessible and loaded, consistent with the displayed Head Coach status.
  - `/admin` redirected back to `/coach`.
  - No browser console errors were captured for the Coach/Head Coach routes.
  - Risky buttons such as check-in and assignment-group actions were visible but not clicked.
- Super Admin smoke partially passed:
  - Login redirected to `/admin`.
  - `/admin`, `/admin/schedules`, `/admin/makeup`, `/dashboard`, and `/coach` loaded during the observed pass.
  - Super Admin menu showed Super Admin-only items including `Activity Log` and `ตั้งค่าระบบ`.
  - `/admin/makeup` loaded but emitted a React hydration mismatch console error. The mismatch sample showed server/client text difference for a learner display (`ZEN` vs Thai learner name) inside `MakeupClient`.
  - After the `/admin/makeup` hydration error, the same browser tab continued reporting that error on later navigations. A clean per-route recheck was attempted, but browser navigation timed out before completing the confirmation pass.
- Standard Admin smoke remains `Need verification` because no standard Admin account was provided.
- Standard Coach smoke remains `Need verification` because the supplied Coach account displayed Head Coach privileges.
- Head Coach smoke is partially covered by the supplied Head Coach-like account and Super Admin coach surface, but a true standalone Head Coach account is still `Need verification` if role-specific permissions must be proved.
- No source code changes, DB migrations, payment/booking/wallet/coupon/payroll-close actions, commit, push, deploy, or `SlipOK API Guide.docx` action were performed.

Potential bug found:

- `/admin/makeup` has a hydration mismatch in the browser console during authenticated Super Admin smoke.
- Suggested debug plan before any code change:
  - Reproduce `/admin/makeup` in a fresh browser tab/session and capture the exact hydration mismatch segment.
  - Inspect `src/app/(admin)/admin/makeup/page.tsx` and the `MakeupClient` rendering path for nondeterministic ordering, locale/date formatting, or server/client learner-name fallback differences.
  - Verify whether row ordering or display-name selection can change between SSR and hydration.
  - Only after root cause is proven, propose a scoped source fix and run `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, and targeted browser smoke.

## 2026-06-12 - Admin Makeup Hydration Fix + Super Admin Clean Recheck

- Scoped debug reproduced `/admin/makeup` in a fresh tab with the authenticated Super Admin browser session.
- Root cause proved source-only:
  - `MakeupClient` sorted learner names with default `localeCompare`.
  - Node SSR sorted `['ZEN', 'โซเลน']` as `['โซเลน', 'ZEN']`.
  - Browser hydration sorted the same names as `['ZEN', 'โซเลน']`.
  - React therefore reported a text mismatch inside the learner card (`ZEN` vs `โซเลน`).
- Scoped fix:
  - `src/components/admin/makeup-client.tsx` now uses an explicit Thai-locale comparator with deterministic code-point/id tie-breakers for learner-name sort paths used by MakeupClient.
  - No Admin makeup action flow, API route, database data, migration, payment, booking, lesson wallet, coupon, assignment, or payroll-close logic was changed.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: stopped dev server, removed generated `.next`, restarted dev server.
  - Browser smoke: fresh `/admin/makeup?smoke=after-fix` tab loaded with heading `วันชดเชย`, no fresh console error/warn, and no hydration mismatch.
- Super Admin clean-tab recheck after the fix passed with no fresh console error/warn:
  - `/admin/payroll`
  - `/admin/settings`
  - `/admin/users`
  - `/admin/branches`
  - `/admin/coaches`
- No DB writes, migrations, write actions, payment/booking/wallet/coupon/assignment/payroll-close actions, commit, push, deploy, or `SlipOK API Guide.docx` action were performed.

## 2026-06-12 - Standard Admin Authenticated Smoke

- A Standard Admin test account was used only through the browser UI. Passwords were not written to files or documentation.
- Local smoke remained read-only: no Admin write buttons were clicked, no DB writes, migrations, payment/booking/lesson wallet/coupon/assignment/payroll-close actions, commit, push, deploy, or `SlipOK API Guide.docx` action were performed.
- Login redirected to `/admin`.
- Standard Admin menu was permission-scoped for this account. Visible admin menu entries were:
  - `/admin`
  - `/admin/schedules`
  - `/admin/users`
  - `/admin/ranking`
  - `/admin/payments`
  - `/admin/coupons`
  - `/admin/complaints`
  - `/admin/notifications`
- Visible/allowed route smoke passed with no fresh browser console error/warn:
  - `/admin` loaded with heading `ภาพรวมระบบ`.
  - `/admin/schedules` loaded with heading `ตารางเรียน`.
  - `/admin/users` loaded with heading `จัดการนักเรียน / ผู้ปกครอง`.
  - `/admin/ranking` loaded with heading `อันดับนักเรียน`.
  - `/admin/payments` loaded with heading `ตรวจสอบการชำระเงิน`.
  - `/admin/coupons` loaded with heading `คูปองส่วนลด`.
  - `/admin/complaints` loaded with heading `ร้องเรียน`.
  - `/admin/notifications` loaded with heading `แจ้งเตือน`.
- Permission/guard smoke passed with direct navigation redirecting back to `/admin` and no fresh browser console error/warn:
  - `/admin/makeup`
  - `/admin/payroll`
  - `/admin/settings`
  - `/admin/logs`
  - `/admin/branches`
  - `/admin/coaches`
  - `/admin/coach-checkins`
  - `/admin/finance`
  - `/admin/teaching-programs`
  - `/admin/schedule-templates`
  - `/admin/booking`
- Cross-portal route smoke matched current `ROLE_ROUTES` behavior:
  - `/coach` loaded for Standard Admin with the coach surface and no assignment-groups menu text.
  - `/dashboard` loaded for Standard Admin.
  - `/profile` loaded for Standard Admin.
- Logout returned to `/`.
- Owner clarified Standard Coach UI expectation: same as Head Coach except without the assignment/round-group menu. A role-pure Standard Coach browser smoke is still `Need verification` unless a Standard Coach account is provided.

## 2026-06-12 - Phase 3 Local Release Readiness Verification

- Scope was verification-only: no feature work, no commit, no deploy, no DB writes, no migrations, no write-action clicks, and no `SlipOK API Guide.docx` action.
- Diff review covered only:
  - `src/components/admin/makeup-client.tsx`
  - `PROJECT_STATE.md`
  - `TODO-CODEX.md`
- Diff review result:
  - `src/components/admin/makeup-client.tsx` only adds deterministic Thai-locale learner-name sorting plus stable tie-breakers inside `MakeupClient`.
  - The source change is scoped to render ordering for Admin makeup hydration stability. It does not change Admin makeup actions, API routes, attendance/payment/booking/wallet/coupon/assignment/payroll-close behavior, DB data, or migrations.
  - `PROJECT_STATE.md` and `TODO-CODEX.md` only document local readiness, smoke results, the hydration root cause/fix, and remaining verification gaps.
  - Credential scan across the three scoped files found no supplied email/password strings.
  - No out-of-scope source logic was found in the reviewed diff.
- Command verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run`
  - `npm.cmd run prod:check`
  - `git diff --check`
- `attendance:reconcile:dry-run` remained report-only and showed 1060 verified teaching sessions checked, 295 attendance rows checked, 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
- Historical result at that time: `prod:check` returned `READY WITH WARNINGS/PASSES` and treated `SLIPOK_TEST_MODE=true` as a warning. This guidance is superseded by the 2026-07-11 Owner-approved shared Test Mode policy above.
- `git diff --check` reported only Windows LF/CRLF working-copy warnings, not whitespace errors.
- Browser smoke attempt:
  - Local dev server started at `http://127.0.0.1:3000` only for smoke and was stopped afterward.
  - In-app browser loaded `/auth/login`, but Super Admin login did not establish an authenticated session in this smoke attempt. Direct admin route attempts redirected to `/auth/login?redirect=...`.
  - Browser console showed only the known Next.js LCP image warning for `/logo new-athlete-school.jpg`; no fresh hydration mismatch was captured in the attempted admin-route tabs.
  - Because authenticated admin session was not established in this browser attempt, the requested fresh-tab browser smoke for `/admin/makeup`, `/admin`, `/admin/schedules`, `/admin/payments`, and `/coach` is `Need verification` for this release-readiness pass.
- Release gate for this pass:
  - `PASS`: scoped diff review and command verification.
  - `NEED VERIFICATION`: authenticated browser smoke in a clean session for Super Admin admin routes and Coach/Head-Coach `/coach`; role-pure Standard Coach browser smoke.
  - `RISK / OWNER APPROVAL REQUIRED`: production deploy, production writes, Admin makeup write-action UAT, live SlipOK verification, and any commit/deploy decision.
  - `BLOCKER`: none found in source checks; browser smoke remains incomplete because auth/session could not be established in the in-app browser attempt.

## 2026-06-12 - Super Admin Authenticated Release Smoke Recheck

- Owner logged in as Super Admin locally, then the Chrome connector saw the authenticated `http://127.0.0.1:3000/admin` session.
- Scope remained read-only: no commit, deploy, DB writes, migrations, payment/booking/wallet/coupon/assignment/payroll-close actions, or Admin makeup write-action clicks.
- Fresh-tab Chrome smoke passed for the requested Super Admin routes:
  - `/admin/makeup` loaded with heading `วันชดเชย`, did not redirect to login, had no fresh console errors, and had no React hydration mismatch.
  - `/admin` loaded with heading `ภาพรวมระบบ`, did not redirect to login, had no fresh console errors, and had no hydration mismatch.
  - `/admin/schedules` loaded with heading `ตารางเรียน`, did not redirect to login, had no fresh console errors, and had no hydration mismatch.
  - `/admin/payments` loaded with heading `ตรวจสอบการชำระเงิน`, did not redirect to login, had no fresh console errors, and had no hydration mismatch.
- `/admin/makeup` still displayed real write-action buttons such as retrospective attendance, confirm absent, return entitlement, close case, and send-to-coach actions; none were clicked.
- Release gate after this recheck:
  - `PASS`: scoped source diff review, command verification, and Super Admin authenticated smoke for `/admin/makeup`, `/admin`, `/admin/schedules`, and `/admin/payments`.
  - `NEED VERIFICATION`: role-pure Standard Coach browser smoke and any Coach/Head-Coach release-gate route not covered by the latest Super Admin admin-route recheck.
  - `RISK / OWNER APPROVAL REQUIRED`: commit, deploy, production writes, live SlipOK verification, and Admin makeup write-action UAT.
  - `BLOCKER`: none found in the checked source/commands/Super Admin smoke routes.

## 2026-06-13 - Owner-Approved Angie Attendance Repair

- Root cause proved before write:
  - Admin closed the target `/admin/makeup` review with `attendance_gap_closed_no_action`.
  - That close action only created an `activity_logs` row and hid the Admin review queue item.
  - The underlying source-of-truth data still had `booking_sessions.status = scheduled` and no exact `attendance` row, so Coach/User surfaces continued deriving `attendance_gap_review`.
- Exact target repaired:
  - learner: `ชนกนันท์ สุขวงศ์` / `แองจี้`
  - `booking_sessions.id`: `734ce70b-5a6d-4bf0-9544-0deb631aee26`
  - `booking_id`: `a7b06735-ce69-43dc-ae35-c67e24328c0a`
  - `child_id` / expected `attendance.student_id`: `900ebb5d-2eb1-4143-82a0-86e47757338b`
  - `schedule_slot_id`: `69bb4231-6472-4376-931a-57ac9a4570dc`
  - date/time: `2026-06-07` `13:00:00-15:00:00`
  - branch/course: Chaengwattana / `kids_group`
- Owner-approved data repair performed:
  - inserted exact `attendance` row `9582fab4-151c-4a85-a36d-05aab5802ef0` with `status = absent`, `student_type = child`, and assigned coach `95bf2081-e9f9-4aa1-883c-7294d2b8ce33`.
  - synced `booking_sessions.status` for `734ce70b-5a6d-4bf0-9544-0deb631aee26` to `absent`.
  - inserted audit log `3cef354c-939d-4937-9c53-705ab8f25ef2` with action `attendance_gap_confirm_absent`, referencing previous close log `3c2ef466-ec6c-49f7-970a-badbd196c951`.
- Post-write verification:
  - exact attendance count for the target session/student is 1 and status is `absent`.
  - target session status is `absent`.
  - no lesson wallet credit was created by this repair.
  - no coach check-in row was created.
  - no weekly teaching summary row was created for the assigned coach/date.
  - source/data projection now derives the target User/Admin status as `absent` instead of `attendance_gap_review`.
  - Coach attendance slot summary can count the learner as checked because exact attendance exists, but `src/components/coach/attendance-client.tsx` still has a separate card-level `isLocked = !slot.checkin` warning path. That is a follow-up UI/logic issue and was not changed in this data repair.
  - `npm.cmd run attendance:reconcile:dry-run` passed with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
- No source code, migrations, payment, booking, lesson wallet redemption, coupon, assignment, payroll close, commit, push, deploy, or `SlipOK API Guide.docx` action was performed in this repair.
- Follow-up risk remains: the Admin Makeup `close_review` UX can still be misused for sudden-leave/absence cases. Future source fix should be scoped and owner-approved before changing action semantics or UI copy.

## 2026-06-13 - Coach UI Attendance/Check-in State Sync

- Scoped source fix only; no DB writes, migrations, API write logic, check-in evidence rules, payroll calculation, payment, booking, lesson wallet, coupon, assignment, payroll close, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
- Fixed Coach UI display state after an attendance row already exists but the slot has no coach check-in:
  - `src/components/coach/attendance-client.tsx` now distinguishes the UI gate `no check-in + no attendance yet` from `no check-in + attendance already recorded`.
  - `src/components/coach/attendance-client.tsx` still disables attendance write buttons when there is no check-in, preserving the existing coach write guard.
  - `src/app/(coach)/coach/page.tsx` now shows pending check-in CTA/status only for today's slots that still have no check-in and incomplete attendance, instead of treating every no-check-in slot as pending.
- `/coach/today` was inspected and already had a complete-attendance display path, so it was not changed.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: stopped the dev server on port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified `/` plus a `_next/static` CSS asset returned HTTP 200.
  - `git diff --check` reported only Windows LF/CRLF warnings, not whitespace errors.
- Browser smoke notes:
  - A headless Chrome smoke before restart logged in with the supplied Coach/Head-Coach account and loaded `/coach`, `/coach/today?date=2026-06-07`, and `/coach/attendance?date=2026-06-07&slot=69bb4231-6472-4376-931a-57ac9a4570dc` with no console errors.
  - That account did not show the target Angie slot, so exact target visual verification remains `Need verification` with the real assigned coach account or an authenticated session that can see that slot.
  - A post-restart retry stayed on `/auth/login` and did not establish a session before timeout; no console error was captured.

## 2026-06-13 - Coach Hours No-Teaching Label Sync

- Scoped source/UI fix only; no DB writes, migrations, API write logic, check-in evidence rules, payroll calculation, payment, booking, lesson wallet, coupon, assignment, payroll close, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
- Fixed `/coach/hours` display for all-absent rounds where no class happened and the coach did not check in:
  - `src/lib/coach-teaching-hours.ts` now carries attendance status counts (`present_count`, `late_count`, `absent_count`) in addition to total `attendance_count`.
  - `src/app/(coach)/coach/hours/page.tsx` now displays `ไม่มีการสอน - ไม่มีผู้เรียนในรอบนี้` when every learner in the row has exact absent attendance and there is no coach check-in.
  - The same no-teaching row is no longer counted as a missing-evidence warning in `/coach/hours`; the row remains not counted for hours.
- Payroll/teaching-hour calculation semantics were intentionally not changed in this scoped label sync. Any future rule change for all-absent rows that already have coach check-in evidence must be scoped and owner-approved separately.
- Read-only target proof for Angie session `734ce70b-5a6d-4bf0-9544-0deb631aee26` confirmed `session_status=absent`, `attendance_total=1`, `absent_count=1`, `present_count=0`, `late_count=0`, and the new no-teaching label predicate evaluates to `true`.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: stopped the dev server on port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified `/` plus a `_next/static` CSS asset returned HTTP 200.
  - `git diff --check` reported only Windows LF/CRLF warnings, not whitespace errors.
- Authenticated browser visual smoke for `/coach/hours` remains `Need verification` with a real coach session that can see the target slot. Passwords were not written to files or scripts for this verification.

## 2026-06-13 - Phase A Status Derivation Audit

- Read-only audit only. No source code, DB data, migrations, refactors, payroll behavior, attendance behavior, makeup behavior, commit, deploy, or `SlipOK API Guide.docx` action was performed.
- Files audited:
  - `src/lib/session-attendance-status.ts`
  - `src/lib/admin-attendance-state.ts`
  - `src/lib/attendance-write-through.ts`
  - `src/lib/coach-teaching-hours.ts`
  - `src/app/(coach)/coach/page.tsx`
  - `src/app/(coach)/coach/today/page.tsx`
  - `src/app/(coach)/coach/hours/page.tsx`
  - `src/components/coach/attendance-client.tsx`
  - `src/app/(admin)/admin/schedules/page.tsx`
  - `src/app/(admin)/admin/makeup/page.tsx`
  - `src/components/admin/payroll-client.tsx`
  - read-only payroll API context: `src/app/api/admin/coach-payouts/route.ts`
- Status groups identified:
  - Learner attendance status: exact `attendance` row should lead; `booking_sessions.status` and date/time are fallback/cache only.
  - Teaching slot status: Coach dashboard/today/attendance derive slot state locally from check-in plus per-student attendance completion.
  - Coach evidence status: `src/lib/coach-teaching-hours.ts` derives evidence from assignment groups, active learner sessions, coach check-in, photo, GPS, and attendance counts.
  - Admin review status: `/admin/makeup` combines learner attendance state with `activity_logs` review request/closed actions.
  - Payroll status: Admin payroll and payout close use `row.is_verified` from coach teaching-hour source rows and separate missing-evidence counts.
- Confirmed audit findings:
  - Admin learner display is mostly aligned where it uses `src/lib/admin-attendance-state.ts`, especially `/admin/schedules` and `/admin/makeup`.
  - Coach surfaces still contain duplicated slot/check-in/attendance summary logic across `/coach`, `/coach/today`, and `attendance-client`.
  - `/coach/hours` now has a display-only no-teaching/all-absent path, but Admin payroll and payout close still use the original evidence/payroll semantics. Payroll behavior must not be changed without a separate owner-approved scope.
  - `/admin/makeup` review close state is separate from learner attendance state. A closed review can hide a queue item without changing attendance; this is intentional in current code but remains a UX/process risk after the Angie incident.
- Suspicious or needs-verification items:
  - `scopeAttendanceCount` is accepted by `deriveSessionAttendanceStatus` but is not currently used by the helper.
  - `getCoachTeachingHourSourceRows` treats any attendance evidence as `has_attendance`; the business rule for all-absent rows with full coach evidence needs owner confirmation before payroll changes.
  - `/coach` pending evidence counts do not share the exact same no-teaching exclusion that `/coach/hours` now uses.
  - `src/components/admin/payroll-client.tsx` has evidence badge logic duplicated from `/coach/hours` and can still label no-check-in/all-absent rows as missing check-in from a payroll-evidence perspective.
- Draft direction for Phase B:
  - Start display-only. Create or extend shared derivation helpers only after choosing the smallest contract boundary.
  - Keep payroll calculation/close semantics separate from Coach UI display semantics until the owner approves exact payroll rules.
  - Keep Admin Makeup write/action semantics separate from display status cleanup.
  - Verify with `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, and targeted browser smoke for the touched routes.

## 2026-06-13 - Phase B.1 Coach Display Status Sync

- Scoped Coach display/read-only status source fix only. No DB data, migrations, payroll calculation, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, attendance write behavior, commit, deploy, or `SlipOK API Guide.docx` action was performed.
- Added `src/lib/coach-slot-display-status.ts` as a small pure helper for Coach slot display state.
- Normalized Coach display slot states for:
  - `/coach`
  - `/coach/today`
  - `/coach/attendance`
- Normalized statuses are display-only:
  - `no_learners`
  - `needs_checkin`
  - `checked_in_waiting_attendance`
  - `partial_attendance`
  - `attendance_complete`
  - `resolved_without_checkin`
- Source changes:
  - `src/app/(coach)/coach/page.tsx` now uses the shared helper for pending check-in display counts.
  - `src/app/(coach)/coach/today/page.tsx` now uses the shared helper for slot attendance badges and completed-result display.
  - `src/components/coach/attendance-client.tsx` now uses the shared helper for slot card badges, locked display state, completed count, and partial/resolved-without-checkin display.
- Preserved behavior:
  - Coach attendance write buttons are still disabled when the exact slot has no coach check-in.
  - No API write paths were changed.
  - Payroll/evidence calculation and Admin Makeup review/action semantics were not touched.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified `/` plus a `_next/static` CSS asset returned HTTP 200.
- Browser smoke:
  - Unauthenticated read-only smoke for `/coach`, `/coach/today`, and `/coach/attendance` redirected to `/auth/login?redirect=...` with no console errors.
  - Authenticated Coach visual smoke remains `Need verification` with a real Coach/Head-Coach session because the browser used for this smoke did not have a Coach session.
- Authenticated Coach smoke attempt after owner supplied a Coach account:
  - No source code, DB data, migrations, payroll calculation, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, attendance write action, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - The supplied account was used only through the browser login UI. Passwords were not written to project files or documentation.
  - Login did not succeed locally. `/auth/login` displayed `อีเมลหรือรหัสผ่านไม่ถูกต้อง` after the supplied credential attempt.
  - Because no authenticated Coach session was established, `/coach`, `/coach/today`, and `/coach/attendance` could not be authenticated-smoked in this pass.
  - Browser console during the login attempt showed only the known local Next.js LCP image warning for `/logo new-athlete-school.jpg`; no fresh console error was captured.
  - Gate for authenticated Coach smoke: `BLOCKER` at login credential/session establishment; route-level Phase B.1 authenticated visual status remains `NEED VERIFICATION`.
- Authenticated Coach smoke retry after owner logged in manually:
  - Used the existing Chrome session already logged in by the owner. No password was entered or written to files/docs.
  - Smoke remained read-only: no attendance save, check-in, payroll, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, DB write, migration, source code change, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - `/coach` loaded without redirect, heading `หน้าหลักโค้ช`, and no status conflict was observed.
  - `/coach/today` loaded without redirect, heading `ตารางสอนของฉัน`; observed completed/check-in labels were consistent, including `เช็คอินแล้ว` and `บันทึกผลครบแล้ว`.
  - `/coach/attendance` loaded without redirect, heading `เช็คชื่อนักเรียน`; observed summary showed complete slots, `ยังล็อก/รอเช็คอิน 0`, and `ยังเช็คไม่ครบ 0`. Slot badges showed `บันทึกผลครบแล้ว .../...` together with `เช็คอินแล้ว`.
  - No `partial attendance` case appeared in the visible smoke data, so partial label rendering remains covered by source/checks but not visually exercised in this browser pass.
  - Browser console showed no errors. Warning observed: known local Next.js `scroll-behavior: smooth` warning during route transitions.
  - Logout was performed after smoke as requested and returned to the public home page.
  - Gate result: `PASS` for authenticated Phase B.1 Coach smoke on `/coach`, `/coach/today`, and `/coach/attendance`; `NEED VERIFICATION` only for a real data case that visibly contains partial attendance.
- Phase B.1 release/deploy:
  - Commit `640519d` (`fix(coach): unify slot display status`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-13.
  - Full deployed commit: `640519dbc6b75c9186d7e47966b6f384f75999fc`.
  - Vercel deployment id: `dpl_7ZBqt1Fct47o5UAvwKiEDsH7pTVT`.
  - Deployment URL: `https://new-athlete-badminton-school-f73lmp4a8-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment was run from a clean temporary worktree pinned to commit `640519d`; the untracked `SlipOK API Guide.docx` was not included.
- Production post-deploy Coach smoke for Phase B.1:
  - Smoke remained read-only: no check-in, attendance save, payroll, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, DB write, migration, source change, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - Used the Coach account only through the production login UI. Passwords were not written to project files or documentation.
  - `/coach` loaded on `https://www.newathleteschool.com/coach` without redirecting back to login. Observed heading `หน้าหลักโค้ช`, 4 rounds today, and status text `สถานะเช็คชื่อไม่ค้างแล้ว 4/4 รอบ`; no visible status conflict was confirmed.
  - `/coach/today` loaded on `https://www.newathleteschool.com/coach/today` without redirecting back to login. Observed heading `ตารางสอนของฉัน`, `เช็คอินแล้ว`, and `บันทึกผลครบแล้ว` badges including `7/7`, `1/1`, and `4/4`; learner labels included `มาเรียนแล้ว` and `ขาดเรียน`.
  - `/coach/attendance` loaded on `https://www.newathleteschool.com/coach/attendance` without redirecting back to login. Observed heading `เช็คชื่อนักเรียน`, summary `รอบทั้งหมด 4`, `บันทึกผลครบแล้ว 4`, `ยังล็อก/รอเช็คอิน 0`, and `ยังเช็คไม่ครบ 0`; slot badges showed `บันทึกผลครบแล้ว .../...` together with `เช็คอินแล้ว`.
  - Browser console for all three route tabs showed no errors or warnings.
  - No visible `บันทึกผลบางส่วน` data appeared in production during this smoke, so partial-attendance visual label remains `NEED VERIFICATION` for a future real partial data case.
  - Gate result: `PASS` for production page load, auth redirect, console, and observed Coach display status on `/coach`, `/coach/today`, and `/coach/attendance`; `NEED VERIFICATION` only for a future visible partial-attendance data case.

## 2026-06-13 - Phase B.2 Admin Makeup Process Contract Audit

- Read-only audit only. No source code, DB data, migrations, production Admin Makeup actions, payroll calculation, payment, booking, lesson wallet, coupon, assignment, commit, deploy, or `SlipOK API Guide.docx` action was performed.
- Files audited:
  - `src/app/(admin)/admin/makeup/page.tsx`
  - `src/components/admin/makeup-client.tsx`
  - `src/app/api/admin/makeup/route.ts`
  - `src/lib/admin-attendance-state.ts`
  - `src/lib/session-attendance-status.ts`
  - `src/lib/attendance-write-through.ts`
- Confirmed Admin Makeup action behavior:
  - `close_review` writes only `activity_logs.action = attendance_gap_closed_no_action`; it does not write `attendance`, does not sync `booking_sessions.status`, does not create wallet credit, and intentionally hides the review/evidence queue item on `/admin/makeup`.
  - `confirm_absent` writes exact learner `attendance.status = absent`, syncs `booking_sessions.status = absent` through `attendance-write-through`, logs `attendance_gap_confirm_absent`, and notifies the user schedule.
  - `mark_attendance` writes exact learner `attendance.status = present|late|absent`, syncs `booking_sessions.status = completed|absent`, logs `attendance_gap_mark_retrospective`, and can create retrospective coach assignment/group context when no assigned coach exists and Admin selects a coach.
  - `return_entitlement` creates or reuses an active `lesson_wallet_credits` row, updates `booking_sessions.status = walleted`, logs `attendance_gap_return_entitlement`, and notifies the user wallet. It does not write `attendance`.
  - `request_coach_review` notifies assigned coach(es) to check attendance, logs `attendance_gap_request_coach_review`, and does not change attendance/session status.
  - `request_coach_evidence` requires exact learner attendance plus assigned coach, checks for complete coach check-in evidence, notifies coach(es) if evidence is missing, logs `attendance_gap_request_coach_evidence`, and does not change attendance/session status.
  - `resolve_unassigned_round` is a round-level flow for no-coach past rounds: creates retrospective assignment group/legacy assignment, writes exact attendance per learner, syncs each session status, logs `attendance_gap_resolve_unassigned_round`, and notifies users.
- Confirmed display/source contract:
  - `/admin/makeup` derives review queue visibility from `session-attendance-status`, exact learner attendance from `admin-attendance-state`, exact group coach/check-in evidence, and review activity logs.
  - `attendance_gap_closed_no_action` is review metadata only. It is not attendance proof and must not be treated as absence, completion, wallet, makeup entitlement, or coach-payable evidence.
  - Makeup entitlement creation is derived from exact absence/status display for missed sessions; review closure alone should not create entitlement.
- Suspicious behavior to plan before fixing:
  - `return_entitlement` has no API guard against an existing attendance row. If used on a coach-evidence review session that already has attendance, it can set `booking_sessions.status = walleted` while `attendance` still says present/late/absent, creating a source-of-truth conflict.
  - `mark_attendance` allows `attendance_status = absent`, which overlaps semantically with `confirm_absent` but logs a different activity action.
  - `close_review` is a high-risk UX action because it removes the Admin review item without changing User/Coach-visible attendance state.
  - Group-level actions loop across sessions one by one and are not transactional; partial success before a failure is possible for notifications/logs/status writes.
  - Creating a makeup session via `POST /api/admin/makeup` still updates scheduled source sessions to `absent` without writing an exact attendance row; treat this as legacy/high-risk and audit separately before changing.
- Draft process contract:
  - Attendance outcome actions must write exact `attendance` first and sync `booking_sessions.status` through `src/lib/attendance-write-through.ts`.
  - Review-only actions may notify/log but must not be used to imply attendance, wallet entitlement, or coach evidence.
  - Entitlement-return actions must be mutually exclusive with existing attendance unless the owner approves a special override flow.
  - Round-level no-coach actions should stay round-scoped so every learner in the same slot receives the same process decision.
- Recommended Phase B.2 fix plan, pending owner approval:
  - First source fix should be narrow and safety-oriented: guard `return_entitlement` against exact existing attendance and tighten UI copy/confirmation around `close_review`.
  - Second source fix, if owner approves, should decide whether `mark_attendance` should allow `absent` or whether all absent outcomes must use `confirm_absent`.
  - Keep payroll calculation, Admin Makeup POST/create-makeup behavior, and assignment semantics out of the first fix round.

## 2026-06-14 - Phase B.2-New.1 Admin Makeup Round-Level UX

- Scoped UI/UX source fix only. No DB data, migrations, payroll calculation, wallet/return-entitlement logic, create-makeup POST, payment, booking, coupon, assignment semantics, commit, deploy, or `SlipOK API Guide.docx` action was performed.
- Updated `src/components/admin/makeup-client.tsx` so Admin Makeup review groups now use two explicit UX paths:
  - Assigned-coach rounds show round-level actions: send/request coach review or evidence, record retroactive attendance for the whole round, and close the whole round.
  - No-coach rounds preserve the existing regression guard: only `จัดการเคสทั้งรอบ` is shown; per-learner action buttons and the three assigned-coach round actions are not shown.
- Added assigned-coach round modal for `บันทึกย้อนหลังทั้งรอบ`:
  - Lists every learner in the attendance-review round.
  - Requires a selected status for every learner before save is enabled.
  - Requires an audit reason before save is enabled.
  - Uses the existing `mark_attendance` PATCH write path per learner; no API semantics were changed.
  - Copy now states that complete attendance does not mean coach selfie/GPS/check-in evidence is complete.
- Per-learner primary buttons in the visible round review UI were replaced with explanatory copy directing Admins to use round-level actions.
- Preserved no-coach flow:
  - Existing no-coach dialog still opens from `จัดการเคสทั้งรอบ`.
  - Existing `resolve_unassigned_round` path and no-coach process semantics were not changed.
  - The no-coach learner-row warning remains visible: use the round button only so individual results do not split from the same round.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified `http://127.0.0.1:3000` returned HTTP 200.
- Authenticated local browser smoke for `/admin/makeup`:
  - Used Admin/Super Admin login UI only for smoke; passwords were not written to project files or docs.
  - Page loaded without redirect after login and showed the Admin Makeup review section.
  - Assigned-coach cards showed `ส่งให้โค้ชตรวจสอบรอบนี้` or `ขอหลักฐานโค้ชรอบนี้`, `บันทึกย้อนหลังทั้งรอบ`, and `ปิดเคสทั้งรอบ`.
  - Assigned-coach learner rows no longer showed visible per-person primary buttons such as `ยืนยันขาด` or `คืนสิทธิ์`.
  - The assigned-coach round attendance modal opened read-only; save was disabled while statuses/reason were incomplete, and the evidence-vs-attendance copy was visible.
  - No-coach cards showed only `จัดการเคสทั้งรอบ`; no assigned-coach three-button set or per-person action buttons were visible.
  - The existing no-coach dialog opened read-only and was closed without saving.
  - Browser console showed no errors. One known local Next.js dev warning appeared about `scroll-behavior: smooth`.

## 2026-06-14 - Phase B.2-New.2 No-Coach Assign-Only Flow

- Scoped Admin Makeup API/UI source fix only. No direct DB data repair, migrations, payroll calculation, wallet/return-entitlement logic, payment, coupon, booking/create-makeup POST, deploy, or `SlipOK API Guide.docx` action was performed.
- Commit `ebee5f7` (`fix(makeup): assign no-coach rounds without attendance`) was pushed to `spike/next-major-security-upgrade`. It has not been deployed.
- Added new `PATCH /api/admin/makeup` action `assign_coach_to_round`.
- `assign_coach_to_round` writes only assignment/review side effects:
  - Inserts one `coach_assignment_groups` row for the selected coach and round.
  - Inserts `coach_assignment_group_students` rows for every selected learner session in the no-coach round.
  - Ensures legacy `coach_assignments` compatibility for the selected `schedule_slot_id + coach_id`.
  - Logs `activity_logs.action = attendance_gap_assign_coach_round` for each selected session.
  - Sends one coach notification to review the assigned round.
- `assign_coach_to_round` intentionally does not write `attendance`, does not call `upsertRetrospectiveAttendance`, does not call `syncBookingSessionStatusFromAttendance`, and does not update `booking_sessions.status`.
- Validation added for `assign_coach_to_round`:
  - `session_ids`, `coach_id`, and `reason` are required.
  - `coach_id` must be a `coach` or `head_coach` profile.
  - Target sessions must all exist, share the same schedule slot/date/time/branch, be normal non-makeup `scheduled` sessions, and be past sessions in Bangkok time.
  - Every target session must resolve an expected learner id.
  - If any target session already has a strict learner group coach assignment, the action rejects and tells Admin to refresh and use the assigned-coach flow.
- Updated `src/components/admin/makeup-client.tsx` no-coach dialog:
  - No-coach cards still show only `จัดการเคสทั้งรอบ`.
  - For `สอนจริง แต่ลืมมอบหมาย/เช็คชื่อ`, Admin selects only coach + reason.
  - Learners are shown read-only with copy saying the coach should review and record attendance after assignment.
  - Status selects for individual learners were removed from this no-coach assign mode.
  - Save calls `assign_coach_to_round`; after success the page refreshes so the round can enter the assigned-coach UX.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run build`
  - Post-build cleanup/restart: removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local HTTP 200.
- Authenticated local browser smoke for `/admin/makeup`:
  - Page loaded without redirect and with no console errors.
  - No-coach cards still showed only `จัดการเคสทั้งรอบ`, with no assigned-coach three-button set or per-person actions.
  - No-coach dialog `สอนจริง...` showed coach selection + reason + read-only learner labels; no `ผลเช็คชื่อรายคน` label and no `เลือกสถานะ` placeholder appeared.
  - `มอบหมายโค้ชให้รอบนี้` was disabled while coach/reason were incomplete.
  - Assigned-coach cards still showed the round-level action set, and the `บันทึกย้อนหลังทั้งรอบ` modal still opened with disabled save while incomplete.

### Phase B.2-New.2 Release Gate

- Source checks: PASS.
- Build: PASS.
- Read-only browser smoke: PASS.
- Owner-run production write UAT for `assign_coach_to_round` was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 16:00-18:00 Ratchada target session assigned to Coach Link.
- Earlier implementation smoke did not create fake test data and did not click a real save/write action before owner approval.
- Commit `6ab8e37` was deployed to Vercel production on 2026-06-14.
  - Deployment id: `dpl_D5wsjCNRNuHgjebsS9KiSNwupmuU`.
  - Deployment URL: `https://new-athlete-badminton-school-d4g9qm8na-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
- Production read-only smoke for `/admin/makeup` after deploy:
  - Used an existing authenticated Chrome Super Admin session. The in-app browser redirected to login and was not used for authenticated smoke.
  - `/admin/makeup` loaded on production and showed no-coach plus assigned-coach review cards.
  - No-coach cards still showed only `จัดการเคสทั้งรอบ`; learner rows kept the warning to use the round-level button only.
  - No-coach dialog mode `สอนจริง แต่ลืมมอบหมาย/เช็คชื่อ` showed coach selection + reason, read-only learner labels, no per-learner status select, and disabled `มอบหมายโค้ชให้รอบนี้` while incomplete.
  - Assigned-coach cards still showed the round-level actions `ส่งให้โค้ชตรวจสอบรอบนี้`/review request, `บันทึกย้อนหลังทั้งรอบ`, and `ปิดเคสทั้งรอบ`.
  - `บันทึกย้อนหลังทั้งรอบ` modal opened and disabled `บันทึก attendance ทั้งรอบ` while learner statuses/reason were incomplete.
  - No production write action was submitted.
  - Console result: NEED VERIFICATION / BLOCKER for clean-console gate because Chrome captured `Error: Minified React error #418` from `/_next/static/chunks/4bd1b696-e356ca5ba0218e27.js` during `/admin/makeup` hydration.

## 2026-06-15 - Phase B.2-New.3 Past-Round Coach Replacement

- Scoped Admin Makeup API/UI/helper source fix only. No DB data repair, migrations, payroll calculation changes, attendance write behavior changes, payment, booking, coupon, deploy, commit, or `SlipOK API Guide.docx` action was performed.
- Added `PATCH /api/admin/makeup` action `replace_coach_for_past_round` for past normal rounds where the real coach differs from the assigned coach.
- New action validates `session_ids`, `coach_id`, and `reason`; validates one same past normal `schedule_slot_id`; rejects makeup/walleted/cancelled/non-past rounds; validates the selected profile is `coach` or `head_coach`; and rejects a selected coach already assigned to another learner group in the same slot.
- Replacement behavior:
  - Updates exact `coach_assignment_groups.coach_id` for learner groups linked to the selected sessions.
  - Creates a retrospective group only for selected sessions that still have no exact group.
  - Ensures legacy `coach_assignments` compatibility for the new coach.
  - Logs `activity_logs.action = attendance_gap_replace_coach_round` per selected session with previous coach ids, new coach id, changed group ids, affected session ids, reason, and flags that no attendance/session status was changed.
  - Notifies the new coach to check in retrospectively with selfie/GPS.
- `src/lib/coach-attendance-review.ts` now treats `attendance_gap_replace_coach_round` as an Admin-returned review action, so only the notified/new coach can use the retrospective check-in exception for that slot.
- Updated `src/components/admin/makeup-client.tsx`:
  - Assigned-coach review cards now include `เปลี่ยนโค้ชย้อนหลัง`.
  - The dialog requires a new coach and audit reason, lists learners read-only, and states that the action changes responsibility/requests evidence without writing attendance or deleting old evidence.
- Business rules preserved:
  - `/coach/assign-groups` remains locked after the slot starts.
  - `attendance` remains the source of truth and is not written by the replacement action.
  - Old coach check-in evidence is not deleted; exact current assignment plus new coach check-in remains required for complete evidence/payroll review.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run build`
  - Post-build cleanup/restart: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local Chrome read-only smoke for `/admin/makeup` redirected to `/auth/login?redirect=%2Fadmin%2Fmakeup` with no console errors. Known local warning observed: LCP image warning for `/logo new-athlete-school.jpg`.
- Owner-run production write UAT for `replace_coach_for_past_round` was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 15:00-17:00 Rama 2 target group changed to Coach Jom.
- Commit `6606f41` (`fix(makeup): support past round coach replacement`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-15.
  - Deployment id: `dpl_5BN7cSZH8ecQhbkFScpjxZZjJZWq`.
  - Deployment URL: `https://new-athlete-badminton-school-9vfzr03lm-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Vercel status: Ready.
  - Production read-only smoke after deploy: `/` returned HTTP 200, `_next/static/chunks/webpack-6fbcecb408fbe888.js` returned HTTP 200, and `/admin/makeup` returned HTTP 307 to `/auth/login?redirect=%2Fadmin%2Fmakeup`.
  - Vercel CLI logs for the deployment window showed info-level requests only during smoke; no error/fatal runtime logs were returned by the Vercel MCP query, though the MCP reported a 403 warning while paging runtime logs.

## 2026-06-15 - Admin Payroll Evidence List Visibility

- Scoped Admin Payroll UI fix only. No DB writes, migrations, payroll calculation semantics, attendance writes, commit, push, or deploy were performed.
- Reported pattern: Coach Link NA Ratchada had completed/check-in/attendance evidence for 2026-06-11, but the visible `/admin/payroll` evidence list stopped at 2026-06-10.
- Read-only DB proof for coach `412a8f42-d069-4b1d-9b2c-abce93f0dc82` confirmed 2026-06-11 has 2 verified payroll source rounds:
  - 13:00-15:00 at Ramintra: 1 linked/payable session, 1 attendance row (`present`), exact coach check-in with photo and GPS.
  - 17:00-19:00 at Ratchada: 3 linked/payable sessions, 3 attendance rows (`present`), exact coach check-in with photo and GPS.
- Root cause: `src/components/admin/payroll-client.tsx` rendered only the first 8 evidence rows and first 8 issue rows with `slice(0, 8)`. The 2026-06-11 rounds were verified rows 9 and 10, so they were hidden from the visible list even though source data was present.
- Source fix: Admin Payroll now renders all verified evidence rows and all issue rows for the selected coach/month instead of silently truncating after 8.
- Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build`.
- Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
- Local browser smoke: `/admin/payroll` redirected unauthenticated local browser to `/auth/login?redirect=%2Fadmin%2Fpayroll` as expected, with no console errors on recheck.
- Commit `40f86cf` (`fix(payroll): show all evidence rows`) was pushed to `spike/next-major-security-upgrade`; follow-up doc commit `7e85504` (`docs: record payroll deploy`) was also pushed.
  - Final production deployment id: `dpl_21B3aVVFBiV8rmAUTKWsgPf2rxhk`.
  - Deployment URL: `https://new-athlete-badminton-school-jhz9ma53y-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Vercel status: Ready.
  - Production read-only smoke after deploy: `/` returned HTTP 200, `_next/static/chunks/webpack-6fbcecb408fbe888.js` returned HTTP 200, and `/admin/payroll` returned HTTP 307 to `/auth/login?redirect=%2Fadmin%2Fpayroll`.
  - Vercel CLI logs for the final deployment window returned no runtime logs; no error/fatal runtime logs were returned by the CLI query.
- Authenticated production Chrome smoke for `/admin/payroll` after deploy:
  - Loaded `https://www.newathleteschool.com/admin/payroll` with the existing Super Admin session and did not redirect to login.
  - Browser console showed no errors or warnings.
  - Coach Link NA Ratchada detail dialog opened read-only; the verified evidence list included both 2026-06-11 rows (`13:00-15:00` Ramintra and `17:00-19:00` Ratchada), confirming the production UI no longer stops at 2026-06-10 / 8 rows.
  - The dialog showed `ปิดสัปดาห์` buttons, including one enabled write action; no payroll write action was clicked.
  - Production authenticated smoke gate for the payroll evidence-list visibility fix: PASS.

## 2026-06-15 - Admin Makeup React #418 Timezone Display Fix

- Scoped Admin Makeup display-only fix only. No DB writes, migrations, API semantics changes, business behavior changes, payroll/payment/booking/wallet/coupon/assignment changes, `assign_coach_to_round`, `replace_coach_for_past_round`, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
- Production authenticated `/admin/makeup` still emitted `Minified React error #418` on page-load hydration after deploy `6606f41`.
- Read-only debug narrowed the likely root cause to check-in date/time text rendering in `src/components/admin/makeup-client.tsx`:
  - `formatDateTime()` formatted Supabase timestamp values with `Intl.DateTimeFormat('th-TH')` without an explicit timezone.
  - Vercel/server rendering can format the same timestamp in UTC while Chrome/user rendering formats it in Asia/Bangkok.
  - Proof command showed the same timestamp renders as `4 Jun 69 09:42` in UTC and `4 Jun 69 16:42` in Asia/Bangkok unless `timeZone: 'Asia/Bangkok'` is set.
- Source fix: `formatDateTime()` now sets `timeZone: 'Asia/Bangkok'`.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` passed with the known Windows LF/CRLF warning for `src/components/admin/makeup-client.tsx`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Authenticated local Chrome smoke for `/admin/makeup` loaded with no console errors and no React #418. No write action was clicked.
- Commit `d59af8c` (`fix(makeup): stabilize checkin time hydration`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-15.
  - Deployment id: `dpl_A2RWoVHBxgKev3CN7J7zco2NPDvA`.
  - Deployment URL: `https://new-athlete-badminton-school-4xigsjz4k-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Vercel status: Ready.
- Authenticated production Chrome smoke for `/admin/makeup` after deploy:
  - Loaded `https://www.newathleteschool.com/admin/makeup` without redirecting to login.
  - Browser console showed no errors or warnings and no React #418.
  - Page showed Super Admin/Admin Makeup content, no-coach round controls, and assigned-coach round controls.
  - No production write action was clicked.
- Production clean-console gate for the React #418 timezone display fix: PASS.

## 2026-06-15 - Admin Makeup Round-Level Request Counter Display

- Scoped Admin Makeup client display fix only. No API semantics, write behavior, `activity_logs`, `notifications`, DB data, migrations, payroll/booking/wallet/payment/coupon/assignment, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
- Reported pattern: `/admin/makeup` round 2026-06-14 15:00-17:00 at Rama 2 had 5 learners. One click on the round-level send-to-coach-review action produced per-session audit logs, but the card badge displayed the request count as 5.
- Root cause: `src/components/admin/makeup-client.tsx` grouped learner sessions into round cards and summed `coach_review_requested_count` and `coach_evidence_requested_count` across sessions. The server still reads `activity_logs` per `booking_sessions` row, and the API still logs/notifies per session.
- Source fix: round card display aggregation now uses the maximum per-session request count for both coach review and coach evidence counters instead of summing all learner/session counters.
- Business behavior preserved: internal per-learner/per-session log and notification rows may still exist, but the card badge/button count now displays the round-level count.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only the known Windows LF/CRLF warning for `src/components/admin/makeup-client.tsx`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
- Authenticated local Chrome read-only smoke for `/admin/makeup` passed:
  - Page loaded without login redirect and without console errors or Next error overlay.
  - The reported 2026-06-14 15:00-17:00 Rama 2 round with 5 learners showed the coach review counter as 1 instead of 5, including the button suffix `(1)`.
  - No-coach round cards still showed the round-level case-management control.
  - Assigned-coach cards still showed the expected review, coach replacement, retrospective attendance, and close-case controls.
  - No write action was clicked.
- No current visible coach-evidence request-count case was present in the smoke data, but the same display aggregation path was fixed for evidence counters.
- Commit `c4a75c1` (`fix(makeup): show round-level review request counts`) was pushed and deployed to Vercel production on 2026-06-15.
  - Deployment id: `dpl_qMctHJktpKKHDMZPVtwHwe5r3p2G`.
  - Deployment URL: `https://new-athlete-badminton-school-b59ov4rbb-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Vercel status: Ready.
- Owner-confirmed production smoke after deploy: the round that previously showed `ส่งให้โค้ชแล้ว 5 ครั้ง` now shows `ส่งให้โค้ชแล้ว 1 ครั้ง`. No production write action was clicked. Counter aggregation bug is resolved in production.

## 2026-06-16 - Admin Makeup Production Write UAT Verification

- Owner performed the production write actions; Codex performed read-only post-write verification only. No source code, DB data, migrations, rollback, deploy, or `SlipOK API Guide.docx` action was performed.
- `assign_coach_to_round` production UAT PASS for 2026-06-14 16:00-18:00 at Ratchada:
  - Exact target booking session: `c4a375b6-4bf1-4305-8932-c47e5f53270d` for learner `คีน` (`55af6613-e4fa-44c5-a0cf-b5142df6955c`).
  - New group `c500256e-bd39-44e9-96e4-a26e725c5b9e` points to Coach Link (`412a8f42-d069-4b1d-9b2c-abce93f0dc82`) and has the expected one `coach_assignment_group_students` row.
  - Legacy `coach_assignments` compatibility row `f7c21caf-27fc-4db7-9ff6-6fde38e405cc` exists for Coach Link and slot `0a346a9a-e603-4da6-9d49-6c417774ea01`.
  - Activity log `065e09fd-d7f5-48f8-997b-faea142acc3d` has `attendance_gap_assign_coach_round`, `attendanceWritten:false`, and `bookingSessionStatusChanged:false`.
  - Notification `a7e6c328-0a8e-48b2-bbce-9df504201f8f` was sent to Coach Link with the expected attendance link.
  - No `attendance` rows exist for the target session, and `booking_sessions.status` remains `scheduled` with `updated_at` still before the UAT write.
- `replace_coach_for_past_round` production UAT PASS for 2026-06-14 15:00-17:00 at Rama 2:
  - Exact target booking sessions: `1cb6f5bf-9df4-4051-9e8d-d4e305b91af0` (`น้องขิม`), `6b822eb9-87b8-4271-922b-283d9c367f92` (`บิว`), `5c560343-79d5-42ea-be0d-ccf567d67d05` (`พราว`), `1ce69fb4-6641-4ebb-a480-9011892573a5` (`ภานันต์`), and `fe1e3ebe-9976-4e83-be29-051f918ed3c3` (`ภูมิ`).
  - Group `cf18d7df-f42e-4852-8255-a96b25c10c7e` now points to Coach Jom (`b852eb8f-7989-4fba-958d-b7a28bcfea4d`) and still has all five learner rows.
  - Previous coach recorded in logs: Coach Tony (`f8fde879-4be7-4225-a6be-c05f45c37a32`). Legacy `coach_assignments` compatibility row `d1a752c4-ebf7-470c-bd7f-ac1f7808f428` exists for Coach Jom and slot `9ffb311c-8ff6-481b-9498-a382ff7c10c9`.
  - Five `attendance_gap_replace_coach_round` activity logs exist, one per target session, all with `attendanceWritten:false` and `bookingSessionStatusChanged:false`.
  - Notification `c7a24182-0d9d-492b-bc11-34f395ca7335` was sent to Coach Jom with the expected retrospective check-in link.
  - No `attendance` rows exist for the five target sessions, and all five `booking_sessions.status` values remain `scheduled` with `updated_at` still before the UAT write.
  - Existing slot check-in evidence rows for Coach Ten and Coach Ja remain present. There is no current Coach Tony check-in row for this slot to preserve, so Tony-specific evidence deletion cannot be proved from a post-only snapshot; source inspection confirms the replace action has no evidence delete path.
- Tables observed written by the owner-run UAT: `coach_assignment_groups`, `coach_assignment_group_students`, `coach_assignments`, `activity_logs`, and `notifications`.
- Tables/areas confirmed not written by these actions for the target sessions: `attendance`, `booking_sessions.status`, DB migrations, payroll, booking, wallet, payment, coupon, assignment semantics outside the tested coach-assignment compatibility rows, and SlipOK guide/docs.
- Rollback assessment: no rollback recommended from read-only verification; no blocker found.

## 2026-06-16 - User Booking History Reschedule Clarity

- Scoped User/Admin booking-history display fix only. No DB writes, migrations, booking creation/reschedule semantics, payment logic, attendance logic, commit, push, or deploy were performed.
- Context: read-only investigation of parent `pick2523@hotmail.com` showed booking `925362e8-fc3d-4f46-a41d-a49758212450` has 20 active June 2026 sessions for ต้นข้าว/ต้นบุญ, plus 6 `booking_sessions.status = rescheduled` history rows. Active sessions were not missing; rescheduled rows were old rounds moved through the parent account.
- Source fix: `/dashboard/history` now fetches `booking_sessions.rescheduled_from_id` and counts only active statuses (`scheduled`, `completed`, `absent`) for session-count completion messaging.
- Source fix: `src/components/dashboard/history-client.tsx` now shows booking detail with separate sections for:
  - "รอบที่นับในคอร์ส" from active sessions only.
  - "ประวัติการเลื่อนรอบ" from `rescheduled` rows, with a link to the replacement row when `rescheduled_from_id` is available.
- Booking cards and grouped pending-payment summaries now count learner sessions from active rows only, so rescheduled history rows no longer inflate per-child session counts.
- Business rules unchanged: rescheduled rows remain audit/history, wallet/payment/attendance/payroll behavior was not changed.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - Post-build cleanup/restart: no existing port 3000 listener, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - In-app browser read-only smoke: `/dashboard/history` redirected unauthenticated local access to `/auth/login?redirect=%2Fdashboard%2Fhistory` with no console errors.

## 2026-06-16 - Admin Schedules Month Pagination Fix

- Scoped `/admin/schedules` source fix only. No DB writes, migrations, booking/reschedule/payment/attendance logic changes, assignment semantics changes, Admin makeup changes, payroll changes, commit, push, or deploy were performed.
- Root cause proved read-only: June 2026 schedule data exceeded the Supabase/PostgREST 1,000 row cap. A broad `/admin/schedules` query stopped before 2026-06-28, hiding active booking sessions for booking `925362e8-fc3d-4f46-a41d-a49758212450`.
- Source fix: `src/app/(admin)/admin/schedules/page.tsx` now parses `year`/`month` from URL query params, defaults invalid or missing params to the current month, applies server-side month date filters, and fetches `booking_sessions` in stable `date/start_time/id` order with paginated `.range()` batches until the last short batch.
- Related reads for wallet credits, assignment groups, slot session attendance scope, and attendance are constrained to the fetched month/session/slot ids and chunked where needed. Supabase errors now throw descriptive errors instead of failing silently for the schedule data path.
- Source fix: `src/components/admin/schedules-client.tsx` now receives the server-selected month and updates the URL with `router.push('/admin/schedules?year=YYYY&month=M')` when changing month or jumping to today. Existing client-side search/branch/course filters still run against the loaded month sessions.
- Read-only verification after the fix:
  - `/admin/schedules?year=2026&month=6` month query loaded 1,136 rows in batches of 1,000 and 136.
  - Booking `925362e8-fc3d-4f46-a41d-a49758212450` had 20 active rows in the loaded month: `ต้นข้าว` 10 and `ต้นบุญ` 10. The 6 `rescheduled` rows remained excluded from active counts.
  - 2026-06-28 rows were present for `ต้นข้าว` and `ต้นบุญ`, both 16:00-18:00 at `รัชดา`.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Unauthenticated local `/admin/schedules?year=2026&month=6` returned HTTP 307 to `/auth/login?redirect=%2Fadmin%2Fschedules`.
  - Authenticated local Chrome read-only smoke on `http://localhost:3000/admin/schedules?year=2026&month=6` loaded without login redirect and without console errors. Searching `วรวรรณ จินตานนท์` showed 20 rows and two 2026-06-28 cards for `ต้นข้าว` and `ต้นบุญ`, both 16:00-18:00 at `รัชดา`.

## 2026-06-16 - Dashboard History Status Display Consistency

- Scoped `/dashboard/history` display-status fix only. No DB writes, migrations, booking write logic, reschedule API, payment logic, attendance write logic, Admin makeup, payroll, commit, push, or deploy were performed.
- Root cause: `/dashboard/history` detail/list badges used raw `booking_sessions.status`, while `/dashboard/schedule` derives display state from attendance/time via `src/lib/session-attendance-status.ts`. Past raw `scheduled` sessions with no exact attendance could therefore show `นัดหมาย` in history while the schedule calendar showed `รอตรวจสอบการเช็คชื่อ`.
- Source fix: `src/app/(dashboard)/dashboard/history/page.tsx` now reads attendance rows read-only for loaded booking sessions in chunks, matches exact `booking_session_id + expected student_id`, derives server-side `display_status` with `deriveSessionDisplayStatus()`, and keeps raw `status` unchanged for lifecycle/count/reschedule logic.
- Source fix: `src/components/dashboard/history-client.tsx` now uses `display_status` for session badges and keeps raw `status` for active count and rescheduled history separation. The active count semantics remain `scheduled/completed/absent` only.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Authenticated local Chrome read-only smoke on `http://localhost:3000/dashboard/history` loaded the reported 16-session booking at Rama 2 without console errors. The detail dialog still showed `13/16`; past raw `scheduled` rows without attendance showed `รอตรวจสอบการเช็คชื่อ`; completed rows showed `เรียนแล้ว`; absent rows showed `ขาดเรียน`; no write action was clicked.

## 2026-06-16 - Dashboard History Walleted Count Clarity

- Scoped `/dashboard/history` display fix only. No DB writes, migrations, lesson wallet write logic, booking/reschedule/payment/attendance write logic, Admin makeup, or payroll action was performed.
- Root cause: a verified 16-session Rama 2 booking for `น้องอองเดร` had 13 active course sessions and 3 `booking_sessions.status = walleted` rows backed by `lesson_wallet_credits.status = active`. The detail UI showed `13/16` but did not explain the 3 walleted sessions.
- Source fix: `src/app/(dashboard)/dashboard/history/page.tsx` now fetches `lesson_wallet_credits` read-only for loaded booking session ids in chunks, matches by `original_session_id`, and passes minimal wallet credit status/redeem metadata into the history client.
- Source fix: `src/components/dashboard/history-client.tsx` now keeps active count semantics unchanged, adds a summary line for active wallet credits, and renders a separate "อยู่ในกระเป๋า / รอเลือกวันใหม่" section for `walleted` sessions with status labels for active/redeemed/expired/cancelled-like states.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Authenticated local Chrome read-only smoke on `http://localhost:3000/dashboard/history` passed for the reported 16-session booking: detail showed `จำนวนที่ชำระ: 16 ครั้ง`, `รอบเรียนที่มีวันเรียนแล้ว: 13/16 ครั้ง`, `อยู่ในกระเป๋า รอเลือกวันใหม่: 3 ครั้ง`, and wallet rows for 15 มิ.ย. 17:00-19:00, 21 มิ.ย. 09:00-11:00, and 25 มิ.ย. 17:00-19:00. Completed/absent/attendance-gap labels remained visible and no console errors were captured.

- Commit `4c5e2c2` (`fix(history): show walleted sessions in booking detail`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-16.
  - Deployment id: `dpl_FXxNEtqBL6kEJAKHGX8oy2nzYHd4`.
  - Deployment URL: `https://new-athlete-badminton-school-90407eh6m-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Authenticated production Chrome read-only smoke on `https://www.newathleteschool.com/dashboard/history` passed with the parent session for the reported booking:
  - Card showed the June 2026 Rama 2 booking for `น้องอองเดร`, `16 ครั้ง`, and learner count `13 ครั้ง`.
  - Detail showed `จำนวนที่ชำระ: 16 ครั้ง`, `รอบเรียนที่มีวันเรียนแล้ว: 13/16 ครั้ง`, and `อยู่ในกระเป๋า รอเลือกวันใหม่: 3 ครั้ง`.
  - Wallet section showed 15 มิ.ย. 17:00-19:00, 21 มิ.ย. 09:00-11:00, and 25 มิ.ย. 17:00-19:00, each as `รอเลือกวันใหม่`.
  - Completed, absent, and attendance-gap review labels remained visible. Browser console errors: 0. No production write action was clicked.

## 2026-06-16 - Admin Makeup Targeted Same-Slot Learner Move

- Scoped `/admin/makeup` source/UI fix only. No direct DB data edits, migrations, attendance writes, `booking_sessions.status` changes, check-in/evidence deletion, or booking/reschedule/payment/wallet/payroll logic changes were performed by Codex.
- Added API action `move_learner_to_existing_coach_group` in `src/app/api/admin/makeup/route.ts` for a targeted same-slot move of one or more learner sessions into an existing `coach_assignment_groups` row.
- The action validates required `session_ids`, `target_group_id`, `coach_id`, and `reason`; target group existence; same `schedule_slot_id`; target group coach match; same date/start/end/branch/course; non-makeup active lifecycle statuses only; and exact learner attendance absence by `booking_session_id + expected student_id`.
- The action writes only `coach_assignment_group_students` membership updates/inserts, compatibility `coach_assignments` when missing for the target coach/slot, `activity_logs`, and a notification to the target coach. It intentionally does not write `attendance`, does not change `booking_sessions.status`, does not delete coach check-ins/evidence, and does not delete the old group even if it becomes empty.
- `src/app/(admin)/admin/makeup/page.tsx` now passes exact `group_id`, `coach_id`, and server-preloaded same-slot coach-group options from the learner's assignment group to the makeup client so the UI can list target groups safely even when the visible review list is narrowed by search/filter.
- `src/components/admin/makeup-client.tsx` now adds a "ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน" button near the retrospective coach replacement action and a read/confirm dialog that shows the learner, old group/coach, same-slot target groups only, target coach, required reason, and warnings that attendance/status/evidence are not changed.
- Read-only proof for Kheen session `c4a375b6-4bf1-4305-8932-c47e5f53270d`:
  - Current membership is group `c500256e-bd39-44e9-96e4-a26e725c5b9e` / Coach Link.
  - Target group `1120daab-2a90-4205-979d-d2803ebb5fbc` / Coach Nice is in the same schedule slot `0a346a9a-e603-4da6-9d49-6c417774ea01`.
  - Target group member rows match the same round/date/time/branch/course.
  - Exact attendance rows for Kheen's expected student id are 0.
- Verification passed locally:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local browser read-only smoke for `/admin/makeup` redirected unauthenticated access to `/auth/login?redirect=%2Fadmin%2Fmakeup` with 0 console errors.
- Commit `99c579a` (`fix(makeup): move learner to existing coach group`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-16.
- Owner-run production UAT for Kheen passed on 2026-06-16. Codex performed post-write read-only verification only:
  - Session `c4a375b6-4bf1-4305-8932-c47e5f53270d` is now in target group `1120daab-2a90-4205-979d-d2803ebb5fbc` / `โคัช ไนซ์ NA ราม`.
  - The same session is no longer in old group `c500256e-bd39-44e9-96e4-a26e725c5b9e` / `โคัช ลิ้ง NA รัชดา`; the old group has 0 members after the move.
  - `attendance` remains 0 rows for the exact learner, and `booking_sessions.status` remains `scheduled`.
  - Coach check-in/evidence for Coach Nice remains present with photo and GPS; no evidence was deleted.
  - Activity log action `attendance_gap_move_learner_to_existing_group` exists with details confirming `attendanceWritten=false`, `bookingSessionStatusChanged=false`, and `coachEvidenceDeleted=false`.
  - Notification `f8912135-148b-48eb-b04c-ecbf5061854e` was sent to Coach Nice for the same slot.
  - Result: PASS. No rollback needed.

## 2026-06-16 - Font Preload Warning Noise

- Scoped app-shell font loading fix only. No DB writes, migrations, business logic changes, or Admin makeup action changes were performed.
- Production screenshot after deploy `99c579a` showed many Chrome DevTools warnings for preloaded `/_next/static/media/*.woff2` Prompt font files and a reported odd-looking font. Read-only HTML inspection confirmed the preload tags had correct `as="font"` attributes, but `next/font` was preloading 10 Prompt font files from `subsets: ["thai", "latin"]` and weights `300/400/500/600/700`.
- Source fix: `src/app/layout.tsx` keeps the Prompt font but removes unused weight `300`, sets `display: "swap"`, and disables automatic font preload with `preload: false` so pages do not emit unused `.woff2` preload links.
- Local verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed; local `/` and `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local `/auth/login` HTML emitted 0 `.woff2` preload links.
- Commit `2d749b7` (`fix(app): reduce font preload warnings`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-16.
  - Deployment URL: `https://new-athlete-badminton-school-nnrezwdqb-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Production smoke result:
  - Public/app-shell smoke passed for `/auth/login` and unauthenticated shell paths. Thai font rendering returned to normal and `.woff2` preload flood was not observed in the app shell.
  - Owner-confirmed Chrome screenshot showed authenticated `/admin` loaded successfully after login and Thai font looked normal.
  - Codex authenticated console smoke remains `NEED REVIEW` only because the Codex in-app browser does not share the owner's logged-in Chrome session/cookies. This is not a confirmed runtime error.
  - No write action, DB data change, migration, or additional deploy was performed during smoke.

## 2026-06-18 - Admin Schedules Daily Board MVP

- Scoped `/admin/schedules` Daily Board MVP is closed. The source change was limited to:
  - `src/app/(admin)/admin/schedules/page.tsx`
  - `src/components/admin/schedules-client.tsx`
- Commit `e7c691afe5d8d3da98c362a1707fc071bf53f7b3` (`feat(schedules): show daily round board`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_AbzHehYxXP2fX1FpmfMr1Pat9rWz`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Daily Board now displays the right-side `/admin/schedules` day view as round cards instead of a long per-session list. Rounds are grouped by `schedule_slot_id` first, with fallback key `date + start_time + end_time + branch_id + course_type_id` only when a session has no slot.
- The round card display includes time, branch, course, learner count, coached learner count, waiting-for-coach count for non-walleted learners only, walleted count when present, coach groups, learners under each exact coach group, learner LV, attendance display labels, and teaching program boxes at the round/coach-group level when available.
- Coach assignment display follows the exact learner-group source: `coach_assignment_group_students.booking_session_id -> coach_assignment_groups.coach_id`. Legacy `coach_assignments` remains diagnostic/compatibility context only and is not used to prove learner-level coach assignment.
- Walleted sessions are displayed separately as `อยู่ในกระเป๋า` / `รอเลือกวันใหม่` / `ไม่ต้องจัดโค้ช`. They are not counted as `รอจัดโค้ช`, are not shown in the waiting-coach section, and are not treated as active learning status.
- Daily Board-specific status wording is intentionally display-only and does not change attendance source-of-truth, `booking_sessions.status`, APIs, DB data, migrations, or write behavior:
  - Before round start: `รอเริ่มเรียน`.
  - During the round: round status `กำลังเรียน`; learners with present/late attendance show `เช็คชื่อแล้ว`; learners without attendance show `รอเช็คชื่อ`; `เรียนแล้ว` is not shown while the round is still active.
  - After round end: present/late shows `เรียนแล้ว`; missing attendance shows `รอตรวจเช็คชื่อ`; absent remains `ขาดเรียน`.
- Verification before deploy passed locally: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Authenticated local smoke on `/admin/schedules?year=2026&month=6` passed. On 2026-06-17 at 14:57 Bangkok time, the active-round labels were verified: round `กำลังเรียน`, present/late `เช็คชื่อแล้ว`, missing attendance `รอเช็คชื่อ`, and no `เรียนแล้ว` badge during the active round.
- Authenticated production read-only smoke on `https://www.newathleteschool.com/admin/schedules?year=2026&month=6` passed for layout/data/display:
  - 2026-06-17 showed Daily Board round cards, including 09:00-11:00, 13:00-15:00, and 15:00-17:00.
  - Round cards showed time, branch, course, learner counts, coached counts, coach groups, learners, LV, attendance labels, and program boxes where coach groups existed.
  - A walleted 15:00-17:00 card showed wallet-specific wording and was not counted as waiting for coach.
  - Console errors: 0. Console warnings: 0. The font/preload warning flood did not return. No production write action was clicked.
- Production smoke status is `PASS with one NEED REVIEW note`: the live label case (`กำลังเรียน` / `เช็คชื่อแล้ว` / `รอเช็คชื่อ`) could not be rechecked against 2026-06-17 on production because the production smoke happened on 2026-06-18, after all target rounds were already in the past. This is acceptable for closure because the same live-label rule passed in authenticated local smoke on 2026-06-17 at 14:57.
- Follow-up backlog from the Daily Board MVP was completed on 2026-06-18 by the scoped `/coach/today` wording refinement below.

## 2026-06-18 - Coach Today Wording Refinement

- Scoped `/coach/today` learner-badge display fix is closed. The source change was limited to `src/app/(coach)/coach/today/page.tsx`.
- Commit `475bd055a42e657c518ce2858419ec8ef78db7aa` (`fix(coach): clarify today learner status wording`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_ABbA2kBzRDciuLZBaKsJkwG4iU2b`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Root cause: `/coach/today` learner badges collapsed `upcoming`, `in_progress`, `attendance_gap_review`, and fallback statuses into the broad label `รอสอน`, so coaches could not distinguish before-start, active-round, and post-round missing-attendance states.
- Source fix: `/coach/today` still uses `deriveSessionAttendanceStatus()` as the attendance source-of-truth helper, but maps the derived statuses locally for the schedule view:
  - `upcoming` -> `รอเริ่มสอน`.
  - `in_progress` without attendance -> `รอเช็คชื่อ`.
  - `present` / `late` while the round is in progress -> `เช็คชื่อแล้ว`.
  - `attendance_gap_review` -> `รอตรวจเช็คชื่อ`.
  - `completed` -> `บันทึกผลแล้ว`.
  - `present` after the round -> `มาเรียนแล้ว`.
  - `late` after the round -> `มาสาย`.
  - `absent` -> `ขาดเรียน`.
  - `walleted` or unexpected fallback -> `ไม่อยู่ในรอบสอนวันนี้`.
- Shared helpers were intentionally not changed: `src/lib/session-attendance-status.ts`, `src/lib/coach-slot-display-status.ts`, `/coach/attendance`, DB/API/migrations, attendance source-of-truth, `booking_sessions.status`, and write behavior were not changed.
- Verification before commit/deploy passed locally: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Authenticated local smoke on `/coach/today` passed with a coach/head-coach session:
  - Page loaded without login redirect.
  - Learner badge `รอสอน` count was 0.
  - Real data showed `รอเริ่มสอน` for 3 learners.
  - Other phase labels remained `NEED REVIEW` only because no real local data for those phases was visible at smoke time.
  - Console errors: 0. Console warnings: 1 Next dev `scroll-behavior: smooth` warning, unrelated to the wording change.
  - No check-in, attendance, or write action was clicked.
- Authenticated production read-only smoke on `https://www.newathleteschool.com/coach/today` passed:
  - Page loaded with the coach session and did not redirect to login.
  - Learner badge `รอสอน` count was 0.
  - Real production data showed `รอเริ่มสอน` for 3 learners.
  - `รอเช็คชื่อ`, `เช็คชื่อแล้ว`, `รอตรวจเช็คชื่อ`, `มาเรียนแล้ว`, `มาสาย`, and `ขาดเรียน` remain `NEED REVIEW` only because no real production data for those phases was visible at smoke time; this is not a found bug.
  - Console errors: 0. Console warnings: 0. The font/preload warning flood did not return.
  - No check-in, attendance, or write action was clicked.

## 2026-06-18 - LV Actual Learner Range Display

- Scoped display-only LV range fix is closed for `/admin/schedules` Daily Board and `/coach/assign-groups`.
- Source change was limited to:
  - `src/components/admin/schedules-client.tsx`
  - `src/components/coach/assign-groups-client.tsx`
- Commit `6f311875342315626375e5afbc26cd2d118c3c2a` (`fix(groups): show actual learner level range`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_7LTrBQ2mAUVP3KN9AyKZi485zrpp`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Root cause: coach group names come from `coach_assignment_groups.name`, but the previous group badge displayed `coach_assignment_groups.level_min / level_max` as plain `LV xx-xx`. Those fields are stored/configured group metadata, not the current actual LV range of learners in the group, so the UI could mislead Admin/Coach when learner levels changed or membership no longer matched the original group band.
- Source fix: both surfaces now hide configured group ranges in the UI and display only actual learner LV ranges derived from already-loaded learners in each group:
  - `/admin/schedules`: actual range is computed from `group.learners[].level`.
  - `/coach/assign-groups`: actual range is computed from `getGroupStudents(slot, group)[].level`.
  - Examples: `เด็กในกลุ่ม LV 57`, `เด็กในกลุ่ม LV 26-32`, `เด็กในกลุ่ม: ยังไม่ประเมิน`, and `เด็กในกลุ่ม LV 26-32 + ยังไม่ประเมิน 1 คน`.
- The fix does not write actual learner LV back to `coach_assignment_groups.level_min / level_max`, does not rename groups, does not change membership, does not change coach assignment behavior, and does not change DB/API/migrations/write behavior.
- Verification before deploy passed locally: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Authenticated local smoke passed:
  - `/admin/schedules?year=2026&month=6` showed actual learner LV ranges such as `เด็กในกลุ่ม LV 57`, `เด็กในกลุ่ม LV 37`, and `เด็กในกลุ่ม LV 26-32`; `ช่วงที่ตั้งไว้` was absent.
  - `/coach/assign-groups` showed actual learner LV range such as `เด็กในกลุ่ม LV 8`; configured ranges such as standalone `LV 11-30`, `LV 51-70`, `LV 31-50`, and `LV 0-10` were absent.
  - Console errors: 0. Local console warning was a Next dev logo-image LCP warning, unrelated to the LV display change.
- Authenticated production read-only smoke passed with one `NEED REVIEW` note:
  - `/admin/schedules?year=2026&month=6` passed: `ช่วงที่ตั้งไว้` was absent, configured group ranges as standalone `LV 11-30`, `LV 51-70`, `LV 31-50`, and `LV 0-10` were absent, and actual learner ranges appeared, including `เด็กในกลุ่ม LV 57`, `เด็กในกลุ่ม LV 37`, `เด็กในกลุ่ม LV 26-32`, and `เด็กในกลุ่ม: ยังไม่ประเมิน`.
  - `/coach/assign-groups` passed with a `NEED REVIEW` note only for the empty-group case because no real empty group was visible during smoke. The page showed actual learner range `เด็กในกลุ่ม LV 26-32`, did not show configured ranges, and did not show `ช่วงที่ตั้งไว้` or `ไม่กำหนดช่วง Level`.
  - Console errors: 0. Console warnings: 1 Next dev `scroll-behavior: smooth` warning, unrelated to the LV display change. The font/preload warning flood did not return.
  - No write action was clicked.

## 2026-06-18 - Ranking Branch Fallback Display

- Scoped Ranking branch display fallback is closed for public `/ranking` and Admin `/admin/ranking`.
- Source change was limited to `src/components/shared/ranking-content.tsx`.
- Commit `9ec35fba3725180e1f2dbbd98dfa640ef842c2c3` (`fix(ranking): fallback child branch from sessions`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_35YWQvijuWT2MtyWPfxmQXx3s4Bn`.
  - Deployment URL: `https://new-athlete-badminton-school-mczsmydrb-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Root cause: Ranking built learner branch names from `bookings.child_id -> bookings.branch_id -> branches` only. The reported child `ณิชารัศน์ (แกรนท์)` had real `booking_sessions.child_id` rows and attendance, but the related verified child booking had `bookings.child_id = null`, so Ranking could not map the booking branch to the child and displayed `ยังไม่ผูกสาขา`.
- Source fix: Ranking keeps the original booking branch source when `bookings.child_id` maps correctly, then falls back only for children missing a booking branch by reading `booking_sessions.child_id -> booking_sessions.branch_id -> branches`.
  - Fallback session statuses are limited to `scheduled`, `completed`, and `absent`.
  - The fallback query is scoped only to child ids that do not already have a branch from the booking map.
  - Large `.in()` filters are chunked and session reads are paginated to avoid request/row-cap issues.
- The fix is display/read-only. It does not write or repair `bookings.child_id`, does not change booking creation/write behavior, does not change attendance logic, and does not change DB/API/migrations.
- Verification before deploy passed locally:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
- Local public `/ranking` smoke passed: filtering `ราชพฤกษ์-ตลิ่งชัน` showed `ณิชารัศน์ (แกรนท์)` with branch `ราชพฤกษ์-ตลิ่งชัน`, did not show `ยังไม่ผูกสาขา` for the child, and console errors/warnings were 0. Local `/admin/ranking` authenticated smoke remained `NEED REVIEW` only because no admin session was available in that local browser.
- Authenticated production read-only smoke passed:
  - `/ranking` showed `ณิชารัศน์ (แกรนท์)` under `ราชพฤกษ์-ตลิ่งชัน`, did not show `ยังไม่ผูกสาขา` for the child, and console errors/warnings were 0.
  - `/admin/ranking` loaded with an Admin session and showed the same shared Ranking board result for `ณิชารัศน์ (แกรนท์)` and `ราชพฤกษ์-ตลิ่งชัน`.
  - The font/preload warning flood did not return.
  - No write action was clicked.

## 2026-06-22 - Admin Makeup Duplicate Coach Group Guard

- Scoped duplicate coach group guard is closed for `/admin/makeup`.
- Source change was limited to:
  - `src/app/(admin)/admin/makeup/page.tsx`
  - `src/app/api/admin/makeup/route.ts`
  - `src/components/admin/makeup-client.tsx`
- Commit `632b90c7fd6e98f155d61205243f541f5bfb640f` (`fix(makeup): prevent duplicate coach groups`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_nZXGVWu22RueVEadGf7zjKA7QLNt`.
  - Deployment URL: `https://new-athlete-badminton-school-8fzxf2jny-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Production incident context: owner clicked the Admin Makeup round action for a 2026-06-02 17:00-19:00 Ramintra round and `assign_coach_to_round` created a second populated coach group for the same coach in the same `schedule_slot_id`. Production data was repaired with owner approval by moving Kirin into the existing Trin group; the duplicate empty group was left in place for audit continuity.
- Root cause: `assign_coach_to_round` did not guard against a selected coach already having a populated `coach_assignment_groups` row in the same slot/round, and the unassigned card UI previously pushed users toward the round assign flow when a same-slot existing group was available.
- API fix: `assign_coach_to_round` now checks for a populated group for the selected coach in the same `schedule_slot_id` and same round context before creating a new group. Populated means the group has at least one `coach_assignment_group_students` member. Empty groups are intentionally ignored so incident leftovers do not block valid future assignment.
- If the selected coach already has a populated same-slot/same-round group, the API returns 400 with: `โค้ชคนนี้มีกลุ่มอยู่แล้วในรอบเดียวกัน กรุณาใช้ "ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน" แทน`.
- UI fix: unassigned learner cards with an existing same-slot populated coach group now show two explicit choices:
  - `ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน`, with helper `ใช้เมื่อผู้เรียนควรอยู่ในกลุ่มโค้ชที่มีอยู่แล้ว`.
  - `มอบหมายโค้ชใหม่`, with helper `ใช้เมื่อผู้เรียนควรแยกไปอีกโค้ช` and warning `ห้ามเลือกโค้ชที่มีกลุ่มอยู่แล้วในรอบนี้`.
- Same-slot target group options exclude empty groups. The UI and local validation still allow assigning a genuinely different coach who does not already have a populated group in the slot/round.
- The fix did not write DB data, did not add migrations, did not change attendance write logic, did not change `booking_sessions.status` logic, and did not touch coach check-ins/evidence behavior.
- Verification before commit/deploy passed locally: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Authenticated local read-only smoke passed on `/admin/makeup`: the page loaded without login redirect, unassigned cards with same-slot groups showed both choices and helper/warning text, assigned-coach cards still showed their existing buttons, console errors/warnings were 0, and no write action was clicked.
- Authenticated production read-only smoke on `https://www.newathleteschool.com/admin/makeup` passed:
  - Page loaded with an Admin session and did not redirect to login.
  - Real unassigned same-slot cases showed both `ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน` and `มอบหมายโค้ชใหม่`.
  - Helper text and duplicate-coach warning were visible.
  - Assigned-coach cards still showed existing buttons such as `ส่งให้โค้ชตรวจสอบรอบนี้`, `เปลี่ยนโค้ชย้อนหลัง`, `บันทึกย้อนหลังทั้งรอบ`, and `ปิดเคสทั้งรอบ`.
  - Console errors/warnings were 0. The font/preload warning flood did not return.
  - No submit, move, assign, close, attendance, or other write action was clicked.

## 2026-07-02 - Kids Group Monthly Pricing True-Up

- Scoped kids_group sibling monthly pricing true-up is deployed to production and production-smoke passed.
- Source commit `5897cede58f720c1b5f205af53c9821cff0a39bf` (`fix(pricing): true up kids group monthly tiers`) changed only `src/lib/pricing.ts` and `scripts/check-pricing-true-up.js`.
- Deployment id `dpl_5e6i8M3Mtzy5xNah6xVD9v6PtHwQ`; deployment URL `https://new-athlete-badminton-school-9ku8u3zd9-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Root cause: kids_group incremental pricing previously used `incrementalPrice = perSessionForFinalMonthlyTier * newSessions`. Split sibling bookings in the same month could therefore cost more than one combined monthly booking. Example from the read-only audit: June 2026 one 16-session booking was `THB 6,496`, while July 2026 split 8 + 8 pending bookings totaled `THB 7,248` before the fix.
- New formula: `targetMonthlyTotal = finalMonthlyPerSession * (existingSessions + newSessions)` and `incrementalPrice = max(0, targetMonthlyTotal - existingPersistedBookingTotals)`. Future kids_group 8 + 8 split bookings now total `THB 6,496` (`THB 4,000 + THB 2,496`) instead of `THB 7,248`.
- Dry-run proof passed with `node scripts/check-pricing-true-up.js`: single 16 sessions = `THB 6,496`; split 8 + 8 = `THB 4,000 + THB 2,496 = THB 6,496`; existing 8 then add 1 keeps expected 7-10 tier behavior.
- Production smoke passed: production alias loaded normally; `/dashboard/booking` loaded with an authenticated Chrome session; console errors/warnings were 0; no runtime error, hydration error, or React #418 was found.
- UI price preview remains `NEED REVIEW` only because reproducing the exact target 8 + 8 case safely in production would risk entering the booking creation flow. No `ยืนยันการจอง`, slip upload, booking/payment creation, or product write action was performed.
- Coupon limitation: true-up subtracts persisted `bookings.total_price`. Coupon true-up semantics still need owner decision because no pre-discount subtotal snapshot is stored, and this release intentionally did not invent new coupon behavior.
- Branch-scope limitation: preserved current behavior counts existing bookings by the same `user_id + course_type_id + month/year + status` scope. Branch-specific monthly pricing was not changed and needs owner decision if required.
- Owner-approved production DB repair for the existing July mismatch is complete:
  - Target booking `ff0728dd-066a-417a-aeaa-0049fed6b931` was updated from `bookings.total_price = 3248` to `2496`.
  - Paired booking `10254533-f76a-4985-bf0d-af18942a3b85` remained `4000`.
  - Combined July 2026 total after repair is `6496`.
  - Both bookings remain `pending_payment`.
  - Payment rows remain 0 and coupon usages remain 0.
  - `booking_sessions` were unchanged by fingerprint and booking status was not changed.
  - Activity log `07150189-0a5e-4fe6-bd20-24c47b4b9a75` was inserted with action `pricing_true_up_repair`.
- Owner-approved July 2026 current-month DB repair for 4 additional kids_group mismatch groups is complete. Owner policy: ignore June historical mismatches; repair July 2026 current-month mismatches even when payment exists; keep payment rows as evidence of actual transfer and do not modify `payments.amount`; do not create refund/coupon/payment rows; do not touch `booking_sessions`, `pricing_tiers`, Trin/Bin, or June groups.
  - Root cause for these groups: old incremental pricing charged `final tier per-session * newSessions` and did not true-up earlier higher-tier bookings. The source fix above prevents future repeats.
  - Ningnong group target `5d1d9a43-afcd-4d26-8817-68ab948443f2`: `bookings.total_price` `2800 -> 1169`, reduction `1631`, group total after repair `7700`, status `verified`, activity log `04cf71ee-5718-49a7-8a5f-364d44a9184f`.
  - Kanokpan group target `3f95767e-8418-4b0b-b87d-2cd18811825b`: `bookings.total_price` `14700 -> 13600`, reduction `1100`, group total after repair `16100`, status `pending_payment`, activity log `e2aa73ff-b1b9-4168-b58a-28ffc3128a1d`.
  - Siripong group target `f565a552-65f3-44e0-8826-22a4c9cb0dbb`: `bookings.total_price` `1299 -> 763`, reduction `536`, group total after repair `4763`, status `verified`, activity log `c953f942-7d67-44d0-b8a5-b0abefa213a0`.
  - Janyawat group target `ff9cf27f-6415-444d-90b6-89ab05fc2d47`: `bookings.total_price` `2000 -> 1500`, reduction `500`, group total after repair `4000`, status `verified`, activity log `e46f9fb1-608e-48d6-a6a5-0c0bd7a7746a`.
  - Latest batch total July reduction is `3767`; total July reduction including Trin/Bin is `4519`.
  - Post-write verification passed: payments unchanged by fingerprint; `booking_sessions` unchanged by fingerprint; `pricing_tiers` unchanged by fingerprint; no coupon rows created; no booking/payment/refund/coupon created; non-target bookings in those groups unchanged; Trin/Bin remains matched at `6496`; June guarded bookings unchanged.
- Rollback condition for these exact DB repairs: rollback only before further dependent accounting/credit/payment action; if later accounting action exists, stop and re-plan.
- Remaining limitations: coupon true-up semantics still need owner decision if a coupon case appears later; branch-scope policy for future business rules remains owner decision, while this July repair followed current source scope.
- No pricing tier rows, API/migration, history amount source, booking payload shape, schedule selection, attendance/wallet/reschedule logic, extra deploy, booking/payment/refund/coupon creation, slip upload, or product write action beyond the exact owner-approved DB repairs was changed/performed.

## 2026-07-01 - Admin Schedules Performance UX/Render Fix

- Scoped `/admin/schedules` Phase A + small Phase B performance UX/render fix is deployed to production and production-smoke passed.
- Source commit `0d70e427db9e4df6a965a41e42371660c59a0cfe` (`fix(schedules): avoid rendering full month details by default`) changed only `src/components/admin/schedules-client.tsx`.
- Deployment id `dpl_HCABbm1GzZm2bDfe8Xkr5qvTrRei`; deployment URL `https://new-athlete-badminton-school-bd74sd2mc-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Root cause: `/admin/schedules?year=2026&month=6` has large monthly data volume, including 348 rounds and 1182 booking session rows. Before the fix, non-current months could start with `selectedDate = null`, so the right Daily Board panel rendered full-month round/group/learner/program/wallet/detail UI immediately and made tablet/Chrome feel stuck after loading.
- Fix: month navigation now has pending/loading state, disables Today/previous/next while pending, shows `กำลังโหลดตารางเดือน...`, shows a lightweight month overview when no date is selected, renders Daily Board detail only after a day is selected, memoizes repeated summary/bucket computations, and keeps calendar summary/counts available.
- No server query semantics, Supabase query/chunk/pagination behavior, business logic, attendance source-of-truth rules, exact coach assignment source, walleted counting rules, teaching program correctness, DB/API/migration, or write behavior changed.
- Production smoke passed on `https://www.newathleteschool.com/admin/schedules?year=2026&month=6` in Chrome via Codex Chrome Extension, authenticated as `Super Admin: A'Arm Chanin`.
- Initial June 2026 smoke: page did not redirect to login; displayed `มิถุนายน 2569`; showed 348 rounds and 1182 booking rows; calendar summary/counts per day displayed correctly; right panel showed `ภาพรวมเดือนมิถุนายน` and `เลือกวันที่ในปฏิทินเพื่อดูรายละเอียดรอบเรียน`; heavy detail markers such as `โปรแกรมสอนรอบนี้`, `ผู้ปกครอง:`, and `โค้ช:` had 0 occurrences in the initial overview; UI no longer felt heavily stuck after load.
- Selected-day smoke for `พุธ 17 มิ.ย. 69` passed: Daily Board showed only that day with 8 rounds, time/branch/course, learner counts, coach groups, learners, LV, teaching program boxes, and attendance labels such as `เรียนแล้ว`, `ขาดเรียน`, and `รอตรวจเช็คชื่อ`; no `พฤหัสบดี 18 มิ.ย. 69` detail mixed into the selected-day panel.
- Month navigation smoke passed for June -> May, June -> July, and Today -> July: `กำลังโหลดตารางเดือน...` appeared while pending, Today/previous/next buttons were disabled during pending navigation, buttons returned enabled after route settled, and the UI did not appear frozen even when the production query took several seconds.
- Invariant smoke passed: walleted sessions remained excluded from `รอจัดโค้ช`; the 17 June walleted example showed `อยู่ในกระเป๋า 1 คน`, `มีโค้ชแล้ว 0 คน`, and `ไม่ต้องจัดโค้ช`; coach assignment still displayed through exact coach group / learner group behavior; attendance labels remained correct; calendar summary stayed consistent with June 2026 data; no legacy/slot coach fallback was introduced.
- Console/hydration smoke passed: console logs/errors/warnings 0, no React #418, no hydration error, and no text mismatch.
- Verification before deploy passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Phase C split monthly summary vs daily detail remains optional/future only; it is not required immediately because this scoped fix already avoids full-month detail rendering by default.

## 2026-07-04 - User Payment / Slip Upload Reliability Hardening

- Scoped User Payment / Slip Upload reliability hardening is deployed to production and production read-only smoke passed.
- Source commit `bc5e013b4b0d90b517f908d9aaf34e7caad5f43b` (`fix(payment): harden slip upload reliability`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_B2895m9DiJwxm3xWEhu64BUYDhAj`; deployment URL `https://new-athlete-badminton-school-753f9tmvh-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/lib/slipok.ts`, `src/app/api/verify-slip/route.ts`, and `src/components/dashboard/history-client.tsx`.
- Root reliability risk from the audit: the slip upload flow could feel stuck or unclear when SlipOK was slow/timeout-prone or when a partial failure happened after upload, especially if the payment row was inserted but booking status update failed.
- Fix summary:
  - `src/lib/slipok.ts` now wraps the SlipOK request with an explicit 25s `AbortController` timeout and typed `SLIPOK_TIMEOUT` response.
  - `/api/verify-slip` returns clearer safe messages/codes for storage upload failure, SlipOK timeout, SlipOK rejection/invalid slip, payment insert failure, and booking update failure after payment insert.
  - `/dashboard/history` slip upload dialog now shows clearer uploading/verifying/refreshing/failed states, disables duplicate submit and file changes while pending, and surfaces safe API messages to the user.
  - If payment is recorded but booking update fails, the API reports `paymentRecorded: true` and `supportReviewRequired: true`; the client refreshes and tells the user support must review.
- Business semantics preserved:
  - SlipOK approved still creates payment `approved` and booking `verified`.
  - Timeout/rejected/manual-review path still records payment `pending` and booking `paid`.
  - Payment approval/reject/send-back/cancel semantics were not changed.
  - Pricing, DB migrations, and direct DB repair were not changed/performed.
- Production read-only smoke passed:
  - `https://www.newathleteschool.com` loaded normally.
  - `/dashboard/history` loaded with the existing user session and did not redirect to login.
  - Pending payment/upload UI rendered, but no slip dialog was submitted.
  - `/admin/payments` loaded and the payment list rendered normally.
  - Console errors/warnings were 0; no React hydration error or React #418 was found.
- Post-deploy read-only inconsistency audit passed:
  - payments scanned: 392.
  - paid/verified bookings: 392.
  - payment exists but booking still `pending_payment`: 0.
  - approved payment but booking not `verified`: 0.
  - booking `paid`/`verified` without payment row: 0.
  - duplicate payment rows for same booking: 0.
- Important limitation: browser slip-upload write smoke remains `NEED REVIEW` because no clearly disposable/test pending booking existed. No production slip upload was performed, no booking/payment/slip/coupon was created, and no payment/write action was clicked.
- User Booking state reset / draft-state preservation is now completed by the 2026-07-08 `/dashboard/booking` draft preservation release below. If payment upload still feels slow, the next separate area is a History page query/loading audit.

## 2026-07-08 - User Booking Draft Preservation Release

- Scoped `/dashboard/booking` draft preservation is deployed to production and production smoke passed.
- Source commit `85aa80a90bd645b63e7bab1fbca408fa66cf2c73` (`fix(booking): preserve draft state`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_AZhW1vNkdGm4oZiMZvVb4hx152qr`; deployment URL `https://new-athlete-badminton-school-bq3vf5e2k-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/components/dashboard/booking-client.tsx`.
- Original reliability issue: the booking wizard state lived only in React `useState`, so refresh/remount/auth refresh/returning to the page could lose selected course, learner, branch, and session draft state.
- Fix summary:
  - Added client-side `sessionStorage` draft preservation for `/dashboard/booking`.
  - New booking draft key: `nabs:booking-draft:v1:{userId}:new`.
  - Edit booking draft key: `nabs:booking-draft:v1:{userId}:edit:{bookingId}`.
  - Persisted fields are `step`, `courseType`, `learnerType`, `selectedChildIds`, `privateSelfAttend`, `selectedBranchIds`, `calMonth`, `calYear`, `sessionsMap`, `activeChildTab`, and `updatedAt`.
  - Not persisted as source of truth: calculated/final price, `appliedCoupon`, coupon validation result, payment state, API errors, or loading state.
  - Restore validates course type, child ids, branch ids, active learner key, and session shape; corrupt/invalid drafts are ignored and removed.
  - Restored draft notice: `กู้คืนแบบร่างการจองล่าสุดแล้ว`.
  - Added `ล้างแบบร่าง`.
  - Draft clears after successful `POST`/`PUT`, user discard, and mode/edit key change.
  - Draft does not clear on API failure, route refresh, slow network, or summary back.
- Production smoke passed:
  - Opened `/dashboard/booking` with an authenticated production session.
  - Selected `Private` -> `A'Arm Chanin` -> `แจ้งวัฒนะ` -> `จันทร์ 6 ก.ค. 69` -> `08:00-09:00`.
  - Browser refresh restored the draft with the restored notice, branch/session selection, and recalculated visible price `฿900`.
  - Summary showed the restored session; back from summary preserved the draft.
  - `ล้างแบบร่าง` cleared storage; refresh returned to the initial course step.
  - Console errors/warnings/pageerrors were 0; no React hydration error or React #418 was observed.
  - `ยืนยันการจอง` was not clicked, and no booking/payment/slip/coupon was created.
- Business semantics preserved: no API changes, DB changes, migrations, pricing changes, `/api/bookings` payload shape changes, duplicate guard changes, schedule template rule changes, same-day future-slot rule changes, payment/slip flow changes, or lesson-wallet/reschedule/coupon semantics changes.
- Important `NEED REVIEW` notes:
  - kids_group multi-child browser smoke was not tested because the safe smoke session had no child records.
  - pending edit booking browser smoke was not tested because no pending editable booking was visible.
  - These are not blockers for this scoped client-only release.
- Next recommended reliability/performance task: run a Booking Performance Audit if the owner wants real speed improvement, or confirm branch/month reset behavior if users still feel selections disappear during in-page changes.

## 2026-07-08 - Phase 1 Performance Foundation Release

- Scoped perceived-performance UI work is committed, pushed, and deployed to production.
- Source commit `67f5b01` (`fix(ui): add portal navigation loading feedback`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_14eJpsrbUeEd6V1mcF6NVFLshV55`; deployment URL `https://new-athlete-badminton-school-n0odem0ad-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope is limited to global/portal navigation feedback and route-level loading skeletons:
  - `src/components/shared/loading-bar.tsx`
  - `src/components/shared/portal-route-loading.tsx`
  - `src/components/layout/navigation-pending.ts`
  - `src/components/layout/admin-sidebar.tsx`
  - `src/components/layout/coach-sidebar.tsx`
  - `src/components/layout/dashboard-sidebar.tsx`
  - `src/app/(admin)/admin/loading.tsx`
  - `src/app/(coach)/coach/loading.tsx`
  - `src/app/(dashboard)/dashboard/loading.tsx`
- Implemented behavior:
  - Global internal route clicks now show immediate top loading feedback and a small pending pill, with guards for external links, modifier/new-tab clicks, hash-only links, and a timeout failsafe.
  - Admin, Coach, and User dashboard sidebars show per-link pending state and spinner feedback while an internal navigation is settling.
  - Admin, Coach, and User portal route groups now have lightweight route loading skeletons.
- Business/API invariants preserved: no DB/API/page query changes, migrations, booking/payment/slip/coupon/check-in/attendance writes, pricing changes, schedule/attendance semantics changes, or SlipOK changes were made.
- Local verification passed before docs update:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings
- After build, the stale `.next` folder in this repo was removed and `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` was restarted successfully; `/` returned 200 and a `_next/static/*` JS asset returned 200.
- Browser smoke status:
  - Provided local account authenticated successfully and could access Admin, Coach, and User dashboard portals.
  - Admin desktop sidebar smoke passed from `/admin` to `/admin/schedules`: top loading pill appeared immediately, `/admin/schedules` link had `aria-busy="true"` with `กำลังเปิดเมนู...`, route skeleton appeared, and the schedule page settled without pending UI stuck.
  - Coach desktop sidebar smoke passed from `/coach` to `/coach/today`: top loading pill appeared immediately, `/coach/today` link had `aria-busy="true"` with `กำลังเปิดเมนู...`, and the page settled without pending UI stuck.
  - User dashboard desktop sidebar smoke passed from `/dashboard` to `/dashboard/history`: top loading pill appeared immediately, `/dashboard/history` link had `aria-busy="true"` with `กำลังเปิดเมนู...`, and the page settled without pending UI stuck.
  - Post-build browser verify passed for `/admin`; `<html data-scroll-behavior="smooth">` is present, and the Next smooth-scroll route-transition warning did not recur after the restart.
  - No write action was clicked. No booking/payment/slip/coupon/check-in/attendance creation or mutation was performed.
- Production smoke:
  - `https://www.newathleteschool.com/` returned 200.
  - A production `_next/static/*` JS asset returned 200.
  - Clean no-cookie `/admin` returned 307 to `/auth/login?redirect=%2Fadmin`, preserving route guard behavior.
  - In-app browser `/admin` also redirected to login, rendered `<html data-scroll-behavior="smooth">`, and had browser console errors/warnings 0.
  - Vercel CLI inspect confirmed deployment target `production`, status Ready, and production aliases including `https://www.newathleteschool.com`.
  - Vercel CLI error-log check immediately after clean no-cookie smoke found no logs in the last 1 minute.
  - A prior in-app browser production attempt produced two `Invalid Refresh Token` error logs from a stale unauthenticated browser cookie during `/admin` -> login redirect; clean no-cookie smoke did not reproduce new errors.
  - Authenticated production portal navigation smoke passed after the owner logged in through the in-app browser:
    - `/admin` -> `/admin/schedules` showed the top loading pill and route skeleton immediately, then settled to the schedule calendar with console errors/warnings 0.
    - `/coach` -> `/coach/today` showed the top loading pill/loading copy immediately, then settled to Coach Schedule with console errors/warnings 0.
    - `/dashboard` -> `/dashboard/history` showed the top loading pill and route skeleton immediately, then settled to booking history with console errors/warnings 0.
    - Production route changes were fast enough that the sidebar `aria-busy` state was not captured in the browser sample, but it remains covered by authenticated local smoke above.
    - Vercel CLI error-log check after authenticated smoke found no error logs in the last 5 minutes.
- No write action was clicked. No booking/payment/slip/coupon/check-in/attendance creation or mutation was performed locally or on production.

## 2026-07-08 - Owner-Approved Test Booking Cleanup

- Owner-approved Plan A production cleanup for parent profile `e8a4b5c9-880d-4a43-b693-96cb0ce26316` (`รชต จันดาวรรณ`) is complete.
- Scope was limited to operational booking/test rows for the audited target bookings:
  - `a638ec91-e5fc-4532-a675-54a0c1e089fe`
  - `713a8a12-5d1c-4a3c-9486-4c8a8e81cce0`
  - `7c50224f-26f7-4e5e-a997-8e403220eb61`
  - `ce154363-c2c5-4117-b584-457ae9e472d4`
  - `ffb929b2-d406-4d09-9cb3-554c51ff4548`
  - `52bb57e3-bf9b-4a7d-8bde-8d32423d5bda`
- Local JSON snapshots were saved under `backups/rachata-cleanup-20260708-024923/` for dry-run and `backups/rachata-cleanup-20260708-024933/` for write/post-write verification. The backup folder is ignored by git.
- Pre-write dry-run passed the hardcoded ID guards and re-verified:
  - bookings 6, booking_sessions 42, payments 6, coupon_usages 0, lesson_wallet_credits 29, attendance 1.
  - target `coach_assignment_group_students` links 4.
  - empty `coach_assignment_groups` approved for deletion 3.
  - stale legacy `coach_assignments` approved for deletion 3, each with no remaining non-target sessions in the slot.
  - protected group `7f464902-42ec-411d-a939-f0749e45ecd3` still had 2 non-target learners and was not deleted.
- Production rows deleted:
  - `lesson_wallet_credits`: 29.
  - `payments`: 6.
  - `attendance`: 1.
  - `coach_assignment_group_students`: 4.
  - empty `coach_assignment_groups`: 3.
  - stale `coach_assignments`: 3.
  - `booking_sessions`: 42.
  - `bookings`: 6.
- Cleanup audit log was inserted:
  - `activity_logs.id`: `e111c71c-e7f6-448c-a871-c176ced66dea`
  - action: `owner_test_booking_cleanup`
  - entity_type/entity_id: `profile` / `e8a4b5c9-880d-4a43-b693-96cb0ce26316`
- Post-write verification passed:
  - target bookings, sessions, payments, wallet credits, attendance row, assignment links, empty groups, and stale legacy assignments remaining: 0.
  - parent profile `e8a4b5c9-880d-4a43-b693-96cb0ce26316` still exists.
  - child profile `4209ef39-21cd-494e-9e1f-507e3f0a92d1` still exists.
  - protected group `7f464902-42ec-411d-a939-f0749e45ecd3` still exists with exactly 2 non-target learner links.
  - all 27 coach check-ins from involved slots still exist.
  - activity logs were not deleted.
- Verification after cleanup passed:
  - `npm.cmd run attendance:reconcile:dry-run`: 0 student-scope mismatches, 0 status mismatches, 0 booking-status-without-attendance rows.
  - `npm.cmd run prod:check`: READY WITH WARNINGS/PASSES; warning is local `SLIPOK_TEST_MODE=true`.
- No source code change, migration, commit, push, deploy, parent/child delete, activity log delete, coach check-in delete, profile delete, child profile delete, or storage object delete was performed.
- Payment slip storage objects were intentionally left in storage for optional later cleanup because storage deletion is harder to rollback. Paths are recorded in `backups/rachata-cleanup-20260708-024933/prewrite-summary.json`.

## 2026-07-08 - Admin Makeup Read Transport Cleanup

- Phase 2 `/admin/makeup` Option 1 safe read transport cleanup is committed, pushed, deployed, and smoke verified.
- Source commit `5928e76` (`fix(makeup): chunk large read queries`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_FTvwNYxQhQVg1Scbcrm2YF62hukW`; deployment URL `https://new-athlete-badminton-school-if4vupuq4-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/app/(admin)/admin/makeup/page.tsx`.
- Read transport changes:
  - Added local range/chunk helpers for paginated Supabase reads.
  - Replaced source session `.limit(2000)` with paginated `.range(...)` reads.
  - Replaced linked makeup session `.limit(1000)` with paginated `.range(...)` reads.
  - Replaced unchunked `schedule_slot_id` `.in(...)` reads for assignment groups, coach check-ins, and slot sessions with chunked/ranged reads.
  - Replaced unchunked attendance `.in('booking_session_id', ...)` with chunked/ranged reads.
  - Added explicit reference-query error handling for branches, schedule templates, and coaches.
  - Existing activity-log chunking was left unchanged.
- Read-only row verification after the source fix:
  - source sessions 1473.
  - linked makeup sessions 198.
  - merged sessions 1535.
  - unique slot ids 476.
  - assignment groups 640.
  - slot sessions for attendance scope 1589.
  - attendance-scope session ids 1628.
  - attendance rows 1389.
  - coach check-ins 557.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `npm.cmd run attendance:reconcile:dry-run`
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `git diff --check` with only the known Windows LF/CRLF warning for `src/app/(admin)/admin/makeup/page.tsx`.
- After build, the stale `.next` folder in this repo was removed and `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` was restarted successfully; `/` and a `_next/static/*` JS asset returned 200.
- Authenticated local read-only smoke passed on `/admin/makeup`:
  - Review tab loaded with 72 review items, 52 visible rounds, 18 no-coach items, 6 missing-evidence items, 67 actionable makeup items, 0 completed makeups, and 67 learners.
  - Makeup tab loaded with 67 month cards; search for `กระต่าย` narrowed to 1 month.
  - Date-target smoke for `/admin/makeup?date=2026-07-08` highlighted the expected 10:00-12:00 round.
  - Browser console errors/warnings were 0, and no write action was clicked.
- Authenticated production read-only smoke passed on `https://www.newathleteschool.com/admin/makeup`:
  - Review tab showed the same 72 review items and 52 visible rounds.
  - Makeup tab loaded with 67 month cards; search for `กระต่าย` narrowed to 1 month.
  - Browser console errors/warnings were 0, Vercel `--level error` logs found no logs, and no write action was clicked.
- No API route, DB write, migration, schema change, client redesign, tab/filter behavior change, attendance source-of-truth change, lesson wallet/payment/pricing/booking/check-in business logic change, storage deletion, or Admin Makeup write action was performed.

## 2026-07-09 - Admin Users Read Transport Cleanup

- Phase 2.4 `/admin/users` Option 1 safe read transport cleanup is committed, pushed, deployed, and read-only smoke verified.
- Source commit `3751058` (`fix(users): range large read queries`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_3SDZ79Ka4fDuYp2R4S39kGfSLW7k`; deployment URL `https://new-athlete-badminton-school-f00bitzjl-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/app/(admin)/admin/users/page.tsx`.
- Read transport changes:
  - Added a local ranged Supabase read helper using `.range(...)` pages of 1000 rows.
  - Replaced broad reads for `profiles`, `children`, and `bookings` with ranged reads.
  - Added explicit read error handling for those three large reads.
  - Added `childrenByParentId` map shaping so parent-child display no longer repeatedly filters the full child list per user.
  - Deferred optional `users-client` memo cleanup to a future pass.
- Read-only row verification after the fix:
  - Local smoke before production deploy showed 306 users/profiles, 289 children, 21 coaches, and 475 bookings.
  - Production smoke after deploy showed 307 users/profiles, 234 parents, 46 adults, 289 children, 21 coaches, and 475 bookings. The one-user difference was a new production user observed after local verification.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `npm.cmd run attendance:reconcile:dry-run`
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `git diff --check` with only the known Windows LF/CRLF warning for `src/app/(admin)/admin/users/page.tsx`.
- After build, the stale `.next` folder in this repo was removed and `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` was restarted successfully; `/` and a `_next/static/*` JS asset returned 200.
- Authenticated local read-only smoke passed on `/admin/users`: full list loaded, search for `เบเน่` narrowed to 1 user, parent/child display remained intact, coach role filter showed 12 coach users, and the user detail panel opened read-only.
- Authenticated production read-only smoke passed on `https://www.newathleteschool.com/admin/users`: full list loaded, search for `เบเน่` narrowed to 1 user, parent/child display remained intact, and the user detail panel opened read-only.
- Recent Vercel logs for the smoke window showed `GET /admin/users` returning 200 and no error-level entries in the fetched window.
- No API route, DB write, migration, schema change, create/edit/delete/role/password behavior change, parent/child semantics change, student level change, booking/payment/attendance/wallet semantic change, permission/auth change, client pagination/search contract change, deploy after docs, or `/admin/users` write action was performed.
- The then-unrelated `src/app/page.tsx` phone-number changes were not staged, committed, or modified for this work; they were completed later in commit `983e998`.

## 2026-07-09 - Public Contact Phone Update

- Public homepage/contact phone number is deployed to production.
- Source commit `983e998` (`fix(site): update contact phone number`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/app/page.tsx`.
- Contact display now uses `080-252-7227`; contact links now use `tel:0802527227`.
- Replaced old contact number/link `080-059-6004` / `tel:0800596004`.
- Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only the known Windows LF/CRLF warning.
- Local smoke passed on `/`: contact section rendered, the new display phone and both `tel:0802527227` links were present, old phone/link were absent, and browser console warnings/errors were 0.
- Production smoke passed on `https://www.newathleteschool.com`: the new display phone and both `tel:0802527227` links were present, old phone/link were absent, and Chrome console warnings/errors were 0.
- No DB write, API change, migration, package/config change, business logic change, storage action, or post-deploy write action was performed.

## 2026-07-09 - Documentation Verification Pass

- Documentation-only verification after Phase 2/2.5 closeout and the public phone update is complete.
- Current docs now reflect that Phase 2 `/admin/makeup`, `/admin/payments`, `/dashboard/history`, `/admin/users`, Phase 2.5 Ranking read/search, the `/admin/ranking` search follow-up, the owner test booking cleanup, `/dashboard/booking` draft preservation, slip upload reliability hardening, and the public contact phone update are closed.
- Ranking search follow-up is PASS and no longer NEED REVIEW; current production search is enabled on both `/ranking` and `/admin/ranking`.
- Historical notes that mentioned an unrelated dirty `src/app/page.tsx` phone change now explicitly point to the later completed phone commit `983e998`.
- Historical next work was Phase 3 / Role Smoke Readiness, followed by Phase 3 Deploy Readiness; **superseded by Current Source of Truth / Pricing Reconciliation**. Attendance Sync remains a regression guard unless new attendance work starts.
- Real NEED REVIEW items remain open: role-pure Standard Coach browser smoke if required, Admin Makeup write actions requiring owner-approved exact targets, live SlipOK write smoke without a safe test case, and booking draft smoke gaps where no safe matching data existed.
- This pass changed documentation only. No source code, API, DB, migration, package/config, deploy, or write action was performed.

## Unknown / Need Verification

- Current `.env.local` values were not inspected directly in this audit. Read-only readiness check only confirmed required Supabase environment variables are present.
- Current remote DB migration state after the latest local work needs confirmation before future DB-dependent work.
- Final authenticated production/local smoke test across all roles after `86aa087` is partially complete. User, Head-Coach-like, Standard Admin, and Super Admin requested local admin surfaces are now verified, including `/admin/makeup`, `/admin`, `/admin/schedules`, and `/admin/payments` with no fresh console errors or hydration mismatch in the latest authenticated Chrome smoke. Standard Coach expected UI has been owner-confirmed, but a role-pure Standard Coach browser smoke still needs a Standard Coach account if browser verification is required.
- Admin makeup round-level actions other than the 2026-06-16 verified `assign_coach_to_round` and `replace_coach_for_past_round` cases still need owner-driven UAT because the important buttons write production data.
- Phase B.2-New.2 `assign_coach_to_round` owner-run production write UAT was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 16:00-18:00 Ratchada target session.
- Phase B.2-New.3 `replace_coach_for_past_round` owner-run production write UAT was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 15:00-17:00 Rama 2 target group.
- Production `/admin/makeup` clean-console smoke for the React #418 timezone display fix passed after deploy `d59af8c`; keep future production smoke read-only unless the owner approves exact write targets.

## Do Not Regress

- Do not restore Admin booking on behalf of users.
- Do not rely on `booking_sessions.status` alone for attendance display.
- Do not use old LV 1-60 level ranges.
- Do not bypass schedule templates/slots for bookings, reschedule, makeup, or wallet redemption.
- Do not add a SlipOK mode UI toggle.
- Do not weaken coach evidence requirements for weekly teaching-hour closing.
- Do not use native browser alert/confirm/prompt in product UI.

## 2026-06-17 - Public Ranking React #418 Timezone Display Fix

- Scoped `/ranking` display-only fix. No DB writes, migrations, ranking/sort logic changes, business logic changes, or docs changes were included in the source commit.
- Root cause: `src/components/shared/ranking-board.tsx` formatted latest assessment dates with `new Date(date).toLocaleDateString('th-TH', ...)` without an explicit timezone. Production server rendering could format UTC dates one day earlier than the browser in Asia/Bangkok, causing React hydration error #418.
- Source fix: `formatDate()` now uses `Intl.DateTimeFormat('th-TH', { day, month, year, timeZone: 'Asia/Bangkok' })`.
- Commit `f3da82670f7047a8160068fd1994c84f7e37f45a` (`fix(ranking): stabilize latest assessment date timezone`) changed only `src/components/shared/ranking-board.tsx` and was deployed to Vercel production.
  - Deployment id: `dpl_A9rxyHHukg6D3ncePFzaKD8egpmS`.
  - Deployment URL: `https://new-athlete-badminton-school-2kb185env-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Post-deploy production browser smoke for `https://www.newathleteschool.com/ranking` passed after initial load and two hard refreshes:
  - Console error/warning count: 0.
  - React hydration error #418: not present.
  - Computed font remains `Prompt, "Prompt Fallback"`.
  - `.woff2` preload links: 0.
  - Ranking content rendered with student list data.

## 2026-06-10 - Lesson Wallet Cross-Branch Course-Type Validation

- Fixed `/dashboard/lesson-wallet` redemption selection to stop guessing missing or invalid course types as `kids_group`.
- Root cause proved read-only: `/api/lesson-wallet` already allows cross-branch redemption when `branch_id + credit.course_type_id + day/time` matches an active `schedule_templates` row, but the UI/server mapper could display schedule options using a `kids_group` fallback. That mismatch could produce a false `รอบเรียนที่เลือกไม่ตรงกับรอบเรียนประจำในระบบ` error.
- Source fix: wallet schedule template mapping now requires a valid branch slug and DB-backed course type. Wallet credits with missing/invalid course type data are disabled with a clear UI warning instead of opening a mismatched redemption flow.
- Business rules unchanged: same-month redemption, future-slot requirement, duplicate learner guard, capacity guard, no-payment redemption, cross-branch allowance, and wallet status transitions remain intact.
- No DB writes, migrations, cleanup, commit, push, or deploy were performed for this scoped fix.
- Verification passed: `npx tsc --noEmit`, `npm run check:mojibake`, `npm run lint`, and `npm run build`.

## 2026-06-10 - Lesson Wallet Success Feedback + User Schedule Learner Dots

- Fixed scoped UI feedback after successful `/dashboard/lesson-wallet` redemption: the modal now shows a success toast before closing and refreshing.
- Fixed `/dashboard/schedule` calendar dots to use learner identity colors as the primary dot color instead of being overridden by derived attendance/status colors.
- Root cause proved read-only: wallet `redeem()` success path closed the dialog and refreshed without any success feedback; schedule calendar had child dot colors available but rendered `status.dotClassName || learnerDot`, so normal upcoming/wallet/status colors could hide per-learner colors.
- Business rules unchanged: wallet same-month redemption, duplicate learner guard, no-payment flow, schedule status badges, and detail-card status text remain intact.
- No DB writes, migrations, cleanup, commit, push, or deploy were performed for this scoped UI fix.
- Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

## 2026-06-10 - User Dashboard/Schedule Learner Color Parity

- Fixed scoped UI mismatch where `/dashboard` and `/dashboard/schedule` could show different colors for the same learner.
- Added shared learner color source `src/components/dashboard/learner-colors.ts` and updated both dashboard calendars to use it.
- Wallet/status meaning on `/dashboard/schedule` is now a separate violet ring marker, so learner identity remains the dot fill color and no longer turns gray because of wallet/status state.
- Business rules unchanged: booking, attendance, wallet redemption, reschedule, and schedule status logic were not changed.
- No DB writes, migrations, cleanup, commit, push, or deploy were performed for this scoped UI fix.
- Verification passed: `git diff --check`, `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
