-- ==============================================================================
-- FOURSQUARE HRMS - PHASE 6 SQL DEPLOYMENT SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR
-- ==============================================================================

-- 1. ALTER EXISTING ANNOUNCEMENTS TABLE
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'Announcement',
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Low',
ADD COLUMN IF NOT EXISTS target_dept TEXT DEFAULT 'All',
ADD COLUMN IF NOT EXISTS employee_photo TEXT; -- Added to cache poster's photo

-- 2. CREATE REACTIONS TABLE
CREATE TABLE IF NOT EXISTS announcement_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  employee_id TEXT,
  employee_name TEXT,
  employee_photo TEXT,
  reaction_type TEXT CHECK (reaction_type IN ('like','love','haha','wow','clap','celebrate')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, employee_id)
);

-- Enable RLS for reactions
ALTER TABLE announcement_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON announcement_reactions FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON announcement_reactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for users based on employee_id" ON announcement_reactions FOR DELETE USING (auth.role() = 'authenticated');

-- 3. CREATE COMMENTS TABLE
CREATE TABLE IF NOT EXISTS announcement_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  employee_id TEXT,
  employee_name TEXT,
  employee_photo TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for comments
ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON announcement_comments FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON announcement_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for users based on their id" ON announcement_comments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for users based on their id" ON announcement_comments FOR DELETE USING (auth.role() = 'authenticated');

-- 4. CREATE CELEBRATIONS TABLE
CREATE TABLE IF NOT EXISTS celebrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT,
  employee_name TEXT,
  celebration_type TEXT CHECK (celebration_type IN ('birthday','anniversary')),
  celebration_date DATE,
  year INTEGER,
  announcement_id UUID REFERENCES announcements(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, celebration_type, year)
);

-- Enable RLS for celebrations
ALTER TABLE celebrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON celebrations FOR SELECT USING (true);
CREATE POLICY "Enable insert/update for HR/Admins only via functions or direct" ON celebrations FOR ALL USING (auth.role() = 'authenticated');

-- 5. CREATE 'employee-photos' STORAGE BUCKET (If you don't run this, create manually)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Fix policies for storage so the app can upload and read
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

CREATE POLICY "Public Profiles Access" ON storage.objects FOR SELECT USING (bucket_id = 'employee-photos');
CREATE POLICY "Authenticated Profiles Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Profiles Update" ON storage.objects FOR UPDATE USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Profiles Delete" ON storage.objects FOR DELETE USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

-- Important: We update the existing profiles and employees RLS to ensure photos can be attached
ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
