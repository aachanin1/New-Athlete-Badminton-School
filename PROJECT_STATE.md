# PROJECT_STATE.md - Current Project Snapshot

Last updated: 2026-06-09
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

## Pre-Existing Dirty Worktree Observed

Before the latest documentation sync after `86aa087`, `git status --short` showed:

- Untracked: `SlipOK API Guide.docx`

Treat the untracked guide as out of scope. Do not commit, delete, or move it unless the owner explicitly asks.

## Unknown / Need Verification

- Current `.env.local` values were not inspected in this audit.
- Current remote DB migration state after the latest local work needs confirmation before future DB-dependent work.
- Final production/local smoke test across all roles after `86aa087` is not confirmed in this audit.
- Admin makeup round-level actions after `86aa087` still need owner-driven UAT because the important buttons write production data.

## Do Not Regress

- Do not restore Admin booking on behalf of users.
- Do not rely on `booking_sessions.status` alone for attendance display.
- Do not use old LV 1-60 level ranges.
- Do not bypass schedule templates/slots for bookings, reschedule, makeup, or wallet redemption.
- Do not add a SlipOK mode UI toggle.
- Do not weaken coach evidence requirements for weekly teaching-hour closing.
- Do not use native browser alert/confirm/prompt in product UI.

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
