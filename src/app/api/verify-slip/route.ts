import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyRoles, notifyUser } from '@/lib/notifications'
import { validateSlipData, verifySlip, type SlipOKResponse } from '@/lib/slipok'
import type { Database, PaymentStatus } from '@/types/database'

interface BookingRow {
  id: string
  total_price: number
  status: string
}

interface DbError {
  message: string
}

interface PaymentInsertTable {
  insert(values: Database['public']['Tables']['payments']['Insert'][]): Promise<{ error: DbError | null }>
}

interface BookingStatusUpdateQuery {
  eq(column: string, value: string): {
    in(column: string, values: string[]): Promise<{ error: DbError | null }>
  }
}

interface BookingUpdateTable {
  update(values: { status: 'paid' | 'verified' }): BookingStatusUpdateQuery
}

type NotificationSupabase = Parameters<typeof notifyUser>[0]

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function parseBookingIds(value: string | null) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []

    return Array.from(new Set(
      parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    ))
  } catch {
    return []
  }
}

function buildSlipPublicPath(userId: string, bookingId: string, fileName: string) {
  const fileExt = fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
  return `${userId}/${bookingId}-${Date.now()}.${fileExt}`
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
    const bookingIds = parseBookingIds(formData.get('bookingIds') as string | null)
    const expectedAmount = Number(formData.get('expectedAmount'))

    if (!file || bookingIds.length === 0 || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ: file, bookingIds, expectedAmount' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'กรุณาอัปโหลดไฟล์รูปภาพสลิปเท่านั้น' }, { status: 400 })
    }

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_price, status')
      .eq('user_id', user.id)
      .in('id', bookingIds)
      .eq('status', 'pending_payment')

    if (bookingError) {
      return NextResponse.json({ error: `โหลดรายการจองไม่สำเร็จ: ${bookingError.message}` }, { status: 500 })
    }

    const bookingRows = (bookings || []) as BookingRow[]

    if (bookingRows.length !== bookingIds.length) {
      return NextResponse.json({
        error: 'รายการจองบางรายการไม่พบ หรือไม่ได้อยู่ในสถานะรอชำระเงินแล้ว กรุณารีเฟรชหน้าแล้วตรวจสอบอีกครั้ง',
      }, { status: 409 })
    }

    const bookingTotal = bookingRows.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0)
    if (Math.abs(bookingTotal - expectedAmount) > 1) {
      return NextResponse.json({ error: `ยอดเงินไม่ตรงกับยอดจอง (${bookingTotal} vs ${expectedAmount})` }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileName = buildSlipPublicPath(user.id, bookingIds[0], file.name)

    const { error: uploadError } = await supabase
      .storage
      .from('payment-slips')
      .upload(fileName, fileBuffer, { contentType: file.type })

    if (uploadError) {
      return NextResponse.json({ error: `อัปโหลดสลิปไม่สำเร็จ: ${uploadError.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('payment-slips').getPublicUrl(fileName)

    const isTestMode = process.env.SLIPOK_TEST_MODE === 'true'
    let verificationStatus: PaymentStatus = 'pending'
    let verificationNotes = ''
    let slipResult: SlipOKResponse | null = null

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
        } as SlipOKResponse['data'],
      }
    } else {
      slipResult = await verifySlip(fileBuffer, file.name)

      if (slipResult.success && slipResult.data) {
        const validation = validateSlipData(slipResult.data, expectedAmount)

        if (validation.valid) {
          verificationStatus = 'approved'
          verificationNotes = `SlipOK verified: ${slipResult.data.transRef} | ฿${slipResult.data.amount} | ${slipResult.data.sender?.name || '-'}`
        } else {
          verificationNotes = `SlipOK: ${validation.reason}`
        }
      } else {
        verificationNotes = `SlipOK error: ${slipResult?.message || 'unknown'}`
      }
    }

    const adminSupabase = getServiceRoleClient()
    const now = new Date().toISOString()
    const paymentRows: Database['public']['Tables']['payments']['Insert'][] = bookingRows.map((booking) => ({
      booking_id: booking.id,
      user_id: user.id,
      amount: Number(booking.total_price || 0),
      method: 'transfer',
      slip_image_url: publicUrl,
      status: verificationStatus,
      verified_by: null,
      verified_at: verificationStatus === 'approved' ? now : null,
      notes: verificationNotes,
    }))

    const paymentsTable = adminSupabase.from('payments') as unknown as PaymentInsertTable
    const { error: paymentError } = await paymentsTable
      .insert(paymentRows)

    if (paymentError) {
      return NextResponse.json({ error: `บันทึกข้อมูลการชำระเงินไม่สำเร็จ: ${paymentError.message}` }, { status: 500 })
    }

    const nextBookingStatus = verificationStatus === 'approved' ? 'verified' : 'paid'
    const bookingsTable = adminSupabase.from('bookings') as unknown as BookingUpdateTable
    const { error: bookingUpdateError } = await bookingsTable
      .update({ status: nextBookingStatus })
      .eq('user_id', user.id)
      .in('id', bookingIds)

    if (bookingUpdateError) {
      return NextResponse.json({ error: `อัปเดตสถานะการจองไม่สำเร็จ: ${bookingUpdateError.message}` }, { status: 500 })
    }

    await notifyRoles(adminSupabase as NotificationSupabase, {
      roles: ['admin', 'super_admin'],
      title: verificationStatus === 'approved' ? 'SlipOK ยืนยันการชำระเงินแล้ว' : 'มีสลิปรอตรวจสอบ',
      message: `${bookingIds.length} รายการ • ยอด ${expectedAmount.toLocaleString('th-TH')} บาท`,
      type: 'payment',
      link_url: '/admin/payments',
    })

    await notifyUser(adminSupabase as NotificationSupabase, {
      user_id: user.id,
      title: verificationStatus === 'approved' ? 'ชำระเงินสำเร็จ' : 'ส่งสลิปแล้ว รอตรวจสอบ',
      message: verificationStatus === 'approved'
        ? `ระบบยืนยันสลิปของคุณแล้วสำหรับ ${bookingIds.length} รายการ`
        : 'ระบบรับสลิปของคุณแล้ว หาก SlipOK ยังไม่ยืนยันอัตโนมัติ แอดมินจะตรวจสอบต่อ',
      type: 'payment',
      link_url: '/dashboard/history',
    })

    return NextResponse.json({
      success: true,
      verified: verificationStatus === 'approved',
      paymentStatus: verificationStatus,
      bookingStatus: nextBookingStatus,
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
