


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."attendance_status" AS ENUM (
    'present',
    'absent',
    'late'
);


ALTER TYPE "public"."attendance_status" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'pending_payment',
    'paid',
    'verified',
    'cancelled'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."complaint_status" AS ENUM (
    'open',
    'in_progress',
    'resolved'
);


ALTER TYPE "public"."complaint_status" OWNER TO "postgres";


CREATE TYPE "public"."course_type_name" AS ENUM (
    'kids_group',
    'adult_group',
    'private'
);


ALTER TYPE "public"."course_type_name" OWNER TO "postgres";


CREATE TYPE "public"."discount_type" AS ENUM (
    'fixed',
    'percent'
);


ALTER TYPE "public"."discount_type" OWNER TO "postgres";


CREATE TYPE "public"."gender_type" AS ENUM (
    'male',
    'female',
    'other'
);


ALTER TYPE "public"."gender_type" OWNER TO "postgres";


CREATE TYPE "public"."learner_type" AS ENUM (
    'self',
    'child'
);


ALTER TYPE "public"."learner_type" OWNER TO "postgres";


CREATE TYPE "public"."level_category" AS ENUM (
    'basic',
    'athlete_1',
    'athlete_2',
    'athlete_3'
);


ALTER TYPE "public"."level_category" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'payment',
    'schedule',
    'reminder',
    'complaint',
    'system'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."program_status" AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected'
);


ALTER TYPE "public"."program_status" OWNER TO "postgres";


CREATE TYPE "public"."session_status" AS ENUM (
    'scheduled',
    'completed',
    'rescheduled',
    'absent'
);


ALTER TYPE "public"."session_status" OWNER TO "postgres";


CREATE TYPE "public"."slot_status" AS ENUM (
    'open',
    'full',
    'cancelled'
);


ALTER TYPE "public"."slot_status" OWNER TO "postgres";


CREATE TYPE "public"."student_type" AS ENUM (
    'adult',
    'child'
);


ALTER TYPE "public"."student_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'coach',
    'head_coach',
    'admin',
    'super_admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."auth_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    NEW.email,
    'user'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_super"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT auth_role() IN ('admin', 'super_admin');
$$;


ALTER FUNCTION "public"."is_admin_or_super"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT auth_role() IN ('coach', 'head_coach', 'admin', 'super_admin');
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "details" "jsonb",
    "ip_address" "inet",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_session_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "student_type" "public"."student_type" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "status" "public"."attendance_status" DEFAULT 'present'::"public"."attendance_status" NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "schedule_slot_id" "uuid",
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "status" "public"."session_status" DEFAULT 'scheduled'::"public"."session_status" NOT NULL,
    "rescheduled_from_id" "uuid",
    "is_makeup" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "child_id" "uuid"
);


ALTER TABLE "public"."booking_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "learner_type" "public"."learner_type" DEFAULT 'self'::"public"."learner_type" NOT NULL,
    "child_id" "uuid",
    "branch_id" "uuid" NOT NULL,
    "course_type_id" "uuid" NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "total_sessions" integer DEFAULT 0 NOT NULL,
    "total_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "public"."booking_status" DEFAULT 'pending_payment'::"public"."booking_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bookings_month_check" CHECK ((("month" >= 1) AND ("month" <= 12))),
    CONSTRAINT "bookings_year_check" CHECK (("year" >= 2024))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."children" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "nickname" "text",
    "date_of_birth" "date",
    "gender" "public"."gender_type",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."children" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "schedule_slot_id" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "is_head_coach" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "schedule_slot_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "checkin_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "photo_url" "text",
    "location_lat" double precision,
    "location_lng" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_teaching_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "group_hours" numeric(4,1) DEFAULT 0 NOT NULL,
    "private_hours" numeric(4,1) DEFAULT 0 NOT NULL,
    "total_hours" numeric(4,1) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_teaching_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."complaints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "public"."complaint_status" DEFAULT 'open'::"public"."complaint_status" NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."complaints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupon_usages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coupon_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "discount_amount" numeric(10,2) NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coupon_usages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "discount_type" "public"."discount_type" NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "min_purchase" numeric(10,2),
    "max_uses" integer,
    "current_uses" integer DEFAULT 0 NOT NULL,
    "valid_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_to" "date",
    "created_by" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "public"."course_type_name" NOT NULL,
    "description" "text",
    "max_students" integer DEFAULT 6 NOT NULL,
    "duration_hours" numeric(3,1) DEFAULT 2.0 NOT NULL
);


ALTER TABLE "public"."course_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."levels" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "public"."level_category" NOT NULL,
    CONSTRAINT "levels_id_check" CHECK ((("id" >= 1) AND ("id" <= 60)))
);


ALTER TABLE "public"."levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "public"."notification_type" DEFAULT 'system'::"public"."notification_type" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "link_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "method" "text" DEFAULT 'transfer'::"text" NOT NULL,
    "slip_image_url" "text",
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_type_id" "uuid" NOT NULL,
    "min_sessions" integer NOT NULL,
    "max_sessions" integer,
    "price_per_session" numeric(10,2) NOT NULL,
    "package_price" numeric(10,2) NOT NULL,
    "valid_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_to" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pricing_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text" NOT NULL,
    "avatar_url" "text",
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "branch_id" "uuid" NOT NULL,
    "course_type_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "max_students" integer DEFAULT 6 NOT NULL,
    "current_students" integer DEFAULT 0 NOT NULL,
    "status" "public"."slot_status" DEFAULT 'open'::"public"."slot_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."schedule_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "course_type_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "schedule_templates_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."schedule_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "student_type" "public"."student_type" NOT NULL,
    "level" integer NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_levels_level_check" CHECK ((("level" >= 1) AND ("level" <= 60)))
);


ALTER TABLE "public"."student_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teaching_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "schedule_slot_id" "uuid" NOT NULL,
    "program_content" "text" NOT NULL,
    "status" "public"."program_status" DEFAULT 'draft'::"public"."program_status" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teaching_programs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_sessions"
    ADD CONSTRAINT "booking_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."children"
    ADD CONSTRAINT "children_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_assignments"
    ADD CONSTRAINT "coach_assignments_coach_id_schedule_slot_id_key" UNIQUE ("coach_id", "schedule_slot_id");



ALTER TABLE ONLY "public"."coach_assignments"
    ADD CONSTRAINT "coach_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_branches"
    ADD CONSTRAINT "coach_branches_coach_id_branch_id_key" UNIQUE ("coach_id", "branch_id");



ALTER TABLE ONLY "public"."coach_branches"
    ADD CONSTRAINT "coach_branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_checkins"
    ADD CONSTRAINT "coach_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_teaching_hours"
    ADD CONSTRAINT "coach_teaching_hours_coach_id_date_key" UNIQUE ("coach_id", "date");



ALTER TABLE ONLY "public"."coach_teaching_hours"
    ADD CONSTRAINT "coach_teaching_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupon_usages"
    ADD CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_types"
    ADD CONSTRAINT "course_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."course_types"
    ADD CONSTRAINT "course_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_tiers"
    ADD CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_branch_id_course_type_id_date_start_time_key" UNIQUE ("branch_id", "course_type_id", "date", "start_time");



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_templates"
    ADD CONSTRAINT "schedule_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_levels"
    ADD CONSTRAINT "student_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teaching_programs"
    ADD CONSTRAINT "teaching_programs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_logs_created" ON "public"."activity_logs" USING "btree" ("created_at");



CREATE INDEX "idx_activity_logs_user" ON "public"."activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_attendance_session" ON "public"."attendance" USING "btree" ("booking_session_id");



CREATE INDEX "idx_booking_sessions_booking" ON "public"."booking_sessions" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_sessions_date" ON "public"."booking_sessions" USING "btree" ("date");



CREATE INDEX "idx_bookings_month_year" ON "public"."bookings" USING "btree" ("month", "year");



CREATE INDEX "idx_bookings_user" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_children_parent" ON "public"."children" USING "btree" ("parent_id");



CREATE INDEX "idx_coach_assignments_slot" ON "public"."coach_assignments" USING "btree" ("schedule_slot_id");



CREATE INDEX "idx_coach_branches_coach" ON "public"."coach_branches" USING "btree" ("coach_id");



CREATE INDEX "idx_coach_teaching_hours_coach_date" ON "public"."coach_teaching_hours" USING "btree" ("coach_id", "date");



CREATE INDEX "idx_complaints_branch" ON "public"."complaints" USING "btree" ("branch_id");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "is_read");



CREATE INDEX "idx_payments_booking" ON "public"."payments" USING "btree" ("booking_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_schedule_slots_branch_date" ON "public"."schedule_slots" USING "btree" ("branch_id", "date");



CREATE INDEX "idx_schedule_slots_date" ON "public"."schedule_slots" USING "btree" ("date");



CREATE INDEX "idx_schedule_templates_branch" ON "public"."schedule_templates" USING "btree" ("branch_id");



CREATE INDEX "idx_student_levels_student" ON "public"."student_levels" USING "btree" ("student_id");



CREATE OR REPLACE TRIGGER "tr_booking_sessions_updated_at" BEFORE UPDATE ON "public"."booking_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "tr_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "tr_branches_updated_at" BEFORE UPDATE ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "tr_children_updated_at" BEFORE UPDATE ON "public"."children" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "tr_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "tr_schedule_templates_updated_at" BEFORE UPDATE ON "public"."schedule_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "tr_teaching_programs_updated_at" BEFORE UPDATE ON "public"."teaching_programs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_booking_session_id_fkey" FOREIGN KEY ("booking_session_id") REFERENCES "public"."booking_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."booking_sessions"
    ADD CONSTRAINT "booking_sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_sessions"
    ADD CONSTRAINT "booking_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."booking_sessions"
    ADD CONSTRAINT "booking_sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_sessions"
    ADD CONSTRAINT "booking_sessions_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "public"."booking_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_sessions"
    ADD CONSTRAINT "booking_sessions_schedule_slot_id_fkey" FOREIGN KEY ("schedule_slot_id") REFERENCES "public"."schedule_slots"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_course_type_id_fkey" FOREIGN KEY ("course_type_id") REFERENCES "public"."course_types"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."children"
    ADD CONSTRAINT "children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_assignments"
    ADD CONSTRAINT "coach_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."coach_assignments"
    ADD CONSTRAINT "coach_assignments_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_assignments"
    ADD CONSTRAINT "coach_assignments_schedule_slot_id_fkey" FOREIGN KEY ("schedule_slot_id") REFERENCES "public"."schedule_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_branches"
    ADD CONSTRAINT "coach_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_branches"
    ADD CONSTRAINT "coach_branches_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_checkins"
    ADD CONSTRAINT "coach_checkins_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."coach_checkins"
    ADD CONSTRAINT "coach_checkins_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_checkins"
    ADD CONSTRAINT "coach_checkins_schedule_slot_id_fkey" FOREIGN KEY ("schedule_slot_id") REFERENCES "public"."schedule_slots"("id");



ALTER TABLE ONLY "public"."coach_teaching_hours"
    ADD CONSTRAINT "coach_teaching_hours_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupon_usages"
    ADD CONSTRAINT "coupon_usages_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."coupon_usages"
    ADD CONSTRAINT "coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupon_usages"
    ADD CONSTRAINT "coupon_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pricing_tiers"
    ADD CONSTRAINT "pricing_tiers_course_type_id_fkey" FOREIGN KEY ("course_type_id") REFERENCES "public"."course_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_course_type_id_fkey" FOREIGN KEY ("course_type_id") REFERENCES "public"."course_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_slots"
    ADD CONSTRAINT "schedule_slots_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."schedule_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."schedule_templates"
    ADD CONSTRAINT "schedule_templates_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_templates"
    ADD CONSTRAINT "schedule_templates_course_type_id_fkey" FOREIGN KEY ("course_type_id") REFERENCES "public"."course_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_levels"
    ADD CONSTRAINT "student_levels_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."teaching_programs"
    ADD CONSTRAINT "teaching_programs_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teaching_programs"
    ADD CONSTRAINT "teaching_programs_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."teaching_programs"
    ADD CONSTRAINT "teaching_programs_schedule_slot_id_fkey" FOREIGN KEY ("schedule_slot_id") REFERENCES "public"."schedule_slots"("id");



CREATE POLICY "Admins can insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage all bookings" ON "public"."bookings" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage all children" ON "public"."children" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage all complaints" ON "public"."complaints" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage all payments" ON "public"."payments" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage all programs" ON "public"."teaching_programs" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage all sessions" ON "public"."booking_sessions" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage branches" ON "public"."branches" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage coach branches" ON "public"."coach_branches" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage coupons" ON "public"."coupons" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage course types" ON "public"."course_types" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can manage schedule slots" ON "public"."schedule_slots" USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can view all checkins" ON "public"."coach_checkins" FOR SELECT USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can view all coupon usages" ON "public"."coupon_usages" FOR SELECT USING ("public"."is_admin_or_super"());



CREATE POLICY "Admins can view all hours" ON "public"."coach_teaching_hours" FOR SELECT USING ("public"."is_admin_or_super"());



CREATE POLICY "Anyone can view active branches" ON "public"."branches" FOR SELECT USING (true);



CREATE POLICY "Anyone can view active coupons" ON "public"."coupons" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active templates" ON "public"."schedule_templates" FOR SELECT USING (true);



CREATE POLICY "Anyone can view coach branches" ON "public"."coach_branches" FOR SELECT USING (true);



CREATE POLICY "Anyone can view course types" ON "public"."course_types" FOR SELECT USING (true);



CREATE POLICY "Anyone can view levels" ON "public"."levels" FOR SELECT USING (true);



CREATE POLICY "Anyone can view levels for ranking" ON "public"."student_levels" FOR SELECT USING (true);



CREATE POLICY "Anyone can view pricing" ON "public"."pricing_tiers" FOR SELECT USING (true);



CREATE POLICY "Anyone can view schedule slots" ON "public"."schedule_slots" FOR SELECT USING (true);



CREATE POLICY "Anyone can view settings" ON "public"."system_settings" FOR SELECT USING (true);



CREATE POLICY "Coaches can create own checkins" ON "public"."coach_checkins" FOR INSERT WITH CHECK ((("coach_id" = "auth"."uid"()) AND "public"."is_staff"()));



CREATE POLICY "Coaches can manage attendance" ON "public"."attendance" USING ("public"."is_staff"());



CREATE POLICY "Coaches can manage own programs" ON "public"."teaching_programs" USING ((("coach_id" = "auth"."uid"()) AND "public"."is_staff"()));



CREATE POLICY "Coaches can view own assignments" ON "public"."coach_assignments" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coaches can view own checkins" ON "public"."coach_checkins" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coaches can view own hours" ON "public"."coach_teaching_hours" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "Head coaches and admins can manage assignments" ON "public"."coach_assignments" USING (("public"."auth_role"() = ANY (ARRAY['head_coach'::"public"."user_role", 'admin'::"public"."user_role", 'super_admin'::"public"."user_role"])));



CREATE POLICY "Parents can manage own children" ON "public"."children" USING (("parent_id" = "auth"."uid"()));



CREATE POLICY "Parents can view own children" ON "public"."children" FOR SELECT USING (("parent_id" = "auth"."uid"()));



CREATE POLICY "Staff can manage student levels" ON "public"."student_levels" USING ("public"."is_staff"());



CREATE POLICY "Staff can view all assignments" ON "public"."coach_assignments" FOR SELECT USING ("public"."is_staff"());



CREATE POLICY "Staff can view all bookings" ON "public"."bookings" FOR SELECT USING ("public"."is_staff"());



CREATE POLICY "Staff can view all children" ON "public"."children" FOR SELECT USING ("public"."is_staff"());



CREATE POLICY "Staff can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_staff"());



CREATE POLICY "Staff can view all sessions" ON "public"."booking_sessions" FOR SELECT USING ("public"."is_staff"());



CREATE POLICY "Super admin can manage levels" ON "public"."levels" USING (("public"."auth_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admin can manage pricing" ON "public"."pricing_tiers" USING (("public"."auth_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admin can manage settings" ON "public"."system_settings" USING (("public"."auth_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admin can manage templates" ON "public"."schedule_templates" USING (("public"."auth_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "Super admin can view all logs" ON "public"."activity_logs" FOR SELECT USING (("public"."auth_role"() = 'super_admin'::"public"."user_role"));



CREATE POLICY "System can create logs" ON "public"."activity_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can create notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("public"."is_admin_or_super"() OR ("user_id" = "auth"."uid"())));



CREATE POLICY "System can manage hours" ON "public"."coach_teaching_hours" USING ("public"."is_admin_or_super"());



CREATE POLICY "Users can create complaints" ON "public"."complaints" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create own bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create own coupon usages" ON "public"."coupon_usages" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create own payments" ON "public"."payments" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own sessions" ON "public"."booking_sessions" USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "booking_sessions"."booking_id") AND ("bookings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own bookings" ON "public"."bookings" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view own attendance" ON "public"."attendance" FOR SELECT USING ((("student_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."children"
  WHERE (("children"."id" = "attendance"."student_id") AND ("children"."parent_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own bookings" ON "public"."bookings" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own complaints" ON "public"."complaints" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own coupon usages" ON "public"."coupon_usages" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own levels" ON "public"."student_levels" FOR SELECT USING ((("student_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."children"
  WHERE (("children"."id" = "student_levels"."student_id") AND ("children"."parent_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own payments" ON "public"."payments" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view own sessions" ON "public"."booking_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bookings"
  WHERE (("bookings"."id" = "booking_sessions"."booking_id") AND ("bookings"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."children" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_teaching_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."complaints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coupon_usages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teaching_programs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."auth_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_super"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_super"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_super"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."booking_sessions" TO "anon";
GRANT ALL ON TABLE "public"."booking_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."children" TO "anon";
GRANT ALL ON TABLE "public"."children" TO "authenticated";
GRANT ALL ON TABLE "public"."children" TO "service_role";



GRANT ALL ON TABLE "public"."coach_assignments" TO "anon";
GRANT ALL ON TABLE "public"."coach_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."coach_branches" TO "anon";
GRANT ALL ON TABLE "public"."coach_branches" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_branches" TO "service_role";



GRANT ALL ON TABLE "public"."coach_checkins" TO "anon";
GRANT ALL ON TABLE "public"."coach_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."coach_teaching_hours" TO "anon";
GRANT ALL ON TABLE "public"."coach_teaching_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_teaching_hours" TO "service_role";



GRANT ALL ON TABLE "public"."complaints" TO "anon";
GRANT ALL ON TABLE "public"."complaints" TO "authenticated";
GRANT ALL ON TABLE "public"."complaints" TO "service_role";



GRANT ALL ON TABLE "public"."coupon_usages" TO "anon";
GRANT ALL ON TABLE "public"."coupon_usages" TO "authenticated";
GRANT ALL ON TABLE "public"."coupon_usages" TO "service_role";



GRANT ALL ON TABLE "public"."coupons" TO "anon";
GRANT ALL ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT ALL ON TABLE "public"."course_types" TO "anon";
GRANT ALL ON TABLE "public"."course_types" TO "authenticated";
GRANT ALL ON TABLE "public"."course_types" TO "service_role";



GRANT ALL ON TABLE "public"."levels" TO "anon";
GRANT ALL ON TABLE "public"."levels" TO "authenticated";
GRANT ALL ON TABLE "public"."levels" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_tiers" TO "anon";
GRANT ALL ON TABLE "public"."pricing_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_slots" TO "anon";
GRANT ALL ON TABLE "public"."schedule_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_slots" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_templates" TO "anon";
GRANT ALL ON TABLE "public"."schedule_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_templates" TO "service_role";



GRANT ALL ON TABLE "public"."student_levels" TO "anon";
GRANT ALL ON TABLE "public"."student_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."student_levels" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."teaching_programs" TO "anon";
GRANT ALL ON TABLE "public"."teaching_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."teaching_programs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Allow Upload Avatars 1oj01fe_0"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'avatars'::text));



  create policy "Allow Upload Avatars 1oj01fe_1"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'avatars'::text));



  create policy "Allow Upload Avatars 1oj01fe_2"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'avatars'::text));



  create policy "Users can update own payment slips"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'payment-slips'::text) AND (auth.uid() IS NOT NULL)));



  create policy "Users can upload payment slips"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'payment-slips'::text) AND (auth.uid() IS NOT NULL)));



  create policy "Users can view payment slips"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'payment-slips'::text));



