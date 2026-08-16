-- Corporate ownership RLS and grants.

alter table public.corporate_capital_structures enable row level security;
alter table public.corporate_share_classes enable row level security;
alter table public.corporate_ownership_positions enable row level security;
alter table public.corporate_ownership_roles enable row level security;
alter table public.corporate_ownership_changes enable row level security;
alter table public.corporate_ownership_change_lines enable row level security;
alter table public.corporate_resolutions enable row level security;

create policy corporate_capital_structures_read
on public.corporate_capital_structures for select to authenticated
using (
  public.has_permission('corporate_ownership.read', null)
  or public.has_permission('corporate_ownership.manage', null)
  or public.has_permission('corporate_ownership.apply_changes', null)
);
create policy corporate_capital_structures_manage
on public.corporate_capital_structures for all to authenticated
using (public.has_permission('corporate_ownership.manage', null))
with check (public.has_permission('corporate_ownership.manage', null));

create policy corporate_share_classes_read
on public.corporate_share_classes for select to authenticated
using (
  public.has_permission('corporate_ownership.read', null)
  or public.has_permission('corporate_ownership.manage', null)
  or public.has_permission('corporate_ownership.apply_changes', null)
);
create policy corporate_share_classes_manage
on public.corporate_share_classes for all to authenticated
using (public.has_permission('corporate_ownership.manage', null))
with check (public.has_permission('corporate_ownership.manage', null));

create policy corporate_ownership_positions_read
on public.corporate_ownership_positions for select to authenticated
using (
  public.has_permission('corporate_ownership.read', null)
  or public.has_permission('corporate_ownership.manage', null)
  or public.has_permission('corporate_ownership.apply_changes', null)
);
create policy corporate_ownership_positions_manage
on public.corporate_ownership_positions for all to authenticated
using (public.has_permission('corporate_ownership.manage', null))
with check (public.has_permission('corporate_ownership.manage', null));

create policy corporate_ownership_roles_read
on public.corporate_ownership_roles for select to authenticated
using (
  public.has_permission('corporate_ownership.read', null)
  or public.has_permission('corporate_ownership.manage', null)
  or public.has_permission('corporate_ownership.apply_changes', null)
);
create policy corporate_ownership_roles_manage
on public.corporate_ownership_roles for all to authenticated
using (public.has_permission('corporate_ownership.manage', null))
with check (public.has_permission('corporate_ownership.manage', null));

create policy corporate_ownership_changes_read
on public.corporate_ownership_changes for select to authenticated
using (
  public.has_permission('corporate_ownership.read', null)
  or public.has_permission('corporate_ownership.manage', null)
  or public.has_permission('corporate_ownership.apply_changes', null)
);
create policy corporate_ownership_changes_insert
on public.corporate_ownership_changes for insert to authenticated
with check (public.has_permission('corporate_ownership.manage', null));
create policy corporate_ownership_changes_update
on public.corporate_ownership_changes for update to authenticated
using (
  public.has_permission('corporate_ownership.manage', null)
  or public.has_permission('corporate_ownership.apply_changes', null)
)
with check (
  public.has_permission('corporate_ownership.manage', null)
  or public.has_permission('corporate_ownership.apply_changes', null)
);
create policy corporate_ownership_changes_delete
on public.corporate_ownership_changes for delete to authenticated
using (public.has_permission('corporate_ownership.manage', null));

create policy corporate_ownership_change_lines_read
on public.corporate_ownership_change_lines for select to authenticated
using (
  public.has_permission('corporate_ownership.read', null)
  or public.has_permission('corporate_ownership.manage', null)
  or public.has_permission('corporate_ownership.apply_changes', null)
);
create policy corporate_ownership_change_lines_manage
on public.corporate_ownership_change_lines for all to authenticated
using (public.has_permission('corporate_ownership.manage', null))
with check (public.has_permission('corporate_ownership.manage', null));

create policy corporate_resolutions_read
on public.corporate_resolutions for select to authenticated
using (
  public.has_permission('corporate_ownership.read', null)
  or public.has_permission('corporate_ownership.manage', null)
  or public.has_permission('corporate_ownership.apply_changes', null)
);
create policy corporate_resolutions_manage
on public.corporate_resolutions for all to authenticated
using (public.has_permission('corporate_ownership.manage', null))
with check (public.has_permission('corporate_ownership.manage', null));

revoke all on public.corporate_capital_structures from anon;
revoke all on public.corporate_share_classes from anon;
revoke all on public.corporate_ownership_positions from anon;
revoke all on public.corporate_ownership_roles from anon;
revoke all on public.corporate_ownership_changes from anon;
revoke all on public.corporate_ownership_change_lines from anon;
revoke all on public.corporate_resolutions from anon;
revoke all on public.corporate_ownership_current_positions from anon;

grant select, insert, update, delete on public.corporate_capital_structures to authenticated;
grant select, insert, update, delete on public.corporate_share_classes to authenticated;
grant select, insert, update, delete on public.corporate_ownership_positions to authenticated;
grant select, insert, update, delete on public.corporate_ownership_roles to authenticated;
grant select, insert, update, delete on public.corporate_ownership_changes to authenticated;
grant select, insert, update, delete on public.corporate_ownership_change_lines to authenticated;
grant select, insert, update, delete on public.corporate_resolutions to authenticated;
grant select on public.corporate_ownership_current_positions to authenticated;
