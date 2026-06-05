# TODO-CODEX.md - Active Work Index

Last updated: 2026-06-06

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

## Active Next Task

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
