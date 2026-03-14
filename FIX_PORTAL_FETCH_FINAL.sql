-- ============================================================
-- FINAL FIX: Institution Portal & Faculty Announcement RLS
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- 1. Permissive policy for Institutions (Read-only for all auth)
DROP POLICY IF EXISTS "Allow read for all auth users" ON public.institutions;
CREATE POLICY "Allow read for all auth users" ON public.institutions FOR SELECT TO authenticated USING (true);

-- 1.5 Permissive policy for Classes (Read-only for all auth)
DROP POLICY IF EXISTS "Allow read for all auth users" ON public.classes;
CREATE POLICY "Allow read for all auth users" ON public.classes FOR SELECT TO authenticated USING (true);

-- 1.6 Permissive policy for Subjects (Read-only for all auth)
DROP POLICY IF EXISTS "Allow read for all auth users" ON public.subjects;
CREATE POLICY "Allow read for all auth users" ON public.subjects FOR SELECT TO authenticated USING (true);

-- 2. ROBUST Student Policy for Institution Admins
-- This ensures that if you are logged in as an admin of an institution,
-- you can see all students who share your institution_id code.
DROP POLICY IF EXISTS "Institution admin reads students" ON public.students;
CREATE POLICY "Institution admin reads students"
ON public.students
FOR ALL -- Allow SELECT, INSERT, UPDATE, DELETE
TO authenticated
USING (
    institution_id IN (SELECT p.institution_id FROM public.profiles p WHERE p.id = auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.institutions i 
        WHERE i.institution_id = students.institution_id 
        AND i.admin_email = auth.jwt()->>'email'
    )
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.institution_id = students.institution_id
        AND p.role::text IN ('institution', 'admin')
    )
);

-- 3. Faculty/Teacher Policy for Students
-- Allows faculty to see students in their class
DROP POLICY IF EXISTS "Faculty can view their students" ON public.students;
CREATE POLICY "Faculty can view their students"
ON public.students
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.faculty_subjects fs
        WHERE fs.faculty_profile_id = auth.uid()
        AND fs.section = students.section
        -- Add class name matching if needed, but section + institution_id is usually unique enough for a teacher
    )
    OR
    EXISTS (
        SELECT 1 FROM public.staff_details sd
        WHERE sd.profile_id = auth.uid()
        AND sd.class_assigned = students.class_name
        AND sd.section_assigned = students.section
    )
);

-- 4. Announcement Policies
-- Allow anyone authenticated to read (component-side logic filters by institution_id)
DROP POLICY IF EXISTS "View announcements" ON public.announcements;
CREATE POLICY "View announcements" ON public.announcements FOR SELECT TO authenticated USING (true);

-- Allow Faculty/Staff to Create Announcements
DROP POLICY IF EXISTS "Manage announcements" ON public.announcements;
CREATE POLICY "Manage announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (
    created_by = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
        AND p.role::text IN ('institution', 'admin', 'faculty', 'teacher')
    )
)
WITH CHECK (
    created_by = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
        AND p.role::text IN ('institution', 'admin', 'faculty', 'teacher')
    )
);

-- 5. Staff Details Policy
DROP POLICY IF EXISTS "Institution admin reads staff" ON public.staff_details;
CREATE POLICY "Institution admin reads staff"
ON public.staff_details
FOR SELECT
TO authenticated
USING (
    institution_id = (SELECT p.institution_id FROM public.profiles p WHERE p.id = auth.uid())
    OR
    profile_id = auth.uid() -- Faculty can read their own
);

-- 6. Faculty Subjects Policy
DROP POLICY IF EXISTS "View faculty subjects" ON public.faculty_subjects;
CREATE POLICY "View faculty subjects" ON public.faculty_subjects FOR SELECT TO authenticated USING (true);

-- 7. Ensure Realtime is enabled for these tables
DO $$ 
BEGIN 
    -- Add tables to supabase_realtime publication
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'announcements') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'students') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'faculty_subjects') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.faculty_subjects;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'staff_details') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_details;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT 'SUCCESS: All RLS policies updated. Please check the portal now.' as status;
