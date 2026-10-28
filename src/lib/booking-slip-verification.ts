import {isSlipOKTimeout,validateSlipData,type SlipOKResponse} from './slipok'
import {slipCorrectionCodes,slipResultMessage} from './booking-slip-result'

/** Classify only a supplied provider result, also usable with isolated test fixtures. */
export function classifyBookingSlip(response:SlipOKResponse,total:number) {
  if(response.success&&response.data){
    const validation=validateSlipData(response.data,total)
    if(validation.valid)return {decision:'approved' as const,code:'SLIPOK_APPROVED',message:'ชำระเงินสำเร็จ'}
    return {decision:'rejected' as const,code:'SLIPOK_VALIDATION_FAILED',message:validation.reason||slipResultMessage('SLIPOK_VALIDATION_FAILED')}
  }
  const raw=String(response.code||'UNAVAILABLE'),code=isSlipOKTimeout(response)?'SLIPOK_TIMEOUT':'SLIPOK_'+raw
  return {decision:slipCorrectionCodes.has(raw)?'rejected' as const:'under_review' as const,code,message:slipResultMessage(code)}
}
