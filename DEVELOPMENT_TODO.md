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

- [ ] 1. User Profile Settings for every role
  - Users can edit their own name, phone, avatar, and password.
  - Email must not be editable because it is the login username.
  - Avatar should update `profiles.avatar_url` and be reused by sidebar/ranking/profile surfaces.
- [ ] 2. Pricing Settings
  - Super Admin can edit course price tiers through the system.
  - Booking/Admin Booking should use DB settings as the source of truth, not hardcoded pricing.
- [ ] 3. Coach OT Settings
  - Super Admin can edit weekly OT threshold and OT rates.
  - Payroll and Finance should read these settings instead of constants.
- [ ] 4. Schedule Templates as DB Source of Truth
  - Confirm every branch/course/day/time template is stored in DB.
  - Remove or minimize hardcoded schedule fallback after DB data is trusted.
- [ ] 5. Admin Booking Flow QA and Completion
  - Verify Admin can book for user/child, select valid template slots, calculate price, apply coupon, and create correct booking/payment/session data.
- [ ] 6. Payroll Payout Closing
  - Add/complete workflow for marking coach payout periods as paid/closed and keeping payout history.
- [ ] 7. Finance Business Overview Completion
  - Improve monthly/yearly business view with revenue, expenses, OT, net result, branch/course breakdown, and export-ready summaries if needed.
- [ ] 8. Admin Menu Permissions QA
  - Verify regular Admin sees only menus allowed by Super Admin and cannot access hidden routes directly.
- [ ] 9. Admin Ranking QA and Useful Filters
  - Verify Ranking data, avatars, Level 0/default state, child/adult tabs, and add branch/type/level filters only if needed for real admin use.
- [ ] 10. Level Settings to Coach Evaluation Flow
  - Confirm Super Admin Level settings feed Coach level evaluation and public/admin ranking consistently.
- [ ] 11. Admin Regression and Responsive Pass
  - After items 1-10 are completed, run a focused pass on Admin desktop/mobile layout and critical flows.

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
