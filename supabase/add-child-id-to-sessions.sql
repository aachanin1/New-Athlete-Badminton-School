-- Add child_id to booking_sessions so each session knows which child it belongs to.
-- This enables 1 booking = 1 bill, even for multi-child bookings.

ALTER TABLE booking_sessions
  ADD COLUMN child_id UUID REFERENCES children(id) ON DELETE SET NULL;

-- Backfill existing sessions: copy child_id from parent booking
UPDATE booking_sessions bs
SET child_id = b.child_id
FROM bookings b
WHERE bs.booking_id = b.id AND b.child_id IS NOT NULL;
