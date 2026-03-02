
-- Find the actual trigger name on organizations table
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'organizations' AND trigger_schema = 'public';
