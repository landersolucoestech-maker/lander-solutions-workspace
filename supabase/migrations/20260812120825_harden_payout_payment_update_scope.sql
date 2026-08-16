drop policy if exists payout_payments_update on public.payout_payments;

create policy payout_payments_update
on public.payout_payments
for update
to authenticated
using (
  status = 'draft'
  and exists (
    select 1
    from public.payout_obligations obligation
    where obligation.id = payout_obligation_id
      and private.current_user_has_permission(
        'payout.manage',
        private.unit_code_for_id(obligation.business_unit_id)
      )
  )
)
with check (
  status = 'draft'
  and exists (
    select 1
    from public.payout_obligations obligation
    where obligation.id = payout_obligation_id
      and private.current_user_has_permission(
        'payout.manage',
        private.unit_code_for_id(obligation.business_unit_id)
      )
  )
);

comment on policy payout_payments_update on public.payout_payments is
  'Draft payment updates require payout.manage on both the existing obligation scope (USING) and the destination obligation scope (WITH CHECK).';
