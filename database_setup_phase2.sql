-- 1. Announcements
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
  target_role TEXT CHECK (target_role IN ('All', 'Admin', 'Employee')) DEFAULT 'All',
  created_by TEXT REFERENCES employees(employee_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT FALSE
);

-- 2. Documents
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT REFERENCES employees(employee_id),
  doc_type TEXT CHECK (doc_type IN ('Aadhaar', 'PAN', 'Offer Letter', 'Other')),
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE
);

-- 3. Holidays
CREATE TABLE holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('Public', 'Company', 'Restricted')) DEFAULT 'Public'
);

-- 4. Departments
CREATE TABLE departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  head_id TEXT REFERENCES employees(employee_id),
  description TEXT
);

-- 5. Leave Balances
CREATE TABLE leave_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT REFERENCES employees(employee_id),
  leave_type TEXT CHECK (leave_type IN ('Annual', 'Sick', 'Casual', 'Maternity', 'Paternity')),
  total NUMERIC DEFAULT 0,
  used NUMERIC DEFAULT 0,
  remaining NUMERIC DEFAULT 0 GENERATED ALWAYS AS (total - used) STORED,
  year INTEGER NOT NULL
);

-- RLS POLICIES FOR NEW TABLES
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- Announcements: Everyone can read based on target role, Admins can manage
CREATE POLICY "read_announcements" ON announcements
  FOR SELECT USING (
    target_role = 'All' 
    OR (target_role = (SELECT role FROM profiles WHERE id = auth.uid()))
    OR (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  );

CREATE POLICY "admin_manage_announcements" ON announcements
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Documents: Employees read/write own, Admins read/write all
CREATE POLICY "employee_own_documents" ON documents
  FOR ALL USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_manage_documents" ON documents
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Holidays: Everyone can read, Admins can manage
CREATE POLICY "read_holidays" ON holidays
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_holidays" ON holidays
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Departments: Everyone can read, Admins can manage
CREATE POLICY "read_departments" ON departments
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_departments" ON departments
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Leave Balances: Employees read own, Admins read/write all
CREATE POLICY "employee_own_balances" ON leave_balances
  FOR SELECT USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_manage_balances" ON leave_balances
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
