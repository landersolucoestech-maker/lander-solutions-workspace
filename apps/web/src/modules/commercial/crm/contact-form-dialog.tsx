import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileUp, LoaderCircle, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import type { CrmReferenceData } from "./reference-data-api";
import { deletePartyRecord, updatePartyRecord } from "@/modules/parties";
import type { PartiesData, Party } from "@/modules/parties";
import {
  AddRowButton,
  CheckboxField,
  FormSection,
  InfoField,
  RepeatableCard,
  SelectField,
  TextAreaField,
  TextField,
} from "./crm-form-fields";
import {
  deleteContactDocument,
  getContactDocumentUrl,
  getContactForm,
  saveContactForm,
  uploadContactDocument,
} from "./forms-api";
import type {
  CompanyContactPerson,
  ContactDocumentMetadata,
  ContactFormPayload,
  ContactFormRecord,
  ContactPartyType,
  ContactRepresentative,
  OrganizationContactData,
  PersonContactData,
  ProtectedBankAccount,
} from "./form-types";
import { contactCategoryLabel, contactCategoryOptions } from "./form-types";
import {
  emptyBankAccount,
  emptyCompanyContact,
  emptyContactPayload,
  emptyRepresentative,
  formatPhone,
  hasMeaningfulObjectData,
  isValidCnpj,
  isValidCpf,
  isValidEmail,
  isValidPhone,
  maskCnpj,
  maskCpf,
} from "./form-utils";
import type { CrmLead, CrmOption } from "./types";

export type ContactDialogState =
  | { action: "create"; sourceLead?: CrmLead }
  | { action: "view" | "edit" | "destroy"; record: Party }
  | null;

interface ContactFormDialogProps {
  state: ContactDialogState;
  parties: PartiesData;
  structure: CrmReferenceData;
  profiles: CrmOption[];
  canManage: boolean;
  canReadSensitive: boolean;
  canManageSensitive: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

interface PendingDocument {
  id: string;
  documentType: string;
  file: File | null;
}

const contactStatusOptions = [
  ["active", "Ativo"],
  ["inactive", "Inativo"],
  ["blocked", "Bloqueado"],
  ["under_review", "Em análise"],
] as const;

const documentTypesPerson = [
  "Documento de identificação",
  "Comprovante de CPF",
  "Comprovante de endereço",
  "Comprovante bancário",
  "Contrato",
  "Procuração",
  "Outro documento",
];
const documentTypesOrganization = [
  "Cartão CNPJ",
  "Contrato social",
  "Última alteração contratual",
  "Certidão simplificada",
  "Inscrição estadual",
  "Inscrição municipal",
  "Comprovante de endereço",
  "Documento de representante legal",
  "Procuração",
  "Comprovante bancário",
  "Certidão fiscal",
  "Alvará ou licença",
  "Contrato",
  "Outro documento",
];

function blankPerson(): PersonContactData {
  return {
    fullName: "",
    socialName: "",
    cpf: "",
    rg: "",
    rgIssuer: "",
    rgState: "",
    rgIssuedOn: "",
    birthDate: "",
    nationality: "Brasileira",
    birthplace: "",
    maritalStatus: "",
    profession: "",
    gender: "",
    motherName: "",
    fatherName: "",
    company: "",
    jobTitle: "",
    department: "",
    companyCnpj: "",
    professionalEmail: "",
    professionalPhone: "",
  };
}

function partyContactTypeLabel(value: string): string {
  return (
    { email: "E-mail", phone: "Telefone", mobile: "Celular", website: "Website", other: "Outro" }[
      value
    ] ?? value
  );
}

function partyAddressTypeLabel(value: string): string {
  return (
    {
      legal: "Endereço legal",
      billing: "Endereço de cobrança",
      service: "Endereço de atendimento",
      residential: "Endereço residencial",
      other: "Outro endereço",
    }[value] ?? value
  );
}

function partyRoleLabel(value: string): string {
  return (
    {
      client: "Cliente",
      supplier: "Fornecedor",
      partner: "Parceiro",
      service_provider: "Prestador de serviço",
      participant: "Participante",
      investor: "Investidor",
      carrier: "Transportador",
      international_client: "Cliente internacional",
      technology_client: "Cliente de tecnologia",
      education_client: "Cliente educacional",
      services_client: "Cliente de serviços",
    }[value] ?? value
  );
}

function blankOrganization(): OrganizationContactData {
  return {
    legalName: "",
    tradeName: "",
    cnpj: "",
    stateRegistration: "",
    stateRegistrationIndicator: "non_taxpayer",
    municipalRegistration: "",
    openedOn: "",
    legalNature: "",
    companySize: "",
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
  };
}

function normalizeContact(input: ContactFormRecord): ContactFormRecord {
  return {
    ...emptyContactPayload(),
    ...input,
    communications: { ...emptyContactPayload().communications, ...input.communications },
    address: { ...emptyContactPayload().address, ...input.address },
    person: input.partyType === "person" ? { ...blankPerson(), ...(input.person ?? {}) } : null,
    organization:
      input.partyType === "organization"
        ? { ...blankOrganization(), ...(input.organization ?? {}) }
        : null,
    representatives: input.representatives ?? [],
    companyContacts: input.companyContacts ?? [],
    bankAccounts: input.bankAccounts ?? [],
    documents: input.documents ?? [],
  };
}

export function ContactFormDialog(props: ContactFormDialogProps) {
  const { state } = props;
  const record = state && state.action !== "create" ? state.record : null;
  const detailsQuery = useQuery({
    queryKey: ["crm-contact-form", record?.id],
    queryFn: () => getContactForm(record!.id),
    enabled: Boolean(record && state?.action !== "destroy"),
  });

  if (!state) return null;
  if (state.action === "destroy") {
    return <DeleteContactDialog {...props} record={state.record} />;
  }
  if (record && detailsQuery.isLoading) {
    return (
      <Dialog open onOpenChange={(open) => !open && props.onClose()}>
        <DialogContent>
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando cadastro completo…
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  if (record && (detailsQuery.error || !detailsQuery.data)) {
    return (
      <Dialog open onOpenChange={(open) => !open && props.onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Falha ao carregar contato</DialogTitle>
            <DialogDescription>
              {detailsQuery.error instanceof Error
                ? detailsQuery.error.message
                : "O cadastro completo não está disponível."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const sourceLead = state.action === "create" ? state.sourceLead : undefined;
  const initial = record
    ? normalizeContact(detailsQuery.data!.contact)
    : emptyContactPayload(sourceLead);
  return (
    <ContactFormBody
      key={
        record
          ? `${record.id}-${record.version}-${state.action}`
          : `new-${sourceLead?.id ?? "contact"}`
      }
      {...props}
      state={state}
      initial={initial}
      effectiveSensitiveRead={
        props.canReadSensitive && (detailsQuery.data?.canReadSensitive ?? true)
      }
    />
  );
}

function ContactFormBody({
  state,
  initial,
  parties,
  structure,
  profiles,
  canManage,
  canManageSensitive,
  effectiveSensitiveRead,
  onClose,
  onChanged,
}: ContactFormDialogProps & {
  state: Exclude<ContactDialogState, null | { action: "destroy"; record: Party }>;
  initial: ContactFormPayload | ContactFormRecord;
  effectiveSensitiveRead: boolean;
}) {
  const isView = state.action === "view";
  const [form, setForm] = useState<ContactFormPayload>(initial);
  const [documents, setDocuments] = useState<ContactDocumentMetadata[]>(
    "documents" in initial ? initial.documents : [],
  );
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const partyId = state.action === "create" ? null : state.record.id;
  const activeContacts = partyId
    ? parties.contacts.filter((item) => item.party_id === partyId && item.status === "active")
    : [];
  const activeAddresses = partyId
    ? parties.addresses.filter((item) => item.party_id === partyId && item.status === "active")
    : [];
  const additionalRoles = partyId
    ? parties.roles.filter(
        (item) =>
          item.party_id === partyId && item.status === "active" && item.role_code !== form.category,
      )
    : [];

  const documentTypes =
    form.partyType === "person" ? documentTypesPerson : documentTypesOrganization;
  const unitOptions = useMemo(
    () => [
      ["", "Sem unidade específica"] as const,
      ...structure.businessUnits
        .filter((item) => item.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((item) => [item.id, `${item.code} — ${item.name}`] as const),
    ],
    [structure.businessUnits],
  );
  const profileOptions = useMemo(
    () => [
      ["", "Sem responsável definido"] as const,
      ...profiles.map((item) => [item.id, item.name] as const),
    ],
    [profiles],
  );

  function patch<K extends keyof ContactFormPayload>(key: K, value: ContactFormPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function patchPerson(key: keyof PersonContactData, value: string) {
    setForm((current) => ({
      ...current,
      person: { ...(current.person ?? blankPerson()), [key]: value },
    }));
  }

  function patchOrganization<K extends keyof OrganizationContactData>(
    key: K,
    value: OrganizationContactData[K],
  ) {
    setForm((current) => ({
      ...current,
      organization: { ...(current.organization ?? blankOrganization()), [key]: value },
    }));
  }

  function changePartyType(next: ContactPartyType) {
    if (next === form.partyType) return;
    const hasOldData =
      form.partyType === "person"
        ? hasMeaningfulObjectData(form.person)
        : form.partyType === "organization"
          ? hasMeaningfulObjectData(form.organization) ||
            form.representatives.length > 0 ||
            form.companyContacts.length > 0
          : false;
    if (
      hasOldData &&
      !window.confirm(
        "A alteração do tipo de pessoa apagará os dados incompatíveis já preenchidos. Continuar?",
      )
    ) {
      return;
    }
    setForm((current) => ({
      ...current,
      partyType: next,
      person: next === "person" ? blankPerson() : null,
      organization: next === "organization" ? blankOrganization() : null,
      representatives: [],
      companyContacts: [],
      bankAccounts: [],
    }));
  }

  async function lookupCep() {
    const cep = form.address.postalCode.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setLookingUpCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error("CEP não encontrado.");
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) throw new Error("CEP não encontrado.");
      patch("address", {
        ...form.address,
        street: data.logradouro ?? form.address.street,
        district: data.bairro ?? form.address.district,
        city: data.localidade ?? form.address.city,
        state: data.uf ?? form.address.state,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    } finally {
      setLookingUpCep(false);
    }
  }

  function validate() {
    if (!form.partyType) return "Selecione o tipo de pessoa.";
    const emails = [
      ...Object.entries(form.communications)
        .filter(([key]) => key.toLowerCase().includes("email"))
        .map(([, value]) => value),
      form.person?.professionalEmail ?? "",
      form.organization?.invoiceEmail ?? "",
      form.organization?.billingEmail ?? "",
      ...form.representatives.map((item) => item.email),
      ...form.companyContacts.map((item) => item.email),
    ];
    if (emails.some((value) => !isValidEmail(value)))
      return "Existe um e-mail com formato inválido.";
    const phones = [
      form.communications.primaryPhone,
      form.communications.secondaryPhone,
      form.communications.whatsapp,
      form.person?.professionalPhone ?? "",
      ...form.representatives.flatMap((item) => [item.phone, item.whatsapp]),
      ...form.companyContacts.flatMap((item) => [item.phone, item.whatsapp]),
    ];
    if (phones.some((value) => !isValidPhone(value))) {
      return "Telefones devem possuir DDD e entre 10 e 15 dígitos.";
    }
    const hasPrimaryContact = Boolean(
      form.communications.primaryEmail.trim() ||
      form.communications.primaryPhone.trim() ||
      form.communications.whatsapp.trim(),
    );
    if (!hasPrimaryContact) return "Informe pelo menos um e-mail, telefone ou WhatsApp.";
    if (form.partyType === "person") {
      if (!form.person?.fullName.trim()) return "Nome completo obrigatório.";
      if (!isValidCpf(form.person.cpf)) return "CPF inválido.";
      if (form.person.companyCnpj && !isValidCnpj(form.person.companyCnpj)) {
        return "O CNPJ da empresa informada é inválido.";
      }
    } else {
      if (!form.organization?.legalName.trim()) return "Razão social obrigatória.";
      if (!form.organization.tradeName.trim()) return "Nome fantasia obrigatório.";
      if (!isValidCnpj(form.organization.cnpj)) return "CNPJ inválido.";
      for (const representative of form.representatives) {
        if (representative.cpf && !isValidCpf(representative.cpf)) {
          return `CPF inválido para ${representative.fullName || "representante"}.`;
        }
      }
      const categoryNeedsContact = ["client", "supplier", "partner", "service_provider"].includes(
        form.category,
      );
      if (
        categoryNeedsContact &&
        form.representatives.length === 0 &&
        form.companyContacts.length === 0
      ) {
        return "Inclua pelo menos um contato ou representante para este relacionamento.";
      }
    }
    for (const account of form.bankAccounts) {
      if (!account.holderName.trim() || !account.bankName.trim() || !account.agency.trim()) {
        return "Preencha titular, banco e agência de todas as contas bancárias.";
      }
      const holderDocument =
        form.partyType === "person"
          ? isValidCpf(account.holderTaxId)
          : isValidCnpj(account.holderTaxId);
      if (!holderDocument) return "CPF/CNPJ do titular bancário inválido.";
      if (!account.id && !account.accountNumber.trim())
        return "Número obrigatório para nova conta bancária.";
    }
    if (form.bankAccounts.filter((item) => item.isPrimary).length > 1) {
      return "Somente uma conta bancária pode ser principal.";
    }
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const cleanPayload: ContactFormPayload = {
        ...form,
        person: form.partyType === "person" ? form.person : null,
        organization: form.partyType === "organization" ? form.organization : null,
        representatives: form.partyType === "organization" ? form.representatives : [],
        companyContacts: form.partyType === "organization" ? form.companyContacts : [],
        tags: form.tags.map((tag) => tag.trim()).filter(Boolean),
      };
      const partyId = await saveContactForm(cleanPayload);
      for (const pending of pendingDocuments) {
        if (pending.file && pending.documentType) {
          await uploadContactDocument({
            partyId,
            documentType: pending.documentType,
            file: pending.file,
          });
        }
      }
      toast.success(
        form.id
          ? "Contato atualizado."
          : form.sourceLeadId
            ? "Lead convertido em contato."
            : "Contato criado.",
      );
      await onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar o contato.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openDocument(document: ContactDocumentMetadata) {
    try {
      const url = await getContactDocumentUrl(document.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao abrir o documento.");
    }
  }

  async function removeDocument(document: ContactDocumentMetadata) {
    if (!window.confirm(`Remover o documento ${document.file_name ?? document.document_type}?`))
      return;
    try {
      await deleteContactDocument(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      toast.success("Documento removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover o documento.");
    }
  }

  if (isView) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.partyType === "person" ? form.person?.fullName : form.organization?.tradeName}
            </DialogTitle>
            <DialogDescription>
              {form.partyType === "person" ? "Pessoa física" : "Pessoa jurídica"} ·{" "}
              {contactCategoryLabel(form.category)} ·{" "}
              {contactStatusOptions.find(([value]) => value === form.status)?.[1]}
            </DialogDescription>
          </DialogHeader>
          <FormSection title="Informações principais">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoField
                label="CPF/CNPJ"
                value={
                  form.partyType === "person"
                    ? maskCpf(form.person?.cpf ?? "")
                    : maskCnpj(form.organization?.cnpj ?? "")
                }
              />
              <InfoField
                label="Unidade"
                value={unitOptions.find(([value]) => value === form.businessUnitId)?.[1]}
              />
              <InfoField label="E-mail principal" value={form.communications.primaryEmail} />
              <InfoField label="Telefone principal" value={form.communications.primaryPhone} />
              {form.partyType === "organization" && (
                <>
                  <InfoField label="Razão social" value={form.organization?.legalName} />
                  <InfoField label="Nome fantasia" value={form.organization?.tradeName} />
                </>
              )}
            </div>
          </FormSection>
          <FormSection title="Contatos">
            {activeContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contato ativo cadastrado.</p>
            ) : (
              <div className="divide-y rounded-sm border">
                {activeContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[140px_1fr_auto] sm:items-center"
                  >
                    <span className="font-medium">
                      {partyContactTypeLabel(contact.contact_type)}
                    </span>
                    <span className="break-all text-muted-foreground">{contact.value}</span>
                    <span className="text-xs text-muted-foreground">
                      {contact.is_primary ? "Principal" : "Secundário"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </FormSection>
          <FormSection title="Relacionamento">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoField label="Categoria" value={contactCategoryLabel(form.category)} />
              <InfoField
                label="Papéis adicionais"
                value={
                  additionalRoles.map((role) => partyRoleLabel(role.role_code)).join(", ") ||
                  "Nenhum"
                }
              />
              <InfoField
                label="Responsável"
                value={profiles.find((profile) => profile.id === form.responsibleUserId)?.name}
              />
              <InfoField label="Origem" value={form.registrationOrigin} />
            </div>
          </FormSection>
          {activeAddresses.length > 0 && (
            <FormSection title="Endereços">
              <div className="grid gap-3 sm:grid-cols-2">
                {activeAddresses.map((address) => (
                  <article key={address.id} className="rounded-sm border p-3 text-sm">
                    <p className="font-medium">
                      {address.label || partyAddressTypeLabel(address.address_type)}
                    </p>
                    <p className="mt-1 text-muted-foreground">{address.address_line_1}</p>
                    {address.address_line_2 && (
                      <p className="text-muted-foreground">{address.address_line_2}</p>
                    )}
                    <p className="text-muted-foreground">
                      {[address.city, address.state_region, address.postal_code]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </article>
                ))}
              </div>
            </FormSection>
          )}
          {form.notes && (
            <details className="rounded-sm border p-4">
              <summary className="cursor-pointer text-sm font-semibold">Outros dados</summary>
              <div className="mt-3">
                <InfoField label="Observações" value={form.notes} />
              </div>
            </details>
          )}
          {effectiveSensitiveRead && (
            <FormSection title="Dados protegidos">
              <div className="grid gap-3 sm:grid-cols-2">
                {form.bankAccounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma conta bancária cadastrada.
                  </p>
                )}
                {form.bankAccounts.map((account) => (
                  <div
                    key={account.id ?? account.bankName}
                    className="rounded-sm border p-3 text-sm"
                  >
                    <p className="font-medium">
                      {account.bankName} {account.isPrimary ? "— Principal" : ""}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Agência {account.agency} · Conta {account.accountNumberMasked ?? "protegida"}
                    </p>
                    <p className="text-muted-foreground">
                      Pix {account.pixKeyMasked ?? "não informado"}
                    </p>
                  </div>
                ))}
              </div>
            </FormSection>
          )}
          <DocumentList
            documents={documents}
            canDelete={false}
            onOpen={openDocument}
            onDelete={removeDocument}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <form className="space-y-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {form.id
                ? "Editar contato"
                : form.sourceLeadId
                  ? "Converter lead em contato"
                  : "Novo contato"}
            </DialogTitle>
            <DialogDescription>
              Selecione o tipo de pessoa. Somente os campos compatíveis serão exibidos e enviados ao
              backend.
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Identificação do cadastro">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Tipo de pessoa"
                value={form.partyType}
                onChange={(value) => changePartyType(value as ContactPartyType)}
                required
                options={[
                  ["", "Selecione"],
                  ["person", "Pessoa Física"],
                  ["organization", "Pessoa Jurídica"],
                ]}
              />
              <SelectField
                label="Status"
                value={form.status}
                onChange={(value) => patch("status", value as ContactFormPayload["status"])}
                required
                options={[...contactStatusOptions]}
              />
              <SelectField
                label="Categoria"
                value={form.category}
                onChange={(value) => patch("category", value as ContactFormPayload["category"])}
                required
                options={[...contactCategoryOptions]}
              />
              <SelectField
                label="Unidade de negócio"
                value={form.businessUnitId}
                onChange={(value) => patch("businessUnitId", value)}
                options={unitOptions}
              />
              <SelectField
                label="Responsável interno"
                value={form.responsibleUserId}
                onChange={(value) => patch("responsibleUserId", value)}
                options={profileOptions}
              />
              <TextField
                label="Origem do cadastro"
                value={form.registrationOrigin}
                onChange={(value) => patch("registrationOrigin", value)}
                helpText="Registre de onde este contato veio, por exemplo: indicação, site, evento, prospecção ou migração."
              />
            </div>
          </FormSection>

          {!form.partyType && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Selecione Pessoa Física ou Pessoa Jurídica para exibir os campos específicos.
            </div>
          )}

          {form.partyType === "person" && form.person && (
            <PersonFields
              form={form}
              patchPerson={patchPerson}
              patch={patch}
              lookupCep={lookupCep}
              lookingUpCep={lookingUpCep}
            />
          )}

          {form.partyType === "organization" && form.organization && (
            <OrganizationFields
              form={form}
              patchOrganization={patchOrganization}
              patch={patch}
              lookupCep={lookupCep}
              lookingUpCep={lookingUpCep}
              setForm={setForm}
            />
          )}

          {form.partyType && (
            <SensitiveAndDocuments
              form={form}
              setForm={setForm}
              canReadSensitive={effectiveSensitiveRead}
              canManageSensitive={canManageSensitive}
              documents={documents}
              pendingDocuments={pendingDocuments}
              setPendingDocuments={setPendingDocuments}
              documentTypes={documentTypes}
              onOpen={openDocument}
              onDelete={removeDocument}
            />
          )}

          <FormSection title="Observações">
            <TextAreaField
              label="Observações gerais"
              value={form.notes}
              onChange={(value) => patch("notes", value)}
              maxLength={2000}
              placeholder="Registre informações complementares relevantes para este contato."
            />
          </FormSection>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting || !canManage}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Salvar contato
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PersonFields({
  form,
  patchPerson,
  patch,
  lookupCep,
  lookingUpCep,
}: {
  form: ContactFormPayload;
  patchPerson: (key: keyof PersonContactData, value: string) => void;
  patch: <K extends keyof ContactFormPayload>(key: K, value: ContactFormPayload[K]) => void;
  lookupCep: () => Promise<void>;
  lookingUpCep: boolean;
}) {
  const person = form.person!;
  return (
    <>
      <FormSection title="Dados pessoais">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nome completo"
            value={person.fullName}
            onChange={(v) => patchPerson("fullName", v)}
            required
          />
          <TextField
            label="Nome social"
            value={person.socialName}
            onChange={(v) => patchPerson("socialName", v)}
          />
          <TextField
            label="CPF"
            value={person.cpf}
            onChange={(v) => patchPerson("cpf", maskCpf(v))}
            required
            inputMode="numeric"
          />
          <TextField label="RG" value={person.rg} onChange={(v) => patchPerson("rg", v)} />
          <TextField
            label="Órgão expedidor"
            value={person.rgIssuer}
            onChange={(v) => patchPerson("rgIssuer", v)}
          />
          <TextField
            label="UF de emissão"
            value={person.rgState}
            onChange={(v) => patchPerson("rgState", v.toUpperCase().slice(0, 2))}
          />
          <TextField
            label="Data de emissão do RG"
            value={person.rgIssuedOn}
            onChange={(v) => patchPerson("rgIssuedOn", v)}
            type="date"
          />
          <TextField
            label="Data de nascimento"
            value={person.birthDate}
            onChange={(v) => patchPerson("birthDate", v)}
            type="date"
          />
          <TextField
            label="Nacionalidade"
            value={person.nationality}
            onChange={(v) => patchPerson("nationality", v)}
          />
          <TextField
            label="Naturalidade"
            value={person.birthplace}
            onChange={(v) => patchPerson("birthplace", v)}
          />
          <TextField
            label="Estado civil"
            value={person.maritalStatus}
            onChange={(v) => patchPerson("maritalStatus", v)}
          />
          <TextField
            label="Profissão"
            value={person.profession}
            onChange={(v) => patchPerson("profession", v)}
          />
          <TextField
            label="Gênero (opcional)"
            value={person.gender}
            onChange={(v) => patchPerson("gender", v)}
          />
        </div>
      </FormSection>
      <CommunicationsSection form={form} patch={patch} organization={false} />
      <AddressSection form={form} patch={patch} lookupCep={lookupCep} lookingUpCep={lookingUpCep} />
      <FormSection title="Dados profissionais">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Empresa"
            value={person.company}
            onChange={(v) => patchPerson("company", v)}
          />
          <TextField
            label="Cargo ou função"
            value={person.jobTitle}
            onChange={(v) => patchPerson("jobTitle", v)}
          />
          <TextField
            label="Departamento"
            value={person.department}
            onChange={(v) => patchPerson("department", v)}
          />
          <TextField
            label="CNPJ da empresa"
            value={person.companyCnpj}
            onChange={(v) => patchPerson("companyCnpj", maskCnpj(v))}
          />
          <TextField
            label="E-mail profissional"
            value={person.professionalEmail}
            onChange={(v) => patchPerson("professionalEmail", v)}
            type="email"
          />
          <TextField
            label="Telefone profissional"
            value={person.professionalPhone}
            onChange={(v) => patchPerson("professionalPhone", formatPhone(v))}
            inputMode="tel"
          />
        </div>
      </FormSection>
    </>
  );
}

function OrganizationFields({
  form,
  patchOrganization,
  patch,
  lookupCep,
  lookingUpCep,
  setForm,
}: {
  form: ContactFormPayload;
  patchOrganization: <K extends keyof OrganizationContactData>(
    key: K,
    value: OrganizationContactData[K],
  ) => void;
  patch: <K extends keyof ContactFormPayload>(key: K, value: ContactFormPayload[K]) => void;
  lookupCep: () => Promise<void>;
  lookingUpCep: boolean;
  setForm: Dispatch<SetStateAction<ContactFormPayload>>;
}) {
  const org = form.organization!;
  return (
    <>
      <FormSection title="Dados empresariais">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Razão social"
            value={org.legalName}
            onChange={(v) => patchOrganization("legalName", v)}
            required
          />
          <TextField
            label="Nome fantasia"
            value={org.tradeName}
            onChange={(v) => patchOrganization("tradeName", v)}
            required
          />
          <TextField
            label="CNPJ"
            value={org.cnpj}
            onChange={(v) => patchOrganization("cnpj", maskCnpj(v))}
            required
            inputMode="numeric"
          />
          <TextField
            label="Inscrição estadual"
            value={org.stateRegistration}
            onChange={(v) => patchOrganization("stateRegistration", v)}
            placeholder={org.stateRegistrationIndicator === "exempt" ? "Isento" : undefined}
          />
          <SelectField
            label="Indicador de inscrição estadual"
            value={org.stateRegistrationIndicator}
            onChange={(v) =>
              patchOrganization(
                "stateRegistrationIndicator",
                v as OrganizationContactData["stateRegistrationIndicator"],
              )
            }
            options={[
              ["taxpayer", "Contribuinte"],
              ["exempt", "Isento"],
              ["non_taxpayer", "Não contribuinte"],
            ]}
          />
          <TextField
            label="Inscrição municipal"
            value={org.municipalRegistration}
            onChange={(v) => patchOrganization("municipalRegistration", v)}
          />
          <TextField
            label="Data de abertura"
            value={org.openedOn}
            onChange={(v) => patchOrganization("openedOn", v)}
            type="date"
          />
          <TextField
            label="Natureza jurídica"
            value={org.legalNature}
            onChange={(v) => patchOrganization("legalNature", v)}
          />
          <TextField
            label="CNAE principal"
            value={org.primaryCnae}
            onChange={(v) => patchOrganization("primaryCnae", v)}
          />
          <TextField
            label="Situação cadastral"
            value={org.registrationStatus}
            onChange={(v) => patchOrganization("registrationStatus", v)}
          />
          <TextField
            label="Data da situação cadastral"
            value={org.registrationStatusOn}
            onChange={(v) => patchOrganization("registrationStatusOn", v)}
            type="date"
          />
          <TextField
            label="Órgão de registro"
            value={org.registrationAuthority}
            onChange={(v) => patchOrganization("registrationAuthority", v)}
          />
          <TextField
            label="Registro na Junta Comercial"
            value={org.commercialRegistryNumber}
            onChange={(v) => patchOrganization("commercialRegistryNumber", v)}
          />
        </div>
      </FormSection>
      <CommunicationsSection form={form} patch={patch} organization />
      <AddressSection form={form} patch={patch} lookupCep={lookupCep} lookingUpCep={lookingUpCep} />
      <RepresentativesSection form={form} setForm={setForm} />
      <CompanyContactsSection form={form} setForm={setForm} />
      <FormSection title="Dados financeiros e fiscais">
        <div className="grid gap-4 sm:grid-cols-2">
          <CheckboxField
            label="Optante pelo Simples Nacional"
            checked={org.simplesNacional}
            onChange={(v) => patchOrganization("simplesNacional", v)}
          />
          <CheckboxField
            label="Optante pelo MEI"
            checked={org.mei}
            onChange={(v) => patchOrganization("mei", v)}
          />
          <CheckboxField
            label="Retém impostos"
            checked={org.withholdsTaxes}
            onChange={(v) => patchOrganization("withholdsTaxes", v)}
          />
          <TextField
            label="Percentual ou regras de retenção"
            value={org.withholdingRules}
            onChange={(v) => patchOrganization("withholdingRules", v)}
          />
          <TextField
            label="E-mail para nota fiscal"
            value={org.invoiceEmail}
            onChange={(v) => patchOrganization("invoiceEmail", v)}
            type="email"
          />
          <TextField
            label="E-mail para cobrança"
            value={org.billingEmail}
            onChange={(v) => patchOrganization("billingEmail", v)}
            type="email"
          />
          <TextField
            label="Dia preferencial de vencimento"
            value={org.preferredDueDay}
            onChange={(v) => patchOrganization("preferredDueDay", v)}
            inputMode="numeric"
          />
          <TextField
            label="Condição de pagamento"
            value={org.paymentTerms}
            onChange={(v) => patchOrganization("paymentTerms", v)}
          />
          <TextField
            label="Limite de crédito"
            value={org.creditLimit}
            onChange={(v) => patchOrganization("creditLimit", v)}
            inputMode="decimal"
          />
          <TextField
            label="Moeda padrão"
            value={org.defaultCurrency}
            onChange={(v) => patchOrganization("defaultCurrency", v.toUpperCase())}
          />
        </div>
        <TextAreaField
          label="Observações fiscais"
          value={org.fiscalNotes}
          onChange={(v) => patchOrganization("fiscalNotes", v)}
        />
      </FormSection>
    </>
  );
}

function CommunicationsSection({
  form,
  patch,
  organization,
}: {
  form: ContactFormPayload;
  patch: <K extends keyof ContactFormPayload>(key: K, value: ContactFormPayload[K]) => void;
  organization: boolean;
}) {
  const c = form.communications;
  const set = (key: keyof typeof c, value: string) =>
    patch("communications", { ...c, [key]: value });
  return (
    <FormSection
      title={organization ? "Informações de contato da empresa" : "Informações de contato"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="E-mail principal"
          value={c.primaryEmail}
          onChange={(v) => set("primaryEmail", v)}
          type="email"
        />
        <TextField
          label="E-mail secundário"
          value={c.secondaryEmail}
          onChange={(v) => set("secondaryEmail", v)}
          type="email"
        />
        {organization && (
          <TextField
            label="E-mail financeiro"
            value={c.financialEmail}
            onChange={(v) => set("financialEmail", v)}
            type="email"
          />
        )}
        {organization && (
          <TextField
            label="E-mail fiscal"
            value={c.fiscalEmail}
            onChange={(v) => set("fiscalEmail", v)}
            type="email"
          />
        )}
        {organization && (
          <TextField
            label="E-mail jurídico"
            value={c.legalEmail}
            onChange={(v) => set("legalEmail", v)}
            type="email"
          />
        )}
        <TextField
          label="Telefone principal"
          value={c.primaryPhone}
          onChange={(v) => set("primaryPhone", formatPhone(v))}
          inputMode="tel"
        />
        <TextField
          label="Telefone secundário"
          value={c.secondaryPhone}
          onChange={(v) => set("secondaryPhone", formatPhone(v))}
          inputMode="tel"
        />
        <TextField
          label="WhatsApp"
          value={c.whatsapp}
          onChange={(v) => set("whatsapp", formatPhone(v))}
          inputMode="tel"
        />
        <TextField label="Site" value={c.website} onChange={(v) => set("website", v)} type="url" />
        <TextField label="Instagram" value={c.instagram} onChange={(v) => set("instagram", v)} />
        <TextField label="LinkedIn" value={c.linkedin} onChange={(v) => set("linkedin", v)} />
      </div>
    </FormSection>
  );
}

function AddressSection({
  form,
  patch,
  lookupCep,
  lookingUpCep,
}: {
  form: ContactFormPayload;
  patch: <K extends keyof ContactFormPayload>(key: K, value: ContactFormPayload[K]) => void;
  lookupCep: () => Promise<void>;
  lookingUpCep: boolean;
}) {
  const a = form.address;
  const set = (key: keyof typeof a, value: string) => patch("address", { ...a, [key]: value });
  return (
    <FormSection title={form.partyType === "person" ? "Endereço" : "Endereço empresarial"}>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Logradouro" value={a.street} onChange={(v) => set("street", v)} />
        <TextField label="Número" value={a.number} onChange={(v) => set("number", v)} />
        <TextField
          label="Complemento"
          value={a.complement}
          onChange={(v) => set("complement", v)}
        />
        <TextField label="Bairro" value={a.district} onChange={(v) => set("district", v)} />
        <TextField label="Cidade" value={a.city} onChange={(v) => set("city", v)} />
        <TextField
          label="Estado"
          value={a.state}
          onChange={(v) => set("state", v.toUpperCase().slice(0, 2))}
          maxLength={2}
        />
        <TextField
          label={lookingUpCep ? "CEP — consultando" : "CEP"}
          value={a.postalCode}
          onChange={(v) => set("postalCode", v.replace(/\D/g, "").slice(0, 8))}
          onBlur={() => void lookupCep()}
          inputMode="numeric"
          maxLength={8}
        />
        <TextField label="País" value={a.country} onChange={(v) => set("country", v)} />
        {form.partyType === "person" ? (
          <div className="col-span-2">
            <TextField
              label="Ponto de referência"
              value={a.reference}
              onChange={(v) => set("reference", v)}
            />
          </div>
        ) : null}
      </div>
    </FormSection>
  );
}

function RepresentativesSection({
  form,
  setForm,
}: {
  form: ContactFormPayload;
  setForm: Dispatch<SetStateAction<ContactFormPayload>>;
}) {
  function update(index: number, values: Partial<ContactRepresentative>) {
    setForm((current) => ({
      ...current,
      representatives: current.representatives.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...values } : item,
      ),
    }));
  }
  return (
    <FormSection
      title="Representantes legais, sócios e administradores"
      description="É possível cadastrar múltiplas pessoas. Apenas uma pode ser representante legal principal."
    >
      <div className="space-y-4">
        {form.representatives.map((representative, index) => (
          <RepeatableCard
            key={representative.id ?? `representative-${index}`}
            title={`Representante ${index + 1}`}
            onRemove={() =>
              setForm((current) => ({
                ...current,
                representatives: current.representatives.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              }))
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Tipo"
                value={representative.representativeType}
                onChange={(v) =>
                  update(index, {
                    representativeType: v as ContactRepresentative["representativeType"],
                  })
                }
                options={[
                  ["legal_representative", "Representante legal"],
                  ["partner", "Sócio"],
                  ["administrator", "Administrador"],
                ]}
              />
              <TextField
                label="Nome completo"
                value={representative.fullName}
                onChange={(v) => update(index, { fullName: v })}
                required
              />
              <TextField
                label="CPF"
                value={representative.cpf}
                onChange={(v) => update(index, { cpf: maskCpf(v) })}
              />
              <TextField
                label="RG"
                value={representative.rg}
                onChange={(v) => update(index, { rg: v })}
              />
              <TextField
                label="Cargo ou função"
                value={representative.roleTitle}
                onChange={(v) => update(index, { roleTitle: v })}
              />
              <TextField
                label="Data de nascimento"
                value={representative.birthDate}
                onChange={(v) => update(index, { birthDate: v })}
                type="date"
              />
              <TextField
                label="E-mail"
                value={representative.email}
                onChange={(v) => update(index, { email: v })}
                type="email"
              />
              <TextField
                label="Telefone"
                value={representative.phone}
                onChange={(v) => update(index, { phone: formatPhone(v) })}
              />
              <TextField
                label="WhatsApp"
                value={representative.whatsapp}
                onChange={(v) => update(index, { whatsapp: formatPhone(v) })}
              />
              <TextField
                label="Participação societária (%)"
                value={representative.ownershipPercentage}
                onChange={(v) => update(index, { ownershipPercentage: v })}
                inputMode="decimal"
              />
              <CheckboxField
                label="Representante legal principal"
                checked={representative.isPrimaryLegalRepresentative}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    representatives: current.representatives.map((item, itemIndex) => ({
                      ...item,
                      isPrimaryLegalRepresentative:
                        itemIndex === index
                          ? checked
                          : checked
                            ? false
                            : item.isPrimaryLegalRepresentative,
                    })),
                  }))
                }
              />
              <CheckboxField
                label="Possui poderes para assinatura"
                checked={representative.canSign}
                onChange={(checked) => update(index, { canSign: checked })}
              />
            </div>
          </RepeatableCard>
        ))}
        <AddRowButton
          label="Adicionar representante"
          onClick={() =>
            setForm((current) => ({
              ...current,
              representatives: [...current.representatives, emptyRepresentative()],
            }))
          }
        />
      </div>
    </FormSection>
  );
}

function CompanyContactsSection({
  form,
  setForm,
}: {
  form: ContactFormPayload;
  setForm: Dispatch<SetStateAction<ContactFormPayload>>;
}) {
  function update(index: number, values: Partial<CompanyContactPerson>) {
    setForm((current) => ({
      ...current,
      companyContacts: current.companyContacts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...values } : item,
      ),
    }));
  }
  return (
    <FormSection
      title="Contatos da empresa"
      description="Cadastre as pessoas que recebem comunicações comerciais, financeiras, fiscais ou contratuais."
    >
      <div className="space-y-4">
        {form.companyContacts.map((contact, index) => (
          <RepeatableCard
            key={contact.id ?? `company-contact-${index}`}
            title={`Contato ${index + 1}`}
            onRemove={() =>
              setForm((current) => ({
                ...current,
                companyContacts: current.companyContacts.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              }))
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nome completo"
                value={contact.fullName}
                onChange={(v) => update(index, { fullName: v })}
                required
              />
              <TextField
                label="Cargo"
                value={contact.roleTitle}
                onChange={(v) => update(index, { roleTitle: v })}
              />
              <TextField
                label="Departamento"
                value={contact.department}
                onChange={(v) => update(index, { department: v })}
              />
              <TextField
                label="E-mail"
                value={contact.email}
                onChange={(v) => update(index, { email: v })}
                type="email"
              />
              <TextField
                label="Telefone"
                value={contact.phone}
                onChange={(v) => update(index, { phone: formatPhone(v) })}
              />
              <TextField
                label="WhatsApp"
                value={contact.whatsapp}
                onChange={(v) => update(index, { whatsapp: formatPhone(v) })}
              />
              <CheckboxField
                label="Contato principal"
                checked={contact.isPrimary}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    companyContacts: current.companyContacts.map((item, itemIndex) => ({
                      ...item,
                      isPrimary: itemIndex === index ? checked : checked ? false : item.isPrimary,
                    })),
                  }))
                }
              />
              <CheckboxField
                label="Recebe comunicações financeiras"
                checked={contact.receivesFinancial}
                onChange={(checked) => update(index, { receivesFinancial: checked })}
              />
              <CheckboxField
                label="Recebe comunicações fiscais"
                checked={contact.receivesFiscal}
                onChange={(checked) => update(index, { receivesFiscal: checked })}
              />
              <CheckboxField
                label="Recebe comunicações contratuais"
                checked={contact.receivesContractual}
                onChange={(checked) => update(index, { receivesContractual: checked })}
              />
            </div>
          </RepeatableCard>
        ))}
        <AddRowButton
          label="Adicionar contato da empresa"
          onClick={() =>
            setForm((current) => ({
              ...current,
              companyContacts: [...current.companyContacts, emptyCompanyContact()],
            }))
          }
        />
      </div>
    </FormSection>
  );
}

function SensitiveAndDocuments({
  form,
  setForm,
  canReadSensitive,
  canManageSensitive,
  documents,
  pendingDocuments,
  setPendingDocuments,
  documentTypes,
  onOpen,
  onDelete,
}: {
  form: ContactFormPayload;
  setForm: Dispatch<SetStateAction<ContactFormPayload>>;
  canReadSensitive: boolean;
  canManageSensitive: boolean;
  documents: ContactDocumentMetadata[];
  pendingDocuments: PendingDocument[];
  setPendingDocuments: Dispatch<SetStateAction<PendingDocument[]>>;
  documentTypes: string[];
  onOpen: (document: ContactDocumentMetadata) => Promise<void>;
  onDelete: (document: ContactDocumentMetadata) => Promise<void>;
}) {
  function updateBank(index: number, values: Partial<ProtectedBankAccount>) {
    setForm((current) => ({
      ...current,
      bankAccounts: current.bankAccounts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...values } : item,
      ),
    }));
  }
  return (
    <>
      <FormSection
        title="Dados bancários"
        description="Dados bancários são gravados em área privada, retornados mascarados e auditados sem exposição dos valores completos."
      >
        {!canReadSensitive && (
          <div className="flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <ShieldAlert className="h-4 w-4" /> Você não possui permissão para consultar dados
            bancários.
          </div>
        )}
        {canReadSensitive && (
          <div className="space-y-4">
            {form.bankAccounts.map((account, index) => (
              <RepeatableCard
                key={account.id ?? `bank-${index}`}
                title={`Conta bancária ${index + 1}${account.isPrimary ? " — Principal" : ""}`}
                onRemove={() =>
                  setForm((current) => ({
                    ...current,
                    bankAccounts: current.bankAccounts.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }))
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={
                      form.partyType === "person" ? "Nome do titular" : "Razão social do titular"
                    }
                    value={account.holderName}
                    onChange={(v) => updateBank(index, { holderName: v })}
                    disabled={!canManageSensitive}
                  />
                  <TextField
                    label={form.partyType === "person" ? "CPF do titular" : "CNPJ do titular"}
                    value={account.holderTaxId}
                    onChange={(v) =>
                      updateBank(index, {
                        holderTaxId: form.partyType === "person" ? maskCpf(v) : maskCnpj(v),
                      })
                    }
                    disabled={!canManageSensitive}
                  />
                  <TextField
                    label="Banco"
                    value={account.bankName}
                    onChange={(v) => updateBank(index, { bankName: v })}
                    disabled={!canManageSensitive}
                  />
                  <TextField
                    label="Código do banco"
                    value={account.bankCode}
                    onChange={(v) => updateBank(index, { bankCode: v })}
                    disabled={!canManageSensitive}
                  />
                  <TextField
                    label="Agência"
                    value={account.agency}
                    onChange={(v) => updateBank(index, { agency: v })}
                    disabled={!canManageSensitive}
                  />
                  <TextField
                    label="Dígito da agência"
                    value={account.agencyDigit}
                    onChange={(v) => updateBank(index, { agencyDigit: v })}
                    disabled={!canManageSensitive}
                  />
                  <SelectField
                    label="Tipo de conta"
                    value={account.accountType}
                    onChange={(v) => updateBank(index, { accountType: v })}
                    disabled={!canManageSensitive}
                    options={[
                      ["checking", "Conta corrente"],
                      ["savings", "Conta poupança"],
                      ["payment", "Conta de pagamento"],
                      ["salary", "Conta salário"],
                      ["other", "Outra"],
                    ]}
                  />
                  <TextField
                    label="Número da conta"
                    value={account.accountNumber}
                    onChange={(v) => updateBank(index, { accountNumber: v })}
                    placeholder={
                      account.accountNumberMasked
                        ? `Mantido: ${account.accountNumberMasked}`
                        : undefined
                    }
                    disabled={!canManageSensitive}
                  />
                  <TextField
                    label="Dígito da conta"
                    value={account.accountDigit}
                    onChange={(v) => updateBank(index, { accountDigit: v })}
                    disabled={!canManageSensitive}
                  />
                  <TextField
                    label="Chave Pix"
                    value={account.pixKey}
                    onChange={(v) => updateBank(index, { pixKey: v })}
                    placeholder={
                      account.pixKeyMasked ? `Mantida: ${account.pixKeyMasked}` : undefined
                    }
                    disabled={!canManageSensitive}
                  />
                  <SelectField
                    label="Tipo da chave Pix"
                    value={account.pixKeyType}
                    onChange={(v) => updateBank(index, { pixKeyType: v })}
                    disabled={!canManageSensitive}
                    options={[
                      ["", "Não informado"],
                      ["cpf_cnpj", "CPF/CNPJ"],
                      ["email", "E-mail"],
                      ["phone", "Telefone"],
                      ["random", "Aleatória"],
                      ["other", "Outra"],
                    ]}
                  />
                  <CheckboxField
                    label="Conta principal"
                    checked={account.isPrimary}
                    disabled={!canManageSensitive}
                    onChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        bankAccounts: current.bankAccounts.map((item, itemIndex) => ({
                          ...item,
                          isPrimary:
                            itemIndex === index ? checked : checked ? false : item.isPrimary,
                        })),
                      }))
                    }
                  />
                </div>
              </RepeatableCard>
            ))}
            {canManageSensitive && (
              <AddRowButton
                label="Adicionar conta bancária"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    bankAccounts: [...current.bankAccounts, emptyBankAccount()],
                  }))
                }
              />
            )}
          </div>
        )}
      </FormSection>

      <FormSection
        title="Documentos e anexos"
        description="Arquivos privados com nome, tipo, MIME, tamanho, usuário e horário de upload registrados."
      >
        <DocumentList
          documents={documents}
          canDelete={canManageSensitive}
          onOpen={onOpen}
          onDelete={onDelete}
        />
        {canManageSensitive && (
          <div className="space-y-3">
            {pendingDocuments.map((pending, index) => (
              <div
                key={pending.id}
                className="grid items-end gap-3 rounded-sm border p-3 sm:grid-cols-[1fr_1.5fr_auto]"
              >
                <SelectField
                  label="Tipo do documento"
                  value={pending.documentType}
                  onChange={(value) =>
                    setPendingDocuments((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, documentType: value } : item,
                      ),
                    )
                  }
                  options={[
                    ["", "Selecione"],
                    ...documentTypes.map((item) => [item, item] as const),
                  ]}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Arquivo</label>
                  <input
                    type="file"
                    className="block w-full text-sm"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
                    onChange={(event) =>
                      setPendingDocuments((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, file: event.target.files?.[0] ?? null }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setPendingDocuments((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setPendingDocuments((current) => [
                  ...current,
                  { id: crypto.randomUUID(), documentType: "", file: null },
                ])
              }
            >
              <FileUp className="h-4 w-4" /> Adicionar documento
            </Button>
          </div>
        )}
      </FormSection>
    </>
  );
}

function DocumentList({
  documents,
  canDelete,
  onOpen,
  onDelete,
}: {
  documents: ContactDocumentMetadata[];
  canDelete: boolean;
  onOpen: (document: ContactDocumentMetadata) => Promise<void>;
  onDelete: (document: ContactDocumentMetadata) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      {documents.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
      )}
      {documents.map((document) => (
        <div
          key={document.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-sm border p-3 text-sm"
        >
          <div>
            <p className="font-medium">{document.file_name ?? document.document_type}</p>
            <p className="text-xs text-muted-foreground">
              {document.document_type} · {document.mime_type ?? "tipo não registrado"} ·{" "}
              {document.file_size_bytes
                ? `${Math.ceil(document.file_size_bytes / 1024)} KB`
                : "tamanho não registrado"}
            </p>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => void onOpen(document)}>
              <ExternalLink className="h-4 w-4" /> Abrir
            </Button>
            {canDelete && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => void onDelete(document)}
              >
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DeleteContactDialog({
  record,
  parties,
  onClose,
  onChanged,
}: ContactFormDialogProps & { record: Party }) {
  const [submitting, setSubmitting] = useState(false);
  async function destroy() {
    setSubmitting(true);
    try {
      for (const contact of parties.contacts.filter((item) => item.party_id === record.id))
        await deletePartyRecord("party_contacts", contact.id);
      for (const role of parties.roles.filter((item) => item.party_id === record.id))
        await deletePartyRecord("party_roles", role.id);
      if (record.status !== "inactive")
        await updatePartyRecord<Party>("parties", record.id, record.version, {
          status: "inactive",
        });
      await deletePartyRecord("parties", record.id);
      await onChanged();
      toast.success("Contato excluído.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "O contato possui vínculos e não pode ser excluído.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir contato</DialogTitle>
          <DialogDescription>
            A exclusão será bloqueada quando existirem vínculos operacionais, contratuais ou
            financeiros.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm font-medium">
          {record.trade_name?.trim() || record.legal_name}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" disabled={submitting} onClick={() => void destroy()}>
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />} Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
