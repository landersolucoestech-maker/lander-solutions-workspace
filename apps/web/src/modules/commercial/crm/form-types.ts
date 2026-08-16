import type { CrmLeadStatus } from "./types";

export type ContactPartyType = "" | "person" | "organization";
export type ContactStatus = "active" | "inactive" | "blocked" | "under_review";
export type ContactCategory =
  "client" | "supplier" | "partner" | "service_provider" | "collaborator" | "other";

export const contactCategoryOptions: ReadonlyArray<readonly [ContactCategory, string]> = [
  ["client", "Cliente"],
  ["supplier", "Fornecedor"],
  ["partner", "Parceiro"],
  ["service_provider", "Prestador de serviço"],
  ["collaborator", "Colaborador"],
  ["other", "Outro"],
];

export function contactCategoryLabel(category: string | null | undefined): string {
  return contactCategoryOptions.find(([value]) => value === category)?.[1] ?? "Outro";
}

export interface ContactCommunications {
  primaryEmail: string;
  secondaryEmail: string;
  financialEmail: string;
  fiscalEmail: string;
  legalEmail: string;
  primaryPhone: string;
  secondaryPhone: string;
  whatsapp: string;
  website: string;
  instagram: string;
  linkedin: string;
}

export interface ContactAddress {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  country: string;
  reference: string;
}

export interface PersonContactData {
  fullName: string;
  socialName: string;
  cpf: string;
  rg: string;
  rgIssuer: string;
  rgState: string;
  rgIssuedOn: string;
  birthDate: string;
  nationality: string;
  birthplace: string;
  maritalStatus: string;
  profession: string;
  gender: string;
  motherName: string;
  fatherName: string;
  company: string;
  jobTitle: string;
  department: string;
  companyCnpj: string;
  professionalEmail: string;
  professionalPhone: string;
}

export interface OrganizationContactData {
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  stateRegistrationIndicator: "taxpayer" | "exempt" | "non_taxpayer";
  municipalRegistration: string;
  openedOn: string;
  legalNature: string;
  companySize: string;
  corporateType: string;
  taxRegime: string;
  primaryCnae: string;
  secondaryCnaes: string;
  shareCapital: string;
  registrationStatus: string;
  registrationStatusOn: string;
  registrationAuthority: string;
  commercialRegistryNumber: string;
  nire: string;
  suframa: string;
  simplesNacional: boolean;
  mei: boolean;
  withholdsTaxes: boolean;
  withholdingRules: string;
  invoiceEmail: string;
  billingEmail: string;
  preferredDueDay: string;
  paymentTerms: string;
  creditLimit: string;
  defaultCurrency: string;
  fiscalNotes: string;
}

export interface ContactRepresentative {
  id?: string;
  representativeType: "legal_representative" | "partner" | "administrator";
  fullName: string;
  cpf: string;
  rg: string;
  roleTitle: string;
  birthDate: string;
  email: string;
  phone: string;
  whatsapp: string;
  ownershipPercentage: string;
  isPrimaryLegalRepresentative: boolean;
  canSign: boolean;
}

export interface CompanyContactPerson {
  id?: string;
  fullName: string;
  roleTitle: string;
  department: string;
  email: string;
  phone: string;
  whatsapp: string;
  isPrimary: boolean;
  receivesFinancial: boolean;
  receivesFiscal: boolean;
  receivesContractual: boolean;
}

export interface ProtectedBankAccount {
  id?: string;
  version?: number;
  holderName: string;
  holderTaxId: string;
  bankName: string;
  bankCode: string;
  agency: string;
  agencyDigit: string;
  accountType: string;
  accountNumber: string;
  accountNumberMasked?: string;
  accountDigit: string;
  pixKey: string;
  pixKeyMasked?: string;
  pixKeyType: string;
  isPrimary: boolean;
}

export interface ContactDocumentMetadata {
  id: string;
  party_id: string;
  document_type: string;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_bucket: string | null;
  storage_object_key: string | null;
  status: string;
  uploaded_by: string | null;
  uploaded_at: string | null;
  created_at: string;
}

export interface ContactFormPayload {
  id?: string;
  expectedVersion?: number;
  sourceLeadId?: string;
  partyType: ContactPartyType;
  status: ContactStatus;
  category: ContactCategory;
  businessUnitId: string;
  responsibleUserId: string;
  registrationOrigin: string;
  tags: string[];
  notes: string;
  communications: ContactCommunications;
  address: ContactAddress;
  person: PersonContactData | null;
  organization: OrganizationContactData | null;
  representatives: ContactRepresentative[];
  companyContacts: CompanyContactPerson[];
  bankAccounts: ProtectedBankAccount[];
}

export interface ContactFormRecord extends ContactFormPayload {
  id: string;
  expectedVersion: number;
  documents: ContactDocumentMetadata[];
}

export type LeadType = "" | "person" | "organization";
export type LeadPriority = "low" | "medium" | "high" | "urgent";
export type LeadSource =
  | "website"
  | "online_form"
  | "whatsapp"
  | "phone"
  | "email"
  | "social"
  | "referral"
  | "prospecting"
  | "partner"
  | "other";

export interface LeadPersonData {
  fullName: string;
  cpf: string;
  birthDate: string;
  profession: string;
}

export interface LeadOrganizationData {
  legalName: string;
  tradeName: string;
  cnpj: string;
  segment: string;
  companySize: string;
  website: string;
  contactName: string;
  contactRole: string;
}

export interface LeadServiceInterest {
  id?: string;
  serviceLineId: string;
  customService: string;
  isPrimary: boolean;
}

export interface LeadFormPayload {
  id?: string;
  expectedVersion?: number;
  leadType: LeadType;
  person: LeadPersonData | null;
  organization: LeadOrganizationData | null;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  state: string;
  serviceInterests: LeadServiceInterest[];
  needSummary: string;
  contactPreference: string;
  bestContactTime: string;
  source: LeadSource;
  campaign: string;
  referredBy: string;
  status: CrmLeadStatus;
  priority: LeadPriority;
  ownerUserId: string;
  lastContactAt: string;
  nextAction: string;
  nextContactAt: string;
  internalNotes: string;
}

export interface LeadDiagnostic {
  id: string;
  lead_id: string;
  service_line_id: string | null;
  delivery_mode: "internal" | "external";
  status: "draft" | "sent" | "in_progress" | "completed" | "cancelled";
  public_token: string | null;
  due_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
