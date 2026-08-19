-- Run this in the Supabase Dashboard SQL Editor for project mdckskhxlnnzgerqdwui.
-- It creates the required Row Level Security (RLS) policies for the KentSLSC bucket.
-- The application backend uses the service_role key, which bypasses RLS, but these
-- policies are required for public file access and for any authenticated uploads.

-- Make sure the bucket is public so objects have public URLs.
-- (This can also be done in Dashboard → Storage → Buckets → KentSLSC → Make public.)
update storage.buckets
set public = true
where id = 'KentSLSC';

-- Enable RLS on storage objects (safe to run even if already enabled).
alter table storage.objects enable row level security;

-- Drop existing policies for this bucket so the script is idempotent.
drop policy if exists "KentSLSC public read" on storage.objects;
drop policy if exists "KentSLSC authenticated upload" on storage.objects;
drop policy if exists "KentSLSC authenticated update" on storage.objects;
drop policy if exists "KentSLSC authenticated delete" on storage.objects;

-- Allow anyone (including unauthenticated visitors) to read files in the KentSLSC bucket.
-- This is required for public image/video URLs used on the site.
create policy "KentSLSC public read"
  on storage.objects
  for select
  using (bucket_id = 'KentSLSC');

-- Allow authenticated users to upload files to the KentSLSC bucket.
-- Objects must be owned by the requesting Supabase auth user. The production
-- application uploads through the NestJS backend with the service_role key, which
-- bypasses RLS, so this policy is defense-in-depth for any direct client uploads.
create policy "KentSLSC authenticated upload own objects"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'KentSLSC' and owner = auth.uid());

-- Allow authenticated users to update their own objects only.
create policy "KentSLSC authenticated update own objects"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'KentSLSC' and owner = auth.uid());

-- Allow authenticated users to delete their own objects only.
create policy "KentSLSC authenticated delete own objects"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'KentSLSC' and owner = auth.uid());
