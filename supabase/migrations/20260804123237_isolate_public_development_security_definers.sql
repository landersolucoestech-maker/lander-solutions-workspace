create schema if not exists development_private;

revoke all on schema development_private from public;
grant usage on schema development_private to anon, authenticated, service_role;

alter function public.create_fiscal_document_bundle(jsonb) set schema development_private;
alter function public.dev_delete_hr_record(text, uuid, bigint) set schema development_private;
alter function public.dev_get_contact_form(uuid) set schema development_private;
alter function public.dev_save_contact_form(jsonb) set schema development_private;
alter function public.dev_update_hr_document(jsonb) set schema development_private;
alter function public.dev_update_hr_employee(jsonb) set schema development_private;
alter function public.dev_update_hr_leave(jsonb) set schema development_private;
alter function public.dev_update_hr_payment(jsonb) set schema development_private;
alter function public.has_permission(text, text) set schema development_private;

revoke all on function development_private.create_fiscal_document_bundle(jsonb) from public, anon, authenticated, service_role;
revoke all on function development_private.dev_delete_hr_record(text, uuid, bigint) from public, anon, authenticated, service_role;
revoke all on function development_private.dev_get_contact_form(uuid) from public, anon, authenticated, service_role;
revoke all on function development_private.dev_save_contact_form(jsonb) from public, anon, authenticated, service_role;
revoke all on function development_private.dev_update_hr_document(jsonb) from public, anon, authenticated, service_role;
revoke all on function development_private.dev_update_hr_employee(jsonb) from public, anon, authenticated, service_role;
revoke all on function development_private.dev_update_hr_leave(jsonb) from public, anon, authenticated, service_role;
revoke all on function development_private.dev_update_hr_payment(jsonb) from public, anon, authenticated, service_role;
revoke all on function development_private.has_permission(text, text) from public, anon, authenticated, service_role;

grant execute on function development_private.create_fiscal_document_bundle(jsonb) to anon, authenticated, service_role;
grant execute on function development_private.dev_delete_hr_record(text, uuid, bigint) to anon, authenticated, service_role;
grant execute on function development_private.dev_get_contact_form(uuid) to anon, authenticated, service_role;
grant execute on function development_private.dev_save_contact_form(jsonb) to anon, authenticated, service_role;
grant execute on function development_private.dev_update_hr_document(jsonb) to anon, authenticated, service_role;
grant execute on function development_private.dev_update_hr_employee(jsonb) to anon, authenticated, service_role;
grant execute on function development_private.dev_update_hr_leave(jsonb) to anon, authenticated, service_role;
grant execute on function development_private.dev_update_hr_payment(jsonb) to anon, authenticated, service_role;
grant execute on function development_private.has_permission(text, text) to anon, authenticated, service_role;

create function public.create_fiscal_document_bundle(p_payload jsonb)
returns public.financial_fiscal_documents
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'development_private'
as $$
  select * from development_private.create_fiscal_document_bundle(p_payload);
$$;

create function public.dev_delete_hr_record(
  p_entity text,
  p_id uuid,
  p_expected_version bigint
)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'development_private'
as $$
  select development_private.dev_delete_hr_record(p_entity, p_id, p_expected_version);
$$;

create function public.dev_get_contact_form(p_party_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public', 'development_private'
as $$
  select development_private.dev_get_contact_form(p_party_id);
$$;

create function public.dev_save_contact_form(p_payload jsonb)
returns uuid
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'development_private'
as $$
  select development_private.dev_save_contact_form(p_payload);
$$;

create function public.dev_update_hr_document(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'development_private'
as $$
  select development_private.dev_update_hr_document(p_payload);
$$;

create function public.dev_update_hr_employee(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'development_private'
as $$
  select development_private.dev_update_hr_employee(p_payload);
$$;

create function public.dev_update_hr_leave(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'development_private'
as $$
  select development_private.dev_update_hr_leave(p_payload);
$$;

create function public.dev_update_hr_payment(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'development_private'
as $$
  select development_private.dev_update_hr_payment(p_payload);
$$;

create function public.has_permission(
  p_permission_code text,
  p_unit_code text default null
)
returns boolean
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public', 'development_private'
as $$
  select development_private.has_permission(p_permission_code, p_unit_code);
$$;

revoke all on function public.create_fiscal_document_bundle(jsonb) from public;
revoke all on function public.dev_delete_hr_record(text, uuid, bigint) from public;
revoke all on function public.dev_get_contact_form(uuid) from public;
revoke all on function public.dev_save_contact_form(jsonb) from public;
revoke all on function public.dev_update_hr_document(jsonb) from public;
revoke all on function public.dev_update_hr_employee(jsonb) from public;
revoke all on function public.dev_update_hr_leave(jsonb) from public;
revoke all on function public.dev_update_hr_payment(jsonb) from public;
revoke all on function public.has_permission(text, text) from public;

grant execute on function public.create_fiscal_document_bundle(jsonb) to anon, authenticated, service_role;
grant execute on function public.dev_delete_hr_record(text, uuid, bigint) to anon, authenticated, service_role;
grant execute on function public.dev_get_contact_form(uuid) to anon, authenticated, service_role;
grant execute on function public.dev_save_contact_form(jsonb) to anon, authenticated, service_role;
grant execute on function public.dev_update_hr_document(jsonb) to anon, authenticated, service_role;
grant execute on function public.dev_update_hr_employee(jsonb) to anon, authenticated, service_role;
grant execute on function public.dev_update_hr_leave(jsonb) to anon, authenticated, service_role;
grant execute on function public.dev_update_hr_payment(jsonb) to anon, authenticated, service_role;
grant execute on function public.has_permission(text, text) to anon, authenticated, service_role;

comment on schema development_private is
  'Implementações privilegiadas do runtime público temporário da branch dev. O schema não deve ser exposto pelo Data API e deve ser removido na restauração de autenticação para produção.';

notify pgrst, 'reload schema';
