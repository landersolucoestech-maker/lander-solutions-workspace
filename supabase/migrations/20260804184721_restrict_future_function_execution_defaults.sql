alter default privileges for role postgres in schema public
revoke execute on functions from public;

alter default privileges for role postgres in schema private
revoke execute on functions from public;

alter default privileges for role postgres in schema development_private
revoke execute on functions from public;
