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

## Development Phases

### Phase 1 — Foundation & User Booking ✅ เสร็จแล้ว

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

**สรุป Phase 1:** ระบบผู้ใช้ (User/ผู้ปกครอง) ครบสมบูรณ์ — จองเรียน, ชำระเงิน, ดูตาราง, เปลี่ยนวัน, ดูพัฒนาการ, ร้องเรียน

---

### Phase 2 — Admin & Payment Management ✅ เสร็จแล้ว (โครงสร้าง)

| # | Feature | Status | Files หลัก |
|---|---------|--------|-----------|
| 2.1 | **Admin Dashboard** — หน้าหลัก Admin สรุปภาพรวม | ✅ Done | `src/app/(admin)/admin/page.tsx` |
| 2.2 | **จัดการ Booking** — ดู/จัดการจองทั้งหมดในระบบ | ✅ Done | `src/app/(admin)/admin/booking/` |
| 2.3 | **จัดการ Payment** — ตรวจสอบสลิป, อนุมัติ/ปฏิเสธ | ✅ Done | `src/app/(admin)/admin/payments/` |
| 2.4 | **จัดการ Users** — ดูข้อมูลผู้ใช้ทั้งหมด, เปลี่ยน role | ✅ Done | `src/app/(admin)/admin/users/` |
| 2.5 | **จัดการ Branches** — ดู/แก้ไขสาขา | ✅ Done | `src/app/(admin)/admin/branches/` |
| 2.6 | **จัดการ Coupons** — สร้าง/แก้ไข คูปองส่วนลด | ✅ Done | `src/app/(admin)/admin/coupons/` |
| 2.7 | **จัดการ Schedules** — ดูตารางรอบเรียนทุกสาขา | ✅ Done | `src/app/(admin)/admin/schedules/` |
| 2.8 | **วันชดเชย (Makeup)** — Admin เลือกวันชดเชยให้นักเรียน ไม่คิดเงิน | ✅ Done | `src/app/(admin)/admin/makeup/` |
| 2.9 | **Complaints** — ดู/จัดการเรื่องร้องเรียน | ✅ Done | `src/app/(admin)/admin/complaints/` |
| 2.10 | **Notifications** — ส่งแจ้งเตือนถึง User | ✅ Done | `src/app/(admin)/admin/notifications/` |
| 2.11 | **Activity Logs** — ดู Log ทั้งระบบ | ✅ Done | `src/app/(admin)/admin/logs/` |
| 2.12 | **Settings** — ตั้งค่าระบบ | ✅ Done | `src/app/(admin)/admin/settings/` |
| 2.13 | **Finance** — สรุปรายรับ-รายจ่าย | ✅ Done | `src/app/(admin)/admin/finance/` |
| 2.14 | **Payroll** — คำนวณเงินเดือนโค้ช | ✅ Done | `src/app/(admin)/admin/payroll/` |
| 2.15 | **Coach Checkins** — ดูการเช็คอินโค้ช | ✅ Done | `src/app/(admin)/admin/coach-checkins/` |
| 2.16 | **จัดการ Coaches** — เพิ่ม/แก้ไข โค้ช, กำหนด role, สาขา | ✅ Done | `src/app/(admin)/admin/coaches/` |

**สรุป Phase 2:** หน้า Admin ครบทุกเมนู — แต่ **บาง Feature อาจต้องปรับปรุง/เติมเต็ม Logic** ตาม CMS requirement

---

### Phase 2.5 — Refinements (ปรับปรุงที่ทำเพิ่ม) ✅ เสร็จแล้ว

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

### Phase 3 — Coach Portal 🔲 ยังไม่ทำ (โครงสร้างหน้ามีแล้ว ต้องเติม Logic)

| # | Feature | Status | Files หลัก |
|---|---------|--------|-----------|
| 3.1 | **Coach Dashboard** — ตารางสอนวันนี้, สรุปชั่วโมง | 🔲 TODO | `src/app/(coach)/coach/page.tsx` |
| 3.2 | **ตารางสอนวันนี้ (Today)** — ดูรอบสอนวันนี้, รายชื่อนักเรียน | 🔲 TODO | `src/app/(coach)/coach/today/` |
| 3.3 | **เช็คชื่อนักเรียน (Attendance)** — เช็คชื่อแต่ละรอบ (มา/ขาด/สาย) | 🔲 TODO | `src/app/(coach)/coach/attendance/` |
| 3.4 | **เช็คอินโค้ช (Checkin)** — ถ่ายรูป + เช็คอิน ป้องกันทุจริต | 🔲 TODO | `src/app/(coach)/coach/checkin/` |
| 3.5 | **แบ่งกลุ่มนักเรียน (Assign Groups)** — หัวหน้าโค้ช แบ่งเด็กให้โค้ชแต่ละคน | 🔲 TODO | `src/app/(coach)/coach/assign-groups/` |
| 3.6 | **กรอก LV/พัฒนาการ (Levels)** — บันทึก LV นักเรียนที่รับผิดชอบ | 🔲 TODO | `src/app/(coach)/coach/levels/` |
| 3.7 | **โปรแกรมสอน (Programs)** — ส่งโปรแกรมสอนให้ Super Admin ตรวจ | 🔲 TODO | `src/app/(coach)/coach/programs/` |
| 3.8 | **ดูรายชื่อนักเรียน (Students)** — ดูนักเรียนทั้งหมด + LV | 🔲 TODO | `src/app/(coach)/coach/students/` |
| 3.9 | **ชั่วโมงสอน (Hours)** — ดูสรุปชั่วโมง (วัน/สัปดาห์/เดือน) แยกกลุ่ม/Private | 🔲 TODO | `src/app/(coach)/coach/hours/` |

---

### Phase 4 — Admin Advanced Features 🔲 ยังไม่ทำ (ต้องเติม Logic)

| # | Feature | Status | รายละเอียด |
|---|---------|--------|-----------|
| 4.1 | **Admin จองแทนผู้ใช้** — เลือกผู้ใช้ → จองให้ → ผู้ใช้เห็นในระบบ | 🔲 TODO | CMS: Super User ทำแทน |
| 4.2 | **Finance — สรุปรายรับ/รายจ่ายรายเดือน-ปี** — กราฟ + ตาราง | 🔲 TODO | รายรับจากคอร์ส, รายจ่ายโค้ช |
| 4.3 | **Payroll — คำนวณเงินเดือนโค้ช** — เช็คเกิน 25 ชม./สัปดาห์, เรท OT | 🔲 TODO | กลุ่ม 200/ชม., Private 400/ชม. |
| 4.4 | **Notifly แจ้งเตือน** — ไม่ต่อคอร์ส (สี), ยังไม่จ่ายเงิน, ร้องเรียน | 🔲 TODO | สีแดง ≥85%, เหลือง ≥80% |
| 4.5 | **แจ้งเตือนคลาส** — สีเหลือง 2 คน, สีแดง 1 คน, สีเขียว >2 คน | 🔲 TODO | |
| 4.6 | **Admin กำหนดเวลาเรียนผ่าน Settings** — CMS สาขา/รอบเรียน | 🔲 TODO | ปัจจุบันอยู่ใน code |
| 4.7 | **Activity Logs — ดู Log ทั้งระบบ ว่าใครทำอะไร** | 🔲 TODO | DB table มี, ต้องเขียน log |

---

### Phase 5 — Future Features 🔮 วางแผนอนาคต

| # | Feature | Status | รายละเอียด |
|---|---------|--------|-----------|
| 5.1 | **ระบบแนะนำ** — คำนวณว่าลูกต้องเรียนกี่ครั้งถึง LV ไหน | 🔮 Future | CMS Requirement เพิ่มเติม 3 |
| 5.2 | **ระบบจองสนาม** — จองสนามแบดมินตัน | 🔮 Future | |
| 5.3 | **ร้านขายอุปกรณ์** — สต๊อกสินค้า, ลูกแบด, เสื้อ, อุปกรณ์ | 🔮 Future | |
| 5.4 | **Application ก๊วนแบต** — ระบบหาคู่ตี | 🔮 Future | |
| 5.5 | **ผู้ใหญ่ 10 เดือน** — ซื้อ 10/16 ครั้ง ใช้ได้ภายใน 10 เดือน | 🔮 Future | ต้องออกแบบ Logic ใหม่ |

---

## สิ่งที่ทำเสร็จแล้ว (Summary)

### ฝั่ง User (ผู้ปกครอง/ผู้เรียน) — ✅ ครบ
- สมัครสมาชิก / เข้าสู่ระบบ
- จัดการข้อมูลลูก (เพิ่ม/แก้ไข/รูปโปรไฟล์)
- จองเรียน 3 ประเภท: เด็กกลุ่ม, ผู้ใหญ่กลุ่ม, Private
- เลือกวันจากปฏิทิน ตามรอบเรียนจริงของสาขา
- ระบบราคาอัตโนมัติ + กฎพี่น้อง + คูปอง
- ชำระเงิน (อัปโหลดสลิป → SlipOK ตรวจอัตโนมัติ)
- ดูตารางเรียน (ปฏิทินรายเดือน)
- เปลี่ยนวัน/สาขา (ภายในเดือน, 24 ชม.ล่วงหน้า)
- ดูพัฒนาการ / LV
- ร้องเรียน
- Ranking แยกเด็ก/ผู้ใหญ่

### ฝั่ง Admin — ✅ โครงสร้างครบ (ต้องเติม Logic บางจุด)
- Dashboard สรุปภาพรวม
- จัดการจอง / ชำระเงิน / ผู้ใช้ / สาขา / คูปอง
- ดูตารางรอบเรียน / วันชดเชย
- จัดการเรื่องร้องเรียน / แจ้งเตือน
- Activity Logs / Settings / Finance / Payroll / Coach Checkins / Coaches

### ฝั่ง Coach — 🔲 มีหน้าแล้ว ต้องเติม Logic
- ตารางสอนวันนี้ / เช็คชื่อ / เช็คอิน / แบ่งกลุ่ม / กรอก LV / โปรแกรมสอน / ชั่วโมงสอน

---

## สิ่งที่ต้องทำต่อ (Priority Order)

### 🔴 Priority High — ควรทำเลย
1. **Phase 3: Coach Portal Logic** — โค้ชต้องใช้งานจริง (เช็คชื่อ, ดูตาราง, กรอก LV)
2. **Phase 4.1: Admin จองแทนผู้ใช้** — Super Admin ทำแทนลูกค้าได้
3. **Phase 4.3: Payroll คำนวณเงินเดือนโค้ช** — เกิน 25 ชม./สัปดาห์ คิด OT
4. **Phase 4.2: Finance สรุปรายรับ-รายจ่าย** — รายเดือน/ปี

### 🟡 Priority Medium — ทำหลัง High เสร็จ
5. **Phase 4.4: Notifly แจ้งเตือน** — ไม่ต่อคอร์ส, ยังไม่จ่าย
6. **Phase 4.5: แจ้งเตือนคลาส** — จำนวนคนในคลาส
7. **Phase 4.6: Settings กำหนดเวลาเรียนผ่าน CMS** — ย้ายจาก code → DB
8. **Phase 4.7: Activity Logs** — เขียน log เมื่อมี action

### 🟢 Priority Low — ทำเมื่อพร้อม
9. **Phase 5: Future Features** — ระบบแนะนำ, จองสนาม, ร้านค้า
