CREATE TABLE IF NOT EXISTS public.booking_pricing_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_type_id uuid NOT NULL REFERENCES public.course_types(id),
  lesson_year integer NOT NULL CHECK (lesson_year >= 2024),
  lesson_month integer NOT NULL CHECK (lesson_month BETWEEN 1 AND 12),
  currency text NOT NULL DEFAULT 'THB' CHECK (currency ~ '^[A-Z]{3}$'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  pricing_tier_version text,
  locked_by_payment_batch_id uuid,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_pricing_scopes_business_key UNIQUE (
    user_id,
    course_type_id,
    lesson_year,
    lesson_month,
    currency
  )
);

COMMENT ON TABLE public.booking_pricing_scopes IS
  'Additive coordination foundation for future kids_group progressive pricing. Not wired into active booking writes in Slice 1.';
COMMENT ON COLUMN public.booking_pricing_scopes.locked_by_payment_batch_id IS
  'Reserved for a future payment_batches foreign key; no payment batch table exists in Slice 1.';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pricing_scope_id uuid REFERENCES public.booking_pricing_scopes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entitlement_sessions integer,
  ADD COLUMN IF NOT EXISTS pricing_sequence integer,
  ADD COLUMN IF NOT EXISTS cumulative_sessions_before integer,
  ADD COLUMN IF NOT EXISTS cumulative_sessions_after integer,
  ADD COLUMN IF NOT EXISTS pricing_tier_id_snapshot uuid REFERENCES public.pricing_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_rate_snapshot numeric(12, 2),
  ADD COLUMN IF NOT EXISTS gross_price_snapshot numeric(12, 2),
  ADD COLUMN IF NOT EXISTS coupon_discount_snapshot numeric(12, 2),
  ADD COLUMN IF NOT EXISTS final_price_snapshot numeric(12, 2),
  ADD COLUMN IF NOT EXISTS pricing_revision bigint,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_calculated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_entitlement_sessions_check') THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_entitlement_sessions_check
      CHECK (entitlement_sessions IS NULL OR entitlement_sessions > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_pricing_sequence_check') THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_pricing_sequence_check
      CHECK (pricing_sequence IS NULL OR pricing_sequence > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_pricing_cumulative_check') THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_pricing_cumulative_check
      CHECK (
        (cumulative_sessions_before IS NULL OR cumulative_sessions_before >= 0)
        AND (cumulative_sessions_after IS NULL OR cumulative_sessions_after > 0)
        AND (
          cumulative_sessions_before IS NULL
          OR cumulative_sessions_after IS NULL
          OR cumulative_sessions_after >= cumulative_sessions_before
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_pricing_money_snapshot_check') THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_pricing_money_snapshot_check
      CHECK (
        (pricing_rate_snapshot IS NULL OR pricing_rate_snapshot >= 0)
        AND (gross_price_snapshot IS NULL OR gross_price_snapshot >= 0)
        AND (coupon_discount_snapshot IS NULL OR coupon_discount_snapshot >= 0)
        AND (final_price_snapshot IS NULL OR final_price_snapshot >= 0)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_pricing_revision_check') THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_pricing_revision_check
      CHECK (pricing_revision IS NULL OR pricing_revision >= 1);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_booking_pricing_scopes_user_period_course
  ON public.booking_pricing_scopes(user_id, lesson_year, lesson_month, course_type_id);

CREATE INDEX IF NOT EXISTS idx_booking_pricing_scopes_locked
  ON public.booking_pricing_scopes(locked_at)
  WHERE locked_by_payment_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_pricing_scopes_updated_at
  ON public.booking_pricing_scopes(updated_at);

CREATE INDEX IF NOT EXISTS idx_bookings_pricing_scope_sequence
  ON public.bookings(pricing_scope_id, pricing_sequence)
  WHERE pricing_scope_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_progressive_expiry
  ON public.bookings(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE OR REPLACE TRIGGER tr_booking_pricing_scopes_updated_at
BEFORE UPDATE ON public.booking_pricing_scopes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.booking_pricing_scopes ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.booking_pricing_scopes TO service_role;
