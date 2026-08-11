# Supabase Storage Setup

Project: `mdckskhxlnnzgerqdwui`  
Bucket: `KentSLSC`

## What is stored here

All images and videos used by the site are uploaded to the `KentSLSC` bucket:

- Events (`imageUrl`)
- Business directory listings (`logoUrl`)
- Blog posts (`imageUrl`)
- Fundraisers (`imageUrl`)
- Home-page hero media (`imageUrl` / `videoUrl`)
- Site-page OG images (`ogImageUrl`)
- Membership cards (`membershipCardUrl`)

## Required environment variables

```env
SUPABASE_URL=https://mdckskhxlnnzgerqdwui.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>
SUPABASE_BUCKET=KentSLSC
```

`SUPABASE_SERVICE_KEY` must be the **service_role** key from:
**Supabase Dashboard → Project Settings → API → Project API keys → `service_role` (secret)**

## Bucket configuration

The bucket should be **public** so uploaded images and videos have public URLs that can be embedded directly in pages and emails.

## Storage policies

Run `scripts/setup-supabase-storage.sql` in the Supabase Dashboard SQL Editor to create the required Row Level Security (RLS) policies:

1. `KentSLSC public read` — allows anyone to view files via public URL.
2. `KentSLSC authenticated upload` — allows authenticated users to upload.
3. `KentSLSC authenticated update` — allows authenticated users to update objects.
4. `KentSLSC authenticated delete` — allows authenticated users to delete objects.

The production backend uses the `service_role` key, which bypasses RLS, so the policies mainly protect public/authenticated access paths.

## Re-applying policies

Open the SQL Editor in the Supabase dashboard, paste the contents of `scripts/setup-supabase-storage.sql`, and click **Run**. The script is idempotent — it drops and recreates the policies each time.
