import {
  verifySlipLive,
  type SlipOKResponse,
} from '@/lib/slipok'
import {classifyBookingSlip} from '@/lib/booking-slip-verification'

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

export function isSharedSlipOKTestMode(raw = process.env.SLIPOK_TEST_MODE) {
  return raw === 'true'
}

export function getProgressiveSlipProviderMode(): ProgressiveSlipProviderMode {
  return isSharedSlipOKTestMode() ? 'test' : 'live'
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

  const outcome=classifyBookingSlip(response,input.totalAmount)
  return {...underReview(outcome.code,response),decision:outcome.decision}
}
