-- Block direct workflow transitions and preserve approved/published versions.

create or replace function private.enforce_policy_version_workflow()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if old.status is distinct from new.status
     and coalesce(current_setting('app.policy_workflow_transition',true),'') <> 'on' then
    raise exception 'Transição de status deve utilizar a operação de workflow da política.';
  end if;

  if old.status in ('approved','published','superseded')
     and to_jsonb(old)-array['status','approved_by','published_by','decision_reason','updated_at','version']::text[]
         is distinct from
         to_jsonb(new)-array['status','approved_by','published_by','decision_reason','updated_at','version']::text[] then
    raise exception 'Versão aprovada ou publicada é imutável.';
  end if;
  return new;
end;
$$;

drop trigger if exists corporate_policy_versions_enforce_workflow on public.corporate_policy_versions;
create trigger corporate_policy_versions_enforce_workflow
before update on public.corporate_policy_versions
for each row execute function private.enforce_policy_version_workflow();

comment on function private.enforce_policy_version_workflow()
is 'Blocks direct policy version status changes and content mutation after approval/publication.';
