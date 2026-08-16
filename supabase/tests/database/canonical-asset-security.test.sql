begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname='public'
      and tablename in ('corporate_assets','asset_assignments')
      and (
        coalesce(qual,'') ilike '%hr.equipment.%'
        or coalesce(with_check,'') ilike '%hr.equipment.%'
      )
  ),
  0,
  'asset policies do not reference removed HR equipment permissions'
);

select policies_are(
  'public',
  'asset_assignments',
  array[
    'asset_assignments_delete',
    'asset_assignments_insert',
    'asset_assignments_read',
    'asset_assignments_update'
  ],
  'asset assignments expose only canonical policies'
);

select policies_are(
  'public',
  'corporate_assets',
  array[
    'corporate_assets_delete',
    'corporate_assets_insert',
    'corporate_assets_select',
    'corporate_assets_update'
  ],
  'corporate assets expose only canonical policies'
);

select has_index(
  'public','asset_assignments','idx_asset_assignments_assigned_by',
  'assigned-by foreign key has a supporting index'
);
select has_index(
  'public','asset_assignments','idx_asset_assignments_created_by',
  'created-by foreign key has a supporting index'
);
select has_index(
  'public','asset_assignments','idx_asset_assignments_returned_by',
  'returned-by foreign key has a supporting index'
);
select has_index(
  'public','asset_assignments','idx_asset_assignments_updated_by',
  'updated-by foreign key has a supporting index'
);

select * from finish();

rollback;
