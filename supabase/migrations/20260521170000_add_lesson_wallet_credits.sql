ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'walleted';

CREATE TABLE IF NOT EXISTS public.lesson_wallet_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  original_session_id uuid NOT NULL UNIQUE REFERENCES public.booking_sessions(id) ON DELETE CASCADE,
  redeemed_session_id uuid UNIQUE REFERENCES public.booking_sessions(id) ON DELETE SET NULL,
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  course_type_id uuid NOT NULL REFERENCES public.course_types(id),
  original_schedule_slot_id uuid REFERENCES public.schedule_slots(id) ON DELETE SET NULL,
  original_date date NOT NULL,
  original_start_time time NOT NULL,
  original_end_time time NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
  stored_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  expired_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_wallet_credits_user_status
  ON public.lesson_wallet_credits(user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_lesson_wallet_credits_booking
  ON public.lesson_wallet_credits(booking_id);

CREATE INDEX IF NOT EXISTS idx_lesson_wallet_credits_original_month
  ON public.lesson_wallet_credits(user_id, original_date);

CREATE OR REPLACE TRIGGER tr_lesson_wallet_credits_updated_at
BEFORE UPDATE ON public.lesson_wallet_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.lesson_wallet_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lesson wallet credits" ON public.lesson_wallet_credits;
CREATE POLICY "Users can view own lesson wallet credits"
  ON public.lesson_wallet_credits
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can view lesson wallet credits" ON public.lesson_wallet_credits;
CREATE POLICY "Staff can view lesson wallet credits"
  ON public.lesson_wallet_credits
  FOR SELECT
  USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can manage lesson wallet credits" ON public.lesson_wallet_credits;
CREATE POLICY "Admins can manage lesson wallet credits"
  ON public.lesson_wallet_credits
  FOR ALL
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

GRANT ALL ON TABLE public.lesson_wallet_credits TO anon;
GRANT ALL ON TABLE public.lesson_wallet_credits TO authenticated;
GRANT ALL ON TABLE public.lesson_wallet_credits TO service_role;
