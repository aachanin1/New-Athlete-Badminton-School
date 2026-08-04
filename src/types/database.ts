export type UserRole = 'user' | 'coach' | 'head_coach' | 'admin' | 'super_admin'
export type CourseTypeName = 'kids_group' | 'adult_group' | 'private'
export type LearnerType = 'self' | 'child'
export type BookingStatus = 'pending_payment' | 'paid' | 'verified' | 'cancelled'
export type SessionStatus = 'scheduled' | 'completed' | 'rescheduled' | 'absent' | 'walleted'
export type LessonWalletStatus = 'active' | 'redeemed' | 'expired'
export type PaymentStatus = 'pending' | 'approved' | 'rejected'
export type ProgressivePaymentBatchStatus = 'prepared' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'cancelled'
export type AttendanceStatus = 'present' | 'absent' | 'late'
export type SlotStatus = 'open' | 'full' | 'cancelled'
export type ProgramStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved'
export type NotificationType = 'payment' | 'schedule' | 'reminder' | 'complaint' | 'system'
export type DiscountType = 'fixed' | 'percent'
export type LevelCategory = 'basic' | 'athlete_1' | 'athlete_2' | 'athlete_3'
export type StudentType = 'adult' | 'child'
export type Gender = 'male' | 'female' | 'other'
export type CoachEmploymentType = 'full_time' | 'half_time' | 'part_time'
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at' | 'coach_employment_type'> & Partial<Pick<Profile, 'coach_employment_type'>>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
        Relationships: []
      }
      branches: {
        Row: Branch
        Insert: Omit<Branch, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Branch, 'id' | 'created_at'>>
        Relationships: []
      }
      children: {
        Row: Child
        Insert: Omit<Child, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Child, 'id' | 'created_at'>>
        Relationships: []
      }
      course_types: {
        Row: CourseType
        Insert: Omit<CourseType, 'id'>
        Update: Partial<Omit<CourseType, 'id'>>
        Relationships: []
      }
      schedule_templates: {
        Row: ScheduleTemplate
        Insert: Omit<ScheduleTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ScheduleTemplate, 'id' | 'created_at'>>
        Relationships: []
      }
      schedule_slots: {
        Row: ScheduleSlot
        Insert: Omit<ScheduleSlot, 'id' | 'created_at'>
        Update: Partial<Omit<ScheduleSlot, 'id' | 'created_at'>>
        Relationships: []
      }
      pricing_tiers: {
        Row: PricingTier
        Insert: Omit<PricingTier, 'id' | 'created_at'>
        Update: Partial<Omit<PricingTier, 'id' | 'created_at'>>
        Relationships: []
      }
      booking_pricing_scopes: {
        Row: BookingPricingScope
        Insert: Omit<BookingPricingScope, 'id' | 'created_at' | 'updated_at' | BookingPricingScopeDefaultColumn>
          & Partial<Pick<BookingPricingScope, BookingPricingScopeDefaultColumn>>
        Update: Partial<Omit<BookingPricingScope, 'id' | 'created_at'>>
        Relationships: []
      }
      levels: {
        Row: Level
        Insert: Level
        Update: Partial<Level>
        Relationships: []
      }
      bookings: {
        Row: Booking
        Insert: Omit<Booking, 'id' | 'created_at' | 'updated_at' | BookingPricingSnapshotColumn>
          & Partial<Pick<Booking, BookingPricingSnapshotColumn>>
        Update: Partial<Omit<Booking, 'id' | 'created_at'>>
        Relationships: []
      }
      booking_sessions: {
        Row: BookingSession
        Insert: Omit<BookingSession, 'id' | 'created_at' | 'updated_at' | 'cancelled_at'>
          & Partial<Pick<BookingSession, 'cancelled_at'>>
        Update: Partial<Omit<BookingSession, 'id' | 'created_at'>>
        Relationships: []
      }
      progressive_booking_mutation_receipts: {
        Row: ProgressiveBookingMutationReceipt
        Insert: Omit<ProgressiveBookingMutationReceipt, 'id' | 'created_at'>
        Update: never
        Relationships: []
      }
      coupon_course_types: {
        Row: CouponCourseType
        Insert: Omit<CouponCourseType, 'created_at'>
        Update: never
        Relationships: []
      }
      progressive_coupon_reservations: {
        Row: ProgressiveCouponReservation
        Insert: Omit<ProgressiveCouponReservation, 'id' | 'created_at' | 'updated_at' | 'reserved_at'>
          & Partial<Pick<ProgressiveCouponReservation, 'reserved_at'>>
        Update: Partial<Omit<ProgressiveCouponReservation, 'id' | 'created_at'>>
        Relationships: []
      }
      progressive_payment_batches: {
        Row: ProgressivePaymentBatch
        Insert: Omit<ProgressivePaymentBatch, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProgressivePaymentBatch, 'id' | 'created_at'>>
        Relationships: []
      }
      progressive_payment_batch_bookings: {
        Row: ProgressivePaymentBatchBooking
        Insert: Omit<ProgressivePaymentBatchBooking, 'created_at'>
        Update: Partial<Pick<ProgressivePaymentBatchBooking, 'active'>>
        Relationships: []
      }
      progressive_payment_allocations: {
        Row: ProgressivePaymentAllocation
        Insert: Omit<ProgressivePaymentAllocation, 'id' | 'created_at'>
        Update: never
        Relationships: []
      }
      lesson_wallet_credits: {
        Row: LessonWalletCredit
        Insert: Omit<LessonWalletCredit, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<LessonWalletCredit, 'id' | 'created_at'>>
        Relationships: []
      }
      payments: {
        Row: Payment
        Insert: Omit<Payment, 'id' | 'created_at'>
        Update: Partial<Omit<Payment, 'id' | 'created_at'>>
        Relationships: []
      }
      coupons: {
        Row: Coupon
        Insert: Omit<Coupon, 'id' | 'created_at'>
        Update: Partial<Omit<Coupon, 'id' | 'created_at'>>
        Relationships: []
      }
      coupon_usages: {
        Row: CouponUsage
        Insert: Omit<CouponUsage, 'id'>
        Update: Partial<Omit<CouponUsage, 'id'>>
        Relationships: []
      }
      coach_branches: {
        Row: CoachBranch
        Insert: Omit<CoachBranch, 'id' | 'created_at'>
        Update: Partial<Omit<CoachBranch, 'id' | 'created_at'>>
        Relationships: []
      }
      coach_assignments: {
        Row: CoachAssignment
        Insert: Omit<CoachAssignment, 'id' | 'created_at'>
        Update: Partial<Omit<CoachAssignment, 'id' | 'created_at'>>
        Relationships: []
      }
      coach_assignment_groups: {
        Row: CoachAssignmentGroup
        Insert: Omit<CoachAssignmentGroup, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CoachAssignmentGroup, 'id' | 'created_at'>>
        Relationships: []
      }
      coach_assignment_group_students: {
        Row: CoachAssignmentGroupStudent
        Insert: Omit<CoachAssignmentGroupStudent, 'id' | 'created_at'>
        Update: Partial<Omit<CoachAssignmentGroupStudent, 'id' | 'created_at'>>
        Relationships: []
      }
      attendance: {
        Row: Attendance
        Insert: Omit<Attendance, 'id'>
        Update: Partial<Omit<Attendance, 'id'>>
        Relationships: []
      }
      coach_checkins: {
        Row: CoachCheckin
        Insert: Omit<CoachCheckin, 'id' | 'created_at'>
        Update: Partial<Omit<CoachCheckin, 'id' | 'created_at'>>
        Relationships: []
      }
      teaching_programs: {
        Row: TeachingProgram
        Insert: Omit<TeachingProgram, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TeachingProgram, 'id' | 'created_at'>>
        Relationships: []
      }
      coach_program_templates: {
        Row: CoachProgramTemplate
        Insert: Omit<CoachProgramTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CoachProgramTemplate, 'id' | 'created_at'>>
        Relationships: []
      }
      student_levels: {
        Row: StudentLevel
        Insert: Omit<StudentLevel, 'id' | 'created_at'>
        Update: Partial<Omit<StudentLevel, 'id' | 'created_at'>>
        Relationships: []
      }
      student_achievements: {
        Row: StudentAchievement
        Insert: Omit<StudentAchievement, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StudentAchievement, 'id' | 'created_at'>>
        Relationships: []
      }
      coach_teaching_hours: {
        Row: CoachTeachingHours
        Insert: Omit<CoachTeachingHours, 'id' | 'created_at'>
        Update: Partial<Omit<CoachTeachingHours, 'id' | 'created_at'>>
        Relationships: []
      }
      coach_payouts: {
        Row: CoachPayout
        Insert: Omit<CoachPayout, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CoachPayout, 'id' | 'created_at'>>
        Relationships: []
      }
      coach_weekly_teaching_summaries: {
        Row: CoachWeeklyTeachingSummary
        Insert: Omit<CoachWeeklyTeachingSummary, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CoachWeeklyTeachingSummary, 'id' | 'created_at'>>
        Relationships: []
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>
        Relationships: []
      }
      complaints: {
        Row: Complaint
        Insert: Omit<Complaint, 'id' | 'status' | 'resolved_by' | 'resolved_at' | 'admin_note' | 'last_updated_by' | 'updated_at' | 'created_at'> & Partial<Pick<Complaint, 'status' | 'resolved_by' | 'resolved_at' | 'admin_note' | 'last_updated_by' | 'updated_at'>>
        Update: Partial<Omit<Complaint, 'id' | 'created_at'>>
        Relationships: []
      }
      activity_logs: {
        Row: ActivityLog
        Insert: Omit<ActivityLog, 'id' | 'created_at'>
        Update: Partial<Omit<ActivityLog, 'id' | 'created_at'>>
        Relationships: []
      }
      system_settings: {
        Row: SystemSetting
        Insert: Omit<SystemSetting, 'id'>
        Update: Partial<Omit<SystemSetting, 'id'>>
        Relationships: []
      }
      finance_expenses: {
        Row: FinanceExpense
        Insert: Omit<FinanceExpense, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<FinanceExpense, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: {
      payment_review_queue_v1: {
        Row: PaymentReviewQueueRow
        Relationships: []
      }
      payment_ledger_allocations_v1: {
        Row: PaymentLedgerAllocationRow
        Relationships: []
      }
    }
    Functions: {
      coach_assignment_slot_snapshot_v2: {
        Args: {
          p_schedule_slot_id: string
        }
        Returns: Json
      }
      save_coach_assignment_groups_v2: {
        Args: {
          p_schedule_slot_id: string
          p_actor_id: string
          p_groups: Json
        }
        Returns: Json
      }
      retire_coach_assignment_membership_v1: {
        Args: {
          p_booking_session_id: string
          p_actor_id: string
          p_reason: 'reschedule_out' | 'wallet_store'
        }
        Returns: Json
      }
      progressive_pricing_writes_capability_v1: {
        Args: Record<string, never>
        Returns: Json
      }
      progressive_legacy_baseline_v1: {
        Args: {
          p_user_id: string
          p_course_type_id: string
          p_lesson_year: number
          p_lesson_month: number
        }
        Returns: Array<{
          baseline_sessions: number
          baseline_fingerprint: string
        }>
      }
      create_progressive_booking_v1: {
        Args: {
          p_user_id: string
          p_learner_type: LearnerType
          p_child_id: string | null
          p_branch_id: string
          p_course_type_id: string
          p_sessions: Json
          p_coupon_id: string | null
          p_client_request_id: string
          p_expected_scope_revision: number
          p_expected_legacy_baseline_sessions: number
          p_expected_legacy_baseline_fingerprint: string
        }
        Returns: Json
      }
      update_progressive_pending_booking_v1: {
        Args: {
          p_user_id: string
          p_booking_id: string
          p_branch_id: string
          p_sessions: Json
          p_client_request_id: string
          p_expected_scope_revision: number
        }
        Returns: Json
      }
      cancel_progressive_pending_booking_v1: {
        Args: {
          p_user_id: string
          p_booking_id: string
          p_client_request_id: string
          p_expected_scope_revision: number
        }
        Returns: Json
      }
      progressive_payment_batch_capability_v1: {
        Args: Record<string, never>
        Returns: Json
      }
      progressive_payment_integration_capability_v1: {
        Args: Record<string, never>
        Returns: Json
      }
      record_progressive_payment_upload_v1: {
        Args: {
          p_batch_id: string
          p_user_id: string
          p_storage_bucket: string
          p_storage_path: string
          p_mime_type: string
          p_size_bytes: number
          p_sha256: string
        }
        Returns: Json
      }
      cancel_progressive_prepared_batch_v1: {
        Args: { p_batch_id: string; p_user_id: string; p_reason?: string }
        Returns: Json
      }
      expire_progressive_prepared_batch_v1: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      mark_progressive_batch_under_review_v1: {
        Args: { p_batch_id: string; p_result_code: string }
        Returns: Json
      }
      record_progressive_verification_attempt_v1: {
        Args: { p_batch_id: string; p_attempt_key: string; p_provider_mode: string; p_request_fingerprint: string }
        Returns: Json
      }
      resolve_progressive_verification_attempt_v1: {
        Args: {
          p_attempt_id: string
          p_decision: string
          p_provider_reference: string | null
          p_result_code: string
          p_verified_amount: number | null
        }
        Returns: Json
      }
      get_progressive_payment_batch_status_v1: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      prepare_progressive_payment_batch_v1: {
        Args: {
          p_user_id: string
          p_pricing_scope_id: string
          p_booking_ids: string[]
          p_expected_scope_revision: number
          p_expected_total: number | null
          p_idempotency_key: string
        }
        Returns: Json
      }
      submit_progressive_payment_batch_v1: {
        Args: {
          p_batch_id: string
          p_user_id: string
          p_slip_metadata: Json
          p_idempotency_key: string
        }
        Returns: Json
      }
      approve_progressive_payment_batch_v1: {
        Args: { p_batch_id: string; p_actor_id: string; p_idempotency_key: string }
        Returns: Json
      }
      reject_progressive_payment_batch_v1: {
        Args: {
          p_batch_id: string
          p_actor_id: string
          p_rejection_reason: string
          p_idempotency_key: string
        }
        Returns: Json
      }
    }
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
  coach_employment_type: CoachEmploymentType | null
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

type BookingPricingScopeDefaultColumn =
  | 'currency'
  | 'revision'
  | 'pricing_tier_version'
  | 'locked_by_payment_batch_id'
  | 'locked_at'
  | 'legacy_baseline_sessions'
  | 'legacy_baseline_fingerprint'
  | 'legacy_baseline_initialized_at'

export interface BookingPricingScope {
  id: string
  user_id: string
  course_type_id: string
  lesson_year: number
  lesson_month: number
  currency: string
  revision: number
  pricing_tier_version: string | null
  locked_by_payment_batch_id: string | null
  locked_at: string | null
  legacy_baseline_sessions: number | null
  legacy_baseline_fingerprint: string | null
  legacy_baseline_initialized_at: string | null
  created_at: string
  updated_at: string
}

export interface Level {
  id: number
  name: string
  description: string | null
  category: LevelCategory
  program_name: string | null
  requirements: string | null
  is_active: boolean
  updated_at: string
}

type BookingPricingSnapshotColumn =
  | 'pricing_scope_id'
  | 'entitlement_sessions'
  | 'pricing_sequence'
  | 'cumulative_sessions_before'
  | 'cumulative_sessions_after'
  | 'pricing_tier_id_snapshot'
  | 'pricing_rate_snapshot'
  | 'gross_price_snapshot'
  | 'coupon_discount_snapshot'
  | 'final_price_snapshot'
  | 'pricing_revision'
  | 'expires_at'
  | 'expired_at'
  | 'pricing_calculated_at'
  | 'client_request_id'

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
  pricing_scope_id: string | null
  entitlement_sessions: number | null
  pricing_sequence: number | null
  cumulative_sessions_before: number | null
  cumulative_sessions_after: number | null
  pricing_tier_id_snapshot: string | null
  pricing_rate_snapshot: number | null
  gross_price_snapshot: number | null
  coupon_discount_snapshot: number | null
  final_price_snapshot: number | null
  pricing_revision: number | null
  expires_at: string | null
  expired_at: string | null
  pricing_calculated_at: string | null
  client_request_id: string | null
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
  child_id: string | null
  status: SessionStatus
  rescheduled_from_id: string | null
  is_makeup: boolean
  cancelled_at: string | null
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

export interface ProgressivePaymentBatch {
  id: string
  pricing_scope_id: string
  user_id: string
  status: ProgressivePaymentBatchStatus
  currency: string
  total_amount: number
  member_count: number
  member_set_fingerprint: string
  pricing_scope_revision: number
  prepare_idempotency_key: string
  prepare_request_fingerprint: string
  submit_idempotency_key: string | null
  submit_request_fingerprint: string | null
  decision_idempotency_key: string | null
  decision_request_fingerprint: string | null
  slip_storage_bucket: string | null
  slip_storage_path: string | null
  slip_mime_type: string | null
  slip_size_bytes: number | null
  slip_sha256: string | null
  prepared_expires_at: string
  upload_recorded_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  slip_retain_until: string | null
  slipok_transaction_ref: string | null
  slipok_response_code: string | null
  submitted_at: string | null
  under_review_at: string | null
  approved_at: string | null
  rejected_at: string | null
  rejected_by: string | null
  approved_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface PaymentReviewQueueRow {
  source_kind: 'legacy' | 'progressive'
  source_id: string
  user_id: string
  status: string
  submitted_at: string
  decided_at: string | null
  total_amount: number
  booking_count: number
  course_type_id: string
  lesson_month: number
  lesson_year: number
  slip_storage_bucket: string | null
  slip_storage_path: string | null
}

export interface PaymentLedgerAllocationRow {
  source_kind: 'legacy' | 'progressive'
  source_id: string
  booking_id: string
  user_id: string
  status: string
  allocated_amount: number
  created_at: string
  approved_at: string | null
}

export interface ProgressivePaymentBatchBooking {
  payment_batch_id: string
  booking_id: string
  sequence_snapshot: number
  amount_snapshot: number
  coupon_reservation_id: string | null
  member_fingerprint: string
  active: boolean
  created_at: string
}

export interface ProgressivePaymentAllocation {
  id: string
  payment_batch_id: string
  booking_id: string
  amount: number
  created_at: string
}

export type ProgressiveCouponReservationStatus = 'reserved' | 'consumed' | 'released'
export type ProgressiveCouponReleaseReason = 'booking_cancelled' | 'booking_expired' | 'payment_rejected'

export interface CouponCourseType {
  coupon_id: string
  course_type_id: string
  created_at: string
}

export interface ProgressiveCouponReservation {
  id: string
  coupon_id: string
  booking_id: string
  user_id: string
  status: ProgressiveCouponReservationStatus
  reserved_at: string
  consumed_at: string | null
  released_at: string | null
  release_reason: ProgressiveCouponReleaseReason | null
  gross_price_snapshot: number
  discount_type_snapshot: DiscountType
  discount_value_snapshot: number
  discount_amount_snapshot: number
  final_price_snapshot: number
  pricing_revision: number
  created_at: string
  updated_at: string
}

export interface ProgressiveBookingMutationReceipt {
  id: string
  user_id: string
  booking_id: string | null
  client_request_id: string
  mutation_type: 'create' | 'update' | 'cancel'
  request_fingerprint: string
  expected_scope_revision: number
  result: Json
  created_at: string
}

export interface CoachAssignmentGroup {
  id: string
  schedule_slot_id: string
  coach_id: string | null
  name: string
  level_min: number | null
  level_max: number | null
  sort_order: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LessonWalletCredit {
  id: string
  user_id: string
  booking_id: string
  original_session_id: string
  redeemed_session_id: string | null
  child_id: string | null
  branch_id: string
  course_type_id: string
  original_schedule_slot_id: string | null
  original_date: string
  original_start_time: string
  original_end_time: string
  status: LessonWalletStatus
  stored_at: string
  expires_at: string
  redeemed_at: string | null
  expired_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CoachAssignmentGroupStudent {
  id: string
  group_id: string
  booking_session_id: string
  student_id: string
  student_type: StudentType
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

export interface CoachProgramTemplate {
  id: string
  coach_id: string
  title: string
  content: string
  category: string | null
  is_active: boolean
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

export interface StudentAchievement {
  id: string
  student_id: string
  student_type: StudentType
  emoji: string
  title: string
  description: string | null
  awarded_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
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

export interface CoachPayout {
  id: string
  coach_id: string
  period_month: number
  period_year: number
  group_hours: number
  private_hours: number
  total_hours: number
  regular_hours: number
  ot_group_hours: number
  ot_private_hours: number
  ot_hours: number
  ot_pay: number
  payout_amount: number
  payable_session_count: number
  status: string
  notes: string | null
  snapshot: Record<string, unknown>
  paid_by: string | null
  paid_at: string
  created_at: string
  updated_at: string
}

export interface CoachWeeklyTeachingSummary {
  id: string
  coach_id: string
  week_start: string
  week_end: string
  coach_employment_type: CoachEmploymentType
  threshold_hours: number
  group_hours: number
  private_hours: number
  total_hours: number
  regular_hours: number
  payable_group_hours: number
  payable_private_hours: number
  payable_hours: number
  private_rate: number
  group_rate: number
  payable_amount: number
  payable_session_count: number
  missing_checkin_count: number
  missing_photo_count: number
  status: string
  notes: string | null
  snapshot: Record<string, unknown>
  closed_by: string | null
  closed_at: string
  created_at: string
  updated_at: string
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
  admin_note: string | null
  last_updated_by: string | null
  updated_at: string
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

export interface FinanceExpense {
  id: string
  expense_date: string
  category: string
  description: string | null
  amount: number
  branch_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SystemSetting {
  id: string
  key: string
  value: Record<string, unknown>
  updated_by: string | null
  updated_at: string
}
