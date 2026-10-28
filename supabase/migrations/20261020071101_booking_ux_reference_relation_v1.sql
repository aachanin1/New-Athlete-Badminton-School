BEGIN;
-- This private integrity table is not a public many-to-many API relationship.
-- A surrogate primary key preserves released bookings.children embeddings;
-- the unique pair still protects bindings against duplicates and races.
ALTER TABLE public.booking_ux_package_learners ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.booking_ux_package_learners DROP CONSTRAINT booking_ux_package_learners_pkey;
ALTER TABLE public.booking_ux_package_learners ADD PRIMARY KEY(id);
ALTER TABLE public.booking_ux_package_learners ADD CONSTRAINT booking_ux_package_learners_pair UNIQUE(booking_id,child_id);
NOTIFY pgrst,'reload schema';
COMMIT;
