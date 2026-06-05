# PROJECT_STATE.md - Current Project Snapshot

Last updated: 2026-06-05
Source: local repo audit only. Items not confirmed from code/docs are marked as unknown.

## Current Snapshot

New Athlete Badminton School is a multi-portal badminton school management app.
The repo currently uses Next.js 16.2.6 App Router, React 18, TypeScript 5,
TailwindCSS 3.4, shadcn/Radix UI, Supabase, and SlipOK.

Observed scripts:

- `npm run dev`: Next dev with webpack.
- `npm run build`: Next build with webpack.
- `npm run lint`: ESLint against `src` with max warnings 0.
- `npm run check:mojibake`: Thai copy/mojibake guard.
- `npm run prod:check`: read-only production readiness checker.
- `npm run attendance:reconcile:dry-run`: attendance/session status drift report.
- `npm run attendance:reconcile:write`: repair tool. Requires owner confirmation before production write.

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

## Confirmed Business State

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
- Pricing reads DB `pricing_tiers` through `src/lib/booking-pricing.ts` and falls back to defaults only if rows are missing.
- Kids group combines sibling sessions for monthly tier pricing.

### Coach and Attendance Evidence

- Coach assignments now use assignment groups by learner/slot, with legacy assignment fallback.
- Coach check-in is per teaching slot and requires photo/GPS.
- Coach attendance is locked until check-in for the exact slot, except Admin/Super Admin retrospective paths.
- Coach teaching hour source rows are verified only with students, check-in, photo, location, and attendance.
- Weekly teaching summaries are stored in `coach_weekly_teaching_summaries`.

### Lesson Wallet

- `lesson_wallet_credits` exists.
- User can store verified scheduled sessions before the 48-hour cutoff when no attendance exists.
- Redemption is same-month, future-slot, no new payment.
- Walleted sessions are excluded from absence, makeup, and coach-payable evidence.

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

## Current Active Risk

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
- Read-only verification on 2026-06-04 for June 2026 coach assignment groups:
  - groups: 197
  - group session ids: 422
  - chunks: 6
  - active grouped sessions: 405
  - query errors: 0
- Commit `48e3faa` (`fix(prod): stabilize coach checkin audit and child booking guards`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-04.
- Production alias reported by Vercel CLI: `https://www.newathleteschool.com`.
- Historical child FK/name integrity repair on 2026-06-04 fixed one target booking where Admin schedule displayed the parent name as learner:
  - parent profile: `211069ab-7a7d-457d-8b22-f76e8d3ecae3`
  - child row: `65a94ede-296e-4bbe-9bab-2aaf03b99c7e`
  - booking: `080c8a56-9b67-4a83-a44b-5a0394f4b73f`
  - affected `booking_sessions`: 16 rows, repaired from `child_id=null` to the target child id
  - post-write sample join resolves to child name `สัจจธร ธิติศักดิ์สกุล` / nickname `น้องอองเดร`
- Admin schedule now has a UI guard for child bookings with missing `child_id`, so it flags missing child linkage instead of silently showing the parent as the learner. Coach assignment state is also color-coded: assigned coach is green, missing coach is red.
- Next production focus should be role smoke testing and any broader historical child FK audit only if new evidence appears.

## Pre-Existing Dirty Worktree Observed

Before this documentation audit, `git status --short` showed:

- Modified: `DEVELOPMENT_TODO.md`
- Modified: `src/app/api/admin/makeup/route.ts`
- Untracked: `SlipOK API Guide.docx`

Treat these as existing user/previous-agent changes. Inspect before editing. Do not revert.

## Unknown / Need Verification

- Whether the current dirty changes in `DEVELOPMENT_TODO.md` and `src/app/api/admin/makeup/route.ts` are already reviewed by the owner.
- Current `.env.local` values were not inspected in this audit.
- Current remote DB migration state after the latest local work needs confirmation before future DB-dependent work.
- Final staging smoke test across all roles after current attendance reconciliation is not confirmed in this audit.

## Do Not Regress

- Do not restore Admin booking on behalf of users.
- Do not rely on `booking_sessions.status` alone for attendance display.
- Do not use old LV 1-60 level ranges.
- Do not bypass schedule templates/slots for bookings, reschedule, makeup, or wallet redemption.
- Do not add a SlipOK mode UI toggle.
- Do not weaken coach evidence requirements for weekly teaching-hour closing.
- Do not use native browser alert/confirm/prompt in product UI.
