-- Fix: faculty_post_announcement - insert institution code directly, not UUID
-- The announcements.institution_id column is TEXT
-- The FK references institutions(institution_id) which is also TEXT ('UNAI2026')
-- So we should insert p_institution_code directly, no UUID lookup needed.

CREATE OR REPLACE FUNCTION public.faculty_post_announcement(
  p_institution_code  text,
  p_title             text,
  p_content           text,
  p_type              text,
  p_announcement_type text,
  p_target_audience   text,
  p_class_name        text,
  p_section           text,
  p_target_class_id   uuid,
  p_target_section    text,
  p_created_by        uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_announcement_id uuid;
BEGIN
  -- Verify the institution code exists in the institutions table
  IF NOT EXISTS (
    SELECT 1 FROM public.institutions WHERE institution_id = p_institution_code
  ) THEN
    RAISE EXCEPTION 'Institution not found: %', p_institution_code;
  END IF;

  -- Insert directly with the text institution code
  -- (announcements.institution_id is TEXT, FK references institutions(institution_id))
  INSERT INTO public.announcements (
    institution_id,
    title,
    content,
    type,
    announcement_type,
    target_audience,
    class_name,
    section,
    target_class_id,
    target_section,
    created_by,
    published_at
  ) VALUES (
    p_institution_code,   -- TEXT code e.g. 'UNAI2026'
    p_title,
    p_content,
    p_type,
    p_announcement_type,
    p_target_audience,
    p_class_name,
    p_section,
    p_target_class_id,
    p_target_section,
    p_created_by,
    now()
  ) RETURNING id INTO v_announcement_id;

  RETURN v_announcement_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.faculty_post_announcement(text, text, text, text, text, text, text, text, uuid, text, uuid) TO authenticated;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
