drop policy if exists employees_select_hr on public.employees;
create policy employees_select_hr on public.employees for select to authenticated using (
  deleted_at is null and (
    private.hr_has_unit_permission('hr.employees.read', id)
    or user_id=(select auth.uid())
    or private.hr_is_manager_of(id)
  )
);

drop policy if exists people_select_hr on public.people;
create policy people_select_hr on public.people for select to authenticated using (
  deleted_at is null and exists (
    select 1 from public.employees e
    where e.person_id=people.id and e.deleted_at is null and (
      private.hr_has_unit_permission('hr.employees.sensitive', e.id)
      or e.user_id=(select auth.uid())
    )
  )
);

create index if not exists positions_created_by_idx on public.positions(created_by) where created_by is not null;
create index if not exists positions_updated_by_idx on public.positions(updated_by) where updated_by is not null;
create index if not exists people_created_by_idx on public.people(created_by) where created_by is not null;
create index if not exists people_updated_by_idx on public.people(updated_by) where updated_by is not null;
create index if not exists employees_created_by_idx on public.employees(created_by) where created_by is not null;
create index if not exists employees_updated_by_idx on public.employees(updated_by) where updated_by is not null;
create index if not exists employment_contracts_legal_entity_idx on public.employment_contracts(legal_entity_id);
create index if not exists employment_contracts_position_idx on public.employment_contracts(position_id) where position_id is not null;
create index if not exists employment_contracts_created_by_idx on public.employment_contracts(created_by) where created_by is not null;
create index if not exists employment_contracts_updated_by_idx on public.employment_contracts(updated_by) where updated_by is not null;
create index if not exists employment_contract_history_changed_by_idx on public.employment_contract_history(changed_by) where changed_by is not null;
create index if not exists hr_settings_business_unit_idx on public.hr_settings(business_unit_id) where business_unit_id is not null;
create index if not exists hr_settings_created_by_idx on public.hr_settings(created_by) where created_by is not null;
create index if not exists hr_settings_updated_by_idx on public.hr_settings(updated_by) where updated_by is not null;
create index if not exists document_types_created_by_idx on public.document_types(created_by) where created_by is not null;
create index if not exists document_types_updated_by_idx on public.document_types(updated_by) where updated_by is not null;
create index if not exists employee_documents_document_type_idx on public.employee_documents(document_type_id);
create index if not exists employee_documents_supersedes_idx on public.employee_documents(supersedes_document_id) where supersedes_document_id is not null;
create index if not exists employee_documents_uploaded_by_idx on public.employee_documents(uploaded_by) where uploaded_by is not null;
create index if not exists employee_documents_created_by_idx on public.employee_documents(created_by) where created_by is not null;
create index if not exists employee_documents_updated_by_idx on public.employee_documents(updated_by) where updated_by is not null;
create index if not exists leave_types_created_by_idx on public.leave_types(created_by) where created_by is not null;
create index if not exists leave_types_updated_by_idx on public.leave_types(updated_by) where updated_by is not null;
create index if not exists leave_requests_leave_type_idx on public.leave_requests(leave_type_id);
create index if not exists leave_requests_manager_idx on public.leave_requests(manager_employee_id) where manager_employee_id is not null;
create index if not exists leave_requests_approver_idx on public.leave_requests(approver_user_id) where approver_user_id is not null;
create index if not exists leave_requests_requested_by_idx on public.leave_requests(requested_by) where requested_by is not null;
create index if not exists leave_requests_created_by_idx on public.leave_requests(created_by) where created_by is not null;
create index if not exists leave_requests_updated_by_idx on public.leave_requests(updated_by) where updated_by is not null;
create index if not exists employee_payments_contract_idx on public.employee_payments(contract_id) where contract_id is not null;
create index if not exists employee_payments_created_by_idx on public.employee_payments(created_by) where created_by is not null;
create index if not exists employee_payments_updated_by_idx on public.employee_payments(updated_by) where updated_by is not null;
create index if not exists onboarding_processes_responsible_idx on public.onboarding_processes(responsible_user_id);
create index if not exists onboarding_processes_created_by_idx on public.onboarding_processes(created_by) where created_by is not null;
create index if not exists onboarding_processes_updated_by_idx on public.onboarding_processes(updated_by) where updated_by is not null;
create index if not exists onboarding_tasks_responsible_idx on public.onboarding_tasks(responsible_user_id) where responsible_user_id is not null;
create index if not exists onboarding_tasks_completed_by_idx on public.onboarding_tasks(completed_by) where completed_by is not null;
create index if not exists onboarding_tasks_created_by_idx on public.onboarding_tasks(created_by) where created_by is not null;
create index if not exists onboarding_tasks_updated_by_idx on public.onboarding_tasks(updated_by) where updated_by is not null;
create index if not exists offboarding_processes_responsible_idx on public.offboarding_processes(responsible_user_id);
create index if not exists offboarding_processes_completed_by_idx on public.offboarding_processes(completed_by) where completed_by is not null;
create index if not exists offboarding_processes_created_by_idx on public.offboarding_processes(created_by) where created_by is not null;
create index if not exists offboarding_processes_updated_by_idx on public.offboarding_processes(updated_by) where updated_by is not null;
create index if not exists offboarding_tasks_responsible_idx on public.offboarding_tasks(responsible_user_id) where responsible_user_id is not null;
create index if not exists offboarding_tasks_completed_by_idx on public.offboarding_tasks(completed_by) where completed_by is not null;
create index if not exists offboarding_tasks_created_by_idx on public.offboarding_tasks(created_by) where created_by is not null;
create index if not exists offboarding_tasks_updated_by_idx on public.offboarding_tasks(updated_by) where updated_by is not null;
create index if not exists equipment_created_by_idx on public.equipment(created_by) where created_by is not null;
create index if not exists equipment_updated_by_idx on public.equipment(updated_by) where updated_by is not null;
create index if not exists equipment_assignments_assigned_by_idx on public.equipment_assignments(assigned_by) where assigned_by is not null;
create index if not exists equipment_assignments_returned_by_idx on public.equipment_assignments(returned_by) where returned_by is not null;
create index if not exists equipment_assignments_created_by_idx on public.equipment_assignments(created_by) where created_by is not null;
create index if not exists equipment_assignments_updated_by_idx on public.equipment_assignments(updated_by) where updated_by is not null;
create index if not exists employee_accesses_granted_by_idx on public.employee_accesses(granted_by) where granted_by is not null;
create index if not exists employee_accesses_revoked_by_idx on public.employee_accesses(revoked_by) where revoked_by is not null;
create index if not exists employee_accesses_created_by_idx on public.employee_accesses(created_by) where created_by is not null;
create index if not exists employee_accesses_updated_by_idx on public.employee_accesses(updated_by) where updated_by is not null;
