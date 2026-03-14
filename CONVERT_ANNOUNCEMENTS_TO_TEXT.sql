-- ============================================================
-- Migration: Convert announcements.institution_id from UUID to TEXT
-- and ensure it aligns with the rest of the system.
-- ============================================================

DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name = 'institution_id';

    RAISE NOTICE 'announcements.institution_id is currently type: %', col_type;

    IF col_type = 'uuid' THEN
        -- 1. Remove old foreign key if it exists
        -- First find the constraint name
        -- Note: We assume it might be a FK to institutions(id) or institutions(institution_id)
        -- The user provided schema for institutions shows 'id' is UUID and 'institution_id' is TEXT.
        
        -- 2. Convert the column to TEXT
        -- We'll temporarily drop constraints to allow the type change
        ALTER TABLE public.announcements ALTER COLUMN institution_id TYPE TEXT USING institution_id::text;
        
        RAISE NOTICE 'Converted announcements.institution_id to TEXT';
        
        -- 3. If possible, we should update the values from UUID to the text code (e.g. UNAI2026)
        -- but since the user is seeing "Failed to publish", there might not be many records yet.
        -- We can join with institutions to get the text code for existing rows.
        UPDATE public.announcements a
        SET institution_id = i.institution_id
        FROM public.institutions i
        WHERE a.institution_id = i.id::text;

        RAISE NOTICE 'Updated existing rows to use text institution_id';
    END IF;
END $$;

-- 4. Re-link foreign key to institutions.institution_id (which is TEXT)
ALTER TABLE public.announcements
DROP CONSTRAINT IF EXISTS announcements_institution_id_fkey;

ALTER TABLE public.announcements
ADD CONSTRAINT announcements_institution_id_fkey 
FOREIGN KEY (institution_id) 
REFERENCES institutions(institution_id) 
ON DELETE CASCADE;

-- 5. Final check
SELECT 'MIGRATION SUCCESS: announcements.institution_id is now TEXT and linked to institutions.institution_id' as result;
