alter table public.managerial_accounts
  add column if not exists reporting_group text;

update public.managerial_accounts
set reporting_group = case code
  when '5000' then 'direct_cost'
  when '6000' then 'exclusive_expense'
  when '6100' then 'shared_expense'
  when '6200' then 'participation_expense'
  when '7000' then 'tax_expense'
  when '7100' then 'fee_expense'
  else reporting_group
end
where account_type = 'expense';

alter table public.managerial_accounts
  drop constraint if exists managerial_accounts_reporting_group_check;

alter table public.managerial_accounts
  add constraint managerial_accounts_reporting_group_check
  check (
    reporting_group is null
    or reporting_group in (
      'direct_cost',
      'exclusive_expense',
      'shared_expense',
      'participation_expense',
      'tax_expense',
      'fee_expense'
    )
  );

alter table public.managerial_accounts
  drop constraint if exists managerial_accounts_expense_reporting_group_required;

alter table public.managerial_accounts
  add constraint managerial_accounts_expense_reporting_group_required
  check (
    (account_type = 'expense' and reporting_group is not null)
    or (account_type <> 'expense' and reporting_group is null)
  );

comment on column public.managerial_accounts.reporting_group is
  'Grupo gerencial usado pelos indicadores e relatórios; substitui classificação por prefixos no frontend.';
