-- The caller-scoped wrappers are active in the Edge Functions. The legacy
-- implementation functions remain owner-only so no external role can supply an actor id.

revoke all on function public.admin_calculate_participation(uuid,integer,uuid)
from public,anon,authenticated,service_role;
revoke all on function public.admin_submit_participation(uuid,integer,uuid)
from public,anon,authenticated,service_role;
revoke all on function public.admin_decide_participation(uuid,integer,uuid,boolean,text)
from public,anon,authenticated,service_role;
revoke all on function public.admin_post_participation(uuid,integer,uuid)
from public,anon,authenticated,service_role;
revoke all on function public.admin_post_payout_payment(uuid,integer,uuid)
from public,anon,authenticated,service_role;

comment on function public.admin_calculate_participation(uuid,integer,uuid) is
  'Owner-only implementation. External callers must use calculate_participation.';
comment on function public.admin_submit_participation(uuid,integer,uuid) is
  'Owner-only implementation. External callers must use submit_participation.';
comment on function public.admin_decide_participation(uuid,integer,uuid,boolean,text) is
  'Owner-only implementation. External callers must use decide_participation.';
comment on function public.admin_post_participation(uuid,integer,uuid) is
  'Owner-only implementation. External callers must use post_participation.';
comment on function public.admin_post_payout_payment(uuid,integer,uuid) is
  'Owner-only implementation. External callers must use post_payout_payment.';
