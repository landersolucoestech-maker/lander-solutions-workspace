export interface PayoutObligation {
  id: string;
  participation_calculation_id: string;
  participation_calculation_line_id: string;
  legal_entity_id: string;
  business_unit_id: string;
  contract_id: string;
  contract_version_id: string;
  beneficiary_party_id: string;
  currency_code: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: "open" | "partially_paid" | "paid" | "cancelled";
  financial_document_id: string | null;
  posted_at: string;
  created_by: string;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PayoutPayment {
  id: string;
  payout_obligation_id: string;
  financial_settlement_id: string;
  paid_on: string;
  amount: number;
  currency_code: string;
  status: "draft" | "posted" | "reversed";
  posted_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  created_by: string;
  updated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SettlementOption {
  id: string;
  financial_document_id: string;
  settlement_date: string;
  original_currency_code: string;
  original_amount: number;
  functional_amount: number;
  external_reference: string | null;
  cash_account_name: string;
}

export interface ContractOption {
  id: string;
  code: string;
  title: string;
  currency_code: string;
  status: string;
}

export interface PartyOption {
  id: string;
  legal_name: string;
  trade_name: string | null;
  status: string;
}

export interface BusinessUnitOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface PayoutWorkspace {
  obligations: PayoutObligation[];
  payments: PayoutPayment[];
  contracts: ContractOption[];
  parties: PartyOption[];
  businessUnits: BusinessUnitOption[];
}
