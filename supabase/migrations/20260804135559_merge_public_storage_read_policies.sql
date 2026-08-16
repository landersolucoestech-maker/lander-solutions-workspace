drop policy if exists dev_public_fiscal_pdf_select on storage.objects;
drop policy if exists dev_public_hr_documents_read on storage.objects;

create policy dev_public_document_read
on storage.objects
for select
to anon
using (
  (
    bucket_id = 'financial-fiscal-documents'
    and name like 'public-dev/%'
  )
  or bucket_id = any (array['hr-documents'::text, 'financial-fiscal-documents'::text])
);
