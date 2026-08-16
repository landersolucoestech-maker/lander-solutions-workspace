drop policy if exists dev_public_document_read on storage.objects;

create policy dev_public_document_read
on storage.objects
for select
to anon
using (
  bucket_id = 'financial-fiscal-documents'
  and name like 'public-dev/%'
);

-- The managed storage tables are owned by supabase_storage_admin in hosted projects.
-- PostgreSQL ignores these revocations when the migration role is not the grantor;
-- the effective access boundary remains RLS and the policies above.
revoke truncate, references, trigger
on all tables in schema storage
from anon, authenticated;
