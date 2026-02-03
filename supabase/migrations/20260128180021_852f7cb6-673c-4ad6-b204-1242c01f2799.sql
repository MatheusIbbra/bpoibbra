-- Drop existing storage policies and recreate with correct logic
DROP POLICY IF EXISTS "Users can upload to their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their org files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their org files" ON storage.objects;

-- Policy to allow users to upload files - using get_viewable_organizations for hierarchy support
CREATE POLICY "Users can upload to their org folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'extratos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.get_viewable_organizations(auth.uid())
  )
);

-- Policy to allow users to view files from their organization's folder
CREATE POLICY "Users can view their org files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'extratos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.get_viewable_organizations(auth.uid())
  )
);

-- Policy to allow users to delete files from their organization's folder
CREATE POLICY "Users can delete their org files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'extratos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.get_viewable_organizations(auth.uid())
  )
);