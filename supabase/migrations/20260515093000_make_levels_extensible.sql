-- Make the level master extensible beyond LV 70.
-- The app now validates coach evaluations against active rows in public.levels
-- instead of a hardcoded upper bound.

ALTER TABLE public.levels DROP CONSTRAINT IF EXISTS levels_id_check;
ALTER TABLE public.levels
  ADD CONSTRAINT levels_id_check CHECK (id >= 1);

ALTER TABLE public.student_levels DROP CONSTRAINT IF EXISTS student_levels_level_check;
ALTER TABLE public.student_levels
  ADD CONSTRAINT student_levels_level_check CHECK (level >= 0);
