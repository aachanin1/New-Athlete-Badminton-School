import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySlip, validateSlipData } from '@/lib/slipok'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bookingIdsJson = formData.get('bookingIds') as string | null
    const expectedAmountStr = formData.get('expectedAmount') as string | null

    if (!file || !bookingIdsJson || !expectedAmountStr) {
      return NextResponse.json({ error: 'Missing required fields: file, bookingIds, expectedAmount' }, { status: 400 })
    }

    const bookingIds: string[] = JSON.parse(bookingIdsJson)
    const expectedAmount = parseFloat(expectedAmountStr)

    if (bookingIds.length === 0 || isNaN(expectedAmount)) {
      return NextResponse.json({ error: 'Invalid bookingIds or expectedAmount' }, { status: 400 })
    }

    // Verify bookings belong to user
    const { data: bookings } = await (supabase.from('bookings') as any)
      .select('id, total_price, status')
      .eq('user_id', user.id)
      .in('id', bookingIds)
      .eq('status', 'pending_payment')

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการจองที่รอชำระเงิน' }, { status: 404 })
    }

    // Verify expected amount matches sum of bookings
    const bookingTotal = bookings.reduce((sum: number, b: any) => sum + (b.total_price || 0), 0)
    if (Math.abs(bookingTotal - expectedAmount) > 1) {
      return NextResponse.json({ error: `ยอดเงินไม่ตรงกับยอดจอง (${bookingTotal} vs ${expectedAmount})` }, { status: 400 })
    }

    // Upload slip to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}/${bookingIds[0]}-${Date.now()}.${fileExt}`

    const { error: uploadErr } = await supabase
      .storage
      .from('payment-slips')
      .upload(fileName, fileBuffer, { contentType: file.type })

    if (uploadErr) {
      return NextResponse.json({ error: `อัปโหลดสลิปไม่สำเร็จ: ${uploadErr.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('payment-slips').getPublicUrl(fileName)

    // Verify slip — test mode skips real SlipOK API call
    const isTestMode = process.env.SLIPOK_TEST_MODE === 'true'

    let verificationStatus: 'approved' | 'pending' = 'pending'
    let verificationNotes = ''
    let slipResult: any = null

    if (isTestMode) {
      // TEST MODE: auto-approve with mock data
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
      // PRODUCTION: verify with real SlipOK API
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

    // Create payment records
    for (const bookingId of bookingIds) {
      const booking = bookings.find((b: any) => b.id === bookingId)
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

    // Update booking statuses
    if (verificationStatus === 'approved') {
      await (supabase.from('bookings') as any)
        .update({ status: 'verified' })
        .in('id', bookingIds)
    } else {
      await (supabase.from('bookings') as any)
        .update({ status: 'paid' })
        .in('id', bookingIds)
    }

    return NextResponse.json({
      success: true,
      verified: verificationStatus === 'approved',
      slipData: slipResult.data ? {
        transRef: slipResult.data.transRef,
        amount: slipResult.data.amount,
        sender: slipResult.data.sender?.name,
        date: slipResult.data.date,
      } : null,
      notes: verificationNotes,
    })
  } catch (err: any) {
    console.error('Verify slip error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}
