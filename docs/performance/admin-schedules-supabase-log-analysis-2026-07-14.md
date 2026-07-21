# รายงานวิเคราะห์ความช้า `/admin/schedules`

วันที่ตรวจ: 14 กรกฎาคม 2026
เขตเวลา: Asia/Bangkok
สถานะ: **ยืนยันปัญหาแล้ว / ยังไม่ได้แก้ไข**
ขอบเขต: อ่าน Supabase logs, Performance Advisor, สถิติ query, จำนวนข้อมูล และ source flow แบบ read-only

## 1. คำถามที่ต้องการตอบ

> เหตุใดการเปิดหน้า `/admin/schedules` จึงใช้เวลามากกว่า 20 วินาที และมีผลกระทบต่อผู้ใช้งานมากน้อยเพียงใด?

คำถามย่อย:

1. Supabase มีสถานะผิดปกติ ล่ม ถูก pause หรือ resource หมดหรือไม่?
2. มี SQL query ตัวใดตัวหนึ่งใช้เวลา 20 วินาทีหรือไม่?
3. หน้าเว็บเรียก Supabase กี่ครั้งต่อการ render?
4. ปริมาณข้อมูล Production ทำให้จำนวนคำขอเพิ่มขึ้นอย่างไร?
5. ปัญหานี้กระทบเฉพาะ Admin หรือพิสูจน์ได้แล้วว่ากระทบ User ทั้งระบบ?
6. งานแก้ Admin Schedules วันที่ 1 กรกฎาคม 2026 แก้ปัญหานี้แล้วหรือยัง?

## 2. คำตอบสรุป

### 2.1 ข้อสรุปหลัก

ปัญหาเวลาโหลด 20+ วินาทีมีหลักฐานรองรับ แต่ไม่ใช่ SQL ตัวเดียวค้าง 20 วินาที สาเหตุหลักที่ยืนยันได้คือหน้า `/admin/schedules` สร้างคำขอ Supabase จำนวนมากเป็นหลายช่วงต่อกัน หรือ **request fan-out + waterfall**

ในหนึ่ง render จากข้อมูลเดือนกรกฎาคม 2026 หน้า schedules ต้องสร้าง Supabase data requests ประมาณ `50` ครั้ง ยังไม่รวมคำขอ Auth, Profile, Notification และคำขอที่อาจเกิดจาก RSC render/prefetch ซ้ำ

### 2.2 การจำแนกผล

| ประเด็น | ผล |
| --- | --- |
| หน้า `/admin/schedules` ใช้เวลา 20+ วินาทีจริงหรือไม่ | **ยืนยันแล้ว** จากช่วงคำขอ Supabase 24.816 วินาที |
| Supabase Project ล่มหรือถูก pause หรือไม่ | **ไม่พบ** — Project เป็น `ACTIVE_HEALTHY` |
| มี SQL ตัวเดียวช้า 20 วินาทีหรือไม่ | **ไม่พบ** — query family ที่เกี่ยวข้องมีค่าสูงสุดที่สังเกตได้ประมาณ 1.226 วินาที |
| มี request waterfall หรือไม่ | **ยืนยันแล้ว** จาก source และลำดับ API logs |
| จำนวนข้อมูลมีผลต่อจำนวน requests หรือไม่ | **ยืนยันแล้ว** — 1,373 sessions ถูกแบ่งเป็น chunks ละ 100 |
| มี Auth/Profile calls ซ้ำผิดสังเกตหรือไม่ | **ยืนยันว่ามีการเรียกซ้ำมาก** แต่สาเหตุระดับ request ยังต้องผูกกับ Vercel/RSC trace |
| กระทบ Admin UX หรือไม่ | **ยืนยันแล้ว** — Admin ต้องรอข้อมูลก่อนหน้า render เสร็จ |
| กระทบ User ทั้งระบบอย่างรุนแรงแล้วหรือไม่ | **ยังพิสูจน์ไม่ได้** — มีความเสี่ยงจาก shared capacity แต่ log ชุดนี้ไม่มี timeout/5xx หรือ latency ของหน้าผู้ใช้ทั่วไป |
| มีการแก้ไขในรอบตรวจนี้หรือไม่ | **ไม่มี** — read-only ทั้งหมด |

## 3. หลักฐานจาก Supabase API logs

### 3.1 ช่วงเวลาที่พบ

ช่วง `14 กรกฎาคม 2026 เวลา 21:31:41.896–21:32:06.712` ตามเวลาไทย:

- พบคำขอ Supabase อย่างน้อย `100 requests`
- ครอบคลุมเวลา `24.816 วินาที`
- ทั้ง 100 requests ตอบ `HTTP 200`
- ผลลัพธ์จากเครื่องมือถูกจำกัดที่ 100 รายการ จึงใช้คำว่า “อย่างน้อย 100”
- ไม่พบ 5xx, timeout, deadlock หรือ connection exhaustion ในชุดนี้

การกระจาย requests ใน snapshot แรก:

| Endpoint | จำนวน requests |
| --- | ---: |
| `/auth/v1/user` | 26 |
| `/rest/v1/profiles` | 24 |
| `/rest/v1/attendance` | 14 |
| `/rest/v1/lesson_wallet_credits` | 14 |
| `/rest/v1/booking_sessions` | 7 |
| `/rest/v1/coach_assignment_groups` | 5 |
| `/rest/v1/teaching_programs` | 5 |
| `/rest/v1/student_levels` | 3 |
| `/rest/v1/levels` | 1 |
| `/rest/v1/branches` | 1 |

เฉพาะช่วงท้ายที่ตรงกับ query flow ของ schedules พบ `37 requests` ภายใน `10.028 วินาที` โดยยังไม่รวม session query, branch query และ Auth/Profile ที่เกิดก่อนหน้านั้น

### 3.2 สิ่งที่ API logs บอกไม่ได้

Supabase API log ที่อ่านได้ไม่มี correlation id ที่เชื่อมตรงกับ Vercel function/RSC request และไม่มี end-to-end duration ของหน้า Next.js จึงยังแยกไม่ได้อย่างเด็ดขาดว่า Auth/Profile burst เกิดจาก:

- route render ซ้ำ
- Next.js RSC requests หลายครั้ง
- Link prefetch
- browser navigation มากกว่าหนึ่งครั้ง
- request จาก surface อื่นของผู้ใช้คนเดียวกัน

ดังนั้นเอกสารนี้ไม่ฟันธงสาเหตุของ Auth/Profile burst เกินกว่าหลักฐานที่มี

## 4. ปริมาณข้อมูล Production ที่เกี่ยวข้อง

การนับแบบ read-only สำหรับเดือนกรกฎาคม 2026 พบ:

| ข้อมูล | จำนวน |
| --- | ---: |
| Verified, non-rescheduled booking sessions | 1,373 |
| Distinct schedule slots | 418 |
| Distinct learners | 252 |

ตัวเลขเหล่านี้อธิบายจำนวน chunks ใน log ได้ตรงกัน:

- Sessions 1,373 รายการ / chunk 100 = 14 wallet chunks
- Schedule slots 418 รายการ / chunk 100 = 5 group, slot-session และ program chunks ต่อชนิด
- Learners 252 คน / chunk 100 = 3 student-level chunks
- Attendance scope ระดับประมาณ 1,373 sessions / chunk 100 = 14 attendance chunks

## 5. Source flow ที่ทำให้เกิด waterfall

Source หลัก: [`src/app/(admin)/admin/schedules/page.tsx`](<../../src/app/(admin)/admin/schedules/page.tsx>)

ค่าปัจจุบัน:

```ts
const ATTENDANCE_QUERY_CHUNK_SIZE = 100
const RELATED_QUERY_CHUNK_SIZE = 100
const SCHEDULE_SESSION_PAGE_SIZE = 1000
```

ลำดับ server render ปัจจุบัน:

1. ตรวจ Admin access
2. โหลด monthly booking sessions พร้อม branches
3. รอ wallet-credit chunks ทีละชุด
4. โหลด assignment groups, slot sessions และ teaching programs พร้อมกันสามกลุ่ม แต่แต่ละกลุ่มวน chunks แบบต่อเนื่อง
5. รอ student-level chunks และ level definitions
6. รอ attendance chunks ทีละชุด
7. สร้าง attendance state, rounds และ client payload
8. ส่ง `SchedulesClient` หลังข้อมูลทั้งหมดพร้อม

ประมาณการ data requests ต่อหนึ่ง render จากข้อมูลเดือนกรกฎาคม:

| Query group | Requests |
| --- | ---: |
| Monthly booking sessions | 2 |
| Branches | 1 |
| Wallet credits | 14 |
| Assignment groups | 5 |
| Slot sessions | 5 |
| Teaching programs | 5 |
| Student levels | 3 |
| Level definitions | 1 |
| Attendance | 14 |
| **รวมเฉพาะข้อมูลหน้า schedules** | **50** |

คำขอ Auth/Layout เพิ่มเติม:

- Admin layout เรียก `requireAdminPageAccess()`
- Schedules page เรียก `requireAdminPageAccess()` ซ้ำอีกครั้ง
- แต่ละครั้งอ่าน `/auth/v1/user` และ `profiles`
- Admin layout อ่าน notification count เพิ่มอีกหนึ่ง query
- Standard Admin อาจอ่าน `system_settings` เพิ่ม

Source ที่เกี่ยวข้อง:

- [`src/app/(admin)/layout.tsx`](<../../src/app/(admin)/layout.tsx>)
- [`src/lib/auth/admin.ts`](../../src/lib/auth/admin.ts)
- [`src/components/layout/admin-sidebar.tsx`](../../src/components/layout/admin-sidebar.tsx)

## 6. สถิติความเร็วของ query

ข้อมูล `pg_stat_statements` ถูกสะสมตั้งแต่ `2026-05-06 07:19:22 UTC` จึงเป็นสถิติย้อนหลัง ไม่ใช่ timing เฉพาะ request เวลา 21:31 เท่านั้น

| Query family | Weighted mean | Observed max |
| --- | ---: | ---: |
| Monthly schedule sessions | 247.46 ms | 1,226.20 ms |
| Slot session chunks | 123.87 ms | 418.08 ms |
| Assignment group chunks | 34.84 ms | 211.54 ms |
| Teaching program chunks | 7.42 ms | 97.63 ms |
| Student level chunks | 2.30 ms | 103.49 ms |
| Wallet chunks | 0.90 ms | 74.86 ms |
| Attendance chunks | 0.81 ms | 43.51 ms |

การตีความ:

- Monthly session query เป็น query family ที่หนักที่สุดใน flow นี้
- แต่แม้ค่ามากสุดที่เคยพบประมาณ 1.226 วินาที ก็ยังไม่ใช่คำอธิบายของเวลา 20+ วินาทีเพียงตัวเดียว
- เวลาโดยรวมเกิดจากจำนวน network/API round trips และช่วงที่ต้องรอ phase ก่อนหน้าเสร็จ
- ค่าเฉลี่ยในตารางไม่รวม browser-to-Vercel, Vercel cold start, RSC orchestration, TLS/network และ serialization ของ JSON payload

## 7. Postgres logs และ Performance Advisor

### 7.1 Postgres logs

ใน 100 Postgres log entries ล่าสุดขณะตรวจ:

- `LOG` 99 รายการ
- `ERROR` 1 รายการ
- ไม่พบ timeout, deadlock, lock wait หรือ connection exhaustion ที่ตรงกับ schedules load
- Error หนึ่งรายการเป็น `progressive_payment_batch_bookings.id does not exist` เวลา 15:13 น. ซึ่งไม่เกี่ยวข้องกับ schedules load เวลา 21:31 น.

### 7.2 Advisor findings ที่เกี่ยวข้อง

Performance Advisor พบความเสี่ยงที่อาจเพิ่มต้นทุน query:

- RLS policies บน `profiles`, `children`, `bookings`, `booking_sessions`, `attendance`, `student_levels`, `coach_assignment_groups`, `coach_assignment_group_students`, `lesson_wallet_credits` และ `teaching_programs` เรียก Auth function ซ้ำต่อแถว (`auth_rls_initplan`)
- หลายตารางมี multiple permissive policies ซึ่งต้องประเมิน policy มากกว่าหนึ่งชุด
- มี foreign keys บางรายการที่ไม่มี covering index เช่น:
  - `booking_sessions.branch_id`
  - `booking_sessions.child_id`
  - `teaching_programs.schedule_slot_id`
  - foreign keys บางส่วนใน `lesson_wallet_credits`

ข้อควรระวัง: Advisor findings เป็นปัญหาจริงที่ควรตรวจต่อ แต่ยังไม่ใช่หลักฐานว่ารายการใดรายการหนึ่งเป็น root cause หลักของ 20+ วินาที เพราะ request fan-out/waterfall ถูกยืนยันตรงกว่า

## 8. ความสัมพันธ์กับงานวันที่ 1 กรกฎาคม 2026

วันที่ 1 กรกฎาคมมีการ deploy `Admin Schedules Performance UX/Render Fix` commit `0d70e427...`

งานเดิมแก้:

- ไม่ render รายละเอียดรอบ/ผู้เรียนทั้งเดือนทันที
- แสดง month overview ก่อนเลือกวัน
- เพิ่ม pending/loading state
- memoize client computations

งานเดิมระบุชัดว่า **ไม่ได้เปลี่ยน server query semantics, Supabase chunking หรือ pagination**

ดังนั้น:

- ปัญหา client rendering เดิมได้รับการบรรเทาแล้ว
- ปัญหา server data loading/request waterfall ที่พบครั้งนี้ยังคงอยู่
- ไม่มี Documentation Drift ระหว่างผลสองรอบ เพราะเป็นปัญหาคนละชั้น

## 9. การประเมินผลกระทบต่อผู้ใช้งาน

### ยืนยันแล้ว

- Admin ที่เปิด `/admin/schedules` ต้องรอ server data flow จำนวนมากก่อนหน้าแสดงผลสมบูรณ์
- การเปลี่ยนเดือนทำให้เกิด flow ใกล้เคียงกันอีกครั้ง
- Request volume โตตามจำนวน sessions, slots และ learners ของเดือน
- การเปิดหนึ่งหน้าสามารถใช้ Supabase requests หลายสิบรายการ

### ความเสี่ยงที่มีเหตุผลรองรับ แต่ยังไม่พิสูจน์ end-to-end

- หากมี Admin หลายคนเปิด/เปลี่ยนเดือนพร้อมกัน request volume จะคูณตามจำนวน render
- requests เหล่านี้ใช้ API/DB connection และ compute ร่วมกับ User, Coach และ public flows
- ภายใต้ concurrency สูงอาจเพิ่ม queueing และ latency ให้ surface อื่น

### ยังยืนยันไม่ได้

- User portal ช้าลงกี่วินาทีจาก Admin schedules โดยตรง
- มีผู้ใช้กี่คนได้รับผลกระทบ
- มี connection pool saturation ในช่วงเดียวกันหรือไม่
- Vercel cold start, function region หรือ RSC prefetch มีสัดส่วนกี่วินาที
- Auth/Profile burst ทั้งหมดมาจาก schedules navigation เดียวหรือไม่

การกล่าวว่า “กระทบ User ทั้งระบบอย่างรุนแรงแล้ว” จึงยังเร็วเกินหลักฐาน ปัจจุบันควรจัดเป็น **Confirmed Admin latency + credible shared-capacity risk**

## 10. Root-cause ranking

### ยืนยันแล้ว

1. Request fan-out ประมาณ 50 Supabase data requests ต่อ render
2. Serial chunk loops ทำให้เกิด waterfall หลาย phase
3. Payload รายเดือนมีขนาดใหญ่: 1,373 sessions / 418 slots / 252 learners
4. Layout และ page ตรวจ Auth/Profile แยกกัน

### มีความเป็นไปได้สูง แต่ต้องมี trace เพิ่ม

1. RSC render/prefetch/navigation ซ้ำ ทำให้ Auth/Profile burst สูงผิดปกติ
2. Network/API round-trip overhead ระหว่าง Vercel และ Supabase สะสมจาก serial requests
3. JSON serialization และการประกอบ payload ขนาดใหญ่เพิ่ม server response time

### เป็นปัจจัยรองที่ควรตรวจ

1. RLS init-plan warnings
2. Multiple permissive policies
3. Index gaps บางรายการ
4. ตำแหน่ง Vercel function เทียบกับ Supabase region

## 11. แผนตรวจสอบรอบถัดไปแบบ read-only

เพื่อยืนยันสัดส่วนเวลาแต่ละชั้น ควรทำตามลำดับ:

1. กำหนด reproduction window หนึ่งครั้ง พร้อมเวลาเริ่ม/สิ้นสุดที่แม่นยำ
2. เก็บ Browser Network waterfall ของ navigation `/admin/schedules`
3. เก็บ Vercel function/RSC logs ในช่วงเดียวกัน
4. ผูก Vercel request กับ Supabase endpoint timeline
5. แยก cold load, warm load และเปลี่ยนเดือน
6. ตรวจว่ามี Link prefetch หรือ repeated RSC requests กี่ครั้งจริง
7. วัด TTFB, server duration, RSC payload size และ transferred bytes
8. ตรวจ query plans ของ monthly session query และ slot-session query ด้วยค่าพารามิเตอร์ที่ปลอดภัย
9. ตรวจ connection/pool/compute metrics ในช่วง concurrency
10. สรุป performance budget ก่อนเสนอ source change

## 12. แนวทางแก้ที่ควรประเมินภายหลัง

รายการนี้เป็นเพียง candidate directions ยังไม่ได้รับอนุมัติและยังไม่ได้ implement:

- ลดจำนวน round trips ด้วย server-side SQL/RPC/read model ที่คืนข้อมูลเป็นก้อนที่มีขอบเขตชัดเจน
- เปลี่ยน monthly initial payload ให้เป็น summary และโหลด daily detail เมื่อเลือกวัน
- รวม/dedupe Auth context ระหว่าง layout กับ page
- ตรวจและจำกัด Next.js prefetch สำหรับเมนู Admin ที่มี server query หนัก
- parallelize bounded chunks โดยมี concurrency limit
- เพิ่ม chunk size เฉพาะเมื่อพิสูจน์ว่า URL/payload/timeout ปลอดภัย
- เพิ่ม index ตาม query plan ไม่ใช่เพิ่มตาม Advisor อย่างเดียว
- ปรับ RLS policies หลัง security review และ regression proof
- cache ข้อมูลที่เปลี่ยนน้อย เช่น active levels/branches โดยไม่ cache attendance หรือข้อมูลสดอย่างไม่เหมาะสม
- เพิ่ม production timing/trace ที่ไม่เก็บ PII

## 13. ขอบเขตความปลอดภัยของการตรวจครั้งนี้

- ไม่มี source code change
- ไม่มี migration
- ไม่มี deploy
- ไม่มี environment/feature-flag/allowlist change
- ไม่มี Production business-data write
- ไม่มีการเปลี่ยน booking, payment, attendance, wallet, payroll, pricing หรือ schedule data
- SQL ที่ใช้เป็น `SELECT`/read-only สำหรับ count และ query statistics เท่านั้น
- รายงานไม่บันทึกชื่อผู้ใช้ UUID หรือข้อมูลส่วนบุคคลจาก logs

## 14. แหล่งอ้างอิงภายใน repo

- [`AGENTS.md`](../../AGENTS.md)
- [`PROJECT_STATE.md`](../../PROJECT_STATE.md)
- [`TODO-CODEX.md`](../../TODO-CODEX.md)
- [`src/app/(admin)/admin/schedules/page.tsx`](<../../src/app/(admin)/admin/schedules/page.tsx>)
- [`src/app/(admin)/layout.tsx`](<../../src/app/(admin)/layout.tsx>)
- [`src/lib/auth/admin.ts`](../../src/lib/auth/admin.ts)
- [`src/components/layout/admin-sidebar.tsx`](../../src/components/layout/admin-sidebar.tsx)
- Historical record: `PROJECT_STATE.md` section `2026-07-01 - Admin Schedules Performance UX/Render Fix`
