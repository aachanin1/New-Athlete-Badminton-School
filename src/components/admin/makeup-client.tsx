'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Search, CalendarPlus, Calendar, User, Building2, Clock, CheckCircle2, Gift,
} from 'lucide-react'

interface BookingSessionData {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  status: string
  user_name: string
  learner_name: string
  branch_name: string
  course_type: string
  is_makeup: boolean
}

interface BranchOption {
  id: string
  name: string
  slug: string
}

interface MakeupClientProps {
  sessions: BookingSessionData[]
  branches: BranchOption[]
}

export function MakeupClient({ sessions, branches }: MakeupClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state for creating makeup session
  const [selectedSession, setSelectedSession] = useState<BookingSessionData | null>(null)
  const [makeupDate, setMakeupDate] = useState('')
  const [makeupBranch, setMakeupBranch] = useState('')
  const [makeupNote, setMakeupNote] = useState('')

  // Only show absent or rescheduled sessions that could need makeup
  const eligibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterBranch !== 'all' && !s.branch_name.includes(filterBranch)) return false
      if (!search) return true
      const q = search.toLowerCase()
      return s.user_name.toLowerCase().includes(q) || s.learner_name.toLowerCase().includes(q) || s.branch_name.toLowerCase().includes(q)
    })
  }, [sessions, search, filterBranch])

  const stats = useMemo(() => ({
    total: sessions.length,
    absent: sessions.filter((s) => s.status === 'absent').length,
    makeups: sessions.filter((s) => s.is_makeup).length,
  }), [sessions])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

  const openMakeupDialog = (session: BookingSessionData) => {
    setSelectedSession(session)
    setMakeupDate('')
    setMakeupBranch('')
    setMakeupNote('')
    setDialogOpen(true)
  }

  const createMakeup = async () => {
    if (!selectedSession || !makeupDate) return
    setLoading(true)
    try {
      await fetch('/api/admin/makeup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_session_id: selectedSession.id,
          booking_id: selectedSession.booking_id,
          makeup_date: makeupDate,
          branch_id: makeupBranch || undefined,
          notes: makeupNote || undefined,
        }),
      })
      setDialogOpen(false)
      router.refresh()
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">วันชดเชย</h1>
        <p className="text-gray-500 text-sm mt-1">เลือกวันชดเชยให้นักเรียนโดยไม่คิดค่าใช้จ่าย (Super Admin เท่านั้น)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{stats.total}</p><p className="text-xs text-gray-500">sessions ทั้งหมด</p>
        </CardContent></Card>
        <Card className={stats.absent > 0 ? 'ring-2 ring-red-300' : ''}><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.absent}</p><p className="text-xs text-gray-500">ขาดเรียน</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.makeups}</p><p className="text-xs text-gray-500">ชดเชยแล้ว</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหาชื่อผู้ใช้, นักเรียน..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-48"><SelectValue placeholder="สาขา" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสาขา</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Session list */}
      {eligibleSessions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่พบข้อมูล</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {eligibleSessions.map((session) => (
            <Card key={session.id} className={`overflow-hidden ${session.status === 'absent' ? 'border-red-200' : session.is_makeup ? 'border-green-200' : ''}`}>
              <CardContent className="p-0">
                <div className="flex items-center gap-3 p-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${session.is_makeup ? 'bg-green-100' : session.status === 'absent' ? 'bg-red-100' : 'bg-gray-100'}`}>
                    {session.is_makeup ? <Gift className="h-5 w-5 text-green-600" /> : <Calendar className="h-5 w-5 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{session.learner_name}</p>
                      <Badge className={`text-[10px] ${session.status === 'absent' ? 'bg-red-100 text-red-700' : session.is_makeup ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {session.is_makeup ? 'ชดเชย' : session.status === 'absent' ? 'ขาดเรียน' : session.status}
                      </Badge>
                      <Badge className="text-[10px] bg-blue-100 text-blue-700">{session.course_type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{session.user_name}</span>
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{session.branch_name}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(session.date)} {session.start_time}-{session.end_time}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {session.status === 'absent' && !session.is_makeup && (
                      <Button size="sm" className="bg-[#f57e3b] hover:bg-[#e06d2e] text-white h-8" onClick={() => openMakeupDialog(session)}>
                        <CalendarPlus className="h-3.5 w-3.5 mr-1" />ชดเชย
                      </Button>
                    )}
                    {session.is_makeup && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Makeup Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">สร้างวันชดเชย (ไม่คิดเงิน)</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p className="font-medium">{selectedSession.learner_name}</p>
                <p className="text-gray-500 text-xs">วันเดิม: {formatDate(selectedSession.date)} {selectedSession.start_time}-{selectedSession.end_time}</p>
                <p className="text-gray-500 text-xs">{selectedSession.branch_name} • {selectedSession.course_type}</p>
              </div>

              <div>
                <Label>วันชดเชย *</Label>
                <Input type="date" value={makeupDate} onChange={(e) => setMakeupDate(e.target.value)} />
              </div>

              <div>
                <Label>สาขา (เปลี่ยนได้)</Label>
                <Select value={makeupBranch} onValueChange={setMakeupBranch}>
                  <SelectTrigger><SelectValue placeholder="สาขาเดิม" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>หมายเหตุ</Label>
                <Input value={makeupNote} onChange={(e) => setMakeupNote(e.target.value)} placeholder="เหตุผลชดเชย (ไม่บังคับ)" />
              </div>

              <Button className="w-full bg-[#f57e3b] hover:bg-[#e06d2e]" onClick={createMakeup} disabled={loading || !makeupDate}>
                {loading ? 'กำลังบันทึก...' : 'สร้างวันชดเชย (ฟรี)'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
