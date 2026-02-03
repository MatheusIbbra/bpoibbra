-- Fix security: Require authentication for SELECT on profiles table
-- Drop any existing permissive SELECT policies that allow public access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Create policy requiring authentication
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Create policy for users to manage their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix security: Require authentication for SELECT on organizations table
DROP POLICY IF EXISTS "Organizations are viewable by everyone" ON public.organizations;
DROP POLICY IF EXISTS "Anyone can read organizations" ON public.organizations;
DROP POLICY IF EXISTS "Public organizations are viewable by everyone" ON public.organizations;

-- Create policy requiring authentication for organizations
CREATE POLICY "Authenticated users can view organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (true);

-- Fix security: Require authentication for SELECT on transactions table
DROP POLICY IF EXISTS "Transactions are viewable by everyone" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Public transactions are viewable by everyone" ON public.transactions;

-- Create policy requiring authentication for transactions
CREATE POLICY "Authenticated users can view transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (true);