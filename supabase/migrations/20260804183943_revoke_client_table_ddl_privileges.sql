revoke truncate, references, trigger
on all tables in schema public
from anon, authenticated;

revoke truncate, references, trigger
on all tables in schema private
from anon, authenticated;

alter default privileges for role postgres in schema public
revoke truncate, references, trigger on tables from anon, authenticated;

alter default privileges for role postgres in schema private
revoke truncate, references, trigger on tables from anon, authenticated;
