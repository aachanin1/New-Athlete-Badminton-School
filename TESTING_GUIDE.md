# Testing Guide

## Test Accounts

เตรียมบัญชีทดสอบอย่างน้อยดังนี้

- `user` 1 บัญชีที่ไม่มีลูก
- `user` 1 บัญชีที่มีลูกอย่างน้อย 2 คน
- `coach` 1 บัญชี
- `head_coach` 1 บัญชี
- `admin` 1 บัญชี
- `super_admin` 1 บัญชี

## Environment Checklist

- ตั้งค่า `NEXT_PUBLIC_SUPABASE_URL`
- ตั้งค่า `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ตั้งค่า `SUPABASE_SERVICE_ROLE_KEY`
- ตั้งค่า `SLIPOK_API_URL`
- ตั้งค่า `SLIPOK_API_KEY`
- ตั้งค่า `SLIPOK_TEST_MODE=true` สำหรับทดสอบ flow ชำระเงินแบบไม่เรียก API จริง

## Run Basic Validation

```bash
npx tsc --noEmit --skipLibCheck
```

ผลที่คาดหวัง

- ไม่มี TypeScript error

---

## Phase 1 — User Booking

### 1. Booking flow หลัก

ขั้นตอน

1. Login ด้วยบัญชี `user`
2. ไปที่ `/dashboard/booking`
3. เลือกคอร์ส
4. เลือกผู้เรียน
5. เลือกสาขา
6. เลือกวันเรียนจากปฏิทิน
7. ตรวจ summary และกดสร้างการจอง

ผลที่คาดหวัง

- ไปที่ `/dashboard/history`
- มี booking ใหม่สถานะ `pending_payment`
- ฝั่ง admin ได้ notification `มีการจองใหม่`

### 2. Sibling pricing

ขั้นตอน

1. ใช้บัญชีที่มีลูก 2 คนขึ้นไป
2. เลือก `kids_group`
3. เลือกหลายคน
4. เลือกวันเรียนรวมกันหลายครั้ง

ผลที่คาดหวัง

- ระบบรวมจำนวนครั้งทั้งพี่น้อง
- ราคาใช้ tier รวม ไม่ใช่แยกต่อคน
- badge จำนวนครั้งและราคาเปลี่ยนตามจำนวนรวม

### 3. Session status bar

ขั้นตอน

1. ในหน้า booking เลือกจำนวนครั้ง 1-3, 4, 8, 12, 16, 19+

ผลที่คาดหวัง

- 1-3 ครั้ง: มี warning `ต่ำกว่าขั้นต่ำ`
- 4 ครั้ง: แสดง `การเรียนขั้นต่ำ`
- 8 ครั้ง: แสดง `การออกกำลังกาย`
- 12 ครั้ง: แสดง `การเริ่มต้นเป็นนักกีฬา`
- 16/19+ ครั้ง: แสดงระดับสูงขึ้นตาม logic

### 4. Upload slip

ขั้นตอน

1. สร้าง booking ที่ `pending_payment`
2. ไปหน้า `/dashboard/history`
3. แนบสลิป

ผลที่คาดหวัง

- ถ้า `SLIPOK_TEST_MODE=true` ระบบ auto approve
- booking เปลี่ยนเป็น `verified`
- user ได้ notification `ยืนยันการชำระเงินสำเร็จ`
- admin ได้ notification `มีการแนบสลิปชำระเงิน`

### 5. Complaint

ขั้นตอน

1. ไป `/dashboard/complaint`
2. ส่งเรื่องร้องเรียน

ผลที่คาดหวัง

- มี complaint record ใหม่
- admin/super_admin ได้ notification `มีเรื่องร้องเรียนใหม่`

### 6. Notifications page

ขั้นตอน

1. ไป `/dashboard/notifications`
2. ตรวจรายการแจ้งเตือน
3. กด `อ่านแล้ว` รายการเดียว
4. กด `อ่านทั้งหมดแล้ว`

ผลที่คาดหวัง

- รายการจาก event ต่างๆ แสดงในหน้า
- unread count ลดลง
- refresh แล้วสถานะยังคงอยู่

### 7. Reschedule

ขั้นตอน

1. มี booking ที่ `verified`
2. ไป `/dashboard/reschedule`
3. เลือกรอบที่เปลี่ยนได้
4. เลือกวันใหม่

ผลที่คาดหวัง

- session เดิมเป็น `rescheduled`
- session ใหม่ถูกสร้าง
- admin ได้ notification `มีการเปลี่ยนวัน/สาขา`
- coach สาขาที่เกี่ยวข้องได้ notification `มีการเปลี่ยนวัน/สาขา`

---

## Phase 2A / 2B — Admin / Super Admin

### 1. Route guards

ขั้นตอน

1. Login เป็น `user`
2. พยายามเข้า `/admin`
3. Login เป็น `admin`
4. เข้า `/admin/settings`
5. Login เป็น `super_admin`
6. เข้า `/admin/settings` และ `/admin/logs`

ผลที่คาดหวัง

- `user` เข้า admin ไม่ได้
- `admin` เข้า settings/logs ไม่ได้
- `super_admin` เข้าได้

### 2. User role management

ขั้นตอน

1. Login เป็น `admin`
2. ไป `/admin/users`
3. พยายามแก้ role ของ `admin` หรือ `super_admin`
4. พยายามเปลี่ยน user ธรรมดาเป็น `admin`
5. Login เป็น `super_admin`
6. ทำซ้ำ

ผลที่คาดหวัง

- `admin` ธรรมดาแก้ role สูงไม่ได้
- `super_admin` แก้ได้
- ห้ามแก้ role ตัวเอง

### 3. Coupons

ขั้นตอน

1. ไป `/admin/coupons`
2. สร้าง coupon ใหม่
3. toggle active/inactive

ผลที่คาดหวัง

- สร้างสำเร็จพร้อม success feedback
- toggle แล้วสถานะเปลี่ยนจริง
- ถ้า API fail ต้องมี error feedback

### 4. Payments

ขั้นตอน

1. มี payment สถานะ `pending`
2. ไป `/admin/payments`
3. approve
4. ทดสอบอีกรายการด้วย reject

ผลที่คาดหวัง

- approve: payment -> `approved`, booking -> `verified`
- reject: payment -> `rejected`, booking -> `pending_payment`
- user ได้ notification ตาม action

### 5. Admin booking

ขั้นตอน

1. ไป `/admin/booking`
2. เลือก user
3. เลือกคอร์ส, ผู้เรียน, สาขา, วันเรียน
4. ตรวจ preview จำนวนครั้งและ status bar
5. กดสร้างรายการ

ผลที่คาดหวัง

- สร้าง booking สำเร็จ
- ถ้าเปิด auto verify จะมี payment approved อัตโนมัติ
- user ได้ notification `มีการจองใหม่ในระบบ`
- admin notifications มี event `มีการจองใหม่`

### 6. Notifications center (admin)

ขั้นตอน

1. ไป `/admin/notifications`
2. ตรวจ alert cards 3 กลุ่ม
3. กด quick action `ส่งแจ้งเตือน` จาก alert ลูกค้า
4. ส่ง notification หา user หรือทุกคน

ผลที่คาดหวัง

- มี alert ขึ้นตามข้อมูลจริงของระบบ
- กด quick action แล้ว dialog ถูก prefill
- ส่งสำเร็จและ user เห็นใน `/dashboard/notifications`

### 7. Alerts logic

#### 7.1 Non-renewal alerts

ข้อมูลทดสอบ

- สร้าง booking เดือนปัจจุบัน
- ใช้คอร์สไปให้เกิน 70/80/85%
- อย่าสร้าง booking เดือนถัดไป

ผลที่คาดหวัง

- 70% -> green
- 80% -> yellow
- 85% -> red

#### 7.2 Low enrollment alerts

ข้อมูลทดสอบ

- ทำให้ class เดียวกันมี 1 คน, 2 คน, 3+ คน

ผลที่คาดหวัง

- 1 คน -> red
- 2 คน -> yellow
- มากกว่า 2 -> green

#### 7.3 Customer follow-up alerts

ข้อมูลทดสอบ

- user เคยเรียนเดือนก่อน แต่เดือนนี้ไม่ลง
- user เคยเรียนเก่ากว่านั้นและยังไม่กลับมา

ผลที่คาดหวัง

- เดือนก่อนแต่ไม่ลงเดือนนี้ -> follow-up สีเหลือง
- หายเกิน 1 เดือน -> follow-up สีเขียว

---

## Phase 3 — Coach Portal

### 1. Levels

ขั้นตอน

1. Login เป็น coach
2. ไป `/coach/levels`
3. กรอก LV เป็น 10, 35, 42, 50

ผลที่คาดหวัง

- แสดง category ตาม requirement:
  - 1-30 = ชุดพื้นฐาน
  - 31-39 = ชุดนักกีฬา 1
  - 40-43 = ชุดนักกีฬา 2
  - 44-60 = ชุดนักกีฬา 3

### 2. Students page

ขั้นตอน

1. ไป `/coach/students`
2. ตรวจข้อมูลนักเรียน

ผลที่คาดหวัง

- แสดง level category ตาม requirement เดียวกับหน้า levels/progress
- แสดงจำนวนชั่วโมงเรียนสะสมของนักเรียน

### 3. Programs

ขั้นตอน

1. ไป `/coach/programs`
2. บันทึก draft
3. ส่ง `submitted`

ผลที่คาดหวัง

- บันทึก draft สำเร็จ
- เมื่อส่ง submitted -> super_admin ได้ notification `โปรแกรมสอนรอตรวจ`

### 4. Attendance / Checkin

ขั้นตอน

1. ไป `/coach/today`, `/coach/attendance`, `/coach/checkin`
2. เช็คชื่อและเช็คอิน

ผลที่คาดหวัง

- attendance บันทึกได้
- checkin พร้อมรูป/GPS บันทึกได้
- admin ดูได้ที่หน้าที่เกี่ยวข้อง

---

## Phase 6 — Requirement Alignment

### 6.1 Level categories

ขั้นตอน

1. ตรวจหน้า `/dashboard/progress`
2. ตรวจหน้า `/coach/levels`
3. ตรวจหน้า `/coach/students`

ผลที่คาดหวัง

- ทุกหน้าตรงกันทั้งหมด
- ไม่มีหน้าไหนใช้ range เก่า 1-15 / 16-30 / 31-45 / 46-60

### 6.2 Student hours

ขั้นตอน

1. ใช้นักเรียนที่มี booking หลายคอร์ส
2. ตรวจหน้า `/coach/students`

ผลที่คาดหวัง

- มีข้อความ `เรียนแล้ว X ชม.`
- คำนวณจาก `total_sessions * duration_hours`

### 6.3 Session status bar

ขั้นตอน

1. ตรวจหน้า `/dashboard/booking`
2. ตรวจหน้า `/admin/booking`

ผลที่คาดหวัง

- ทั้งสองหน้ามี status badge เหมือนกัน
- warning สำหรับจำนวนครั้งน้อยแสดงตรงกัน

---

## Smoke Regression Checklist

ทุกรอบ deploy ให้ทดสอบอย่างน้อย

- user login / register
- booking ใหม่ 1 รายการ
- upload slip 1 รายการ
- complaint 1 รายการ
- reschedule 1 รายการ
- admin approve payment 1 รายการ
- admin create booking 1 รายการ
- coach submit program 1 รายการ
- dashboard notifications แสดง event ใหม่
- admin notifications แสดง alert insights

---

## Suggested Manual Test Order

1. Auth
2. User booking
3. Payment + notifications
4. Complaint + notifications
5. Reschedule + notifications
6. Admin role guard
7. Admin payments / users / booking / notifications
8. Coach levels / students / programs
9. Final smoke regression
