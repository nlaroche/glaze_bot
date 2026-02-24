CREATE OR REPLACE FUNCTION daily_pack_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM booster_packs
  WHERE user_id = p_user_id
    AND opened_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
$$;
