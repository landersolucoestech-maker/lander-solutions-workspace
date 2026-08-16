-- Caller-scoped allocation workflow.
-- Existing admin allocation functions remain owner-only implementation details.

insert into public.permissions(code,module,action,description)
values
  ('allocation.read','allocation','read','Consultar regras e execuções de rateio.'),
  ('allocation.manage','allocation','manage','Administrar regras e simulações de rateio.'),
  ('allocation.approve','allocation','approve','Aprovar versões e execuções de rateio.'),
  ('allocation.post','allocation','post','Postar execuções de rateio.'),
  ('allocation.reverse','allocation','reverse','Reverter execuções de rateio postadas.')
on conflict (code) do update set
  module=excluded.module,
  action=excluded.action,
  description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select distinct role_permission.role_id,reverse_permission.id
from public.role_permissions role_permission
join public.permissions source_permission on source_permission.id=role_permission.permission_id
join public.permissions reverse_permission on reverse_permission.code='allocation.reverse'
where source_permission.code in ('allocation.post','allocation.manage')
on conflict do nothing;

create or replace function private.allocation_admin_function(p_action text)
returns regprocedure
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_oid oid;
  v_count integer;
begin
  select min(procedure.oid),count(*)
  into v_oid,v_count
  from pg_proc procedure
  join pg_namespace schema_row on schema_row.oid=procedure.pronamespace
  where schema_row.nspname='public'
    and procedure.proname like 'admin\_%' escape '\'
    and procedure.proname like '%allocation%'
    and (
      (p_action='submit-version' and procedure.proname like '%submit%' and procedure.proname like '%version%' and procedure.proname not like '%run%')
      or (p_action in ('approve-version','reject-version') and procedure.proname like '%decide%' and procedure.proname like '%version%' and procedure.proname not like '%run%')
      or (p_action='simulate-run' and procedure.proname like '%simulate%' and procedure.proname like '%run%')
      or (p_action='submit-run' and procedure.proname like '%submit%' and procedure.proname like '%run%')
      or (p_action in ('approve-run','reject-run') and procedure.proname like '%decide%' and procedure.proname like '%run%')
      or (p_action='post-run' and procedure.proname like '%post%' and procedure.proname like '%run%')
      or (p_action='reverse-run' and procedure.proname like '%reverse%' and procedure.proname like '%run%')
    );

  if v_count<>1 then
    raise exception 'Ação de rateio % encontrou % funções administrativas.',p_action,v_count;
  end if;
  return v_oid::regprocedure;
end;
$$;

create or replace function public.run_allocation_workflow(
  p_action text,
  p_record_id uuid,
  p_expected_version integer,
  p_reason text default null,
  p_reversal_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_permission text;
  v_procedure regprocedure;
  v_oid oid;
  v_names text[];
  v_nargs integer;
  v_index integer;
  v_argument text;
  v_placeholder text;
  v_call text;
  v_result jsonb;
  v_approve boolean;
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  if p_action not in (
    'submit-version','approve-version','reject-version','simulate-run','submit-run',
    'approve-run','reject-run','post-run','reverse-run'
  ) then raise exception 'Ação de rateio inválida.'; end if;
  if p_record_id is null or p_expected_version<1 then raise exception 'Registro ou versão de rateio inválida.'; end if;

  v_permission:=case
    when p_action in ('submit-version','simulate-run','submit-run') then 'allocation.manage'
    when p_action in ('approve-version','reject-version','approve-run','reject-run') then 'allocation.approve'
    when p_action='post-run' then 'allocation.post'
    when p_action='reverse-run' then 'allocation.reverse'
  end;
  if not private.current_user_has_permission(v_permission,null) then
    raise exception 'Permissão % obrigatória.',v_permission using errcode='42501';
  end if;
  if p_action in ('reject-version','reject-run','reverse-run')
     and nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'Motivo obrigatório para rejeição ou reversão.';
  end if;
  if p_action='reverse-run' and p_reversal_date is null then
    raise exception 'Data da reversão obrigatória.';
  end if;

  v_approve:=p_action in ('approve-version','approve-run');
  v_procedure:=private.allocation_admin_function(p_action);
  v_oid:=v_procedure::oid;
  select procedure.proargnames,procedure.pronargs
  into v_names,v_nargs
  from pg_proc procedure where procedure.oid=v_oid;

  if v_names is null or array_length(v_names,1)<v_nargs then
    raise exception 'A função administrativa de rateio não possui argumentos nomeados.';
  end if;

  v_call:=format('select %s(',v_procedure::text);
  for v_index in 1..v_nargs loop
    v_argument:=v_names[v_index];
    v_placeholder:=case
      when v_argument like '%expected%version%' then '$2'
      when v_argument like '%actor%user%id%' or v_argument in ('p_actor','actor_user_id') then '$3'
      when v_argument like '%approve%' then '$4'
      when v_argument like '%reason%' then '$5'
      when v_argument like '%reversal%date%' or v_argument like '%reversed%on%' then '$6'
      when v_argument like '%run%id%' and v_argument not like '%actor%' then '$1'
      when v_argument like '%version%id%' and v_argument not like '%expected%' then '$1'
      when v_argument like '%rule%id%' and p_action like '%version%' then '$1'
      else null
    end;
    if v_placeholder is null then
      raise exception 'Argumento administrativo de rateio não reconhecido: %.',v_argument;
    end if;
    if v_index>1 then v_call:=v_call||','; end if;
    v_call:=v_call||format('%I => %s',v_argument,v_placeholder);
  end loop;
  v_call:=v_call||')';

  execute v_call into v_result
  using p_record_id,p_expected_version,v_actor,v_approve,nullif(btrim(coalesce(p_reason,'')),''),p_reversal_date;
  return v_result;
end;
$$;

revoke all on function private.allocation_admin_function(text) from public,anon,authenticated,service_role;
revoke all on function public.run_allocation_workflow(text,uuid,integer,text,date) from public,anon;
grant execute on function public.run_allocation_workflow(text,uuid,integer,text,date) to authenticated;

do $$
declare
  v_function regprocedure;
  v_table text;
begin
  foreach v_function in array array[
    private.allocation_admin_function('submit-version'),
    private.allocation_admin_function('approve-version'),
    private.allocation_admin_function('simulate-run'),
    private.allocation_admin_function('submit-run'),
    private.allocation_admin_function('approve-run'),
    private.allocation_admin_function('post-run'),
    private.allocation_admin_function('reverse-run')
  ] loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',v_function::text);
  end loop;

  for v_table in
    select table_name
    from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE' and table_name like 'allocation\_%' escape '\'
  loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('drop policy if exists dev_public_read on public.%I',v_table);
    execute format('revoke all on public.%I from anon',v_table);
  end loop;
end;
$$;

comment on function public.run_allocation_workflow(text,uuid,integer,text,date) is
  'Caller-scoped dispatcher for allocation version and run workflows.';
