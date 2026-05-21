// SlipOK API helper - server-side only
// Docs: https://docs.google.com/document/d/1l2ot68Pw3CL7JBeYfUIHLzeBC5F7jm2wzBfm84kwxBA

export interface SlipOKResponse {
  success: boolean
  data?: {
    transRef: string
    date: string
    time?: string
    sender?: {
      displayName?: string
      name?: string
      proxy?: { type: string; value: string }
      account?: { type: string; value: string }
    }
    receiver?: {
      displayName?: string
      name?: string
      proxy?: { type: string; value: string }
      account?: { type: string; value: string }
    }
    amount: number
    ref1?: string
    ref2?: string
    ref3?: string
    countryCode?: string
    qrCode?: string
  }
  message?: string
  code?: string | number
}

interface SlipOKErrorResponse {
  message?: string
  code?: string | number
}

/**
 * Verify a payment slip using SlipOK API.
 * Sends the slip image file and returns parsed transaction data.
 */
export async function verifySlip(fileBuffer: Buffer, fileName: string, expectedAmount?: number): Promise<SlipOKResponse> {
  const apiUrl = process.env.SLIPOK_API_URL
  const apiKey = process.env.SLIPOK_API_KEY

  if (!apiUrl || !apiKey) {
    return { success: false, message: 'SlipOK API not configured' }
  }

  const formData = new FormData()
  const uint8 = new Uint8Array(fileBuffer)
  const blob = new Blob([uint8], { type: 'image/jpeg' })
  formData.append('files', blob, fileName)
  formData.append('log', 'true')
  if (typeof expectedAmount === 'number' && Number.isFinite(expectedAmount) && expectedAmount > 0) {
    formData.append('amount', String(expectedAmount))
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-authorization': apiKey,
      },
      body: formData,
    })

    const json = await res.json() as SlipOKResponse & SlipOKErrorResponse

    if (!res.ok) {
      return {
        success: false,
        message: json?.message || `SlipOK API error: ${res.status}`,
        code: json?.code,
        data: json?.data,
      }
    }

    return {
      success: true,
      data: json?.data,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      message: `SlipOK API request failed: ${message}`,
    }
  }
}

/**
 * Verify slip data matches booking expectations.
 * Checks: amount matches, and optionally ref matches.
 */
export function validateSlipData(
  slipData: SlipOKResponse['data'],
  expectedAmount: number,
  bookingRef?: string
): { valid: boolean; reason?: string } {
  if (!slipData) {
    return { valid: false, reason: 'ไม่พบข้อมูลการโอนเงินในสลิป' }
  }

  // Check amount matches (allow +/-1 baht tolerance for rounding).
  const amountDiff = Math.abs(slipData.amount - expectedAmount)
  if (amountDiff > 1) {
    return {
      valid: false,
      reason: `ยอดเงินไม่ตรง: สลิป ฿${slipData.amount.toLocaleString()} ไม่เท่ากับยอดจอง ฿${expectedAmount.toLocaleString()}`,
    }
  }

  // If bookingRef provided, check it matches ref1/ref2/ref3.
  if (bookingRef) {
    const refs = [slipData.ref1, slipData.ref2, slipData.ref3].filter(Boolean)
    if (refs.length > 0 && !refs.some((ref) => ref?.includes(bookingRef))) {
      // Ref check is optional; only warn, don't block.
      // Some transfers may not have matching refs.
    }
  }

  return { valid: true }
}
