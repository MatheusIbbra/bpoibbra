
-- Clean up audit_log references first, then delete user
DELETE FROM public.audit_log WHERE user_id = '31f607d3-b50c-41c4-8975-053e75ec2440';
DELETE FROM auth.users WHERE id = '31f607d3-b50c-41c4-8975-053e75ec2440';
