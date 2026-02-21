# New Athlete Badminton School — Implementation Plan

Implement the full CMS system starting with Phase 1 (Foundation): Next.js project setup, Supabase DB schema, Auth, Layouts, and Landing Page.

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling** | TailwindCSS + shadcn/ui |
| **Icons** | Lucide React |
| **Backend / Auth / DB** | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| **State Management** | SWR (server cache), Zustand (client state) |
| **Deployment** | Vercel |
| **Theme Colors** | `#2748bf`, `#153c85`, `#f57e3b`, `#fff`, `#000` |

---

## 2. User Roles & Permissions

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **User (ผู้ปกครอง/ผู้เรียน)** | สมัครสมาชิกเอง | จองคอร์ส, ชำระเงิน, ดู LV/Ranking, เปลี่ยนวัน/สาขา, กรอกคูปอง, ร้องเรียน |
| **Coach (โค้ช)** | สร้างโดย Super Admin | เช็คชื่อ, กรอก LV, ส่งโปรแกรมสอน, ดูรอบสอน/ชั่วโมง, เช็คอิน+ถ่ายรูป |
| **Head Coach (หัวหน้าโค้ช)** | กำหนดโดย Super Admin (1 สาขา) | ทุกอย่างของ Coach + แบ่งกลุ่มนักเรียนในสาขา |
| **Admin** | สร้างโดย Super Admin | ทุกอย่างของ User + Coach + จัดการนักเรียน/โค้ช (ยกเว้น Setting ระบบ) |
| **Super Admin** | มีอยู่ใน DB | ทุกอย่าง + Setting ระบบ, สร้างคูปอง, ดู Log, รายรับ-รายจ่าย, คำนวณเงินเดือนโค้ช, วันชดเชย |

---

## 3. Database Schema (Supabase / PostgreSQL)

### 3.1 Core Tables

```
── profiles
   id (uuid, FK → auth.users)
   full_name, phone, email, avatar_url
   role (enum: user, coach, head_coach, admin, super_admin)
   created_at, updated_at

── branches
   id, name, slug, address, is_active
   created_at, updated_at

── children (เด็กของผู้ปกครอง)
   id, parent_id (FK → profiles)
   full_name, nickname, date_of_birth, gender, avatar_url
   created_at, updated_at

── course_types (enum table)
   id, name (kids_group, adult_group, private)
   description, max_students, duration_hours

── schedule_templates (รอบเรียนประจำสาขา — ตั้งค่าโดย Super Admin)
   id, branch_id, course_type_id
   day_of_week (0-6), start_time, end_time
   is_active, notes
   created_at, updated_at

── schedule_slots (รอบเรียนจริงรายวัน — generate จาก template)
   id, template_id, branch_id, course_type_id
   date, start_time, end_time
   max_students, current_students
   status (open, full, cancelled)
   created_at

── pricing_tiers (เรทราคา)
   id, course_type_id
   min_sessions, max_sessions
   price_per_session, package_price
   valid_from, valid_to
   created_at

── levels (60 LV)
   id (1-60), name, description
   category (enum: basic, athlete_1, athlete_2, athlete_3)
   min_level, max_level
```

### 3.2 Booking & Payment Tables

```
── bookings (การจองรายเดือน)
   id, user_id (FK → profiles)
   learner_type (enum: self, child)
   child_id (nullable, FK → children)
   branch_id, course_type_id
   month, year
   total_sessions, total_price
   status (pending_payment, paid, verified, cancelled)
   created_at, updated_at

── booking_sessions (วันเรียนแต่ละครั้ง)
   id, booking_id, schedule_slot_id
   date, start_time, end_time, branch_id
   status (scheduled, completed, rescheduled, absent)
   rescheduled_from_id (nullable, self-ref)
   is_makeup (boolean — วันชดเชย)
   created_at, updated_at

── payments
   id, booking_id, user_id
   amount, method (transfer)
   slip_image_url (Supabase Storage)
   status (pending, approved, rejected)
   verified_by (FK → profiles, nullable)
   verified_at, notes
   created_at

── coupons
   id, code (unique), discount_type (fixed, percent)
   discount_value, min_purchase
   max_uses, current_uses
   valid_from, valid_to
   created_by (FK → profiles)
   is_active, created_at

── coupon_usages
   id, coupon_id, user_id, booking_id
   discount_amount, used_at
```

### 3.3 Coach & Teaching Tables

```
── coach_branches (โค้ชประจำสาขา — many-to-many)
   id, coach_id (FK → profiles), branch_id
   is_head_coach (boolean)
   created_at

── coach_assignments (แบ่งกลุ่มนักเรียนให้โค้ช)
   id, coach_id, schedule_slot_id
   assigned_by (FK → profiles)
   created_at

── attendance (เช็คชื่อนักเรียน)
   id, booking_session_id, student_id (profiles/children)
   coach_id, status (present, absent, late)
   checked_at

── coach_checkins (เช็คอินโค้ช + ถ่ายรูป)
   id, coach_id, schedule_slot_id, branch_id
   checkin_time, photo_url (Supabase Storage)
   location_lat, location_lng (optional)
   created_at

── teaching_programs (โปรแกรมสอนรายวัน)
   id, coach_id, schedule_slot_id
   program_content (text/JSON)
   status (draft, submitted, approved, rejected)
   reviewed_by (FK → profiles, nullable)
   reviewed_at, notes
   created_at, updated_at

── student_levels (พัฒนาการ/LV นักเรียน)
   id, student_id (profiles/children)
   student_type (enum: adult, child)
   level (1-60), updated_by (FK → profiles)
   notes, created_at

── coach_teaching_hours (สรุปชั่วโมงสอน — materialized/computed)
   id, coach_id, date
   group_hours, private_hours, total_hours
   created_at
```

### 3.4 System Tables

```
── notifications
   id, user_id, title, message
   type (enum: payment, schedule, reminder, complaint, system)
   is_read, link_url
   created_at

── complaints (ร้องเรียน)
   id, user_id, branch_id
   subject, message
   status (open, in_progress, resolved)
   resolved_by, resolved_at
   created_at

── activity_logs (Log ระบบ)
   id, user_id, action, entity_type, entity_id
   details (JSONB), ip_address
   created_at

── system_settings
   id, key, value (JSONB)
   updated_by, updated_at
```

### 3.5 Key Relationships Diagram

```
profiles ─┬─< children
           ├─< bookings ─< booking_sessions ─> schedule_slots
           ├─< payments
           ├─< coach_branches ─> branches
           ├─< coach_assignments ─> schedule_slots
           ├─< student_levels
           ├─< complaints
           └─< activity_logs

branches ─< schedule_templates ─> course_types
branches ─< schedule_slots

bookings ─< booking_sessions
bookings ─< payments
bookings ─< coupon_usages ─> coupons
```

---

## 4. Business Logic — Pricing Engine

### 4.1 เด็ก (กลุ่ม) — คิดรายเดือน, รีเซ็ตทุกเดือน

| ครั้ง/เดือน | ราคาแพ็กเกจ | เฉลี่ย/ครั้ง |
|-------------|------------|-------------|
| 1 (รายครั้ง) | 700 | 700 |
| 2-6 | 2,500 | 625 |
| 7-10 | 4,000 | 500 |
| 11-14 | 5,200 | 433 |
| 15-18 | 6,500 | 406 |
| 19+ | 7,000 | 350 |

**กฎพี่น้อง:** รวมจำนวนครั้งของลูกทุกคนภายใต้ parent เดียวกัน แล้วใช้เรทรวม
- เช่น ลูก 2 คน × 4 ครั้ง = 8 ครั้ง → ใช้เรท 4,000 บาท

**กฎเกินจำนวน:** ถ้าลงเพิ่มระหว่างเดือน → คิดเพิ่มตามเรทเฉลี่ยของแพ็กเกจเดิม

### 4.2 ผู้ใหญ่ (กลุ่ม)

| ครั้ง | ราคา | หมดอายุ |
|------|------|--------|
| 1 (รายครั้ง) | 600 | - |
| 10 | 5,500 | 10 เดือน |
| 16 | 8,000 | 10 เดือน |

### 4.3 Private

| แบบ | ราคา |
|-----|------|
| รายชั่วโมง | 900/ชม. |
| 10 ชั่วโมง | 8,000 (800/ชม.) |

### 4.4 Coach Overtime

| เงื่อนไข | เรท |
|----------|-----|
| > 25 ชม./สัปดาห์ (Private) | 400 บาท/ชม. |
| > 25 ชม./สัปดาห์ (Group) | 200 บาท/ชม. |

---

## 5. Feature Modules & Pages

### 5.1 Public Pages (ไม่ต้อง Login)

| Page | Description |
|------|-------------|
| **Landing Page** (`/`) | แนะนำโรงเรียน, สาขา, คอร์ส, CTA สมัคร |
| **Ranking** (`/ranking`) | Leaderboard แยกเด็ก/ผู้ใหญ่ ดู LV ทั้งหมด |
| **Login/Register** (`/auth`) | Supabase Auth (email/phone) |

### 5.2 User (ผู้ปกครอง/ผู้เรียน) — `/dashboard`

| Feature | Path |
|---------|------|
| Dashboard Home | `/dashboard` |
| จัดการข้อมูลลูก | `/dashboard/children` |
| จองคอร์สเรียน | `/dashboard/booking` |
| ประวัติการจอง/ชำระเงิน | `/dashboard/history` |
| ตารางเรียน | `/dashboard/schedule` |
| เปลี่ยนวัน/สาขา | `/dashboard/reschedule` |
| ดู LV & Ranking | `/dashboard/progress` |
| กรอกคูปอง | (ใน booking flow) |
| ร้องเรียน | `/dashboard/complaint` |
| แจ้งเตือน | `/dashboard/notifications` |

### 5.3 Coach — `/coach`

| Feature | Path |
|---------|------|
| Dashboard | `/coach` |
| รอบสอนวันนี้ | `/coach/today` |
| เช็คชื่อนักเรียน | `/coach/attendance` |
| เช็คอิน + ถ่ายรูป | `/coach/checkin` |
| กรอก LV นักเรียน | `/coach/levels` |
| ส่งโปรแกรมสอน | `/coach/programs` |
| รายชื่อนักเรียน | `/coach/students` |
| สรุปชั่วโมงสอน | `/coach/hours` |

### 5.4 Head Coach — `/coach` (เพิ่มเติม)

| Feature | Path |
|---------|------|
| แบ่งกลุ่มนักเรียน | `/coach/assign-groups` |

### 5.5 Admin / Super Admin — `/admin`

| Feature | Path |
|---------|------|
| Dashboard (ภาพรวม) | `/admin` |
| จัดการสาขา | `/admin/branches` |
| จัดการรอบเรียน (Setting) | `/admin/schedules` |
| จัดการนักเรียน/ผู้ปกครอง | `/admin/users` |
| จองคอร์สแทนผู้ปกครอง | `/admin/booking` |
| วันชดเชย (ไม่คิดเงิน) | `/admin/makeup` |
| จัดการโค้ช | `/admin/coaches` |
| กำหนดหัวหน้าโค้ช | `/admin/coaches/head` |
| ตรวจสอบการชำระเงิน | `/admin/payments` |
| สร้าง/จัดการคูปอง | `/admin/coupons` |
| คำนวณเงินเดือนโค้ช | `/admin/payroll` |
| รายรับ-รายจ่าย | `/admin/finance` |
| เช็คอินโค้ช (ตรวจสอบ) | `/admin/coach-checkins` |
| ร้องเรียน | `/admin/complaints` |
| Notification Center | `/admin/notifications` |
| Activity Log | `/admin/logs` |
| System Settings | `/admin/settings` |

---

## 6. Notification System

| Event | ผู้รับ | ช่องทาง |
|-------|-------|---------|
| มีการจองใหม่ | Admin/Super Admin | In-app |
| แนบสลิปชำระเงิน | Admin/Super Admin | In-app |
| ยืนยันการชำระเงิน | User | In-app |
| เปลี่ยนวัน/สาขา | Admin + Coach | In-app |
| ร้องเรียนใหม่ | Admin/Super Admin | In-app (สีแดง) |
| นักเรียนไม่ต่อคอร์ส ≥85% | Admin | In-app (สีแดง) |
| นักเรียนไม่ต่อคอร์ส ≥80% | Admin | In-app (สีเหลือง) |
| นักเรียนไม่ต่อคอร์ส ≥70% | Admin | In-app (สีเขียว) |
| คลาสมีคนลง 1 คน | Admin | In-app (สีแดง) |
| คลาสมีคนลง 2 คน | Admin | In-app (สีเหลือง) |
| คลาสมีคนลง >2 คน | Admin | In-app (สีเขียว) |
| เตือนลูกค้าเดือนก่อนไม่ลง | User | In-app |
| เตือนลูกค้ากลับมาเรียน | User | In-app |
| โปรแกรมสอนรอตรวจ | Super Admin | In-app |

---

## 7. Row Level Security (RLS) Strategy

| Table | User | Coach | Head Coach | Admin | Super Admin |
|-------|------|-------|------------|-------|-------------|
| profiles | own | own + students | own + branch students | all | all |
| children | own | read assigned | read branch | all | all |
| bookings | own | read assigned | read branch | all CRUD | all CRUD |
| payments | own | - | - | all | all |
| attendance | read own | own CRUD | branch CRUD | all CRUD | all CRUD |
| student_levels | read own | own CRUD | branch CRUD | all CRUD | all CRUD |
| schedule_slots | read | read | read | read | all CRUD |
| activity_logs | - | - | - | - | read all |

---

## 8. Development Phases

### Phase 1 — Foundation (สัปดาห์ 1-2)
1. สร้าง Next.js project + TailwindCSS + shadcn/ui
2. ตั้งค่า Supabase (Auth, DB, Storage)
3. สร้าง Database schema ทั้งหมด + RLS policies
4. สร้าง Auth flow (Register/Login)
5. สร้าง Layout system (Public, User, Coach, Admin)
6. Landing Page

### Phase 2 — User Flow (สัปดาห์ 3-4)
7. หน้าจัดการข้อมูลลูก (Children CRUD)
8. Booking Flow: เลือกประเภท → สาขา → วัน/เวลา → คำนวณราคา
9. Pricing Engine (รวมกฎพี่น้อง, เกินจำนวน)
10. Payment Flow: แนบสลิป → รอตรวจสอบ
11. ตารางเรียน + เปลี่ยนวัน/สาขา (กฎ 24 ชม.)
12. Coupon system

### Phase 3 — Coach Flow (สัปดาห์ 5-6)
13. Coach Dashboard
14. เช็คชื่อนักเรียน
15. เช็คอิน + ถ่ายรูป
16. กรอก LV นักเรียน
17. ส่งโปรแกรมสอน
18. สรุปชั่วโมงสอน
19. Head Coach: แบ่งกลุ่มนักเรียน

### Phase 4 — Admin Flow (สัปดาห์ 7-9)
20. Admin Dashboard (ภาพรวมสาขา, จำนวนคนเรียน/วัน)
21. จัดการสาขา + รอบเรียน (Settings)
22. จัดการ User/Coach
23. จองแทนผู้ปกครอง + วันชดเชย
24. ตรวจสอบการชำระเงิน
25. คำนวณเงินเดือนโค้ช (OT 25 ชม.)
26. รายรับ-รายจ่าย
27. สร้างคูปอง

### Phase 5 — Notification & Polish (สัปดาห์ 10)
28. Notification system (Supabase Realtime)
29. ร้องเรียน system
30. Retention alerts (ไม่ต่อคอร์ส, คลาสคนน้อย)
31. Activity Log
32. Ranking page (แยกเด็ก/ผู้ใหญ่)

### Phase 6 — Testing & Deploy (สัปดาห์ 11-12)
33. E2E testing (critical flows)
34. Performance optimization
35. Responsive testing ทุกอุปกรณ์
36. Deploy to Vercel
37. UAT + Bug fixes

---

## 9. Key Architecture Decisions

- **App Router (Next.js 14):** ใช้ Server Components เป็นหลัก, Client Components เฉพาะที่จำเป็น
- **Supabase Auth:** ใช้ email/phone login, role เก็บใน `profiles.role`
- **Middleware:** ตรวจ auth + role-based redirect ที่ `middleware.ts`
- **Pricing Logic:** คำนวณฝั่ง server (Edge Function / Server Action) เพื่อป้องกันการแก้ไข
- **Schedule Generation:** Cron job สร้าง `schedule_slots` ล่วงหน้า 2 เดือนจาก `schedule_templates`
- **File Upload:** Supabase Storage สำหรับ slip, coach checkin photos, avatars
- **Realtime:** Supabase Realtime สำหรับ notifications
- **Activity Log:** Supabase Database Functions (triggers) บันทึกทุก action

---

## 10. Project Structure

```
src/
├── app/
│   ├── (public)/           # Landing, Ranking, Auth
│   │   ├── page.tsx        # Landing Page
│   │   ├── ranking/
│   │   └── auth/
│   ├── (dashboard)/        # User pages
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── children/
│   │   │   ├── booking/
│   │   │   ├── history/
│   │   │   ├── schedule/
│   │   │   ├── reschedule/
│   │   │   ├── progress/
│   │   │   ├── complaint/
│   │   │   └── notifications/
│   ├── (coach)/            # Coach pages
│   │   ├── layout.tsx
│   │   └── coach/
│   │       ├── page.tsx
│   │       ├── today/
│   │       ├── attendance/
│   │       ├── checkin/
│   │       ├── levels/
│   │       ├── programs/
│   │       ├── students/
│   │       ├── hours/
│   │       └── assign-groups/
│   ├── (admin)/            # Admin pages
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── page.tsx
│   │       ├── branches/
│   │       ├── schedules/
│   │       ├── users/
│   │       ├── booking/
│   │       ├── makeup/
│   │       ├── coaches/
│   │       ├── payments/
│   │       ├── coupons/
│   │       ├── payroll/
│   │       ├── finance/
│   │       ├── coach-checkins/
│   │       ├── complaints/
│   │       ├── notifications/
│   │       ├── logs/
│   │       └── settings/
│   ├── api/                # API routes
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Navbar, Sidebar, Footer
│   ├── booking/            # Booking flow components
│   ├── schedule/           # Calendar, time slot pickers
│   ├── dashboard/          # Dashboard widgets
│   └── shared/             # Shared components
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Browser client
│   │   ├── server.ts       # Server client
│   │   ├── admin.ts        # Service role client
│   │   └── middleware.ts    # Auth middleware helper
│   ├── pricing.ts          # Pricing engine
│   ├── scheduling.ts       # Schedule logic
│   ├── notifications.ts    # Notification helpers
│   └── utils.ts            # General utilities
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript types
├── constants/              # Branch data, pricing tiers, levels
└── middleware.ts            # Next.js middleware (auth guard)
```

---

## 11. Future-Proofing (ตามที่วางแผนไว้)

ออกแบบ schema ให้รองรับการขยายในอนาคต:
- **ระบบจองสนาม:** เพิ่ม `courts`, `court_bookings` tables
- **ร้านขายอุปกรณ์:** เพิ่ม `products`, `inventory`, `orders` tables
- **ก๊วนแบต:** เพิ่ม `groups`, `group_members`, `group_sessions` tables
- **สต๊อกสินค้า:** เพิ่ม `stock_items`, `stock_transactions` per branch

ใช้ `branch_id` เป็น FK ทุกที่เพื่อรองรับ multi-branch operations

---

## 12. Security Checklist

- [x] RLS policies ทุก table
- [x] Server-side pricing calculation (ป้องกัน client manipulation)
- [x] Supabase Auth + JWT verification ใน middleware
- [x] Role-based access control ทุก route
- [x] File upload validation (type, size)
- [x] Activity logging ทุก sensitive action
- [x] Environment variables สำหรับ keys (ไม่ hardcode)
- [x] Input sanitization ทุก form
