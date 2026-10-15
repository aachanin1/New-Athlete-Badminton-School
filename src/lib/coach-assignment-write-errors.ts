interface AssignmentWriteError {
  code?: string
}

// A returned SQL error aborts the RPC transaction. Keep the original draft and
// expected baseline for retry; a network failure still requires readback.
export function getCoachAssignmentRetry(error: AssignmentWriteError) {
  if (!['40P01', '40001', '55P03', '57014'].includes(error.code || '')) return null
  return {
    code: 'COACH_ASSIGNMENT_RETRY',
    error: 'มีรายการอื่นกำลังปรับข้อมูลรอบเรียน ยังไม่ได้บันทึกการมอบหมายครั้งนี้ กรุณาลองบันทึกอีกครั้ง กลุ่มที่จัดไว้ยังอยู่',
  }
}
