# AGENTS.md - Operating Rules for Codex Agents

Last updated: 2026-08-03

This file is the short, mandatory operating guide. The previous long agent
document was archived at `context-archive/AGENTS.legacy-2026-06-04.md`.
Use the archive only when deeper historical context is needed.

## Mandatory Start Protocol

Before doing any work:

1. Read `AGENTS.md`, `PROJECT_STATE.md`, and `TODO-CODEX.md`.
2. If the task references an older feature, decision, design contract, business formula,
   or release, read only the relevant section of `DEVELOPMENT_TODO.md` and the
   referenced design/source material. Do not rely on `PROJECT_STATE.md` alone when
   the detailed policy or formula may live elsewhere.
3. Summarize the current project state briefly.
4. State the scope for this round, including likely files or flows.
5. Do not edit files outside scope unless required to finish safely.
6. Inspect the relevant source files before editing. Do not guess.
7. After edits, run the appropriate checks for the scope.
8. Before finishing, apply the Session Closeout Protocol below and update
   `PROJECT_STATE.md` and `TODO-CODEX.md` when required.
9. Report changed files, why they changed, what was verified, and what remains.

## Default Execution Mode — One Task, One Approval, Continuous Delivery

`ONE TASK, ONE APPROVAL, CONTINUOUS DELIVERY`

One explicit Owner approval of a Scope Contract authorizes Developer Codex to
execute the approved task continuously through:

audit → implementation → focused local verification → bounded corrections within
Scope → diff compliance → commit/push → staged artifact → READY FOR OWNER UAT

Do not return for separate approval after each technical checkpoint when the
checkpoint and action are already authorized by the Scope Contract.

The primary task states are:

- `DEVELOPING`
- `READY FOR OWNER UAT`
- `TASK DONE`

Keep Source, tests, Commit, Push, artifact, Promotion, Production, UAT, Migration,
feature-control, allowlist, and data states separate in technical evidence even
when the Owner-facing task status uses these three concise states.

### Scope Contract

Every task must define:

- Actor.
- Current behavior.
- Expected behavior.
- Completion criteria.
- Included business flows.
- Protected and out-of-scope business flows.
- Planned technical change set.
- Authorized Git, Deploy, Environment, Migration, Production, and data actions.
- Owner UAT steps and expected visible results.

Use exact planned allowlists for functional files, tests, and documentation.
Report expected functional-file count and blast radius, but never treat file count
as a substitute for dependency or business-flow analysis.

A technical file may be added to the planned change set without a new Owner round
only when it is a proven direct dependency of the same Intended Behavior,
introduces no additional business flow, touches no protected domain, has its reason
written before editing, and is disclosed in the final report.

Any new business behavior, role, portal, payment, pricing, entitlement,
permission, attendance, payroll, accounting, Migration, Environment,
feature-control, secret, or Production-data operation requires an Owner Hard Stop
unless the Scope Contract already explicitly authorizes it.

### Bounded Corrections and Scope Discipline

- Bounded corrections need no new Owner approval while Root Cause, Intended
  Behavior, business flow, and protected domains remain unchanged.
- Hard Stop when Root Cause materially changes, the same failure remains after two
  reasonable correction attempts, or safe completion requires another business
  flow or protected domain.
- Do not perform opportunistic refactors, cleanup, dependency upgrades, formatting
  sweeps, or adjacent bug fixes.
- Before every Commit, inspect `git diff --name-status`, `git diff --stat`, the
  complete staged diff, every path against the Scope Contract, and the business
  behavior actually changed.
- An unexplained path outside the Scope Contract is
  `SCOPE BREACH — REJECT RESULT`. Do not conceal it with reset, checkout, stash,
  cleanup, or overwriting user work.

### Code Complete and READY FOR OWNER UAT

READY FOR OWNER UAT requires:

- Focused regression coverage or documented substitute verification.
- TypeScript, lint, and Production build when applicable.
- Relevant deterministic tests passed.
- Diff compliance passed.
- Source committed and pushed.
- A staged artifact tied to the exact tested Source SHA.
- A short Owner handoff containing URL, required role, 3–7 UAT steps, expected
  visible results, artifact ID/SHA, passed technical checks, and known limitations.

Owner may perform manual UI/business UAT and return PASS or FAIL with screenshots.

- Screenshots can confirm visible UI behavior.
- Screenshots do not replace backend reconciliation for payment, pricing,
  entitlement, permission, attendance, payroll, accounting, Migration, or data
  writes.
- Developer Codex remains responsible for technical and backend evidence.
- Any Source or configuration change after Owner PASS invalidates that PASS and
  requires a new artifact plus focused Owner retest.

### Promotion and Closeout

- Owner PASS authorizes Promotion only of the exact artifact/SHA the Owner tested.
- Never Promote before Owner PASS and never rebuild between PASS and Promotion.
- In the current Vercel workflow, promoting a Preview deployment to Production
  creates a distinct Production deployment and runs a new Production build.
  Preview UAT therefore is not immutable Production-artifact UAT and must not be
  used for a no-rebuild exact-artifact release contract.
- When the Scope Contract requires no-rebuild exact-artifact Promotion, first
  create a staged Production deployment with `vercel --prod --skip-domain`, UAT
  that exact staged Production artifact, and then Promote that exact staged
  Production artifact. Do not set another no-rebuild contract against a Preview
  artifact.
- After Promotion, run automated Production health and error-log checks.
- A second manual Owner Production UAT is optional unless Production differs from
  staged behavior or the Scope Contract requires it.
- Update current-state documentation once at closeout. If a material Hard Stop
  ends execution before closeout, record one safe handoff instead of leaving
  mutable state undocumented.
- Publish the authorized closeout and report TASK DONE only after every required
  technical and business condition passes.

### Material Hard Stops

Hard Stop for:

- Ambiguous or conflicting business decisions.
- Scope crossing another business flow or protected domain.
- Unapproved Migration, Environment, feature-control, permission, secret, or
  Production-data operation.
- Destructive or irreversible data action without exact rows and rollback plan.
- Material Root Cause change.
- Required tests/build still failing after bounded correction.
- Staged smoke failure.
- Non-exact artifact/SHA identity.
- Missing required rollback candidate.
- Task-attributable Production regression.

Unrelated Production traffic is not automatically a task failure. Attribute it
before blocking unless it prevents a safe conclusion about a protected domain.

### No Yes-Man

PM and Developer must:

- Challenge Owner assumptions when Source, tests, data, or business rules conflict.
- Separate Fact, Inference, and Unknown.
- Never report PASS while a required check fails.
- Recommend the smallest safe solution.
- Never expand vague wording into additional features.
- Never minimize risk to make a task appear complete.
- Never use Owner UI PASS to override failing technical or backend evidence.

Read-only Audit remains available when the Owner asks only for investigation.
Production Data Operation requires explicit authorization for exact rows, actions,
effects, verification, and rollback.

## Documentation Roles

- `AGENTS.md`: permanent rules, guardrails, and source-of-truth business constraints.
- `PROJECT_STATE.md`: current snapshot of the actual repo and confirmed system state.
- `TODO-CODEX.md`: active execution index and next work queue.
- `DEVELOPMENT_TODO.md`: long historical backlog and detailed implementation notes. Do not read the whole file every session.
- `TODO.md`: legacy backlog/reference only. Treat as stale until verified against code and `DEVELOPMENT_TODO.md`.

## Project Context and Documentation Protocol

- `PROJECT_STATE.md` records the prioritized current snapshot. It must distinguish
  Owner policy, local source, pushed source, deployed source, enabled/allowlisted
  state, Production-active behavior, UAT, and data repairs.
- `TODO-CODEX.md` is the active execution index. Keep completed summaries short and
  link to `PROJECT_STATE.md` or `DEVELOPMENT_TODO.md` for history.
- Put long decision/reconciliation history in `DEVELOPMENT_TODO.md`; keep only the
  current result, blocker, risk, and next action in the two primary context files.
- Never write `PASS` for an end-to-end feature when Owner policy, source, and
  Production runtime do not match. A narrower result may say `Source complete` or
  `Data repaired` only when its scope is explicit.
- Always keep these states separate: `Source complete`, `Pushed`, `Deployed`,
  `Enabled`, `Allowlisted`, `Production active`, `UAT passed`, and `Data repaired`.
- Every Production repair record must name the policy/formula used and its related
  payment, coupon, wallet, entitlement, attendance, payroll, or accounting effects.
- If docs conflict with source, git, or verified Production state, report
  `Documentation Drift`, correct the docs, and do not automatically trust the older
  document.
- Owner-confirmed rules affecting money, pricing, entitlements, attendance,
  payments, or payroll must be promoted to a searchable Hard Business Rule or
  Decision Record.

## Current Project

New Athlete Badminton School is a badminton school management system for Thailand.
Observed stack from `package.json`: Next.js 16.2.6 App Router, React 18,
TypeScript 5, TailwindCSS 3.4, shadcn/Radix UI, Supabase, SlipOK, SWR,
Zustand, React Hook Form, Zod, Sonner, and Lucide.

Main portals:

- Public: landing page and ranking.
- User: dashboard, booking, payment slip upload, schedule, history, reschedule, lesson wallet, children, progress, complaints, notifications.
- Coach/Head Coach: today, check-in, attendance, students, levels, programs, hours, notifications, assignment groups for head coach.
- Admin/Super Admin: overview, users, branches, schedules, schedule templates, payments, payment settings, coupons, complaints, notifications, ranking, makeup, coach check-ins, payroll/teaching hours, finance, settings, logs.

## Hard Business Rules

### Levels

- Current active school level system is LV 0 through LV 70.
- LV 0 means unassessed. Learners start at LV 0 until evaluated.
- Evaluated levels currently run LV 1-70.
- Current ranges:
  - LV 1-34: Basic.
  - LV 35-58: Athlete C.
  - LV 59-70: Athlete B.
- Do not reintroduce old LV 1-60 ranges or old split ranges such as 1-30, 31-39, 40-43, 44-60.
- The code has an extensibility migration that can allow LV 71+ rows, but do not create, assume, or use LV 71+ as current production behavior unless the owner explicitly confirms active levels beyond 70.
- Coach/Admin evaluation must use active rows from `levels`, not free typed levels or hardcoded ranges.

### Attendance

- `attendance` is the source of truth for present, late, and absent.
- `booking_sessions.status` is a lifecycle/cache field and must not be used alone for attendance display, makeup eligibility, payroll/audit, or schedule status.
- Display/review decisions must use `src/lib/session-attendance-status.ts`.
- Admin overview, Admin schedules, and Admin makeup must share `src/lib/admin-attendance-state.ts`.
- Attendance rows must match the exact learner by `booking_session_id + student_id`.
- Expected `student_id` is `booking_sessions.child_id` for child learners and `bookings.user_id` for self/adult learners.
- Coach/Admin attendance writes must sync the exact `booking_sessions.id` through `src/lib/attendance-write-through.ts`.
- Present/late maps to `booking_sessions.status = completed`; absent maps to `booking_sessions.status = absent`.

### Coach Assignment and Check-In

- Real teaching rounds are `schedule_slots`.
- Current assignment model uses `coach_assignment_groups` and `coach_assignment_group_students`; legacy `coach_assignments` still exists as fallback/compatibility.
- Coaches are assigned to teaching slots and learner groups, not just branches.
- Coach check-in is per `schedule_slot_id`, not daily.
- Coach check-in requires selfie/photo and GPS evidence.
- Coach attendance is blocked until the responsible coach has checked in for that exact slot, except Admin/Super Admin retrospective flows.

### Payments and SlipOK

- User creates bookings and uploads payment slips. Admin booking on behalf of users is disabled.
- `/admin/booking` redirects to `/admin`; `POST /api/admin/booking` returns `410 Gone`.
- Current Owner-approved Production policy is the shared server-side `SLIPOK_TEST_MODE=true` for both Legacy and Progressive payments.
- Under the current policy, a successful slip upload is auto-approved/verified through each flow's normal state transition, and no live SlipOK network request is made.
- Do not add a Progressive-only SlipOK mode flag. Legacy and Progressive must read the same global server-side mode.
- Live SlipOK verification must not be proposed or enabled until the Owner changes policy after branch-specific receiving accounts are designed.
- Keep `SLIPOK_API_URL` and `SLIPOK_API_KEY` server-only; never expose keys in UI.
- Do not add a UI toggle for SlipOK mode. Mode belongs in environment variables and redeploy flow.
- SlipOK success should keep `bookings`, `payments`, history, and notifications consistent.

### Pricing

- `pricing_tiers` in Supabase is the source of truth.
- `src/lib/pricing.ts` defaults exist only as fallback when rows are missing.
- Kids group uses sibling pricing by combining all children sessions for the monthly tier.
- Adult group and private lessons use package/hour rules from pricing tiers.
- Do not change tiers or pricing semantics without explicit owner approval.

#### Permanent Kids Group Pricing Guardrail — Option A Compatibility

- After general Kids Group Entry is activated, every new general Kids Group booking
  must use Progressive pricing. Active Legacy Kids Group bookings in the same
  user/course/month scope contribute their booking entitlement sessions as the
  initial `previousActiveSessions` baseline; they do not enter the Progressive
  ordering as rewritten bookings.
- For Legacy rows without `entitlement_sessions`, use the stable booking entitlement
  `bookings.total_sessions`. Do not count raw reschedule descendants as additional
  entitlement, and do not reduce entitlement merely because a session is walleted.
- Progressive pricing never deducts a Legacy stored/paid amount. Existing Legacy
  bookings must not be repriced, credited, refunded, assigned Progressive scopes or
  snapshots, or backfilled merely to enable Progressive entry.

#### Permanent Kids Group Pricing Guardrail

- Legacy and Progressive Kids Group pricing are different formulas. Never describe
  them as one algorithm or silently apply one flow's repair rule to the other.
- Legacy currently uses monthly true-up over settled (`paid`/`verified`) history:
  `charge = max(0, cumulativeSessionsAfter * rateOf(cumulativeSessionsAfter) - existingSettledTotal)`.
  Pending bookings are not settled history.
- Owner-approved Progressive pricing is booking-level and ordered:
  `previousActiveSessions` is the active entitlement count before the new booking,
  `cumulativeAfter = previousActiveSessions + newBookingSessions`, and
  `grossBookingPrice = newBookingSessions * rateOf(cumulativeAfter)`.
- Progressive active ordering includes non-expired `pending_payment`, `paid`, and
  `verified` bookings, ordered by `created_at` then booking id. Cancelled/expired
  bookings do not contribute.
- Progressive pricing has no retroactive monthly true-up, price-difference credit,
  or rewrite of earlier bookings. With the verified current tier examples: one
  10-session booking is `5,000`; split `5+5` is `3,125 + 2,500 = 5,625`; ten
  one-session bookings total `5,825`.
- If Owner policy and Production-active behavior differ, classify the state as
  `PRODUCTION POLICY MISMATCH`; do not close it as `PASS`.

### Scheduling and Lesson Wallet

- `schedule_templates` is the DB source of truth for bookable recurring slots.
- `schedule_slots` are real dated teaching slots and must be linked from `booking_sessions.schedule_slot_id`.
- `src/lib/branch-schedules.ts` is legacy/reference only unless code inspection proves otherwise.
- Normal teaching rounds have no fixed learner-capacity ceiling. Occupancy, configured
  `max_students`, cached `current_students`, or a derived `full` state must not block
  new User booking, pending-payment booking edit, User reschedule, Lesson Wallet
  redemption, or makeup/replacement-date entry. The Head Coach divides learners into
  groups and assigns coaches after booking.
- Unlimited learner entry does not relax exact-learner duplicate/overlap prevention,
  ownership or role authorization, active schedule-template and real
  `schedule_slot_id` validation, future/not-started checks, booking/payment status,
  applicable wallet entitlement-expiry and reschedule-month rules, idempotency,
  concurrency, atomicity, pricing,
  coupon, Ledger, Finance, attendance, or coach-evidence safeguards.
- Admin booking on behalf of users remains disabled; unlimited learner entry must not
  restore `/admin/booking` or `POST /api/admin/booking`.
- Lesson wallet credits can store a verified scheduled session only before the
  48-hour cutoff, with no attendance, no started session, and no makeup session.
- Same-month redemption is the default. Kids Group at every tier, Adult Group
  single-session, and Private single-hour credits must remain in the original
  month and must never create a new payment, coupon, Ledger, Finance, refund, or
  financial-credit row.
- Adult Group and Family Private packages above one purchased session/hour receive
  a ten-month Lesson Wallet entitlement only when exactly one approved
  `payments` row has a trustworthy `verified_at` and exactly one matching
  historical `pricing_tiers` row was effective on that Bangkok approval date.
  Historical tier evidence matches the purchased quantity inclusively:
  `min_sessions <= purchasedQuantity` and
  `(max_sessions IS NULL OR purchasedQuantity <= max_sessions)`. Zero or multiple
  effective matches fail closed. This evidence rule applies to every course and
  must not change price calculation, package amounts, tier rows, or Kids pricing.
  The approval month is month 1 and expiry is 23:59:59.999 Asia/Bangkok on the
  final day of inclusive calendar month 10. Missing or ambiguous evidence must
  fail closed; re-walleting must preserve the original entitlement start and
  expiry.
- One Family Private hour is one atomic entitlement unit identified by exact
  `booking_id + original date + start time + end time + branch_id +
  schedule_slot_id`. Storing or redeeming any participant must move every self/
  child participant together to one target hour, preserve each `child_id`, and
  never permit participant splitting. Concurrent use must yield one winner and a
  typed conflict with no residue.
- Customer Schedule counts and renders that exact Family Private unit once, lists
  every participant with the participant's own name and Level, and exposes one
  all-family Store action. Wallet renders one credit and one Redeem target flow per
  Family unit. Head Coach/Admin operational views remain participant rows.
- Private identity never merges across a shared Family time. Self uses
  `bookings.user_id`, the profile identity/Level, and `child_id = NULL`; each child
  uses the exact `booking_sessions.child_id` and that child's identity/Level.
  Missing child evidence must fail visibly rather than fall back to the booking
  owner's name or Level.
- Existing wallet credits must not be bulk rewritten, backfilled, recalculated,
  or automatically revived. Existing active credits retain their stored expiry;
  expired credits remain expired. New policy evidence applies only when a new
  eligible verified/not-yet-walleted session is stored after release.
- Walleted sessions are not absent, not completed, not makeup-eligible, and not coach-payable.

### Coach Teaching Hours

- Weekly teaching-hour/payroll review uses evidence, not assumptions.
- Verified teaching evidence requires assigned slot/group, active learner(s), coach check-in, photo, location, and attendance.
- `coach_weekly_teaching_summaries` is the closed weekly summary/audit source.
- Employment types are `full_time`, `half_time`, and `part_time`.

## Technical Guardrails

- Route protection is split across `src/proxy.ts`, layout guards, and API guards. Inspect the actual route/API before changing auth.
- Admin menu access for standard Admin is controlled by `system_settings.admin_menu_permissions` and `src/lib/admin-navigation.ts`.
- Use `getServiceRoleClient()` only in server contexts that need RLS bypass.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `SLIPOK_API_KEY`, or other secrets to client code.
- Critical business mutations should use `src/lib/activity-log.ts`.
- Do not use browser-native `alert`, `confirm`, or `prompt` for product UI. Use shadcn/Radix dialogs, alert-dialogs, forms, and toasts.
- Thai UI copy is primary. When touching Thai text, run `npm run check:mojibake`.
- Prefer existing helpers and local patterns over new abstractions.
- Keep changes scoped. Do not refactor unrelated code while fixing a flow.
- Inspect dirty worktree files before editing them. Do not overwrite user or previous-agent changes.

## Documentation Consistency Gate

### A. Single Owner for Mutable Facts

- `AGENTS.md` owns permanent rules, guardrails, and business policies only.
- `PROJECT_STATE.md` is the only authority for current mutable state: Active Task,
  Task Status, Branch, Local/Remote HEAD, current Source, pushed Source, deployed
  Source, Deployment ID, migrations, feature controls, allowlist,
  Production-active behavior, UAT, data repair, customer impact, financial impact,
  blocker, and current next gate.
- `TODO-CODEX.md` owns only the short active execution index, next action, and
  Parking Lot. It must not maintain an independent detailed copy of mutable Git,
  Deployment, environment, or Production facts. When detail is needed, reference
  the relevant `PROJECT_STATE.md` section.
- `DEVELOPMENT_TODO.md` owns dated historical evidence, decision records, detailed
  audits, and closeouts. Historical records must use dated wording such as
  "State observed at this closeout" and must not present an old value as current.
- `TODO.md` remains stale legacy reference unless independently verified.

### B. Update Order

At the task closeout, or at one safe handoff when a material Hard Stop prevents
continued execution, update documentation in this order:

1. Verify actual Source, Git, Deployment, controls, Production, and data state.
2. Replace the current values in `PROJECT_STATE.md`.
3. Derive the short `TODO-CODEX.md` status and next action from `PROJECT_STATE.md`.
4. Append a dated `DEVELOPMENT_TODO.md` record only when detailed history is needed.
5. Run the Documentation Consistency Matrix before reporting or committing.

Do not only append a new report while leaving an older contradictory current claim.

### C. Mandatory Documentation Consistency Matrix

Before every documentation closeout, compare these fields:

- Active Task
- Task Status
- Branch
- Local HEAD
- Remote HEAD
- Ahead/Behind
- Source Complete
- Tests Passed
- Committed
- Pushed
- Current Source
- Deployed Source
- Deployment ID
- Migration Source
- Migration Applied
- Feature Enabled
- Allowlisted
- Production Active
- Production UAT
- Controlled Write UAT
- Data Repaired
- Production Data Changed
- Customer Impact
- Financial Impact
- Blocker
- Remaining Work
- Next Gate / Next Action
- Parking Lot authorization state

Every current field must have one value. Do not use a combined `PASS` to conceal
different states.

### D. Hard Stop

If any current-state value conflicts across documents, Source, Git, Deployment, or
verified Production evidence:

- Report `DOCUMENTATION DRIFT`.
- Mark unresolved values `Unknown / Need verification`.
- Do not claim Task Done.
- Do not commit documentation.
- Do not push.
- Do not deploy.
- Do not start the next task.
- Perform read-only verification or stop and request Owner direction.

The agent may commit only after the matrix is internally consistent.

### E. Historical Wording

- Dated history may preserve old Source, deployments, flags, blockers, and `PASS`
  labels only within an explicitly Historical, Superseded, or
  "State observed at this closeout" section.
- Do not use "Current", "Next task", or present-tense deployment claims inside old
  records unless the statement is explicitly scoped to that historical date.
- Never delete legitimate history merely to make current documents appear aligned.
  Correct its label or tense.

### F. No Duplicated Mutable State

Do not copy complete mutable Production/Git state into multiple current sections.

When a short summary must repeat a value:

- State that `PROJECT_STATE.md` is authoritative.
- Update the copied summary in the same session.
- Include it in the consistency matrix.
- Treat a mismatch as a blocking failure, not a minor documentation issue.

### G. Session Final Report Requirement

Every Codex final report must separately state:

- Source Complete
- Tests Passed
- Committed
- Pushed
- Deployed
- Feature Enabled
- Allowlisted
- Production Active
- Production UAT Passed
- Controlled Write UAT
- Data Repaired
- Production Data Changed
- Customer Impact
- Financial Impact
- Task Done
- Active Task
- Next Action

Never report only `PASS`.

### H. Documentation-Only Safety

A documentation-only commit must not claim a Source, Migration, Deploy, Production,
customer, data, or financial change that did not occur.

## Local Dev and Verification

Common checks:

- TypeScript: `npx tsc --noEmit`
- Mojibake guard: `npm run check:mojibake`
- Lint: `npm run lint`
- Build: `npm run build`
- Production readiness: `npm run prod:check`
- Attendance report: `npm run attendance:reconcile:dry-run`

Use only the checks appropriate to the scope, but for attendance/payment/booking changes be conservative.

After running `npm run build`, do not leave an existing dev server/browser session as-is.
Next can serve stale `.next` static chunks in dev. Before handing UI back after build-related work:

1. Stop the dev server on port 3000.
2. Delete only the generated `.next` folder inside this repo.
3. Restart `npm run dev -- --hostname 127.0.0.1 --port 3000`.
4. Verify `http://127.0.0.1:3000` and `_next/static/*` assets.

## Production Safety

- Never run production data writes blindly.
- Production stale-data repairs require reporting exact rows first and owner confirmation before write.
- Do not deploy production until the owner confirms.
- Do not delete or reset data unless the owner explicitly requests it and the target scope is verified.

## Unknowns Must Stay Explicit

If code, DB state, deployed state, or business intent cannot be confirmed from local repo and current user instruction, write `Unknown / Need verification`.
Never promote assumptions into facts.

## Session Closeout Protocol

Before ending every session, answer and record as needed:

1. Did Owner policy change or receive new confirmation?
2. Did Source change?
3. Was the work committed or pushed?
4. Was a staged artifact created?
5. Did Owner UAT pass for that exact artifact/SHA?
6. Was it Promoted without rebuild?
7. Did post-Promotion health and error-log checks pass?
8. Were any feature controls or allowlists changed?
9. Did Production DB/data change?
10. Are real users affected?
11. Did known risks, limitations, or blockers change?
12. Did the next task change?

For normal continuous delivery, update `PROJECT_STATE.md` and `TODO-CODEX.md` once
at closeout, then publish that closeout. Put one dated decision/closeout record in
`DEVELOPMENT_TODO.md` when detailed history is needed. If a material Hard Stop
prevents continuation, create one safe handoff update instead. Do not repeatedly
rewrite documentation at every already-authorized technical checkpoint, and do
not leave material state drift across sessions.
