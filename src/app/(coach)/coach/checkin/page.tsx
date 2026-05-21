import { CheckinClient } from '@/components/coach/checkin-client'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { getAdminReturnedAttendanceSlotIds } from '@/lib/coach-attendance-review'
import { getCoachAssignedTeachingDay } from '@/lib/coach-assigned-schedule'
import { createClient } from '@/lib/supabase/server'
import { getBangkokDateString } from '@/lib/utils'

interface CheckinPageProps {
  searchParams?: {
    date?: string
    slot?: string
  }
}

function toInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDateString(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime()) && value === toInputDate(parsed)
}

export default async function CheckinPage({ searchParams }: CheckinPageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getBangkokDateString()
  const selectedDate = isValidDateString(searchParams?.date) ? searchParams?.date as string : today
  const teachingDay = await getCoachAssignedTeachingDay(supabase, user.id, selectedDate)
  const adminReturnedSlotIds = await getAdminReturnedAttendanceSlotIds(
    getServiceRoleClient(),
    user.id,
    teachingDay.slots.map((slot) => slot.id),
  )

  const slots = teachingDay.slots.map((slot) => ({
    id: slot.id,
    branchId: slot.branchId,
    branchName: slot.branchName,
    courseType: slot.courseType,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    canRetroactiveCheckin: adminReturnedSlotIds.has(slot.id),
  }))

  const todayCheckins = teachingDay.slots
    .filter((slot) => slot.checkin)
    .map((slot) => ({
      id: slot.checkin!.id,
      scheduleSlotId: slot.id,
      branchName: slot.branchName,
      courseType: slot.courseType,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      checkinTime: slot.checkin!.checkinTime,
      photoUrl: slot.checkin!.photoUrl,
    }))

  const initialSlotId = slots.some((slot) => slot.id === searchParams?.slot) ? searchParams?.slot || null : null

  return <CheckinClient slots={slots} todayCheckins={todayCheckins} initialSlotId={initialSlotId} selectedDate={selectedDate} today={today} />
}
