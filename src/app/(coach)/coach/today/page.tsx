import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck, Clock, MapPin, User, Baby, Users } from 'lucide-react'

export default async function CoachTodayPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().split('T')[0]
  const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
  const todayName = dayNames[new Date().getDay()]

  // Get coach's branches
  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('branch_id, branches(name)')
    .eq('coach_id', user.id) as any)

  const branchIds = (coachBranches || []).map((cb: any) => cb.branch_id)
  const branchMap: Record<string, string> = {}
  ;(coachBranches || []).forEach((cb: any) => { branchMap[cb.branch_id] = cb.branches?.name || '' })

  // Get today's booking sessions at coach's branches
  let sessions: any[] = []
  if (branchIds.length > 0) {
    const { data } = await (supabase
      .from('booking_sessions')
      .select('id, booking_id, date, start_time, end_time, branch_id, child_id, status, bookings(user_id, learner_type, course_type_id, profiles!bookings_user_id_fkey(full_name, phone), course_types(name))')
      .eq('date', today)
      .in('status', ['scheduled', 'completed'])
      .in('branch_id', branchIds)
      .order('start_time') as any)
    sessions = data || []
  }

  // Get children names
  const childIds = sessions.filter((s: any) => s.child_id).map((s: any) => s.child_id)
  let childMap: Record<string, string> = {}
  if (childIds.length > 0) {
    const { data: children } = await (supabase
      .from('children')
      .select('id, full_name, nickname')
      .in('id', childIds) as any)
    ;(children || []).forEach((c: any) => { childMap[c.id] = c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name })
  }

  // Group sessions by time slot
  const grouped: Record<string, any[]> = {}
  sessions.forEach((s: any) => {
    const key = `${s.branch_id}-${s.start_time}-${s.end_time}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  })

  const COURSE_LABELS: Record<string, string> = { kids_group: 'เด็กกลุ่ม', adult_group: 'ผู้ใหญ่กลุ่ม', private: 'Private' }

  const fmtTime = (t: string) => t?.slice(0, 5) || ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">รอบสอนวันนี้</h1>
        <p className="text-gray-500 text-sm mt-1">วัน{todayName}ที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่มีรอบสอนวันนี้</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([key, slotSessions]) => {
            const first = slotSessions[0]
            const branchName = branchMap[first.branch_id] || ''
            const courseType = first.bookings?.course_types?.name || ''
            return (
              <Card key={key}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#2748bf]/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-[#2748bf]" />
                      </div>
                      <div>
                        <p className="font-bold text-[#153c85]">{fmtTime(first.start_time)} - {fmtTime(first.end_time)}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{branchName}</span>
                          <Badge className="text-[10px] bg-blue-100 text-blue-700">{COURSE_LABELS[courseType] || courseType}</Badge>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />{slotSessions.length} คน
                    </Badge>
                  </div>

                  <div className="border-t pt-2 space-y-1.5">
                    {slotSessions.map((s: any) => {
                      const studentName = s.child_id
                        ? childMap[s.child_id] || 'เด็ก'
                        : s.bookings?.profiles?.full_name || 'ผู้เรียน'
                      const parentName = s.bookings?.profiles?.full_name || ''
                      const isChild = !!s.child_id
                      return (
                        <div key={s.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-gray-50">
                          {isChild ? <Baby className="h-3.5 w-3.5 text-pink-500 shrink-0" /> : <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                          <span className="font-medium">{studentName}</span>
                          {isChild && parentName && <span className="text-xs text-gray-400">(ผู้ปกครอง: {parentName})</span>}
                          <Badge className={`ml-auto text-[10px] ${s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {s.status === 'completed' ? 'เสร็จ' : 'รอสอน'}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
