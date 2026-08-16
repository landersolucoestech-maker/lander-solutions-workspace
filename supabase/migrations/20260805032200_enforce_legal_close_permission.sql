-- Enforce a dedicated permission for closing legal matters.

create or replace function public.admin_close_legal_matter(
  p_matter_id uuid,
  p_expected_version integer,
  p_actor_user_id uuid,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matter public.legal_matters;
  v_unit_code text;
begin
  select * into v_matter
  from public.legal_matters
  where id = p_matter_id
  for update;

  if not found or v_matter.version <> p_expected_version then
    return null;
  end if;

  v_unit_code := private.governance_unit_code(v_matter.business_unit_id);
  if not private.user_has_permission(p_actor_user_id, 'legal.close', v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode = '42501';
  end if;

  if v_matter.status in ('closed','cancelled') then
    raise exception 'Assunto jurídico já encerrado.';
  end if;

  if char_length(btrim(coalesce(p_outcome, ''))) < 3 then
    raise exception 'Resultado do encerramento obrigatório.';
  end if;

  update public.legal_matters
  set status = 'closed',
      closed_on = current_date,
      outcome = btrim(p_outcome)
  where id = v_matter.id
    and version = p_expected_version
  returning * into v_matter;

  if not found then return null; end if;
  return to_jsonb(v_matter);
end;
$$;

revoke all on function public.admin_close_legal_matter(uuid,integer,uuid,text)
from public, anon, authenticated;
grant execute on function public.admin_close_legal_matter(uuid,integer,uuid,text)
to service_role;

comment on function public.admin_close_legal_matter(uuid,integer,uuid,text)
is 'Closes a canonical legal matter using legal.close, optimistic versioning and a mandatory outcome.';