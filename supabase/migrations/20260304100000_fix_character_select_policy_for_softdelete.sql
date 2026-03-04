-- Fix: Setting deleted_at on characters fails RLS because the SELECT policy
-- requires "deleted_at IS NULL". PostgreSQL checks SELECT visibility on the
-- new row during UPDATE, causing "new row violates row-level security".
--
-- Solution: SECURITY DEFINER functions that run as the DB owner (bypassing RLS)
-- but still verify auth.uid() = user_id for safety.

-- Soft-delete a single character
CREATE OR REPLACE FUNCTION soft_delete_character(p_character_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE characters
  SET is_active = false, deleted_at = now()
  WHERE id = p_character_id
    AND user_id = (select auth.uid())
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by user';
  END IF;
END;
$$;

-- Soft-delete ALL active characters for the current user, returns count
CREATE OR REPLACE FUNCTION soft_delete_all_characters()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE characters
  SET is_active = false, deleted_at = now()
  WHERE user_id = (select auth.uid())
    AND is_active = true
    AND deleted_at IS NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Restore a soft-deleted character
CREATE OR REPLACE FUNCTION restore_character(p_character_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE characters
  SET is_active = true, deleted_at = NULL
  WHERE id = p_character_id
    AND user_id = (select auth.uid())
    AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by user';
  END IF;
END;
$$;
