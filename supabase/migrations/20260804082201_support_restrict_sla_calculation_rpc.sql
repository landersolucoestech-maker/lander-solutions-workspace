revoke all on function public.support_calculate_due_at(timestamptz,integer,uuid) from public,anon,authenticated;
grant execute on function public.support_calculate_due_at(timestamptz,integer,uuid) to service_role;
