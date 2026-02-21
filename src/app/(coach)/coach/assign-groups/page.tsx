import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UsersRound, UserCog, MapPin, Baby, User } from 'lucide-react'

export default async function AssignGroupsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check head_coach or super_admin role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!profile || !['head_coach', 'super_admin'].includes(profile.role)) {
    redirect('/coach')
  }

  // Get head coach's branches
  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('branch_id, branches(name)')
    .eq('coach_id', user.id) as any)

  const branchIds = (coachBranches || []).map((cb: any) => cb.branch_id)
  const branchMap: Record<string, string> = {}
  ;(coachBranches || []).forEach((cb: any) => { branchMap[cb.branch_id] = cb.branches?.name || '' })

  // Get all coaches in same branches
  let coaches: any[] = []
  if (branchIds.length > 0) {
    const { data: allCoachBranches } = await (supabase
      .from('coach_branches')
      .select('coach_id, branch_id, profiles!coach_branches_coach_id_fkey(full_name, role)')
      .in('branch_id', branchIds) as any)

    const coachMap = new Map<string, any>()
    ;(allCoachBranches || []).forEach((cb: any) => {
      if (!coachMap.has(cb.coach_id)) {
        coachMap.set(cb.coach_id, {
          id: cb.coach_id,
          name: cb.profiles?.full_name || '',
          role: cb.profiles?.role || '',
          branches: [],
        })
      }
      coachMap.get(cb.coach_id)!.branches.push(branchMap[cb.branch_id] || '')
    })
    coaches = Array.from(coachMap.values())
  }

  // Get students at these branches
  let studentCount = 0
  if (branchIds.length > 0) {
    const { count } = await (supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .in('status', ['paid', 'verified']) as any)
    studentCount = count || 0
  }

  // Get existing assignments
  const { data: assignments } = await (supabase
    .from('coach_assignments')
    .select('id, coach_id, schedule_slot_id, created_at, profiles!coach_assignments_coach_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(20) as any)

  const ROLE_LABELS: Record<string, string> = { coach: 'โค้ช', head_coach: 'หัวหน้าโค้ช', admin: 'Admin', super_admin: 'Super Admin' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">แบ่งกลุ่มนักเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">จัดกลุ่มนักเรียนให้โค้ชในแต่ละรอบเรียน</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{coaches.length}</p>
          <p className="text-xs text-gray-500">โค้ชในสาขา</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#f57e3b]">{studentCount}</p>
          <p className="text-xs text-gray-500">การจองที่ active</p>
        </CardContent></Card>
      </div>

      {/* Coaches list */}
      <div>
        <h2 className="text-lg font-bold text-[#153c85] mb-3">โค้ชในสาขา</h2>
        {coaches.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-gray-400">
            <UserCog className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">ยังไม่มีโค้ชในสาขา</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {coaches.map((coach: any) => (
              <Card key={coach.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2748bf]/10 flex items-center justify-center shrink-0">
                    <UserCog className="h-5 w-5 text-[#2748bf]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{coach.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-[10px] bg-blue-100 text-blue-700">{ROLE_LABELS[coach.role] || coach.role}</Badge>
                      {coach.branches.map((b: string, i: number) => (
                        <span key={i} className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />{b}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent assignments */}
      {(assignments || []).length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#153c85] mb-3">การแบ่งกลุ่มล่าสุด</h2>
          <div className="space-y-1">
            {(assignments || []).map((a: any) => (
              <Card key={a.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{a.profiles?.full_name || 'โค้ช'}</p>
                    <p className="text-[11px] text-gray-400">{new Date(a.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">slot: {a.schedule_slot_id?.slice(0, 8)}...</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 text-sm text-blue-700">
          <p className="font-medium">💡 หมายเหตุ</p>
          <p className="text-xs mt-1">ระบบแบ่งกลุ่มนักเรียนอัตโนมัติจะพัฒนาเพิ่มเติมในอนาคต รองรับการลากวางนักเรียนเข้ากลุ่มโค้ชแต่ละรอบ</p>
        </CardContent>
      </Card>
    </div>
  )
}
