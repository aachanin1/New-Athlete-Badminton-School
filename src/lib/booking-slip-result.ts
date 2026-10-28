/** Shared presentation for stored SlipOK outcomes; no provider calls or credentials. */
export function slipResultMessage(code: string) {
  const key=code.replace(/^SLIPOK_/, '')
  const messages:Record<string,string>={
    '1005':'ไฟล์นี้ไม่ใช่รูปสลิป กรุณาเลือกรูปสลิปใหม่',
    '1006':'อ่านรูปสลิปไม่ได้ กรุณาเลือกรูปที่ชัดขึ้น',
    '1007':'ไม่พบ QR บนสลิป กรุณาเลือกรูปสลิปที่เห็น QR ครบ',
    '1008':'QR นี้ไม่ใช่สลิปโอนเงิน กรุณาเลือกสลิปของรายการนี้',
    '1009':'ธนาคารขัดข้องชั่วคราว กรุณาลองตรวจสลิปเดิมอีกครั้งใน 15 นาที',
    '1010':'ธนาคารยังไม่พร้อมยืนยันรายการนี้ กรุณารอสักครู่แล้วลองตรวจสลิปเดิม',
    '1011':'ไม่พบรายการโอนจากสลิปนี้ กรุณาตรวจสอบและเลือกสลิปที่ถูกต้อง',
    '1012':'สลิปนี้เคยถูกใช้แล้ว กรุณาตรวจรายการชำระเดิม หากเลือกผิดให้เลือกสลิปของรายการนี้',
    '1013':'ยอดในสลิปไม่ตรงกับบิล กรุณาตรวจสอบและเลือกสลิปของรายการนี้',
    '1014':'บัญชีผู้รับในสลิปไม่ตรงกับบัญชีรับเงิน กรุณาตรวจสอบสลิปของรายการนี้',
    VALIDATION_FAILED:'ข้อมูลในสลิปไม่ตรงกับรายการนี้ กรุณาตรวจสอบและเลือกสลิปที่ถูกต้อง',
    TIMEOUT:'ตรวจสลิปยังไม่สำเร็จ กรุณาลองตรวจสลิปเดิมอีกครั้ง โดยไม่ต้องโอนซ้ำ',
  }
  return messages[key]||'ระบบตรวจสลิปยังไม่พร้อม กรุณาลองตรวจสลิปเดิมอีกครั้งภายหลัง โดยไม่ต้องโอนซ้ำ'
}

export const slipCorrectionCodes = new Set(['1005','1006','1007','1008','1011','1012','1013','1014'])
export const SLIP_CHECK_MARKER='[BOOKING_SLIP_CHECK] '
export interface StoredSlipCheck {decision:'approved'|'rejected'|'under_review';code:string;message:string;receiptRequestId:string;providerReference?:string|null;verifiedAmount?:number|null}
export function storedSlipCheck(notes:string|null|undefined):StoredSlipCheck|null {
  if(!notes?.startsWith(SLIP_CHECK_MARKER))return null
  try{const value=JSON.parse(notes.slice(SLIP_CHECK_MARKER.length));return ['approved','rejected','under_review'].includes(value.decision)&&typeof value.code==='string'&&typeof value.message==='string'&&typeof value.receiptRequestId==='string'?value:null}catch{return null}
}
