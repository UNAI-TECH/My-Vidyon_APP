-- ============================================================
-- Migration: Add class_name, section, target_audience to announcements
-- and fix institution_id type if needed.
-- 
-- INSTRUCTIONS: Run this SQL in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================

-- 1. Add class_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'announcements'
          AND column_name = 'class_name'
    ) THEN
        ALTER TABLE public.announcements ADD COLUMN class_name TEXT;
        RAISE NOTICE 'Added class_name column to announcements';
    ELSE
        RAISE NOTICE 'class_name column already exists';
    END IF;
END $$;

-- 2. Add section column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'announcements'
          AND column_name = 'section'
    ) THEN
        ALTER TABLE public.announcements ADD COLUMN section TEXT;
        RAISE NOTICE 'Added section column to announcements';
    ELSE
        RAISE NOTICE 'section column already exists';
    END IF;
END $$;

-- 3. Add target_audience column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'announcements'
          AND column_name = 'target_audience'
    ) THEN
        ALTER TABLE public.announcements ADD COLUMN target_audience TEXT;
        RAISE NOTICE 'Added target_audience column to announcements';
    ELSE
        RAISE NOTICE 'target_audience column already exists';
    END IF;
END $$;

-- 4. Add announcement_type column if it doesn't exist (to distinguish from audience 'type')
--    The 'type' column in the original schema was used for audience target.
--    We keep it for backward compatibility and add announcement_type for info/important/warning.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'announcements'
          AND column_name = 'announcement_type'
    ) THEN
        ALTER TABLE public.announcements ADD COLUMN announcement_type TEXT DEFAULT 'info';
        RAISE NOTICE 'Added announcement_type column to announcements';
    ELSE
        RAISE NOTICE 'announcement_type column already exists';
    END IF;
END $$;

-- 5. Check current institution_id data type and convert if needed
-- The error "column institution_id is of type uuid but expression is of type text"
-- means the live table has institution_id as UUID.
-- If it's TEXT, this is a no-op. If it's UUID, we need to keep it as UUID
-- and insert UUIDs (which our updated code now does via institutionUUID lookup).
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
    
    -- The code now inserts the UUID directly, so no type conversion needed.
    -- This just reports the current type for debugging.
END $$;

-- 6. Ensure indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_announcements_class ON public.announcements(class_name);
CREATE INDEX IF NOT EXISTS idx_announcements_section ON public.announcements(section);

-- Done!
SELECT 'Migration complete. announcements table updated.' AS result;
