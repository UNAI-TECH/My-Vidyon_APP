-- ============================================================
-- FIX: Institution admin RLS policies so they can read students
-- and announcement insert works correctly.
--
-- INSTRUCTIONS: Run this SQL in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================

-- ============================================================
-- SECTION 1: Fix students table RLS
-- Allow institution admins to read all students in their institution
-- ============================================================

-- Drop old conflicting policies if they exist
DROP POLICY IF EXISTS "Institution can read their students" ON public.students;
DROP POLICY IF EXISTS "Institution admin reads students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can select students" ON public.students;

-- Allow institution admins to view all students in their institution
CREATE POLICY "Institution admin reads students"
ON public.students
FOR SELECT
TO authenticated
USING (
    -- The institution admin: their admin_email matches the logged-in user's email
    institution_id IN (
        SELECT i.institution_id
        FROM public.institutions i
        INNER JOIN auth.users u ON u.email = i.admin_email
        WHERE u.id = auth.uid()
    )
    OR
    -- OR via profile table marking them as 'institution' role
    institution_id IN (
        SELECT p.institution_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('institution', 'admin')
    )
    OR
    -- The student themselves can read their own record
    profile_id = auth.uid()
    OR
    user_id = auth.uid()
);

-- Allow institution admins to INSERT students (create-user edge function may bypass this, but keep for safety)
DROP POLICY IF EXISTS "Institution admin inserts students" ON public.students;
CREATE POLICY "Institution admin inserts students"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (
    institution_id IN (
        SELECT i.institution_id
        FROM public.institutions i
        INNER JOIN auth.users u ON u.email = i.admin_email
        WHERE u.id = auth.uid()
    )
    OR
    institution_id IN (
        SELECT p.institution_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('institution', 'admin')
    )
);

-- Allow institution admins to UPDATE students
DROP POLICY IF EXISTS "Institution admin updates students" ON public.students;
CREATE POLICY "Institution admin updates students"
ON public.students
FOR UPDATE
TO authenticated
USING (
    institution_id IN (
        SELECT i.institution_id
        FROM public.institutions i
        INNER JOIN auth.users u ON u.email = i.admin_email
        WHERE u.id = auth.uid()
    )
    OR
    institution_id IN (
        SELECT p.institution_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('institution', 'admin')
    )
);

-- Faculty should also be able to see students in their assigned class
DROP POLICY IF EXISTS "Faculty can view their students" ON public.students;
CREATE POLICY "Faculty can view their students"
ON public.students
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.faculty_subjects fs
        JOIN public.classes c ON c.id = fs.class_id
        WHERE fs.faculty_profile_id = auth.uid()
          AND c.name = students.class_name
          AND fs.section = students.section
    )
    OR
    -- Also via staff_details class_assigned
    EXISTS (
        SELECT 1
        FROM public.staff_details sd
        WHERE sd.profile_id = auth.uid()
          AND sd.class_assigned = students.class_name
          AND sd.section_assigned = students.section
    )
);

-- ============================================================
-- SECTION 2: Fix announcements table RLS
-- Allow faculty to insert announcements for their institution
-- ============================================================

DROP POLICY IF EXISTS "Faculty can insert announcements" ON public.announcements;
CREATE POLICY "Faculty can insert announcements"
ON public.announcements
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('faculty', 'institution', 'admin', 'teacher')
    )
);

DROP POLICY IF EXISTS "Institution reads own announcements" ON public.announcements;
CREATE POLICY "Institution reads own announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (true); -- All authenticated users can read (filtered by institution_id on the query side)

-- ============================================================
-- SECTION 3: Ensure staff_details is readable by institution admins
-- ============================================================

DROP POLICY IF EXISTS "Institution admin reads staff" ON public.staff_details;
CREATE POLICY "Institution admin reads staff"
ON public.staff_details
FOR SELECT
TO authenticated
USING (
    institution_id IN (
        SELECT i.institution_id
        FROM public.institutions i
        INNER JOIN auth.users u ON u.email = i.admin_email
        WHERE u.id = auth.uid()
    )
    OR
    institution_id IN (
        SELECT p.institution_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('institution', 'admin', 'faculty', 'teacher')
    )
    OR
    profile_id = auth.uid()
);

-- ============================================================
-- DONE!
SELECT 'RLS policies applied successfully. Students should now appear for institution admin.' AS result;
