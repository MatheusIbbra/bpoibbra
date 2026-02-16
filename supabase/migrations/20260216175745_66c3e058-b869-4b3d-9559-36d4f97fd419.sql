-- Create missing profile for Gisele Leite
INSERT INTO public.profiles (user_id, full_name, registration_completed)
VALUES ('31f607d3-b50c-41c4-8975-053e75ec2440', 'Gisele Leite', false)
ON CONFLICT (user_id) DO NOTHING;