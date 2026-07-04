import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyRoles, notifyUser } from '@/lib/notifications'
import { isSlipOKTimeout, validateSlipData, verifySlip, type SlipOKResponse } from '@/lib/slipok'
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

const VERIFY_SLIP_ERROR_CODES = {
  invalidPayload: 'INVALID_SLIP_UPLOAD_PAYLOAD',
  invalidFileType: 'INVALID_SLIP_FILE_TYPE',
  bookingLoadFailed: 'BOOKING_LOAD_FAILED',
  bookingStateConflict: 'BOOKING_STATE_CONFLICT',
  amountMismatch: 'BOOKING_AMOUNT_MISMATCH',
  uploadFailed: 'SLIP_UPLOAD_FAILED',
  paymentInsertFailed: 'PAYMENT_INSERT_FAILED',
  bookingStatusUpdateFailed: 'BOOKING_STATUS_UPDATE_FAILED',
  unexpected: 'VERIFY_SLIP_UNEXPECTED_ERROR',
} as const

function jsonError(
  error: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json({
    success: false,
    error,
    ...extra,
  }, { status })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
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
      return jsonError('ข้อมูลไม่ครบ กรุณาเลือกสลิปและลองส่งอีกครั้ง', 400, {
        code: VERIFY_SLIP_ERROR_CODES.invalidPayload,
      })
    }

    if (!file.type.startsWith('image/')) {
      return jsonError('กรุณาอัปโหลดไฟล์รูปภาพสลิปเท่านั้น', 400, {
        code: VERIFY_SLIP_ERROR_CODES.invalidFileType,
      })
    }

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_price, status')
      .eq('user_id', user.id)
      .in('id', bookingIds)
      .eq('status', 'pending_payment')

    if (bookingError) {
      console.error('[verify-slip] Failed to load pending bookings', {
        userId: user.id,
        bookingIds,
        error: bookingError.message,
      })
      return jsonError('โหลดรายการจองไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่', 500, {
        code: VERIFY_SLIP_ERROR_CODES.bookingLoadFailed,
      })
    }

    const bookingRows = (bookings || []) as BookingRow[]

    if (bookingRows.length !== bookingIds.length) {
      return jsonError(
        'รายการจองบางรายการไม่พบ หรือไม่ได้อยู่ในสถานะรอชำระเงินแล้ว กรุณารีเฟรชหน้าแล้วตรวจสอบอีกครั้ง',
        409,
        { code: VERIFY_SLIP_ERROR_CODES.bookingStateConflict }
      )
    }

    const bookingTotal = bookingRows.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0)
    if (Math.abs(bookingTotal - expectedAmount) > 1) {
      return jsonError(
        `ยอดเงินไม่ตรงกับยอดจอง (${bookingTotal.toLocaleString('th-TH')} vs ${expectedAmount.toLocaleString('th-TH')}) กรุณารีเฟรชหน้าแล้วตรวจสอบยอดอีกครั้ง`,
        400,
        { code: VERIFY_SLIP_ERROR_CODES.amountMismatch }
      )
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileName = buildSlipPublicPath(user.id, bookingIds[0], file.name)

    const { error: uploadError } = await supabase
      .storage
      .from('payment-slips')
      .upload(fileName, fileBuffer, { contentType: file.type })

    if (uploadError) {
      console.error('[verify-slip] Slip upload failed', {
        userId: user.id,
        bookingIds,
        error: uploadError.message,
      })
      return jsonError('อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 500, {
        code: VERIFY_SLIP_ERROR_CODES.uploadFailed,
      })
    }

    const { data: { publicUrl } } = supabase.storage.from('payment-slips').getPublicUrl(fileName)

    const isTestMode = process.env.SLIPOK_TEST_MODE === 'true'
    let verificationStatus: PaymentStatus = 'pending'
    let verificationNotes = ''
    let slipResult: SlipOKResponse | null = null
    let slipReviewMessage = ''
    let slipWarningCode: string | null = null

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
      slipResult = await verifySlip(fileBuffer, file.name, expectedAmount)
      const slipTimedOut = isSlipOKTimeout(slipResult)

      if (slipResult.success && slipResult.data) {
        const validation = validateSlipData(slipResult.data, expectedAmount)

        if (validation.valid) {
          verificationStatus = 'approved'
          verificationNotes = `SlipOK verified: ${slipResult.data.transRef} | ฿${slipResult.data.amount} | ${slipResult.data.sender?.name || '-'}`
        } else {
          verificationNotes = `SlipOK: ${validation.reason}`
          slipReviewMessage = validation.reason || 'SlipOK ยังไม่สามารถยืนยันสลิปนี้ได้ แอดมินจะตรวจสอบต่อ'
          slipWarningCode = 'SLIPOK_VALIDATION_FAILED'
        }
      } else if (slipTimedOut) {
        verificationNotes = `SlipOK timeout (${slipResult?.code || 'timeout'}): admin review required`
        slipReviewMessage = 'ระบบรับสลิปแล้ว แต่ SlipOK ใช้เวลาตรวจสอบนานเกินไป แอดมินจะตรวจสอบต่อ'
        slipWarningCode = 'SLIPOK_TIMEOUT'
      } else {
        const codeLabel = slipResult?.code ? ` (${slipResult.code})` : ''
        verificationNotes = `SlipOK error${codeLabel}: ${slipResult?.message || 'unknown'}`
        slipReviewMessage = slipResult?.message || 'SlipOK ยังไม่สามารถยืนยันสลิปนี้ได้ แอดมินจะตรวจสอบต่อ'
        slipWarningCode = slipResult?.code ? String(slipResult.code) : 'SLIPOK_REJECTED'
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
      console.error('[verify-slip] Payment insert failed after slip upload', {
        userId: user.id,
        bookingIds,
        paymentStatus: verificationStatus,
        error: paymentError.message,
      })
      return jsonError(
        'อัปโหลดสลิปสำเร็จแล้ว แต่บันทึกข้อมูลการชำระเงินไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่พร้อม Booking ID',
        500,
        {
          code: VERIFY_SLIP_ERROR_CODES.paymentInsertFailed,
          paymentRecorded: false,
          supportReviewRequired: true,
        }
      )
    }

    const nextBookingStatus = verificationStatus === 'approved' ? 'verified' : 'paid'
    const bookingsTable = adminSupabase.from('bookings') as unknown as BookingUpdateTable
    const { error: bookingUpdateError } = await bookingsTable
      .update({ status: nextBookingStatus })
      .eq('user_id', user.id)
      .in('id', bookingIds)

    if (bookingUpdateError) {
      console.error('[verify-slip] Booking status update failed after payment insert', {
        userId: user.id,
        bookingIds,
        nextBookingStatus,
        paymentStatus: verificationStatus,
        error: bookingUpdateError.message,
      })
      return jsonError(
        'ระบบรับสลิปและบันทึกการชำระเงินแล้ว แต่ยังอัปเดตสถานะการจองไม่สำเร็จ กรุณาติดต่อเจ้าหน้าที่ให้ตรวจสอบ Booking ID',
        500,
        {
          code: VERIFY_SLIP_ERROR_CODES.bookingStatusUpdateFailed,
          paymentRecorded: true,
          supportReviewRequired: true,
        }
      )
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
      reviewMessage: slipReviewMessage || null,
      warningCode: slipWarningCode,
    })
  } catch (error) {
    console.error('Verify slip error:', error)
    return jsonError(`เกิดข้อผิดพลาด: ${getErrorMessage(error)}`, 500, {
      code: VERIFY_SLIP_ERROR_CODES.unexpected,
    })
  }
}
