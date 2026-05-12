CREATE TABLE IF NOT EXISTS "public"."finance_expenses" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "expense_date" date NOT NULL,
    "category" text NOT NULL,
    "description" text,
    "amount" numeric(12,2) NOT NULL,
    "branch_id" uuid,
    "created_by" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "finance_expenses_amount_check" CHECK (("amount" > (0)::numeric))
);

ALTER TABLE ONLY "public"."finance_expenses"
    ADD CONSTRAINT "finance_expenses_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_expenses"
    ADD CONSTRAINT "finance_expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."finance_expenses"
    ADD CONSTRAINT "finance_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_finance_expenses_date" ON "public"."finance_expenses" USING "btree" ("expense_date");
CREATE INDEX IF NOT EXISTS "idx_finance_expenses_branch" ON "public"."finance_expenses" USING "btree" ("branch_id");

CREATE OR REPLACE TRIGGER "tr_finance_expenses_updated_at"
BEFORE UPDATE ON "public"."finance_expenses"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

ALTER TABLE "public"."finance_expenses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view finance expenses" ON "public"."finance_expenses"
FOR SELECT USING ("public"."is_admin_or_super"());

CREATE POLICY "Admins can insert finance expenses" ON "public"."finance_expenses"
FOR INSERT WITH CHECK ("public"."is_admin_or_super"());

CREATE POLICY "Admins can update finance expenses" ON "public"."finance_expenses"
FOR UPDATE USING ("public"."is_admin_or_super"()) WITH CHECK ("public"."is_admin_or_super"());

CREATE POLICY "Admins can delete finance expenses" ON "public"."finance_expenses"
FOR DELETE USING ("public"."is_admin_or_super"());

GRANT ALL ON TABLE "public"."finance_expenses" TO "anon";
GRANT ALL ON TABLE "public"."finance_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_expenses" TO "service_role";
