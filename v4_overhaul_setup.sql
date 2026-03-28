-- ======================================================================
-- SECTION A: ANNOUNCEMENTS & PROFILES RLS
-- ======================================================================

-- Allow authenticated users to read all announcements
DROP POLICY IF EXISTS "announcements_select" ON announcements;
CREATE POLICY "announcements_select" ON announcements
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to read all profiles (for author name join)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to read/write reactions
DROP POLICY IF EXISTS "reactions_all" ON announcement_reactions;
CREATE POLICY "reactions_all" ON announcement_reactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users to read/write comments
DROP POLICY IF EXISTS "comments_all" ON announcement_comments;
CREATE POLICY "comments_all" ON announcement_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ======================================================================
-- SECTION B: USER FAVOURITES
-- ======================================================================

CREATE TABLE IF NOT EXISTS user_favourites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  card_key text NOT NULL,
  card_label text NOT NULL,
  card_icon text,
  card_route text NOT NULL,
  card_description text,
  is_visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, card_key)
);

ALTER TABLE user_favourites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favourites_own" ON user_favourites;
CREATE POLICY "favourites_own" ON user_favourites
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ======================================================================
-- SECTION E: ATTENDANCE SYSTEM
-- ======================================================================

CREATE TABLE IF NOT EXISTS attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id text,
  punch_in timestamptz,
  punch_out timestamptz,
  punch_in_lat double precision,
  punch_in_lng double precision,
  punch_out_lat double precision,
  punch_out_lng double precision,
  work_hours numeric(5,2),
  status text DEFAULT 'present', -- present / absent / half_day / late
  notes text,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- RLS: users see own, HR/admin see all
DROP POLICY IF EXISTS "attendance_own" ON attendance;
CREATE POLICY "attendance_own" ON attendance
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'md')
  ))
  WITH CHECK (user_id = auth.uid());


-- ======================================================================
-- SECTION F: EXPENSES SYSTEM
-- ======================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  category text, -- travel / food / accommodation / other
  amount numeric(10,2),
  description text,
  receipt_url text,
  status text DEFAULT 'pending', -- pending / approved / rejected
  hr_status text DEFAULT 'pending',
  md_status text DEFAULT 'pending',
  submitted_at timestamptz DEFAULT now(),
  hr_reviewed_at timestamptz,
  md_reviewed_at timestamptz,
  hr_comment text,
  md_comment text
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_own" ON expenses;
CREATE POLICY "expenses_own" ON expenses
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'admin', 'md')
  ))
  WITH CHECK (user_id = auth.uid());
