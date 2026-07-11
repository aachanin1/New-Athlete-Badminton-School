import {
  isSlipOKTimeout,
  validateSlipData,
  verifySlipLive,
  type SlipOKResponse,
} from '@/lib/slipok'

export type ProgressiveSlipProviderMode = 'test' | 'live'
export type ProgressiveSlipDecision = 'approved' | 'rejected' | 'under_review'

interface ProgressiveSlipResolution {
  decision: ProgressiveSlipDecision
  providerReference: string | null
  resultCode: string
  verifiedAmount: number | null
}

interface ProgressiveSlipFile {
  buffer: Buffer
  fileName: string
}

interface ProgressiveSlipResolverInput {
  attemptId: string
  totalAmount: number
  providerMode: ProgressiveSlipProviderMode
  loadSlip: () => Promise<ProgressiveSlipFile>
}

interface ProgressiveSlipResolverDependencies {
  verifyLive: typeof verifySlipLive
}

export function isProgressiveSlipOKTestMode(
  raw = process.env.PROGRESSIVE_SLIPOK_TEST_MODE,
) {
  return raw?.trim().toLowerCase() === 'true'
}

export function getProgressiveSlipProviderMode(): ProgressiveSlipProviderMode {
  return isProgressiveSlipOKTestMode() ? 'test' : 'live'
}

function underReview(
  resultCode: string,
  response?: SlipOKResponse | null,
): ProgressiveSlipResolution {
  return {
    decision: 'under_review',
    providerReference: response?.data?.transRef || null,
    resultCode,
    verifiedAmount: response?.data?.amount ?? null,
  }
}

export async function resolveProgressiveSlipVerification(
  input: ProgressiveSlipResolverInput,
  dependencies: ProgressiveSlipResolverDependencies = { verifyLive: verifySlipLive },
): Promise<ProgressiveSlipResolution> {
  if (input.providerMode === 'test') {
    return {
      decision: 'approved',
      providerReference: `TEST-${input.attemptId}`,
      resultCode: 'TEST_APPROVED',
      verifiedAmount: input.totalAmount,
    }
  }

  const slip = await input.loadSlip()
  const response = await dependencies.verifyLive(
    slip.buffer,
    slip.fileName,
    input.totalAmount,
  )

  if (response.success && response.data) {
    const validation = validateSlipData(response.data, input.totalAmount)
    if (validation.valid) {
      return {
        decision: 'approved',
        providerReference: response.data.transRef,
        resultCode: 'SLIPOK_APPROVED',
        verifiedAmount: response.data.amount,
      }
    }
    return underReview('SLIPOK_VALIDATION_FAILED', response)
  }

  if (isSlipOKTimeout(response)) return underReview('SLIPOK_TIMEOUT', response)

  return underReview(
    response.code ? `SLIPOK_${String(response.code)}` : 'SLIPOK_REJECTED',
    response,
  )
}
