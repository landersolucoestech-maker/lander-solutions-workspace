export interface BankStatementImport {
  id: string;
  cash_account_id: string;
  statement_format: "OFX";
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  currency_code: string;
  storage_provider: string;
  storage_bucket: string | null;
  storage_object_key: string;
  checksum_sha256: string;
  status: "uploaded" | "validated" | "reconciled" | "cancelled";
  imported_at: string;
  updated_at: string;
  version: number;
}

export interface BankStatementLine {
  id: string;
  statement_import_id: string;
  business_unit_id: string;
  sequence_no: number;
  transaction_date: string;
  value_date: string | null;
  transaction_type: "credit" | "debit";
  amount: number;
  currency_code: string;
  bank_reference: string | null;
  memo: string | null;
  counterparty_name: string | null;
  balance_after: number | null;
  category_id: string | null;
  party_id: string | null;
  financial_document_id: string | null;
  notes: string | null;
  attachment_reference: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  match_status: "unmatched" | "matched" | "ignored";
  matched_settlement_id: string | null;
  matched_journal_entry_id: string | null;
  ignored_reason: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface BankOperationsDirectory {
  statementImports: BankStatementImport[];
  statementLines: BankStatementLine[];
}
