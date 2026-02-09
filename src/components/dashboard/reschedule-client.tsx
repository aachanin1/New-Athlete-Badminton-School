'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeftRight,
  CalendarDays,
  MapPin,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

interface SessionRow {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  status: string
  is_makeup: boolean
  bookings?: { user_id: string; course_type_id: string; children?: { full_name: string } | null }
  branches?: { name: string } | null
}

interface BranchOption {
  id: string
  name: string
}

interface RescheduleClientProps {
  sessions: SessionRow[]
  branches: BranchOption[]
}

function canReschedule(sessionDate: string, sessionTime: string): boolean {
  const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`)
  const now = new Date()
  const diffMs = sessionDateTime.getTime() - now.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return diffHours >= 24
}

function formatDateThai(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function RescheduleClient({ sessions, branches }: RescheduleClientProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null)
  const [newDate, setNewDate] = useState('')
  const [newBranchId, setNewBranchId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const openDialog = (session: SessionRow) => {
    setSelectedSession(session)
    setNewDate('')
    setNewBranchId(session.branch_id)
    setError(null)
    setSuccess(false)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSession) return

    if (!newDate && newBranchId === selectedSession.branch_id) {
      setError('กรุณาเลือกวันใหม่หรือสาขาใหม่')
      return
    }

    // Validate 24-hour rule
    if (!canReschedule(selectedSession.date, selectedSession.start_time)) {
      setError('ไม่สามารถเปลี่ยนได้ — ต้องเปลี่ยนล่วงหน้าอย่างน้อย 24 ชั่วโมง')
      return
    }

    // Validate new date is in the future
    if (newDate) {
      const newDateTime = new Date(newDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (newDateTime < today) {
        setError('วันที่ใหม่ต้องเป็นวันในอนาคต')
        return
      }
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    const updateData: Record<string, any> = {
      status: 'rescheduled',
    }

    // Create new session (rescheduled)
    const newSessionData: Record<string, any> = {
      booking_id: selectedSession.booking_id,
      schedule_slot_id: selectedSession.id, // reference
      date: newDate || selectedSession.date,
      start_time: selectedSession.start_time,
      end_time: selectedSession.end_time,
      branch_id: newBranchId || selectedSession.branch_id,
      status: 'scheduled',
      rescheduled_from_id: selectedSession.id,
      is_makeup: false,
    }

    // Mark old session as rescheduled
    const { error: updateErr } = await (supabase
      .from('booking_sessions') as any)
      .update(updateData)
      .eq('id', selectedSession.id)

    if (updateErr) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
      return
    }

    // Insert new rescheduled session
    const { error: insertErr } = await (supabase
      .from('booking_sessions') as any)
      .insert(newSessionData)

    if (insertErr) {
      // Rollback: restore old session
      await (supabase.from('booking_sessions') as any)
        .update({ status: 'scheduled' })
        .eq('id', selectedSession.id)
      setError('เกิดข้อผิดพลาดในการสร้างรอบใหม่ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      setDialogOpen(false)
      router.refresh()
    }, 1500)
  }

  // Get min date for date picker (tomorrow)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center text-gray-400">
            <ArrowLeftRight className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">ไม่มีรอบเรียนที่สามารถเปลี่ยนได้</p>
            <p className="text-sm mt-1">ตารางจะแสดงเฉพาะรอบที่ยังไม่ถึงเวลาเรียน</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">กฎการเปลี่ยนวัน/สาขา</p>
          <p>• ต้องเปลี่ยนล่วงหน้าอย่างน้อย <strong>24 ชั่วโมง</strong> ก่อนเวลาเรียน</p>
          <p>• สามารถเปลี่ยนวัน เปลี่ยนสาขา หรือทั้งสองอย่างได้</p>
        </div>
      </div>

      <div className="space-y-3">
        {sessions.map((session) => {
          const canChange = canReschedule(session.date, session.start_time)
          return (
            <Card key={session.id} className={!canChange ? 'opacity-60' : ''}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#2748bf]/10 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-xs text-[#2748bf] font-medium">
                      {new Date(session.date).toLocaleDateString('th-TH', { weekday: 'short' })}
                    </span>
                    <span className="text-lg font-bold text-[#2748bf]">
                      {new Date(session.date).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{formatDateThai(session.date)}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {session.start_time} - {session.end_time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {session.branches?.name || '-'}
                      </span>
                    </div>
                    {session.bookings?.children && (
                      <p className="text-xs text-gray-400 mt-0.5">👦 {session.bookings.children.full_name}</p>
                    )}
                  </div>
                </div>

                <div>
                  {canChange ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[#2748bf] border-[#2748bf]/30 hover:bg-[#2748bf]/5"
                      onClick={() => openDialog(session)}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                      เปลี่ยน
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-gray-400 border-gray-200">
                      เปลี่ยนไม่ได้
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Reschedule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-green-700 mb-2">
                เปลี่ยนสำเร็จ!
              </DialogTitle>
              <DialogDescription>
                รอบเรียนถูกเปลี่ยนเรียบร้อยแล้ว
              </DialogDescription>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#153c85]">เปลี่ยนวัน/สาขา</DialogTitle>
                <DialogDescription>
                  รอบเดิม: {selectedSession && formatDateThai(selectedSession.date)} • {selectedSession?.start_time} - {selectedSession?.end_time}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="new-date">วันใหม่</Label>
                  <Input
                    id="new-date"
                    type="date"
                    min={minDate}
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                  <p className="text-xs text-gray-400">เว้นว่างถ้าเปลี่ยนเฉพาะสาขา</p>
                </div>

                <div className="space-y-2">
                  <Label>สาขาใหม่</Label>
                  <Select value={newBranchId} onValueChange={setNewBranchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสาขา" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                          {b.id === selectedSession?.branch_id ? ' (ปัจจุบัน)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDialogOpen(false)}
                    disabled={loading}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#2748bf] hover:bg-[#153c85]"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        กำลังเปลี่ยน...
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        ยืนยันการเปลี่ยน
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
