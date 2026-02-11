-- ============================================================
-- New Athlete Badminton School — Full Database Schema
-- ============================================================

-- ─── ENUMS ──────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('user', 'coach', 'head_coach', 'admin', 'super_admin');
CREATE TYPE course_type_name AS ENUM ('kids_group', 'adult_group', 'private');
CREATE TYPE learner_type AS ENUM ('self', 'child');
CREATE TYPE booking_status AS ENUM ('pending_payment', 'paid', 'verified', 'cancelled');
CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'rescheduled', 'absent');
CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late');
CREATE TYPE slot_status AS ENUM ('open', 'full', 'cancelled');
CREATE TYPE program_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE notification_type AS ENUM ('payment', 'schedule', 'reminder', 'complaint', 'system');
CREATE TYPE discount_type AS ENUM ('fixed', 'percent');
CREATE TYPE level_category AS ENUM ('basic', 'athlete_1', 'athlete_2', 'athlete_3');
CREATE TYPE student_type AS ENUM ('adult', 'child');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');

-- ─── CORE TABLES ────────────────────────────────────────────

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Branches (7 สาขา)
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Children (เด็กของผู้ปกครอง)
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT,
  date_of_birth DATE,
  gender gender_type,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Course Types
CREATE TABLE course_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name course_type_name NOT NULL UNIQUE,
  description TEXT,
  max_students INT NOT NULL DEFAULT 6,
  duration_hours NUMERIC(3,1) NOT NULL DEFAULT 2.0
);

-- Schedule Templates (รอบเรียนประจำสาขา)
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  course_type_id UUID NOT NULL REFERENCES course_types(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Schedule Slots (รอบเรียนจริงรายวัน)
CREATE TABLE schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES schedule_templates(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  course_type_id UUID NOT NULL REFERENCES course_types(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_students INT NOT NULL DEFAULT 6,
  current_students INT NOT NULL DEFAULT 0,
  status slot_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, course_type_id, date, start_time)
);

-- Pricing Tiers (เรทราคา)
CREATE TABLE pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_type_id UUID NOT NULL REFERENCES course_types(id) ON DELETE CASCADE,
  min_sessions INT NOT NULL,
  max_sessions INT,
  price_per_session NUMERIC(10,2) NOT NULL,
  package_price NUMERIC(10,2) NOT NULL,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Levels (60 LV)
CREATE TABLE levels (
  id INT PRIMARY KEY CHECK (id BETWEEN 1 AND 60),
  name TEXT NOT NULL,
  description TEXT,
  category level_category NOT NULL
);

-- ─── BOOKING & PAYMENT TABLES ───────────────────────────────

-- Bookings (การจองรายเดือน)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  learner_type learner_type NOT NULL DEFAULT 'self',
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id),
  course_type_id UUID NOT NULL REFERENCES course_types(id),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2024),
  total_sessions INT NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status booking_status NOT NULL DEFAULT 'pending_payment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Booking Sessions (วันเรียนแต่ละครั้ง)
CREATE TABLE booking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  schedule_slot_id UUID NOT NULL REFERENCES schedule_slots(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  branch_id UUID NOT NULL REFERENCES branches(id),
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  status session_status NOT NULL DEFAULT 'scheduled',
  rescheduled_from_id UUID REFERENCES booking_sessions(id) ON DELETE SET NULL,
  is_makeup BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'transfer',
  slip_image_url TEXT,
  status payment_status NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coupons
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type discount_type NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  min_purchase NUMERIC(10,2),
  max_uses INT,
  current_uses INT NOT NULL DEFAULT 0,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coupon Usages
CREATE TABLE coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  discount_amount NUMERIC(10,2) NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── COACH & TEACHING TABLES ────────────────────────────────

-- Coach Branches (many-to-many)
CREATE TABLE coach_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_head_coach BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, branch_id)
);

-- Coach Assignments (แบ่งกลุ่มนักเรียนให้โค้ช)
CREATE TABLE coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_slot_id UUID NOT NULL REFERENCES schedule_slots(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, schedule_slot_id)
);

-- Attendance (เช็คชื่อนักเรียน)
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_session_id UUID NOT NULL REFERENCES booking_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  student_type student_type NOT NULL,
  coach_id UUID NOT NULL REFERENCES profiles(id),
  status attendance_status NOT NULL DEFAULT 'present',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coach Checkins (เช็คอินโค้ช + ถ่ายรูป)
CREATE TABLE coach_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_slot_id UUID NOT NULL REFERENCES schedule_slots(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  checkin_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  photo_url TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teaching Programs (โปรแกรมสอนรายวัน)
CREATE TABLE teaching_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_slot_id UUID NOT NULL REFERENCES schedule_slots(id),
  program_content TEXT NOT NULL,
  status program_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Student Levels (พัฒนาการ/LV นักเรียน)
CREATE TABLE student_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  student_type student_type NOT NULL,
  level INT NOT NULL CHECK (level BETWEEN 1 AND 60),
  updated_by UUID NOT NULL REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coach Teaching Hours (สรุปชั่วโมงสอน)
CREATE TABLE coach_teaching_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  group_hours NUMERIC(4,1) NOT NULL DEFAULT 0,
  private_hours NUMERIC(4,1) NOT NULL DEFAULT 0,
  total_hours NUMERIC(4,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, date)
);

-- ─── SYSTEM TABLES ──────────────────────────────────────────

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Complaints (ร้องเรียน)
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status complaint_status NOT NULL DEFAULT 'open',
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System Settings
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── INDEXES ────────────────────────────────────────────────

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_children_parent ON children(parent_id);
CREATE INDEX idx_schedule_templates_branch ON schedule_templates(branch_id);
CREATE INDEX idx_schedule_slots_date ON schedule_slots(date);
CREATE INDEX idx_schedule_slots_branch_date ON schedule_slots(branch_id, date);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_month_year ON bookings(month, year);
CREATE INDEX idx_booking_sessions_booking ON booking_sessions(booking_id);
CREATE INDEX idx_booking_sessions_date ON booking_sessions(date);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_coach_branches_coach ON coach_branches(coach_id);
CREATE INDEX idx_coach_assignments_slot ON coach_assignments(schedule_slot_id);
CREATE INDEX idx_attendance_session ON attendance(booking_session_id);
CREATE INDEX idx_student_levels_student ON student_levels(student_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_complaints_branch ON complaints(branch_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX idx_coach_teaching_hours_coach_date ON coach_teaching_hours(coach_id, date);

-- ─── TRIGGERS ───────────────────────────────────────────────

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_children_updated_at BEFORE UPDATE ON children FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_schedule_templates_updated_at BEFORE UPDATE ON schedule_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_booking_sessions_updated_at BEFORE UPDATE ON booking_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_teaching_programs_updated_at BEFORE UPDATE ON teaching_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_teaching_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Helper: check user role
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if admin or super_admin
CREATE OR REPLACE FUNCTION is_admin_or_super()
RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('admin', 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if coach, head_coach, admin, or super_admin
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT auth_role() IN ('coach', 'head_coach', 'admin', 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── RLS POLICIES ───────────────────────────────────────────

-- profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Staff can view all profiles" ON profiles FOR SELECT USING (is_staff());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE USING (is_admin_or_super());
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (is_admin_or_super());

-- branches (public read)
CREATE POLICY "Anyone can view active branches" ON branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage branches" ON branches FOR ALL USING (is_admin_or_super());

-- children
CREATE POLICY "Parents can view own children" ON children FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY "Parents can manage own children" ON children FOR ALL USING (parent_id = auth.uid());
CREATE POLICY "Staff can view all children" ON children FOR SELECT USING (is_staff());
CREATE POLICY "Admins can manage all children" ON children FOR ALL USING (is_admin_or_super());

-- course_types (public read)
CREATE POLICY "Anyone can view course types" ON course_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage course types" ON course_types FOR ALL USING (is_admin_or_super());

-- schedule_templates
CREATE POLICY "Anyone can view active templates" ON schedule_templates FOR SELECT USING (true);
CREATE POLICY "Super admin can manage templates" ON schedule_templates FOR ALL USING (auth_role() = 'super_admin');

-- schedule_slots (public read)
CREATE POLICY "Anyone can view schedule slots" ON schedule_slots FOR SELECT USING (true);
CREATE POLICY "Admins can manage schedule slots" ON schedule_slots FOR ALL USING (is_admin_or_super());

-- pricing_tiers (public read)
CREATE POLICY "Anyone can view pricing" ON pricing_tiers FOR SELECT USING (true);
CREATE POLICY "Super admin can manage pricing" ON pricing_tiers FOR ALL USING (auth_role() = 'super_admin');

-- levels (public read)
CREATE POLICY "Anyone can view levels" ON levels FOR SELECT USING (true);
CREATE POLICY "Super admin can manage levels" ON levels FOR ALL USING (auth_role() = 'super_admin');

-- bookings
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own bookings" ON bookings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own bookings" ON bookings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Staff can view all bookings" ON bookings FOR SELECT USING (is_staff());
CREATE POLICY "Admins can manage all bookings" ON bookings FOR ALL USING (is_admin_or_super());

-- booking_sessions
CREATE POLICY "Users can view own sessions" ON booking_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_sessions.booking_id AND bookings.user_id = auth.uid()));
CREATE POLICY "Users can manage own sessions" ON booking_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_sessions.booking_id AND bookings.user_id = auth.uid()));
CREATE POLICY "Staff can view all sessions" ON booking_sessions FOR SELECT USING (is_staff());
CREATE POLICY "Admins can manage all sessions" ON booking_sessions FOR ALL USING (is_admin_or_super());

-- payments
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own payments" ON payments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage all payments" ON payments FOR ALL USING (is_admin_or_super());

-- coupons
CREATE POLICY "Anyone can view active coupons" ON coupons FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage coupons" ON coupons FOR ALL USING (is_admin_or_super());

-- coupon_usages
CREATE POLICY "Users can view own coupon usages" ON coupon_usages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own coupon usages" ON coupon_usages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all coupon usages" ON coupon_usages FOR SELECT USING (is_admin_or_super());

-- coach_branches
CREATE POLICY "Anyone can view coach branches" ON coach_branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage coach branches" ON coach_branches FOR ALL USING (is_admin_or_super());

-- coach_assignments
CREATE POLICY "Coaches can view own assignments" ON coach_assignments FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY "Staff can view all assignments" ON coach_assignments FOR SELECT USING (is_staff());
CREATE POLICY "Head coaches and admins can manage assignments" ON coach_assignments FOR ALL
  USING (auth_role() IN ('head_coach', 'admin', 'super_admin'));

-- attendance
CREATE POLICY "Coaches can manage attendance" ON attendance FOR ALL USING (is_staff());
CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM children WHERE children.id = attendance.student_id AND children.parent_id = auth.uid()
  ));

-- coach_checkins
CREATE POLICY "Coaches can create own checkins" ON coach_checkins FOR INSERT WITH CHECK (coach_id = auth.uid() AND is_staff());
CREATE POLICY "Coaches can view own checkins" ON coach_checkins FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY "Admins can view all checkins" ON coach_checkins FOR SELECT USING (is_admin_or_super());

-- teaching_programs
CREATE POLICY "Coaches can manage own programs" ON teaching_programs FOR ALL USING (coach_id = auth.uid() AND is_staff());
CREATE POLICY "Admins can manage all programs" ON teaching_programs FOR ALL USING (is_admin_or_super());

-- student_levels
CREATE POLICY "Staff can manage student levels" ON student_levels FOR ALL USING (is_staff());
CREATE POLICY "Users can view own levels" ON student_levels FOR SELECT
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM children WHERE children.id = student_levels.student_id AND children.parent_id = auth.uid()
  ));
CREATE POLICY "Anyone can view levels for ranking" ON student_levels FOR SELECT USING (true);

-- coach_teaching_hours
CREATE POLICY "Coaches can view own hours" ON coach_teaching_hours FOR SELECT USING (coach_id = auth.uid());
CREATE POLICY "Admins can view all hours" ON coach_teaching_hours FOR SELECT USING (is_admin_or_super());
CREATE POLICY "System can manage hours" ON coach_teaching_hours FOR ALL USING (is_admin_or_super());

-- notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (is_admin_or_super() OR user_id = auth.uid());

-- complaints
CREATE POLICY "Users can create complaints" ON complaints FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can view own complaints" ON complaints FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all complaints" ON complaints FOR ALL USING (is_admin_or_super());

-- activity_logs
CREATE POLICY "Super admin can view all logs" ON activity_logs FOR SELECT USING (auth_role() = 'super_admin');
CREATE POLICY "System can create logs" ON activity_logs FOR INSERT WITH CHECK (true);

-- system_settings
CREATE POLICY "Anyone can view settings" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Super admin can manage settings" ON system_settings FOR ALL USING (auth_role() = 'super_admin');

-- ─── SEED DATA ──────────────────────────────────────────────

-- Insert branches
INSERT INTO branches (name, slug, address) VALUES
  ('แจ้งวัฒนะ', 'chaengwattana', NULL),
  ('พระราม 2', 'rama2', NULL),
  ('รามอินทรา', 'ram-intra', NULL),
  ('สุวรรณภูมิ', 'suvarnabhumi', NULL),
  ('เทพารักษ์', 'theparak', NULL),
  ('รัชดา', 'ratchada', NULL),
  ('ราชพฤกษ์-ตลิ่งชัน', 'ratchaphruek-talingchan', NULL);

-- Insert course types
INSERT INTO course_types (name, description, max_students, duration_hours) VALUES
  ('kids_group', 'กลุ่มเด็ก 4-6 คน', 6, 2.0),
  ('adult_group', 'กลุ่มผู้ใหญ่ 1-6 คน', 6, 2.0),
  ('private', 'ส่วนตัว (เด็กและผู้ใหญ่)', 4, 1.0);

-- Insert levels (1-60)
INSERT INTO levels (id, name, description, category)
SELECT
  i,
  'Level ' || i,
  CASE
    WHEN i <= 30 THEN 'ฝึกวิธีการรับลูกจากคู่แข่ง'
    WHEN i <= 39 THEN 'ฝึกวิธีการตีลูกทำแต้ม'
    WHEN i <= 43 THEN 'ฝึกวิสัยทัศน์การเล่นเกมแบดมินตัน + แข่งได้ในระดับสโมสร'
    ELSE 'ฝึกเทคนิคขั้นสูง ของนักกีฬาระดับทีมชาติ'
  END,
  CASE
    WHEN i <= 30 THEN 'basic'::level_category
    WHEN i <= 39 THEN 'athlete_1'::level_category
    WHEN i <= 43 THEN 'athlete_2'::level_category
    ELSE 'athlete_3'::level_category
  END
FROM generate_series(1, 60) AS i;

-- Insert pricing tiers for kids_group
INSERT INTO pricing_tiers (course_type_id, min_sessions, max_sessions, price_per_session, package_price)
SELECT ct.id, tiers.min_s, tiers.max_s, tiers.pps, tiers.pp
FROM course_types ct,
(VALUES
  (1, 1, 700.00, 700.00),
  (2, 6, 625.00, 2500.00),
  (7, 10, 500.00, 4000.00),
  (11, 14, 433.00, 5200.00),
  (15, 18, 406.00, 6500.00),
  (19, NULL, 350.00, 7000.00)
) AS tiers(min_s, max_s, pps, pp)
WHERE ct.name = 'kids_group';

-- Insert pricing tiers for adult_group
INSERT INTO pricing_tiers (course_type_id, min_sessions, max_sessions, price_per_session, package_price)
SELECT ct.id, tiers.min_s, tiers.max_s, tiers.pps, tiers.pp
FROM course_types ct,
(VALUES
  (1, 1, 600.00, 600.00),
  (10, 10, 550.00, 5500.00),
  (16, 16, 500.00, 8000.00)
) AS tiers(min_s, max_s, pps, pp)
WHERE ct.name = 'adult_group';

-- Insert pricing tiers for private
INSERT INTO pricing_tiers (course_type_id, min_sessions, max_sessions, price_per_session, package_price)
SELECT ct.id, tiers.min_s, tiers.max_s, tiers.pps, tiers.pp
FROM course_types ct,
(VALUES
  (1, 1, 900.00, 900.00),
  (10, 10, 800.00, 8000.00)
) AS tiers(min_s, max_s, pps, pp)
WHERE ct.name = 'private';

-- ─── STORAGE BUCKETS ────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('payment-slips', 'payment-slips', true),
  ('coach-checkins', 'coach-checkins', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload payment slips" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-slips' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view payment slips" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-slips');

CREATE POLICY "Users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
