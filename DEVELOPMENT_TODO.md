# Development TODO

## Phase 0 - Baseline & Readiness

- [x] Confirm current app runs locally with real Supabase project.
- [x] Confirm `.env.local` contains all required values on this machine.
- [x] Confirm registration creates `profiles.phone` correctly.
- [x] Confirm Supabase Storage buckets and policies are ready for payment slips and uploads.
- [x] Set up Supabase CLI locally or choose a manual migration baseline path.
- [x] Create a baseline database migration/snapshot from the current remote schema.
- [x] Confirm local migration history matches the remote project before adding new DB changes.

Notes:
- Supabase CLI is initialized and linked to project `tvnhholicwjtxdhlxfqs`.
- Baseline migration created at `supabase/migrations/20260506082635_current_remote_baseline.sql`.
- Local and remote migration history both show `20260506082635` as applied.
- `payment-slips` is a public Storage bucket with upload/select policies, and user history links to `payments.slip_image_url`.

## Phase 1 - Core UAT

- [x] User flow: register/login, dashboard, booking, payment slip upload, slip view.
- [ ] Admin flow: dashboard, users, coaches, bookings, payments, coupons, complaints.
- [ ] Coach flow: dashboard, today, check-in, attendance, student levels, teaching programs.
- [ ] Head coach flow: assign coaches to teaching slots.
- [ ] Super admin flow: settings and activity logs.
- [ ] Record bugs found during UAT with severity.

## Phase 2 - Blocking Fixes

- [x] Admin overview dashboard compact KPI cards and monthly schedule overview.
- [x] Admin payments audit dashboard for SlipOK-driven payment review and slip viewing.
- [x] Admin schedules operation calendar with monthly filters and daily drill-down.
- [x] Admin users management dashboard with role-safe editing and learner details.
- [x] Admin coaches management dashboard with head coach self-assignment clarity.
- [x] Admin branches operations dashboard with branch status, coach coverage, and booking overview.
- [x] Admin makeup sessions dashboard with overdue detection and one-time next-month makeup creation flow.
- [x] Admin coach check-in audit by teaching slot with mandatory selfie/photo evidence.
- [x] Admin coach payroll review based on assigned teaching slots, verified check-in evidence, and weekly OT rules.
- [x] Admin finance manual expenses for real monthly/yearly net income tracking.
- [x] Admin schedule templates moved to a dedicated "รอบเรียนประจำ" menu, seeded from legacy hardcoded schedules, and booking/makeup flows use DB templates before hardcoded fallback.
- [ ] Fix any auth/session/profile issues.
- [ ] Fix any booking/session/payment data issues.
- [ ] Fix any Storage upload or public URL issues.
- [ ] Fix any coach assignment/check-in/attendance issues.
- [ ] Fix any role/RLS permission issues.

## Phase 2.5 - Admin/System Execution Queue

**Current source of truth for the next Admin/System work.** Work through this queue one item at a time. Do enough checking to confirm the touched flow still works, but do not loop into broad redesigns or repeated QA before the main process/function tasks are complete.

- [x] 1. User Profile Settings for every role
  - Users can edit their own name, phone, avatar, and password.
  - Email must not be editable because it is the login username.
  - Avatar should update `profiles.avatar_url` and be reused by sidebar/ranking/profile surfaces.
- [x] 2. Pricing Settings
  - Super Admin can edit course price tiers through the system.
  - User Booking should use DB settings as the source of truth, not hardcoded pricing.
- [x] 3. Coach OT Settings
  - Super Admin can edit weekly OT threshold and OT rates.
  - Payroll and Finance should read these settings instead of constants.
- [x] 4. Settings Workspace UX
  - Replace the raw Key/Value JSON settings list with user-friendly section panels.
  - Default section should be Admin Menu Permissions.
  - Reuse existing Admin Menu Permissions, Level Settings, Pricing Settings, and Coach OT Settings UI.
  - Keep raw JSON settings hidden from the normal Super Admin workflow; reserve it for developer/debug use only if needed.
- [x] 5. Schedule Templates as DB Source of Truth
  - Confirmed remote DB has 653 active schedule templates, matching the legacy seed migration.
  - User Booking, Reschedule, and Makeup flows now resolve slots from DB templates without hardcoded schedule fallback.
  - Legacy `branch-schedules.ts` remains only as a label/reference file until the remaining imports are cleaned up later.
- [x] 6. Remove Admin Booking Entry Points
  - Admin/Super Admin must not book on behalf of users.
  - Users must create bookings and complete payment themselves.
  - Old `/admin/booking` page now redirects to `/admin`.
  - Old `POST /api/admin/booking` now returns `410 Gone`.
  - Removed the unused Admin booking client component so the cancelled flow is not accidentally reused.
- [x] 7. Coach Teaching Hours / Weekly OT Refactor
  - Rename the Admin menu from "เงินเดือนโค้ช" to "คำนวณชั่วโมงสอน".
  - Keep the existing Head Coach / Coach role and permissions unchanged; the new coach type is payment logic only.
  - Add independent coach employment type: `full_time`, `half_time`, `part_time`.
  - Full-Time: weekly threshold 25 hours; OT Private 400 THB/hour, Group 200 THB/hour.
  - Half-Time: weekly threshold 12.5 hours; OT Private 400 THB/hour, Group 200 THB/hour.
  - Part-Time: no threshold; pay weekly teaching hours directly; Private 400 THB/hour, Group 250 THB/hour.
  - Calculate from verified teaching evidence only: assigned teaching slot + coach check-in + mandatory photo evidence.
  - Base salary is outside this system; this page summarizes weekly teaching hours and extra/payable teaching amounts for the owner.
  - Existing monthly `coach_payouts` implementation is superseded by this weekly teaching-hour model and must be refactored before continuing Coach/User work.
  - Added `profiles.coach_employment_type` and `coach_weekly_teaching_summaries` as the new weekly summary/audit source.
  - Coach management can set employment type without changing Head Coach / Coach role.
  - Admin teaching-hours page now closes weekly summaries from verified teaching slots and stores a server-side snapshot.
- [x] 8. Finance Business Overview Completion
  - Improve monthly/yearly business view with revenue, expenses, OT, net result, branch/course breakdown, and export-ready summaries if needed.
  - Finance now reads coach cost from closed `coach_weekly_teaching_summaries` instead of recalculating OT from live assignments.
  - Monthly/yearly view summarizes approved revenue, closed coach teaching pay, manual expenses, net result, branch/course revenue, coach cost, and monthly trend.
- [x] 9. Admin Menu Permissions QA
  - Verify regular Admin sees only menus allowed by Super Admin and cannot access hidden routes directly.
  - Admin menu labels/settings copy were normalized back to readable Thai for the permission workspace.
  - Added API-level guards for configurable Admin menu domains so hidden menus cannot be used through direct endpoint calls.
  - Mobile notification badge now respects the Admin notification menu permission.
- [x] 10. Admin Ranking QA and Useful Filters
  - Verify Ranking data, avatars, Level 0/default state, child/adult tabs, branch source, and latest Coach/Admin evaluation.
  - Public ranking must support read-only filters, including branch filter, learner type, and level/rank view.
  - Public users can see who is in each branch, each student's rank within that branch, and their overall NA rank.
  - Add branch summary for both public/admin views: selected branch top student, selected branch count, and overall NA top student/level for comparison.
  - Keep ranking source based on latest Coach evaluation in `student_levels`; students with no evaluation must stay at Level 0.
  - Admin and Coach can update student level/rank; public users can only view.
  - Add achievement/badge plan for students who competed or won awards. Prefer a dedicated `student_achievements` data source with emoji/title/description/is_active instead of storing badges in level notes.
  - Admin and Coach can manage achievement emoji/badges; public users can only view active badges.
  - Show achievement emoji after the student name on both public and admin ranking, with achievement detail available in a tooltip/detail area.
  - Keep responsive layout readable on mobile: compact filters, small KPI summary, and ranking rows that do not become too tall.
  - Implemented dynamic branch filters from `branches`, overall NA rank, selected-branch rank, public read-only ranking, and Admin achievement management.
  - Added `student_achievements` table/API for active public badges. Coach UI for managing badges should be wired in the Coach/Level flow.
- [x] 11. Level Settings to Coach Evaluation Flow
  - Confirm Super Admin Level settings feed Coach level evaluation and public/admin ranking consistently.
  - Coach evaluation now uses active Level rows from `levels` as the selectable source of truth instead of free typing from hardcoded copy.
  - `/api/coach/levels` validates that the selected Level exists and is active before writing to `student_levels`.
  - Public/Admin Ranking now resolves the latest evaluated Level against `levels` so edited Level names are reflected in ranking display.
  - Added shared student achievement management for Admin Ranking and Coach Level flow, with preset trophy/medal emoji options ready for awards.
  - Repaired Thai copy in Level constants, Admin Level settings, Coach Level evaluation, and Ranking surfaces touched by this flow.
  - Level settings must be extensible beyond LV 70: Super Admin can add LV 71+ rows, while Coach evaluation can only select active rows from `levels`.
- [x] 12. Admin Regression and Responsive Pass
  - After items 1-11 are completed, run a focused pass on Admin desktop/mobile layout and critical flows.
  - Added Admin shell width guards (`min-w-0`, max readable canvas) so wide tables/cards do not force horizontal overflow under the sidebar.
  - Adjusted Admin schedule calendars and dashboard schedule cards for mobile: compact month labels, shorter day cells, and desktop split layout only at very wide screens.
  - Moved heavy table/grid layouts on Payments, Users, Coaches, Complaints, Makeup, Payroll, and Level Settings to wider breakpoints so tablet/mobile use stacked cards instead of cramped pseudo-tables.
  - Verified `npm run check:mojibake`, `git diff --check`, and `npm run build`; build passes with existing lint warnings from Coach/User areas still tracked as separate technical debt.

## Phase 3 - Build & Deploy Readiness

- [ ] Make `npm run build` pass.
- [x] Add mojibake guard: run `npm run check:mojibake` before committing Thai UI/copy changes.
- [x] Add local verification note: after `npm run build`, restart the dev server before checking localhost to avoid stale Next CSS chunks.
- [ ] Reduce lint blockers: unused imports, unused variables, JSX escaping, and high-risk `any` usage.
- [ ] Review dependency vulnerabilities and update safely.
- [ ] Prepare production environment variables.
- [ ] Deploy staging and run smoke tests.

## Phase 4 - Feature Completion

- [ ] Real-time notifications.
- [ ] Automated renewal/payment reminders.
- [ ] Advanced reports for revenue, enrollment, coach performance.
- [ ] Level recommendation system.
- [ ] Adult package usage across 10 months.
- [ ] Waitlist and class capacity enhancements.
