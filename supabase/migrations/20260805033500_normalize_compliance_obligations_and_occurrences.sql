-- Normalize Compliance and Policies domain boundaries.
-- Obligations are permanent rules; occurrences are concrete executions.

do $$
begin
  if to_regclass('public.compliance_obligations') is null
     or to_regclass('public.compliance_occurrences') is null then
    raise exception 'Estruturas de compliance não encontradas.';
  end if;
end;
$$;

insert into public.permissions (code,module,action,description)
values
  ('compliance.complete','compliance','complete','Concluir ocorrência de compliance com evidência.'),
  ('compliance.waive','compliance','waive','Dispensar ocorrência de compliance com justificativa.')
on conflict (code) do update
set module=excluded.module, action=excluded.action, description=excluded.description;

insert into public.role_permissions (role_id,permission_id)
select distinct rp.role_id,target.id
from public.role_permissions rp
join public.permissions source on source.id=rp.permission_id
join public.permissions target on target.code='compliance.complete'
where source.code='compliance.manage'
on conflict do nothing;

insert into public.role_permissions (role_id,permission_id)
select distinct rp.role_id,target.id
from public.role_permissions rp
join public.permissions source on source.id=rp.permission_id
join public.permissions target on target.code='compliance.waive'
where source.code in ('compliance.approve','compliance.manage')
on conflict do nothing;

alter table public.compliance_obligations
  add column if not exists intellectual_property_asset_id uuid,
  add constraint compliance_obligations_ip_asset_fkey
    foreign key (intellectual_property_asset_id)
    references public.intellectual_property_assets(id) on delete restrict;

update public.compliance_obligations
set category = case
      when category='security' then 'information_security'
      when nullif(btrim(category),'') is not null then category
      else obligation_type
    end,
    description = case
      when nullif(btrim(description),'') is null then requirement_summary
      when nullif(btrim(requirement_summary),'') is null or description=requirement_summary then description
      else description || E'\n\nRequisito: ' || requirement_summary
    end,
    first_due_date = coalesce(first_due_date,due_date),
    next_due_date = coalesce(next_due_date,due_date),
    notes = concat_ws(
      E'\n',
      nullif(notes,''),
      'Status operacional anterior à normalização: ' || status,
      case when completed_at is not null then 'Conclusão histórica da obrigação: ' || completed_at::text end,
      case when evidence_reference is not null then 'Evidência histórica da obrigação: ' || evidence_reference end
    ),
    status = case
      when status='cancelled' then 'archived'
      when status='planned' then 'draft'
      else 'active'
    end;

alter table public.compliance_obligations
  alter column description set not null,
  drop constraint compliance_obligations_obligation_type_check,
  drop constraint compliance_obligations_status_check,
  add constraint compliance_obligations_category_check
    check (category in (
      'corporate','tax','accounting','labor','privacy','information_security',
      'license','insurance','intellectual_property','contractual','regulatory','other'
    )),
  add constraint compliance_obligations_status_check
    check (status in ('draft','active','inactive','archived')),
  add constraint compliance_obligations_due_dates_check
    check (next_due_date is null or first_due_date is null or next_due_date >= first_due_date);

alter table public.compliance_obligations
  drop column obligation_type,
  drop column due_date,
  drop column completed_at,
  drop column evidence_reference,
  drop column requirement_summary;

alter table public.compliance_occurrences
  add column if not exists responsible_user_id uuid references public.profiles(id) on delete restrict,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references public.profiles(id) on delete restrict,
  add column if not exists waived_at timestamptz,
  add column if not exists waived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists created_by uuid references public.profiles(id) on delete restrict;

update public.compliance_occurrences occurrence
set responsible_user_id = coalesce(occurrence.responsible_user_id,obligation.responsible_user_id),
    completed_at = case when occurrence.status in ('completed','compliant') then coalesce(occurrence.completed_at,occurrence.updated_at) else occurrence.completed_at end,
    completed_by = case when occurrence.status in ('completed','compliant') then coalesce(occurrence.completed_by,obligation.responsible_user_id,obligation.created_by) else occurrence.completed_by end,
    waived_at = case when occurrence.status='waived' then coalesce(occurrence.waived_at,occurrence.updated_at) else occurrence.waived_at end,
    waived_by = case when occurrence.status='waived' then coalesce(occurrence.waived_by,obligation.responsible_user_id,obligation.created_by) else occurrence.waived_by end,
    created_by = coalesce(occurrence.created_by,obligation.created_by),
    status = case when occurrence.status='compliant' then 'completed' else occurrence.status end
from public.compliance_obligations obligation
where obligation.id=occurrence.compliance_obligation_id;

alter table public.compliance_occurrences
  alter column created_by set default auth.uid(),
  alter column created_by set not null,
  add constraint compliance_occurrences_status_check
    check (status in ('pending','in_progress','completed','overdue','waived','cancelled')),
  add constraint compliance_occurrences_reference_dates_check
    check (reference_end is null or reference_start is null or reference_end >= reference_start),
  add constraint compliance_occurrences_completion_check
    check (
      (status='completed' and completed_at is not null and completed_by is not null)
      or status<>'completed'
    ),
  add constraint compliance_occurrences_waiver_check
    check (
      (status='waived' and waived_at is not null and waived_by is not null and char_length(btrim(waiver_reason)) >= 3)
      or status<>'waived'
    );

create index if not exists compliance_occurrences_due_status_idx
  on public.compliance_occurrences(due_date,status);
create index if not exists compliance_obligations_ip_asset_idx
  on public.compliance_obligations(intellectual_property_asset_id)
  where intellectual_property_asset_id is not null;

create or replace function private.enforce_compliance_occurrence_transition()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_unit_code text;
begin
  select private.governance_unit_code(o.business_unit_id)
  into v_unit_code
  from public.compliance_obligations o
  where o.id=new.compliance_obligation_id;

  if old.status is distinct from new.status then
    if new.status='completed'
       and not private.current_user_has_permission('compliance.complete',v_unit_code) then
      raise exception 'Permissão insuficiente para concluir ocorrência.' using errcode='42501';
    elsif new.status='waived'
       and not private.current_user_has_permission('compliance.waive',v_unit_code) then
      raise exception 'Permissão insuficiente para dispensar ocorrência.' using errcode='42501';
    elsif new.status not in ('completed','waived')
       and not private.current_user_has_permission('compliance.manage',v_unit_code) then
      raise exception 'Permissão insuficiente para alterar ocorrência.' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger compliance_occurrences_enforce_transition
before update on public.compliance_occurrences
for each row execute function private.enforce_compliance_occurrence_transition();

create or replace function public.complete_compliance_occurrence(
  p_occurrence_id uuid,
  p_expected_version integer,
  p_evidence_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_occurrence public.compliance_occurrences;
  v_obligation public.compliance_obligations;
  v_unit_code text;
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;

  select * into v_occurrence
  from public.compliance_occurrences
  where id=p_occurrence_id
  for update;
  if not found or v_occurrence.version<>p_expected_version then return null; end if;

  select * into v_obligation
  from public.compliance_obligations
  where id=v_occurrence.compliance_obligation_id;

  v_unit_code:=private.governance_unit_code(v_obligation.business_unit_id);
  if not private.current_user_has_permission('compliance.complete',v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode='42501';
  end if;
  if v_occurrence.status not in ('pending','in_progress','overdue') then
    raise exception 'Ocorrência não pode ser concluída.';
  end if;
  if v_obligation.evidence_required
     and coalesce(nullif(btrim(p_evidence_reference),''),v_occurrence.evidence_reference) is null then
    raise exception 'Evidência obrigatória.';
  end if;

  update public.compliance_occurrences
  set status='completed',
      evidence_reference=coalesce(nullif(btrim(p_evidence_reference),''),evidence_reference),
      notes=coalesce(nullif(btrim(p_notes),''),notes),
      completed_at=now(),
      completed_by=v_actor
  where id=v_occurrence.id and version=p_expected_version
  returning * into v_occurrence;

  if not found then return null; end if;
  return to_jsonb(v_occurrence);
end;
$$;

create or replace function public.waive_compliance_occurrence(
  p_occurrence_id uuid,
  p_expected_version integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_occurrence public.compliance_occurrences;
  v_unit_code text;
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;

  select * into v_occurrence
  from public.compliance_occurrences
  where id=p_occurrence_id
  for update;
  if not found or v_occurrence.version<>p_expected_version then return null; end if;

  select private.governance_unit_code(o.business_unit_id)
  into v_unit_code
  from public.compliance_obligations o
  where o.id=v_occurrence.compliance_obligation_id;

  if not private.current_user_has_permission('compliance.waive',v_unit_code) then
    raise exception 'Permissão insuficiente.' using errcode='42501';
  end if;
  if v_occurrence.status not in ('pending','in_progress','overdue') then
    raise exception 'Ocorrência não pode ser dispensada.';
  end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'Motivo da dispensa obrigatório.';
  end if;

  update public.compliance_occurrences
  set status='waived',
      waiver_reason=btrim(p_reason),
      waived_at=now(),
      waived_by=v_actor
  where id=v_occurrence.id and version=p_expected_version
  returning * into v_occurrence;

  if not found then return null; end if;
  return to_jsonb(v_occurrence);
end;
$$;

revoke all on function public.complete_compliance_occurrence(uuid,integer,text,text) from public,anon;
revoke all on function public.waive_compliance_occurrence(uuid,integer,text) from public,anon;
grant execute on function public.complete_compliance_occurrence(uuid,integer,text,text) to authenticated;
grant execute on function public.waive_compliance_occurrence(uuid,integer,text) to authenticated;

-- Explicit RLS boundaries.
drop policy if exists compliance_occurrences_all on public.compliance_occurrences;
create policy compliance_occurrences_read
on public.compliance_occurrences for select to authenticated
using (
  exists (
    select 1 from public.compliance_obligations o
    where o.id=compliance_occurrences.compliance_obligation_id
      and (
        private.current_user_has_permission('compliance.read',private.governance_unit_code(o.business_unit_id))
        or private.current_user_has_permission('compliance.manage',private.governance_unit_code(o.business_unit_id))
        or private.current_user_has_permission('compliance.complete',private.governance_unit_code(o.business_unit_id))
        or private.current_user_has_permission('compliance.waive',private.governance_unit_code(o.business_unit_id))
      )
  )
);
create policy compliance_occurrences_manage
on public.compliance_occurrences for all to authenticated
using (
  exists (
    select 1 from public.compliance_obligations o
    where o.id=compliance_occurrences.compliance_obligation_id
      and private.current_user_has_permission('compliance.manage',private.governance_unit_code(o.business_unit_id))
  )
)
with check (
  exists (
    select 1 from public.compliance_obligations o
    where o.id=compliance_occurrences.compliance_obligation_id
      and private.current_user_has_permission('compliance.manage',private.governance_unit_code(o.business_unit_id))
  )
);

drop policy if exists dev_public_read on public.compliance_obligations;
drop policy if exists dev_public_read on public.compliance_occurrences;
drop policy if exists dev_public_read on public.corporate_policies;
drop policy if exists dev_public_read on public.corporate_policy_versions;

revoke all on public.compliance_obligations from anon;
revoke all on public.compliance_occurrences from anon;
revoke all on public.corporate_policies from anon;
revoke all on public.corporate_policy_versions from anon;

do $$
begin
  if exists (
    select 1 from public.compliance_occurrences c
    left join public.compliance_obligations o on o.id=c.compliance_obligation_id
    where o.id is null
  ) then raise exception 'Existem ocorrências de compliance órfãs.'; end if;

  if exists (
    select 1 from public.compliance_obligations o
    left join public.intellectual_property_assets ip on ip.id=o.intellectual_property_asset_id
    where o.intellectual_property_asset_id is not null and ip.id is null
  ) then raise exception 'Existe obrigação vinculada a ativo de PI inexistente.'; end if;
end;
$$;

comment on table public.compliance_obligations
is 'Permanent legal, regulatory, fiscal, labor, contractual, privacy, security, licensing, insurance or IP-related requirement.';
comment on table public.compliance_occurrences
is 'Concrete execution of a compliance obligation for a reference period and due date.';
comment on column public.compliance_obligations.intellectual_property_asset_id
is 'Optional reference to the canonical IP asset; the obligation never duplicates the mark or right.';