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

## Active Next Task

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

- `21.6.19` source fixes need deployment confirmation after owner approves.
- Historical child bookings/sessions with null `child_id` still need a separate owner-approved dry-run/write plan if the owner wants old production rows repaired.
- Re-run role smoke tests after deploy.

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
