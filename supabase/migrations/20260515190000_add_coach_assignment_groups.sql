CREATE TABLE IF NOT EXISTS public.coach_assignment_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_slot_id uuid NOT NULL REFERENCES public.schedule_slots(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  level_min integer,
  level_max integer,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_assignment_groups_level_range_check CHECK (
    (level_min IS NULL OR level_min >= 0)
    AND (level_max IS NULL OR level_max >= 0)
    AND (level_min IS NULL OR level_max IS NULL OR level_min <= level_max)
  )
);

CREATE TABLE IF NOT EXISTS public.coach_assignment_group_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.coach_assignment_groups(id) ON DELETE CASCADE,
  booking_session_id uuid NOT NULL REFERENCES public.booking_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  student_type public.student_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_assignment_group_students_session_key UNIQUE (booking_session_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_assignment_groups_slot
  ON public.coach_assignment_groups(schedule_slot_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_coach_assignment_groups_coach
  ON public.coach_assignment_groups(coach_id);

CREATE INDEX IF NOT EXISTS idx_coach_assignment_group_students_group
  ON public.coach_assignment_group_students(group_id);

CREATE INDEX IF NOT EXISTS idx_coach_assignment_group_students_student
  ON public.coach_assignment_group_students(student_id, student_type);

CREATE OR REPLACE TRIGGER tr_coach_assignment_groups_updated_at
BEFORE UPDATE ON public.coach_assignment_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.coach_assignment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_assignment_group_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view assignment groups" ON public.coach_assignment_groups;
CREATE POLICY "Staff can view assignment groups"
  ON public.coach_assignment_groups
  FOR SELECT
  USING (
    public.is_staff()
    OR coach_id = auth.uid()
  );

DROP POLICY IF EXISTS "Head coaches and admins can manage assignment groups" ON public.coach_assignment_groups;
CREATE POLICY "Head coaches and admins can manage assignment groups"
  ON public.coach_assignment_groups
  FOR ALL
  USING (public.auth_role() IN ('head_coach', 'admin', 'super_admin'))
  WITH CHECK (public.auth_role() IN ('head_coach', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "Staff can view assignment group students" ON public.coach_assignment_group_students;
CREATE POLICY "Staff can view assignment group students"
  ON public.coach_assignment_group_students
  FOR SELECT
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.coach_assignment_groups
      WHERE coach_assignment_groups.id = coach_assignment_group_students.group_id
        AND coach_assignment_groups.coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Head coaches and admins can manage assignment group students" ON public.coach_assignment_group_students;
CREATE POLICY "Head coaches and admins can manage assignment group students"
  ON public.coach_assignment_group_students
  FOR ALL
  USING (public.auth_role() IN ('head_coach', 'admin', 'super_admin'))
  WITH CHECK (public.auth_role() IN ('head_coach', 'admin', 'super_admin'));

GRANT ALL ON TABLE public.coach_assignment_groups TO anon;
GRANT ALL ON TABLE public.coach_assignment_groups TO authenticated;
GRANT ALL ON TABLE public.coach_assignment_groups TO service_role;

GRANT ALL ON TABLE public.coach_assignment_group_students TO anon;
GRANT ALL ON TABLE public.coach_assignment_group_students TO authenticated;
GRANT ALL ON TABLE public.coach_assignment_group_students TO service_role;
