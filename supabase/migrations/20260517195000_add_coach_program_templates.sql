CREATE TABLE IF NOT EXISTS public.coach_program_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_program_templates_title_check CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  CONSTRAINT coach_program_templates_content_check CHECK (char_length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_coach_program_templates_coach
  ON public.coach_program_templates(coach_id, is_active, updated_at DESC);

CREATE OR REPLACE TRIGGER tr_coach_program_templates_updated_at
BEFORE UPDATE ON public.coach_program_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.coach_program_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches can view own program templates" ON public.coach_program_templates;
CREATE POLICY "Coaches can view own program templates"
  ON public.coach_program_templates
  FOR SELECT
  USING (coach_id = auth.uid() OR public.is_admin_or_super());

DROP POLICY IF EXISTS "Coaches can create own program templates" ON public.coach_program_templates;
CREATE POLICY "Coaches can create own program templates"
  ON public.coach_program_templates
  FOR INSERT
  WITH CHECK (coach_id = auth.uid() AND public.is_staff());

DROP POLICY IF EXISTS "Coaches can update own program templates" ON public.coach_program_templates;
CREATE POLICY "Coaches can update own program templates"
  ON public.coach_program_templates
  FOR UPDATE
  USING (coach_id = auth.uid() OR public.is_admin_or_super())
  WITH CHECK (coach_id = auth.uid() OR public.is_admin_or_super());

DROP POLICY IF EXISTS "Coaches can delete own program templates" ON public.coach_program_templates;
CREATE POLICY "Coaches can delete own program templates"
  ON public.coach_program_templates
  FOR DELETE
  USING (coach_id = auth.uid() OR public.is_admin_or_super());

GRANT ALL ON TABLE public.coach_program_templates TO anon;
GRANT ALL ON TABLE public.coach_program_templates TO authenticated;
GRANT ALL ON TABLE public.coach_program_templates TO service_role;
