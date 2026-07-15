# AGENTS.md - Operating Rules for Codex Agents

Last updated: 2026-06-04

This file is the short, mandatory operating guide. The previous long agent
document was archived at `context-archive/AGENTS.legacy-2026-06-04.md`.
Use the archive only when deeper historical context is needed.

## Mandatory Start Protocol

Before doing any work:

1. Read `AGENTS.md`, `PROJECT_STATE.md`, and `TODO-CODEX.md`.
2. If the task references older work, read only the relevant section of `DEVELOPMENT_TODO.md`.
3. Summarize the current project state briefly.
4. State the scope for this round, including likely files or flows.
5. Do not edit files outside scope unless required to finish safely.
6. Inspect the relevant source files before editing. Do not guess.
7. After edits, run the appropriate checks for the scope.
8. Before finishing, update `PROJECT_STATE.md` and `TODO-CODEX.md` when state, risks, or next work changed.
9. Report changed files, why they changed, what was verified, and what remains.

## Documentation Roles

- `AGENTS.md`: permanent rules, guardrails, and source-of-truth business constraints.
- `PROJECT_STATE.md`: current snapshot of the actual repo and confirmed system state.
- `TODO-CODEX.md`: active execution index and next work queue.
- `DEVELOPMENT_TODO.md`: long historical backlog and detailed implementation notes. Do not read the whole file every session.
- `TODO.md`: legacy backlog/reference only. Treat as stale until verified against code and `DEVELOPMENT_TODO.md`.

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
  same-month wallet/reschedule rules, idempotency, concurrency, atomicity, pricing,
  coupon, Ledger, Finance, attendance, or coach-evidence safeguards.
- Admin booking on behalf of users remains disabled; unlimited learner entry must not
  restore `/admin/booking` or `POST /api/admin/booking`.
- Lesson wallet credits can store a verified scheduled session only before the 48-hour cutoff, with no attendance and no started session.
- Wallet redemption must stay in the same month and must not create a new payment.
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

Whenever current state changes, update documentation in this order:

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
