-- Preserve the roles that could effectively post and reverse through the former
-- allocation.approve Edge check while separating the workflow permissions.
insert into public.role_permissions(role_id,permission_id)
select distinct source.role_id,target.id
from public.role_permissions source
join public.permissions source_permission on source_permission.id=source.permission_id
cross join public.permissions target
where source_permission.code='allocation.approve'
  and target.code in ('allocation.post','allocation.reverse')
on conflict do nothing;

-- The caller-scoped dispatcher already enforces allocation.post/reverse. Its
-- owner-only implementations must enforce the same contract at the unit scope.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.admin_post_allocation_run(uuid,integer,uuid)'::regprocedure
  ) into v_definition;
  if position('''allocation.approve''' in v_definition)=0 then
    raise exception 'admin_post_allocation_run permission contract drifted';
  end if;
  execute replace(v_definition,'''allocation.approve''','''allocation.post''');

  select pg_get_functiondef(
    'public.admin_reverse_allocation_run(uuid,integer,date,text,uuid)'::regprocedure
  ) into v_definition;
  if position('''allocation.approve''' in v_definition)=0 then
    raise exception 'admin_reverse_allocation_run permission contract drifted';
  end if;
  execute replace(v_definition,'''allocation.approve''','''allocation.reverse''');
end;
$$;

revoke all on function public.admin_post_allocation_run(uuid,integer,uuid)
from public,anon,authenticated;
revoke all on function public.admin_reverse_allocation_run(uuid,integer,date,text,uuid)
from public,anon,authenticated;
grant execute on function public.admin_post_allocation_run(uuid,integer,uuid) to service_role;
grant execute on function public.admin_reverse_allocation_run(uuid,integer,date,text,uuid)
to service_role;

comment on function public.admin_post_allocation_run(uuid,integer,uuid) is
  'Owner-only posting implementation. Requires allocation.post; callers use run_allocation_workflow.';
comment on function public.admin_reverse_allocation_run(uuid,integer,date,text,uuid) is
  'Owner-only reversal implementation. Requires allocation.reverse; callers use run_allocation_workflow.';
