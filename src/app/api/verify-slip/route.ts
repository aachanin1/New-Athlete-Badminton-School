import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  inspectProgressiveSlip,
  PROGRESSIVE_PAYMENT_MAX_FILE_BYTES,
} from '@/lib/progressive-payment-integration'
import { isSlipOKTimeout, validateSlipData, verifySlip, type SlipOKResponse } from '@/lib/slipok'
import type { PaymentStatus } from '@/types/database'
import { Task10Error } from '@/lib/task10-policy'
import { acceptLegacySlip, finalizeLegacySlip, readLegacySlipRequest } from '@/lib/booking-payment-lifecycle'

export const runtime = 'nodejs'

interface BookingRow {
  id: string
  total_price: number
  status: string
}


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

function buildCanonicalSlipFileName(extension: string) {
  return `slip.${extension}`
}

const VERIFY_SLIP_ERROR_CODES = {
  invalidPayload: 'INVALID_SLIP_UPLOAD_PAYLOAD',
  invalidFileType: 'INVALID_SLIP_FILE_TYPE',
  fileTooLarge: 'SLIP_FILE_TOO_LARGE',
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
  let receiptAccepted = false

  try {
    const formData = await request.formData()
    const formFile = formData.get('file')
    const file = formFile instanceof File ? formFile : null
    const bookingIds = parseBookingIds(formData.get('bookingIds') as string | null)
    const expectedAmount = Number(formData.get('expectedAmount'))
    const receiptRequestId = typeof formData.get('requestId') === 'string' ? String(formData.get('requestId')) : randomUUID()
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(receiptRequestId)) {
      return jsonError('รหัสส่งสลิปไม่ถูกต้อง', 400, { code: VERIFY_SLIP_ERROR_CODES.invalidPayload })
    }
    const adminSupabase = getServiceRoleClient()

    if (!file || bookingIds.length === 0 || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return jsonError('ข้อมูลไม่ครบ กรุณาเลือกสลิปและลองส่งอีกครั้ง', 400, {
        code: VERIFY_SLIP_ERROR_CODES.invalidPayload,
      })
    }

    if (file.size > PROGRESSIVE_PAYMENT_MAX_FILE_BYTES) {
      return jsonError('ไฟล์สลิปต้องมีขนาดไม่เกิน 4 MB', 413, {
        code: VERIFY_SLIP_ERROR_CODES.fileTooLarge,
      })
    }

    if (file.size < 12) {
      return jsonError('เนื้อไฟล์ไม่ใช่ JPEG, PNG หรือ WebP ที่ระบบรองรับ', 400, {
        code: VERIFY_SLIP_ERROR_CODES.invalidFileType,
      })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const inspected = inspectProgressiveSlip(fileBuffer)
    if (!inspected) {
      return jsonError('เนื้อไฟล์ไม่ใช่ JPEG, PNG หรือ WebP ที่ระบบรองรับ', 400, {
        code: VERIFY_SLIP_ERROR_CODES.invalidFileType,
      })
    }

    const priorReceipt = await readLegacySlipRequest(adminSupabase, user.id, receiptRequestId)
    if (priorReceipt?.found && (priorReceipt.sha256 !== inspected.sha256 || priorReceipt.totalAmount !== expectedAmount
      || JSON.stringify([...(priorReceipt.bookingIds || [])].sort()) !== JSON.stringify([...bookingIds].sort()))) {
      throw new Task10Error('TASK10_IDEMPOTENCY_CONFLICT', 'คำขอส่งสลิปนี้ไม่ตรงกับรายการที่ระบบรับไว้แล้ว')
    }
    receiptAccepted = Boolean(priorReceipt?.found)

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_price, status')
      .eq('user_id', user.id)
      .in('id', bookingIds)
      .in('status', priorReceipt?.found ? ['pending_payment', 'paid', 'verified'] : ['pending_payment'])

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

    if (priorReceipt?.finalized) return NextResponse.json({ success: true, verified: true, paymentStatus: 'approved',
      bookingStatus: 'verified', slipData: null, notes: priorReceipt.notes, reviewMessage: null, warningCode: null })

    const fileName = priorReceipt?.storagePath || `${user.id}/${receiptRequestId}-${inspected.sha256}.${inspected.extension}`
    let uploadError: { message: string } | null = null
    if (!priorReceipt?.found) {
      const upload = await supabase.storage.from('payment-slips').upload(fileName, fileBuffer, { contentType: inspected.mimeType })
      uploadError = upload.error
      if (upload.error && String(upload.error.statusCode) === '409') {
        // A Storage-only retry may reuse exactly these content-addressed bytes.
        const existing = await adminSupabase.storage.from('payment-slips').download(fileName)
        if (existing.data && !existing.error && inspectProgressiveSlip(Buffer.from(await existing.data.arrayBuffer()))?.sha256 === inspected.sha256) uploadError = null
      }
    }

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

    if (!priorReceipt?.found) {
      await acceptLegacySlip(adminSupabase, { userId: user.id, bookingIds, storagePath: fileName,
        publicUrl, sha256: inspected.sha256, expectedAmount, requestId: receiptRequestId })
      receiptAccepted = true
    }

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
      slipResult = await verifySlip(
        fileBuffer,
        buildCanonicalSlipFileName(inspected.extension),
        expectedAmount,
      )
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

    await finalizeLegacySlip(adminSupabase, { userId: user.id, requestId: receiptRequestId,
      approved: verificationStatus === 'approved', notes: verificationNotes })

    const nextBookingStatus = verificationStatus === 'approved' ? 'verified' : 'paid'

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
    if (error instanceof Task10Error) return jsonError(error.message, error.status, { code: error.code, paymentRecorded: receiptAccepted, refreshRequired: error.status === 409 })
    console.error('Verify slip error:', error)
    return jsonError(`เกิดข้อผิดพลาด: ${getErrorMessage(error)}`, 500, {
      code: VERIFY_SLIP_ERROR_CODES.unexpected,
    })
  }
}
