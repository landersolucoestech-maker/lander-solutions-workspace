begin;
select plan(6);

select has_column('public', 'contract_templates', 'business_unit_id', 'templates possuem unidade de negócio');
select col_is_null('public', 'contract_templates', 'business_unit_id', 'unidade permanece nullable para legados');
select fk_ok(
  'public', 'contract_templates', 'business_unit_id',
  'public', 'business_units', 'id',
  'unidade do template referencia business_units'
);
select has_index('public', 'contract_templates', 'contract_templates_business_unit_idx', 'FK possui índice');
select lives_ok(
  $$select id from public.contract_templates where business_unit_id is null limit 1$$,
  'templates anteriores continuam legíveis'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'contract_templates' and roles @> array['anon']::name[] and cmd <> 'SELECT'),
  0::bigint,
  'nenhuma escrita anônima foi adicionada'
);

select * from finish();
rollback;
