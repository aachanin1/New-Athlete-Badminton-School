CREATE TABLE IF NOT EXISTS public.student_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  student_type public.student_type NOT NULL,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 8),
  title text NOT NULL,
  description text,
  awarded_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_achievements_student
  ON public.student_achievements(student_id, student_type);

CREATE INDEX IF NOT EXISTS idx_student_achievements_active
  ON public.student_achievements(is_active);

ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active student achievements" ON public.student_achievements;
CREATE POLICY "Anyone can view active student achievements"
  ON public.student_achievements
  FOR SELECT
  USING (is_active = true OR public.is_staff());

DROP POLICY IF EXISTS "Staff can manage student achievements" ON public.student_achievements;
CREATE POLICY "Staff can manage student achievements"
  ON public.student_achievements
  FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
