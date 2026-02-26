-- Clean up dev user's existing characters, parties, and booster packs
-- so they start fresh with the template-based system.
-- Templates are already seeded at this point so the data is safe.
DO $$
DECLARE
  dev_uid uuid;
BEGIN
  SELECT id INTO dev_uid FROM auth.users WHERE email = 'larochemusic@gmail.com';
  IF dev_uid IS NOT NULL THEN
    DELETE FROM public.parties WHERE user_id = dev_uid;
    DELETE FROM public.booster_packs WHERE user_id = dev_uid;
    DELETE FROM public.characters WHERE user_id = dev_uid;
  END IF;
END $$;
