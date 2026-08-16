alter table public.contract_templates
  add column if not exists header_image_path text,
  add column if not exists footer_image_path text,
  add column if not exists header_image_alignment text not null default 'center',
  add column if not exists footer_image_alignment text not null default 'center';

alter table public.contract_templates
  drop constraint if exists contract_templates_header_image_alignment_check,
  add constraint contract_templates_header_image_alignment_check
    check (header_image_alignment in ('left', 'center', 'right')),
  drop constraint if exists contract_templates_footer_image_alignment_check,
  add constraint contract_templates_footer_image_alignment_check
    check (footer_image_alignment in ('left', 'center', 'right')),
  drop constraint if exists contract_templates_header_image_path_check,
  add constraint contract_templates_header_image_path_check
    check (
      header_image_path is null
      or header_image_path ~ '^(public-dev/)?contract-templates/[0-9a-f-]{36}/header/[0-9a-f-]{36}\.(png|jpg|webp)$'
    ),
  drop constraint if exists contract_templates_footer_image_path_check,
  add constraint contract_templates_footer_image_path_check
    check (
      footer_image_path is null
      or footer_image_path ~ '^(public-dev/)?contract-templates/[0-9a-f-]{36}/footer/[0-9a-f-]{36}\.(png|jpg|webp)$'
    );

comment on column public.contract_templates.header_image_path is
  'Private Supabase Storage object path for the template header image.';
comment on column public.contract_templates.footer_image_path is
  'Private Supabase Storage object path for the template footer image.';
comment on column public.contract_templates.header_image_alignment is
  'Horizontal alignment of the template header image.';
comment on column public.contract_templates.footer_image_alignment is
  'Horizontal alignment of the template footer image.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contract-template-assets',
  'contract-template-assets',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists contract_template_assets_select on storage.objects;
create policy contract_template_assets_select on storage.objects
for select to authenticated
using (
  bucket_id = 'contract-template-assets'
  and (
    name like 'contract-templates/%'
    or name like 'public-dev/contract-templates/%'
  )
  and private.current_user_has_permission('contracts.read', null)
);

drop policy if exists contract_template_assets_insert on storage.objects;
create policy contract_template_assets_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'contract-template-assets'
  and (
    name like 'contract-templates/%'
    or name like 'public-dev/contract-templates/%'
  )
  and private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', null)
);

drop policy if exists contract_template_assets_delete on storage.objects;
create policy contract_template_assets_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'contract-template-assets'
  and (
    name like 'contract-templates/%'
    or name like 'public-dev/contract-templates/%'
  )
  and private.current_user_has_aal2()
  and private.current_user_has_permission('contracts.documents.manage', null)
);
