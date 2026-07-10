export type ProgressiveCouponDiscountType = 'fixed' | 'percent'

export type ProgressiveCouponCalculationErrorCode =
  | 'INVALID_COUPON_DISCOUNT_TYPE'
  | 'INVALID_COUPON_DISCOUNT_VALUE'
  | 'INVALID_GROSS_PRICE'

export type ProgressiveCouponCalculationOutcome =
  | {
      ok: true
      value: {
        grossPrice: number
        discountType: ProgressiveCouponDiscountType
        discountValue: number
        discountAmount: number
        finalPrice: number
      }
    }
  | {
      ok: false
      error: {
        code: ProgressiveCouponCalculationErrorCode
        message: string
      }
    }

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateProgressiveCouponDiscount({
  grossPrice,
  discountType,
  discountValue,
}: {
  grossPrice: number
  discountType: ProgressiveCouponDiscountType
  discountValue: number
}): ProgressiveCouponCalculationOutcome {
  if (!Number.isFinite(grossPrice) || grossPrice < 0) {
    return {
      ok: false,
      error: { code: 'INVALID_GROSS_PRICE', message: 'Gross price must be a non-negative finite number.' },
    }
  }
  if (discountType !== 'fixed' && discountType !== 'percent') {
    return {
      ok: false,
      error: { code: 'INVALID_COUPON_DISCOUNT_TYPE', message: 'Coupon discount type must be fixed or percent.' },
    }
  }
  if (
    !Number.isFinite(discountValue)
    || discountValue <= 0
    || (discountType === 'percent' && discountValue > 100)
  ) {
    return {
      ok: false,
      error: { code: 'INVALID_COUPON_DISCOUNT_VALUE', message: 'Coupon discount value is invalid.' },
    }
  }

  const normalizedGross = roundCurrency(grossPrice)
  const rawDiscount = discountType === 'fixed'
    ? roundCurrency(discountValue)
    : Math.round((normalizedGross * discountValue) / 100)
  const discountAmount = roundCurrency(Math.min(normalizedGross, Math.max(0, rawDiscount)))

  return {
    ok: true,
    value: {
      grossPrice: normalizedGross,
      discountType,
      discountValue: roundCurrency(discountValue),
      discountAmount,
      finalPrice: roundCurrency(Math.max(0, normalizedGross - discountAmount)),
    },
  }
}
