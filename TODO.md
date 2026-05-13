# TODO.md - Legacy Backlog, Known Bugs, and Planned Features

> Active execution tracking is in `DEVELOPMENT_TODO.md`.
> Use this file only as an old backlog/reference list. Some items below may be stale and must be checked against current code and `DEVELOPMENT_TODO.md` before acting.

## Current Tasks (High Priority)

### 1. Apply Phone Trigger to Database
- **Status**: SQL prepared but not applied
- **File**: `supabase/fix-phone-trigger.sql`
- **Action**: Run this SQL in Supabase SQL editor to ensure phone numbers are saved from registration metadata
- **Impact**: Without this, user phone numbers won't persist after registration

### 2. Update TESTING_GUIDE for SlipOK Auto-Approval Flow
- **Status**: Pending
- **Issue**: Testing guide still references manual admin approval for payments
- **Reality**: SlipOK now auto-approves when `SLIPOK_TEST_MODE=true`
- **Action**: Update payment testing section to reflect auto-approval flow

## Known Bugs

### 1. TypeScript `any` Types in Supabase Queries
- **Severity**: Low
- **Location**: Multiple files use `as any` for complex Supabase joins
- **Impact**: Type safety is reduced, but code compiles with `--skipLibCheck`
- **Fix**: Gradually replace with proper types from `@/types/database`

### 2. Historical Booking Sessions Missing schedule_slot_id
- **Severity**: Medium
- **Issue**: Old `booking_sessions` records may not have `schedule_slot_id` populated
- **Workaround**: Assignment API backfills this when coaches are assigned
- **Long-term Fix**: Run migration script to backfill all historical sessions

### 3. Coach View Fallback for Unassigned Sessions
- **Severity**: Low
- **Issue**: Coach pages fall back to branch-based filtering if no assignments exist
- **Impact**: May show sessions coach isn't actually assigned to
- **Long-term Fix**: Remove fallback once all sessions have coach assignments

## Planned Features

### 1. Real-time Notifications
- **Status**: Not implemented
- **Description**: Use Supabase Realtime for live notification updates
- **Priority**: Medium

### 2. Coach Teaching Hours Dashboard
- **Status**: Partially implemented
- **Description**: Enhanced dashboard showing teaching hours, earnings, performance metrics
- **Priority**: Medium

### 3. Parent Portal for Children Progress
- **Status**: Not implemented
- **Description**: Separate portal for parents to view their children's progress, attendance, and feedback
- **Priority**: Low

### 4. Automated Payment Reminders
- **Status**: Not implemented
- **Description**: Automatic reminders for upcoming payments, renewals, and overdue payments
- **Priority**: Medium

### 5. Mobile App (React Native)
- **Status**: Not started
- **Description**: Mobile app for coaches to check-in, mark attendance, and view schedules on the go
- **Priority**: Low

### 6. Advanced Reporting
- **Status**: Not implemented
- **Description**: Analytics dashboard for revenue, enrollment trends, coach performance
- **Priority**: Medium

### 7. Class Capacity Management
- **Status**: Basic implementation
- **Description**: Waitlist system when classes are full, automatic capacity management
- **Priority**: Low

### 8. Multi-language Support
- **Status**: Not implemented
- **Description**: Support for English and other languages beyond Thai
- **Priority**: Low

## Recently Completed (April 2026)

### Coupon Usage Tracking
- **Fixed**: Coupon usage counts now derived from `coupon_usages` table instead of stale `current_uses` field
- **Files**: `src/app/(admin)/admin/coupons/page.tsx`, `src/app/api/validate-coupon/route.ts`

### Activity Logging
- **Fixed**: Centralized activity logging implemented for all critical actions
- **Files**: `src/lib/activity-log.ts`, various API routes
- **Logged Events**: Coupon create/update, complaints, attendance, teaching programs, check-ins, assignments

### Coach Check-in Flow
- **Fixed**: Changed from daily check-in to per-teaching-slot check-in
- **Features**: Photo upload, GPS location, time window enforcement, duplicate prevention
- **Files**: `src/app/(coach)/coach/checkin/page.tsx`, `src/components/coach/checkin-client.tsx`, `src/app/api/coach/checkin/route.ts`

### Head Coach Assignment
- **Fixed**: Head coaches can now assign coaches to specific teaching slots
- **Features**: Slot-based assignment, backfill of missing schedule_slot_id, branch validation
- **Files**: `src/app/api/coach/assignments/route.ts`, `src/components/coach/assign-groups-client.tsx`, `src/app/(coach)/coach/assign-groups/page.tsx`

### Coach Student Visibility
- **Fixed**: Coach pages now use assignments when available, with branch fallback
- **Files**: `src/app/(coach)/coach/today/page.tsx`, `src/app/(coach)/coach/attendance/page.tsx`, `src/app/(coach)/coach/students/page.tsx`, `src/app/(coach)/coach/page.tsx`

## Technical Debt

### 1. Remove TypeScript `any` Types
- **Estimated Effort**: 4-6 hours
- **Approach**: Systematically replace `as any` with proper types from database schema

### 2. Consolidate Duplicate Code
- **Estimated Effort**: 2-3 hours
- **Approach**: Extract common patterns (e.g., session fetching, auth checks) into reusable utilities

### 3. Improve Error Handling
- **Estimated Effort**: 3-4 hours
- **Approach**: Standardize error responses across all API routes, add better error messages

### 4. Add Unit Tests
- **Estimated Effort**: 16-20 hours
- **Approach**: Add Jest/Vitest tests for critical business logic (pricing, validation, etc.)

### 5. Add E2E Tests
- **Estimated Effort**: 12-16 hours
- **Approach**: Add Playwright tests for critical user flows (booking, payment, check-in)

## Database Migrations Needed

### 1. Backfill schedule_slot_id for Historical Sessions
- **Status**: Not started
- **Priority**: Medium
- **Description**: Migration script to populate `schedule_slot_id` for all existing `booking_sessions`

### 2. Add Indexes for Performance
- **Status**: Not started
- **Priority**: Low
- **Description**: Add database indexes for frequently queried columns (date, status, user_id, etc.)

## Documentation Improvements

### 1. API Documentation
- **Status**: Not started
- **Priority**: Low
- **Description**: Document all API routes with request/response examples

### 2. Component Documentation
- **Status**: Not started
- **Priority**: Low
- **Description**: Add JSDoc comments to complex components

### 3. Architecture Diagrams
- **Status**: Not started
- **Priority**: Low
- **Description**: Create diagrams showing data flow, component hierarchy, and system architecture

## Security Considerations

### 1. Audit RLS Policies
- **Status**: Needs review
- **Priority**: High
- **Description**: Regularly review Row Level Security policies to ensure no data leaks

### 2. Rotate API Keys
- **Status**: Not scheduled
- **Priority**: Medium
- **Description**: Regular rotation of Supabase service role key and SlipOK API key

### 3. Add Rate Limiting
- **Status**: Not implemented
- **Priority**: Medium
- **Description**: Add rate limiting to API routes to prevent abuse

## Performance Optimizations

### 1. Implement Caching
- **Status**: Not implemented
- **Priority**: Medium
- **Description**: Add Redis or similar caching for frequently accessed data

### 2. Optimize Database Queries
- **Status**: Ongoing
- **Priority**: Medium
- **Description**: Review and optimize slow queries, add appropriate indexes

### 3. Image Optimization
- **Status**: Partial
- **Priority**: Low
- **Description**: Further optimize uploaded images (compression, format conversion)

## Monitoring & Observability

### 1. Add Error Tracking
- **Status**: Not implemented
- **Priority**: High
- **Description**: Integrate Sentry or similar for error tracking and alerting

### 2. Add Analytics
- **Status**: Not implemented
- **Priority**: Medium
- **Description**: Add user analytics (Google Analytics, Plausible, etc.)

### 3. Add Uptime Monitoring
- **Status**: Not implemented
- **Priority**: Medium
- **Description**: Set up uptime monitoring for API endpoints

## Third-Party Dependencies

### 1. Review and Update Dependencies
- **Status**: Needs review
- **Priority**: Medium
- **Description**: Regularly update dependencies for security patches and new features

### 2. Evaluate Alternative Libraries
- **Status**: Not started
- **Priority**: Low
- **Description**: Evaluate if there are better alternatives for current libraries (e.g., form validation, state management)
