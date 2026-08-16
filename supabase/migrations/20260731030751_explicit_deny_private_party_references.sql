create policy party_restricted_references_no_direct_access
on private.party_restricted_references
as restrictive
for all
to authenticated
using (false)
with check (false);
