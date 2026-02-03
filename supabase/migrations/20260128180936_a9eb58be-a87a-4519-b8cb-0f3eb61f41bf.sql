-- Fix Storage RLS for extratos bucket (allow hierarchy-based access)
-- Note: storage.objects already has RLS enabled by default in Supabase.

-- Drop any prior conflicting policies (safe if they don't exist)
DROP POLICY IF EXISTS "Users can upload to their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read extratos in their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete extratos in their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Extratos: upload" ON storage.objects;
DROP POLICY IF EXISTS "Extratos: read" ON storage.objects;
DROP POLICY IF EXISTS "Extratos: delete" ON storage.objects;

-- SELECT: allow reading files in org folders the user can view (Admin/Supervisor/FA/KAM/Cliente)
CREATE POLICY "Extratos: read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'extratos'
  AND (storage.foldername(name))[1] IN (
    SELECT public.get_viewable_organizations(auth.uid())::text
  )
);

-- INSERT: allow uploads into org folders the user can view
CREATE POLICY "Extratos: upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'extratos'
  AND (storage.foldername(name))[1] IN (
    SELECT public.get_viewable_organizations(auth.uid())::text
  )
);

-- DELETE: allow deleting files in org folders the user can view
CREATE POLICY "Extratos: delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'extratos'
  AND (storage.foldername(name))[1] IN (
    SELECT public.get_viewable_organizations(auth.uid())::text
  )
);
