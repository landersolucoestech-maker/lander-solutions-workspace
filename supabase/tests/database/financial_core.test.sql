begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select has_table('public','financial_documents','financial_documents exists');
select has_table('public','financial_document_lines','financial_document_lines exists');
select has_table('public','financial_settlements','financial_settlements exists');
select has_table('public','journal_entries','journal_entries exists');
select has_table('public','journal_lines','journal_lines exists');

select is(
  (
    select count(*)::integer
    from pg_tables
    where schemaname='public'
      and tablename in ('financial_documents','financial_document_lines','financial_settlements','journal_entries','journal_lines')
      and rowsecurity=false
  ),
  0,
  'financial core tables have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema='public'
      and table_name in ('financial_documents','financial_document_lines','financial_settlements','journal_entries','journal_lines')
      and grantee='anon'
      and privilege_type <> 'SELECT'
  ),
  0,
  'anon has no financial core mutation privileges in development'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_routine_grants
    where specific_schema='public'
      and routine_name in (
        'admin_submit_financial_document',
        'admin_approve_financial_document',
        'admin_submit_financial_settlement',
        'admin_post_financial_settlement',
        'admin_submit_manual_journal',
        'admin_post_manual_journal',
        'admin_reverse_journal_entry'
      )
      and grantee in ('PUBLIC','anon','authenticated')
  ),
  0,
  'financial administrative RPCs are service-only'
);

select has_trigger('public','financial_documents','financial_documents_b_protect','submitted financial documents are protected');
select has_trigger('public','financial_settlements','financial_settlements_a_overflow','settlement overflow is blocked');
select has_trigger('public','journal_entries','journal_entries_a_protect','posted journal entries are protected');
select has_trigger('public','journal_lines','journal_lines_totals','journal totals are refreshed from lines');
select has_trigger('public','journal_lines','journal_lines_a_editable','journal lines respect entry editability');

select * from finish();

rollback;
