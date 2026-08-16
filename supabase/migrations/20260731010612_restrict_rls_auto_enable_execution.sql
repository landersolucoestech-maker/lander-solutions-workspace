-- Restrict the RLS event-trigger helper from the exposed Data API roles.
-- The event trigger continues to execute internally with its owner privileges.

revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;

-- New functions must be granted explicitly when they are intended to be API endpoints.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
