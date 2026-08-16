export interface FiscalDocument {
  id: string;
  financial_document_id: string;
  fiscal_document_type:
    "commercial_invoice" | "nfe" | "nfse" | "service_receipt" | "credit_note" | "debit_note";
  fiscal_number: string;
  series: string | null;
  access_key: string | null;
  issuer_tax_id: string | null;
  recipient_tax_id: string | null;
  service_code: string | null;
  tax_regime: string | null;
  issued_at: string | null;
  status: "draft" | "authorized" | "denied" | "cancelled" | "corrected";
  authorization_protocol: string | null;
  authorized_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  storage_provider: string;
  xml_bucket: string | null;
  xml_object_key: string | null;
  xml_checksum_sha256: string | null;
  pdf_bucket: string | null;
  pdf_object_key: string | null;
  operation_type: "entrada" | "saida";
  note_type: "nfse" | "nfe" | "nfce";
  workflow_status: "emitida" | "pendente" | "paga" | "cancelada";
  operation_nature: string | null;
  municipality_code: string | null;
  cfop: string | null;
  service_description: string | null;
  due_date: string | null;
  party_id: string | null;
  recipient_name: string | null;
  recipient_state_registration: string | null;
  recipient_municipal_registration: string | null;
  recipient_email: string | null;
  recipient_address: string | null;
  recipient_city: string | null;
  recipient_state: string | null;
  recipient_postal_code: string | null;
  service_amount: number;
  deductions_amount: number;
  calculation_base: number;
  iss_rate: number;
  iss_amount: number;
  iss_withheld: boolean;
  pis_amount: number;
  cofins_amount: number;
  inss_amount: number;
  irrf_amount: number;
  csll_amount: number;
  net_amount: number;
  payment_method: string | null;
  payment_terms: string | null;
  notes: string | null;
  version: number;
}

export interface FiscalDocumentItem {
  id: string;
  fiscal_document_id: string;
  sequence_no: number;
  description: string;
  service_code: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  created_at: string;
}

export interface FiscalEvent {
  id: string;
  fiscal_document_id: string;
  sequence_no: number;
  event_type:
    | "authorization"
    | "cancellation"
    | "correction"
    | "denial"
    | "inutilization"
    | "protocol"
    | "return";
  event_status: "pending" | "accepted" | "rejected";
  occurred_at: string;
  protocol: string | null;
  reason: string | null;
  xml_bucket: string | null;
  xml_object_key: string | null;
  xml_checksum_sha256: string | null;
  response_code: string | null;
  response_message: string | null;
  version: number;
}

export interface FiscalPartyOption {
  id: string;
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
  status: string;
}

export interface FiscalPartyContact {
  party_id: string;
  contact_type: string;
  value: string;
  is_primary: boolean;
  status: string;
}

export interface FiscalPartyAddress {
  party_id: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state_region: string | null;
  postal_code: string | null;
  is_primary: boolean;
  status: string;
}

export interface FiscalBusinessUnitOption {
  id: string;
  code: string;
  name: string;
  legal_entity_id: string;
  status: string;
}

export interface FiscalLegalEntityOption {
  id: string;
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
}

export interface FiscalFinancialDocumentOption {
  id: string;
  document_number: string;
  description: string;
  issue_date?: string;
  due_date?: string;
  competence_date?: string;
  notes?: string;
  party_id?: string;
  status: string;
  original_currency_code: string;
  original_amount: number;
  business_unit_id: string;
  document_nature: string;
  source_type: string;
  counterparty_account_id: string;
}

export interface FiscalDirectory {
  fiscalDocuments: FiscalDocument[];
  fiscalDocumentItems: FiscalDocumentItem[];
  fiscalEvents: FiscalEvent[];
  financialDocuments: FiscalFinancialDocumentOption[];
  fiscalParties: FiscalPartyOption[];
  fiscalPartyContacts: FiscalPartyContact[];
  fiscalPartyAddresses: FiscalPartyAddress[];
  fiscalBusinessUnits: FiscalBusinessUnitOption[];
  fiscalLegalEntities: FiscalLegalEntityOption[];
}

export interface FiscalDocumentItemInput {
  description: string;
  service_code: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
}

export interface FiscalDocumentBundleInput {
  business_unit_id: string;
  party_id: string;
  operation_type: "entrada" | "saida";
  numero: string;
  serie: string;
  tipo_nota: "nfse" | "nfe" | "nfce";
  data_emissao: string;
  vencimento: string;
  workflow_status: "emitida" | "pendente" | "paga" | "cancelada";
  natureza_operacao: string;
  codigo_servico_municipal: string;
  codigo_municipio: string;
  cfop: string;
  descricao_servicos: string;
  tomador_cnpj: string;
  tomador_razao_social: string;
  tomador_inscricao_estadual: string;
  tomador_inscricao_municipal: string;
  tomador_email: string;
  tomador_endereco: string;
  tomador_cidade: string;
  tomador_uf: string;
  tomador_cep: string;
  valor_servicos: number;
  valor_deducoes: number;
  base_calculo: number;
  aliquota_iss: number;
  valor_iss: number;
  iss_retido: boolean;
  valor_pis: number;
  valor_cofins: number;
  valor_inss: number;
  valor_ir: number;
  valor_csll: number;
  valor_liquido: number;
  forma_pagamento: string;
  condicao_pagamento: string;
  itens: FiscalDocumentItemInput[];
  pdf_object_key: string | null;
  observacoes: string;
}
