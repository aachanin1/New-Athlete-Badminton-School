-- Learners start at Level 0 until a coach evaluates and promotes them.

ALTER TABLE public.student_levels DROP CONSTRAINT IF EXISTS student_levels_level_check;
ALTER TABLE public.student_levels
  ADD CONSTRAINT student_levels_level_check CHECK (level BETWEEN 0 AND 70);
