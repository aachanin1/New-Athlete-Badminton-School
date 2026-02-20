# New Athlete Badminton School — Implementation Plan

> อัปเดตล่าสุด: 21 ก.พ. 2569

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS, shadcn/ui |
| Backend | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Payment | SlipOK API (ตรวจสลิปอัตโนมัติ) |
| Deployment | Vercel |

---

## สถานะภาพรวม

| ส่วน | มี Logic จริง | Placeholder (เปล่า) | สถานะ |
|------|:---:|:---:|--------|
| **User (Dashboard)** | 11 หน้า | 0 | ✅ ครบสมบูรณ์ |
| **Admin** | 1 จุด (approve/reject payment ฝังใน history) | 15 หน้า | ⚠️ ต้องสร้าง Logic ทั้งหมด |
| **Coach** | 0 | 8 หน้า | ⚠️ ต้องสร้าง Logic ทั้งหมด |
| **API** | 3 (verify-slip, validate-coupon, health) | 0 | ✅ ทำงานได้ |

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

**สรุป Phase 1:** ระบบผู้ใช้ (User/ผู้ปกครอง) ครบสมบูรณ์ — มี Logic จริง ใช้งานได้ทุกหน้า

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

### Phase 2A — Admin Core ⬅️ กำลังทำ (ต้องทำก่อน Coach เพราะ Admin สร้าง account โค้ช)

> ⚠️ **หมายเหตุ:** ทุกหน้า Admin (15 หน้า) ปัจจุบันเป็น **Placeholder เปล่า** ไม่มี Logic จริง
> มีเพียง approve/reject payment ที่ฝังอยู่ใน `history-client.tsx` (ใช้ร่วมกับ User)

| # | Feature | Status | Files หลัก | ความสำคัญ |
|---|---------|--------|-----------|-----------|
| 2A.1 | **จัดการ Coaches** — สร้าง account โค้ช, กำหนด role (coach/head_coach), กำหนดสาขา | 🔲 TODO | `admin/coaches/page.tsx` | 🔴 ต้องทำก่อน Coach Portal |
| 2A.2 | **จัดการ Users** — ดูรายชื่อผู้ใช้ทั้งหมด, เปลี่ยน role, ดูข้อมูลลูก | 🔲 TODO | `admin/users/page.tsx` | 🔴 |
| 2A.3 | **Payments** — ดูสลิปทั้งหมด, approve/reject กรณี SlipOK ไม่ผ่าน, ดูรูปสลิป | 🔲 TODO | `admin/payments/page.tsx` | 🔴 |
| 2A.4 | **จองแทนผู้ใช้** — เลือก User → จองให้ → ผู้ใช้เห็นในระบบ | 🔲 TODO | `admin/booking/page.tsx` | 🔴 |
| 2A.5 | **Coupons** — สร้าง/แก้ไข/ปิดคูปอง, ดูการใช้งาน | 🔲 TODO | `admin/coupons/page.tsx` | 🟡 |
| 2A.6 | **Complaints** — ดูเรื่องร้องเรียน, ตอบกลับ, เปลี่ยนสถานะ | 🔲 TODO | `admin/complaints/page.tsx` | 🟡 |
| 2A.7 | **Admin Dashboard** — สรุปภาพรวม: จองใหม่, รอชำระ, ร้องเรียน, จำนวนนักเรียน | 🔲 TODO | `admin/page.tsx` | 🟡 |

---

### Phase 2B — Admin Advanced 🔲 ทำหลัง Phase 3

| # | Feature | Status | Files หลัก | ความสำคัญ |
|---|---------|--------|-----------|-----------|
| 2B.1 | **Finance** — สรุปรายรับ/รายจ่าย รายเดือน-ปี, กราฟ | 🔲 TODO | `admin/finance/page.tsx` | 🟡 |
| 2B.2 | **Payroll** — คำนวณเงินเดือนโค้ช, เช็คเกิน 25 ชม./สัปดาห์, OT | 🔲 TODO | `admin/payroll/page.tsx` | 🟡 |
| 2B.3 | **Coach Checkins** — ดูการเช็คอินโค้ช + รูปถ่าย | 🔲 TODO | `admin/coach-checkins/page.tsx` | 🟡 |
| 2B.4 | **Schedules** — ดูตารางรอบเรียนทุกสาขา (อ่านจาก branch-schedules) | 🔲 TODO | `admin/schedules/page.tsx` | 🟢 |
| 2B.5 | **Branches** — ดู/แก้ไขข้อมูลสาขา | 🔲 TODO | `admin/branches/page.tsx` | 🟢 |
| 2B.6 | **Makeup (วันชดเชย)** — Admin เลือกวันชดเชยให้นักเรียน ไม่คิดเงิน | 🔲 TODO | `admin/makeup/page.tsx` | 🟡 |
| 2B.7 | **Notifications** — ส่งแจ้งเตือนถึง User | 🔲 TODO | `admin/notifications/page.tsx` | 🟡 |
| 2B.8 | **Notifly** — แจ้งเตือน: ไม่ต่อคอร์ส (สี), ยังไม่จ่าย, ร้องเรียน | 🔲 TODO | — | 🟡 |
| 2B.9 | **แจ้งเตือนคลาส** — สีเหลือง 2 คน, สีแดง 1 คน, สีเขียว >2 คน | 🔲 TODO | — | 🟡 |
| 2B.10 | **Settings** — กำหนดเวลาเรียนผ่าน CMS (ปัจจุบันอยู่ใน code) | 🔲 TODO | `admin/settings/page.tsx` | 🟢 |
| 2B.11 | **Activity Logs** — ดู Log ทั้งระบบ ว่าใครทำอะไร | 🔲 TODO | `admin/logs/page.tsx` | 🟢 |

---

### Phase 3 — Coach Portal 🔲 ทำหลัง Phase 2A

> ⚠️ **หมายเหตุ:** ทุกหน้า Coach (8 หน้า) ปัจจุบันเป็น **Placeholder เปล่า** ไม่มี Logic จริง
> ต้องทำ Phase 2A ก่อน เพราะ Admin ต้องสร้าง account โค้ช + กำหนด role + สาขา ก่อนที่โค้ชจะใช้งานได้

| # | Feature | Status | Files หลัก |
|---|---------|--------|-----------|
| 3.1 | **Coach Dashboard** — ตารางสอนวันนี้, สรุปชั่วโมง | 🔲 TODO | `coach/page.tsx` |
| 3.2 | **ตารางสอนวันนี้ (Today)** — ดูรอบสอนวันนี้, รายชื่อนักเรียน | 🔲 TODO | `coach/today/` |
| 3.3 | **เช็คชื่อนักเรียน (Attendance)** — เช็คชื่อแต่ละรอบ (มา/ขาด/สาย) | 🔲 TODO | `coach/attendance/` |
| 3.4 | **เช็คอินโค้ช (Checkin)** — ถ่ายรูป + เช็คอิน ป้องกันทุจริต | 🔲 TODO | `coach/checkin/` |
| 3.5 | **แบ่งกลุ่มนักเรียน (Assign Groups)** — หัวหน้าโค้ช แบ่งเด็กให้โค้ชแต่ละคน | 🔲 TODO | `coach/assign-groups/` |
| 3.6 | **กรอก LV/พัฒนาการ (Levels)** — บันทึก LV นักเรียนที่รับผิดชอบ | 🔲 TODO | `coach/levels/` |
| 3.7 | **โปรแกรมสอน (Programs)** — ส่งโปรแกรมสอนให้ Super Admin ตรวจ | 🔲 TODO | `coach/programs/` |
| 3.8 | **ดูรายชื่อนักเรียน (Students)** — ดูนักเรียนทั้งหมด + LV | 🔲 TODO | `coach/students/` |
| 3.9 | **ชั่วโมงสอน (Hours)** — ดูสรุปชั่วโมง (วัน/สัปดาห์/เดือน) แยกกลุ่ม/Private | 🔲 TODO | `coach/hours/` |

---

### Phase 4 — Future Features � วางแผนอนาคต

| # | Feature | Status | รายละเอียด |
|---|---------|--------|-----------|
| 4.1 | **ระบบแนะนำ** — คำนวณว่าลูกต้องเรียนกี่ครั้งถึง LV ไหน | � Future | CMS Requirement เพิ่มเติม 3 |
| 4.2 | **ผู้ใหญ่ 10 เดือน** — ซื้อ 10/16 ครั้ง ใช้ได้ภายใน 10 เดือน | 🔮 Future | ต้องออกแบบ Logic ใหม่ |
| 4.3 | **ระบบจองสนาม** — จองสนามแบดมินตัน | 🔮 Future | |
| 4.4 | **ร้านขายอุปกรณ์** — สต๊อกสินค้า, ลูกแบด, เสื้อ, อุปกรณ์ | 🔮 Future | |
| 4.5 | **Application ก๊วนแบต** — ระบบหาคู่ตี | 🔮 Future | |

---

## ลำดับการทำงาน (Execution Order)

```
Phase 2A (Admin Core) ← ⬅️ ทำตอนนี้
├── 1. จัดการ Coaches — สร้าง account โค้ช, กำหนด role, สาขา
├── 2. จัดการ Users — ดูข้อมูลผู้ใช้ทั้งหมด
├── 3. Payments — ตรวจสอบสลิป approve/reject (หน้าเฉพาะ Admin)
├── 4. จองแทนผู้ใช้ — Super Admin จองให้ลูกค้า
├── 5. Coupons — สร้าง/จัดการคูปอง
├── 6. Complaints — จัดการเรื่องร้องเรียน
└── 7. Admin Dashboard — สรุปภาพรวม

Phase 3 (Coach Portal) ← ทำหลัง Admin Core
├── 1. Dashboard + Today — ตารางสอนวันนี้
├── 2. Attendance — เช็คชื่อนักเรียน
├── 3. Checkin — เช็คอินโค้ช + ถ่ายรูป
├── 4. Levels — กรอก LV นักเรียน
├── 5. Students — ดูรายชื่อนักเรียน
├── 6. Hours — ดูชั่วโมงสอน
├── 7. Programs — ส่งโปรแกรมสอน
└── 8. Assign Groups — แบ่งกลุ่ม (หัวหน้าโค้ช)

Phase 2B (Admin Advanced) ← ทำหลัง Coach เพราะต้องมีข้อมูลโค้ชก่อน
├── Finance, Payroll, Coach Checkins
├── Makeup, Notifications, Notifly
└── Settings, Branches, Schedules, Logs
```
