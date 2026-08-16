with permission_mapping(source_code,target_code) as (
  values
    ('participations.read','participation.read'),
    ('participations.manage','participation.manage'),
    ('participations.approve','participation.approve')
)
insert into public.role_permissions(role_id,permission_id)
select distinct role_permission.role_id,target.id
from public.role_permissions role_permission
join public.permissions source on source.id=role_permission.permission_id
join permission_mapping mapping on mapping.source_code=source.code
join public.permissions target on target.code=mapping.target_code
on conflict do nothing;

delete from public.role_permissions
where permission_id in (
  select id from public.permissions where code like 'participations.%'
);

delete from public.permissions where code like 'participations.%';
