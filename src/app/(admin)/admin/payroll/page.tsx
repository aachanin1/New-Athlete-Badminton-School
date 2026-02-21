import { createClient } from '@/lib/supabase/server'
import { PayrollClient } from '@/components/admin/payroll-client'

export default async function PayrollPage() {
  const supabase = createClient()

  const { data: hours } = await (supabase
    .from('coach_teaching_hours')
    .select('coach_id, date, group_hours, private_hours, total_hours, profiles!coach_teaching_hours_coach_id_fkey(full_name)')
    .order('date', { ascending: false })
    .limit(1000) as any)

  const hoursList = (hours || []).map((h: any) => ({
    coach_id: h.coach_id,
    coach_name: h.profiles?.full_name || 'ไม่ทราบ',
    date: h.date,
    group_hours: Number(h.group_hours),
    private_hours: Number(h.private_hours),
    total_hours: Number(h.total_hours),
  }))

  const now = new Date()
  return <PayrollClient hours={hoursList} currentMonth={now.getMonth() + 1} currentYear={now.getFullYear()} />
}
