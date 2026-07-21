# Phase A Code Review: `/admin/schedules` Performance

วันที่ตรวจ: 19 กรกฎาคม 2026
เขตเวลา: Asia/Bangkok
สถานะ: **Phase A read-only code review complete / Phase B ยังไม่ได้รับอนุมัติ**
ขอบเขต: ตรวจ Source และออกแบบแนวทางเท่านั้น ไม่มี Source change, migration, deploy หรือ Production write

## 1. Owner Decisions

Owner ยืนยันเมื่อวันที่ 19 กรกฎาคม 2026 ว่า:

1. เลือก Admin Schedules Performance เป็น Active Task ถัดไป
2. งานหลักคือ `/admin/schedules`
3. ต้องแสดงภาพรวมเดือนก่อน แล้วโหลดรายละเอียดเมื่อเลือกวันที่
4. Performance budget เบื้องต้นคือเวลาปกติไม่เกิน 3 วินาที และอย่างน้อย 95% ของการเปิดหน้าไม่เกิน 5 วินาที
5. อนุญาต Cache 5–15 นาทีเฉพาะข้อมูลที่เปลี่ยนน้อย
6. ปัจจุบันยืนยันอาการช้าใน Admin/Super Admin และ Coach; User portal ทั้งระบบยังไม่มีหลักฐานเพียงพอและต้องตรวจแยก
7. ไม่ย้าย Region เป็นวิธีแก้ขั้นแรก
8. อนุมัติงานทีละ Phase โดยรอบนี้อนุมัติเฉพาะ Phase A

## 2. คำตอบตรงไปตรงมา

**ต้อง Review Code และ Code เป็นสาเหตุหลักส่วนหนึ่งที่ยืนยันได้** ไม่ใช่เพียง Supabase, ขนาดเครื่อง หรือ Region

หลักฐานจาก Source ตรงกับ Vercel/Supabase logs:

- Server โหลดข้อมูลรายละเอียดทั้งเดือนก่อนส่ง Client แม้ UI จะบอกว่าแสดง summary ก่อน
- มี query loops หลายชุดที่รอทีละ chunk
- มี dependency phases ต่อกัน: sessions → wallet → groups/programs/slot sessions → levels → attendance
- July data shape ทำให้เกิดประมาณ 50 data requests และ 52–53 external calls ต่อ full render
- Region ที่อยู่ไกลกันเพิ่มความรุนแรง แต่ไม่ใช่ต้นเหตุของจำนวน requests

ดังนั้นการเพิ่มทรัพยากร, เพิ่ม Cache ทุกอย่าง หรือย้าย Region โดยไม่แก้ data flow จะเป็นเพียงการบรรเทา ไม่ใช่การแก้โครงสร้าง

## 3. Findings เรียงตามความสำคัญ

### P0 — UI เป็น summary-first แต่ Server ยังโหลด full detail

Source:

- [`src/app/(admin)/admin/schedules/page.tsx`](<../../src/app/(admin)/admin/schedules/page.tsx>)
- [`src/components/admin/schedules-client.tsx`](../../src/components/admin/schedules-client.tsx)

Client แสดงข้อความว่าเป็น “สรุปรายเดือนแบบเบา ๆ ก่อน” และซ่อนรายละเอียดจนเลือกวัน แต่ Server ได้โหลดข้อมูลต่อไปนี้ครบแล้วก่อน render:

- booking sessions ทั้งเดือน
- lesson wallet credits
- coach assignment groups และสมาชิก
- slot sessions เพิ่มอีกชุด
- teaching programs
- student levels และ level definitions
- attendance

ผลคือผู้ใช้ยังต้องรอ full-month data flow 15–18 วินาที แม้รายละเอียดจะยังไม่ปรากฏบนหน้าจอ

นี่คือจุดที่ควรแก้ก่อน Cache, index หรือ Region

### P0 — Serial chunk loops และ multi-phase waterfall

ค่าปัจจุบัน:

```ts
const ATTENDANCE_QUERY_CHUNK_SIZE = 100
const RELATED_QUERY_CHUNK_SIZE = 100
const SCHEDULE_SESSION_PAGE_SIZE = 1000
```

ฟังก์ชันต่อไปนี้วนและ `await` ทีละ chunk:

- `fetchWalletCreditsByOriginalSessionIds()`
- `fetchGroupsBySlotIds()`
- `fetchSlotSessionsBySlotIds()`
- `fetchAttendanceRowsBySessionIds()`
- `fetchStudentLevelsByStudentRefs()`
- `fetchTeachingProgramsBySlotIds()`

การใช้ `Promise.all()` ระหว่างสาม query groups ช่วยได้บางส่วน แต่ภายในแต่ละกลุ่มยังรอแบบต่อเนื่อง และ attendance ต้องรอให้ทุก phase ก่อนหน้าจบ

### P1 — อ่าน `booking_sessions` ซ้ำในเดือนเดียวกัน

Server โหลด monthly sessions รอบแรกพร้อมข้อมูลผู้เรียน/booking จากนั้นโหลด `booking_sessions` อีกรอบตาม `schedule_slot_id` เพื่อสร้าง attendance scope

การอ่านรอบที่สองอาจจำเป็นต่อกฎ attendance บางกรณี แต่ contract ปัจจุบันทำให้เกิด request เพิ่ม 5–7 ครั้งในตัวอย่าง การออกแบบใหม่ต้องพิสูจน์ว่าสามารถคืน attendance scope จาก read model เดียวโดยไม่ทำลายกฎ exact learner และ wallet/reschedule semantics ได้หรือไม่

### P1 — ส่งข้อมูลรายละเอียดทั้งเดือนผ่าน Server-to-Client boundary

`SchedulesClient` ได้รับทั้ง `sessions` และ `rounds` ของทั้งเดือน รวมถึงชื่อผู้เรียน ผู้ปกครอง Coach, Level, Attendance-derived status และ Teaching Program

แม้ Client จะ render เฉพาะวันที่เลือก แต่ข้อมูลเหล่านี้ต้องถูกประกอบและ serialize ก่อนหน้าเปิดเสร็จ จึงต้องวัด RSC payload size และ transferred bytes ใน Phase ถัดไป

### P1 — Auth/Profile มีโอกาสทำงานซ้ำใน Layout และ Page

Admin layout และ schedules page เรียก `requireAdminPageAccess()` แยกกัน ขณะที่ helper ยังไม่มี per-request memoization ที่เห็นได้จาก Source

Supabase snapshot เดิมพบ Auth/Profile burst แต่ Vercel sample ล่าสุดไม่ได้ยืนยันว่าทุก render ซ้ำในจำนวนเท่ากัน จึงจัดเป็นปัญหา Source ที่ควร dedupe และวัด ไม่ใช่ root cause 15–18 วินาทีเพียงลำพัง

### P1 — ไม่มี data-loading boundary สำหรับ day detail

ปัจจุบันการเลือกวันเป็นเพียง Client state และอ่านข้อมูลจาก array ที่โหลดมาแล้ว ไม่มี authenticated day-detail endpoint, server action หรือ Server Component boundary ที่เริ่ม query หลังเลือกวันจริง

### P2 — Link prefetch เป็นภาระเสริม

Admin sidebar ไม่ได้ปิด prefetch สำหรับ route หนัก การตรวจ Vercel พบ RSC prefetch หลาย route แต่ตัวอย่างที่ตรวจไม่ได้พิสูจน์ว่า prefetch เป็น root cause หลักของ schedules จึงควรวัดและปรับแบบ selective ภายหลัง ไม่ควรใช้เป็นคำอธิบายหลัก

### P2 — RLS advisories และ index gaps เป็นปัจจัยรอง

Supabase Advisor พบ RLS init-plan, multiple permissive policies และ foreign-key index gaps บางจุด แต่หลักฐานยังไม่ชี้ว่ารายการใดรายการหนึ่งทำให้เกิด 15–18 วินาที การแก้ Advisor ทั้งหมดก่อนลด request fan-out มีความเสี่ยงขยาย scope โดยไม่แก้ต้นเหตุหลัก

## 4. แบบออกแบบที่แนะนำสำหรับ Phase B

### 4.1 แยกข้อมูลเป็นสองชั้น

#### Monthly Summary

โหลดเฉพาะสิ่งที่จำเป็นต่อ:

- ปฏิทินรายเดือน
- จำนวนรอบและจำนวนรายการต่อวัน
- สาขาและประเภทคอร์ส
- จำนวนผู้เรียนรวม
- จำนวนที่ยังรอจัด Coach
- จำนวน Wallet ตาม semantics เดิม

Summary ควรเป็นผลรวมที่มีขอบเขต ไม่ควรส่งรายละเอียดผู้เรียน/ผู้ปกครอง/Level/Program/Attendance ทุกแถว

#### Day Detail

เริ่มโหลดเมื่อ Admin เลือกวันที่ โดยคืนเฉพาะ:

- รอบของวันนั้น
- ผู้เรียนของแต่ละรอบ
- กลุ่มและ Coach
- Level
- Teaching Program
- Wallet state
- Attendance-derived display state

ต้องใช้ authorization เดิมและ helper attendance เดิม ห้ามลดทอนกฎ exact learner หรือใช้ `booking_sessions.status` แทน attendance source of truth

### 4.2 Query/read-model strategy

ให้เปรียบเทียบอย่างน้อยสองทางก่อนเลือก:

1. authenticated server queries ที่ลด scope เป็น month-summary และ one-day detail
2. bounded SQL/RPC read model ที่ลด round trips

หากใช้ RPC:

- ต้องคง RLS/authorization contract
- prefer `SECURITY INVOKER`
- ห้ามใช้ `SECURITY DEFINER` เพียงเพื่อข้าม permission
- ต้องจำกัด columns และ date scope
- ต้องมี query-plan, security และ regression verification

การ parallelize chunks แบบมี concurrency limit ใช้เป็น bridge ได้ แต่ไม่ควรเป็นคำตอบหลัก เพราะยังคงส่งข้อมูลทั้งเดือนและสร้าง requests จำนวนมาก

### 4.3 Cache policy

Owner อนุมัติกรอบ 5–15 นาที แนะนำค่าเริ่มต้น 10 นาทีสำหรับ:

- active branches
- active level definitions
- configuration ที่เปลี่ยนน้อยและไม่มีข้อมูลส่วนบุคคล

ไม่ Cache ข้าม request แบบยาวสำหรับ:

- attendance
- wallet status
- assignment groups/members
- payment state
- schedule detail ที่เพิ่งแก้ไข

Auth/Profile ควรใช้ per-request deduplication ไม่ใช่ cross-user shared cache

### 4.4 Search contract ที่ต้องรักษา

ปัจจุบัน Search ค้นชื่อผู้เรียน ผู้ปกครอง Coach สาขา คอร์ส และ booking status ได้ทั่วทั้งเดือน เพราะรายละเอียดทั้งเดือนอยู่ใน Browser

เมื่อเปลี่ยนเป็น summary-first ต้องเลือกหนึ่งแนวทาง:

1. จำกัด Search ก่อนเลือกวันให้ค้นเฉพาะ summary fields
2. ทำ authenticated server-side search เมื่อผู้ใช้เริ่มพิมพ์ แล้วโหลดเฉพาะผลที่ตรง

**คำแนะนำ: เลือกข้อ 2** เพื่อรักษาความสามารถค้นทั้งเดือนโดยไม่บังคับให้ preload รายละเอียดทุกคน

นี่เป็น Owner decision เพิ่มเติมที่ต้องยืนยันก่อน Phase B

## 5. Performance Budget

ใช้เกณฑ์ Owner-approved เบื้องต้น:

- normal monthly summary: ไม่เกิน 3 วินาที
- monthly summary P95: ไม่เกิน 5 วินาที
- selected-day detail: เป้าหมาย 2–3 วินาที

ต้องวัดอย่างน้อย:

- cold navigation
- warm navigation
- เปลี่ยนเดือน
- เลือกวัน
- search
- Admin และ Super Admin
- RSC payload size, transferred bytes, server duration และ external-call count

Coach และ User portal ให้เป็น correlated measurement แยก ไม่รวม Source fix โดยอัตโนมัติ

## 6. Phase B Proposed Scope — Not Yet Authorized

ไฟล์/flow ที่มีแนวโน้มอยู่ใน scope:

- `src/app/(admin)/admin/schedules/page.tsx`
- `src/components/admin/schedules-client.tsx`
- `src/app/(admin)/layout.tsx`
- `src/lib/auth/admin.ts`
- authenticated schedule summary/day-detail read boundary ใหม่
- deterministic tests สำหรับ summary/detail parity
- performance instrumentation ที่ไม่บันทึก PII

อาจต้องมี additive migration หากผลออกแบบเลือก SQL/RPC read model แต่ยังไม่ควรสร้าง migration ก่อน review query contract, RLS และ security

ไม่อยู่ใน Phase B โดยอัตโนมัติ:

- ย้าย Vercel/Supabase Region
- แก้ Coach portal
- แก้ User portal
- แก้ `/admin/payments`
- เปลี่ยน business data
- เปลี่ยน Attendance, Wallet, Booking, Payment, Payroll หรือ Pricing semantics
- commit, push, deploy หรือ Production UAT

## 7. Phase A Conclusion

Code review ยืนยันว่า Code ไม่ได้เพียง “อาจมีปัญหา” แต่มีโครงสร้างที่อธิบาย logs ได้ตรงกัน โดยเฉพาะ full-month overfetch, serial chunk loops และ phase waterfall

แนวทางที่เหมาะสมคือแยก monthly summary กับ selected-day detail จริงที่ชั้นข้อมูล ลด request fan-out ก่อน แล้วจึงพิจารณา Cache, query/index tuning และ Region ตามหลักฐานหลังแก้

Phase A เสร็จในขอบเขต read-only ส่วน Phase B ยังต้องได้รับ Owner approval แยกต่างหาก โดยมี Owner decision เพิ่มเติมเรื่องการคง Search ทั้งเดือนผ่าน server-side search ตามคำแนะนำ

## 8. Related Evidence

- [`admin-schedules-supabase-log-analysis-2026-07-14.md`](./admin-schedules-supabase-log-analysis-2026-07-14.md)
- [`admin-portal-slowness-video-vercel-correlation-2026-07-19.md`](./admin-portal-slowness-video-vercel-correlation-2026-07-19.md)
- [`src/app/(admin)/admin/schedules/page.tsx`](<../../src/app/(admin)/admin/schedules/page.tsx>)
- [`src/components/admin/schedules-client.tsx`](../../src/components/admin/schedules-client.tsx)
- [`src/app/(admin)/layout.tsx`](<../../src/app/(admin)/layout.tsx>)
- [`src/lib/auth/admin.ts`](../../src/lib/auth/admin.ts)
- [`src/components/layout/admin-sidebar.tsx`](../../src/components/layout/admin-sidebar.tsx)
