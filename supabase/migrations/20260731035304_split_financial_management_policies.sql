drop policy managerial_accounts_manage on public.managerial_accounts;
create policy managerial_accounts_insert on public.managerial_accounts
for insert to authenticated
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.cash.manage',null)
  and not is_system
);
create policy managerial_accounts_update on public.managerial_accounts
for update to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.cash.manage',null)
  and not is_system
)
with check (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.cash.manage',null)
  and not is_system
);
create policy managerial_accounts_delete on public.managerial_accounts
for delete to authenticated
using (
  private.current_user_has_aal2()
  and private.current_user_has_permission('finance.cash.manage',null)
  and not is_system
);

drop policy cash_accounts_manage on public.cash_accounts;
create policy cash_accounts_insert on public.cash_accounts
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null));
create policy cash_accounts_update on public.cash_accounts
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null));
create policy cash_accounts_delete on public.cash_accounts
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null));

drop policy exchange_rates_manage on public.exchange_rates;
create policy exchange_rates_insert on public.exchange_rates
for insert to authenticated
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null));
create policy exchange_rates_update on public.exchange_rates
for update to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null))
with check (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null));
create policy exchange_rates_delete on public.exchange_rates
for delete to authenticated
using (private.current_user_has_aal2() and private.current_user_has_permission('finance.cash.manage',null));
