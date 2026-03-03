-- Ensure a public.users row exists for larochemusic@gmail.com, then set admin role
INSERT INTO public.users (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'larochemusic@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
