export interface AttendanceDbError {
  message: string
  code?: string
  details?: string
  hint?: string
}

// Call only at an Attendance write boundary. A successful preceding request is
// already committed, even when the following lifecycle-cache sync fails.
export function attendanceWriteFailure(error: unknown, attendanceRecorded = false) {
  const db = error && typeof error === 'object' ? error as Partial<AttendanceDbError> : {}
  const transient = ['55P03', '40001', '40P01', '57014'].includes(db.code || '')
  const stale = db.message === 'LESSON_SOURCE_ATTENDANCE_STALE'
  const identity = db.message === 'LESSON_SOURCE_ATTENDANCE_IDENTITY_CONFLICT'
  const status = transient || stale || identity ? 409 : 500
  const code = attendanceRecorded ? 'ATTENDANCE_FOLLOWUP_FAILED'
    : transient ? 'ATTENDANCE_WRITE_RETRY'
      : stale ? 'ATTENDANCE_SOURCE_STALE'
        : identity ? 'ATTENDANCE_IDENTITY_CONFLICT' : 'ATTENDANCE_WRITE_FAILED'
  return {
    status,
    body: {
      error: attendanceRecorded
        ? 'บันทึกการเช็คชื่อแล้ว แต่ดำเนินการขั้นต่อไปไม่ครบ กรุณาโหลดข้อมูลใหม่เพื่อตรวจสอบก่อนทำรายการต่อ'
        : transient
          ? 'รายการนี้กำลังถูกใช้งานร่วมกับคำขออื่น ยังไม่ได้บันทึกการเช็คชื่อ กรุณาลองใหม่'
          : stale
            ? 'ต้นทางนี้ถูกใช้หรือเปลี่ยนสถานะแล้ว กรุณาโหลดข้อมูลใหม่ก่อนเช็คชื่อ'
            : identity
              ? 'ข้อมูลผู้เรียนไม่ตรงกับรอบเรียน กรุณาโหลดข้อมูลใหม่'
              : 'เกิดข้อผิดพลาดในการเช็คชื่อ กรุณาโหลดข้อมูลใหม่เพื่อตรวจสอบผล',
      code,
      databaseCode: db.code || null,
      retryable: transient && !attendanceRecorded,
      // A transport failure without a PostgreSQL error cannot prove rollback.
      attendanceRecorded: attendanceRecorded ? true : db.code ? false : null,
      requiresReload: attendanceRecorded || !transient,
    },
  }
}
