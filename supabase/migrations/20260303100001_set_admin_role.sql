-- Set admin role for larochemusic@gmail.com
UPDATE public.users
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'larochemusic@gmail.com'
);
