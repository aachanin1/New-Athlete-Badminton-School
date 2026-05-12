import { createClient } from '@/lib/supabase/server'
import { ScheduleTemplatesClient } from '@/components/admin/schedule-templates-client'
import { requireSuperAdminPageAccess } from '@/lib/auth/admin'
import type { CourseTypeName } from '@/types/database'

interface BranchRow {
  id: string
  name: string
  slug: string
}

interface CourseTypeRow {
  id: string
  name: CourseTypeName
}

interface ScheduleTemplateRow {
  id: string
  branch_id: string
  course_type_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  notes: string | null
  branches?: { slug: string | null; name: string | null } | null
  course_types?: { name: CourseTypeName | null } | null
}

export default async function ScheduleTemplatesPage() {
  await requireSuperAdminPageAccess()
  const supabase = createClient()

  const [{ data: branches }, { data: courseTypes }, { data: templates }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name') as unknown as Promise<{ data: BranchRow[] | null }>,
    supabase
      .from('course_types')
      .select('id, name')
      .order('name') as unknown as Promise<{ data: CourseTypeRow[] | null }>,
    supabase
      .from('schedule_templates')
      .select(`
        id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active, notes,
        branches(name, slug),
        course_types(name)
      `)
      .order('day_of_week')
      .order('start_time') as unknown as Promise<{ data: ScheduleTemplateRow[] | null }>,
  ])

  const scheduleTemplates = (templates || []).map((template) => ({
    id: template.id,
    branch_id: template.branch_id,
    branch_slug: template.branches?.slug || '',
    branch_name: template.branches?.name || 'ไม่ทราบสาขา',
    course_type_id: template.course_type_id,
    course_type_name: template.course_types?.name || 'kids_group',
    day_of_week: template.day_of_week,
    start_time: template.start_time.slice(0, 5),
    end_time: template.end_time.slice(0, 5),
    is_active: template.is_active,
    notes: template.notes,
  }))

  return (
    <ScheduleTemplatesClient
      branches={branches || []}
      courseTypes={courseTypes || []}
      templates={scheduleTemplates}
    />
  )
}
