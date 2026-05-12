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
- [x] Admin schedule templates can be managed from schedules page and booking/makeup flows use DB templates before hardcoded fallback.
- [ ] Fix any auth/session/profile issues.
- [ ] Fix any booking/session/payment data issues.
- [ ] Fix any Storage upload or public URL issues.
- [ ] Fix any coach assignment/check-in/attendance issues.
- [ ] Fix any role/RLS permission issues.

## Phase 3 - Build & Deploy Readiness

- [ ] Make `npm run build` pass.
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
