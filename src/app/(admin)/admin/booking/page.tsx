import { createClient } from '@/lib/supabase/server'
import { AdminBookingClient } from '@/components/admin/admin-booking-client'
import type { CourseTypeName } from '@/types/database'

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string | null
}

interface ChildRow {
  id: string
  parent_id: string
  full_name: string
  nickname: string | null
}

interface BranchRow {
  id: string
  name: string
  slug: string
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

interface CourseTypeRow {
  id: string
  name: CourseTypeName
}

interface BookingRow {
  id: string
  user_id: string
  course_type_id: string
  month: number
  year: number
  total_sessions: number
  total_price: number
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
  branches?: { slug: string | null } | null
  course_types?: { name: CourseTypeName | null } | null
}

interface PricingTierRow {
  id: string
  course_type_id: string
  min_sessions: number
  max_sessions: number | null
  price_per_session: number | string
  package_price: number | string
  valid_from: string
  valid_to: string | null
  created_at: string | null
  course_types?: { name: CourseTypeName | null } | null
}

export default async function AdminBookingPage() {
  const supabase = createClient()

  // Fetch all users (role = user primarily, but allow all)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .order('full_name') as unknown as { data: ProfileRow[] | null }

  // Fetch all children
  const { data: children } = await supabase
    .from('children')
    .select('id, parent_id, full_name, nickname') as unknown as { data: ChildRow[] | null }

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, slug, address, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('name') as unknown as { data: BranchRow[] | null }

  // Fetch course types
  const { data: courseTypes } = await supabase
    .from('course_types')
    .select('id, name') as unknown as { data: CourseTypeRow[] | null }

  const { data: pricingTiers } = await supabase
    .from('pricing_tiers')
    .select(`
      id, course_type_id, min_sessions, max_sessions, price_per_session, package_price, valid_from, valid_to, created_at,
      course_types(name)
    `)
    .order('min_sessions', { ascending: true }) as unknown as { data: PricingTierRow[] | null }

  // Fetch existing bookings for incremental pricing
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, user_id, course_type_id, month, year, total_sessions, total_price')
    .in('status', ['paid', 'verified']) as unknown as { data: BookingRow[] | null }

  const { data: scheduleTemplates } = await supabase
    .from('schedule_templates')
    .select(`
      id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active, notes,
      branches(slug),
      course_types(name)
    `)
    .eq('is_active', true) as unknown as { data: ScheduleTemplateRow[] | null }

  // Build user list with children
  const users = (profiles || []).map((p) => ({
    id: p.id,
    full_name: p.full_name || 'ไม่ทราบชื่อ',
    email: p.email || '',
    phone: p.phone,
    role: p.role || 'user',
    children: (children || []).filter((c) => c.parent_id === p.id).map((c) => ({
      id: c.id,
      full_name: c.full_name,
      nickname: c.nickname,
    })),
  }))

  return (
    <AdminBookingClient
      users={users}
      branches={(branches || []).map((branch) => ({ ...branch, slug: branch.slug || '', updated_at: branch.updated_at || branch.created_at }))}
      courseTypes={courseTypes || []}
      scheduleTemplates={(scheduleTemplates || []).map((template) => ({
        id: template.id,
        branch_id: template.branch_id,
        branch_slug: template.branches?.slug || '',
        course_type_id: template.course_type_id,
        course_type_name: template.course_types?.name || 'kids_group',
        day_of_week: template.day_of_week,
        start_time: template.start_time.slice(0, 5),
        end_time: template.end_time.slice(0, 5),
        is_active: template.is_active,
        notes: template.notes,
      }))}
      existingBookings={bookings || []}
      pricingTiers={(pricingTiers || []).map((tier) => ({
        id: tier.id,
        course_type_id: tier.course_type_id,
        course_type_name: tier.course_types?.name || 'kids_group',
        min_sessions: tier.min_sessions,
        max_sessions: tier.max_sessions,
        price_per_session: Number(tier.price_per_session),
        package_price: Number(tier.package_price),
        valid_from: tier.valid_from,
        valid_to: tier.valid_to,
        created_at: tier.created_at,
      }))}
    />
  )
}
