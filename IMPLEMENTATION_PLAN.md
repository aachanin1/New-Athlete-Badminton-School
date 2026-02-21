# New Athlete Badminton School — Implementation Plan

> อัปเดตล่าสุด: 21 ก.พ. 2569 (หลัง Phase 2B เสร็จ — Admin ครบ 16 หน้า, Coach 9 หน้า, User 11 หน้า)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS, shadcn/ui, Lucide React |
| Backend | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Payment | SlipOK API (ตรวจสลิปอัตโนมัติ) |
| Deployment | Vercel |
| Theme Colors | `#2748bf`, `#153c85`, `#f57e3b`, `#fff`, `#000` |

---

## สถานะภาพรวม

| ส่วน | มี Logic จริง | Placeholder | สถานะ |
|------|:---:|:---:|--------|
| **User (Dashboard)** | 11 หน้า | 0 | ✅ ครบสมบูรณ์ |
| **Admin Core** | 7 หน้า (Dashboard, Coaches, Users, Payments, Booking, Coupons, Complaints) | 0 | ✅ ครบสมบูรณ์ |
| **Admin Advanced** | 9 หน้า (Finance, Payroll, Coach Checkins, Makeup, Branches, Schedules, Notifications, Logs, Settings) | 0 | ✅ ครบสมบูรณ์ |
| **Coach** | 9 หน้า (Dashboard, Today, Attendance, Checkin, Levels, Programs, Students, Hours, Assign Groups) | 0 | ✅ ครบสมบูรณ์ |
| **API** | 17 routes | 0 | ✅ ทำงานได้ |

### API Routes ที่มี

| Route | หน้าที่ |
|-------|--------|
| `api/verify-slip` | ตรวจสลิป SlipOK |
| `api/validate-coupon` | ตรวจคูปอง |
| `api/health` | Health check |
| `api/admin/coaches` | CRUD โค้ช + กำหนดสาขา |
| `api/admin/users` | เปลี่ยน role ผู้ใช้ |
| `api/admin/payments` | Approve/Reject สลิป |
| `api/admin/booking` | จองแทนผู้ใช้ + auto-verify |
| `api/admin/coupons` | CRUD คูปอง |
| `api/admin/complaints` | เปลี่ยนสถานะร้องเรียน |
| `api/coach/attendance` | เช็คชื่อนักเรียน (มา/ขาด/สาย) |
| `api/coach/checkin` | เช็คอินโค้ช + อัปโหลดรูป + GPS |
| `api/coach/levels` | กรอก LV นักเรียน (1-60) |
| `api/coach/programs` | สร้าง/ส่งโปรแกรมสอน |
| `api/admin/branches` | CRUD สาขา |
| `api/admin/makeup` | สร้างวันชดเชย (ฟรี) |
| `api/admin/notifications` | ส่งแจ้งเตือนถึง User |
| `api/admin/settings` | CRUD System Settings |

---

## Development Phases

### Phase 1 — Foundation & User Booking ✅ เสร็จสมบูรณ์

| # | Feature | Status | Files หลัก |
|---|---------|--------|-----------|
| 1.1 | **Landing Page** — แนะนำ New Athlete School, เมนูต่างๆ | ✅ Done | `src/app/page.tsx` |
| 1.2 | **Auth** — สมัครสมาชิก / เข้าสู่ระบบ (Supabase Auth) | ✅ Done | `src/app/auth/login`, `register` |
| 1.3 | **Database Schema** — ครบทุก table (30+ tables), RLS policies, triggers, seed data | ✅ Done | `supabase/schema.sql` |
| 1.4 | **Dashboard Home** — หน้าหลักผู้ใช้, ปฏิทินแสดงวันเรียน | ✅ Done | `src/app/(dashboard)/dashboard/page.tsx` |
| 1.5 | **จัดการลูก (Children)** — เพิ่ม/แก้ไข ข้อมูลลูก, อัปโหลดรูปโปรไฟล์ | ✅ Done | `src/app/(dashboard)/dashboard/children/` |
| 1.6 | **ระบบจองเรียน (Booking)** — 4 ขั้นตอน: เลือกคอร์ส → ผู้เรียน → สาขา → ปฏิทิน | ✅ Done | `src/components/dashboard/booking-client.tsx` |
| 1.7 | **รอบเรียน 7 สาขา** — ข้อมูลรอบเรียนครบทั้ง 7 สาขา (เด็ก/ผู้ใหญ่/Private) | ✅ Done | `src/lib/branch-schedules.ts` |
| 1.8 | **ระบบราคา** — เรทเด็ก (6 tiers), ผู้ใหญ่ (3 tiers), Private (900/ชม.) | ✅ Done | `src/lib/pricing.ts` |
| 1.9 | **กฎพี่น้อง (Sibling Pricing)** — รวมครั้งเรียนลูกทุกคนในเดือนเดียวกัน ได้เรทถูกกว่า | ✅ Done | `booking-client.tsx` |
| 1.10 | **คูปองส่วนลด** — กรอกโค้ดคูปองเพื่อลดราคา | ✅ Done | `src/app/api/validate-coupon/` |
| 1.11 | **ชำระเงิน & SlipOK** — อัปโหลดสลิป → ระบบตรวจอัตโนมัติ → approved หรือรอ Admin | ✅ Done | `src/app/api/verify-slip/`, `src/lib/slipok.ts` |
| 1.12 | **ประวัติจอง (History)** — ดูรายละเอียดจอง, สถานะ, สลิป, ยกเลิก | ✅ Done | `src/app/(dashboard)/dashboard/history/` |
| 1.13 | **ตารางเรียน (Schedule)** — ปฏิทินรายเดือน แสดงวันเรียน + จำนวนครั้งต่อคน | ✅ Done | `src/app/(dashboard)/dashboard/schedule/` |
| 1.14 | **เปลี่ยนวัน/สาขา (Reschedule)** — เปลี่ยนได้ 24 ชม.ล่วงหน้า, ล็อกเดือนเดียวกัน (ยกเว้น Admin) | ✅ Done | `src/app/(dashboard)/dashboard/reschedule/` |
| 1.15 | **ดูพัฒนาการ (Progress)** — ดู LV ของลูก/ตัวเอง | ✅ Done | `src/app/(dashboard)/dashboard/progress/` |
| 1.16 | **ร้องเรียน (Complaint)** — ส่งเรื่องร้องเรียนผ่านระบบ | ✅ Done | `src/app/(dashboard)/dashboard/complaint/` |
| 1.17 | **Notifications** — ระบบแจ้งเตือนในแดชบอร์ด | ✅ Done | `src/app/(dashboard)/dashboard/notifications/` |
| 1.18 | **Ranking** — ดู Ranking นักเรียน แยกเด็ก/ผู้ใหญ่ แยกสาขา/รวม | ✅ Done | `src/app/ranking/` |

---

### Phase 1.5 — User Refinements ✅ เสร็จสมบูรณ์

| # | Feature | Status | รายละเอียด |
|---|---------|--------|-----------|
| R1 | **Private course ทุกสาขา** — 09:00-17:00 + 21:00-23:00 แบ่ง 1 ชม. อัตโนมัติ | ✅ Done | ทุก 7 สาขา ทุกวัน |
| R2 | **Private multi-select ผู้เรียน** — เลือกได้หลายคน (ตัวเอง + ลูก) เรียนรอบเวลาเดียวกัน | ✅ Done | Coach ดูได้ว่าใครมา |
| R3 | **Reschedule ล็อกเดือน** — ผู้ใช้เปลี่ยนวันได้เฉพาะเดือนที่จอง, Admin ข้ามเดือนได้ | ✅ Done | |
| R4 | **ยกเลิกจอง — Modal ค้าง** — กดลบวันเรียนแล้ว modal ไม่ปิด, คำนวณราคาใหม่ทันที | ✅ Done | |
| R5 | **Per-child session counts** — แสดงจำนวนครั้งต่อคนในหน้า History & Schedule | ✅ Done | |
| R6 | **อัปโหลดรูปโปรไฟล์เด็ก** — เปลี่ยนรูปลูกได้ | ✅ Done | Supabase Storage |
| R7 | **Calendar per-child colored dots** — ปฏิทินแสดงจุดสีแยกตามเด็กแต่ละคน | ✅ Done | |
| R8 | **Pending payment banner** — แสดงรายชื่อ + จำนวนครั้ง | ✅ Done | |
| R9 | **SlipOK auto-approve** — สลิปจริง+ยอดตรง → approved อัตโนมัติ, ไม่ตรง → รอ Admin | ✅ Done | Test mode พร้อม |

---

### Phase 2A — Admin Core ✅ เสร็จสมบูรณ์

| # | Feature | Status | Files หลัก |
|---|---------|--------|-----------|
| 2A.1 | **จัดการ Coaches** — สร้าง account โค้ช, กำหนด role (coach/head_coach), กำหนดสาขา | ✅ Done | `admin/coaches/page.tsx`, `api/admin/coaches/route.ts`, `components/admin/coaches-client.tsx` |
| 2A.2 | **จัดการ Users** — ดูรายชื่อผู้ใช้ทั้งหมด, เปลี่ยน role, ดูข้อมูลลูก | ✅ Done | `admin/users/page.tsx`, `api/admin/users/route.ts`, `components/admin/users-client.tsx` |
| 2A.3 | **Payments** — ดูสลิปทั้งหมด, approve/reject กรณี SlipOK ไม่ผ่าน, ดูรูปสลิป | ✅ Done | `admin/payments/page.tsx`, `api/admin/payments/route.ts`, `components/admin/payments-client.tsx` |
| 2A.4 | **จองแทนผู้ใช้ (Admin Booking)** — เลือก User → เลือกคอร์ส → เลือกผู้เรียน → สาขา → ปฏิทิน → สรุป + auto-verify | ✅ Done | `admin/booking/page.tsx`, `api/admin/booking/route.ts`, `components/admin/admin-booking-client.tsx` |
| 2A.5 | **Coupons** — สร้าง/แก้ไข/ปิดคูปอง, ดูการใช้งาน, toggle active | ✅ Done | `admin/coupons/page.tsx`, `api/admin/coupons/route.ts`, `components/admin/coupons-client.tsx` |
| 2A.6 | **Complaints** — ดูเรื่องร้องเรียน, เปลี่ยนสถานะ (open→in_progress→resolved) | ✅ Done | `admin/complaints/page.tsx`, `api/admin/complaints/route.ts`, `components/admin/complaints-client.tsx` |
| 2A.7 | **Admin Dashboard** — สรุปภาพรวม: จองใหม่, รอชำระ, ร้องเรียน, จำนวนนักเรียน, รายได้ | ✅ Done | `admin/page.tsx` (real data, parallel queries) |

---

### Phase 3 — Coach Portal ✅ เสร็จสมบูรณ์

| # | Feature | Status | Files หลัก |
|---|---------|--------|-----------|
| 3.1 | **Coach Dashboard** — ภาพรวม: รอบสอนวันนี้, สาขาที่สอน, ชั่วโมงสัปดาห์/เดือน, สถานะเช็คอิน, Quick actions | ✅ Done | `coach/page.tsx` |
| 3.2 | **ตารางสอนวันนี้ (Today)** — ดูรอบสอนจัดกลุ่มตามเวลา, รายชื่อนักเรียน, เด็ก/ผู้ใหญ่, ผู้ปกครอง | ✅ Done | `coach/today/page.tsx` |
| 3.3 | **เช็คชื่อนักเรียน (Attendance)** — ปุ่ม มา/สาย/ขาด ต่อนักเรียน, บันทึกผ่าน API | ✅ Done | `coach/attendance/page.tsx`, `api/coach/attendance/route.ts`, `components/coach/attendance-client.tsx` |
| 3.4 | **เช็คอินโค้ช (Checkin)** — ถ่ายรูป + GPS + เลือกสาขา, ดูประวัติเช็คอินวันนี้ | ✅ Done | `coach/checkin/page.tsx`, `api/coach/checkin/route.ts`, `components/coach/checkin-client.tsx` |
| 3.5 | **กรอก LV/พัฒนาการ (Levels)** — ค้นหานักเรียน, กรอก LV 1-60, แสดง category, หมายเหตุ | ✅ Done | `coach/levels/page.tsx`, `api/coach/levels/route.ts`, `components/coach/levels-client.tsx` |
| 3.6 | **โปรแกรมสอน (Programs)** — สร้าง/ส่งโปรแกรม, สถานะ draft/submitted/approved/rejected | ✅ Done | `coach/programs/page.tsx`, `api/coach/programs/route.ts`, `components/coach/programs-client.tsx` |
| 3.7 | **ดูรายชื่อนักเรียน (Students)** — นักเรียนในสาขาทั้งหมด, LV, ประเภทคอร์ส, เบอร์โทร | ✅ Done | `coach/students/page.tsx` |
| 3.8 | **ชั่วโมงสอน (Hours)** — สรุป สัปดาห์/เดือน, แยก กลุ่ม/Private, OT detection (>25 ชม.) | ✅ Done | `coach/hours/page.tsx` |
| 3.9 | **แบ่งกลุ่มนักเรียน (Assign Groups)** — หัวหน้าโค้ช: ดูโค้ชในสาขา, จำนวน active bookings | ✅ Done | `coach/assign-groups/page.tsx` (head_coach only) |

---

### Phase 2B — Admin Advanced ✅ เสร็จสมบูรณ์

| # | Feature | Status | Files หลัก |
|---|---------|--------|------------|
| 2B.1 | **Finance** — สรุปรายรับ-รายจ่าย รายเดือน-ปี, แยกสาขา, แยกคอร์ส, กราฟแท่ง | ✅ Done | `admin/finance/page.tsx`, `components/admin/finance-client.tsx` |
| 2B.2 | **Payroll** — คำนวณเงินเดือนโค้ช: รวมชั่วโมง, เช็คเกิน 25 ชม./สัปดาห์, OT Private 400/ชม., OT Group 200/ชม., Weekly breakdown | ✅ Done | `admin/payroll/page.tsx`, `components/admin/payroll-client.tsx` |
| 2B.3 | **Coach Checkins** — Admin ดูเช็คอินโค้ช + รูปถ่าย + GPS, กรองสาขา/วันที่, ดูรูปขยาย + Google Maps | ✅ Done | `admin/coach-checkins/page.tsx`, `components/admin/coach-checkins-client.tsx` |
| 2B.4 | **Makeup (วันชดเชย)** — Super Admin เลือกวันชดเชยให้นักเรียน ไม่คิดเงิน, เปลี่ยนสาขาได้ | ✅ Done | `admin/makeup/page.tsx`, `api/admin/makeup/route.ts`, `components/admin/makeup-client.tsx` |
| 2B.5 | **Schedules** — ดูตารางรอบเรียนทุกสาขา แยกประเภทคอร์ส, แสดง time slots ทุกวัน | ✅ Done | `admin/schedules/page.tsx`, `components/admin/schedules-client.tsx` |
| 2B.6 | **Branches** — ดู/แก้ไข/เพิ่มสาขา, toggle is_active, แสดงจำนวนโค้ชและจอง | ✅ Done | `admin/branches/page.tsx`, `api/admin/branches/route.ts`, `components/admin/branches-client.tsx` |
| 2B.7 | **Notifications** — ดูแจ้งเตือนทั้งระบบ, ส่งแจ้งเตือนถึง User เฉพาะหรือทุกคน, กรองประเภท | ✅ Done | `admin/notifications/page.tsx`, `api/admin/notifications/route.ts`, `components/admin/notifications-admin-client.tsx` |
| 2B.8 | **Activity Logs** — ดู Log ทั้งระบบ, กรอง entity/วันที่, ดู JSON details | ✅ Done | `admin/logs/page.tsx`, `components/admin/logs-client.tsx` |
| 2B.9 | **Settings** — ดู/แก้ไข/เพิ่ม System Settings (key-value JSON) | ✅ Done | `admin/settings/page.tsx`, `api/admin/settings/route.ts`, `components/admin/settings-client.tsx` |

---

### Phase 5 — Notification & Alerts System ⬅️ ทำตอนนี้

> ตาม Requirement เพิ่มเติม — ระบบแจ้งเตือนอัจฉริยะ

| # | Feature | Status | Requirement |
|---|---------|--------|-------------|
| 5.1 | **Notifly: นักเรียนไม่ต่อคอร์ส** — ≥85% ตัวแดง, ≥80% ตัวเหลือง, ≥70% ตัวเขียว | 🔲 TODO | Requirement เพิ่มเติม |
| 5.2 | **Notifly: คลาสคนน้อย** — 1 คน สีแดง, 2 คน สีเหลือง, >2 คน สีเขียว | 🔲 TODO | Requirement เพิ่มเติม |
| 5.3 | **แจ้งเตือนลูกค้าเดือนก่อนไม่ลง** — เตือนให้กลับมาเรียน | 🔲 TODO | "แจ้งเตือนตามลูกค้าที่เดือนที่แล้วยังไม่ลงเรียน" |
| 5.4 | **แจ้งเตือนลูกค้ากลับมาเรียน** — ติดตามลูกค้าเก่า | 🔲 TODO | "แจ้งเตือนลูกค้าเดือนที่ผ่านมาให้กลับมาเรียน" |
| 5.5 | **Notification events ครบทุก event** — จองใหม่, แนบสลิป, ยืนยันชำระ, เปลี่ยนวัน, ร้องเรียน, โปรแกรมสอนรอตรวจ | 🔲 TODO | ดู Notification System table |

### Notification Events (ตาม Requirement)

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

### Phase 6 — Bug Fixes & Requirement Alignment 🔲

| # | Issue | Status | รายละเอียด |
|---|-------|--------|-----------|
| 6.1 | **Level categories ไม่ตรง Requirement** | 🔲 TODO | Code ใช้ Basic(1-15), Ath1(16-30), Ath2(31-45), Ath3(46-60) แต่ Requirement ระบุ: ชุดพื้นฐาน(1-30), ชุดนักกีฬา1(31-39), ชุดนักกีฬา2(40-43), ชุดนักกีฬา3(44-60) |
| 6.2 | **โค้ชดูชั่วโมงเรียนของนักเรียน** | 🔲 TODO | Requirement: "ดูชั่วโมงการเรียนของนักเรียนทั้งหมดได้ ว่าเรียนไปกี่ชั่วโมงแล้ว" — ปัจจุบันหน้า students มีแค่ Level |
| 6.3 | **แถบสถานะตอนเลือกจำนวนครั้ง** | ⚠️ ตรวจสอบ | Requirement: แสดงอิโมจิ+ข้อความ เช่น 4 ครั้ง = ขั้นต่ำ, 8 ครั้ง = ออกกำลังกาย, 12 ครั้ง = เริ่มเป็นนักกีฬา ฯลฯ |

---

### Phase 7 — Future Features 🔮 วางแผนอนาคต

| # | Feature | Status | รายละเอียด |
|---|---------|--------|-----------|
| 7.1 | **ระบบแนะนำ LV** — คำนวณว่าลูกต้องเรียนกี่ครั้งถึง LV ไหน | 🔮 Future | Requirement เพิ่มเติม ครั้งที่ 3 |
| 7.2 | **ผู้ใหญ่ 10 เดือน** — ซื้อ 10/16 ครั้ง ใช้ได้ภายใน 10 เดือน (ไม่จำกัดรายเดือน) | 🔮 Future | ต้องออกแบบ Logic ใหม่จากปัจจุบัน |
| 7.3 | **ระบบจองสนาม** — จองสนามแบดมินตัน | 🔮 Future | เตรียม schema: courts, court_bookings |
| 7.4 | **ร้านขายอุปกรณ์** — สต๊อกสินค้า, ลูกแบด, เสื้อ, อุปกรณ์ | 🔮 Future | เตรียม schema: products, inventory, orders |
| 7.5 | **Application ก๊วนแบต** — ระบบหาคู่ตี | 🔮 Future | เตรียม schema: groups, group_members |

---

### Phase 8 — Testing & Deploy 🔲

| # | Feature | Status |
|---|---------|--------|
| 8.1 | E2E testing (critical flows: จอง, ชำระ, เช็คชื่อ) | 🔲 TODO |
| 8.2 | Performance optimization | 🔲 TODO |
| 8.3 | Responsive testing ทุกอุปกรณ์ | 🔲 TODO |
| 8.4 | Deploy to Vercel | 🔲 TODO |
| 8.5 | UAT + Bug fixes | 🔲 TODO |

---

## ลำดับการทำงาน (Execution Order)

```
Phase 1 (Foundation & User Booking)          ✅ เสร็จ
Phase 1.5 (User Refinements)                 ✅ เสร็จ
Phase 2A (Admin Core)                        ✅ เสร็จ
Phase 3 (Coach Portal)                       ✅ เสร็จ

Phase 2B (Admin Advanced)                    ✅ เสร็จ

Phase 5 (Notification & Alerts)              ⬅️ ทำตอนนี้
├── Notifly สี (ไม่ต่อคอร์ส/คลาสคนน้อย)
├── แจ้งเตือนลูกค้าเก่ากลับมา
└── Notification events ครบทุก event

Phase 6 (Bug Fixes & Requirement Alignment)
├── แก้ Level categories ให้ตรง Requirement
├── เพิ่มชั่วโมงเรียนนักเรียนในหน้าโค้ช
└── แถบสถานะตอนเลือกจำนวนครั้ง

Phase 7 (Future Features)
├── ระบบแนะนำ LV
├── ผู้ใหญ่ 10 เดือน
├── จองสนาม, ร้านขาย, ก๊วนแบต
└── สต๊อกสินค้าแต่ละสาขา

Phase 8 (Testing & Deploy)
├── E2E testing
├── Performance + Responsive
└── Deploy Vercel + UAT
```

---

## Requirement Mapping — ตรวจสอบครบถ้วน

### User (ผู้ปกครอง/ผู้เรียน) — อ้างอิง CMS Requirement

| Requirement | สถานะ | หมายเหตุ |
|-------------|-------|----------|
| สมัครสมาชิก / เข้าสู่ระบบ | ✅ | Supabase Auth |
| เลือกว่าจะเรียนแบบไหน เด็ก/ผู้ใหญ่/ทั้ง 2 | ✅ | booking step 1 |
| กรอกข้อมูลลูก มากกว่า 1 คน | ✅ | children CRUD |
| ถ้าผู้ใหญ่ ดึงข้อมูลที่สมัครมา ไม่ต้องกรอกซ้ำ | ✅ | booking step 2 |
| เลือก แบบกลุ่ม หรือ ส่วนตัว | ✅ | booking step 1 |
| เลือก สาขา | ✅ | booking step 3 |
| เลือก วันที่ต้องการเรียน แสดงเป็นรอบเรียนของสาขานั้น เฉพาะเดือนนั้น | ✅ | booking step 4 (calendar) |
| ระบบคำนวณเงินตามเรทราคา | ✅ | pricing.ts |
| กดบันทึกวันเรียน และ ชำระเงิน | ✅ | |
| แนบสลิปเข้าระบบ | ✅ | SlipOK + Storage |
| ระบบแสดงวัน-เวลาที่ต้องเรียน | ✅ | schedule page |
| เปลี่ยน วัน/รอบเรียนได้ด้วยตนเอง ภายในเดือน ล่วงหน้า 24 ชม. | ✅ | reschedule |
| เปลี่ยนสาขาเองได้ | ✅ | reschedule |
| คิดเรทพี่น้อง (รวมจำนวนครั้ง) | ✅ | sibling pricing |
| กฎเกินจำนวน: คิดเพิ่มตามเรทเฉลี่ย | ✅ | incremental pricing |
| แถบสถานะ+อิโมจิ ตอนเลือกจำนวนครั้ง | ⚠️ ต้องตรวจ | Phase 6.3 |
| ดู LV/พัฒนาการของตนเอง | ✅ | progress page |
| กรอกคูปองส่วนลด | ✅ | validate-coupon API |
| ดู Ranking แยกเด็ก/ผู้ใหญ่ แยกสาขา/รวม | ✅ | ranking page |
| ร้องเรียน | ✅ | complaint page |
| จองข้ามเดือนไม่นับรวม | ✅ | monthly reset |

### โค้ช — อ้างอิง CMS Requirement

| Requirement | สถานะ | หมายเหตุ |
|-------------|-------|----------|
| เข้าสู่ระบบตาม Username/Password ที่ Super User มอบให้ | ✅ | admin สร้าง account |
| หัวหน้าโค้ช แบ่งกลุ่มเด็ก | ✅ | assign-groups (head_coach only) |
| หัวหน้าโค้ชได้เพียงสาขาเดียว | ✅ | coach_branches.is_head_coach |
| โค้ชสอนได้หลายสาขา | ✅ | coach_branches many-to-many |
| เช็คชื่อนักเรียนแต่ละวัน | ✅ | attendance (มา/ขาด/สาย) |
| ส่งโปรแกรมสอนรายวัน ให้ Super User ตรวจ | ✅ | programs (draft→submitted→approved) |
| กรอก LV ของนักเรียนที่รับผิดชอบ (โค้ชหลายคนกรอกได้) | ✅ | levels API |
| เช็ครอบสอนของตนเอง | ✅ | today page |
| เช็คชั่วโมงสอน แยก กลุ่ม/ส่วนตัว | ✅ | hours page |
| ดูรายชื่อนักเรียน + LV | ✅ | students page |
| ดูชั่วโมงการเรียนของนักเรียน ว่าเรียนไปกี่ชั่วโมงแล้ว | ❌ ขาด | Phase 6.2 — ต้องเพิ่ม |
| เช็คอิน+ถ่ายรูป ป้องกันทุจริต | ✅ | checkin (photo+GPS) |

### Super User / Admin — อ้างอิง CMS Requirement

| Requirement | สถานะ | หมายเหตุ |
|-------------|-------|----------|
| ทำทุกอย่างเหมือน User | ✅ | admin booking |
| จองแทนผู้ใช้ (เลือกชื่อผู้ใช้ก่อน) | ✅ | admin booking wizard |
| วันชดเชยไม่คิดเงิน (เฉพาะ Super User) | ✅ | admin makeup |
| ทำทุกอย่างเหมือนโค้ช (แบ่งกลุ่ม, เช็คชื่อ) | ✅ | admin role check |
| คำนวณชั่วโมงสอนโค้ช (สัปดาห์ก่อน, เกิน 25 ชม.) | ✅ | admin payroll (OT detection) |
| เห็นชั่วโมงสอนโค้ช (ทั้งหมด/เดือน/สัปดาห์/วัน) | ✅ | admin payroll (weekly breakdown) |
| สร้างคูปองส่วนลด | ✅ | admin coupons |
| สร้าง Username/Password ให้โค้ช + กำหนดหัวหน้าโค้ช | ✅ | admin coaches |
| สรุปรายรับ-รายจ่าย รายเดือน-ปี | ✅ | admin finance |
| กำหนดเวลาเรียนแต่ละสาขาผ่าน Setting | ⚠️ อ่านอย่างเดียว | admin schedules (แสดงจาก code, ยังไม่แก้ผ่าน CMS) |
| ดู Log ทั้งระบบ | ✅ | admin logs |
| เช็คอินโค้ช (ตรวจสอบ) | ✅ | admin coach-checkins |
| Notifly แดชบอร์ด (ไม่ต่อคอร์ส, คลาสคนน้อย, ร้องเรียน) | ❌ ขาด | Phase 5 |
| แจ้งเตือนลูกค้าเดือนก่อนไม่ลง | ❌ ขาด | Phase 5 |

### Requirement เพิ่มเติม

| Requirement | สถานะ | หมายเหตุ |
|-------------|-------|----------|
| คำนวณว่าต้องเรียนกี่ครั้งถึง LV ไหน | 🔮 Future | Phase 7.1 |
| ผู้ใหญ่ 10/16 ครั้ง ใช้ภายใน 10 เดือน | 🔮 Future | Phase 7.2 |
| จองสนาม, ร้านขาย, ก๊วนแบต, สต๊อกสินค้า | 🔮 Future | Phase 7.3-7.5 |

---

## Business Logic — Pricing Engine (ทำเสร็จแล้ว)

### เด็ก (กลุ่ม) — คิดรายเดือน, รีเซ็ตทุกเดือน

| ครั้ง/เดือน | ราคาแพ็กเกจ | เฉลี่ย/ครั้ง |
|-------------|------------|-------------|
| 1 (รายครั้ง) | 700 | 700 |
| 2-6 | 2,500 | 625 |
| 7-10 | 4,000 | 500 |
| 11-14 | 5,200 | 433 |
| 15-18 | 6,500 | 406 |
| 19+ | 7,000 | 350 |

- **กฎพี่น้อง:** ✅ รวมครั้งลูกทุกคน → ใช้เรทรวม
- **กฎเกินจำนวน:** ✅ คิดเพิ่มตามเรทเฉลี่ย

### ผู้ใหญ่ (กลุ่ม)

| ครั้ง | ราคา | หมดอายุ |
|------|------|--------|
| 1 | 600 | - |
| 10 | 5,500 | 10 เดือน (🔮 Future) |
| 16 | 8,000 | 10 เดือน (🔮 Future) |

### Private

| แบบ | ราคา |
|-----|------|
| รายชั่วโมง | 900/ชม. |
| 10 ชั่วโมง | 8,000 (800/ชม.) |

### Coach Overtime

| เงื่อนไข | เรท |
|----------|-----|
| > 25 ชม./สัปดาห์ (Private) | 400 บาท/ชม. |
| > 25 ชม./สัปดาห์ (Group) | 200 บาท/ชม. |

---

## Level System

### ตาม Requirement (ต้องแก้ให้ตรง)

| ชุด | LV | คำอธิบาย |
|-----|------|---------|
| ชุดพื้นฐาน 👶 | 1-30 | ฝึกวิธีการรับลูกจากคู่แข่ง |
| ชุดนักกีฬา 1 🔨 | 31-39 | ฝึกวิธีการตีลูกทำแต้ม |
| ชุดนักกีฬา 2 🧠 | 40-43 | ฝึกวิสัยทัศน์การเล่นเกม + แข่งระดับสโมสร |
| ชุดนักกีฬา 3 💪 | 44-60 | ฝึกเทคนิคขั้นสูง ระดับทีมชาติ |

### ใน Code ปัจจุบัน (ต้องแก้)

| ชุด | LV |
|-----|------|
| Basic | 1-15 |
| Athlete 1 | 16-30 |
| Athlete 2 | 31-45 |
| Athlete 3 | 46-60 |

> ⚠️ **ต้องแก้ใน:** `coach/levels/page.tsx`, `coach/students/page.tsx`, `components/coach/levels-client.tsx`

---

## Security & Architecture

- ✅ RLS policies ทุก table
- ✅ Server-side pricing calculation
- ✅ Supabase Auth + JWT + middleware
- ✅ Role-based access control (user, coach, head_coach, admin, super_admin)
- ✅ File upload validation (Supabase Storage)
- ✅ Activity logging via DB triggers
- ✅ Environment variables (ไม่ hardcode)
- ✅ Admin API routes ใช้ Service Role Key
