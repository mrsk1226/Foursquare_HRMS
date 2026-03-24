-- 1. Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('admin','employee')) DEFAULT 'employee',
  employee_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Employees Table
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  department TEXT,
  designation TEXT,
  join_date DATE,
  salary_basic NUMERIC,
  bank_account TEXT,
  bank_ifsc TEXT,
  pan_number TEXT,
  address TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Attendance Logs
CREATE TABLE attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT REFERENCES employees(employee_id),
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  lat NUMERIC,
  lng NUMERIC,
  date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'present'
);

-- 4. Leave Requests
CREATE TABLE leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT REFERENCES employees(employee_id),
  leave_type TEXT,
  start_date DATE,
  end_date DATE,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Payroll
CREATE TABLE payroll (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT REFERENCES employees(employee_id),
  month INTEGER,
  year INTEGER,
  basic NUMERIC,
  hra NUMERIC,
  deductions NUMERIC,
  net_salary NUMERIC,
  payslip_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Onboarding
CREATE TABLE onboarding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT REFERENCES employees(employee_id),
  task_name TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  verified_by_admin BOOLEAN DEFAULT FALSE
);

-- RLS POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding ENABLE ROW LEVEL SECURITY;

-- Employee: own data only
CREATE POLICY "employee_own" ON employees
  FOR ALL USING (employee_id = (
    SELECT employee_id FROM profiles WHERE id = auth.uid()
  ));

-- Admin: full access
CREATE POLICY "admin_all" ON employees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin')
  );
