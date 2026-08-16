grant select, insert, update, delete
on table public.financial_fiscal_document_items
to authenticated;

drop policy if exists fiscal_items_manage on public.financial_fiscal_document_items;
drop policy if exists fiscal_items_select on public.financial_fiscal_document_items;
drop policy if exists fiscal_items_insert on public.financial_fiscal_document_items;
drop policy if exists fiscal_items_update on public.financial_fiscal_document_items;
drop policy if exists fiscal_items_delete on public.financial_fiscal_document_items;

create policy fiscal_items_select
on public.financial_fiscal_document_items
for select
to authenticated
using (
  exists (
    select 1
    from public.financial_fiscal_documents ffd
    join public.financial_documents fd on fd.id = ffd.financial_document_id
    where ffd.id = fiscal_document_id
      and private.current_user_has_permission(
        'finance.read',
        private.unit_code_for_id(fd.business_unit_id)
      )
  )
);

create policy fiscal_items_insert
on public.financial_fiscal_document_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.financial_fiscal_documents ffd
    join public.financial_documents fd on fd.id = ffd.financial_document_id
    where ffd.id = fiscal_document_id
      and ffd.status = 'draft'
      and private.current_user_has_aal2()
      and private.current_user_has_permission(
        'finance.documents.manage_draft',
        private.unit_code_for_id(fd.business_unit_id)
      )
  )
);

create policy fiscal_items_update
on public.financial_fiscal_document_items
for update
to authenticated
using (
  exists (
    select 1
    from public.financial_fiscal_documents ffd
    join public.financial_documents fd on fd.id = ffd.financial_document_id
    where ffd.id = fiscal_document_id
      and ffd.status = 'draft'
      and private.current_user_has_aal2()
      and private.current_user_has_permission(
        'finance.documents.manage_draft',
        private.unit_code_for_id(fd.business_unit_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.financial_fiscal_documents ffd
    join public.financial_documents fd on fd.id = ffd.financial_document_id
    where ffd.id = fiscal_document_id
      and ffd.status = 'draft'
      and private.current_user_has_aal2()
      and private.current_user_has_permission(
        'finance.documents.manage_draft',
        private.unit_code_for_id(fd.business_unit_id)
      )
  )
);

create policy fiscal_items_delete
on public.financial_fiscal_document_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.financial_fiscal_documents ffd
    join public.financial_documents fd on fd.id = ffd.financial_document_id
    where ffd.id = fiscal_document_id
      and ffd.status = 'draft'
      and private.current_user_has_aal2()
      and private.current_user_has_permission(
        'finance.documents.manage_draft',
        private.unit_code_for_id(fd.business_unit_id)
      )
  )
);
