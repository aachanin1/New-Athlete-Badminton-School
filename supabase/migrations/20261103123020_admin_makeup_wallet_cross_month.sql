BEGIN;
SET LOCAL lock_timeout='5s';

-- Ordinary Adult/Private Wallet credits retain their original expiry across
-- source months. Only absence/Kids eligibility is scoped to the card's month.
-- Patch both authoritative details/writers and the page hydration copy, while
-- preserving the exact course, learner/Private roster, status and expiry guards.
DO $wallet_period$
DECLARE
  item record;
  definition text;
  month_filter text := '   AND w.original_date>=p_month AND w.original_date<(p_month+interval ''1 month'')::date';
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('public.admin_makeup_context_v2(uuid,uuid,date)', '474309ead075ed2651cd42e16437eba8'),
    ('public.admin_makeup_context_state_v2(uuid,uuid,date,jsonb)', '0b6d2fd4fe46a4e4113f1f2bf4eca925')
  ) AS expected(signature, definition_hash) LOOP
    definition := replace(pg_get_functiondef(item.signature::regprocedure), chr(13), '');
    IF md5(definition) <> item.definition_hash OR
       (length(definition)-length(replace(definition,month_filter,'')))/length(month_filter) <> 1 THEN
      RAISE EXCEPTION 'ADMIN_MAKEUP_WALLET_PERIOD_BASELINE_DRIFT: %', item.signature;
    END IF;
    EXECUTE replace(definition, month_filter, '   -- Wallet eligibility uses its stored expiry, independently of p_month.');
  END LOOP;
END $wallet_period$;

COMMIT;
