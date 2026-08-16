export type EmployeeStatus = "ATIVO" | "AFASTADO" | "DESLIGADO";
export type EmploymentType = "CLT" | "PJ" | "FREELANCER" | "ESTAGIO" | "SOCIO" | "OUTRO";
export type WorkMode = "PRESENCIAL" | "HIBRIDO" | "REMOTO";

export interface HrDashboardSummary {
  activeEmployees: number;
  awayEmployees: number;
  terminatedEmployees: number;
  employeesByUnit: Array<{ code: string; name: string; total: number }>;
  expiringContracts: number;
  expiringDocuments: number;
  upcomingLeaves: number;
  pendingOnboardings: number;
  activeOffboardings: number;
  pendingEquipmentReturns: number;
  pendingPayments: number;
  birthdaysThisMonth: number;
}

export interface EmployeeDirectoryRow {
  employee_id: string;
  display_name: string;
  corporate_email: string | null;
  business_unit_id: string;
  unit_code: string;
  unit_name: string;
  department_id: string | null;
  department_name: string | null;
  position_id: string | null;
  position_name: string | null;
  manager_employee_id: string | null;
  manager_name: string | null;
  hire_date: string;
  employment_type: EmploymentType;
  work_mode: WorkMode;
  status: EmployeeStatus;
  employee_version: number;
}

export interface EmployeeSensitiveDetail {
  employeeId: string;
  employeeVersion: number;
  personId: string;
  personVersion: number;
  legalName: string;
  socialName: string | null;
  cpf: string;
  birthDate: string;
  personalEmail: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  photoPath: string | null;
  userId: string | null;
  corporateEmail: string | null;
  businessUnitId: string;
  departmentId: string | null;
  positionId: string | null;
  managerEmployeeId: string | null;
  hireDate: string;
  employmentType: EmploymentType;
  workSchedule: string | null;
  workMode: WorkMode;
  status: EmployeeStatus;
  internalNotes: string | null;
}

export interface HrOption {
  id: string;
  name: string;
  code?: string;
  businessUnitId?: string | null;
}

export interface EmploymentContract {
  id: string;
  employee_id: string;
  legal_entity_id: string;
  business_unit_id: string;
  position_id: string | null;
  contract_type: EmploymentType;
  start_date: string;
  end_date: string | null;
  amount: number | null;
  payment_frequency: string | null;
  payment_method: string | null;
  work_schedule: string | null;
  work_mode: WorkMode;
  status: string;
  file_path: string | null;
  notes: string | null;
  is_primary: boolean;
  version: number;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type_id: string;
  name: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
  issued_at: string | null;
  expires_at: string | null;
  visibility: string;
  status: string;
  version: number;
  uploaded_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason: string | null;
  document_storage_path: string | null;
  status: string;
  manager_employee_id: string | null;
  decision_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  version: number;
}

export interface EmployeePayment {
  id: string;
  employee_id: string;
  contract_id: string | null;
  competence: string;
  description: string;
  base_amount: number;
  additions: number;
  informational_deductions: number;
  final_amount: number;
  expected_date: string;
  payment_date: string | null;
  payment_method: string | null;
  status: string;
  proof_storage_path: string | null;
  notes: string | null;
  version: number;
}

export interface OnboardingProcess {
  id: string;
  employee_id: string;
  expected_start_date: string;
  responsible_user_id: string;
  status: string;
  completion_percentage: number;
  notes: string | null;
  version: number;
}

export interface ProcessTask {
  id: string;
  onboarding_process_id?: string;
  offboarding_process_id?: string;
  title: string;
  responsible_user_id: string | null;
  due_date: string | null;
  required: boolean;
  status: string;
  notes: string | null;
  sort_order: number;
  version: number;
}

export interface OffboardingProcess {
  id: string;
  employee_id: string;
  last_working_day: string;
  effective_termination_date: string | null;
  reason: string;
  responsible_user_id: string;
  status: string;
  financial_pending: boolean;
  document_pending: boolean;
  equipment_pending: boolean;
  access_pending: boolean;
  version: number;
}

export interface Equipment {
  id: string;
  business_unit_id: string | null;
  equipment_type: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_number: string | null;
  condition: string;
  status: string;
  notes: string | null;
  version: number;
}

export interface EquipmentAssignment {
  id: string;
  equipment_id: string;
  employee_id: string;
  delivered_at: string;
  expected_return_date: string | null;
  returned_at: string | null;
  delivery_condition: string;
  return_condition: string | null;
  status: string;
  notes: string | null;
  version: number;
}

export interface EmployeeAccess {
  id: string;
  employee_id: string;
  platform: string;
  account_identifier: string | null;
  access_type: string | null;
  granted_at: string | null;
  status: string;
  revoked_at: string | null;
  notes: string | null;
  version: number;
}

export interface HrSetting {
  id: string;
  business_unit_id: string | null;
  contract_expiry_alert_days: number;
  document_expiry_alert_days: number;
  version: number;
}

export interface HrPermissions {
  manageEmployees: boolean;
  manageContracts: boolean;
  manageDocuments: boolean;
  manageLeave: boolean;
  approveLeave: boolean;
  managePayments: boolean;
  manageOnboarding: boolean;
  manageOffboarding: boolean;
  manageAccesses: boolean;
  manageSettings: boolean;
}

export interface HrDirectory {
  summary: HrDashboardSummary;
  employees: EmployeeDirectoryRow[];
  businessUnits: HrOption[];
  departments: HrOption[];
  positions: HrOption[];
  legalEntities: HrOption[];
  users: HrOption[];
  documentTypes: HrOption[];
  leaveTypes: HrOption[];
  contracts: EmploymentContract[];
  documents: EmployeeDocument[];
  leaves: LeaveRequest[];
  payments: EmployeePayment[];
  onboardings: OnboardingProcess[];
  onboardingTasks: ProcessTask[];
  offboardings: OffboardingProcess[];
  offboardingTasks: ProcessTask[];
  equipment: Equipment[];
  assignments: EquipmentAssignment[];
  accesses: EmployeeAccess[];
  settings: HrSetting[];
  permissions: HrPermissions;
}
