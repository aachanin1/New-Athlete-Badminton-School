-- ลบข้อมูลการจองทั้งหมดเพื่อเริ่มใหม่
-- Run นี้ใน Supabase SQL Editor

-- ลบ booking_sessions ก่อน (เพราะมี FK)
DELETE FROM booking_sessions;

-- ลบ payments
DELETE FROM payments;

-- ลบ bookings
DELETE FROM bookings;

-- ลองจองใหม่ได้เลย
