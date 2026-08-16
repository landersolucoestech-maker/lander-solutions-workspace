revoke insert, update, delete, truncate, references, trigger
on table public.integration_connections
from authenticated;

grant select
on table public.integration_connections
to authenticated;
