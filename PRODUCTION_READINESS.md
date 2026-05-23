# Production Readiness

This note is the safe handoff checklist before moving the New Athlete School app from development seed data to production data.

## Safe Order

1. Back up the Supabase project before removing any seed data.
2. Run `npm run prod:check` and read the warnings/blockers.
3. If seed users are still present, run `npm run seed:verify` to confirm the seed data shape.
4. Run `npm run seed:cleanup` only when you are ready to delete demo users and demo flow data.
5. Run `npm run prod:check` again.
6. Confirm real login and payment flows with production-like accounts.

## Data That Can Be Removed

Seed/demo data is expected to use the email prefix `seed.nasc+...@example.com`.

The cleanup script removes data connected to those seed users, including demo bookings, sessions, payments, coupon usages, check-ins, attendance, assignment groups, teaching programs, coach summaries, notifications, complaints, finance seed rows, and seed auth/profile records.

Placeholder URLs from `placehold.co` and `api.dicebear.com` are development-only and should not remain in production payment slips, coach check-in photos, or profile avatars.

## Data That Must Stay

Do not delete these as part of seed cleanup:

- `branches`
- `course_types`
- `levels`
- `pricing_tiers`
- `schedule_templates`
- `system_settings`
- Supabase Storage buckets and policies

These are master/system data, not demo user data.

## Required Storage Buckets

- `payment-slips`: users must be able to view their uploaded payment slip evidence.
- `coach-checkins`: coach selfie evidence for per-slot check-in.
- `avatars`: profile and learner images.

Before production, confirm bucket policies match the real privacy expectation. In particular, `payment-slips` currently relies on public URLs for user slip viewing, while `coach-checkins` should not be broadly public.

## Required Environment Variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Payments:

- `SLIPOK_TEST_MODE` must not be `true` in production.
- `SLIPOK_API_URL` and `SLIPOK_API_KEY` must be configured for real SlipOK verification.

Do not commit `.env.local` or any service role key.

## Staging Deploy Settings

Use the `spike/next-major-security-upgrade` branch as the current deploy candidate until it is reviewed and merged.

Recommended host/runtime settings:

- Node.js: `>=20.9.0`
- Install command: `npm ci`
- Build command: `npm run build`
- Start command for a Node server host: `npm run start`
- Next.js runtime: App Router with `src/proxy.ts`

Environment variables to configure in staging and production:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SLIPOK_TEST_MODE=false
SLIPOK_API_URL=
SLIPOK_API_KEY=
```

Do not add seed/demo credentials to staging. Use real test accounts created through the normal app flow.

Rollback point before first staging deploy:

1. Keep the last stable `main` commit hash.
2. Keep the pushed branch `spike/next-major-security-upgrade` separate until staging smoke tests pass.
3. If staging smoke fails on a framework/runtime issue, redeploy the last stable `main` commit and record the blocker in `DEVELOPMENT_TODO.md`.

## Pre-Deploy Checks

Run these locally before deploy:

```bash
npx tsc --noEmit
npm run check:mojibake
npm run lint
npm run build
npm audit --audit-level=moderate
npm run prod:check
```

If `npm run build` was run while a local dev server is open, restart the dev server before judging localhost UI/CSS. Next.js can otherwise serve stale development chunks.
