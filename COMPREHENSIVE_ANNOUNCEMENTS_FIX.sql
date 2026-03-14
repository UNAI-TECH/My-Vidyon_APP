-- ============================================================
-- COMPREHENSIVE FIX: Announcements Table Schema
-- ============================================================
-- This script ensures the announcements table has the correct 
-- columns and types for both text-based institution_id 
-- and new faculty announcement features.
-- ============================================================

-- 1. Ensure columns exist
DO $$
BEGIN
    -- class_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'class_name') THEN
        ALTER TABLE public.announcements ADD COLUMN class_name TEXT;
    END IF;

    -- section
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'section') THEN
        ALTER TABLE public.announcements ADD COLUMN section TEXT;
    END IF;

    -- target_audience
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'target_audience') THEN
        ALTER TABLE public.announcements ADD COLUMN target_audience TEXT;
    END IF;

    -- announcement_type (info, important, warning)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'announcement_type') THEN
        ALTER TABLE public.announcements ADD COLUMN announcement_type TEXT DEFAULT 'info';
    END IF;

    -- type (audience target: all, student, faculty)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'type') THEN
        ALTER TABLE public.announcements ADD COLUMN type TEXT DEFAULT 'all';
    END IF;

    -- published_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'published_at') THEN
        ALTER TABLE public.announcements ADD COLUMN published_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- 2. Ensure institution_id is TEXT
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name = 'institution_id';

    IF col_type = 'uuid' THEN
        -- Link existing UUIDs to Text codes where possible
        -- Drop constraint first
        ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_institution_id_fkey;
        
        -- Change type
        ALTER TABLE public.announcements ALTER COLUMN institution_id TYPE TEXT USING institution_id::text;
        
        -- Update values to text codes
        UPDATE public.announcements a
        SET institution_id = i.institution_id
        FROM public.institutions i
        WHERE a.institution_id = i.id::text;
        
        -- Add new constraint
        ALTER TABLE public.announcements 
        ADD CONSTRAINT announcements_institution_id_fkey 
        FOREIGN KEY (institution_id) 
        REFERENCES institutions(institution_id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Cleanup: Ensure created_at and published_at are populated
UPDATE public.announcements SET published_at = created_at WHERE published_at IS NULL;

-- 4. Re-enable RLS for Faculty
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

SELECT 'SUCCESS: Announcements table schema and RLS policies have been fully standardized.' as status;
