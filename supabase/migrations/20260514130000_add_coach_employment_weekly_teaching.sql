ALTER TABLE "public"."profiles"
ADD COLUMN IF NOT EXISTS "coach_employment_type" text;

ALTER TABLE "public"."profiles"
DROP CONSTRAINT IF EXISTS "profiles_coach_employment_type_check";

ALTER TABLE "public"."profiles"
ADD CONSTRAINT "profiles_coach_employment_type_check"
CHECK (
  "coach_employment_type" IS NULL
  OR "coach_employment_type" IN ('full_time', 'half_time', 'part_time')
);

CREATE TABLE IF NOT EXISTS "public"."coach_weekly_teaching_summaries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "coach_id" uuid NOT NULL,
  "week_start" date NOT NULL,
  "week_end" date NOT NULL,
  "coach_employment_type" text NOT NULL,
  "threshold_hours" numeric(6,2) NOT NULL DEFAULT 0,
  "group_hours" numeric(6,2) NOT NULL DEFAULT 0,
  "private_hours" numeric(6,2) NOT NULL DEFAULT 0,
  "total_hours" numeric(6,2) NOT NULL DEFAULT 0,
  "regular_hours" numeric(6,2) NOT NULL DEFAULT 0,
  "payable_group_hours" numeric(6,2) NOT NULL DEFAULT 0,
  "payable_private_hours" numeric(6,2) NOT NULL DEFAULT 0,
  "payable_hours" numeric(6,2) NOT NULL DEFAULT 0,
  "private_rate" numeric(10,2) NOT NULL DEFAULT 0,
  "group_rate" numeric(10,2) NOT NULL DEFAULT 0,
  "payable_amount" numeric(12,2) NOT NULL DEFAULT 0,
  "payable_session_count" integer NOT NULL DEFAULT 0,
  "missing_checkin_count" integer NOT NULL DEFAULT 0,
  "missing_photo_count" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'closed',
  "notes" text,
  "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "closed_by" uuid,
  "closed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "coach_weekly_teaching_summaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coach_weekly_teaching_summaries_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "coach_weekly_teaching_summaries_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  CONSTRAINT "coach_weekly_teaching_summaries_employment_check" CHECK ("coach_employment_type" IN ('full_time', 'half_time', 'part_time')),
  CONSTRAINT "coach_weekly_teaching_summaries_status_check" CHECK ("status" IN ('closed')),
  CONSTRAINT "coach_weekly_teaching_summaries_week_check" CHECK ("week_end" >= "week_start"),
  CONSTRAINT "coach_weekly_teaching_summaries_unique_week" UNIQUE ("coach_id", "week_start")
);

CREATE INDEX IF NOT EXISTS "idx_profiles_coach_employment_type" ON "public"."profiles" USING "btree" ("coach_employment_type");
CREATE INDEX IF NOT EXISTS "idx_coach_weekly_teaching_summaries_week" ON "public"."coach_weekly_teaching_summaries" USING "btree" ("week_start", "week_end");
CREATE INDEX IF NOT EXISTS "idx_coach_weekly_teaching_summaries_coach" ON "public"."coach_weekly_teaching_summaries" USING "btree" ("coach_id");

DROP TRIGGER IF EXISTS "tr_coach_weekly_teaching_summaries_updated_at" ON "public"."coach_weekly_teaching_summaries";
CREATE TRIGGER "tr_coach_weekly_teaching_summaries_updated_at"
BEFORE UPDATE ON "public"."coach_weekly_teaching_summaries"
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

ALTER TABLE "public"."coach_weekly_teaching_summaries" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view weekly teaching summaries" ON "public"."coach_weekly_teaching_summaries";
CREATE POLICY "Admins can view weekly teaching summaries" ON "public"."coach_weekly_teaching_summaries"
FOR SELECT USING ("public"."is_admin_or_super"());

DROP POLICY IF EXISTS "Admins can insert weekly teaching summaries" ON "public"."coach_weekly_teaching_summaries";
CREATE POLICY "Admins can insert weekly teaching summaries" ON "public"."coach_weekly_teaching_summaries"
FOR INSERT WITH CHECK ("public"."is_admin_or_super"());

DROP POLICY IF EXISTS "Admins can update weekly teaching summaries" ON "public"."coach_weekly_teaching_summaries";
CREATE POLICY "Admins can update weekly teaching summaries" ON "public"."coach_weekly_teaching_summaries"
FOR UPDATE USING ("public"."is_admin_or_super"()) WITH CHECK ("public"."is_admin_or_super"());

GRANT ALL ON TABLE "public"."coach_weekly_teaching_summaries" TO "anon";
GRANT ALL ON TABLE "public"."coach_weekly_teaching_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_weekly_teaching_summaries" TO "service_role";
