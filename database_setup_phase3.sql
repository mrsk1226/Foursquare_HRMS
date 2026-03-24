-- Phase 3 Access Control SQL Updates
-- Please run this in your Supabase SQL Editor

-- 1. Update the role constraint to support HR
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'hr', 'employee'));

-- 2. Update RLS policies to allow HR to manage specific tables (Optional depending on your exact RLS setup)
-- For example, allowing HR to view all employees but only edit specific ones, etc.
-- For now, the application logic will handle the HR boundaries as requested.
