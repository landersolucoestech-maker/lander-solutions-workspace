begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_column('public', 'contract_templates', 'header_image_path', 'header image path exists');
select has_column('public', 'contract_templates', 'footer_image_path', 'footer image path exists');
select has_column('public', 'contract_templates', 'header_image_alignment', 'header alignment exists');
select has_column('public', 'contract_templates', 'footer_image_alignment', 'footer alignment exists');

select col_is_null('public', 'contract_templates', 'header_image_path', 'header image remains optional');
select col_is_null('public', 'contract_templates', 'footer_image_path', 'footer image remains optional');

select is(
  (select public from storage.buckets where id = 'contract-template-assets'),
  false,
  'contract template asset bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'contract-template-assets'),
  2097152::bigint,
  'contract template asset bucket limits files to 2 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'contract-template-assets'),
  array['image/png', 'image/jpeg', 'image/webp']::text[],
  'contract template asset bucket only accepts required image formats'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'contract_template_assets_%' and 'authenticated' = any(roles)),
  3,
  'authenticated users have select, insert and delete policies for template assets'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '%contract_template_assets%' and 'anon' = any(roles)),
  0,
  'template asset storage has no anonymous policy'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'contract_template_assets_insert' and with_check like '%current_user_has_aal2%'),
  1,
  'template asset upload requires MFA aal2'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'contract_template_assets_insert' and with_check like '%contracts.documents.manage%'),
  1,
  'template asset upload requires contract document management permission'
);
select is(
  (select count(*)::integer from public.contract_templates where header_image_path is not null or footer_image_path is not null),
  0,
  'existing templates remain backward compatible without images'
);

select * from finish();

rollback;
