-- FINAL FIX: Convert announcements.institution_id UUID → TEXT
-- Drops RLS policies first (required), converts column, then restores everything.

-- Step 1: Drop blocking RLS policies
DROP POLICY IF EXISTS "Read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Authenticated users can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Faculty can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "allow_select_announcements" ON public.announcements;
DROP POLICY IF EXISTS "allow_insert_announcements" ON public.announcements;

-- Step 2: Drop the FK constraint on announcements only
ALTER TABLE public.announcements 
DROP CONSTRAINT IF EXISTS announcements_institution_id_fkey;

-- Step 3: Convert column from UUID to TEXT
ALTER TABLE public.announcements 
ALTER COLUMN institution_id TYPE TEXT USING institution_id::text;

-- Step 4: Re-add FK referencing the TEXT institution code
ALTER TABLE public.announcements 
ADD CONSTRAINT announcements_institution_id_fkey 
FOREIGN KEY (institution_id) 
REFERENCES public.institutions (institution_id) 
ON DELETE CASCADE;

-- Step 5: Restore RLS policies
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read announcements"
ON public.announcements FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert announcements"
ON public.announcements FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update announcements"
ON public.announcements FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete announcements"
ON public.announcements FOR DELETE
USING (auth.uid() = created_by);

-- Step 6: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'announcements' AND column_name = 'institution_id';
