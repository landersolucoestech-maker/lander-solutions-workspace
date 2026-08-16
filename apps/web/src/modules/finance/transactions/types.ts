import type { PartyLookup } from "@/modules/parties";
import type { FinancialDocument, FinancialDocumentLine } from "./financial-document-types";

export type {
  FinancialDocument,
  FinancialDocumentLine,
  FinancialDocumentNature,
  FinancialDocumentStatus,
} from "./financial-document-types";
export type { PartyLookup as PartyOption } from "@/modules/parties";

export type ManagerialAccount = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  account_type: string;
  normal_balance: "debit" | "credit";
  reporting_group:
    | "direct_cost"
    | "exclusive_expense"
    | "shared_expense"
    | "participation_expense"
    | "tax_expense"
    | "fee_expense"
    | null;
  posting_allowed: boolean;
  status: "active" | "inactive";
  is_system: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

export type CashAccount = {
  id: string;
  legal_entity_id: string;
  business_unit_id: string;
  managerial_account_id: string;
  code: string;
  name: string;
  account_type: string;
  currency_code: string;
  institution_name: string | null;
  masked_identifier: string | null;
  external_vault_reference: string | null;
  integration_status: "manual" | "connected" | "syncing" | "error" | "disconnected";
  last_synced_at: string | null;
  sync_error: string | null;
  current_balance: number;
  status: "active" | "inactive" | "closed";
  version: number;
  created_at: string;
  updated_at: string;
};

export type ExchangeRate = {
  id: string;
  base_currency_code: string;
  quote_currency_code: string;
  rate_date: string;
  rate: number;
  source: string;
  source_reference: string | null;
  status: "active" | "superseded" | "inactive";
  version: number;
  created_at: string;
  updated_at: string;
};

export type FinancialSettlement = {
  id: string;
  financial_document_id: string;
  cash_account_id: string;
  settlement_date: string;
  original_currency_code: string;
  original_amount: number;
  fx_rate: number;
  functional_amount: number;
  bank_fee_functional: number;
  fee_account_id: string | null;
  status: "draft" | "pending_approval" | "posted" | "reversed" | "cancelled";
  requested_by: string | null;
  requested_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
  journal_entry_id: string | null;
  external_reference: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  legal_entity_id: string;
  financial_period_id: string;
  entry_number: number;
  source_type: string;
  source_id: string | null;
  competence_date: string;
  posting_date: string | null;
  description: string;
  status: "draft" | "validated" | "posted" | "reversed";
  reversal_of_entry_id: string | null;
  reversed_by_entry_id: string | null;
  total_debit: number;
  total_credit: number;
  created_by: string | null;
  validated_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type JournalLine = {
  id: string;
  journal_entry_id: string;
  line_no: number;
  managerial_account_id: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  contract_id: string | null;
  party_id: string | null;
  cost_center_id: string | null;
  revenue_center_id: string | null;
  category_id: string | null;
  debit_amount: number;
  credit_amount: number;
  original_currency_code: string | null;
  original_amount: number | null;
  fx_rate: number | null;
  description: string | null;
  created_at: string;
};

export type FinancialApproval = {
  id: string;
  object_type: "document" | "settlement" | "journal_entry";
  object_id: string;
  requested_by: string;
  approver_user_id: string | null;
  decision: string;
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
};

export type ContractOption = {
  id: string;
  code: string;
  title: string;
  business_unit_id: string;
  status: string;
};

export type FinancialDirectory = {
  accounts: ManagerialAccount[];
  cashAccounts: CashAccount[];
  exchangeRates: ExchangeRate[];
  documents: FinancialDocument[];
  documentLines: FinancialDocumentLine[];
  settlements: FinancialSettlement[];
  journalEntries: JournalEntry[];
  journalLines: JournalLine[];
  approvals: FinancialApproval[];
  parties: PartyLookup[];
  contracts: ContractOption[];
};
