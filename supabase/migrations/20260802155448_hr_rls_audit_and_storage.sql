-- RH audit triggers, write boundary, row policies and private storage.

do $$
declare t text;
begin
  foreach t in array array[
    'people','employees','employment_contracts','employee_documents','leave_requests','employee_payments',
    'onboarding_processes','onboarding_tasks','offboarding_processes','offboarding_tasks',
    'equipment','equipment_assignments','employee_accesses','positions','hr_settings'
  ] loop
    execute format('create trigger %I after insert or update on public.%I for each row execute function private.audit_hr_row_change()', t||'_hr_audit', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'people','employees','employment_contracts','employment_contract_history','employee_documents','leave_requests',
    'employee_payments','onboarding_processes','onboarding_tasks','offboarding_processes','offboarding_tasks',
    'equipment','equipment_assignments','employee_accesses'
  ] loop
    execute format('create trigger %I before delete on public.%I for each row execute function private.prevent_hr_physical_delete()', t||'_prevent_delete', t);
  end loop;
end $$;

revoke all on public.positions, public.people, public.employees, public.employment_contracts,
  public.employment_contract_history, public.hr_settings, public.document_types, public.employee_documents,
  public.leave_types, public.leave_requests, public.employee_payments, public.onboarding_processes,
  public.onboarding_tasks, public.offboarding_processes, public.offboarding_tasks, public.equipment,
  public.equipment_assignments, public.employee_accesses from anon;
revoke insert, update, delete on public.positions, public.people, public.employees, public.employment_contracts,
  public.employment_contract_history, public.hr_settings, public.document_types, public.employee_documents,
  public.leave_types, public.leave_requests, public.employee_payments, public.onboarding_processes,
  public.onboarding_tasks, public.offboarding_processes, public.offboarding_tasks, public.equipment,
  public.equipment_assignments, public.employee_accesses from authenticated;
grant select on public.positions, public.people, public.employees, public.employment_contracts,
  public.employment_contract_history, public.hr_settings, public.document_types, public.employee_documents,
  public.leave_types, public.leave_requests, public.employee_payments, public.onboarding_processes,
  public.onboarding_tasks, public.offboarding_processes, public.offboarding_tasks, public.equipment,
  public.equipment_assignments, public.employee_accesses to authenticated;
grant all on public.positions, public.people, public.employees, public.employment_contracts,
  public.employment_contract_history, public.hr_settings, public.document_types, public.employee_documents,
  public.leave_types, public.leave_requests, public.employee_payments, public.onboarding_processes,
  public.onboarding_tasks, public.offboarding_processes, public.offboarding_tasks, public.equipment,
  public.equipment_assignments, public.employee_accesses to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy positions_select_hr on public.positions for select to authenticated using (
  deleted_at is null and (
    public.has_permission('hr.employees.read', private.unit_code_for_id(business_unit_id))
    or public.has_permission('hr.settings.manage', private.unit_code_for_id(business_unit_id))
    or business_unit_id is null
  )
);
create policy document_types_select_hr on public.document_types for select to authenticated using (
  deleted_at is null and public.has_permission('hr.module.access', null)
);
create policy leave_types_select_hr on public.leave_types for select to authenticated using (
  deleted_at is null and public.has_permission('hr.module.access', null)
);
create policy hr_settings_select_hr on public.hr_settings for select to authenticated using (
  deleted_at is null and public.has_permission('hr.settings.manage', private.unit_code_for_id(business_unit_id))
);
create policy employees_select_hr on public.employees for select to authenticated using (
  deleted_at is null and (
    private.hr_has_unit_permission('hr.employees.read', id)
    or user_id=auth.uid()
    or private.hr_is_manager_of(id)
  )
);
create policy people_select_hr on public.people for select to authenticated using (
  deleted_at is null and exists (
    select 1 from public.employees e
    where e.person_id=people.id and e.deleted_at is null and (
      private.hr_has_unit_permission('hr.employees.sensitive', e.id)
      or e.user_id=auth.uid()
    )
  )
);
create policy employment_contracts_select_hr on public.employment_contracts for select to authenticated using (
  deleted_at is null and (
    private.hr_has_unit_permission('hr.contracts.read', employee_id)
    or employee_id=private.hr_current_employee_id()
  )
);
create policy employment_contract_history_select_hr on public.employment_contract_history for select to authenticated using (
  exists (
    select 1 from public.employment_contracts c
    where c.id=employment_contract_history.contract_id and c.deleted_at is null
      and private.hr_has_unit_permission('hr.contracts.read', c.employee_id)
  )
);
create policy employee_documents_select_hr on public.employee_documents for select to authenticated using (
  deleted_at is null and status<>'DELETED' and (
    private.hr_has_unit_permission('hr.documents.sensitive', employee_id)
    or (employee_id=private.hr_current_employee_id() and visibility='EMPLOYEE_AND_RH')
    or (private.hr_is_manager_of(employee_id) and visibility='MANAGER_AND_RH')
    or (visibility='FINANCE_AND_RH' and private.hr_has_unit_permission('hr.payments.read', employee_id))
  )
);
create policy leave_requests_select_hr on public.leave_requests for select to authenticated using (
  deleted_at is null and (
    private.hr_has_unit_permission('hr.leave.read', employee_id)
    or employee_id=private.hr_current_employee_id()
    or private.hr_is_manager_of(employee_id)
  )
);
create policy employee_payments_select_hr on public.employee_payments for select to authenticated using (
  deleted_at is null and private.hr_has_unit_permission('hr.payments.read', employee_id)
);
create policy onboarding_processes_select_hr on public.onboarding_processes for select to authenticated using (
  deleted_at is null and (
    private.hr_has_unit_permission('hr.onboarding.read', employee_id)
    or employee_id=private.hr_current_employee_id()
    or private.hr_is_manager_of(employee_id)
  )
);
create policy onboarding_tasks_select_hr on public.onboarding_tasks for select to authenticated using (
  deleted_at is null and exists (
    select 1 from public.onboarding_processes p where p.id=onboarding_tasks.onboarding_process_id and p.deleted_at is null and (
      private.hr_has_unit_permission('hr.onboarding.read', p.employee_id)
      or p.employee_id=private.hr_current_employee_id()
      or private.hr_is_manager_of(p.employee_id)
    )
  )
);
create policy offboarding_processes_select_hr on public.offboarding_processes for select to authenticated using (
  deleted_at is null and private.hr_has_unit_permission('hr.offboarding.read', employee_id)
);
create policy offboarding_tasks_select_hr on public.offboarding_tasks for select to authenticated using (
  deleted_at is null and exists (
    select 1 from public.offboarding_processes p where p.id=offboarding_tasks.offboarding_process_id and p.deleted_at is null
      and private.hr_has_unit_permission('hr.offboarding.read', p.employee_id)
  )
);
create policy equipment_select_hr on public.equipment for select to authenticated using (
  deleted_at is null and (
    public.has_permission('hr.equipment.read', private.unit_code_for_id(business_unit_id))
    or exists (
      select 1 from public.equipment_assignments ea
      where ea.equipment_id=equipment.id and ea.deleted_at is null and ea.status='ATIVO'
        and (ea.employee_id=private.hr_current_employee_id() or private.hr_is_manager_of(ea.employee_id))
    )
  )
);
create policy equipment_assignments_select_hr on public.equipment_assignments for select to authenticated using (
  deleted_at is null and (
    private.hr_has_unit_permission('hr.equipment.read', employee_id)
    or employee_id=private.hr_current_employee_id()
    or private.hr_is_manager_of(employee_id)
  )
);
create policy employee_accesses_select_hr on public.employee_accesses for select to authenticated using (
  deleted_at is null and (
    private.hr_has_unit_permission('hr.accesses.read', employee_id)
    or employee_id=private.hr_current_employee_id()
    or private.hr_is_manager_of(employee_id)
  )
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hr-documents','hr-documents',false,52428800,array[
  'application/pdf','image/jpeg','image/png','image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

comment on table public.employee_accesses is 'Registro de existência e status de acessos; senhas, tokens e chaves são proibidos.';
