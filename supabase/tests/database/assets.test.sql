begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,email_change,email_change_token_new,recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','asset-classification@test.local','',now(),
  '{}'::jsonb,'{}'::jsonb,now(),now(),'','','',''
);

select has_table('public','corporate_assets','corporate_assets is the canonical asset master');
select has_table('public','asset_assignments','asset_assignments stores custody history');

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname='public'
      and tablename in ('corporate_assets','asset_assignments')
      and rowsecurity=false
  ),
  0,
  'canonical asset tables have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in ('corporate_assets','asset_assignments','equipment','equipment_assignments')
      and grantee='anon'
  ),
  0,
  'anon has no privileges on canonical or legacy equipment structures'
);

select hasnt_table('public','equipment','legacy equipment master remains removed');
select hasnt_table('public','equipment_assignments','legacy assignment ledger remains removed');
select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'admin_create_hr_equipment',
        'admin_assign_hr_equipment',
        'admin_return_hr_equipment'
      )
  ),
  0,
  'removed legacy HR equipment RPCs are not reintroduced'
);
select is(
  position(
    'public.equipment_assignments' in
    pg_get_functiondef('public.admin_complete_hr_offboarding(uuid,date,bigint,uuid)'::regprocedure)
  ),
  0,
  'offboarding checks canonical assignments'
);

select is(
  (
    select count(*)::integer
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal
      and n.nspname='public'
      and c.relname='equipment_assignments'
      and t.tgname='equipment_assignments_sync_equipment'
  ),
  0,
  'obsolete legacy status synchronization trigger was removed'
);

select is(
  (
    select count(*)::integer
    from public.asset_assignments aa
    left join public.corporate_assets a on a.id=aa.asset_id
    left join public.employees e on e.id=aa.employee_id
    where a.id is null or e.id is null
  ),
  0,
  'canonical assignments have no orphan references'
);

select is(
  (
    select count(*)::integer
    from public.asset_assignments aa
    join public.corporate_assets a on a.id=aa.asset_id
    where a.asset_category <> 'equipment'
  ),
  0,
  'employee assignments only reference equipment assets'
);

select is(
  (
    select count(*)::integer
    from public.corporate_assets
    where asset_type in ('trademark','copyright','contractual_right')
  ),
  0,
  'patrimony does not contain intellectual property or ambiguous contractual rights'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid='public.corporate_assets'::regclass
      and conname='corporate_assets_asset_category_check'
  ),
  1,
  'asset category has an explicit canonical constraint'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid='public.corporate_assets'::regclass
      and conname='corporate_assets_classification_check'
  ),
  1,
  'asset category and type have a relationship constraint'
);

select is(
  position(
    'UPDATE OF asset_type, asset_category' in
    pg_get_triggerdef((
      select oid from pg_trigger
      where tgrelid='public.corporate_assets'::regclass
        and tgname='corporate_assets_enforce_domain'
    ))
  ) > 0,
  true,
  'Patrimônio x PI trigger protects both classification fields'
);

select lives_ok(
  $$
    insert into public.corporate_assets (
      id,legal_entity_id,code,name,asset_category,asset_type,created_by
    )
    select
      '20000000-0000-0000-0000-000000000002',id,'ATV-TST-CANON','Notebook de teste',
      'equipment','computer','20000000-0000-0000-0000-000000000001'
    from public.legal_entities
    order by created_at
    limit 1
  $$,
  'valid canonical equipment can be inserted'
);

select is(
  (
    select asset_category || '/' || asset_type
    from public.corporate_assets
    where id='20000000-0000-0000-0000-000000000002'
  ),
  'equipment/computer',
  'canonical category and technical subtype are stored independently'
);

select lives_ok(
  $$
    update public.corporate_assets
    set asset_type='mobile_device'
    where id='20000000-0000-0000-0000-000000000002'
  $$,
  'asset can be updated to another subtype in the same category'
);

select throws_ok(
  $$
    update public.corporate_assets
    set asset_type='software_license'
    where id='20000000-0000-0000-0000-000000000002'
  $$,
  '23514',
  'new row for relation "corporate_assets" violates check constraint "corporate_assets_classification_check"',
  'invalid category and type combination is rejected'
);

select throws_ok(
  $$
    update public.corporate_assets
    set asset_category='patent',asset_type='other'
    where id='20000000-0000-0000-0000-000000000002'
  $$,
  '23514',
  'Classificação de propriedade intelectual pertence ao módulo de PI.',
  'intellectual-property classification is rejected by the Assets boundary'
);

select is(
  (
    select count(*)::integer
    from public.corporate_assets
    where id='20000000-0000-0000-0000-000000000002'
      and asset_category='equipment'
  ),
  1,
  'HR can still identify canonical equipment by asset_category'
);

select * from finish();

rollback;
