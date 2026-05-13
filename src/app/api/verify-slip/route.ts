import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyRoles, notifyUser } from '@/lib/notifications'
import { validateSlipData, verifySlip } from '@/lib/slipok'

interface BookingRow {
  id: string
  total_price: number
  status: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bookingIdsJson = formData.get('bookingIds') as string | null
    const expectedAmountStr = formData.get('expectedAmount') as string | null

    if (!file || !bookingIdsJson || !expectedAmountStr) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ: file, bookingIds, expectedAmount' }, { status: 400 })
    }

    const bookingIds = JSON.parse(bookingIdsJson) as string[]
    const expectedAmount = parseFloat(expectedAmountStr)

    if (bookingIds.length === 0 || Number.isNaN(expectedAmount)) {
      return NextResponse.json({ error: 'bookingIds หรือยอดเงินไม่ถูกต้อง' }, { status: 400 })
    }

    const { data: bookings } = await (supabase.from('bookings') as any)
      .select('id, total_price, status')
      .eq('user_id', user.id)
      .in('id', bookingIds)
      .eq('status', 'pending_payment') as { data: BookingRow[] | null }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการจองที่รอชำระเงิน' }, { status: 404 })
    }

    const bookingTotal = bookings.reduce((sum, booking) => sum + (booking.total_price || 0), 0)
    if (Math.abs(bookingTotal - expectedAmount) > 1) {
      return NextResponse.json({ error: `ยอดเงินไม่ตรงกับยอดจอง (${bookingTotal} vs ${expectedAmount})` }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}/${bookingIds[0]}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase
      .storage
      .from('payment-slips')
      .upload(fileName, fileBuffer, { contentType: file.type })

    if (uploadError) {
      return NextResponse.json({ error: `อัปโหลดสลิปไม่สำเร็จ: ${uploadError.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('payment-slips').getPublicUrl(fileName)

    const isTestMode = process.env.SLIPOK_TEST_MODE === 'true'
    let verificationStatus: 'approved' | 'pending' = 'pending'
    let verificationNotes = ''
    let slipResult: any = null

    if (isTestMode) {
      verificationStatus = 'approved'
      verificationNotes = `[TEST MODE] Auto-verified: ฿${expectedAmount} | ${new Date().toISOString()}`
      slipResult = {
        success: true,
        data: {
          transRef: `TEST-${Date.now()}`,
          amount: expectedAmount,
          sender: { name: 'Test User' },
          date: new Date().toISOString(),
        },
      }
    } else {
      slipResult = await verifySlip(fileBuffer, file.name)

      if (slipResult.success && slipResult.data) {
        const validation = validateSlipData(slipResult.data, expectedAmount)

        if (validation.valid) {
          verificationStatus = 'approved'
          verificationNotes = `SlipOK verified: ${slipResult.data.transRef} | ฿${slipResult.data.amount} | ${slipResult.data.sender?.name || '-'}`
        } else {
          verificationStatus = 'pending'
          verificationNotes = `SlipOK: ${validation.reason}`
        }
      } else {
        verificationNotes = `SlipOK error: ${slipResult.message || 'unknown'}`
      }
    }

    for (const bookingId of bookingIds) {
      const booking = bookings.find((item) => item.id === bookingId)
      await (supabase.from('payments') as any).insert({
        booking_id: bookingId,
        user_id: user.id,
        amount: booking?.total_price || 0,
        method: 'transfer',
        slip_image_url: publicUrl,
        status: verificationStatus,
        verified_at: verificationStatus === 'approved' ? new Date().toISOString() : null,
        notes: verificationNotes,
      })
    }

    await (supabase.from('bookings') as any)
      .update({ status: verificationStatus === 'approved' ? 'verified' : 'paid' })
      .in('id', bookingIds)

    const adminSupabase = getServiceRoleClient()
    await notifyRoles(adminSupabase as any, {
      roles: ['admin', 'super_admin'],
      title: verificationStatus === 'approved' ? 'SlipOK ยืนยันการชำระเงินแล้ว' : 'มีสลิปรอตรวจสอบ',
      message: `${bookingIds.length} รายการ · ยอด ${expectedAmount.toLocaleString('th-TH')} บาท`,
      type: 'payment',
      link_url: '/admin/payments',
    })

    if (verificationStatus === 'approved') {
      await notifyUser(adminSupabase as any, {
        user_id: user.id,
        title: 'ยืนยันการชำระเงินสำเร็จ',
        message: `ระบบยืนยันสลิปของคุณแล้ว สำหรับ ${bookingIds.length} รายการ`,
        type: 'payment',
        link_url: '/dashboard/history',
      })
    }

    return NextResponse.json({
      success: true,
      verified: verificationStatus === 'approved',
      slipData: slipResult?.data ? {
        transRef: slipResult.data.transRef,
        amount: slipResult.data.amount,
        sender: slipResult.data.sender?.name,
        date: slipResult.data.date,
      } : null,
      notes: verificationNotes,
    })
  } catch (error) {
    console.error('Verify slip error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}
