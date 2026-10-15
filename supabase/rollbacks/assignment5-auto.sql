-- Drain candidate clients before removing request-status/receipt support.
-- Prefer application recovery while retaining this schema and successful data.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(10,1);
DO $guard$ BEGIN
IF md5(replace(pg_get_functiondef('public.assignment5_save_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure),chr(13)||chr(10),chr(10)))<>'82627d3d6321f9a4f36df81687ea4499' THEN RAISE EXCEPTION 'ASSIGNMENT5_AUTO_ROLLBACK_DRIFT'; END IF;
IF md5(replace(pg_get_functiondef('public.assignment5_status_v1(uuid,uuid,uuid)'::regprocedure),chr(13)||chr(10),chr(10)))<>'35029d2d637bc20e41613760d5d4b6b6' THEN RAISE EXCEPTION 'ASSIGNMENT5_AUTO_ROLLBACK_DRIFT'; END IF;
IF md5(replace(pg_get_functiondef('public.assignment5_admit_v1(uuid,uuid,uuid,jsonb,boolean)'::regprocedure),chr(13)||chr(10),chr(10)))<>'586fe6b3ef9b19d583ee5fb33797257a' THEN RAISE EXCEPTION 'ASSIGNMENT5_AUTO_ROLLBACK_DRIFT'; END IF;
IF md5(replace(pg_get_functiondef('public.assignment5_context_v1(uuid)'::regprocedure),chr(13)||chr(10),chr(10)))<>'5921ba978817d2e55b48a2f7d3fc154a' THEN RAISE EXCEPTION 'ASSIGNMENT5_AUTO_ROLLBACK_DRIFT'; END IF;
IF md5(replace(pg_get_functiondef('public.assignment5_track_v1()'::regprocedure),chr(13)||chr(10),chr(10)))<>'66f225e409511455b3475e4c376afbd5' THEN RAISE EXCEPTION 'ASSIGNMENT5_AUTO_ROLLBACK_DRIFT'; END IF;
END $guard$;
DROP TRIGGER assignment5_track ON public.booking_sessions;
DROP TRIGGER assignment5_track ON public.bookings;
DROP TRIGGER assignment5_track ON public.schedule_slots;
DROP TRIGGER assignment5_track ON public.coach_assignment_groups;
DROP TRIGGER assignment5_track ON public.coach_assignment_group_students;
DROP TRIGGER assignment5_track ON public.coach_assignments;
DROP TRIGGER assignment5_track ON public.attendance;
DROP TRIGGER assignment5_track ON public.coach_checkins;
DROP TRIGGER assignment5_track ON public.profiles;
DROP TRIGGER assignment5_track ON public.coach_branches;
DROP TRIGGER assignment5_store_commit ON public.lesson_source_operations;
DROP FUNCTION public.assignment5_save_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb);
DROP FUNCTION public.assignment5_status_v1(uuid,uuid,uuid);
DROP FUNCTION public.assignment5_admit_v1(uuid,uuid,uuid,jsonb,boolean);
DROP FUNCTION public.assignment5_context_v1(uuid);
DROP FUNCTION public.assignment5_track_v1();
-- Technical metadata only; no successful customer transaction is reversed.
DROP TABLE public.assignment5_requests,public.assignment5_receipts,public.assignment5_events,public.assignment5_epoch;
DELETE FROM supabase_migrations.schema_migrations WHERE version='20261015055145';
NOTIFY pgrst,'reload schema';
COMMIT;
