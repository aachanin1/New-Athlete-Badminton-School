import { CheckinClient } from '@/components/coach/checkin-client'
import { getCoachAssignedTeachingDay } from '@/lib/coach-assigned-schedule'
import { createClient } from '@/lib/supabase/server'
import { getBangkokDateString } from '@/lib/utils'

interface CheckinPageProps {
  searchParams?: {
    slot?: string
  }
}

export default async function CheckinPage({ searchParams }: CheckinPageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getBangkokDateString()
  const teachingDay = await getCoachAssignedTeachingDay(supabase, user.id, today)

  const slots = teachingDay.slots.map((slot) => ({
    id: slot.id,
    branchId: slot.branchId,
    branchName: slot.branchName,
    courseType: slot.courseType,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }))

  const todayCheckins = teachingDay.slots
    .filter((slot) => slot.checkin)
    .map((slot) => ({
      id: slot.checkin!.id,
      scheduleSlotId: slot.id,
      branchName: slot.branchName,
      courseType: slot.courseType,
      startTime: slot.startTime,
      endTime: slot.endTime,
      checkinTime: slot.checkin!.checkinTime,
      photoUrl: slot.checkin!.photoUrl,
    }))

  const initialSlotId = slots.some((slot) => slot.id === searchParams?.slot) ? searchParams?.slot || null : null

  return <CheckinClient slots={slots} todayCheckins={todayCheckins} initialSlotId={initialSlotId} />
}
