# AGENTS.md - Project Documentation for AI Agents

## Quick Start for New Agents

**Read this section first** to get immediate context before diving into details.

### What This Project Does
A badminton school management system in Thailand with 3 user portals:
- **Users** book courses, upload payment slips, track progress
- **Coaches** mark attendance, check-in with photos, submit teaching programs
- **Admins** manage users, payments, coupons, schedules, notifications

### Critical Business Rules (Must Know)
1. **Pricing**: Kids group uses sibling discount (combine all children's sessions for tier pricing)
2. **Level Categories**: 1-30 (Basic), 31-39 (Athlete 1), 40-43 (Athlete 2), 44-60 (Athlete 3) - DO NOT use old ranges
3. **Coach Assignment**: Coaches are assigned to specific teaching slots (`schedule_slots`), not just branches
4. **Check-in**: Per teaching slot, not daily. Requires photo and GPS.
5. **Payment**: SlipOK auto-verifies slips. `SLIPOK_TEST_MODE=true` bypasses API calls.

### Most Important Files
- `src/middleware.ts` - Role-based route guards
- `src/lib/pricing.ts` - All pricing calculations
- `src/lib/activity-log.ts` - Centralized logging (use for all critical actions)
- `src/lib/schedule-slot-utils.ts` - Ensures schedule slots exist for bookings
- `src/lib/auth/admin.ts` - Service role client and auth helpers
- `supabase/schema.sql` - Full database schema with RLS

### Pending Database Change
**Must apply**: `supabase/fix-phone-trigger.sql` - Phone numbers won't save during registration without this trigger.

### Recent Fixes (April 2026)
- Coupon usage counts now derived from `coupon_usages` table (not stale `current_uses`)
- Activity logging centralized and integrated across all critical actions
- Coach check-in changed to per-slot (not daily) with photo/GPS
- Head coach can assign coaches to specific teaching slots
- Coach pages use assignments when available, with branch fallback

---

## Project Overview

**New Athlete Badminton School** is a comprehensive badminton school management system built with Next.js 14, TypeScript, TailwindCSS, and Supabase. The system handles user bookings, coach management, payment processing, attendance tracking, and administrative operations for a multi-branch badminton school in Thailand.

### Key Features

- **User Portal**: Course booking, payment slip upload with SlipOK verification, rescheduling, complaint submission, progress tracking
- **Admin Portal**: User management, payment approval, coupon management, scheduling, notifications, activity logs
- **Coach Portal**: Student levels, attendance marking, teaching program submission, check-in with photo/GPS, student assignment (head coach)
- **Role-Based Access Control**: user, coach, head_coach, admin, super_admin
- **Multi-Branch Support**: 7 branches with different schedules
- **Pricing Engine**: Tiered pricing with sibling discounts for kids group, package pricing for adults, hourly pricing for private lessons

---

## Tech Stack & Architecture

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 3.4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **State Management**: Zustand (client state), SWR (data fetching)
- **Forms**: React Hook Form + Zod validation
- **Theme**: next-themes (dark mode support)

### Backend
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth (email/password)
- **Storage**: Supabase Storage (payment slips, coach check-in photos)
- **Real-time**: Supabase Realtime (not heavily used yet)
- **API**: Next.js API routes (server-side)
- **External API**: SlipOK (payment slip verification)

### Deployment
- **Platform**: Vercel (recommended for Next.js runtime)
- **GitHub Pages**: Static landing page only (docs/ folder)

---

## Folder Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── (admin)/                  # Admin portal (role-protected)
│   │   ├── admin/                # Admin dashboard and pages
│   │   │   ├── bookings/         # Admin booking management
│   │   │   ├── coupons/          # Coupon CRUD
│   │   │   ├── payments/         # Payment approval (SlipOK auto-verify)
│   │   │   ├── schedules/        # Schedule view (real booked sessions)
│   │   │   ├── users/            # User role management
│   │   │   ├── notifications/    # Admin notification center
│   │   │   ├── logs/             # Activity logs (super_admin only)
│   │   │   └── settings/         # System settings (super_admin only)
│   │   └── layout.tsx            # Admin layout with sidebar
│   ├── (coach)/                  # Coach portal (role-protected)
│   │   ├── coach/                # Coach dashboard and pages
│   │   │   ├── today/            # Today's teaching sessions
│   │   │   ├── attendance/       # Attendance marking
│   │   │   ├── checkin/          # Check-in with photo/GPS (per slot)
│   │   │   ├── students/         # Student list with levels
│   │   │   ├── levels/           # Level entry for students
│   │   │   ├── programs/         # Teaching program submission
│   │   │   └── assign-groups/    # Head coach: assign coaches to slots
│   │   └── layout.tsx            # Coach layout
│   ├── (dashboard)/              # User portal (role-protected)
│   │   ├── dashboard/            # User dashboard and pages
│   │   │   ├── booking/          # Course booking flow
│   │   │   ├── history/          # Booking history
│   │   │   ├── schedule/         # Calendar view
│   │   │   ├── reschedule/       # Session rescheduling
│   │   │   ├── progress/         # Student progress
│   │   │   ├── complaint/        # Complaint submission
│   │   │   └── notifications/    # User notifications
│   │   └── layout.tsx            # User layout
│   ├── auth/                     # Authentication pages (public)
│   │   ├── login/                # Login page
│   │   ├── register/             # Registration page
│   │   └── callback/             # Supabase auth callback
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin-only endpoints
│   │   │   ├── bookings/         # Create bookings on behalf of users
│   │   │   ├── coupons/          # Coupon CRUD with activity logging
│   │   │   ├── payments/         # Payment approval (deprecated, use SlipOK)
│   │   │   ├── complaints/       # Complaint management
│   │   │   └── coaches/          # Coach management
│   │   ├── coach/                # Coach-only endpoints
│   │   │   ├── attendance/       # Mark attendance with activity logging
│   │   │   ├── programs/         # Teaching program CRUD with activity logging
│   │   │   ├── checkin/          # Check-in with photo/GPS (per slot)
│   │   │   └── assignments/      # Head coach: assign coaches to slots
│   │   ├── validate-coupon/      # Public coupon validation
│   │   └── complaints/           # Public complaint submission
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles
├── components/                    # React components
│   ├── admin/                    # Admin-specific components
│   ├── coach/                    # Coach-specific components
│   ├── dashboard/                # User-specific components
│   ├── shared/                   # Shared components (auth modal, etc.)
│   └── ui/                       # shadcn/ui components
├── lib/                          # Utility libraries
│   ├── auth/                     # Auth helpers (admin.ts, redirects.ts)
│   ├── supabase/                 # Supabase client setup (server, client, middleware)
│   ├── activity-log.ts           # Centralized activity logging
│   ├── branch-schedules.ts       # Static branch schedule data
│   ├── pricing.ts                # Pricing engine (tiers, calculations)
│   ├── schedule-slot-utils.ts    # Helper to ensure/create schedule slots
│   ├── slipok.ts                 # SlipOK API integration
│   ├── notifications.ts          # Notification helper
│   └── utils.ts                  # General utilities (cn, etc.)
├── types/                        # TypeScript type definitions
│   └── database.ts               # Supabase-generated types
├── hooks/                        # React hooks
├── constants/                    # Constants
├── middleware.ts                 # Next.js middleware (auth, role guards)
└── ...
supabase/                         # Supabase-related files
├── schema.sql                    # Full database schema with RLS policies
├── fix-phone-trigger.sql         # Trigger to save phone from auth metadata
├── add-child-id-to-sessions.sql  # Migration to add child_id to booking_sessions
├── fix-storage.sql               # Storage bucket setup
└── reset-bookings.sql            # Reset bookings (development only)
```

---

## Important Business Logic

### 1. Role-Based Access Control (RBAC)

**Roles**: `user`, `coach`, `head_coach`, `admin`, `super_admin`

**Route Access** (defined in `src/middleware.ts`):
- `user`: `/dashboard` only
- `coach`: `/coach`, `/dashboard`
- `head_coach`: `/coach`, `/dashboard`
- `admin`: `/admin`, `/coach`, `/dashboard`
- `super_admin`: `/admin`, `/coach`, `/dashboard`

**Special Restrictions**:
- Only `super_admin` can access `/admin/settings` and `/admin/logs`
- Only `super_admin` can modify roles of `admin` or `super_admin`
- No user can modify their own role
- Admin users cannot promote others to `super_admin`

**How to Check Role in API Routes**:
```typescript
import { requireAdminUser, requireSuperAdminUser } from '@/lib/auth/admin'

// For admin-only routes
const ctx = await requireAdminUser()
if (!ctx) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// For super-admin-only routes
const ctx = await requireSuperAdminUser()
if (!ctx) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### 2. Pricing Engine (`src/lib/pricing.ts`)

**Kids Group (Monthly, resets each month)**:
- Sibling rule: Combine sessions of all children under same parent, use combined tier
- Tiers: 1 (700/session), 2-6 (625), 7-10 (500), 11-14 (433), 15-18 (406), 19+ (350)
- Incremental pricing: new booking price = (total_sessions × tier_rate) - already_paid_this_month

**Adult Group (Package, expires)**:
- Tiers: 1 (600/session), 10 (550/session, 10-month expiry), 16 (500/session, 10-month expiry)

**Private (Hourly)**:
- Tiers: 1 (900/hour), 10 (800/hour)

**Session Status Labels**:
- <4: "ต่ำกว่าขั้นต่ำ" (warning)
- 4-7: "การเรียนขั้นต่ำ"
- 8-11: "การออกกำลังกาย"
- 12-15: "การเริ่มต้นเป็นนักกีฬา"
- 16-18: "เป็นนักกีฬา"
- 19-23: "เป็นนักกีฬา"
- 24+: "เป็นนักกีฬาระดับประเทศ"

### 3. Booking Flow

1. User selects course type, learner(s), branch, and session dates
2. System calculates price using pricing engine
3. Booking created with status `pending_payment`
4. User uploads payment slip
5. SlipOK API verifies slip (amount, sender, receiver)
6. If `SLIPOK_TEST_MODE=true`, auto-approve; otherwise manual approval
7. Payment status becomes `approved`, booking status becomes `verified`
8. Booking sessions are created in `booking_sessions` table

**Important**: `booking_sessions` should have `schedule_slot_id` linked to `schedule_slots` table for coach assignment and check-in. Use `ensureScheduleSlot()` helper.

**Example: Creating a schedule slot for a booking**
```typescript
import { ensureScheduleSlot } from '@/lib/schedule-slot-utils'

// When creating a booking session
const slot = await ensureScheduleSlot(supabase, {
  branchId: selectedBranch,
  courseTypeId: selectedCourseType,
  date: sessionDate,
  startTime: '17:00',
  endTime: '19:00',
})

// Use the slot.id for booking_sessions.schedule_slot_id
```

### 4. Coach Assignment & Check-in

**Coach Assignment**:
- Head coaches/admins can assign coaches to specific `schedule_slots`
- API: `/api/coach/assignments` (POST/DELETE)
- Backfills `schedule_slot_id` in `booking_sessions` if missing
- Validates coach is assigned to the branch

**Coach Check-in**:
- Per teaching slot (not daily)
- Requires `schedule_slot_id`
- Validates coach is assigned to that slot
- Time window: 2 hours before start to 15 minutes after end
- Prevents duplicate check-in per slot
- Uploads photo to Supabase Storage
- Logs action to `activity_logs`

**Coach Views**:
- Priority: Use `coach_assignments` to filter sessions
- Fallback: Use `coach_branches` if no assignments (for backward compatibility)
- Includes `pending_payment` bookings so newly booked students appear

### 5. Activity Logging

**Centralized Helper**: `src/lib/activity-log.ts`

**Logged Events**:
- Coupon create/update
- Complaint creation
- Attendance marking
- Teaching program create/update
- Coach check-in
- Coach assignment

**Uses Service Role Client**: Bypasses RLS for system-level logging

**Example: Logging an action**
```typescript
import { logActivity } from '@/lib/activity-log'

// In an API route after performing an action
await logActivity({
  userId: user.id,
  action: 'coupon_created',
  entityType: 'coupon',
  entityId: couponId,
  details: { code: couponCode, discount: discountAmount },
  ipAddress: request.headers.get('x-forwarded-for') || null,
})
```

### 6. Level Categories

**Student Levels** (used in progress, coach levels, coach students):
- 1-30: "ชุดพื้นฐาน" (Basic)
- 31-39: "ชุดนักกีฬา 1" (Athlete 1)
- 40-43: "ชุดนักกีฬา 2" (Athlete 2)
- 44-60: "ชุดนักกีฬา 3" (Athlete 3)

**Important**: This is the CURRENT correct range. Old ranges (1-15, 16-30, 31-45, 46-60) are deprecated.

### 7. Notifications

**Types**: `payment`, `schedule`, `reminder`, `complaint`, `system`

**Triggers**:
- New booking
- Payment verified
- Complaint submitted
- Teaching program submitted (to super_admin)
- Reschedule
- Coach assignment

**Admin Alerts** (in `/admin/notifications`):
- Non-renewal alerts (70/80/85% usage)
- Low enrollment alerts (1/2/3+ students per class)
- Customer follow-up alerts (churn prediction)

---

## Environment Variables

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY=          # Supabase service role key (SECRET, never commit)

# SlipOK (Payment Slip Verification)
SLIPOK_API_URL=                     # SlipOK API endpoint
SLIPOK_API_KEY=                     # SlipOK API key
SLIPOK_TEST_MODE=true               # Set to true to auto-approve payments during testing
```

### Notes

- `SUPABASE_SERVICE_ROLE_KEY` is a secret and must NEVER be committed to git
- `SLIPOK_TEST_MODE=true` bypasses actual SlipOK API calls and auto-approves payments
- All variables should be set in `.env.local` (gitignored)

---

## External Services

### Supabase

**Project Ref**: `tvnhholicwjtxdhlxfqs`

**Features Used**:
- **Auth**: Email/password authentication with role-based profiles
- **Database**: PostgreSQL with RLS policies
- **Storage**: `payment-slips` bucket for payment images, `coach-checkins` for check-in photos
- **Realtime**: Available but not heavily used

**RLS Policies**:
- Tables enforce row-level security based on user roles
- Service role key bypasses RLS for system operations (activity logging, admin operations)

**MCP Setup** (for Windsurf/Codex):
- Use `mcp-remote` proxy: `npx -y mcp-remote https://mcp.supabase.com/mcp?project_ref=tvnhholicwjtxdhlxfqs&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cbranching%2Cfunctions%2Cdevelopment%2Cstorage`
- Config file: `~/.codeium/windsurf/mcp_config.json`

### SlipOK API

**Purpose**: Verify payment slips uploaded by users

**Integration**: `src/lib/slipok.ts`

**Flow**:
1. User uploads slip image
2. Server sends image to SlipOK API
3. API returns transaction data (amount, sender, receiver, refs)
4. System validates amount matches booking amount (±1 baht tolerance)
5. If `SLIPOK_TEST_MODE=true`, auto-approve; otherwise manual approval

**Docs**: https://docs.google.com/document/d/1l2ot68Pw3CL7JBeYfUIHLzeBC5F7jm2wzBfm84kwxBA

---

## Authentication Flow

1. User registers/login via Supabase Auth
2. Trigger `handle_new_user()` creates profile in `profiles` table with role='user'
3. Profile stores: `full_name`, `phone`, `email`, `role`, `avatar_url`
4. Middleware (`src/middleware.ts`) checks session on every request
5. Middleware redirects based on role to appropriate home page
6. Server components use `createClient()` from `src/lib/supabase/server.ts`
5. Client components use `createClient()` from `src/lib/supabase/client.ts`

**Important**: Phone number is saved from `raw_user_meta_data` during registration. The trigger is in `supabase/fix-phone-trigger.sql` and must be applied to the database.

---

## Data Flow

### Booking Creation

1. User submits booking form (course, learners, branch, dates)
2. Client sends POST to `/api/bookings` (or `/api/admin/booking` for admin)
3. Server validates and creates `bookings` record
4. Server creates `booking_sessions` records for each selected date
5. Server ensures `schedule_slot` exists via `ensureScheduleSlot()`
6. Server links `booking_sessions.schedule_slot_id` to `schedule_slots.id`
7. Notification sent to admin

### Payment Verification

1. User uploads slip via `/api/payments/upload`
2. Server uploads to Supabase Storage (`payment-slips` bucket)
3. Server calls SlipOK API to verify slip
4. If valid, payment status becomes `approved`, booking becomes `verified`
5. Notification sent to user
6. If `SLIPOK_TEST_MODE=true`, steps 3-5 are skipped and auto-approved

### Coach Check-in

1. Coach selects assigned slot from `/coach/checkin`
2. Coach takes photo (optional) and gets GPS location
3. Client sends POST to `/api/coach/checkin` with `schedule_slot_id`
4. Server validates:
   - Coach is assigned to that slot
   - Time window is valid (2h before to 15m after)
   - No duplicate check-in for this slot
5. Server uploads photo to Supabase Storage (`coach-checkins` bucket)
6. Server creates `coach_checkins` record
7. Server logs action to `activity_logs`

### Head Coach Assignment

1. Head coach goes to `/coach/assign-groups`
2. Page fetches upcoming sessions grouped by slot
3. Head coach selects coach for each slot
4. Client sends POST to `/api/coach/assignments`
5. Server validates:
   - User is head_coach or admin
   - Coach is assigned to the branch
   - `schedule_slot` exists (creates if missing)
6. Server creates/updates `coach_assignments` record
7. Server backfills `schedule_slot_id` in `booking_sessions` if missing
8. Server logs action to `activity_logs`

---

## Known Limitations & Hacks

### 1. Schedule Slot Backfill

**Issue**: Historical `booking_sessions` may not have `schedule_slot_id` populated.

**Hack**: The `ensureScheduleSlot()` helper and assignment API backfill `schedule_slot_id` when coaches are assigned. This is a gradual migration strategy.

**Future**: Run a migration script to backfill all historical sessions.

### 2. Coach View Fallback

**Issue**: Not all sessions have coach assignments yet.

**Hack**: Coach pages (`/coach/today`, `/coach/attendance`, `/coach/students`) first try to filter by `coach_assignments`, then fall back to `coach_branches` if no assignments exist.

**Future**: Once all sessions are assigned, remove the fallback.

### 3. Coupon Usage Count

**Issue**: `coupons.current_uses` field may become stale.

**Fix**: All coupon usage counts are now derived from `coupon_usages` table. The `current_uses` field is denormalized but not relied upon.

### 4. TypeScript `any` Types

**Issue**: Some Supabase queries use `as any` to work around type inference issues with complex joins.

**Status**: Compiles with `tsc --noEmit --skipLibCheck`. Should be gradually replaced with proper types.

### 5. Admin Manual Payment Approval

**Issue**: The manual approve/reject UI in admin payments was removed to align with SlipOK auto-verification flow.

**Status**: Admin can still view payments, but approval is handled by SlipOK API. Manual override may be needed in edge cases.

---

## Coding Conventions & Rules

### 1. File Naming

- **Components**: PascalCase (e.g., `BookingClient.tsx`)
- **Utilities**: camelCase (e.g., `pricing.ts`, `activity-log.ts`)
- **API Routes**: lowercase with hyphens (e.g., `/api/admin/bookings`)
- **Pages**: lowercase (e.g., `/dashboard/booking`)

### 2. Component Structure

- **Server Components**: Default for Next.js 14 App Router
- **Client Components**: Add `'use client'` directive at top
- **Separation**: Keep business logic in server components, UI state in client components
- **Naming**: Client components often have `-client` suffix (e.g., `BookingClient.tsx`)

### 3. Supabase Queries

- **Server**: Use `createClient()` from `src/lib/supabase/server.ts`
- **Client**: Use `createClient()` from `src/lib/supabase/client.ts`
- **Service Role**: Use `getServiceRoleClient()` from `src/lib/auth/admin.ts` (bypasses RLS)
- **Type Safety**: Use `as any` sparingly; prefer proper types from `@/types/database`

### 4. Error Handling

- **API Routes**: Return `{ error: string }` for errors, `{ success: true, data: any }` for success
- **Client Components**: Use toast notifications (Sonner) for user feedback
- **Server Components**: Handle errors gracefully, redirect if needed

### 5. Styling

- **TailwindCSS**: Use utility classes
- **shadcn/ui**: Use pre-built components from `@/components/ui`
- **Custom Colors**: Brand colors: `#153c85` (dark blue), `#2748bf` (blue), `#f57e3b` (orange)
- **Responsive**: Use mobile-first approach with `md:`, `lg:` prefixes

### 6. Internationalization

- **Language**: Thai is the primary language for UI
- **Date Formatting**: Use Thai locale when displaying dates
- **Currency**: Use Thai Baht (฿)

### 7. Git Workflow

- **Branch**: Main development happens on `main` branch
- **Commit**: Write clear, descriptive commit messages
- **Secrets**: Never commit `.env.local` or any secrets

---

## Things That Must NOT Be Changed

### 1. Database Schema

- **Do NOT** modify `supabase/schema.sql` without understanding RLS policies
- **Do NOT** change enum values without migrating existing data
- **Do NOT** remove foreign key constraints

### 2. Role Hierarchy

- **Do NOT** change role access rules in `src/middleware.ts`
- **Do NOT** allow regular users to access admin routes
- **Do NOT** allow admins to modify super_admin roles

### 3. Pricing Logic

- **Do NOT** change pricing tiers without business approval
- **Do NOT** remove sibling discount logic for kids group
- **Do NOT** change session status label ranges without updating all usages

### 4. Auth Flow

- **Do NOT** bypass Supabase Auth
- **Do NOT** store passwords in plain text
- **Do NOT** expose service role key to client

### 5. External API Keys

- **Do NOT** commit `SUPABASE_SERVICE_ROLE_KEY`
- **Do NOT** commit `SLIPOK_API_KEY`
- **Do NOT** hardcode API keys in source code

### 6. Critical Helpers

- **Do NOT** modify `ensureScheduleSlot()` without understanding its purpose
- **Do NOT** remove activity logging from critical actions
- **Do NOT** change the fallback logic in coach views until all sessions are assigned

---

## Testing & Validation

### TypeScript Check

```bash
npx tsc --noEmit --skipLibCheck
```

Should exit with code 0 (no errors).

### Linting

```bash
npm run lint
```

### Manual Testing

See `TESTING_GUIDE.md` for comprehensive testing procedures.

---

## Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to `main`

### GitHub Pages

- Only for static landing page in `docs/` folder
- Not suitable for full application (requires Next.js runtime)
- Workflow: `.github/workflows/deploy-github-pages.yml`

---

## Supabase MCP Setup

For Windsurf/Codex with Supabase integration:

1. Install Supabase agent skills:
   ```bash
   npx skills add supabase/agent-skills
   ```

2. Configure MCP in `~/.codeium/windsurf/mcp_config.json`:
   ```json
   {
     "mcpServers": {
       "supabase": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-remote",
           "https://mcp.supabase.com/mcp?project_ref=tvnhholicwjtxdhlxfqs&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cbranching%2Cfunctions%2Cdevelopment%2Cstorage"
         ]
       }
     }
   }
   ```

3. Restart IDE

---

## Pending Database Changes

### Phone Trigger

**File**: `supabase/fix-phone-trigger.sql`

**Status**: Prepared but NOT yet applied to database

**Action Required**: Run this SQL in Supabase SQL editor to ensure phone numbers are saved from registration metadata.

---

## Common Issues & Solutions

### Issue: Images not loading from Supabase Storage

**Cause**: Next.js Image component needs hostname whitelisted

**Solution**: `next.config.mjs` already whitelists Supabase host from `NEXT_PUBLIC_SUPABASE_URL`

### Issue: Coach check-in failing

**Cause**: Coach not assigned to the slot, or time window invalid

**Solution**: Ensure head coach assigns coach to slot via `/coach/assign-groups`

### Issue: Coupon usage count incorrect

**Cause**: Relying on stale `current_uses` field

**Solution**: All coupon usage counts now derived from `coupon_usages` table

### Issue: Activity logs not appearing

**Cause**: Service role key not set, or RLS blocking inserts

**Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set and activity log helper uses service role client

---

## Contact & Support

For questions about this project, refer to:
- `README.md` - Basic setup and run instructions
- `TESTING_GUIDE.md` - Comprehensive testing procedures
- `IMPLEMENTATION_PLAN.md` - Original implementation plan
- `CMS New Athlete School.md` - Business requirements from CMS

---

## Common Patterns

### Pattern 1: Server Component with Supabase Query
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function MyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('table_name')
    .select('*')
    .eq('user_id', user.id)

  return <div>{/* JSX */}</div>
}
```

### Pattern 2: API Route with Auth Check
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Your logic here
  return NextResponse.json({ success: true, data: result })
}
```

### Pattern 3: Client Component with Form
```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function MyForm() {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: FormData) => {
    setLoading(true)
    const { error } = await supabase.from('table_name').insert({ /* data */ })
    setLoading(false)
  }

  return <form action={handleSubmit}>{/* JSX */}</form>
}
```

### Pattern 4: Using Service Role Client (Bypasses RLS)
```typescript
import { getServiceRoleClient } from '@/lib/auth/admin'

// Use for system operations that need to bypass RLS
const supabase = getServiceRoleClient()
const { data } = await supabase.from('table_name').select('*')
```

---

## Database Schema Overview

### Key Tables

**profiles**: Extends auth.users with role, full_name, phone, email
- **Relationships**: One-to-many with children, bookings
- **Critical**: Role field determines access (user, coach, head_coach, admin, super_admin)

**bookings**: Main booking records
- **Relationships**: Belongs to profiles (user), course_types, branches
- **Status**: pending_payment, paid, verified, cancelled

**booking_sessions**: Individual session records
- **Relationships**: Belongs to bookings, schedule_slots, children (if child booking)
- **Critical**: Must have schedule_slot_id for coach assignment
- **Status**: scheduled, completed, rescheduled, absent

**schedule_slots**: Actual teaching slots (not templates)
- **Relationships**: Belongs to branches, course_types
- **Unique constraint**: (branch_id, course_type_id, date, start_time)
- **Used for**: Coach assignments, check-ins

**coach_assignments**: Links coaches to schedule_slots
- **Relationships**: Belongs to profiles (coach), schedule_slots
- **Critical**: Determines which coach teaches which slot

**coach_checkins**: Coach check-in records
- **Relationships**: Belongs to profiles (coach), schedule_slots
- **Features**: Photo URL, GPS location, check-in time
- **Constraint**: One check-in per coach per slot

**coupon_usages**: Tracks coupon usage
- **Relationships**: Belongs to coupons, bookings
- **Critical**: Source of truth for coupon usage counts (not coupons.current_uses)

**activity_logs**: System audit trail
- **Relationships**: Belongs to profiles (user)
- **Access**: Only super_admin can view, system can insert

### Important Foreign Keys
- `booking_sessions.schedule_slot_id` → `schedule_slots.id`
- `coach_assignments.schedule_slot_id` → `schedule_slots.id`
- `coach_assignments.coach_id` → `profiles.id`
- `booking_sessions.child_id` → `children.id` (nullable)

---

## How to Add New Features

### 1. Adding a New Page
1. Create page in appropriate folder: `src/app/(portal)/feature/page.tsx`
2. Add route to middleware if needed (for role restrictions)
3. Add navigation link in sidebar (if applicable)
4. Test with different user roles

### 2. Adding a New API Route
1. Create route in `src/app/api/` folder
2. Add auth check at the top
3. Add role check if needed (use helpers from `src/lib/auth/admin.ts`)
4. Add activity logging for critical actions
5. Return consistent error/success responses

### 3. Adding a New Database Table
1. Add table definition to `supabase/schema.sql`
2. Add RLS policies
3. Generate TypeScript types: `npx supabase gen types typescript --local > src/types/database.ts`
4. Update this document with table description

### 4. Adding Activity Logging
1. Import `logActivity` from `src/lib/activity-log.ts`
2. Call after the action completes successfully
3. Include meaningful action name, entity type, and details
4. Use service role client if in server context

---

## Common Pitfalls to Avoid

### 1. Forgetting schedule_slot_id
**Problem**: Creating booking_sessions without linking to schedule_slots
**Solution**: Always use `ensureScheduleSlot()` helper when creating sessions

### 2. Using Wrong Supabase Client
**Problem**: Using client client in server components or vice versa
**Solution**: Server components use `src/lib/supabase/server.ts`, client components use `src/lib/supabase/client.ts`

### 3. Not Logging Critical Actions
**Problem**: Changes to coupons, payments, assignments not logged
**Solution**: Always call `logActivity()` for actions that affect business data

### 4. Hardcoding Role Checks
**Problem**: Duplicating role check logic in multiple places
**Solution**: Use helpers from `src/lib/auth/admin.ts` (requireAdminUser, requireSuperAdminUser)

### 5. Ignoring RLS Policies
**Problem**: Queries fail because RLS blocks access
**Solution**: Use service role client only when necessary, otherwise ensure user has proper permissions

### 6. Using Deprecated Level Ranges
**Problem**: Using old level ranges (1-15, 16-30, etc.)
**Solution**: Always use current ranges: 1-30, 31-39, 40-43, 44-60

---

## Testing Checklist Before Deploying

- [ ] TypeScript check passes: `npx tsc --noEmit --skipLibCheck`
- [ ] Linting passes: `npm run lint`
- [ ] All critical actions log to activity_logs
- [ ] Coach check-in works with schedule_slot_id
- [ ] Coach pages use assignments when available
- [ ] Coupon usage counts derived from coupon_usages
- [ ] Level categories use correct ranges
- [ ] No hardcoded secrets in source code
- [ ] Environment variables documented in .env.example
- [ ] Database schema up to date
- [ ] Phone trigger applied to database

---

## How to Debug Common Issues

### Issue: "User not found" after registration
**Cause**: Phone trigger not applied to database
**Debug**: Check if `profiles.phone` is null for recently registered users
**Fix**: Run `supabase/fix-phone-trigger.sql` in Supabase SQL Editor

### Issue: Coach can't see assigned sessions
**Cause**: `coach_assignments` not created or `schedule_slot_id` missing
**Debug**: Query `coach_assignments` table for the coach_id and check `schedule_slots` exist
**Fix**: Use `/coach/assign-groups` to assign coach to slots, or ensure `ensureScheduleSlot()` is called

### Issue: Payment not auto-approving
**Cause**: `SLIPOK_TEST_MODE` not set or SlipOK API failing
**Debug**: Check environment variables, check browser console for API errors
**Fix**: Set `SLIPOK_TEST_MODE=true` for development, or verify SlipOK API credentials

### Issue: RLS policy violation
**Cause**: Query blocked by Row Level Security
**Debug**: Check RLS policies in Supabase dashboard, verify user role
**Fix**: Use service role client for system operations, or adjust RLS policies

### Issue: TypeScript errors with Supabase queries
**Cause**: Type inference issues with complex joins
**Debug**: Check if using `as any` workaround is needed
**Fix**: Use `as any` sparingly, or improve type definitions in `src/types/database.ts`

---

## Branch Schedule Data

**Location**: `src/lib/branch-schedules.ts`

**Purpose**: Static data defining available time slots for each branch, course type, and day of week

**Structure**:
```typescript
export interface BranchSchedule {
  branchSlug: string        // e.g., 'chaengwattana'
  courseType: 'kids_group' | 'adult_group' | 'private'
  dayOfWeek: number         // 0=Sunday, 1=Monday, ..., 6=Saturday
  slots: TimeSlot[]         // Array of available time slots
}

export interface TimeSlot {
  start: string  // "17:00"
  end: string    // "19:00"
}
```

**Usage**:
- Used in booking flow to show available slots
- Used in admin scheduling to display template schedules
- **Note**: This is template data, actual teaching slots are in `schedule_slots` table

**7 Branches**:
- chaengwattana
- bangkapi
- rama9
- ladprao
- huamark
- bangna
- rangsit

---

## Notification System

**Helper**: `src/lib/notifications.ts`

**Notification Types**:
- `payment` - Payment status changes
- `schedule` - Schedule changes, rescheduling
- `reminder` - Payment reminders, session reminders
- `complaint` - Complaint updates
- `system` - System announcements

**How to Send a Notification**:
```typescript
import { createNotification } from '@/lib/notifications'

await createNotification(supabase, {
  userId: targetUserId,        // null for broadcast to all
  type: 'payment',
  title: 'การชำระเงินสำเร็จ',
  message: 'การชำระเงินของคุณได้รับการยืนยันแล้ว',
  link: '/dashboard/history',
})
```

**Admin Alerts** (in `/admin/notifications`):
- Non-renewal alerts: Users at 70/80/85% of monthly sessions
- Low enrollment alerts: Classes with 1/2/3+ students
- Customer follow-up: Users who haven't renewed

**Quick Actions**: Admin can send reminders directly from alert cards

---

## Booking Flow Detailed Example

### Step 1: User Selects Course and Learners
```typescript
// In booking client component
const selectedCourse = 'kids_group'
const selectedLearners = [
  { childId: 'child-1', sessions: 4 },
  { childId: 'child-2', sessions: 6 },
]
```

### Step 2: Calculate Price
```typescript
import { getKidsGroupIncremental } from '@/lib/pricing'

// Sibling rule: combine sessions
const totalSessions = 4 + 6 // 10
const { incrementalPrice, tierLabel } = getKidsGroupIncremental(
  existingSessionsThisMonth,  // 0 for new booking
  existingPaidThisMonth,     // 0 for new booking
  totalSessions              // 10
)
// Result: tier 7-10, 500/session, total 5000
```

### Step 3: Create Booking
```typescript
const { data: booking } = await supabase
  .from('bookings')
  .insert({
    user_id: userId,
    learner_type: 'child',
    course_type_id: courseTypeId,
    branch_id: branchId,
    total_sessions: totalSessions,
    total_price: incrementalPrice,
    status: 'pending_payment',
  })
  .select()
  .single()
```

### Step 4: Create Sessions with Schedule Slots
```typescript
import { ensureScheduleSlot } from '@/lib/schedule-slot-utils'

for (const date of selectedDates) {
  // Ensure schedule slot exists
  const slot = await ensureScheduleSlot(supabase, {
    branchId: branchId,
    courseTypeId: courseTypeId,
    date: date,
    startTime: '17:00',  // From branch-schedules.ts
    endTime: '19:00',
  })

  // Create booking session
  await supabase.from('booking_sessions').insert({
    booking_id: booking.id,
    schedule_slot_id: slot.id,
    date: date,
    start_time: '17:00',
    end_time: '19:00',
    status: 'scheduled',
  })
}
```

### Step 5: User Uploads Payment Slip
```typescript
// Upload to Supabase Storage
const { data: uploadData } = await supabase.storage
  .from('payment-slips')
  .upload(`payments/${booking.id}/${fileName}`, file)

// Create payment record
await supabase.from('payments').insert({
  booking_id: booking.id,
  slip_url: uploadData.path,
  status: 'pending',
})

// SlipOK verification happens automatically
```

---

## Summary for New AI Agents

**To start working on this project:**

1. **Read Quick Start** (top of this document) - 5 minutes
2. **Review Critical Business Rules** - pricing, levels, coach assignment
3. **Check Pending Database Changes** - apply phone trigger
4. **Understand the Architecture** - Next.js 14, Supabase, role-based access
5. **Use Common Patterns** - copy-paste from examples in this document
6. **Avoid Common Pitfalls** - especially schedule_slot_id and activity logging
7. **Follow Coding Conventions** - file naming, component structure, styling

**When in doubt:**
- Check `src/lib/` for helper functions
- Check `supabase/schema.sql` for database structure
- Check existing similar features for patterns
- Use `tsc --noEmit --skipLibCheck` to validate TypeScript
- Test with different user roles to verify access control
