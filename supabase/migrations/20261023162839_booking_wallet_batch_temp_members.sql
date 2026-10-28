-- BOOKING-UX-1 Local: each Wallet redemption owns fresh temporary member and
-- result tables, including multiple redemptions in one atomic transaction.
-- Preserve all entitlement, Family, locking, audit and financial behavior.
DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.task10_previous_wallet_redeem_v2(uuid,uuid,date,time,time,uuid,uuid)'::regprocedure) INTO definition;
  IF position('CREATE TEMP TABLE wallet_redeem_members ON COMMIT DROP AS' IN definition)=0
     OR position('CREATE TEMP TABLE wallet_inserted_sessions (' IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected Wallet writer; temporary table fix was not applied';
  END IF;
  IF position('DROP TABLE IF EXISTS pg_temp.wallet_redeem_members;' IN definition)=0 THEN
    definition := replace(definition,'CREATE TEMP TABLE wallet_redeem_members ON COMMIT DROP AS',
      E'DROP TABLE IF EXISTS pg_temp.wallet_redeem_members;\n  CREATE TEMP TABLE wallet_redeem_members ON COMMIT DROP AS');
  END IF;
  IF position('DROP TABLE IF EXISTS pg_temp.wallet_inserted_sessions;' IN definition)=0 THEN
    definition := replace(definition,'CREATE TEMP TABLE wallet_inserted_sessions (',
      E'DROP TABLE IF EXISTS pg_temp.wallet_inserted_sessions;\n  CREATE TEMP TABLE wallet_inserted_sessions (');
  END IF;
  EXECUTE definition;
END
$migration$;
