// เด็ก แบบกลุ่ม — คิดรายเดือน, รีเซ็ตทุกเดือน
export const KIDS_GROUP_PRICING = [
  { min: 1, max: 1, packagePrice: 700, pricePerSession: 700, label: 'รายครั้ง' },
  { min: 2, max: 6, packagePrice: 2500, pricePerSession: 625, label: '4 ครั้ง/เดือน' },
  { min: 7, max: 10, packagePrice: 4000, pricePerSession: 500, label: '8 ครั้ง/เดือน' },
  { min: 11, max: 14, packagePrice: 5200, pricePerSession: 433, label: '12 ครั้ง/เดือน' },
  { min: 15, max: 18, packagePrice: 6500, pricePerSession: 406, label: '16 ครั้ง/เดือน' },
  { min: 19, max: null, packagePrice: 7000, pricePerSession: 350, label: '19+ ครั้ง/เดือน' },
] as const

// ผู้ใหญ่ แบบกลุ่ม — หมดอายุ 10 เดือน (ยกเว้นรายครั้ง)
export const ADULT_GROUP_PRICING = [
  { min: 1, max: 1, packagePrice: 600, pricePerSession: 600, label: 'รายครั้ง', validMonths: null },
  { min: 10, max: 10, packagePrice: 5500, pricePerSession: 550, label: '10 ครั้ง', validMonths: 10 },
  { min: 16, max: 16, packagePrice: 8000, pricePerSession: 500, label: '16 ครั้ง', validMonths: 10 },
] as const

// Private — ได้ทั้งเด็กและผู้ใหญ่
export const PRIVATE_PRICING = [
  { min: 1, max: 1, packagePrice: 900, pricePerSession: 900, label: 'รายชั่วโมง' },
  { min: 10, max: 10, packagePrice: 8000, pricePerSession: 800, label: '10 ชั่วโมง' },
] as const

// แถบสถานะตามจำนวนครั้ง/เดือน (เด็ก)
export const SESSION_STATUS_LABELS = [
  { min: 0, max: 3, label: 'ควรหาวันเรียนเพิ่ม เพื่อความต่อเนื่องของทักษะแบดมินตัน', emoji: '⚠️', color: 'warning' },
  { min: 4, max: 4, label: 'การเรียนขั้นต่ำ', emoji: '🏸', color: 'default' },
  { min: 5, max: 8, label: 'การออกกำลังกาย', emoji: '💪', color: 'info' },
  { min: 9, max: 12, label: 'การเริ่มต้นเป็นนักกีฬา', emoji: '⭐', color: 'success' },
  { min: 13, max: 16, label: 'เป็นนักกีฬา', emoji: '🏆', color: 'success' },
  { min: 17, max: 19, label: 'เป็นนักกีฬา', emoji: '🥇', color: 'success' },
  { min: 20, max: 24, label: 'เป็นนักกีฬาระดับประเทศ', emoji: '🇹🇭', color: 'gold' },
] as const

// Coach overtime rates
export const COACH_OVERTIME = {
  weeklyThreshold: 25,
  privateRate: 400,
  groupRate: 200,
} as const
