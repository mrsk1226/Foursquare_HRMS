-- Run this script in your Supabase SQL Editor to set up Announcements features

-- 1. Create announcement images bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('announcement-images', 'announcement-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_announcement_images" ON storage.objects;

CREATE POLICY "public_announcement_images" 
ON storage.objects FOR ALL 
USING (bucket_id = 'announcement-images');

-- 2. Create Reactions Table
CREATE TABLE IF NOT EXISTS public.announcement_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    employee_photo TEXT,
    reaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Comments Table
CREATE TABLE IF NOT EXISTS public.announcement_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    employee_photo TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
