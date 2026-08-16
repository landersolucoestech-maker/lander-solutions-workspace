import type {
  CompanyContactPerson,
  ContactAddress,
  ContactCommunications,
  ContactFormPayload,
  ContactRepresentative,
  LeadFormPayload,
  ProtectedBankAccount,
} from "./form-types";
import type { CrmLead } from "./types";

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calculate = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(9) === Number(cpf[9]) && calculate(10) === Number(cpf[10]);
}

export function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calculate = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13]);
}

export function isValidEmail(value: string) {
  return !value.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

export function isValidPhone(value: string) {
  if (!value.trim()) return true;
  const digits = onlyDigits(value);
  return digits.length >= 10 && digits.length <= 15;
}

export function maskCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatPhone(value: string) {
  const prefix = value.trim().startsWith("+") ? "+" : "";
  const digits = onlyDigits(value).slice(0, 15);
  if (prefix || digits.length > 11) return `${prefix}${digits}`;
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function emptyCommunications(): ContactCommunications {
  return {
    primaryEmail: "",
    secondaryEmail: "",
    financialEmail: "",
    fiscalEmail: "",
    legalEmail: "",
    primaryPhone: "",
    secondaryPhone: "",
    whatsapp: "",
    website: "",
    instagram: "",
    linkedin: "",
  };
}

export function emptyAddress(): ContactAddress {
  return {
    postalCode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    country: "Brasil",
    reference: "",
  };
}

export function emptyRepresentative(): ContactRepresentative {
  return {
    representativeType: "legal_representative",
    fullName: "",
    cpf: "",
    rg: "",
    roleTitle: "",
    birthDate: "",
    email: "",
    phone: "",
    whatsapp: "",
    ownershipPercentage: "",
    isPrimaryLegalRepresentative: false,
    canSign: false,
  };
}

export function emptyCompanyContact(): CompanyContactPerson {
  return {
    fullName: "",
    roleTitle: "",
    department: "",
    email: "",
    phone: "",
    whatsapp: "",
    isPrimary: false,
    receivesFinancial: false,
    receivesFiscal: false,
    receivesContractual: false,
  };
}

export function emptyBankAccount(): ProtectedBankAccount {
  return {
    holderName: "",
    holderTaxId: "",
    bankName: "",
    bankCode: "",
    agency: "",
    agencyDigit: "",
    accountType: "checking",
    accountNumber: "",
    accountDigit: "",
    pixKey: "",
    pixKeyType: "cpf_cnpj",
    isPrimary: false,
  };
}

export function emptyContactPayload(sourceLead?: CrmLead): ContactFormPayload {
  const isPerson = sourceLead?.lead_type === "person";
  return {
    sourceLeadId: sourceLead?.id,
    partyType: sourceLead ? (isPerson ? "person" : "organization") : "",
    status: "active",
    category: "client",
    businessUnitId: sourceLead?.business_unit_id ?? "",
    responsibleUserId: sourceLead?.owner_user_id ?? "",
    registrationOrigin: sourceLead?.source ?? "",
    tags: [],
    notes: sourceLead?.notes ?? "",
    communications: {
      ...emptyCommunications(),
      primaryEmail: sourceLead?.email ?? "",
      primaryPhone: sourceLead?.phone ?? "",
      whatsapp: sourceLead?.whatsapp ?? "",
      website: sourceLead?.website ?? "",
    },
    address: {
      ...emptyAddress(),
      city: sourceLead?.city ?? "",
      state: sourceLead?.state_region ?? "",
    },
    person: isPerson
      ? {
          fullName: sourceLead?.contact_name ?? "",
          socialName: "",
          cpf: sourceLead?.tax_id ?? "",
          rg: "",
          rgIssuer: "",
          rgState: "",
          rgIssuedOn: "",
          birthDate: sourceLead?.birth_date ?? "",
          nationality: "Brasileira",
          birthplace: "",
          maritalStatus: "",
          profession: sourceLead?.profession_activity ?? "",
          gender: "",
          motherName: "",
          fatherName: "",
          company: "",
          jobTitle: "",
          department: "",
          companyCnpj: "",
          professionalEmail: "",
          professionalPhone: "",
        }
      : null,
    organization:
      sourceLead && !isPerson
        ? {
            legalName: sourceLead.company_name ?? "",
            tradeName: sourceLead.trade_name ?? sourceLead.company_name ?? "",
            cnpj: sourceLead.tax_id ?? "",
            stateRegistration: "",
            stateRegistrationIndicator: "non_taxpayer",
            municipalRegistration: "",
            openedOn: "",
            legalNature: "",
            companySize: sourceLead.company_size ?? "",
            corporateType: "",
            taxRegime: "",
            primaryCnae: "",
            secondaryCnaes: "",
            shareCapital: "",
            registrationStatus: "",
            registrationStatusOn: "",
            registrationAuthority: "",
            commercialRegistryNumber: "",
            nire: "",
            suframa: "",
            simplesNacional: false,
            mei: false,
            withholdsTaxes: false,
            withholdingRules: "",
            invoiceEmail: "",
            billingEmail: "",
            preferredDueDay: "",
            paymentTerms: "",
            creditLimit: "",
            defaultCurrency: "BRL",
            fiscalNotes: "",
          }
        : null,
    representatives:
      sourceLead && !isPerson
        ? [
            {
              ...emptyRepresentative(),
              fullName: sourceLead.contact_name,
              roleTitle: sourceLead.contact_role ?? "",
              email: sourceLead.email ?? "",
              phone: sourceLead.phone ?? "",
              whatsapp: sourceLead.whatsapp ?? "",
              isPrimaryLegalRepresentative: true,
            },
          ]
        : [],
    companyContacts:
      sourceLead && !isPerson
        ? [
            {
              ...emptyCompanyContact(),
              fullName: sourceLead.contact_name,
              roleTitle: sourceLead.contact_role ?? "",
              email: sourceLead.email ?? "",
              phone: sourceLead.phone ?? "",
              whatsapp: sourceLead.whatsapp ?? "",
              isPrimary: true,
            },
          ]
        : [],
    bankAccounts: [],
  };
}

export function emptyLeadPayload(ownerUserId = ""): LeadFormPayload {
  return {
    leadType: "",
    person: null,
    organization: null,
    phone: "",
    whatsapp: "",
    email: "",
    city: "",
    state: "",
    serviceInterests: [{ serviceLineId: "", customService: "", isPrimary: true }],
    needSummary: "",
    contactPreference: "",
    bestContactTime: "",
    source: "other",
    campaign: "",
    referredBy: "",
    status: "new",
    priority: "medium",
    ownerUserId,
    lastContactAt: "",
    nextAction: "",
    nextContactAt: "",
    internalNotes: "",
  };
}

export function hasMeaningfulObjectData(value: unknown) {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some((item) => {
    if (typeof item === "boolean") return item;
    if (Array.isArray(item)) return item.length > 0;
    return String(item ?? "").trim().length > 0;
  });
}
