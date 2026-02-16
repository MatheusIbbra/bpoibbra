
-- Temporarily disable audit trigger to delete orphan organization
ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;

DELETE FROM public.organizations 
WHERE id = 'eb1ee5ae-9890-4487-9167-94767e955fa7' AND slug = 'cliente-31f607d3';

ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;
