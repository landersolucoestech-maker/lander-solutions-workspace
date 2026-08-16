-- Caller-scoped legal close operation. The actor is derived from auth.uid().

create or replace function public.close_legal_matter(
  p_matter_id uuid,
  p_expected_version integer,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_matter public.legal_matters;
  v_unit_code text;
begin
  if v_actor_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  select * into v_matter
  from public.legal_matters
  where id = p_matter_id
  for update;

  if not found or v_matter.version <> p_expected_version then
    return null;
  end if;

  v_unit_code := private.governance_unit_code(v_matter.business_unit_id);
  if not private.current_user_has_permission('legal.close', v_unit_code) then
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

revoke all on function public.close_legal_matter(uuid,integer,text)
from public, anon;
grant execute on function public.close_legal_matter(uuid,integer,text)
to authenticated;

comment on function public.close_legal_matter(uuid,integer,text)
is 'Caller-scoped legal matter closure. Uses auth.uid(), legal.close and optimistic versioning.';