
-- Fix org name to match the user's full name from profile
UPDATE public.organizations o
SET name = p.full_name
FROM public.organization_members om
JOIN public.profiles p ON om.user_id = p.user_id
WHERE o.id = om.organization_id
  AND o.name != p.full_name
  AND p.full_name IS NOT NULL
  AND om.role = 'cliente';
