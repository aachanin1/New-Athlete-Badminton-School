CREATE TABLE IF NOT EXISTS "public"."coach_payouts" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "coach_id" uuid NOT NULL,
    "period_month" integer NOT NULL,
    "period_year" integer NOT NULL,
    "group_hours" numeric(6,2) NOT NULL DEFAULT 0,
    "private_hours" numeric(6,2) NOT NULL DEFAULT 0,
    "total_hours" numeric(6,2) NOT NULL DEFAULT 0,
    "regular_hours" numeric(6,2) NOT NULL DEFAULT 0,
    "ot_group_hours" numeric(6,2) NOT NULL DEFAULT 0,
    "ot_private_hours" numeric(6,2) NOT NULL DEFAULT 0,
    "ot_hours" numeric(6,2) NOT NULL DEFAULT 0,
    "ot_pay" numeric(12,2) NOT NULL DEFAULT 0,
    "payout_amount" numeric(12,2) NOT NULL DEFAULT 0,
    "payable_session_count" integer NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'paid',
    "notes" text,
    "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "paid_by" uuid,
    "paid_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "coach_payouts_month_check" CHECK (("period_month" >= 1) AND ("period_month" <= 12)),
    CONSTRAINT "coach_payouts_non_negative_check" CHECK (
      ("group_hours" >= 0)
      AND ("private_hours" >= 0)
      AND ("total_hours" >= 0)
      AND ("regular_hours" >= 0)
      AND ("ot_group_hours" >= 0)
      AND ("ot_private_hours" >= 0)
      AND ("ot_hours" >= 0)
      AND ("ot_pay" >= 0)
      AND ("payout_amount" >= 0)
      AND ("payable_session_count" >= 0)
    )
);

ALTER TABLE ONLY "public"."coach_payouts"
    ADD CONSTRAINT "coach_payouts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."coach_payouts"
    ADD CONSTRAINT "coach_payouts_coach_period_key" UNIQUE ("coach_id", "period_year", "period_month");

ALTER TABLE ONLY "public"."coach_payouts"
    ADD CONSTRAINT "coach_payouts_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."coach_payouts"
    ADD CONSTRAINT "coach_payouts_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_coach_payouts_period" ON "public"."coach_payouts" USING "btree" ("period_year", "period_month");
CREATE INDEX IF NOT EXISTS "idx_coach_payouts_coach" ON "public"."coach_payouts" USING "btree" ("coach_id");

CREATE OR REPLACE TRIGGER "tr_coach_payouts_updated_at"
BEFORE UPDATE ON "public"."coach_payouts"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_updated_at"();

ALTER TABLE "public"."coach_payouts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view coach payouts" ON "public"."coach_payouts"
    FOR SELECT USING ("public"."is_admin_or_super"());

CREATE POLICY "Admins can insert coach payouts" ON "public"."coach_payouts"
    FOR INSERT WITH CHECK ("public"."is_admin_or_super"());

CREATE POLICY "Admins can update coach payouts" ON "public"."coach_payouts"
    FOR UPDATE USING ("public"."is_admin_or_super"()) WITH CHECK ("public"."is_admin_or_super"());

GRANT ALL ON TABLE "public"."coach_payouts" TO "anon";
GRANT ALL ON TABLE "public"."coach_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_payouts" TO "service_role";
