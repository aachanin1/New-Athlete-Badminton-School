# TODO-CODEX.md - Active Work Index

Last updated: 2026-06-04

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
- Completed UI portion of `21.6.20 Historical Child FK Repair + Admin Schedule Integrity UI`:
  - Admin schedule flags child bookings with missing `child_id` instead of silently showing the parent profile name as the learner.
  - Admin schedule coach assignment state is color-coded: assigned coach is green, no coach is red.
  - Read-only dry-run confirmed exact historical repair candidate for booking `080c8a56-9b67-4a83-a44b-5a0394f4b73f` and 16 related sessions.
  - Owner-confirmed exact-row DB repair updated that booking and all 16 related sessions to child `65a94ede-296e-4bbe-9bab-2aaf03b99c7e`.
  - Post-write verification confirmed 0 target sessions with missing/wrong `child_id` and sample child join resolves to `น้องอองเดร`.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `npm run build`, and `git diff --check` (only Windows LF/CRLF warnings).
  - No commit, push, or deploy was run for this item.

## Active Next Task

### 0. 21.6.20 Historical Child FK Repair + Admin Schedule Integrity UI

Source context:

- Production issue: Admin schedule can display a parent profile name as the learner when historical child bookings/sessions have `learner_type=child` but `child_id=null`.
- Confirmed read-only target case:
  - parent profile: `211069ab-7a7d-457d-8b22-f76e8d3ecae3`
  - child row: `65a94ede-296e-4bbe-9bab-2aaf03b99c7e`
  - booking: `080c8a56-9b67-4a83-a44b-5a0394f4b73f`
  - affected booking sessions: 16 rows

Scope:

- Add Admin schedule UI guard so child bookings with missing `child_id` are clearly flagged and do not silently show the parent name as the learner.
- Show coach assignment state clearly: no coach = red, assigned coach = green.
- Run read-only dry-run report for the exact historical rows.

Status:

- UI guard: done.
- Assignment color: done.
- Dry-run report: done.
- DB historical repair write: done after explicit owner confirmation.
- Post-write verification: done.

Production safety:

- Exact-row write already completed for the confirmed target only.
- Do not run broader historical writes without a fresh dry-run and explicit owner confirmation.

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

- Smoke test production after `48e3faa` deployment across Super Admin, Admin, Head Coach, Coach, and User.
- Verify Admin schedule now shows the repaired learner as `น้องอองเดร` for booking `080c8a56-9b67-4a83-a44b-5a0394f4b73f`.
- If another historical child-name issue appears, run a fresh read-only dry-run before any write.

## Known Pre-Existing Dirty Worktree

Observed before this documentation audit:

- Modified: `DEVELOPMENT_TODO.md`
- Modified: `src/app/api/admin/makeup/route.ts`
- Untracked: `SlipOK API Guide.docx`

Do not revert these. Inspect before editing.

## Session Exit Checklist

Before ending any future work session:

- Update `PROJECT_STATE.md` if project facts changed.
- Update `TODO-CODEX.md` if next task, blocker, or verification changed.
- Keep `DEVELOPMENT_TODO.md` updated only when detailed historical tracking changes.
- Report changed files, reason, checks run, and remaining risks.
