create or replace function public.admin_get_party_restricted_reference(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(r) - 'created_by' - 'updated_by'
  from private.party_restricted_references r
  where r.id = p_id;
$$;

revoke all on function public.admin_get_party_restricted_reference(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_party_restricted_reference(uuid) to service_role;
