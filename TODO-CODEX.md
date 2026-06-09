# TODO-CODEX.md - Active Work Index

Last updated: 2026-06-09

This file is the short execution index for Codex. It does not replace
`DEVELOPMENT_TODO.md`; it points to the relevant detailed section.

## Current Source Files for Context

Always read first:

- `AGENTS.md`
- `PROJECT_STATE.md`
- `TODO-CODEX.md`

Read only when relevant:

- `DEVELOPMENT_TODO.md`, especially the active item named below.
- `PRODUCTION_READINESS.md` for deploy or production data work.
- `TODO.md` only as legacy backlog reference after verifying against code.

## Completed This Round

- Completed scoped auth UX polish:
  - Added password visibility toggles to login/register password fields in the Home auth modal and direct auth pages.
  - Scope was limited to auth input UI only; Supabase auth, redirects, validation, and registration behavior were not changed.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and local HTTP checks for `/`, `/auth/login`, `/auth/register`.
- Archived old long `AGENTS.md` to `context-archive/AGENTS.legacy-2026-06-04.md`.
- Replaced `AGENTS.md` with a compact operating guide.
- Created `PROJECT_STATE.md`.
- Created `TODO-CODEX.md`.
- No source code was intentionally changed in this documentation audit.
- Completed `21.6.19 Ghost Coach Check-in + Child FK Booking Integrity` scoped fixes:
  - Admin coach check-in audit now ignores stale coach assignments with no active verified learner sessions.
  - Admin coach check-in audit now chunks large active session lookups and reports load errors instead of silently showing an empty state.
  - Reschedule cleanup removes the old session from coach assignment group students.
  - Booking create/update now enforces child learner session `childId` integrity and persists `bookings.child_id`.
- Completed owner-confirmed attendance reconciliation write:
  - Synced session `1b9d1b2b-2078-4c47-a042-46d74ae41fa6` from `scheduled` to `completed`.
  - Follow-up dry-run reported 0 attendance/status mismatches.
- Verification this round:
  - `npm run check:mojibake` passed.
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed with `--max-warnings=0`.
  - `npm run build` passed.
  - `npm run prod:check` passed with warning: local `SLIPOK_TEST_MODE=true`.
  - `npm run attendance:reconcile:dry-run` passed with 0 mismatches after the confirmed write.
  - `git diff --check` reported only Windows LF/CRLF warnings.
- Additional read-only proof for coach check-in audit loader:
  - June 2026 grouped assignments: 197
  - grouped session ids: 422
  - chunks: 6
  - active grouped sessions: 405
  - query errors: 0
- Commit `48e3faa` was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production.
- Vercel production alias reported ready: `https://www.newathleteschool.com`.
- Commit `86aa087` (`fix(makeup): improve attendance gap round handling`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-05.
  - Vercel deployment id: `dpl_G79NWgVY7R4PMC2FsiMArXRhN4SS`.
  - Production alias: `https://www.newathleteschool.com`.
  - Scope: Admin makeup attendance-gap round handling, exact coach evidence, no-coach round-level resolution, and round-level Admin actions.
  - Pre-deploy checks passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
  - Supersedes the older local-only notes below that said the Admin makeup fixes were not committed, pushed, or deployed.
- Completed UI portion of `21.6.20 Historical Child FK Repair + Admin Schedule Integrity UI`:
  - Admin schedule flags child bookings with missing `child_id` instead of silently showing the parent profile name as the learner.
  - Admin schedule coach assignment state is color-coded: assigned coach is green, no coach is red.
  - Read-only dry-run confirmed exact historical repair candidate for booking `080c8a56-9b67-4a83-a44b-5a0394f4b73f` and 16 related sessions.
  - Owner-confirmed exact-row DB repair updated that booking and all 16 related sessions to child `65a94ede-296e-4bbe-9bab-2aaf03b99c7e`.
  - Post-write verification confirmed 0 target sessions with missing/wrong `child_id` and sample child join resolves to `น้องอองเดร`.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `npm run build`, and `git diff --check` (only Windows LF/CRLF warnings).
  - No commit, push, or deploy was run for this item.
- Completed scoped Admin makeup coach-checkin evidence fix:
  - Root cause proved read-only: `admin/makeup` could show an assigned coach as checked in by falling back to another coach's `coach_checkins` row in the same `schedule_slot_id`.
  - Fix: assigned groups now require exact `schedule_slot_id + coach_id` evidence before `coach_checkin_time` is passed to the Admin makeup UI.
  - No DB writes, migration, commit, push, or deploy were run for this fix.
- Completed scoped Admin makeup attendance-gap action hardening:
  - Root cause proved read-only: per-person review actions could be fired close together inside the same round, and `close_review` marked a session `completed`, which contradicted the rule for closing a case without makeup entitlement or coach teaching hours.
  - `close_review` now logs the terminal audit action only and no longer changes `booking_sessions.status` to `completed`.
  - Admin makeup now reads review request/closed metadata from `activity_logs` in chunks and hides closed review sessions from the review queue.
  - Round actions now send coach review/evidence requests to every eligible learner session in the round instead of only the first representative session.
  - Added round-level close action and request counters/status badges for coach review/evidence requests.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
  - No commit, push, or deploy was run for this fix.
- Completed scoped Admin makeup unassigned-round resolution UX/API:
  - Past normal rounds with learners but no coach in assignment groups now show a round-level resolution flow instead of per-learner action buttons.
  - Taught-but-forgotten cases require Admin to choose the real coach, create a retrospective assignment group for the whole round, record attendance per learner, sync `booking_sessions.status`, log audit details, and notify users.
  - Return-entitlement and close-round paths run across all eligible learner sessions in the selected round, so the round cannot be partially resolved by accident.
  - Per-learner buttons are hidden for no-coach rounds to prevent one child action from changing the wrong sibling/learner context.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `npm run build`.
  - `git diff --check` reported only Windows LF/CRLF warnings.
  - No commit, push, or deploy was run for this fix.
- Completed scoped false-absent display fix for partial attendance in the same slot/group:
  - Root cause proved read-only: `deriveSessionAttendanceStatus` inferred `absent` when another learner in the same scope had attendance, even though the target learner had no exact attendance row yet.
  - Fix: a past session without exact learner attendance now derives `attendance_gap_review`; `absent` remains reserved for exact attendance/source-of-truth evidence or explicitly synced absent sessions.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `npm run build`.
  - No DB writes, migration, commit, push, or deploy were run for this fix.
- Completed scoped Admin payroll teaching-hours zero-state fix:
  - Root cause proved read-only: June 2026 teaching/check-in/attendance data existed, but `/admin/payroll` could show all zero because it used a normal user-session Supabase client for payroll source reads and `getCoachTeachingHourSourceRows` silently ignored query errors.
  - Fix: `/admin/payroll` now requires Admin page access and uses `getServiceRoleClient()` server-side for summaries, teaching rules, and teaching-hour source rows.
  - Fix: `src/lib/coach-teaching-hours.ts` now throws descriptive query errors for assignment groups, legacy assignments, payable sessions, attendance counts, and coach check-ins instead of returning silent empty data.
  - Payroll calculation semantics were not changed.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
  - No DB writes, migration, cleanup, commit, push, or deploy were run for this fix.
- Completed scoped Admin payroll large-query fix:
  - Root cause proved read-only: `coach_assignment_groups` for 2026 contained 1001 grouped `booking_session_id` values. Full `.in()` reads against `booking_sessions.id` and `attendance.booking_session_id` failed with `Bad Request`; full `schedule_slot_id` reads also risked truncation by returning 1000 rows while chunked reads returned 1007.
  - Fix: `src/lib/coach-teaching-hours.ts` now chunks payroll source `.in()` reads for payable sessions by slot, payable grouped session ids, and attendance counts.
  - Payroll calculation semantics were not changed; the fix only changes query transport shape to avoid Supabase/PostgREST request limits and silent row caps.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and read-only chunk verification returned payable-by-slot 1007, payable-grouped 994, attendance 232 with no query errors.
  - No DB writes, migration, cleanup, commit, push, or deploy were run for this fix.

## Active Next Task

### 0. Admin Schedules vs Makeup Exact Learner Assignment Debug

Source context:

- Reported production pattern on 2026-06-08:
  - `admin/makeup` for 2026-06-07 17:00-19:00 shows learner `Tinn` / `ติณห์` as pending review with no coach in group and no coach check-in.
  - `admin/schedules` for the same learner/session shows pending attendance review but displays two coach names on the row.
- This page has regressed multiple times, so do not guess or patch broadly.

Scope:

- Read-only debug only until the owner approves a fix.
- Inspect only:
  - `booking_sessions`
  - `bookings`
  - `children`
  - `profiles`
  - `branches`
  - `course_types`
  - `coach_assignment_groups`
  - `coach_assignment_group_students`
  - `coach_assignments`
  - `coach_checkins`
  - `attendance`
- Do not write DB data.
- Do not run migrations.
- Do not cleanup rows.
- Do not edit source until the root cause is proved and owner approves.

Required proof:

- Identify the exact `booking_sessions.id` for learner `ติณห์`, 2026-06-07, 17:00-19:00, `kids_group`.
- Compare exact learner assignment vs slot-level/legacy coach context:
  - exact `coach_assignment_group_students.booking_session_id`
  - exact `coach_assignment_groups.coach_id`
  - all groups in the same `schedule_slot_id`
  - legacy `coach_assignments` rows for the same `schedule_slot_id`
  - exact `coach_checkins` by `schedule_slot_id + coach_id`
  - exact learner `attendance` by `booking_session_id + expected student_id`

Read-only proof result 2026-06-08:

- Target session: `fcd3e6ea-bac1-4513-8261-ff26e931f7ce`, learner Tin, `schedule_slot_id` `ec443dd3-9e8e-442b-a10d-c883c07d42c0`, 2026-06-07 17:00-19:00.
- Exact `coach_assignment_group_students` rows for the target session: 0.
- Exact target-session check-ins: 0.
- Exact target-session attendance rows: 0.
- Same slot has other groups/coaches for other learners and legacy `coach_assignments` rows: Coach Ik NA Ram and Coach Link NA Ratchada.
- Conclusion: `admin/makeup` is correct to show "no coach in group" for Tin. `admin/schedules` is likely presenting slot-level or legacy coach fallback as if it were Tin's learner-level assignment.

Possible root-cause labels:

- `admin/schedules` uses slot-level fallback coach names as if they were learner-level assignment.
- Missing `coach_assignment_group_students` for the reported learner session.
- Wrong group/session linkage.
- Stale legacy `coach_assignments` or stale same-slot group data.
- UI display uses a broader source than `admin/makeup`.

Safe fix direction, if confirmed:

- Keep `admin/makeup` strict: exact learner group and exact `schedule_slot_id + coach_id` check-in only.
- Make `admin/schedules` show exact learner coach assignment separately from slot-level/legacy diagnostic context.
- Do not treat a coach shown at slot level as proof that the specific learner has been assigned.

Source fix completed locally on 2026-06-08:

- Removed `coach_assignments`/slot-level coach fallback from `src/app/(admin)/admin/schedules/page.tsx`.
- Updated `src/lib/admin-attendance-state.ts` so `getCoachNames(session)` returns only exact learner group coach names, never fallback slot coaches.
- `admin/makeup` remains strict and unchanged for this fix.
- Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, and `npm run build`.
- No DB writes, migration, commit, push, or deploy were run for this fix. Await owner UAT/commit instruction.

### 0. Admin Makeup Exact Coach Check-In Evidence Debug

Source context:

- `admin/makeup` section "ต้องตรวจสอบการเช็คชื่อก่อนสรุปขาดเรียน".
- Reported production pattern: a learner session can show "ยังไม่พบโค้ชในกลุ่ม" while the round/header also shows coach check-in evidence.

Scope:

- Read-only debug only until the owner approves a fix.
- Inspect only:
  - `booking_sessions`
  - `coach_assignment_groups`
  - `coach_assignment_group_students`
  - `coach_checkins`
  - `attendance`
  - related `bookings`, `children`, `profiles`, branches, and course names needed to identify the reported session.
- Prove whether the root cause is:
  - slot-only coach check-in fallback contaminating no-group sessions,
  - missing `coach_assignment_group_students`,
  - wrong group/session linkage,
  - stale legacy assignment data,
  - or UI grouping/display using the wrong source.

Required proof:

- Build a per-session table with:
  - `booking_session_id`
  - learner name
  - date/time/branch/course
  - `schedule_slot_id`
  - assignment group id/name
  - group coach id/name
  - slot check-in coach id/name
  - exact `schedule_slot_id + coach_id` check-in result
  - slot-only check-in result
  - exact learner attendance status

Read-only proof result:

- Verified on 2026-06-08 for 2026-06-07 16:00-18:00.
- Affected session: `7513b5d0-f5c4-43d8-bb61-bac051c97e09`.
- Learner/branch/course: มาเบล / สุวรรณภูมิ / kids_group.
- The session has no `coach_assignment_group_students` link, so it has no exact group coach.
- The same `schedule_slot_id` has check-ins from other assigned coaches.
- Root cause is slot-only coach check-in fallback contamination in Admin makeup data shaping. The UI is receiving check-in evidence for a no-group learner session because server code falls back to `checkinsBySlotId`.
- Source fix completed locally on 2026-06-08: Admin makeup now only passes coach check-in evidence when there is an exact `schedule_slot_id + group coach_id` match. Same-slot check-ins are no longer evidence for sessions that are not linked to a coach group.
- Post-fix read-only proof for session `7513b5d0-f5c4-43d8-bb61-bac051c97e09` showed `slot_only_has_checkin=true` but `new_server_would_show_checkin_for_no_group=false`.
- Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, and `npm run build`.
- No DB writes, migration, commit, push, or deploy were run for this fix. Await owner UAT/commit instruction.

Production safety:

- Source fix is local only until owner orders commit/push/deploy.
- No DB writes.
- No migration.
- No cleanup rows.
- If a write or code fix is needed, report the exact root cause and proposed fix first.

### 0. Production Smoke Test / Admin Makeup Regression

Source context:

- `admin/makeup` attendance-gap review and coach evidence flows.
- Latest scoped Admin makeup edits are committed, pushed, and deployed as `86aa087`.

Scope:

- Smoke the affected Admin makeup cases locally or in production only with explicit owner-approved test cases:
  - no-coach past round opens `จัดการเคสทั้งรอบ` and hides per-learner buttons.
  - no-coach taught path requires a real coach, creates the retrospective group, and syncs learner attendance/status.
  - no-coach return-entitlement path returns entitlement for every eligible learner in that round.
  - no-coach close-round path closes review for every eligible learner without marking sessions `completed`.
  - round-level "ส่งให้โค้ชตรวจสอบรอบนี้" targets all eligible sessions in the round.
  - round-level "ขอหลักฐานโค้ชรอบนี้" targets all eligible sessions in the round.
  - "ปิดเคสทั้งรอบ" removes the round from the review queue without setting sessions to `completed`.
  - closed cases do not re-enter coach evidence requests.

Status:

- Code checks passed before deployment.
- Documentation sync after deployment completed on 2026-06-05.
- Post-sync verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `npm run build`, `npm run prod:check`.
- `npm run prod:check` warning: local `SLIPOK_TEST_MODE=true`; production must keep real SlipOK env configured.
- `git diff --check` reported only LF/CRLF warnings for documentation files.
- Browser/UAT smoke still pending owner/local confirmation.

Production safety:

- Do not run production write actions for smoke unless the owner explicitly confirms the exact test case.
- Do not run DB writes/migrations or cleanup for this item.

### 1. Documentation Verification Pass

Compare `AGENTS.md`, `PROJECT_STATE.md`, and `TODO-CODEX.md` against repo again after the latest technical task.
Fix only stale or unclear documentation.

### 2. Phase 3 Deploy Readiness

Source context:

- `DEVELOPMENT_TODO.md` -> `21. Phase 3 Deploy Readiness`
- `PRODUCTION_READINESS.md`

Expected focus:

- Confirm remote DB migration state.
- Confirm production/staging env, especially SlipOK live mode.
- Run `npm run prod:check`.
- Smoke test roles: Super Admin, Admin, Head Coach, Coach, User.

### 3. Attendance Sync Root-Cause Audit + Write-Path Enforcement

Source context:

- `DEVELOPMENT_TODO.md` -> `21.6.18 Attendance Sync Root-Cause Audit + Write-Path Enforcement`
- `PROJECT_STATE.md` -> Attendance, Current Active Risk

Status:

- Current runtime write paths observed in scope call `src/lib/attendance-write-through.ts`.
- Owner-confirmed reconciliation write was run on 2026-06-04.
- Latest dry-run reported 0 mismatches.

Keep as regression guard:

- If future work touches attendance, re-check:
  - `src/app/api/coach/attendance/route.ts`
  - `src/app/api/admin/makeup/route.ts`
  - `src/lib/attendance-write-through.ts`
  - `scripts/dry-run-attendance-reconciliation.js`

Required verification for this task:

- `npm run check:mojibake`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run attendance:reconcile:dry-run`
- `git diff --check`
- `npm run build`

Production safety:

- No blind production write.
- Report exact stale rows first.
- Run `npm run attendance:reconcile:write` only after owner confirmation.
- Do not deploy production until owner confirms.

## Follow-Up Queue

- Smoke test production after `86aa087` deployment across Super Admin, Admin, Head Coach, Coach, and User.
- For Admin makeup regression, only run write actions when the owner gives the exact test case to mutate.
- Verify Admin schedule now shows the repaired learner as `น้องอองเดร` for booking `080c8a56-9b67-4a83-a44b-5a0394f4b73f`.
- If another historical child-name issue appears, run a fresh read-only dry-run before any write.

## Known Pre-Existing Dirty Worktree

Observed before this documentation sync after `86aa087`:

- Untracked: `SlipOK API Guide.docx`

Do not commit, delete, or move the untracked guide unless the owner explicitly asks.

## Session Exit Checklist

Before ending any future work session:

- Update `PROJECT_STATE.md` if project facts changed.
- Update `TODO-CODEX.md` if next task, blocker, or verification changed.
- Keep `DEVELOPMENT_TODO.md` updated only when detailed historical tracking changes.
- Report changed files, reason, checks run, and remaining risks.
