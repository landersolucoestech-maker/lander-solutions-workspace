-- Canonical corporate ownership reconciliation.
-- Reuses the existing capital, ownership, governance and resolution tables.

alter table public.corporate_ownership_changes
  add column if not exists decision_reason text;

comment on column public.corporate_ownership_changes.decision_reason is
  'Independent approval or rejection reason.';

alter table public.governance_documents
  drop constraint if exists governance_documents_subject_check;
alter table public.governance_documents
  add constraint governance_documents_subject_check
  check (num_nonnulls(asset_id, legal_matter_id, compliance_obligation_id) <= 1);

create table if not exists public.corporate_capital_contributions (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.legal_entities(id) on delete restrict,
  capital_structure_id uuid not null references public.corporate_capital_structures(id) on delete restrict,
  ownership_change_id uuid not null references public.corporate_ownership_changes(id) on delete restrict,
  change_line_id uuid not null unique references public.corporate_ownership_change_lines(id) on delete restrict,
  holder_party_id uuid not null references public.parties(id) on delete restrict,
  share_class_id uuid references public.corporate_share_classes(id) on delete restrict,
  amount numeric(24,8) not null check (amount > 0),
  currency_code text not null references public.currencies(code) on delete restrict,
  contributed_on date not null,
  contribution_type text not null default 'cash'
    check (contribution_type in ('cash','asset','service','conversion','other')),
  status text not null default 'confirmed'
    check (status in ('confirmed','reversed')),
  evidence_document_id uuid not null references public.governance_documents(id) on delete restrict,
  notes text,
  reversed_by uuid references auth.users(id) on delete set null,
  reversed_at timestamptz,
  reversal_reason text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_capital_contributions_reversal_check check (
    status <> 'reversed'
    or (reversed_by is not null and reversed_at is not null and nullif(btrim(reversal_reason),'') is not null)
  )
);

create index if not exists corporate_capital_contributions_entity_date_idx
  on public.corporate_capital_contributions(legal_entity_id, contributed_on desc);
create index if not exists corporate_capital_contributions_holder_idx
  on public.corporate_capital_contributions(holder_party_id, contributed_on desc);
create unique index if not exists corporate_ownership_positions_current_unique
  on public.corporate_ownership_positions(capital_structure_id, share_class_id, holder_party_id)
  where status='active' and effective_to is null;

alter table public.corporate_capital_contributions enable row level security;

drop trigger if exists corporate_capital_contributions_touch on public.corporate_capital_contributions;
create trigger corporate_capital_contributions_touch
before update on public.corporate_capital_contributions
for each row execute function private.touch_updated_at();

drop trigger if exists corporate_capital_contributions_audit on public.corporate_capital_contributions;
create trigger corporate_capital_contributions_audit
after insert or update or delete on public.corporate_capital_contributions
for each row execute function private.audit_row_change();

drop function if exists private.set_corporate_position_quantity(uuid,uuid,date,numeric,uuid,uuid);

create or replace function private.result_share_class_id(
  p_result_structure_id uuid,
  p_source_share_class_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_result uuid;
begin
  select result_class.id
  into v_result
  from public.corporate_share_classes source_class
  join public.corporate_share_classes result_class
    on result_class.code=source_class.code
   and result_class.capital_structure_id=p_result_structure_id
  where source_class.id=p_source_share_class_id;

  if v_result is null then
    raise exception 'Classe societária não pertence à origem ou não foi clonada.';
  end if;
  return v_result;
end;
$$;

create or replace function private.adjust_draft_corporate_position(
  p_capital_structure_id uuid,
  p_share_class_id uuid,
  p_holder_party_id uuid,
  p_quota_delta numeric,
  p_acquisition_method text,
  p_effective_on date,
  p_evidence_document_id uuid,
  p_notes text,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_position public.corporate_ownership_positions;
  v_new_quantity numeric(24,8);
  v_result_id uuid;
begin
  if p_quota_delta=0 then
    raise exception 'Ajuste de posição exige quantidade diferente de zero.';
  end if;
  if p_holder_party_id is null or p_share_class_id is null then
    raise exception 'Titular e classe de quotas são obrigatórios.';
  end if;
  if p_acquisition_method not in ('subscription','transfer','capitalization','inheritance','conversion','adjustment') then
    raise exception 'Método de aquisição societária inválido.';
  end if;
  if not exists (
    select 1 from public.corporate_capital_structures structure
    where structure.id=p_capital_structure_id and structure.status='draft'
  ) then
    raise exception 'Posições somente podem ser compostas em estrutura em rascunho.';
  end if;
  if not exists (
    select 1 from public.corporate_share_classes share_class
    where share_class.id=p_share_class_id
      and share_class.capital_structure_id=p_capital_structure_id
      and share_class.status='active'
  ) then
    raise exception 'Classe de quotas inválida para a estrutura de destino.';
  end if;

  select * into v_position
  from public.corporate_ownership_positions position
  where position.capital_structure_id=p_capital_structure_id
    and position.share_class_id=p_share_class_id
    and position.holder_party_id=p_holder_party_id
    and position.status='active'
    and position.effective_to is null
  for update;

  if found then
    v_new_quantity:=v_position.quota_quantity+p_quota_delta;
    if v_new_quantity<0 then
      raise exception 'Operação societária produziria saldo negativo.';
    elsif v_new_quantity=0 then
      delete from public.corporate_ownership_positions where id=v_position.id;
      return null;
    end if;

    update public.corporate_ownership_positions
    set quota_quantity=v_new_quantity,
        acquisition_method=p_acquisition_method,
        effective_from=p_effective_on,
        evidence_document_id=p_evidence_document_id,
        notes=coalesce(p_notes,notes),
        updated_by=p_actor
    where id=v_position.id
    returning id into v_result_id;
    return v_result_id;
  end if;

  if p_quota_delta<0 then
    raise exception 'Titular não possui saldo para a operação.';
  end if;

  insert into public.corporate_ownership_positions (
    capital_structure_id,share_class_id,holder_party_id,quota_quantity,
    acquisition_method,effective_from,status,evidence_document_id,notes,
    created_by,updated_by
  ) values (
    p_capital_structure_id,p_share_class_id,p_holder_party_id,p_quota_delta,
    p_acquisition_method,p_effective_on,'active',p_evidence_document_id,p_notes,
    p_actor,p_actor
  ) returning id into v_result_id;

  return v_result_id;
end;
$$;

create or replace function private.enforce_corporate_ownership_change_transition()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_workflow_enabled boolean:=coalesce(current_setting('app.corporate_ownership_workflow',true),'off')='on';
begin
  if old.status=new.status then
    if old.status<>'draft'
       and (to_jsonb(new)-array['updated_at','updated_by','version'])
           is distinct from
           (to_jsonb(old)-array['updated_at','updated_by','version']) then
      raise exception 'Alteração societária fora de rascunho é imutável.';
    end if;
    return new;
  end if;

  if not v_workflow_enabled then
    raise exception 'Transição societária deve usar o workflow dedicado.' using errcode='42501';
  end if;

  if not (
    (old.status='draft' and new.status in ('submitted','cancelled'))
    or (old.status='submitted' and new.status in ('approved','rejected','cancelled'))
    or (old.status='approved' and new.status in ('applied','cancelled'))
    or (old.status='applied' and new.status='reversed')
  ) then
    raise exception 'Transição societária inválida: % -> %.',old.status,new.status;
  end if;

  if new.status='submitted' then
    new.decision_reason:=null;
  elsif new.status='approved' then
    new.approved_by:=coalesce(new.approved_by,auth.uid());
    new.approved_at:=coalesce(new.approved_at,now());
  elsif new.status='rejected' then
    if nullif(btrim(new.decision_reason),'') is null then
      raise exception 'Motivo da rejeição é obrigatório.';
    end if;
  elsif new.status='applied' then
    if new.effective_on is null or new.evidence_document_id is null then
      raise exception 'Vigência e evidência são obrigatórias.';
    end if;
    new.applied_by:=coalesce(new.applied_by,auth.uid());
    new.applied_at:=coalesce(new.applied_at,now());
  elsif new.status='reversed' then
    new.reversed_by:=coalesce(new.reversed_by,auth.uid());
    new.reversed_at:=coalesce(new.reversed_at,now());
    if nullif(btrim(new.reversal_reason),'') is null then
      raise exception 'Justificativa de reversão obrigatória.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.protect_corporate_ownership_history()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_parent_status text;
begin
  if tg_op='DELETE' then
    if tg_table_name='corporate_capital_structures' and old.status in ('approved','effective','superseded') then
      raise exception 'Estruturas aprovadas ou efetivadas não podem ser excluídas.';
    elsif tg_table_name='corporate_ownership_positions' then
      select status into v_parent_status from public.corporate_capital_structures where id=old.capital_structure_id;
      if v_parent_status<>'draft' then raise exception 'Posições consolidadas não podem ser excluídas.'; end if;
    elsif tg_table_name='corporate_ownership_roles' and old.status<>'cancelled' then
      raise exception 'Vínculos societários vigentes ou históricos não podem ser excluídos.';
    elsif tg_table_name='corporate_ownership_changes' and old.status<>'draft' then
      raise exception 'Alterações fora de rascunho não podem ser excluídas.';
    elsif tg_table_name='corporate_resolutions' and old.status in ('approved','applied') then
      raise exception 'Deliberações aprovadas ou aplicadas não podem ser excluídas.';
    elsif tg_table_name='corporate_ownership_change_lines' then
      select status into v_parent_status from public.corporate_ownership_changes where id=old.change_id;
      if v_parent_status<>'draft' then raise exception 'Linhas fora de rascunho são imutáveis.'; end if;
    end if;
    return old;
  end if;

  if tg_table_name='corporate_capital_structures' and old.status in ('effective','superseded') and (
    new.legal_entity_id is distinct from old.legal_entity_id
    or new.version_no is distinct from old.version_no
    or new.currency_code is distinct from old.currency_code
    or new.capital_amount is distinct from old.capital_amount
    or new.total_quotas is distinct from old.total_quotas
    or new.effective_from is distinct from old.effective_from
  ) then
    raise exception 'Estrutura efetivada não pode ser reescrita; crie nova versão.';
  end if;

  if tg_table_name='corporate_ownership_positions' then
    select status into v_parent_status from public.corporate_capital_structures where id=old.capital_structure_id;
    if v_parent_status<>'draft' and (
      new.capital_structure_id is distinct from old.capital_structure_id
      or new.share_class_id is distinct from old.share_class_id
      or new.holder_party_id is distinct from old.holder_party_id
      or new.quota_quantity is distinct from old.quota_quantity
      or new.effective_from is distinct from old.effective_from
      or new.status is distinct from old.status
      or new.effective_to is distinct from old.effective_to
    ) then
      raise exception 'Posição societária consolidada não pode ser reescrita.';
    end if;
  end if;

  if tg_table_name='corporate_ownership_roles' and old.status in ('active','ended') and old.effective_from<=current_date and (
    new.legal_entity_id is distinct from old.legal_entity_id
    or new.party_id is distinct from old.party_id
    or new.role_type is distinct from old.role_type
    or new.effective_from is distinct from old.effective_from
    or new.ultimate_ownership_percentage is distinct from old.ultimate_ownership_percentage
  ) then
    raise exception 'Vínculo societário vigente ou histórico não pode ser reescrito.';
  end if;

  if tg_table_name='corporate_ownership_change_lines' then
    select status into v_parent_status from public.corporate_ownership_changes where id=old.change_id;
    if v_parent_status<>'draft' then raise exception 'Linhas fora de rascunho são imutáveis.'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.submit_corporate_ownership_change(
  p_change_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_change public.corporate_ownership_changes;
  v_document public.governance_documents;
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  if not private.current_user_has_permission('corporate_ownership.manage',null) then
    raise exception 'Permissão corporate_ownership.manage obrigatória.' using errcode='42501';
  end if;

  select * into v_change
  from public.corporate_ownership_changes
  where id=p_change_id
  for update;

  if not found or v_change.version<>p_expected_version then return null; end if;
  if v_change.status<>'draft' then raise exception 'Somente rascunho pode ser submetido.'; end if;
  if v_change.requested_by<>v_actor then raise exception 'Somente o solicitante pode submeter o rascunho.'; end if;
  if nullif(btrim(v_change.justification),'') is null then raise exception 'Justificativa obrigatória.'; end if;
  if v_change.evidence_document_id is null then raise exception 'Evidência documental obrigatória.'; end if;

  select * into v_document
  from public.governance_documents
  where id=v_change.evidence_document_id;
  if not found or v_document.legal_entity_id<>v_change.legal_entity_id or v_document.status<>'active' then
    raise exception 'Evidência inválida, inativa ou de outra entidade.';
  end if;
  if v_document.checksum_sha256 is null and v_document.external_reference is null then
    raise exception 'Evidência exige checksum ou referência externa.';
  end if;

  if not exists (select 1 from public.corporate_ownership_change_lines line where line.change_id=v_change.id) then
    raise exception 'Inclua ao menos uma linha societária.';
  end if;

  if exists (
    select 1
    from public.corporate_ownership_change_lines line
    where line.change_id=v_change.id and (
      (line.operation_type='issue' and (line.quota_delta<=0 or line.holder_party_id is null or line.share_class_id is null))
      or (line.operation_type='transfer_out' and (line.quota_delta>=0 or line.holder_party_id is null or line.share_class_id is null))
      or (line.operation_type='transfer_in' and (line.quota_delta<=0 or line.holder_party_id is null or line.share_class_id is null))
      or (line.operation_type='cancel' and (line.quota_delta>=0 or line.share_class_id is null or (line.holder_party_id is null and line.source_position_id is null)))
      or (line.operation_type='increase' and (line.quota_delta<0 or line.capital_delta<0 or (line.quota_delta=0 and line.capital_delta=0)))
      or (line.operation_type='reduce' and (line.quota_delta>0 or line.capital_delta>0 or (line.quota_delta=0 and line.capital_delta=0)))
      or (line.operation_type='contribute' and (line.capital_delta<=0 or line.holder_party_id is null))
      or (line.operation_type='adjust' and (line.quota_delta=0 or line.share_class_id is null or (line.holder_party_id is null and line.source_position_id is null)))
      or (line.operation_type in ('role_add','role_end') and (
        line.holder_party_id is null
        or coalesce(line.details->>'role_type','') not in ('shareholder','administrator','director','officer','beneficial_owner','legal_representative')
      ))
    )
  ) then
    raise exception 'Uma ou mais linhas possuem semântica inválida.';
  end if;

  if exists (
    select 1
    from public.corporate_ownership_change_lines line
    where line.change_id=v_change.id and line.operation_type in ('transfer_out','transfer_in')
    group by line.share_class_id
    having sum(line.quota_delta)<>0
  ) then
    raise exception 'Transferências devem estar balanceadas por classe.';
  end if;

  if exists (
    select 1
    from public.corporate_ownership_change_lines line
    left join public.corporate_share_classes share_class on share_class.id=line.share_class_id
    where line.change_id=v_change.id
      and line.share_class_id is not null
      and (v_change.source_capital_structure_id is null or share_class.capital_structure_id<>v_change.source_capital_structure_id)
  ) then
    raise exception 'Classes informadas devem pertencer à estrutura de origem.';
  end if;

  if exists (
    select 1
    from public.corporate_ownership_change_lines line
    left join public.corporate_ownership_positions position on position.id=line.source_position_id
    where line.change_id=v_change.id
      and line.source_position_id is not null
      and (v_change.source_capital_structure_id is null or position.capital_structure_id<>v_change.source_capital_structure_id)
  ) then
    raise exception 'Posição informada não pertence à estrutura de origem.';
  end if;

  if exists (
    select 1 from public.corporate_ownership_change_lines line
    where line.change_id=v_change.id and line.operation_type not in ('role_add','role_end')
  ) and v_change.source_capital_structure_id is null then
    raise exception 'Operações de capital, quotas ou integralização exigem estrutura de origem.';
  end if;

  if v_change.source_capital_structure_id is not null and not exists (
    select 1 from public.corporate_capital_structures structure
    where structure.id=v_change.source_capital_structure_id
      and structure.legal_entity_id=v_change.legal_entity_id
      and structure.status in ('draft','effective')
  ) then
    raise exception 'Estrutura de capital de origem inválida.';
  end if;

  if v_change.change_type in (
    'incorporation','quota_issue','quota_transfer','capital_increase',
    'capital_reduction','share_class_change','administration_change'
  ) then
    if v_change.resolution_id is null or not exists (
      select 1 from public.corporate_resolutions resolution
      where resolution.id=v_change.resolution_id
        and resolution.legal_entity_id=v_change.legal_entity_id
        and resolution.status in ('approved','applied')
        and resolution.evidence_document_id is not null
    ) then
      raise exception 'A alteração exige deliberação aprovada da mesma entidade.';
    end if;
  end if;

  perform set_config('app.corporate_ownership_workflow','on',true);
  update public.corporate_ownership_changes
  set status='submitted',decision_reason=null,updated_by=v_actor
  where id=v_change.id and version=p_expected_version
  returning * into v_change;

  if not found then return null; end if;
  return to_jsonb(v_change);
end;
$$;

create or replace function public.decide_corporate_ownership_change(
  p_change_id uuid,
  p_expected_version bigint,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_change public.corporate_ownership_changes;
  v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  if not private.current_user_has_permission('corporate_ownership.apply_changes',null) then
    raise exception 'Permissão corporate_ownership.apply_changes obrigatória.' using errcode='42501';
  end if;

  select * into v_change
  from public.corporate_ownership_changes
  where id=p_change_id
  for update;

  if not found or v_change.version<>p_expected_version then return null; end if;
  if v_change.status<>'submitted' then raise exception 'Somente alteração submetida pode ser decidida.'; end if;
  if v_change.requested_by=v_actor then raise exception 'Solicitante não pode decidir a própria alteração.'; end if;
  if not p_approve and v_reason is null then raise exception 'Motivo da rejeição obrigatório.'; end if;

  perform set_config('app.corporate_ownership_workflow','on',true);
  update public.corporate_ownership_changes
  set status=case when p_approve then 'approved' else 'rejected' end,
      approved_by=case when p_approve then v_actor else null end,
      approved_at=case when p_approve then now() else null end,
      decision_reason=v_reason,
      updated_by=v_actor
  where id=v_change.id and version=p_expected_version
  returning * into v_change;

  if not found then return null; end if;
  return to_jsonb(v_change);
end;
$$;

create or replace function public.apply_corporate_ownership_change(
  p_change_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_change public.corporate_ownership_changes;
  v_source public.corporate_capital_structures;
  v_result public.corporate_capital_structures;
  v_line public.corporate_ownership_change_lines;
  v_source_position public.corporate_ownership_positions;
  v_source_class public.corporate_share_classes;
  v_result_class_id uuid;
  v_result_position_id uuid;
  v_role public.corporate_ownership_roles;
  v_holder uuid;
  v_role_type text;
  v_acquisition_method text;
  v_has_structural_lines boolean;
  v_use_source_in_place boolean:=false;
  v_quota_structure_delta numeric(24,8):=0;
  v_capital_structure_delta numeric(24,8):=0;
  v_next_version integer;
  v_document public.governance_documents;
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  if not private.current_user_has_permission('corporate_ownership.apply_changes',null) then
    raise exception 'Permissão corporate_ownership.apply_changes obrigatória.' using errcode='42501';
  end if;

  select * into v_change
  from public.corporate_ownership_changes
  where id=p_change_id
  for update;

  if not found or v_change.version<>p_expected_version then return null; end if;
  if v_change.status<>'approved' then raise exception 'Somente alteração aprovada pode ser aplicada.'; end if;
  if v_change.requested_by=v_actor or v_change.approved_by=v_actor then
    raise exception 'Solicitante e aprovador não podem executar a mesma alteração.';
  end if;

  select * into v_document from public.governance_documents where id=v_change.evidence_document_id;
  if not found or v_document.legal_entity_id<>v_change.legal_entity_id or v_document.status<>'active' then
    raise exception 'Evidência documental inválida para aplicação.';
  end if;

  select exists (
    select 1 from public.corporate_ownership_change_lines line
    where line.change_id=v_change.id
      and line.operation_type in ('issue','transfer_out','transfer_in','cancel','increase','reduce','adjust')
  ) into v_has_structural_lines;

  if v_has_structural_lines then
    select * into v_source
    from public.corporate_capital_structures
    where id=v_change.source_capital_structure_id
    for update;

    if not found or v_source.legal_entity_id<>v_change.legal_entity_id then
      raise exception 'Estrutura de capital de origem inválida.';
    end if;

    select coalesce(sum(case when operation_type in ('increase','reduce') then quota_delta else 0 end),0),
           coalesce(sum(case when operation_type in ('increase','reduce') then capital_delta else 0 end),0)
    into v_quota_structure_delta,v_capital_structure_delta
    from public.corporate_ownership_change_lines
    where change_id=v_change.id;

    if v_source.total_quotas+v_quota_structure_delta<=0 then raise exception 'Total de quotas resultante deve ser positivo.'; end if;
    if v_source.capital_amount+v_capital_structure_delta<0 then raise exception 'Capital resultante não pode ser negativo.'; end if;

    v_use_source_in_place:=v_change.change_type='incorporation'
      and v_source.status='draft'
      and not exists (
        select 1 from public.corporate_capital_structures structure
        where structure.legal_entity_id=v_change.legal_entity_id
          and structure.id<>v_source.id
          and structure.status in ('effective','superseded')
      );

    if v_use_source_in_place then
      update public.corporate_capital_structures
      set capital_amount=capital_amount+v_capital_structure_delta,
          total_quotas=total_quotas+v_quota_structure_delta,
          effective_from=v_change.effective_on,
          change_reason=v_change.justification,
          updated_by=v_actor
      where id=v_source.id
      returning * into v_result;
    else
      if v_source.status<>'effective' then
        raise exception 'Mudança posterior à constituição exige estrutura efetiva como origem.';
      end if;
      if v_change.effective_on<=v_source.effective_from then
        raise exception 'Vigência deve ser posterior à estrutura de origem.';
      end if;

      select coalesce(max(version_no),0)+1 into v_next_version
      from public.corporate_capital_structures
      where legal_entity_id=v_change.legal_entity_id;

      insert into public.corporate_capital_structures (
        legal_entity_id,version_no,currency_code,capital_amount,total_quotas,status,
        effective_from,change_reason,created_by,updated_by
      ) values (
        v_change.legal_entity_id,v_next_version,v_source.currency_code,
        v_source.capital_amount+v_capital_structure_delta,
        v_source.total_quotas+v_quota_structure_delta,
        'draft',v_change.effective_on,v_change.justification,v_actor,v_actor
      ) returning * into v_result;

      for v_source_class in
        select * from public.corporate_share_classes
        where capital_structure_id=v_source.id
        order by code
      loop
        insert into public.corporate_share_classes (
          capital_structure_id,code,name,description,authorized_quotas,voting_rights,
          votes_per_quota,distribution_priority,liquidation_priority,status,
          created_by,updated_by
        ) values (
          v_result.id,v_source_class.code,v_source_class.name,v_source_class.description,
          v_source_class.authorized_quotas,v_source_class.voting_rights,
          v_source_class.votes_per_quota,v_source_class.distribution_priority,
          v_source_class.liquidation_priority,v_source_class.status,v_actor,v_actor
        );
      end loop;

      for v_source_position in
        select * from public.corporate_ownership_positions
        where capital_structure_id=v_source.id
          and status='active' and effective_to is null
        order by id
      loop
        v_result_class_id:=private.result_share_class_id(v_result.id,v_source_position.share_class_id);
        insert into public.corporate_ownership_positions (
          capital_structure_id,share_class_id,holder_party_id,quota_quantity,
          acquisition_method,effective_from,status,evidence_document_id,notes,
          created_by,updated_by
        ) values (
          v_result.id,v_result_class_id,v_source_position.holder_party_id,
          v_source_position.quota_quantity,v_source_position.acquisition_method,
          v_change.effective_on,'active',v_change.evidence_document_id,
          'Posição transportada da versão societária anterior.',v_actor,v_actor
        );
      end loop;
    end if;

    for v_line in
      select * from public.corporate_ownership_change_lines
      where change_id=v_change.id
      order by sequence_no,id
    loop
      if v_line.operation_type not in ('issue','transfer_out','transfer_in','cancel','increase','reduce','adjust') then
        continue;
      end if;

      v_source_position:=null;
      if v_line.source_position_id is not null then
        select * into v_source_position
        from public.corporate_ownership_positions
        where id=v_line.source_position_id;
      end if;

      if v_line.share_class_id is not null then
        v_result_class_id:=case
          when v_use_source_in_place then v_line.share_class_id
          else private.result_share_class_id(v_result.id,v_line.share_class_id)
        end;
      elsif v_source_position.id is not null then
        v_result_class_id:=case
          when v_use_source_in_place then v_source_position.share_class_id
          else private.result_share_class_id(v_result.id,v_source_position.share_class_id)
        end;
      else
        v_result_class_id:=null;
      end if;

      v_holder:=coalesce(v_line.holder_party_id,v_source_position.holder_party_id);
      v_acquisition_method:=case
        when v_line.operation_type in ('transfer_out','transfer_in') then 'transfer'
        when v_line.operation_type in ('increase','issue') then coalesce(v_line.details->>'acquisition_method','subscription')
        else 'adjustment'
      end;

      if v_line.operation_type in ('increase','reduce') and v_result_class_id is not null and v_line.quota_delta<>0 then
        update public.corporate_share_classes
        set authorized_quotas=authorized_quotas+v_line.quota_delta,updated_by=v_actor
        where id=v_result_class_id and authorized_quotas+v_line.quota_delta>0;
        if not found then raise exception 'Operação produziria classe de quotas inválida.'; end if;
      end if;

      if v_line.operation_type in ('issue','transfer_out','transfer_in','cancel','adjust')
         or (v_line.operation_type in ('increase','reduce') and v_holder is not null and v_line.quota_delta<>0) then
        v_result_position_id:=private.adjust_draft_corporate_position(
          v_result.id,v_result_class_id,v_holder,v_line.quota_delta,
          v_acquisition_method,v_change.effective_on,v_change.evidence_document_id,
          coalesce(v_line.details->>'notes',v_change.code),v_actor
        );
      end if;
    end loop;

    if exists (
      select 1
      from public.corporate_ownership_positions position
      where position.capital_structure_id=v_result.id
        and position.status='active' and position.effective_to is null
      group by position.capital_structure_id
      having sum(position.quota_quantity)>v_result.total_quotas
    ) then
      raise exception 'Quotas atribuídas ultrapassam a estrutura resultante.';
    end if;

    update public.corporate_capital_structures
    set status='effective',approved_by=v_change.approved_by,approved_at=v_change.approved_at,
        applied_by=v_actor,applied_at=now(),updated_by=v_actor
    where id=v_result.id
    returning * into v_result;

    if not v_use_source_in_place then
      update public.corporate_capital_structures
      set status='superseded',effective_to=v_change.effective_on-1,
          applied_by=coalesce(applied_by,v_actor),applied_at=coalesce(applied_at,now()),updated_by=v_actor
      where id=v_source.id;
    end if;
  elsif v_change.source_capital_structure_id is not null then
    select * into v_result
    from public.corporate_capital_structures
    where id=v_change.source_capital_structure_id;
  end if;

  for v_line in
    select * from public.corporate_ownership_change_lines
    where change_id=v_change.id
    order by sequence_no,id
  loop
    if v_line.operation_type='contribute' then
      if v_result.id is null then raise exception 'Integralização exige estrutura de capital.'; end if;
      v_result_class_id:=case
        when v_line.share_class_id is null then null
        when exists (select 1 from public.corporate_share_classes c where c.id=v_line.share_class_id and c.capital_structure_id=v_result.id)
          then v_line.share_class_id
        else private.result_share_class_id(v_result.id,v_line.share_class_id)
      end;
      insert into public.corporate_capital_contributions (
        legal_entity_id,capital_structure_id,ownership_change_id,change_line_id,
        holder_party_id,share_class_id,amount,currency_code,contributed_on,
        contribution_type,status,evidence_document_id,notes,created_by,updated_by
      ) values (
        v_change.legal_entity_id,v_result.id,v_change.id,v_line.id,
        v_line.holder_party_id,v_result_class_id,v_line.capital_delta,v_result.currency_code,
        v_change.effective_on,coalesce(v_line.details->>'contribution_type','cash'),
        'confirmed',v_change.evidence_document_id,v_line.details->>'notes',v_actor,v_actor
      );
    elsif v_line.operation_type='role_add' then
      v_role_type:=v_line.details->>'role_type';
      if exists (
        select 1 from public.corporate_ownership_roles role
        where role.legal_entity_id=v_change.legal_entity_id
          and role.party_id=v_line.holder_party_id
          and role.role_type=v_role_type
          and role.status='active' and role.effective_to is null
      ) then raise exception 'Participante já possui vínculo ativo do mesmo tipo.'; end if;

      v_result_position_id:=null;
      if v_result.id is not null and v_line.share_class_id is not null then
        v_result_class_id:=case
          when exists (select 1 from public.corporate_share_classes c where c.id=v_line.share_class_id and c.capital_structure_id=v_result.id)
            then v_line.share_class_id
          else private.result_share_class_id(v_result.id,v_line.share_class_id)
        end;
        select position.id into v_result_position_id
        from public.corporate_ownership_positions position
        where position.capital_structure_id=v_result.id
          and position.share_class_id=v_result_class_id
          and position.holder_party_id=v_line.holder_party_id
          and position.status='active' and position.effective_to is null;
      end if;

      insert into public.corporate_ownership_roles (
        legal_entity_id,party_id,ownership_position_id,role_type,
        ultimate_ownership_percentage,effective_from,status,evidence_document_id,
        notes,created_by,updated_by
      ) values (
        v_change.legal_entity_id,v_line.holder_party_id,v_result_position_id,v_role_type,
        nullif(v_line.details->>'ultimate_ownership_percentage','')::numeric,
        v_change.effective_on,'active',v_change.evidence_document_id,
        v_line.details->>'notes',v_actor,v_actor
      );
    elsif v_line.operation_type='role_end' then
      v_role_type:=v_line.details->>'role_type';
      select * into v_role
      from public.corporate_ownership_roles role
      where role.legal_entity_id=v_change.legal_entity_id
        and role.party_id=v_line.holder_party_id
        and role.role_type=v_role_type
        and role.status='active' and role.effective_to is null
      order by role.effective_from desc
      limit 1
      for update;
      if not found then raise exception 'Vínculo ativo não encontrado para encerramento.'; end if;
      update public.corporate_ownership_roles
      set status='ended',effective_to=v_change.effective_on,updated_by=v_actor
      where id=v_role.id;
    end if;
  end loop;

  if v_change.resolution_id is not null then
    update public.corporate_resolutions
    set status='applied',updated_by=v_actor
    where id=v_change.resolution_id and status='approved';
  end if;

  perform set_config('app.corporate_ownership_workflow','on',true);
  update public.corporate_ownership_changes
  set status='applied',resulting_capital_structure_id=coalesce(v_result.id,v_change.source_capital_structure_id),
      applied_by=v_actor,applied_at=now(),updated_by=v_actor
  where id=v_change.id and version=p_expected_version
  returning * into v_change;

  if not found then return null; end if;
  return to_jsonb(v_change);
end;
$$;

revoke all on function private.result_share_class_id(uuid,uuid) from public,anon,authenticated;
revoke all on function private.adjust_draft_corporate_position(uuid,uuid,uuid,numeric,text,date,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.submit_corporate_ownership_change(uuid,bigint) from public,anon;
revoke all on function public.decide_corporate_ownership_change(uuid,bigint,boolean,text) from public,anon;
revoke all on function public.apply_corporate_ownership_change(uuid,bigint) from public,anon;
grant execute on function public.submit_corporate_ownership_change(uuid,bigint) to authenticated;
grant execute on function public.decide_corporate_ownership_change(uuid,bigint,boolean,text) to authenticated;
grant execute on function public.apply_corporate_ownership_change(uuid,bigint) to authenticated;

comment on function public.apply_corporate_ownership_change(uuid,bigint) is
  'Applies an independently approved change through an immutable capital-structure snapshot.';
