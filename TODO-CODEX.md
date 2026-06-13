# TODO-CODEX.md - Active Work Index

Last updated: 2026-06-13

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

- Completed scoped Coach Hours no-teaching label sync:
  - Source/UI fix only; no DB writes, migrations, API write logic, check-in evidence rules, payroll calculation, payment/booking/wallet/coupon/assignment/payroll-close action, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - `src/lib/coach-teaching-hours.ts` now returns attendance status counts (`present_count`, `late_count`, `absent_count`) alongside total `attendance_count`.
  - `src/app/(coach)/coach/hours/page.tsx` now labels all-absent/no-check-in rows as `ไม่มีการสอน - ไม่มีผู้เรียนในรอบนี้` instead of `ยังไม่เช็คอิน`.
  - Those no-teaching rows are excluded from `/coach/hours` missing-evidence warning counts and show `ไม่ถูกนับ`; payroll formula/calculation semantics were not changed.
  - Read-only proof for Angie session `734ce70b-5a6d-4bf0-9544-0deb631aee26` confirmed `attendance_total=1`, `absent_count=1`, `present_count=0`, `late_count=0`, and the new label predicate is true.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check`, `npm.cmd run build`, post-build `.next` cleanup/dev restart, HTTP `/` check, `_next/static` asset check, and `git diff --check`.
  - `attendance:reconcile:dry-run` returned 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `prod:check` still reports the known local warning: `SLIPOK_TEST_MODE=true`.
  - Authenticated browser visual smoke for `/coach/hours` remains `Need verification` with a real coach session that can see the target slot. Passwords were not written to files or scripts.

- Completed scoped Coach UI attendance/check-in state sync:
  - Source fix only; no DB writes, migrations, API write logic, check-in evidence rules, payroll calculation, payment/booking/wallet/coupon/assignment/payroll-close action, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - `src/components/coach/attendance-client.tsx` now separates `no check-in + no attendance yet` from `no check-in + attendance already recorded`.
  - Attendance write buttons in `src/components/coach/attendance-client.tsx` remain disabled when there is no check-in, preserving the coach write guard.
  - `src/app/(coach)/coach/page.tsx` now shows pending check-in CTA/status only for today's slots that still have no check-in and incomplete attendance.
  - `/coach/today` was inspected and already had a complete-attendance display path, so it was not changed.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check`, `npm.cmd run build`, post-build `.next` cleanup/dev restart, HTTP `/` check, `_next/static` asset check, and `git diff --check`.
  - `attendance:reconcile:dry-run` returned 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `prod:check` still reports the known local warning: `SLIPOK_TEST_MODE=true`.
  - Browser smoke with the supplied Coach/Head-Coach account loaded `/coach`, `/coach/today?date=2026-06-07`, and `/coach/attendance?date=2026-06-07&slot=69bb4231-6472-4376-931a-57ac9a4570dc` with no console errors before restart, but that account did not show the target Angie slot. Exact target visual verification remains `Need verification` with the real assigned coach account or a session that can see that slot.

- Completed owner-approved Admin Makeup attendance repair for Angie:
  - Root cause proved read-only before the write: `attendance_gap_closed_no_action` hid the target Admin Makeup review item, but the target `booking_sessions` row stayed `scheduled` and had no exact `attendance` row, so Coach/User surfaces still derived `attendance_gap_review`.
  - Exact target: learner `ชนกนันท์ สุขวงศ์` / `แองจี้`, `booking_sessions.id` `734ce70b-5a6d-4bf0-9544-0deb631aee26`, `child_id` `900ebb5d-2eb1-4143-82a0-86e47757338b`, `schedule_slot_id` `69bb4231-6472-4376-931a-57ac9a4570dc`, `2026-06-07` `13:00:00-15:00:00`.
  - Data repair inserted exact `attendance` row `9582fab4-151c-4a85-a36d-05aab5802ef0` with `status = absent` and synced the target `booking_sessions.status` to `absent`.
  - Added audit log `3cef354c-939d-4937-9c53-705ab8f25ef2` with action `attendance_gap_confirm_absent`, referencing previous close log `3c2ef466-ec6c-49f7-970a-badbd196c951`.
  - Post-write read-only verification confirmed one exact absent attendance row, target session status `absent`, no lesson wallet credit created, no coach check-in created, and no weekly teaching summary created.
  - Source/data projection now derives User/Admin status as `absent`; Coach slot summary can count the row as checked because exact attendance exists.
  - Follow-up found but not changed: Coach attendance cards still use a separate `isLocked = !slot.checkin` warning path in `src/components/coach/attendance-client.tsx`, so an already-resolved absent row may still show check-in evidence messaging. This needs a scoped UI/logic plan before any source change.
  - Verification passed: `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run prod:check`.
  - `prod:check` still reports the known local warning: `SLIPOK_TEST_MODE=true`.
  - No source code, migrations, payment/booking/wallet/coupon/assignment/payroll-close action, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - Follow-up needed: propose a scoped source/UX fix so sudden-leave/absence cases use `confirm_absent` and `close_review` is not mistaken for an absence/makeup path.

- Completed Super Admin authenticated release smoke recheck:
  - Owner logged in locally, and Chrome connector saw the authenticated `http://127.0.0.1:3000/admin` session.
  - Smoke remained read-only: no commit, deploy, DB writes, migrations, payment/booking/wallet/coupon/assignment/payroll-close actions, or Admin makeup write-action clicks.
  - Fresh-tab `/admin/makeup` loaded with heading `วันชดเชย`, did not redirect to login, and had no fresh console errors or React hydration mismatch.
  - Fresh-tab `/admin` loaded with heading `ภาพรวมระบบ`, did not redirect to login, and had no fresh console errors or hydration mismatch.
  - Fresh-tab `/admin/schedules` loaded with heading `ตารางเรียน`, did not redirect to login, and had no fresh console errors or hydration mismatch.
  - Fresh-tab `/admin/payments` loaded with heading `ตรวจสอบการชำระเงิน`, did not redirect to login, and had no fresh console errors or hydration mismatch.
  - Real Admin makeup write-action buttons were visible but not clicked.
  - Release gate after this recheck: `PASS` for scoped diff review, command verification, and Super Admin authenticated smoke on `/admin/makeup`, `/admin`, `/admin/schedules`, `/admin/payments`; `NEED VERIFICATION` for role-pure Standard Coach and any Coach/Head-Coach release-gate route not covered by this admin-route recheck; `RISK / OWNER APPROVAL REQUIRED` for commit/deploy/production writes/Admin makeup write-action UAT/live SlipOK; no checked-route `BLOCKER`.

- Completed Phase 3 local release readiness verification pass:
  - Scope was verification-only: no feature work, no commit, no deploy, no DB writes, no migrations, no write-action clicks, and no `SlipOK API Guide.docx` action.
  - Detailed diff review covered `src/components/admin/makeup-client.tsx`, `PROJECT_STATE.md`, and `TODO-CODEX.md`.
  - Diff review result: the only source change is deterministic Thai-locale learner-name sorting and stable tie-breakers inside `MakeupClient`; it is render-order only and does not touch Admin makeup write actions, APIs, attendance/payment/booking/wallet/coupon/assignment/payroll-close logic, DB data, or migrations.
  - Credential scan across the three scoped files found no supplied email/password strings.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check`, and `git diff --check`.
  - `attendance:reconcile:dry-run` remained report-only and returned 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `prod:check` returned `READY WITH WARNINGS/PASSES` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `git diff --check` reported only Windows LF/CRLF working-copy warnings, not whitespace errors.
  - Browser smoke attempt started the local dev server at `http://127.0.0.1:3000` and stopped it afterward.
  - In-app browser loaded `/auth/login`, but the Super Admin login attempt did not establish an authenticated session in this smoke attempt; direct admin-route attempts redirected to `/auth/login?redirect=...`.
  - Browser console showed only the known Next.js LCP image warning for `/logo new-athlete-school.jpg`; no fresh hydration mismatch was captured in the attempted admin-route tabs.
  - Release gate for this pass: `PASS` for scoped diff review and command verification; `NEED VERIFICATION` for fresh authenticated browser smoke on `/admin/makeup`, `/admin`, `/admin/schedules`, `/admin/payments`, `/coach`, and role-pure Standard Coach; `RISK / OWNER APPROVAL REQUIRED` for deploy/commit/production writes/Admin makeup write-action UAT/live SlipOK; no source-check `BLOCKER`.

- Completed Standard Admin authenticated read-only smoke:
  - Used the provided Standard Admin account only through the browser UI; password was not written to files or docs.
  - Login redirected to `/admin`.
  - Standard Admin menu was permission-scoped for this account and showed `/admin`, `/admin/schedules`, `/admin/users`, `/admin/ranking`, `/admin/payments`, `/admin/coupons`, `/admin/complaints`, and `/admin/notifications`.
  - Allowed routes loaded with no fresh browser console error/warn: `/admin`, `/admin/schedules`, `/admin/users`, `/admin/ranking`, `/admin/payments`, `/admin/coupons`, `/admin/complaints`, `/admin/notifications`.
  - Direct guard checks redirected back to `/admin` with no fresh browser console error/warn: `/admin/makeup`, `/admin/payroll`, `/admin/settings`, `/admin/logs`, `/admin/branches`, `/admin/coaches`, `/admin/coach-checkins`, `/admin/finance`, `/admin/teaching-programs`, `/admin/schedule-templates`, and `/admin/booking`.
  - Cross-portal routes matched current `ROLE_ROUTES`: `/coach`, `/dashboard`, and `/profile` loaded for Standard Admin; `/coach` did not show assignment/round-group menu text.
  - Logged out after smoke and returned to `/`.
  - No write buttons were clicked. No source code, DB writes, migrations, payment/booking/lesson wallet/coupon/assignment/payroll-close actions, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - Owner clarified Standard Coach UI expectation: same as Head Coach except without assignment/round-group menu. Browser verification still needs a role-pure Standard Coach account if required.

- Completed scoped `/admin/makeup` hydration debug and fix:
  - Re-read `AGENTS.md`, `PROJECT_STATE.md`, `TODO-CODEX.md`, and the relevant `DEVELOPMENT_TODO.md` Phase 3 section before working.
  - Reproduced `/admin/makeup` in a fresh authenticated Super Admin tab and captured the React hydration mismatch.
  - Root cause proved source-only: `MakeupClient` used default `localeCompare` for learner-name ordering, and Node SSR sorted `ZEN`/`โซเลน` differently from the browser during hydration.
  - Source fix was limited to `src/components/admin/makeup-client.tsx`: use explicit Thai-locale comparison plus deterministic code-point/id tie-breakers for MakeupClient learner-name sort paths.
  - No Admin makeup write buttons were clicked. No API route, DB data, migration, payment, booking, lesson wallet, coupon, assignment, or payroll-close logic was changed.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build`.
  - Post-build cleanup was completed per AGENTS: stopped dev server, removed generated `.next`, restarted dev server.
  - Fresh browser smoke for `/admin/makeup?smoke=after-fix` passed with heading `วันชดเชย`, no fresh console error/warn, and no hydration mismatch.

- Completed Super Admin clean-tab recheck after the hydration fix:
  - `/admin/payroll` loaded with heading `คำนวณชั่วโมงสอน` and no fresh console error/warn.
  - `/admin/settings` loaded with heading `ตั้งค่าระบบ` and no fresh console error/warn.
  - `/admin/users` loaded with heading `จัดการนักเรียน / ผู้ปกครอง` and no fresh console error/warn.
  - `/admin/branches` loaded with heading `จัดการสาขา` and no fresh console error/warn.
  - `/admin/coaches` loaded with heading `จัดการโค้ช` and no fresh console error/warn.
  - Smoke was page-load/read-only only; no write actions were clicked.

- Completed partial authenticated role smoke readiness:
  - Used the provided test accounts only through the browser UI; passwords were not written to files or docs.
  - Owner approved opening Coach/Head Coach pages despite possible notification creation on page load.
  - User login redirected to `/dashboard`.
  - User pages loaded: `/dashboard`, `/dashboard/schedule`, `/dashboard/lesson-wallet`.
  - User guard passed: `/coach` and `/admin` redirected back to `/dashboard`.
  - Supplied Coach account displayed as `Super Head Coach (หัวหน้า)`, so it covered Head Coach behavior rather than standard Coach behavior.
  - Coach/Head Coach pages loaded: `/coach`, `/coach/today`, `/coach/checkin`, `/coach/attendance`, `/coach/assign-groups`.
  - Coach/Head Coach guard passed: `/admin` redirected back to `/coach`.
  - Super Admin login redirected to `/admin`.
  - Super Admin pages observed loaded: `/admin`, `/admin/schedules`, `/admin/makeup`, `/dashboard`, `/coach`.
  - Super Admin menu showed Super Admin-only entries including `Activity Log` and `ตั้งค่าระบบ`.
  - Risky action buttons were visible on lesson wallet, coach check-in, assignment groups, and Admin makeup; none were clicked.
  - No source code, migrations, payment/booking/wallet/coupon/payroll-close actions, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - Dev server was stopped and temporary smoke logs were removed.

- Found authenticated smoke blocker:
  - `/admin/makeup` emitted a React hydration mismatch console error during Super Admin smoke.
  - The mismatch sample showed a server/client learner display difference inside `MakeupClient` (`ZEN` vs a Thai learner name).
  - The same tab kept reporting the hydration error on later navigations, so a clean per-route recheck was attempted; browser navigation timed out before completing the confirmation pass.
  - Do not patch immediately. First reproduce in a fresh session, inspect `src/app/(admin)/admin/makeup/page.tsx` and `MakeupClient`, and prove whether the cause is nondeterministic ordering, locale/date formatting, or inconsistent learner-name fallback.

- Completed Phase 3 read-only role smoke readiness pass:
  - Read `PRODUCTION_READINESS.md`.
  - Read `DEVELOPMENT_TODO.md` section `21. Phase 3 Deploy Readiness`.
  - Started local dev server only for smoke testing at `http://127.0.0.1:3000`, then stopped it after the pass.
  - Public pages passed: `/`, `/ranking`, `/auth/login`, `/auth/register`.
  - Unauthenticated route/auth guard passed for User, Coach/Head Coach, and Admin/Super Admin protected routes: all redirected to `/auth/login?redirect=...`.
  - No payment, booking, lesson wallet, coupon, assignment, payroll-close, migration, DB write, source code edit, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - Authenticated role page-load/empty-state smoke remains pending because no authenticated browser session or role-specific test credentials were available in this read-only round.
  - Verification passed: `npm.cmd run prod:check`, `npm.cmd run attendance:reconcile:dry-run`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run check:mojibake`.
  - `npm.cmd run prod:check` still has the expected local warning: `SLIPOK_TEST_MODE=true`.
  - `npm.cmd run attendance:reconcile:dry-run` reported 0 student-scope attendance mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.

- Completed new-machine handoff/readiness audit:
  - Read `AGENTS.md`, `PROJECT_STATE.md`, and `TODO-CODEX.md` before working.
  - Confirmed current branch `spike/next-major-security-upgrade` and HEAD `cec49fd fix(user): align dashboard learner colors`.
  - Confirmed `node v24.16.0`, `npm.cmd 11.13.0`, `node_modules`, `package-lock.json`, `.env.local`, and `.next` are present.
  - Confirmed PowerShell blocks direct `npm` through `npm.ps1`; use `npm.cmd` and `npx.cmd` in this shell unless the owner changes Execution Policy.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run prod:check`.
  - `npm.cmd run prod:check` warning remains expected locally: `SLIPOK_TEST_MODE=true`; production must use real SlipOK credentials/live mode.
  - No source code, DB data, migrations, cleanup, commit, push, or deploy were performed.
  - `npm.cmd run build` was not run because this was documentation/readiness scope only and build work requires the dev-server/static-chunk cleanup cycle.

- Completed scoped User dashboard/schedule learner color parity:
  - Root cause proved read-only: `/dashboard` and `/dashboard/schedule` used separate learner color maps, so the same learner could render with different calendar-dot colors.
  - Root cause proved read-only: `/dashboard/schedule` wallet/status rendering could replace the learner identity color, making walleted or derived-status sessions look gray instead of showing the learner color clearly.
  - Fix adds shared `src/components/dashboard/learner-colors.ts` and updates both dashboard calendars to use the same learner color mapping.
  - Wallet/status meaning is now represented as a separate marker ring on the dot, while the dot fill remains the learner identity color.
  - Business behavior was not changed: bookings, wallet redemption, schedule status text, attendance status, and reschedule rules remain intact.
  - Verification passed: `git diff --check`, `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
  - No DB writes, migrations, cleanup, commit, push, or deploy were performed.

- Completed scoped lesson wallet success feedback and user schedule learner-dot color fix:
  - Root cause proved read-only: wallet redemption success closed the modal and refreshed without any success alert/toast.
  - Root cause proved read-only: `/dashboard/schedule` already had `child_id`, `children`, and learner color maps, but calendar dots rendered status color before learner color.
  - Fix keeps business behavior unchanged and only changes UI feedback/dot rendering.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
  - No DB writes, migrations, cleanup, commit, push, or deploy were performed.

- Completed scoped lesson wallet cross-branch course-type validation alignment:
  - Root cause proved read-only: wallet redemption API validates the real `credit.course_type_id`, while the wallet UI/server mapper could fall back missing/invalid course type names to `kids_group`.
  - Cross-branch use remains allowed when the chosen branch, course, day, and time exist in active `schedule_templates`.
  - Invalid wallet credits now stay blocked with an explicit UI warning instead of sending a mismatched API request.
  - Business behavior was not changed: same-month rule, duplicate learner guard, capacity guard, no-payment redemption, and wallet transitions remain intact.
  - Verification passed: `npx tsc --noEmit`, `npm run check:mojibake`, `npm run lint`, and `npm run build`.
  - No DB writes, migrations, cleanup, commit, push, or deploy were performed.

- Completed scoped lesson wallet redemption template fallback fix:
  - Root cause proved read-only: `/api/lesson-wallet` hard-filtered by client `scheduleTemplateId`, so a stale/mismatched id could reject a valid branch/course/day/time slot.
  - Fix keeps `scheduleTemplateId` as a fast-path hint only. If it does not match, the API falls back to active `schedule_templates` by branch, course, day, and selected start/end time.
  - Business behavior was not changed: same-month rule, duplicate learner guard, capacity guard, no-payment redemption, and wallet transitions remain intact.
  - Verification for this item must include a stale-id fallback check plus normal project checks.
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

### 0. Phase 3 / Role Smoke Readiness

Scope:

- Continue with read-only or owner-approved smoke only.
- Do not run production write actions unless the owner confirms the exact test case and target records.
- Do not run DB writes, migrations, cleanup, commit, push, or deploy without explicit owner instruction.
- Use `npm.cmd` / `npx.cmd` on this Windows PowerShell machine.

Status:

- New-machine readiness checks passed on 2026-06-12.
- `npm.cmd run prod:check` passed with local `SLIPOK_TEST_MODE=true` warning.
- Public and unauthenticated guard smoke passed locally on 2026-06-12.
- Authenticated local role smoke is partially complete:
  - User passed for requested pages and basic guards.
  - Supplied Coach account behaved as Head Coach and passed requested Coach/Head Coach pages plus `/coach/assign-groups`.
  - Standard Admin passed for the permission-scoped menu/routes on the provided account; restricted Admin and Super Admin-only routes redirected back to `/admin`.
  - Super Admin requested local surfaces passed after the `/admin/makeup` hydration fix, including clean-tab recheck for `/admin/payroll`, `/admin/settings`, `/admin/users`, `/admin/branches`, and `/admin/coaches`.
  - Latest authenticated Chrome release smoke passed for Super Admin `/admin/makeup`, `/admin`, `/admin/schedules`, and `/admin/payments` with no fresh console errors or hydration mismatch.
  - Standard Coach expected UI has been owner-confirmed as Head Coach without the assignment/round-group menu; browser verification still needs a role-pure Standard Coach account if required.
- Admin makeup round-level UAT remains pending and must be owner-driven because key flows write data.

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
