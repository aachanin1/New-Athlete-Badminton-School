# TODO-CODEX.md - Active Work Index

Last updated: 2026-06-16

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

- Completed scoped app-shell font preload warning fix:
  - Source fix only; no DB writes, migrations, business logic changes, Admin makeup action changes, commit, push, or deploy action was performed.
  - Production screenshot showed many Chrome DevTools warnings for Prompt `.woff2` font preloads. Read-only HTML inspection confirmed `as="font"` was correct, but `next/font` was preloading 10 Prompt files from 5 weights across Thai/Latin subsets.
  - `src/app/layout.tsx` keeps Prompt as the app font, removes unused weight `300`, sets `display: "swap"`, and disables automatic font preload with `preload: false`.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed; local `/` and `_next/static/chunks/webpack.js` returned HTTP 200. Local `/auth/login` HTML emitted 0 `.woff2` preload links.
  - Production still needs commit/push/deploy for this warning fix to take effect.

- Completed scoped Admin Makeup targeted same-slot learner move source/UI fix:
  - Source/UI fix only for `/admin/makeup`; no DB data edits, migrations, attendance writes, `booking_sessions.status` changes, check-in/evidence deletion, booking/reschedule/payment/wallet/payroll logic changes, commit, push, or deploy action was performed.
  - Added API action `move_learner_to_existing_coach_group` in `src/app/api/admin/makeup/route.ts`.
  - The action validates `session_ids`, `target_group_id`, `coach_id`, `reason`, target group existence, same `schedule_slot_id`, target group coach match, same date/start/end/branch/course, non-makeup active lifecycle statuses only, and blocks if exact learner attendance exists by `booking_session_id + expected student_id`.
  - The action writes only targeted `coach_assignment_group_students` updates/inserts, compatibility `coach_assignments` when missing, `activity_logs`, and target-coach notification. It does not write `attendance`, does not change `booking_sessions.status`, does not delete coach check-ins/evidence, and does not delete the old group.
  - `src/app/(admin)/admin/makeup/page.tsx` now passes exact `group_id`, `coach_id`, and server-preloaded same-slot target group options into the client so target groups still appear when the review list is narrowed by search/filter.
  - `src/components/admin/makeup-client.tsx` now exposes the "ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน" button and dialog near "เปลี่ยนโค้ชย้อนหลัง"; the dialog shows learner, old group/coach, same-slot target groups only, target coach, required reason, and safety copy.
  - Read-only proof for Kheen session `c4a375b6-4bf1-4305-8932-c47e5f53270d`: current group Link `c500256e-bd39-44e9-96e4-a26e725c5b9e`, target group Nice `1120daab-2a90-4205-979d-d2803ebb5fbc`, same schedule slot `0a346a9a-e603-4da6-9d49-6c417774ea01`, target group round matches, exact attendance count 0.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local browser read-only smoke for `/admin/makeup` redirected unauthenticated access to login with 0 console errors. Authenticated dialog smoke and owner-approved write UAT remain pending.

- Completed scoped Admin Makeup branch display source fix:
  - Source/display query fix only for `/admin/makeup`; no DB writes, migrations, assignment logic, `replace_coach_for_past_round`, `assign_coach_to_round`, attendance write logic, booking/reschedule/payment/wallet/payroll, commit, push, or deploy action was performed.
  - Root cause confirmed read-only: `/admin/makeup` displayed `branch_name` from `bookings.branch_id`, while filtering and the real round branch use `booking_sessions.branch_id`; `/admin/schedules` already displayed from `booking_sessions.branch_id`.
  - `src/app/(admin)/admin/makeup/page.tsx` now selects root `branches(name)` from `booking_sessions` and sends `branch_name` from `session.branches?.name`.
  - Read-only verification using the updated select contract confirmed Trin sessions `f5c8bfbd-28c2-48db-9e35-819634d2981f` (2026-06-16 17:00-19:00) and `3f205c55-10b2-49cd-b988-7be9f44e4036` (2026-06-13 17:00-19:00) send `branch_name = Ramintra` while their booking package branch remains Chaengwattana.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only the known Windows LF/CRLF warning for `src/app/(admin)/admin/makeup/page.tsx`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local Chrome read-only smoke for `/admin/makeup` redirected unauthenticated access to `/auth/login?redirect=%2Fadmin%2Fmakeup` and captured no console errors; authenticated UI smoke still needs an admin session.

- Completed scoped Dashboard History walleted count clarity fix:
  - Source/display fix only for `/dashboard/history`; no DB writes, migrations, lesson wallet write logic, booking/reschedule/payment/attendance write logic, Admin makeup, payroll, or `SlipOK API Guide.docx` action was performed.
  - Read-only proof for booking `080c8a56-9b67-4a83-a44b-5a0394f4b73f` showed `total_sessions = 16`, active course rows = 13, and 3 `walleted` rows backed by active `lesson_wallet_credits`.
  - `src/app/(dashboard)/dashboard/history/page.tsx` now fetches wallet credits read-only for loaded booking session ids, matches by `lesson_wallet_credits.original_session_id`, and passes minimal wallet credit metadata into the client.
  - `src/components/dashboard/history-client.tsx` keeps active count semantics unchanged, shows `รอบเรียนที่มีวันเรียนแล้ว: 13/16 ครั้ง`, adds `อยู่ในกระเป๋า รอเลือกวันใหม่: 3 ครั้ง`, and renders a separate walleted section for the 3 stored sessions.
  - Authenticated local Chrome smoke on `http://localhost:3000/dashboard/history` passed read-only for the reported Rama 2 16-session booking: wallet section showed 15 มิ.ย. 17:00-19:00, 21 มิ.ย. 09:00-11:00, and 25 มิ.ย. 17:00-19:00; completed/absent/attendance-gap labels remained visible; no console errors were captured; and no write action was clicked.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Commit `4c5e2c2` was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-16. Deployment id `dpl_FXxNEtqBL6kEJAKHGX8oy2nzYHd4`; production alias `https://www.newathleteschool.com`; status Ready.
  - Authenticated production Chrome smoke on `https://www.newathleteschool.com/dashboard/history` passed read-only for the reported parent booking: card still showed 16 sessions and learner count 13; detail showed 13/16 plus `อยู่ในกระเป๋า รอเลือกวันใหม่: 3 ครั้ง`; wallet section showed 15 มิ.ย. 17:00-19:00, 21 มิ.ย. 09:00-11:00, and 25 มิ.ย. 17:00-19:00; completed/absent/attendance-gap labels remained visible; browser console errors were 0; and no write action was clicked.

- Completed scoped Dashboard History status display consistency fix:
  - Source/display fix only for `/dashboard/history`; no DB writes, migrations, booking write logic, reschedule API, payment logic, attendance write logic, Admin makeup, payroll, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - `src/app/(dashboard)/dashboard/history/page.tsx` now fetches attendance rows read-only for loaded booking session ids in chunks, matches exact `booking_session_id + expected student_id`, derives server-side `display_status` through the shared attendance display helper, and keeps raw `status` unchanged.
  - `src/components/dashboard/history-client.tsx` now uses `display_status` for detail/list badges while raw `status` still drives active count and rescheduled history separation.
  - Count semantics did not change: active paid-course rows still count raw `scheduled`, `completed`, and `absent`; rescheduled rows are still shown separately and not counted.
  - Authenticated local Chrome smoke on `http://localhost:3000/dashboard/history` passed read-only for the reported Rama 2 16-session booking: detail still showed `13/16`, past raw `scheduled` rows without attendance displayed `รอตรวจสอบการเช็คชื่อ`, completed displayed `เรียนแล้ว`, absent displayed `ขาดเรียน`, no console errors were captured, and no write action was clicked.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.

- Completed scoped Admin Schedules month pagination fix:
  - Source fix only for `/admin/schedules`; no DB writes, migrations, booking/reschedule/payment/attendance logic changes, assignment semantics changes, Admin makeup changes, payroll changes, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - `src/app/(admin)/admin/schedules/page.tsx` now parses `year`/`month` query params, defaults invalid/missing params to the current month, filters `booking_sessions` server-side to the selected month, and fetches monthly sessions with paginated `.range()` batches in stable `date/start_time/id` order.
  - Related month-scoped reads for wallet credits, assignment groups, slot session attendance scope, and attendance are chunked/constrained to the fetched month session/slot ids, with clear Supabase errors instead of silent empty data.
  - `src/components/admin/schedules-client.tsx` now receives the selected month from the server and updates the URL when navigating months or today; existing search/branch/course filters continue to run client-side over that loaded month.
  - Read-only verification confirmed `/admin/schedules?year=2026&month=6` loaded 1,136 rows in batches of 1,000 and 136. Booking `925362e8-fc3d-4f46-a41d-a49758212450` had active rows complete: `ต้นข้าว` 10 and `ต้นบุญ` 10, with 6 `rescheduled` rows excluded.
  - Authenticated local Chrome smoke on `http://localhost:3000/admin/schedules?year=2026&month=6` passed with no console errors. Searching `วรวรรณ จินตานนท์` showed 20 rows and two 2026-06-28 cards for `ต้นข้าว` and `ต้นบุญ`, both 16:00-18:00 at `รัชดา`.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Unauthenticated local `/admin/schedules?year=2026&month=6` returned HTTP 307 to `/auth/login?redirect=%2Fadmin%2Fschedules`.

- Completed scoped User Booking History reschedule clarity fix:
  - Source/display fix only; no DB writes, migrations, booking creation/reschedule semantics, payment logic, attendance logic, payroll logic, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - Implemented the read-only case plan for parent `pick2523@hotmail.com`: active sessions are not missing; rescheduled rows are now presented as history instead of being mixed into active paid rounds.
  - `src/app/(dashboard)/dashboard/history/page.tsx` now fetches `booking_sessions.rescheduled_from_id` and builds `sessionCountMap` from active statuses only (`scheduled`, `completed`, `absent`).
  - `src/components/dashboard/history-client.tsx` now counts per-learner sessions from active rows only, shows "รอบที่นับในคอร์ส" separately from "ประวัติการเลื่อนรอบ", and displays the replacement session when `rescheduled_from_id` links the rows.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build`.
  - Post-build cleanup/restart completed: no existing port 3000 listener, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - In-app browser read-only smoke for `/dashboard/history` redirected unauthenticated access to `/auth/login?redirect=%2Fdashboard%2Fhistory` with no console errors.

- Completed read-only production post-write verification for owner-run Admin Makeup write UAT:
  - No source code, DB data, migrations, rollback, deploy, or `SlipOK API Guide.docx` action was performed by Codex.
  - `assign_coach_to_round` PASS for 2026-06-14 16:00-18:00 at Ratchada. Exact target booking session `c4a375b6-4bf1-4305-8932-c47e5f53270d` (`คีน`) has new group `c500256e-bd39-44e9-96e4-a26e725c5b9e` assigned to Coach Link (`412a8f42-d069-4b1d-9b2c-abce93f0dc82`), one matching `coach_assignment_group_students` row, legacy `coach_assignments` row `f7c21caf-27fc-4db7-9ff6-6fde38e405cc`, activity log `attendance_gap_assign_coach_round`, and notification `a7e6c328-0a8e-48b2-bbce-9df504201f8f`.
  - `replace_coach_for_past_round` PASS for 2026-06-14 15:00-17:00 at Rama 2. Exact target sessions `1cb6f5bf-9df4-4051-9e8d-d4e305b91af0`, `6b822eb9-87b8-4271-922b-283d9c367f92`, `5c560343-79d5-42ea-be0d-ccf567d67d05`, `1ce69fb4-6641-4ebb-a480-9011892573a5`, and `fe1e3ebe-9976-4e83-be29-051f918ed3c3` remain in group `cf18d7df-f42e-4852-8255-a96b25c10c7e`, now assigned to Coach Jom (`b852eb8f-7989-4fba-958d-b7a28bcfea4d`), with legacy `coach_assignments` row `d1a752c4-ebf7-470c-bd7f-ac1f7808f428`, five `attendance_gap_replace_coach_round` logs, and notification `c7a24182-0d9d-492b-bc11-34f395ca7335`.
  - Confirmed no `attendance` rows for the target sessions and no `booking_sessions.status` changes from either action; the target sessions remain `scheduled` and their `updated_at` values predate the UAT writes.
  - Existing slot check-in evidence rows for the Rama 2 slot remain present. There is no current Coach Tony check-in row for that slot to prove Tony-specific preservation from a post-only snapshot; source inspection confirms the replacement action has no evidence delete path.
  - Rollback assessment: no rollback recommended; no blocker found.

- Completed scoped Admin Makeup round-level request counter display fix:
  - Source/client display fix only; no API semantics, write behavior, `activity_logs`, `notifications`, DB data, migrations, payroll/booking/wallet/payment/coupon/assignment, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - Root cause: `/admin/makeup` grouped learner sessions into round cards and summed per-session `coach_review_requested_count` / `coach_evidence_requested_count`, so one round-level send across 5 learners displayed as 5 requests.
  - Fix: `src/components/admin/makeup-client.tsx` now uses the maximum per-session count for both coach review and coach evidence display counters, preserving per-session internal logs/notifications while showing a round-level badge count.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only the known Windows LF/CRLF warning for `src/components/admin/makeup-client.tsx`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Authenticated local Chrome read-only `/admin/makeup` smoke passed: the reported 2026-06-14 15:00-17:00 Rama 2 round with 5 learners showed `ส่งให้โค้ชแล้ว 1 ครั้ง` and button suffix `(1)`, no-coach and assigned-coach controls remained visible, no console errors were captured, and no write action was clicked.
  - No current visible coach-evidence request-count case was present in the smoke data, but the same display aggregation path was fixed for evidence counters.
  - Commit `c4a75c1` was pushed and deployed to Vercel production on 2026-06-15. Deployment id `dpl_qMctHJktpKKHDMZPVtwHwe5r3p2G`, production alias `https://www.newathleteschool.com`, status Ready.
  - Owner-confirmed production smoke after deploy: the round that previously showed `ส่งให้โค้ชแล้ว 5 ครั้ง` now shows `ส่งให้โค้ชแล้ว 1 ครั้ง`. No production write action was clicked. Counter aggregation bug is resolved in production.

- Completed scoped Admin Makeup React #418 timezone display fix:
  - Source/display-only fix only; no DB writes, migrations, API semantics changes, business behavior changes, payroll/payment/booking/wallet/coupon/assignment changes, `assign_coach_to_round`, `replace_coach_for_past_round`, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
  - Production authenticated `/admin/makeup` React #418 had been confirmed on page-load hydration. Read-only debug narrowed the likely root cause to `formatDateTime()` rendering check-in timestamps without an explicit timezone.
  - Fix: `src/components/admin/makeup-client.tsx` now adds `timeZone: 'Asia/Bangkok'` inside `formatDateTime()` only.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only the known Windows LF/CRLF warning.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Authenticated local Chrome `/admin/makeup` smoke passed read-only with no console errors and no React #418. No write action was clicked.
  - Commit `d59af8c` (`fix(makeup): stabilize checkin time hydration`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production.
  - Deployment id: `dpl_A2RWoVHBxgKev3CN7J7zco2NPDvA`; production alias: `https://www.newathleteschool.com`; deployment status: Ready.
  - Authenticated production Chrome `/admin/makeup` smoke passed read-only: page loaded without login redirect, console showed no errors/warnings, no React #418 was captured, and no write action was clicked.
  - Production clean-console gate for this React #418 timezone display fix: PASS.

- Completed urgent Admin Payroll evidence-list visibility fix:
  - Source/UI fix only; no DB writes, migrations, payroll calculation semantics, attendance write behavior, payment, booking, commit, push, or deploy were performed.
  - Read-only DB proof confirmed Coach Link NA Ratchada (`412a8f42-d069-4b1d-9b2c-abce93f0dc82`) had two verified payroll source rounds on 2026-06-11:
    - 13:00-15:00 Ramintra kids_group: 1 payable session, 1 present attendance row, exact coach check-in with photo/GPS.
    - 17:00-19:00 Ratchada kids_group: 3 payable sessions, 3 present attendance rows, exact coach check-in with photo/GPS.
  - Root cause: `src/components/admin/payroll-client.tsx` used `slice(0, 8)` for both verified evidence rows and issue rows. Coach Link had 10 verified rows in June 2026, so 2026-06-11 was hidden as rows 9-10 while totals still had the data.
  - Fix: Admin Payroll now renders every verified evidence row and every issue row for the selected coach/month instead of silently truncating the list.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local browser smoke for `/admin/payroll` redirected unauthenticated access to `/auth/login?redirect=%2Fadmin%2Fpayroll` as expected and showed no console errors on recheck.
  - Commit `40f86cf` (`fix(payroll): show all evidence rows`) was pushed to `spike/next-major-security-upgrade`; follow-up doc commit `7e85504` (`docs: record payroll deploy`) was also pushed.
  - Final production deployment id: `dpl_21B3aVVFBiV8rmAUTKWsgPf2rxhk`; production alias: `https://www.newathleteschool.com`; deployment status: Ready.
  - Production read-only smoke after deploy: `/` HTTP 200, `_next/static/chunks/webpack-6fbcecb408fbe888.js` HTTP 200, and `/admin/payroll` HTTP 307 to `/auth/login?redirect=%2Fadmin%2Fpayroll`.
  - Vercel CLI logs during final smoke returned no runtime logs; no error/fatal runtime logs were returned by the CLI query.
  - Authenticated production Chrome smoke for `/admin/payroll` passed read-only with the existing Super Admin session: page loaded without login redirect, browser console showed no errors/warnings, and the Coach Link NA Ratchada detail dialog included both 2026-06-11 verified evidence rows. The enabled `ปิดสัปดาห์` write action was visible but was not clicked.

- Completed Phase B.2-New.3 past-round coach replacement:
  - Source/API/UI/helper fix only; no DB data repair, migrations, payroll calculation changes, attendance write behavior changes, payment, booking, coupon, deploy, commit, or `SlipOK API Guide.docx` action was performed.
  - Added `replace_coach_for_past_round` to `PATCH /api/admin/makeup`.
  - New action validates required `session_ids`, `coach_id`, and `reason`; validates a selected `coach/head_coach`; validates one same past normal `schedule_slot_id`; rejects makeup/walleted/cancelled/non-past rounds; and rejects a selected coach already assigned to another learner group in the same slot.
  - New action updates exact learner-group `coach_assignment_groups.coach_id`, creates a retrospective group only for selected sessions with no exact group, ensures legacy `coach_assignments` compatibility, logs `attendance_gap_replace_coach_round`, and notifies the new coach to check in retrospectively with selfie/GPS.
  - Confirmed by source inspection and checks: the replacement action does not write `attendance`, does not call `syncBookingSessionStatusFromAttendance`, and does not update `booking_sessions.status`.
  - Updated `src/lib/coach-attendance-review.ts` so `attendance_gap_replace_coach_round` grants the new/notified coach the same Admin-returned retrospective check-in exception for that slot.
  - Updated `src/components/admin/makeup-client.tsx` so assigned-coach review cards show `เปลี่ยนโค้ชย้อนหลัง`; the dialog requires a replacement coach and audit reason, lists learners read-only, and states that attendance is not written and old evidence is not deleted.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, and `npm.cmd run build`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local Chrome read-only `/admin/makeup` smoke redirected to `/auth/login?redirect=%2Fadmin%2Fmakeup` with no console errors. Known local LCP image warning for `/logo new-athlete-school.jpg` remained.
  - Owner-run production write UAT for `replace_coach_for_past_round` was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 15:00-17:00 Rama 2 target group changed to Coach Jom.
  - Commit `6606f41` (`fix(makeup): support past round coach replacement`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-15.
  - Deployment id: `dpl_5BN7cSZH8ecQhbkFScpjxZZjJZWq`; production alias: `https://www.newathleteschool.com`; deployment status: Ready.
  - Production read-only smoke after deploy: `/` HTTP 200, `_next/static/chunks/webpack-6fbcecb408fbe888.js` HTTP 200, and `/admin/makeup` HTTP 307 to `/auth/login?redirect=%2Fadmin%2Fmakeup`.
  - Vercel CLI logs during smoke showed info-level requests only. Vercel MCP error/fatal query returned no logs but included a 403 paging warning.

- Completed Phase B.2-New.2 no-coach assign-only flow:
  - Source/API/UI fix only; no direct DB data repair, migrations, payroll calculation, wallet/return-entitlement logic, payment, coupon, booking/create-makeup POST, deploy, or `SlipOK API Guide.docx` action was performed.
  - Commit `ebee5f7` (`fix(makeup): assign no-coach rounds without attendance`) was pushed to `spike/next-major-security-upgrade`. It has not been deployed.
  - Added `assign_coach_to_round` to `PATCH /api/admin/makeup`.
  - New action validates required `session_ids`, `coach_id`, and `reason`; validates coach/head-coach role; validates one same past normal scheduled round; rejects if any target session already has a strict learner group coach assignment.
  - New action writes only assignment/review side effects: `coach_assignment_groups`, `coach_assignment_group_students`, legacy-compatible `coach_assignments` when needed, `activity_logs` with `attendance_gap_assign_coach_round`, and one coach notification.
  - Confirmed by source inspection: the new action does not write `attendance`, does not call `upsertRetrospectiveAttendance`, does not call `syncBookingSessionStatusFromAttendance`, and does not update `booking_sessions.status`.
  - Updated `src/components/admin/makeup-client.tsx` so no-coach dialog mode `สอนจริง แต่ลืมมอบหมาย/เช็คชื่อ` selects only coach + reason, shows learners as read-only labels, and removes per-learner status selects.
  - No-coach cards still show only `จัดการเคสทั้งรอบ`; assigned-coach cards still show the Phase B.2-New.1 round-level action set.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, and `npm.cmd run build`.
  - Post-build cleanup/restart completed: removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local HTTP 200.
  - Authenticated local `/admin/makeup` smoke passed read-only: no-coach dialog had no status select and assign button stayed disabled while incomplete; assigned-coach modal still opened and save stayed disabled while incomplete. No write-action save was clicked.
  - Release gate: Source checks PASS, Build PASS, read-only browser smoke PASS, and owner-run production `assign_coach_to_round` write UAT read-only verified on 2026-06-16.
  - Owner-run production write UAT for `assign_coach_to_round` PASS for the exact 2026-06-14 16:00-18:00 Ratchada target session assigned to Coach Link.
  - Commit `6ab8e37` was deployed to Vercel production on 2026-06-14.
  - Production read-only `/admin/makeup` smoke after deploy loaded with an authenticated Chrome Super Admin session and confirmed the no-coach/assigned-coach UI controls matched the Phase B.2-New.2 scope.
  - No production write action was submitted during smoke.
  - Production clean-console gate did not pass: Chrome captured `Error: Minified React error #418` from `/_next/static/chunks/4bd1b696-e356ca5ba0218e27.js` during `/admin/makeup` hydration.

- Completed Phase B.2-New.1 Admin Makeup round-level UX:
  - Source/UI fix only; no DB data, migrations, payroll calculation, wallet/return-entitlement logic, create-makeup POST, payment, booking, coupon, assignment semantics, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - Updated `src/components/admin/makeup-client.tsx`.
  - Assigned-coach review rounds now show round-level actions for coach review/evidence, retroactive attendance for the whole round, and close whole round.
  - No-coach review rounds preserve the previous regression guard: only `จัดการเคสทั้งรอบ` is shown, the learner-row warning remains, and per-person buttons plus the assigned-coach three-button set are not shown.
  - Added an assigned-coach `บันทึกย้อนหลังทั้งรอบ` modal that lists every learner in the round, requires every learner status plus an audit reason before save is enabled, and uses the existing per-session `mark_attendance` PATCH path.
  - Added copy clarifying that complete attendance does not mean coach selfie/GPS/check-in evidence is complete.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, and `npm.cmd run build`.
  - Post-build cleanup/restart completed: removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local HTTP 200.
  - Authenticated local `/admin/makeup` smoke passed read-only for both assigned-coach and no-coach cards. The assigned-coach modal opened and save stayed disabled while incomplete; the no-coach dialog opened with only the existing `จัดการเคสทั้งรอบ` entry point. No real write-action button was submitted.
  - Browser console showed no errors; only the known local Next.js dev `scroll-behavior: smooth` warning appeared.
  - Remaining risk: the assigned-coach modal still loops existing per-session PATCH calls and is not transactional. A future atomic round-level API would require a separately approved API semantics change.

- Completed Phase B.2 Admin Makeup Process Contract Audit:
  - Read-only audit only; no source code, DB data, migrations, production Admin Makeup actions, payroll calculation, payment, booking, lesson wallet, coupon, assignment, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - Audited `src/app/(admin)/admin/makeup/page.tsx`, `src/components/admin/makeup-client.tsx`, `src/app/api/admin/makeup/route.ts`, `src/lib/admin-attendance-state.ts`, `src/lib/session-attendance-status.ts`, and `src/lib/attendance-write-through.ts`.
  - Confirmed `close_review` only writes `activity_logs.action = attendance_gap_closed_no_action` and hides the review queue item. It does not write attendance, sync session status, create wallet credit, or prove absence/completion.
  - Confirmed `confirm_absent` and `mark_attendance` write exact learner attendance and sync `booking_sessions.status` through `attendance-write-through`.
  - Confirmed `return_entitlement` creates/reuses `lesson_wallet_credits`, updates `booking_sessions.status = walleted`, logs `attendance_gap_return_entitlement`, and does not write attendance.
  - Confirmed `request_coach_review` and `request_coach_evidence` are notification/log review actions only and do not change attendance/session status.
  - Confirmed no-coach `resolve_unassigned_round` creates retrospective assignment context, writes exact attendance per learner, syncs statuses, logs, and notifies users.
  - Suspicious behavior found but not fixed: `return_entitlement` lacks an API guard against existing exact attendance, so using it on a coach-evidence review case could make `attendance` conflict with `booking_sessions.status = walleted`.
  - Suspicious behavior found but not fixed: `mark_attendance` allows `absent`, overlapping with `confirm_absent` but producing a different activity log action.
  - High-risk area found but not fixed: group-level actions are not transactional across sessions, and `close_review` can hide Admin review without changing User/Coach-visible status.
  - Draft next fix plan: first guard `return_entitlement` against existing attendance and improve `close_review` copy/confirmation; then separately decide whether `mark_attendance` should allow absent. Keep payroll calculation, create-makeup POST behavior, and assignment semantics out of the first fix round.

- Completed production post-deploy Coach smoke for Phase B.1:
  - Confirmed commit `640519d` (`640519dbc6b75c9186d7e47966b6f384f75999fc`) was deployed to Vercel production.
  - Deployment id: `dpl_7ZBqt1Fct47o5UAvwKiEDsH7pTVT`.
  - Production alias: `https://www.newathleteschool.com`.
  - Smoke remained read-only: no check-in, attendance save, payroll, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, DB write, migration, source code change, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - Used the Coach account only through the production login UI. Passwords were not written to project files or documentation.
  - `/coach` loaded without redirecting back to login, heading `หน้าหลักโค้ช`; observed status `สถานะเช็คชื่อไม่ค้างแล้ว 4/4 รอบ` with no visible conflict.
  - `/coach/today` loaded without redirecting back to login, heading `ตารางสอนของฉัน`; observed `เช็คอินแล้ว` and `บันทึกผลครบแล้ว` badges with learner labels including `มาเรียนแล้ว` and `ขาดเรียน`.
  - `/coach/attendance` loaded without redirecting back to login, heading `เช็คชื่อนักเรียน`; observed summary `รอบทั้งหมด 4`, `บันทึกผลครบแล้ว 4`, `ยังล็อก/รอเช็คอิน 0`, and `ยังเช็คไม่ครบ 0`. Slot badges showed `บันทึกผลครบแล้ว .../...` together with `เช็คอินแล้ว`.
  - Browser console for `/coach`, `/coach/today`, and `/coach/attendance` showed no errors or warnings.
  - No visible `บันทึกผลบางส่วน` data appeared in production during this smoke, so partial-attendance visual label remains `NEED VERIFICATION` for a future real partial data case.
  - Gate result: `PASS` for production page load, auth redirect, console, and observed Coach display status on `/coach`, `/coach/today`, and `/coach/attendance`; `NEED VERIFICATION` only for a future visible partial-attendance data case.

- Completed authenticated Coach smoke verification retry for Phase B.1:
  - Used the existing Chrome session already logged in by the owner; no password was entered or written to files/docs.
  - Smoke remained read-only: no attendance save, check-in, payroll, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, DB write, migration, source code change, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - `/coach` loaded without redirect, heading `หน้าหลักโค้ช`, and no status conflict was observed.
  - `/coach/today` loaded without redirect, heading `ตารางสอนของฉัน`; observed completed/check-in labels were consistent.
  - `/coach/attendance` loaded without redirect, heading `เช็คชื่อนักเรียน`; observed summary showed complete slots, `ยังล็อก/รอเช็คอิน 0`, and `ยังเช็คไม่ครบ 0`. Slot badges showed `บันทึกผลครบแล้ว .../...` together with `เช็คอินแล้ว`.
  - No visible partial-attendance data appeared in this smoke pass, so partial label rendering remains source/check verified but not visually exercised.
  - Browser console showed no errors. Warning observed: known local Next.js `scroll-behavior: smooth` warning.
  - Logout was performed after smoke and returned to the public home page.
  - Gate result: `PASS` for authenticated Phase B.1 Coach smoke on `/coach`, `/coach/today`, and `/coach/attendance`; `NEED VERIFICATION` only for a future visible partial-attendance data case.

- Attempted authenticated Coach smoke verification for Phase B.1:
  - No source code, DB data, migrations, payroll calculation, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, attendance write action, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - The supplied Coach account was used only through the browser login UI. Passwords were not written to files or docs.
  - Login was blocked by `/auth/login` showing `อีเมลหรือรหัสผ่านไม่ถูกต้อง`.
  - Because a Coach session was not established, authenticated route smoke for `/coach`, `/coach/today`, and `/coach/attendance` remains `NEED VERIFICATION`.
  - Browser console during login showed only the known local Next.js LCP image warning for `/logo new-athlete-school.jpg`; no fresh console error was captured.
  - Gate result: `BLOCKER` for credential/session establishment; no route-level Phase B.1 bug was confirmed.

- Completed Phase B.1 Coach display status sync:
  - Scope stayed limited to Coach display/read-only status for `/coach`, `/coach/today`, `/coach/attendance`, and one helper.
  - No DB data, migrations, payroll calculation, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, attendance write behavior, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - Added `src/lib/coach-slot-display-status.ts` as a pure shared helper for Coach slot display status.
  - `src/app/(coach)/coach/page.tsx` now uses the helper for pending check-in display counts.
  - `src/app/(coach)/coach/today/page.tsx` now uses the helper for slot attendance/check-in badges and completed-result text.
  - `src/components/coach/attendance-client.tsx` now uses the helper for slot card status, locked display state, completed counts, and partial/resolved-without-checkin display.
  - Attendance write buttons in `src/components/coach/attendance-client.tsx` remain disabled when there is no slot check-in, preserving write behavior.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run build`, post-build `.next` cleanup/dev restart, HTTP `/` check, and `_next/static` asset check.
  - `attendance:reconcile:dry-run` returned 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - Unauthenticated browser smoke for `/coach`, `/coach/today`, and `/coach/attendance` redirected to login with no console errors.
  - Authenticated Coach visual smoke remains `Need verification` with a real Coach/Head-Coach browser session.

- Completed Phase A Status Derivation Audit:
  - Read-only audit only; no source code, DB data, migrations, refactors, payroll behavior, attendance behavior, makeup behavior, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - Audited the requested status derivation files plus read-only payroll close API context:
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
    - `src/app/api/admin/coach-payouts/route.ts`
  - Mapped status into five groups: learner attendance, teaching slot, coach evidence, admin review, and payroll.
  - Confirmed learner attendance should remain exact `attendance` first, with `booking_sessions.status` and time only as fallback/cache.
  - Confirmed duplicated slot/check-in/attendance summary logic across Coach dashboard, Coach today, and Coach attendance client.
  - Confirmed `/coach/hours` no-teaching display is now ahead of Admin payroll display/close semantics; payroll behavior needs a separate owner-approved phase.
  - Confirmed Admin Makeup review close state is a separate admin review marker and does not itself prove learner absence/completion.
  - Phase B recommendation: display-only contract/helper cleanup first, payroll separately, Admin Makeup write/action semantics separately.
  - Verification for this docs-only update: `npm.cmd run check:mojibake` and `git diff --check`.

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
- Admin makeup round-level UAT remains owner-driven for any future write cases; the 2026-06-16 `assign_coach_to_round` and `replace_coach_for_past_round` production UAT cases are read-only verified as PASS.
- Phase B.2-New.2 `assign_coach_to_round` owner-run production write UAT was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 16:00-18:00 Ratchada target session assigned to Coach Link.
- Phase B.2-New.3 `replace_coach_for_past_round` owner-run production write UAT was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 15:00-17:00 Rama 2 target group changed to Coach Jom.
- Keep any future production Admin Makeup write action gated by a fresh exact owner-approved target. Default smoke remains read-only.

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
