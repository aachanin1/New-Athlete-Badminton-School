-- Expand the school level master from LV 1-60 to LV 1-70.
-- Source: level.md provided by the school owner.

ALTER TABLE public.levels DROP CONSTRAINT IF EXISTS levels_id_check;
ALTER TABLE public.levels
  ADD CONSTRAINT levels_id_check CHECK (id BETWEEN 1 AND 70);

ALTER TABLE public.student_levels DROP CONSTRAINT IF EXISTS student_levels_level_check;
ALTER TABLE public.student_levels
  ADD CONSTRAINT student_levels_level_check CHECK (level BETWEEN 1 AND 70);

ALTER TABLE public.levels
  ADD COLUMN IF NOT EXISTS program_name TEXT,
  ADD COLUMN IF NOT EXISTS requirements TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

WITH incoming(id, name, requirements, category) AS (
  VALUES
  (1, $$เซฟ$$, NULL, 'basic'::public.level_category),
  (2, $$เซฟท่าถูก$$, NULL, 'basic'::public.level_category),
  (3, $$มือโยนลูกแล้วเซฟโดน$$, NULL, 'basic'::public.level_category),
  (4, $$เสริฟลูกแล้วเซฟโดน$$, NULL, 'basic'::public.level_category),
  (5, $$โต้ได้ 2 ลูก$$, NULL, 'basic'::public.level_category),
  (6, $$โต้ได้ 5 ลูก$$, NULL, 'basic'::public.level_category),
  (7, $$โต้ได้ 10 ลูกขึ้นไป$$, $$Test จดทางตีที่ผิดละบอกโค้ช$$, 'basic'::public.level_category),
  (8, $$เซฟแล้วเคลื่อนตัวเข้ามากลาง ถอยตรงๆเซฟ$$, NULL, 'basic'::public.level_category),
  (9, $$เริ่มถอยเฉียงเซฟโฟร์ และ Over Head$$, NULL, 'basic'::public.level_category),
  (10, $$ดาด (ขั้นเพื่อกันเบื่อเพราะเป็นโปรแกรมสนุก)$$, NULL, 'basic'::public.level_category),
  (11, $$สอนดาดโฟร์$$, NULL, 'basic'::public.level_category),
  (12, $$สอนดาดแบ๊ค$$, NULL, 'basic'::public.level_category),
  (13, $$หยอด$$, NULL, 'basic'::public.level_category),
  (14, $$หยอดแบ๊ค หยอดโฟร์$$, NULL, 'basic'::public.level_category),
  (15, $$เซฟวิ่งตรงๆเข้ามาหยอด$$, NULL, 'basic'::public.level_category),
  (16, $$สอนวิ่งคอร์ดหยอด 2 มุมหน้า$$, NULL, 'basic'::public.level_category),
  (17, $$วิ่งเซฟๆ หยอดๆ$$, $$Test จดทางตีที่ผิดละบอกโค้ช$$, 'basic'::public.level_category),
  (18, $$วิ่งเซฟหยอด แลนดอมได้$$, NULL, 'basic'::public.level_category),
  (19, $$งัด$$, NULL, 'basic'::public.level_category),
  (20, $$ยืนงัดแบ๊ค$$, NULL, 'basic'::public.level_category),
  (21, $$วิ่งงัดแบ๊ค$$, NULL, 'basic'::public.level_category),
  (22, $$ยืนงัดโฟร์$$, $$Test จดทางตีที่ผิดละบอกโค้ช$$, 'basic'::public.level_category),
  (23, $$วิ่งงัดโฟร์$$, NULL, 'basic'::public.level_category),
  (24, $$วิ่งงัด 2 ข้างพร้อมกัน$$, NULL, 'basic'::public.level_category),
  (25, $$เซฟโฟร์เซฟoverhead ต่อด้วยวิ่งงัดโฟร์แบ๊คพร้อมกัน$$, NULL, 'basic'::public.level_category),
  (26, $$เซฟเข้าวิ่งตรงมางัด$$, NULL, 'basic'::public.level_category),
  (27, $$เซฟวิ่งเฉียงมางัด$$, NULL, 'basic'::public.level_category),
  (28, $$เซฟๆงัดๆ$$, NULL, 'basic'::public.level_category),
  (29, $$ลูกเสริฟ (เอามาขั้น เพื่อสร้างทักษะที่จำเป็น)$$, $$Test จดทางตีที่ผิดละบอกโค้ช$$, 'basic'::public.level_category),
  (30, $$วิ่งรับลูกด้านข้างโฟร์ แบ๊ค$$, $$Test จดทางตีที่ผิดละบอกโค้ช$$, 'basic'::public.level_category),
  (31, $$ตบ$$, NULL, 'basic'::public.level_category),
  (32, $$เคลื่อนตัวตบ$$, NULL, 'basic'::public.level_category),
  (33, $$ตัด$$, NULL, 'basic'::public.level_category),
  (34, $$เคลื่อนตัวตัด$$, NULL, 'basic'::public.level_category),
  (35, $$แก้ท่าตี ที่ยังไม่ถูกให้ถูกต้อง$$, $$สอนทัศนะคติทำไมต้องวิ่งรับให้ได้ทุกมุม โดยให้ไปตีเกมกับเพื่อนก่อนซ้อม และมาถามว่าเสียแต้มเพราะอะไร$$, 'athlete_1'::public.level_category),
  (36, $$เคลื่อนไปทุกมุม 6 มุมได้คล่อง$$, NULL, 'athlete_1'::public.level_category),
  (37, $$สอนวิ่งแก้ล่วงตีรับลูก 2 มุมหลัง$$, $$Test แก้ล่วง แจกต่อเนื่อง 10 นฬ 14/20 ลูกผ่านทีละลูก
Test รับลูกเซฟงัดเต็มสนามเพื่อนให้ได้ 10 ลูกไม่เสีย
มุมที่เข้ามาตีต้องเลือกตีได้ทั้งตรงและเฉียง$$, 'athlete_1'::public.level_category),
  (38, $$สอนทัศนคติเลือกช่องตี$$, NULL, 'athlete_1'::public.level_category),
  (39, $$สอนแจกลูกพื้นฐานเฉียงและตรง เซฟ ตัด ตบ งัด เลี้ยว ให้ได้ และให้คู่แข่งไม่รู้$$, $$Test ให้นักกีฬาเลือกตีทีละมุมคมๆ เกิน 10 ลูก นฬ 14/20 ลูกผ่านทีละลูก
Test ให้นักเรียนตีเดี่ยวหรือตีคู่ โค้ชประเมินว่ามีการเลือกตีไหม$$, 'athlete_1'::public.level_category),
  (40, $$สอนเปิดลูกเสริฟให้ได้เปรียบ สอนรับลูกเปิดเสริฟให้ไม่เสียเปรียบ$$, $$สอนทัศนะคติรูปแบบเกม ว่าตีโปรแกรมไหนแล้วเสียเปรียบ$$, 'athlete_1'::public.level_category),
  (41, $$ออกลูกทุกลูกพื้นฐานได้แน่น$$, $$วิ่งแลนดอมตีซ้ายขวา ตีไปมุมนั้นคมๆ 10 ลูก นฬ 14/20 ลูกผ่านทีละลูก$$, 'athlete_1'::public.level_category),
  (42, $$สอนลูกทำแต้ม เริ่มแข่งได้$$, $$ให้ตีลากโยกคู่ซ้อม แล้วค่อยสอนเพิ่มอาวุธลูกฟัน
ฝึกคิดให้เดินบีบ + ปล่อยลูกทั่วสนามให้บุกล็อคทางการตีของเพื่อน แล้ววิ่งไปตีลมต่อ$$, 'athlete_1'::public.level_category),
  (43, $$ทัศนคติในการเล่นคู่/ช่วยกันรับ/เปลี่ยนจากรับเป็นบุก$$, NULL, 'athlete_1'::public.level_category),
  (44, $$ฝึกลูกฟันทุกมุม$$, $$Test ฟัน 10 นฬ 14/20 ลูกผ่านทีละลูก$$, 'athlete_1'::public.level_category),
  (45, $$ฝึกหลอกหน้าไม้ตัด$$, $$Test หลอกตัด 10 นฬ 14/20 ลูกผ่านทีละลูก$$, 'athlete_1'::public.level_category),
  (46, $$หยอดเขี่ยหัวลูกลงพื้นเร็วๆ$$, $$Test หยอด 10 นฬ 14/20 ลูกผ่านทีละลูก$$, 'athlete_1'::public.level_category),
  (47, $$ฝึกหยอดปั่น$$, $$Test ปั่น 10 นฬ 14/20 ลูกผ่านทีละลูก$$, 'athlete_1'::public.level_category),
  (48, $$รับลูกตบแบบคู่$$, NULL, 'athlete_1'::public.level_category),
  (49, $$สอนวิ่งวนแบบคู่มีกี่แบบ$$, NULL, 'athlete_1'::public.level_category),
  (50, $$หยอดทิ้งร่ม$$, $$Test หยอดทิ้งร่ม 10 นฬ 14/20 ลูกผ่านทีละลูก$$, 'athlete_1'::public.level_category),
  (51, $$สอนเข้าหน้าเหลี่ยมไม้แบบแย่บ เลือกตีลูกต่างๆ$$, NULL, 'athlete_1'::public.level_category),
  (52, $$สอนลูกแบ๊คแฮนหลัง$$, $$Test แบ๊คหลังแจก 10 นฬ 14/20 ลูกผ่านทีละลูก$$, 'athlete_1'::public.level_category),
  (53, $$สอนกระโดดตบสลับขา$$, $$การทำแต้มคมๆ$$, 'athlete_1'::public.level_category),
  (54, $$สอนลูกเคาะ$$, $$เปลี่ยนจังหวะตี$$, 'athlete_1'::public.level_category),
  (55, $$สอนเปลี่ยนจังหวะด้านหน้า$$, NULL, 'athlete_1'::public.level_category),
  (56, $$สอนเปลี่ยนจังหวะด้านหลัง$$, $$ฝึกตีแบบกินติ่ง เข้าเร็วที รอที$$, 'athlete_1'::public.level_category),
  (57, $$สอนกระโดดขาคู่$$, $$กลยุทธ์ ตีแล้วทำให้ล็อคมุมการตีของคู่ต่อสู้$$, 'athlete_1'::public.level_category),
  (58, $$เรียบครบ และซ้อมทักษะทั้งหมดให้ดี$$, NULL, 'athlete_1'::public.level_category),
  (59, $$ทำยังไงถึงจะเสียแต้มน้อยลง$$, NULL, 'athlete_2'::public.level_category),
  (60, $$ทำยังไงถึงจะได้แต้มมากขึ้น$$, NULL, 'athlete_2'::public.level_category),
  (61, $$ฝึกก้าวตีในขาที่ไม่ถนัด$$, NULL, 'athlete_2'::public.level_category),
  (62, $$ฝึกออกลูกให้ปลอดภัย โดยฝึกจากออกลูกไปหาเพื่อนแล้วเพื่อนเสียหลักหน่อยๆ$$, NULL, 'athlete_2'::public.level_category),
  (63, $$เทคนิค เทคติกในการเล่นเกม มาจากการตีเกม$$, NULL, 'athlete_2'::public.level_category),
  (64, $$เทคนิคขั้นสูง$$, NULL, 'athlete_2'::public.level_category),
  (65, $$ตีล่อให้คู่แข่งตีมามุมที่เราต้องการ$$, NULL, 'athlete_2'::public.level_category),
  (66, $$ฝึกคิดว่าคู่ต่อสู้จะถนัดมุมไหน$$, NULL, 'athlete_2'::public.level_category),
  (67, $$ตีลูกที่เราไม่ถนัดให้ได้$$, NULL, 'athlete_2'::public.level_category),
  (68, $$เทคนิค วิธีทำให้ได้เปรียบคู่ต่อสู้$$, NULL, 'athlete_2'::public.level_category),
  (69, $$โปรแกรมบุกต้องนับเฉพาะได้แต้มจาก 2 มุมหน้า / จาก 2 มุมหลัง$$, NULL, 'athlete_2'::public.level_category),
  (70, $$โปรแกรมฝึกฝีมือ ฟิวลิ่ง ออกลูกบังคับให้ไปที่จุดหรือมุม หน้า กลาง หลัง เต็มคอร์ด$$, NULL, 'athlete_2'::public.level_category)
)
INSERT INTO public.levels (id, name, description, category, program_name, requirements, is_active, updated_at)
SELECT
  id,
  name,
  NULL,
  category,
  CASE
    WHEN id BETWEEN 1 AND 34 THEN 'ชุดพื้นฐาน'
    WHEN id BETWEEN 35 AND 58 THEN 'ชุดเตรียมนักกีฬา ชุด C'
    ELSE 'ชุดนักกีฬา ชุด B'
  END,
  requirements,
  true,
  now()
FROM incoming
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  program_name = EXCLUDED.program_name,
  requirements = EXCLUDED.requirements,
  is_active = EXCLUDED.is_active,
  updated_at = now();
