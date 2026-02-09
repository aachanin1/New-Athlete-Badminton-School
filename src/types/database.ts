export type UserRole = 'user' | 'coach' | 'head_coach' | 'admin' | 'super_admin'
export type CourseTypeName = 'kids_group' | 'adult_group' | 'private'
export type LearnerType = 'self' | 'child'
export type BookingStatus = 'pending_payment' | 'paid' | 'verified' | 'cancelled'
export type SessionStatus = 'scheduled' | 'completed' | 'rescheduled' | 'absent'
export type PaymentStatus = 'pending' | 'approved' | 'rejected'
export type AttendanceStatus = 'present' | 'absent' | 'late'
export type SlotStatus = 'open' | 'full' | 'cancelled'
export type ProgramStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved'
export type NotificationType = 'payment' | 'schedule' | 'reminder' | 'complaint' | 'system'
export type DiscountType = 'fixed' | 'percent'
export type LevelCategory = 'basic' | 'athlete_1' | 'athlete_2' | 'athlete_3'
export type StudentType = 'adult' | 'child'
export type Gender = 'male' | 'female' | 'other'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      branches: {
        Row: Branch
        Insert: Omit<Branch, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Branch, 'id' | 'created_at'>>
      }
      children: {
        Row: Child
        Insert: Omit<Child, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Child, 'id' | 'created_at'>>
      }
      course_types: {
        Row: CourseType
        Insert: Omit<CourseType, 'id'>
        Update: Partial<Omit<CourseType, 'id'>>
      }
      schedule_templates: {
        Row: ScheduleTemplate
        Insert: Omit<ScheduleTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ScheduleTemplate, 'id' | 'created_at'>>
      }
      schedule_slots: {
        Row: ScheduleSlot
        Insert: Omit<ScheduleSlot, 'id' | 'created_at'>
        Update: Partial<Omit<ScheduleSlot, 'id' | 'created_at'>>
      }
      pricing_tiers: {
        Row: PricingTier
        Insert: Omit<PricingTier, 'id' | 'created_at'>
        Update: Partial<Omit<PricingTier, 'id' | 'created_at'>>
      }
      levels: {
        Row: Level
        Insert: Level
        Update: Partial<Level>
      }
      bookings: {
        Row: Booking
        Insert: Omit<Booking, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Booking, 'id' | 'created_at'>>
      }
      booking_sessions: {
        Row: BookingSession
        Insert: Omit<BookingSession, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<BookingSession, 'id' | 'created_at'>>
      }
      payments: {
        Row: Payment
        Insert: Omit<Payment, 'id' | 'created_at'>
        Update: Partial<Omit<Payment, 'id' | 'created_at'>>
      }
      coupons: {
        Row: Coupon
        Insert: Omit<Coupon, 'id' | 'created_at'>
        Update: Partial<Omit<Coupon, 'id' | 'created_at'>>
      }
      coupon_usages: {
        Row: CouponUsage
        Insert: Omit<CouponUsage, 'id'>
        Update: Partial<Omit<CouponUsage, 'id'>>
      }
      coach_branches: {
        Row: CoachBranch
        Insert: Omit<CoachBranch, 'id' | 'created_at'>
        Update: Partial<Omit<CoachBranch, 'id' | 'created_at'>>
      }
      coach_assignments: {
        Row: CoachAssignment
        Insert: Omit<CoachAssignment, 'id' | 'created_at'>
        Update: Partial<Omit<CoachAssignment, 'id' | 'created_at'>>
      }
      attendance: {
        Row: Attendance
        Insert: Omit<Attendance, 'id'>
        Update: Partial<Omit<Attendance, 'id'>>
      }
      coach_checkins: {
        Row: CoachCheckin
        Insert: Omit<CoachCheckin, 'id' | 'created_at'>
        Update: Partial<Omit<CoachCheckin, 'id' | 'created_at'>>
      }
      teaching_programs: {
        Row: TeachingProgram
        Insert: Omit<TeachingProgram, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TeachingProgram, 'id' | 'created_at'>>
      }
      student_levels: {
        Row: StudentLevel
        Insert: Omit<StudentLevel, 'id' | 'created_at'>
        Update: Partial<Omit<StudentLevel, 'id' | 'created_at'>>
      }
      coach_teaching_hours: {
        Row: CoachTeachingHours
        Insert: Omit<CoachTeachingHours, 'id' | 'created_at'>
        Update: Partial<Omit<CoachTeachingHours, 'id' | 'created_at'>>
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>
      }
      complaints: {
        Row: Complaint
        Insert: Omit<Complaint, 'id' | 'created_at'>
        Update: Partial<Omit<Complaint, 'id' | 'created_at'>>
      }
      activity_logs: {
        Row: ActivityLog
        Insert: Omit<ActivityLog, 'id' | 'created_at'>
        Update: Partial<Omit<ActivityLog, 'id' | 'created_at'>>
      }
      system_settings: {
        Row: SystemSetting
        Insert: Omit<SystemSetting, 'id'>
        Update: Partial<Omit<SystemSetting, 'id'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      course_type_name: CourseTypeName
      learner_type: LearnerType
      booking_status: BookingStatus
      session_status: SessionStatus
      payment_status: PaymentStatus
      attendance_status: AttendanceStatus
      slot_status: SlotStatus
      program_status: ProgramStatus
      complaint_status: ComplaintStatus
      notification_type: NotificationType
      discount_type: DiscountType
      level_category: LevelCategory
      student_type: StudentType
    }
  }
}

// ─── Entity Types ────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  email: string
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  name: string
  slug: string
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Child {
  id: string
  parent_id: string
  full_name: string
  nickname: string | null
  date_of_birth: string | null
  gender: Gender | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface CourseType {
  id: string
  name: CourseTypeName
  description: string | null
  max_students: number
  duration_hours: number
}

export interface ScheduleTemplate {
  id: string
  branch_id: string
  course_type_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleSlot {
  id: string
  template_id: string | null
  branch_id: string
  course_type_id: string
  date: string
  start_time: string
  end_time: string
  max_students: number
  current_students: number
  status: SlotStatus
  created_at: string
}

export interface PricingTier {
  id: string
  course_type_id: string
  min_sessions: number
  max_sessions: number | null
  price_per_session: number
  package_price: number
  valid_from: string
  valid_to: string | null
  created_at: string
}

export interface Level {
  id: number
  name: string
  description: string | null
  category: LevelCategory
}

export interface Booking {
  id: string
  user_id: string
  learner_type: LearnerType
  child_id: string | null
  branch_id: string
  course_type_id: string
  month: number
  year: number
  total_sessions: number
  total_price: number
  status: BookingStatus
  created_at: string
  updated_at: string
}

export interface BookingSession {
  id: string
  booking_id: string
  schedule_slot_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  status: SessionStatus
  rescheduled_from_id: string | null
  is_makeup: boolean
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  booking_id: string
  user_id: string
  amount: number
  method: string
  slip_image_url: string | null
  status: PaymentStatus
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
}

export interface Coupon {
  id: string
  code: string
  discount_type: DiscountType
  discount_value: number
  min_purchase: number | null
  max_uses: number | null
  current_uses: number
  valid_from: string
  valid_to: string | null
  created_by: string
  is_active: boolean
  created_at: string
}

export interface CouponUsage {
  id: string
  coupon_id: string
  user_id: string
  booking_id: string
  discount_amount: number
  used_at: string
}

export interface CoachBranch {
  id: string
  coach_id: string
  branch_id: string
  is_head_coach: boolean
  created_at: string
}

export interface CoachAssignment {
  id: string
  coach_id: string
  schedule_slot_id: string
  assigned_by: string
  created_at: string
}

export interface Attendance {
  id: string
  booking_session_id: string
  student_id: string
  student_type: StudentType
  coach_id: string
  status: AttendanceStatus
  checked_at: string
}

export interface CoachCheckin {
  id: string
  coach_id: string
  schedule_slot_id: string
  branch_id: string
  checkin_time: string
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
  created_at: string
}

export interface TeachingProgram {
  id: string
  coach_id: string
  schedule_slot_id: string
  program_content: string
  status: ProgramStatus
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StudentLevel {
  id: string
  student_id: string
  student_type: StudentType
  level: number
  updated_by: string
  notes: string | null
  created_at: string
}

export interface CoachTeachingHours {
  id: string
  coach_id: string
  date: string
  group_hours: number
  private_hours: number
  total_hours: number
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  link_url: string | null
  created_at: string
}

export interface Complaint {
  id: string
  user_id: string
  branch_id: string
  subject: string
  message: string
  status: ComplaintStatus
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface SystemSetting {
  id: string
  key: string
  value: Record<string, unknown>
  updated_by: string | null
  updated_at: string
}
