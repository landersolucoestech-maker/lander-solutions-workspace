-- Transitional constraint required before obligations move from operational
-- statuses to permanent rule statuses. The next migration replaces it with
-- the final restricted catalog.

alter table public.compliance_obligations
  drop constraint compliance_obligations_status_check,
  add constraint compliance_obligations_status_check
  check (status in (
    'planned','pending','in_progress','compliant','overdue','waived','cancelled',
    'draft','active','inactive','archived'
  ));
