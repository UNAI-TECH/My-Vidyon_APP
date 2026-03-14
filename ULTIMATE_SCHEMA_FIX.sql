-- ============================================================
-- THE ULTIMATE SCHEMA FIX: Standardization & Column Recovery
-- ============================================================
-- This script fixes the "institution_id as UUID" error once and for all
-- and ensures missing columns in staff_details are added.
-- ============================================================

-- 1. FIX ANNOUNCEMENTS TABLE (FORCE TEXT)
DO $$
DECLARE
    col_type TEXT;
BEGIN
    -- Check type of institution_id
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name = 'institution_id';

    IF col_type = 'uuid' THEN
        -- Link existing UUIDs to Text codes where possible
        -- 1. Drop EVERYTHING that might depend on this column
        ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_institution_id_fkey;
        
        -- 2. Change type and cast existing values
        ALTER TABLE public.announcements ALTER COLUMN institution_id TYPE TEXT USING institution_id::text;
        
        -- 3. Recover the text codes from institutions table
        UPDATE public.announcements a
        SET institution_id = i.institution_id
        FROM public.institutions i
        WHERE a.institution_id = i.id::text;
        
        -- 4. Re-establish foreign key to institutions.institution_id (TEXT unique key)
        ALTER TABLE public.announcements 
        ADD CONSTRAINT announcements_institution_id_fkey 
        FOREIGN KEY (institution_id) 
        REFERENCES public.institutions(institution_id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE 'announcements.institution_id converted to TEXT';
    END IF;
END $$;

-- 2. ENSURE OTHER COLUMNS EXIST IN ANNOUNCEMENTS
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS class_name TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS announcement_type TEXT DEFAULT 'info';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'all';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. FIX STAFF_DETAILS TABLE (MISSING COLUMNS)
ALTER TABLE public.staff_details ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.staff_details ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.staff_details ADD COLUMN IF NOT EXISTS class_assigned TEXT;
ALTER TABLE public.staff_details ADD COLUMN IF NOT EXISTS section_assigned TEXT;
ALTER TABLE public.staff_details ADD COLUMN IF NOT EXISTS institution_id TEXT;

-- 4. RE-ESTABLISH RLS FOR ANNOUNCEMENTS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View announcements" ON public.announcements;
CREATE POLICY "View announcements" ON public.announcements FOR SELECT TO authenticated USING (true);

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

-- 5. FINAL STATUS CHECK
SELECT 'SCHEMA RECOVERY SUCCESSFUL' as status;
