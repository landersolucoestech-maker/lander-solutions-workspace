begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select hasnt_table('public', 'equipment', 'legacy equipment table is removed');
select hasnt_table(
  'public',
  'equipment_assignments',
  'legacy equipment assignments table is removed'
);
select hasnt_table('public', 'legal_cases', 'legacy legal cases table is removed');

select has_table('public', 'corporate_assets', 'canonical corporate assets table exists');
select has_table('public', 'asset_assignments', 'canonical asset assignments table exists');
select has_table('public', 'legal_matters', 'canonical legal matters table exists');

select hasnt_function(
  'public',
  'admin_assign_hr_equipment',
  array['uuid','uuid','date','date','text','text','uuid'],
  'legacy equipment assignment RPC is removed'
);
select hasnt_function(
  'public',
  'admin_create_hr_equipment',
  array['uuid','text','text','text','text','text','text','text','text','text','uuid'],
  'legacy equipment creation RPC is removed'
);
select hasnt_function(
  'public',
  'admin_return_hr_equipment',
  array['uuid','date','text','text','bigint','uuid'],
  'legacy equipment return RPC is removed'
);
select hasnt_function(
  'private',
  'block_legacy_equipment_write',
  array[]::text[],
  'legacy equipment trigger function is removed'
);

select is(
  (
    select count(*)::integer
    from public.permissions
    where code in ('hr.equipment.read', 'hr.equipment.manage')
  ),
  0,
  'legacy HR equipment permissions are removed'
);

select * from finish();

rollback;
