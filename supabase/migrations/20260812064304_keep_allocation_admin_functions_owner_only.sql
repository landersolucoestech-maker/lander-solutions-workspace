-- The caller-scoped dispatcher is SECURITY DEFINER and executes these
-- implementations as their owner. No runtime role needs direct EXECUTE.
revoke all on function public.admin_post_allocation_run(uuid,integer,uuid)
from service_role;
revoke all on function public.admin_reverse_allocation_run(uuid,integer,date,text,uuid)
from service_role;
