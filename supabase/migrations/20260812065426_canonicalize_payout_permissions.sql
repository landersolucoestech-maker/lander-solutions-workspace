insert into public.permissions(code,module,action,description)
values ('payout.post','payout','post','Postar e conciliar pagamentos de repasse.')
on conflict (code) do update set
  module=excluded.module,
  action=excluded.action,
  description=excluded.description;

-- Preserve grants from both historical catalogs before removing the plural one.
with permission_mapping(source_code,target_code) as (
  values
    ('payouts.read','payout.read'),
    ('payouts.manage','payout.manage'),
    ('payouts.pay','payout.post'),
    ('payout.manage','payout.post')
)
insert into public.role_permissions(role_id,permission_id)
select distinct role_permission.role_id,target.id
from public.role_permissions role_permission
join public.permissions source on source.id=role_permission.permission_id
join permission_mapping mapping on mapping.source_code=source.code
join public.permissions target on target.code=mapping.target_code
on conflict do nothing;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.admin_post_payout_payment(uuid,integer,uuid)'::regprocedure
  ) into v_definition;
  if position('''payout.manage''' in v_definition)=0 then
    raise exception 'admin_post_payout_payment permission contract drifted';
  end if;
  execute replace(v_definition,'''payout.manage''','''payout.post''');
end;
$$;

delete from public.role_permissions
where permission_id in (select id from public.permissions where code like 'payouts.%');

delete from public.permissions where code like 'payouts.%';

revoke all on function public.admin_post_payout_payment(uuid,integer,uuid)
from public,anon,authenticated,service_role;

comment on function public.admin_post_payout_payment(uuid,integer,uuid) is
  'Owner-only implementation requiring payout.post. External callers use post_payout_payment.';
