-- Allow corporate ownership administrators to maintain entity-level evidence and
-- require independent approval for corporate resolutions.

create or replace function private.enforce_corporate_resolution_workflow()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_workflow boolean:=coalesce(current_setting('app.corporate_resolution_workflow',true),'off')='on';
begin
  if old.status=new.status then
    if old.status<>'draft'
       and (to_jsonb(new)-array['updated_at','updated_by','version'])
           is distinct from
           (to_jsonb(old)-array['updated_at','updated_by','version']) then
      raise exception 'Deliberação aprovada ou aplicada é imutável.';
    end if;
    return new;
  end if;

  if old.status='draft' and new.status='approved' then
    if not v_workflow then
      raise exception 'A aprovação deve usar o workflow societário.' using errcode='42501';
    end if;
    new.approved_by:=coalesce(new.approved_by,auth.uid());
    new.approved_at:=coalesce(new.approved_at,now());
  elsif old.status='approved' and new.status='applied' then
    if not private.current_user_has_aal2()
       or not private.current_user_has_permission('corporate_ownership.apply_changes',null) then
      raise exception 'Aplicação da deliberação exige MFA e permissão societária.' using errcode='42501';
    end if;
  else
    raise exception 'Transição de deliberação inválida: % -> %.',old.status,new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists corporate_resolutions_enforce_workflow on public.corporate_resolutions;
create trigger corporate_resolutions_enforce_workflow
before update on public.corporate_resolutions
for each row execute function private.enforce_corporate_resolution_workflow();

create or replace function public.approve_corporate_resolution(
  p_resolution_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_resolution public.corporate_resolutions;
  v_document public.governance_documents;
begin
  if v_actor is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
  if not private.current_user_has_aal2() then raise exception 'MFA aal2 obrigatório.' using errcode='42501'; end if;
  if not private.current_user_has_permission('corporate_ownership.apply_changes',null) then
    raise exception 'Permissão corporate_ownership.apply_changes obrigatória.' using errcode='42501';
  end if;

  select * into v_resolution
  from public.corporate_resolutions
  where id=p_resolution_id
  for update;

  if not found or v_resolution.version<>p_expected_version then return null; end if;
  if v_resolution.status<>'draft' then raise exception 'Somente deliberação em rascunho pode ser aprovada.'; end if;
  if v_resolution.created_by=v_actor then raise exception 'O autor não pode aprovar a própria deliberação.'; end if;
  if v_resolution.evidence_document_id is null then raise exception 'Evidência documental obrigatória.'; end if;

  select * into v_document
  from public.governance_documents
  where id=v_resolution.evidence_document_id;
  if not found or v_document.legal_entity_id<>v_resolution.legal_entity_id or v_document.status<>'active' then
    raise exception 'Evidência documental inválida, inativa ou de outra entidade.';
  end if;
  if v_document.checksum_sha256 is null and v_document.external_reference is null then
    raise exception 'Evidência exige checksum ou referência externa.';
  end if;

  perform set_config('app.corporate_resolution_workflow','on',true);
  update public.corporate_resolutions
  set status='approved',approved_by=v_actor,approved_at=now(),updated_by=v_actor
  where id=v_resolution.id and version=p_expected_version
  returning * into v_resolution;

  if not found then return null; end if;
  return to_jsonb(v_resolution);
end;
$$;

revoke all on function public.approve_corporate_resolution(uuid,bigint) from public,anon;
grant execute on function public.approve_corporate_resolution(uuid,bigint) to authenticated;

drop policy if exists corporate_resolutions_manage on public.corporate_resolutions;
drop policy if exists corporate_resolutions_draft_manage on public.corporate_resolutions;
create policy corporate_resolutions_draft_manage on public.corporate_resolutions
for all to authenticated
using (
  status='draft'
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
)
with check (
  status='draft'
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);

drop policy if exists governance_documents_corporate_ownership_insert on public.governance_documents;
create policy governance_documents_corporate_ownership_insert on public.governance_documents
for insert to authenticated with check (
  num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and created_by=auth.uid()
);

drop policy if exists governance_documents_corporate_ownership_update on public.governance_documents;
create policy governance_documents_corporate_ownership_update on public.governance_documents
for update to authenticated
using (
  num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
  and status in ('draft','active')
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
)
with check (
  num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
  and status in ('draft','active')
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
);

drop policy if exists governance_documents_corporate_ownership_delete on public.governance_documents;
create policy governance_documents_corporate_ownership_delete on public.governance_documents
for delete to authenticated using (
  num_nonnulls(asset_id,legal_matter_id,compliance_obligation_id)=0
  and status in ('draft','cancelled')
  and private.current_user_has_aal2()
  and private.current_user_has_permission('corporate_ownership.manage',null)
  and not exists (select 1 from public.corporate_ownership_changes ownership_change where ownership_change.evidence_document_id=governance_documents.id)
  and not exists (select 1 from public.corporate_resolutions resolution where resolution.evidence_document_id=governance_documents.id)
  and not exists (select 1 from public.corporate_ownership_positions position where position.evidence_document_id=governance_documents.id)
  and not exists (select 1 from public.corporate_ownership_roles ownership_role where ownership_role.evidence_document_id=governance_documents.id)
  and not exists (select 1 from public.corporate_capital_contributions contribution where contribution.evidence_document_id=governance_documents.id)
);

grant select,insert,update,delete on public.governance_documents to authenticated;
