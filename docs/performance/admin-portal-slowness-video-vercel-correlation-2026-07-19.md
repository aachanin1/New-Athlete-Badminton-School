# รายงานหลักฐานเพิ่มเติม: ความช้า Admin/Super Admin จากวิดีโอและ Vercel Logs

วันที่จัดทำ: 19 กรกฎาคม 2026
เขตเวลา: Asia/Bangkok
สถานะ: **ยืนยันปัญหาแล้ว / ยังไม่ได้แก้ไข**
ขอบเขต: ตรวจไฟล์ภาพและวิดีโอ, Vercel Runtime Logs, Supabase project/logs และ source flow แบบ read-only

> เอกสารนี้เป็นหลักฐานเพิ่มเติมต่อจาก
> [`admin-schedules-supabase-log-analysis-2026-07-14.md`](./admin-schedules-supabase-log-analysis-2026-07-14.md)
> และไม่ใช่การอนุมัติให้แก้ source, deploy หรือเปลี่ยน Production

## 1. คำถามที่ต้องการตอบ

1. อาการที่ Admin/Super Admin รายงานว่าเข้าระบบและเปลี่ยนเมนูช้า เป็นปัญหาจริงหรือไม่?
2. วิดีโอสามารถเชื่อมกับ Vercel request และ Supabase calls ที่เกิดขึ้นจริงได้หรือไม่?
3. หน้าใดช้า และแต่ละหน้าใช้เวลาประมาณเท่าใด?
4. สาเหตุเป็น SQL ตัวเดียวค้าง, Supabase ล่ม, อินเทอร์เน็ตของผู้ใช้ หรือ request waterfall?
5. ปัญหายังเกิดกับ Production หลังจากวันที่ถ่ายวิดีโอหรือไม่?
6. หลักฐานนี้ยืนยันผลกระทบต่อ User portal ทั้งระบบแล้วหรือยัง?

## 2. ข้อมูลใหม่จาก Admin/Super Admin

ข้อความที่ได้รับระบุอาการหลักดังนี้:

- เข้าระบบช้ากว่าเดิม
- เปลี่ยนหัวข้อหรือเมนูแต่ละครั้งต้องรอนาน
- ทดลองเปลี่ยนจากเครือข่ายเดิมไปใช้ Wi-Fi ของบุคคลอื่นแล้วอาการยังเหมือนเดิม
- มีการรายงานเพิ่มเติมว่าหน้ากราฟหรือภาพรวมก็ช้า

การตีความอย่างระมัดระวัง:

- การเปลี่ยน Wi-Fi แล้วยังช้า ลดความเป็นไปได้ที่ต้นเหตุเป็นเครือข่ายจุดเดียวของ Admin
- ข้อความสนทนาเป็นหลักฐานเชิงอาการ แต่ไม่มี request ID หรือเวลาระดับวินาที จึงไม่สามารถใช้ยืนยัน root cause เพียงลำพัง
- คำว่า “เข้าระบบช้า” และ “กราฟช้า” ยังต้องแยกจากความช้าของ `/admin/schedules` เพราะแต่ละ route มีภาระไม่เท่ากัน

## 3. Metadata ของวิดีโอ

ไฟล์หลักฐาน:

- ชื่อไฟล์: `74132325-9662-4365-bdfa-18a857f30d93.mp4`
- ความยาว: `00:00:56`
- Media created: `16 กรกฎาคม 2026 เวลา 12:16`
- วันที่ไฟล์ถูกบันทึกเข้ามาในเครื่อง: `19 กรกฎาคม 2026 เวลา 00:26`

จุดสำคัญคือวันที่ไฟล์เข้ามาในเครื่องไม่ใช่วันที่ถ่ายวิดีโอ การตรวจ logs จึงต้องใช้ช่วงวันที่ 16 กรกฎาคม ไม่ใช่ 24 ชั่วโมงล่าสุดของวันที่ 19 กรกฎาคม

## 4. การผูกลำดับวิดีโอกับ Vercel Runtime Logs

ลำดับ route, referer และ User Agent ใน Vercel ตรงกับการกดเมนูในวิดีโอ:

| เวลาไทย | Route | Referer | Function duration | Response finished | External API calls |
| --- | --- | --- | ---: | ---: | ---: |
| 12:14:31.18 | `/admin` | การเปิด Admin portal | 1.08 วินาที | 2 วินาที | 4 |
| 12:14:36.26 | `/admin/schedules` | `/admin` | 13.13 วินาที | 15 วินาที | 52 |
| 12:14:54.11 | `/admin/payments` | `/admin/schedules` | 6.54 วินาที | 8 วินาที | 20 |
| 12:15:04.42 | `/admin/schedules` | `/admin/payments` | 13.75 วินาที | 15 วินาที | 52 |

ทุก route ในตารางตอบ HTTP `200` ไม่มี 5xx ในลำดับนี้

### 4.1 สิ่งที่ลำดับนี้ยืนยัน

- วิดีโอไม่ใช่เพียงความรู้สึกว่าหน้าช้า แต่มี server duration รองรับ
- `/admin/schedules` ช้าทั้งการเข้าครั้งแรกและการกลับเข้าจากหน้า Payments
- `/admin/payments` ช้ากว่าหน้า `/admin` แต่ยังเร็วกว่าหน้า Schedules
- ความช้าไม่เท่ากันทุกหน้า จึงไม่ควรสรุปว่า route ทั้งระบบใช้ 20 วินาทีเท่ากัน

## 5. หลักฐานจาก Production ที่ตรวจวันที่ 19 กรกฎาคม

ตัวอย่าง read-only จากโดเมน Production หลังวันที่ถ่ายวิดีโอ:

| เวลาไทย | Route | HTTP | Function duration | Response finished | External API calls |
| --- | --- | ---: | ---: | ---: | ---: |
| 19 ก.ค. 00:28:28.55 | `/admin/schedules` | 200 | 16.58 วินาที | 18 วินาที | 53 |

ผลนี้ยืนยันว่าอาการไม่ได้จำกัดอยู่เฉพาะ deployment ที่อยู่ในวิดีโอวันที่ 16 กรกฎาคม แต่ยังพบใน Production ที่สังเกตเมื่อวันที่ 19 กรกฎาคม

สถานะ deployment และ Git ที่เปลี่ยนแปลงได้ให้ยึด `PROJECT_STATE.md` เป็นข้อมูลปัจจุบัน เอกสารนี้บันทึกเพียงสถานะที่สังเกตในเวลาตรวจเท่านั้น

## 6. การกระจาย 53 requests ของ `/admin/schedules`

ตัวอย่าง Production วันที่ 19 กรกฎาคม:

| Endpoint | จำนวน | เวลารวมของรายการที่แสดง | ช้าที่สุดต่อ request |
| --- | ---: | ---: | ---: |
| `/rest/v1/lesson_wallet_credits` | 15 | 4,782 ms | 673 ms |
| `/rest/v1/attendance` | 14 | 3,289 ms | 262 ms |
| `/rest/v1/booking_sessions` | 7 | 5,524 ms | 1,060 ms |
| `/rest/v1/teaching_programs` | 5 | 1,681 ms | 504 ms |
| `/rest/v1/coach_assignment_groups` | 5 | 3,154 ms | 909 ms |
| `/rest/v1/student_levels` | 3 | 1,157 ms | 646 ms |
| `/auth/v1/user` | 1 | 296 ms | 296 ms |
| `/rest/v1/profiles` | 1 | 639 ms | 639 ms |
| `/rest/v1/branches` | 1 | 261 ms | 261 ms |
| `/rest/v1/levels` | 1 | 222 ms | 222 ms |
| **รวม** | **53** | — | — |

ข้อควรระวัง: เวลารวมของแต่ละ endpoint นำมาบวกเป็น end-to-end time โดยตรงไม่ได้ เพราะบางกลุ่มทำงานพร้อมกัน แต่หลาย chunk ภายในกลุ่มยังรอแบบต่อเนื่อง

ข้อสรุปจากตาราง:

- ไม่พบ request เดี่ยวที่ใช้เวลา 15–20 วินาที
- request เดี่ยวที่ช้าที่สุดในตัวอย่างนี้ประมาณ 1.06 วินาที
- เวลา 18 วินาทีเกิดจากจำนวน round trips และการรอหลาย phase สะสมกัน
- ทุก external call ในตัวอย่างตอบ `200` จึงไม่ใช่ retry จาก error หรือ 5xx ที่มองเห็นได้

## 7. โครงสร้าง Source ที่สอดคล้องกับ Logs

Source หลัก:

- [`src/app/(admin)/admin/schedules/page.tsx`](<../../src/app/(admin)/admin/schedules/page.tsx>)
- [`src/app/(admin)/admin/payments/page.tsx`](<../../src/app/(admin)/admin/payments/page.tsx>)
- [`src/components/layout/admin-sidebar.tsx`](../../src/components/layout/admin-sidebar.tsx)

ค่า chunk ของหน้า Schedules:

```ts
const ATTENDANCE_QUERY_CHUNK_SIZE = 100
const RELATED_QUERY_CHUNK_SIZE = 100
const SCHEDULE_SESSION_PAGE_SIZE = 1000
```

ลำดับสำคัญของ `/admin/schedules`:

1. ตรวจ Admin access และอ่าน profile
2. โหลด booking sessions รายเดือนและ branches
3. รอ `lesson_wallet_credits` ทีละ chunk
4. โหลด assignment groups, slot sessions และ teaching programs เป็นสามกลุ่มพร้อมกัน แต่แต่ละกลุ่มยังวน chunk แบบต่อเนื่อง
5. โหลด student levels เป็น chunks พร้อมกับ level definitions
6. รอ attendance ทีละ chunk
7. สร้าง attendance state และ payload ก่อนส่งหน้าเสร็จ

Source กับ Vercel external API list ตรงกันทั้งชนิด endpoint และจำนวน chunks จึงยืนยัน **request fan-out + multi-phase waterfall** ได้โดยตรง

หน้า Payments มี helper `readChunkedRangePages()` ที่วน chunks และ range pages แบบต่อเนื่อง รวมถึงสร้าง signed URLs ของสลิปหลายรายการ จึงสอดคล้องกับตัวอย่าง 20 external calls และ response 8 วินาที

## 8. ปัจจัยด้านภูมิภาค

หลักฐานที่สังเกตได้:

- Vercel รับ request ที่ Singapore (`sin1`)
- Function Invocation ถูก route ไป Washington, D.C. (`iad1`)
- Supabase project อยู่ Seoul (`ap-northeast-2`)
- Supabase project มีสถานะ `ACTIVE_HEALTHY`

ดังนั้น request จาก Function ไป Supabase ต้องข้ามภูมิภาคหลายครั้ง การมี 52–53 round trips ทำให้ latency ต่อครั้งประมาณหลักร้อยมิลลิวินาทีสะสมเป็นหลายวินาที

ข้อสรุปนี้ไม่ได้หมายความว่าการย้าย region เพียงอย่างเดียวจะแก้ปัญหาทั้งหมด เพราะ request waterfall ใน source ยังคงมีอยู่ แต่ตำแหน่งภูมิภาคเป็นตัวคูณความรุนแรงของปัญหา

## 9. Link Prefetch ของ Sidebar

Admin sidebar ใช้ Next.js `<Link>` โดยไม่ได้กำหนด `prefetch={false}` ทำให้ Production มี RSC prefetch ไปยังหลายเมนูที่มองเห็นอยู่

Vercel Logs พบ request หลาย route ในช่วงเวลาใกล้กัน เช่น users, payments, finance, payroll, ranking และ schedules

อย่างไรก็ตาม ตัวอย่าง `/admin/ranking` ที่เกิดจาก referer `/admin/schedules`:

- response ประมาณ 513 ms
- Function ประมาณ 19 ms
- ไม่มี external API calls

จึงจัด Link prefetch เป็นภาระเสริมและสิ่งที่ควรตรวจต่อ แต่ยังไม่ใช่ root cause หลักของ `/admin/schedules` 15–18 วินาที

## 10. คำตอบแบบแยกระดับความมั่นใจ

### ยืนยันแล้ว

- Admin/Super Admin พบ latency จริง
- `/admin/schedules` ใช้เวลาประมาณ 15–18 วินาทีในตัวอย่างที่ผูกกับ Vercel ได้
- หน้า Schedules เรียก Supabase 52–53 ครั้งต่อ full render ในตัวอย่าง
- สาเหตุหลักคือ request fan-out และ multi-phase waterfall
- Source ปัจจุบันยังมี serial chunk loops ที่สอดคล้องกับจำนวน requests
- Supabase ไม่ได้ล่มหรือ pause และ requests ที่ตรวจตอบ 200
- มีความหน่วงข้ามภูมิภาคระหว่าง Vercel Function และ Supabase
- `/admin/payments` มีปัญหาคล้ายกันแต่เบากว่า โดยตัวอย่างใช้ 8 วินาทีและ 20 external calls

### มีแนวโน้ม แต่ยังไม่ใช่ข้อยุติ

- การใช้ Wi-Fi คนอื่นแล้วยังช้า ทำให้สาเหตุจากเครือข่ายเฉพาะจุดมีโอกาสน้อยลง
- Link prefetch หลาย route อาจเพิ่ม edge/network load แต่ตัวอย่างที่ตรวจไม่ได้เรียก Supabase
- การเปิดหลาย Admin พร้อมกันอาจคูณ request volume และใช้ shared capacity ร่วมกับ portal อื่น

### ยังไม่ยืนยัน

- Login ของ Admin ใช้เวลาเท่าใดในเหตุการณ์ที่ร้องเรียน
- กราฟหรือ Dashboard ช้าเพราะ query ใดโดยเฉพาะ
- User portal ทั่วไปช้าพร้อมกันในช่วงเดียวกันหรือไม่
- มีผลกระทบทางการเงินหรือทำให้ booking/payment ผิดสถานะหรือไม่
- concurrency, pool saturation หรือ compute contention เกิดขึ้นระดับใดในช่วงที่ Admin หลายคนใช้งานพร้อมกัน

## 11. ผลกระทบ

### ผลกระทบที่ยืนยันได้

- Admin/Super Admin ต้องรอ skeleton/loading เป็นเวลาหลายวินาที
- การสลับระหว่าง Schedules และ Payments มี latency ที่มองเห็นได้ชัด
- การกลับเข้า Schedules ไม่ได้เร็วขึ้นอย่างมีนัยสำคัญในวิดีโอ
- งานตรวจตารางเรียน การจัดกลุ่มโค้ช การตรวจ attendance และการตรวจชำระเงินทำได้ช้าลง

### ผลกระทบที่ยังไม่ควรอ้างว่าเกิดแล้ว

- ยังไม่มีหลักฐานว่าข้อมูล booking, payment, attendance, wallet หรือ payroll ผิดพลาดจากปัญหานี้
- ยังไม่มีหลักฐานเชิงเวลาเดียวกันที่ยืนยัน User portal outage หรือ latency ทั้งระบบ
- ยังไม่มีหลักฐานผลกระทบทางการเงินโดยตรง

## 12. แนวทางตรวจหรือแก้ที่ควรประเมินภายหลัง

รายการนี้เป็น candidate directions เท่านั้น ยังไม่ได้รับอนุมัติและยังไม่ได้ implement:

1. กำหนด performance budget สำหรับ Admin navigation และ full schedule render
2. ลดจำนวน round trips ด้วย bounded read model, SQL/RPC หรือ server-side aggregation ที่ผ่าน security review
3. parallelize chunks แบบมี concurrency limit แทนการรอทีละ chunk ทั้งหมด
4. แยก initial monthly summary ออกจากรายละเอียดรายวันหรือรายละเอียดเมื่อผู้ใช้เลือก
5. dedupe Auth/Profile reads ระหว่าง layout และ page
6. ตรวจ selective prefetch สำหรับเมนู Admin ที่มี server query หนัก
7. ตรวจตำแหน่ง Vercel Function ให้เหมาะกับ Supabase Seoul โดยประเมินผลกระทบต่อทุก route ก่อนเปลี่ยน
8. เพิ่ม structured timing/tracing ที่ไม่บันทึก PII เพื่อผูก route, phase และจำนวน rows
9. เก็บ Browser Network trace ของ Admin, Super Admin และ User ในช่วงเวลาเดียวกัน
10. ทดสอบ concurrency ด้วยข้อมูล Production-like ใน environment ที่ปลอดภัยก่อนเสนอ Production change

## 13. ขอบเขตความปลอดภัยของการตรวจ

- ไม่มี source code change
- ไม่มี migration
- ไม่มี deploy
- ไม่มี environment, feature flag หรือ allowlist change
- ไม่มี Production business-data write
- ไม่มีการแก้ booking, payment, attendance, wallet, payroll, pricing หรือ schedule data
- ไม่บันทึกชื่อผู้ใช้, email, UUID, slip path หรือข้อมูลส่วนบุคคลจาก logs ลงในรายงาน
- การอ่าน Supabase และ Vercel เป็น read-only

## 14. สรุปสุดท้าย

ปัญหาความช้าใน Admin portal มีหลักฐานรองรับ และ `/admin/schedules` เป็นจุดที่รุนแรงที่สุดในชุดข้อมูลนี้ สาเหตุหลักไม่ใช่ Supabase ล่มหรือ SQL ตัวเดียวค้าง แต่เป็นการเรียก Supabase 52–53 ครั้งผ่านหลาย phase ที่มี serial chunk loops ประกอบกับ Function และฐานข้อมูลอยู่คนละภูมิภาค ทำให้ network/API round-trip สะสมจน response ใช้ 15–18 วินาที

หน้า `/admin/payments` แสดงรูปแบบเดียวกันในระดับที่เบากว่า ส่วนคำร้องเรียนเรื่อง Login, Dashboard/กราฟ และผลกระทบต่อ User portal ยังต้องมี correlated evidence เพิ่มเติมก่อนสรุปว่าเป็นปัญหาเดียวกันทั้งหมด

## 15. แหล่งอ้างอิงภายใน Repo

- [`AGENTS.md`](../../AGENTS.md)
- [`PROJECT_STATE.md`](../../PROJECT_STATE.md)
- [`TODO-CODEX.md`](../../TODO-CODEX.md)
- [`admin-schedules-supabase-log-analysis-2026-07-14.md`](./admin-schedules-supabase-log-analysis-2026-07-14.md)
- [`src/app/(admin)/admin/schedules/page.tsx`](<../../src/app/(admin)/admin/schedules/page.tsx>)
- [`src/app/(admin)/admin/payments/page.tsx`](<../../src/app/(admin)/admin/payments/page.tsx>)
- [`src/app/(admin)/layout.tsx`](<../../src/app/(admin)/layout.tsx>)
- [`src/lib/auth/admin.ts`](../../src/lib/auth/admin.ts)
- [`src/components/layout/admin-sidebar.tsx`](../../src/components/layout/admin-sidebar.tsx)
