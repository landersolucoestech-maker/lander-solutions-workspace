export type FinancialDocumentNature = "payable" | "receivable";
export type FinancialDocumentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "issued"
  | "partially_settled"
  | "settled"
  | "overdue"
  | "in_dispute"
  | "cancelled"
  | "reversed";

export type FinancialDocument = {
  id: string;
  legal_entity_id: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  contract_id: string | null;
  party_id: string;
  cost_center_id: string | null;
  revenue_center_id: string | null;
  category_id: string | null;
  document_nature: FinancialDocumentNature;
  source_type: string;
  document_number: string;
  description: string;
  issue_date: string;
  competence_date: string;
  due_date: string;
  original_currency_code: string;
  original_amount: number;
  fx_rate: number;
  fx_date: string;
  fx_source: string;
  functional_currency_code: string;
  functional_amount: number;
  tax_amount_functional: number;
  fee_amount_functional: number;
  classification_status: "classified" | "pending_classification";
  classification_due_at: string | null;
  classification_responsible_user_id: string | null;
  counterparty_account_id: string;
  status: FinancialDocumentStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  journal_entry_id: string | null;
  external_reference: string | null;
  attachment_reference: string | null;
  notes: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialDocumentLine = {
  id: string;
  financial_document_id: string;
  sequence_no: number;
  managerial_account_id: string;
  category_id: string | null;
  cost_center_id: string | null;
  revenue_center_id: string | null;
  project_id: string | null;
  product_id: string | null;
  service_line_id: string | null;
  description: string;
  original_amount: number;
  functional_amount: number;
  tax_amount_functional: number;
  allocation_status: "direct" | "pending_allocation" | "allocated";
  version: number;
  created_at: string;
  updated_at: string;
};
