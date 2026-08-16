import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Search } from "lucide-react";

import { RowActionsMenu } from "@/shared/components/row-actions-menu";
import { SortableTableHeader } from "@/shared/components/sortable-table-header";
import { Input } from "@/shared/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { EmptyRow, PageHeader, Panel, StatusPill, UnitTag } from "@/shared/components/ui-kit";
import { useWorkspace } from "@/app/providers/workspace-context";
import { hasPermission } from "@/modules/access-control/api";
import { listCrmReferenceData, type CrmReferenceData } from "./reference-data-api";
import { listPartiesData } from "@/modules/parties";
import type { PartiesData, Party, PartyContact, PartyType } from "@/modules/parties";
import { listCrmDirectory } from "./api";
import { ContactFormDialog, type ContactDialogState } from "./contact-form-dialog";
import {
  LeadDialog,
  leadPrimaryServiceLabel,
  leadPriorityLabel,
  leadSourceLabel,
  leadStatusLabel,
  type LeadAction,
} from "./lead-dialog";
import type { CrmDirectory, CrmLead } from "./types";
import { contactCategoryLabel } from "./form-types";
import { nextTableSort, sortTableRows, type TableSort } from "./table-sorting";

type ContactSortKey =
  "contact" | "type" | "relationship" | "taxId" | "contactDetails" | "unit" | "status";
type LeadSortKey = "lead" | "type" | "contact" | "service" | "source" | "priority" | "status";

const contactHeaders: Array<{ key: ContactSortKey; label: string }> = [
  { key: "contact", label: "Contato" },
  { key: "type", label: "Tipo" },
  { key: "relationship", label: "Relacionamento" },
  { key: "taxId", label: "CPF/CNPJ" },
  { key: "contactDetails", label: "E-mail / telefone" },
  { key: "unit", label: "Unidade" },
  { key: "status", label: "Situação" },
];

const leadHeaders: Array<{ key: LeadSortKey; label: string }> = [
  { key: "lead", label: "Lead" },
  { key: "type", label: "Tipo" },
  { key: "contact", label: "Contato" },
  { key: "service", label: "Serviço principal" },
  { key: "source", label: "Origem" },
  { key: "priority", label: "Prioridade" },
  { key: "status", label: "Situação" },
];

function partyStatusLabel(value: Party["status"]): string {
  const labels: Record<Party["status"], string> = {
    prospect: "Em análise",
    active: "Ativo",
    inactive: "Inativo",
    blocked: "Bloqueado",
    under_review: "Em análise",
  };
  return labels[value];
}

export function RelationshipCrmPage() {
  const queryClient = useQueryClient();
  const { unit, setUnit } = useWorkspace();
  const [contactSearch, setContactSearch] = useState("");
  const [contactTypeFilter, setContactTypeFilter] = useState("all");
  const [contactStatusFilter, setContactStatusFilter] = useState("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadTypeFilter, setLeadTypeFilter] = useState("all");
  const [leadStatusFilter, setLeadStatusFilter] = useState("all");
  const [leadOwnerFilter, setLeadOwnerFilter] = useState("all");
  const [leadSourceFilter, setLeadSourceFilter] = useState("all");
  const [contactAction, setContactAction] = useState<ContactDialogState>(null);
  const [leadAction, setLeadAction] = useState<LeadAction>(null);
  const [activeTab, setActiveTab] = useState<"contacts" | "leads">("contacts");
  const [contactSort, setContactSort] = useState<TableSort<ContactSortKey> | null>(null);
  const [leadSort, setLeadSort] = useState<TableSort<LeadSortKey> | null>(null);

  useEffect(() => {
    const handleNewContact = () => setContactAction({ action: "create" });
    const handleNewLead = () => setLeadAction({ action: "create" });

    window.addEventListener("crm:new-contact", handleNewContact);
    window.addEventListener("crm:new-lead", handleNewLead);
    return () => {
      window.removeEventListener("crm:new-contact", handleNewContact);
      window.removeEventListener("crm:new-lead", handleNewLead);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("crm:tab-change", { detail: { tab: activeTab } }));
  }, [activeTab]);

  const permissionQuery = useQuery({
    queryKey: ["crm-relationship-permissions"],
    queryFn: async () => ({
      partyRead: await hasPermission("parties.read"),
      partyManage: await hasPermission("parties.manage"),
      sensitiveRead: await hasPermission("parties.sensitive.read"),
      sensitiveManage: await hasPermission("parties.sensitive.manage"),
      convert: await hasPermission("crm.convert"),
      crmRead: await hasPermission("crm.read"),
      leadManage: await hasPermission("crm.leads.manage"),
    }),
  });
  const partiesQuery = useQuery({
    queryKey: ["parties-directory", false],
    queryFn: () => listPartiesData(false),
  });
  const crmQuery = useQuery({ queryKey: ["crm-directory"], queryFn: listCrmDirectory });
  const structureQuery = useQuery({
    queryKey: ["crm-reference-data"],
    queryFn: listCrmReferenceData,
  });

  const parties = partiesQuery.data;
  const crm = crmQuery.data;
  const structure = structureQuery.data;
  const permissions = permissionQuery.data;

  const scopedContacts = useMemo(() => {
    if (!parties || !structure) return [];
    return parties.parties.filter(
      (party) => unit === "TODAS" || unitCode(structure, party.primary_business_unit_id) === unit,
    );
  }, [parties, structure, unit]);

  const contacts = useMemo(() => {
    const normalized = contactSearch.trim().toLowerCase();
    if (!parties) return [];
    return scopedContacts.filter((party) => {
      const contactsForParty = parties.contacts
        .filter((contact) => contact.party_id === party.id)
        .map((contact) => contact.value);
      const matchesSearch =
        !normalized ||
        `${party.legal_name} ${party.trade_name ?? ""} ${party.tax_id ?? ""} ${contactCategoryLabel(party.category)} ${contactsForParty.join(" ")}`
          .toLowerCase()
          .includes(normalized);
      const matchesType = contactTypeFilter === "all" || party.party_type === contactTypeFilter;
      const matchesStatus = contactStatusFilter === "all" || party.status === contactStatusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [contactSearch, contactStatusFilter, contactTypeFilter, parties, scopedContacts]);

  const scopedLeads = useMemo(() => {
    if (!structure) return [];
    return (crm?.leads ?? []).filter(
      (lead) => unit === "TODAS" || unitCode(structure, lead.business_unit_id) === unit,
    );
  }, [crm?.leads, structure, unit]);

  const leads = useMemo(() => {
    const normalized = leadSearch.trim().toLowerCase();
    return scopedLeads.filter((lead) => {
      const matchesSearch =
        !normalized ||
        `${lead.code} ${lead.company_name ?? ""} ${lead.trade_name ?? ""} ${lead.contact_name} ${lead.tax_id ?? ""} ${lead.email ?? ""} ${lead.phone ?? ""} ${lead.whatsapp ?? ""} ${lead.source}`
          .toLowerCase()
          .includes(normalized);
      const matchesType = leadTypeFilter === "all" || lead.lead_type === leadTypeFilter;
      const matchesStatus = leadStatusFilter === "all" || lead.status === leadStatusFilter;
      const matchesOwner =
        leadOwnerFilter === "all" ||
        (leadOwnerFilter === "unassigned"
          ? !lead.owner_user_id
          : lead.owner_user_id === leadOwnerFilter);
      const matchesSource = leadSourceFilter === "all" || lead.source === leadSourceFilter;
      return matchesSearch && matchesType && matchesStatus && matchesOwner && matchesSource;
    });
  }, [
    leadOwnerFilter,
    leadSearch,
    leadSourceFilter,
    leadStatusFilter,
    leadTypeFilter,
    scopedLeads,
  ]);

  const sortedContacts = useMemo(() => {
    if (!contactSort || !parties || !structure) return contacts;
    return sortTableRows(contacts, contactSort.direction, (party) => {
      switch (contactSort.key) {
        case "contact":
          return party.trade_name?.trim() || party.legal_name;
        case "type":
          return party.party_type === "person" ? "Pessoa Física" : "Pessoa Jurídica";
        case "relationship":
          return contactCategoryLabel(party.category);
        case "taxId":
          return party.tax_id;
        case "contactDetails":
          return (
            primaryContact(parties, party.id, "email")?.value ??
            primaryPhone(parties, party.id)?.value
          );
        case "unit":
          return unitCode(structure, party.primary_business_unit_id);
        case "status":
          return partyStatusLabel(party.status);
      }
    });
  }, [contactSort, contacts, parties, structure]);

  const sortedLeads = useMemo(() => {
    if (!leadSort || !crm) return leads;
    return sortTableRows(leads, leadSort.direction, (lead) => {
      switch (leadSort.key) {
        case "lead":
          return lead.lead_type === "organization"
            ? lead.trade_name || lead.company_name || lead.contact_name
            : lead.contact_name;
        case "type":
          return lead.lead_type === "person" ? "Pessoa Física" : "Pessoa Jurídica";
        case "contact":
          return lead.email ?? lead.phone ?? lead.whatsapp;
        case "service":
          return leadPrimaryServiceLabel(lead, crm);
        case "source":
          return leadSourceLabel(lead.source);
        case "priority":
          return leadPriorityLabel(lead.priority);
        case "status":
          return leadStatusLabel(lead.status);
      }
    });
  }, [crm, leadSort, leads]);

  async function refreshContacts() {
    await queryClient.invalidateQueries({ queryKey: ["parties-directory"] });
    await queryClient.invalidateQueries({ queryKey: ["crm-directory"] });
  }

  async function refreshLeads() {
    await queryClient.invalidateQueries({ queryKey: ["crm-directory"] });
  }

  if (
    permissionQuery.isLoading ||
    partiesQuery.isLoading ||
    crmQuery.isLoading ||
    structureQuery.isLoading
  ) {
    return <LoadingState />;
  }

  const loadError =
    permissionQuery.error ?? partiesQuery.error ?? crmQuery.error ?? structureQuery.error;
  if (loadError || !permissions || !parties || !crm || !structure) {
    return <ErrorState error={loadError} />;
  }

  return (
    <div className="space-y-6">
      {activeTab === "contacts" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <CountCard label="Todos os contatos" value={scopedContacts.length} />
          <CountCard label="Clientes" value={countCategory(scopedContacts, "client")} />
          <CountCard label="Fornecedores" value={countCategory(scopedContacts, "supplier")} />
          <CountCard label="Parceiros" value={countCategory(scopedContacts, "partner")} />
          <CountCard
            label="Prestadores"
            value={countCategory(scopedContacts, "service_provider")}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <CountCard label="Total de leads" value={scopedLeads.length} />
          <CountCard
            label="Novos"
            value={scopedLeads.filter((item) => item.status === "new").length}
          />
          <CountCard
            label="Contato pendente"
            value={scopedLeads.filter((item) => item.status === "contact_pending").length}
          />
          <CountCard
            label="Qualificados"
            value={
              scopedLeads.filter((item) => ["qualifying", "qualified"].includes(item.status)).length
            }
          />
          <CountCard
            label="Convertidos"
            value={scopedLeads.filter((item) => item.status === "converted").length}
          />
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "contacts" | "leads")}
        className="space-y-5"
      >
        <TabsList className="h-auto w-full justify-start rounded-md border bg-muted/30 p-1 sm:w-auto">
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-5">
          <Panel
            title="Contatos"
            description="Pessoas físicas e jurídicas que se relacionam com a empresa, independentemente do papel exercido."
          >
            <div className="grid gap-2 border-b px-4 py-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_repeat(3,minmax(150px,auto))]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Buscar contato"
                  className="h-9 w-full rounded-sm pl-9"
                />
              </div>
              <div className="contents">
                <select
                  value={contactTypeFilter}
                  onChange={(event) => setContactTypeFilter(event.target.value)}
                  className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
                  aria-label="Filtrar contatos por tipo"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="person">Pessoa Física</option>
                  <option value="organization">Pessoa Jurídica</option>
                </select>
                <select
                  value={contactStatusFilter}
                  onChange={(event) => setContactStatusFilter(event.target.value)}
                  className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
                  aria-label="Filtrar contatos por status"
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativo</option>
                  <option value="prospect">Em análise</option>
                  <option value="under_review">Sob revisão</option>
                  <option value="inactive">Inativo</option>
                  <option value="blocked">Bloqueado</option>
                </select>
                <select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
                  aria-label="Filtrar contatos por unidade"
                >
                  <option value="TODAS">Todas as unidades</option>
                  {structure.businessUnits
                    .filter((item) => item.status === "active")
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                    .map((item) => (
                      <option key={item.id} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/60">
                  <tr className="label-caps">
                    {contactHeaders.map(({ key, label }) => (
                      <SortableTableHeader
                        key={key}
                        label={label}
                        active={contactSort?.key === key}
                        direction={contactSort?.direction ?? "asc"}
                        onSort={() => setContactSort((current) => nextTableSort(current, key))}
                      />
                    ))}
                    <th className="w-14 px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 && (
                    <EmptyRow colSpan={8} label="Nenhum contato encontrado." />
                  )}
                  {sortedContacts.map((party) => {
                    const email = primaryContact(parties, party.id, "email");
                    const phone = primaryPhone(parties, party.id);
                    return (
                      <tr key={party.id} className="border-t align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {party.trade_name?.trim() || party.legal_name}
                          </p>
                          {party.trade_name && (
                            <p className="mt-1 text-xs text-muted-foreground">{party.legal_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {party.party_type === "person" ? "Pessoa Física" : "Pessoa Jurídica"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={contactCategoryLabel(party.category)} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {party.tax_id ? formatTaxId(party.tax_id, party.party_type) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p>{email?.value ?? "—"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {phone?.value ?? "Sem telefone"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <UnitTag>{unitCode(structure, party.primary_business_unit_id)}</UnitTag>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={partyStatusLabel(party.status)} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RowActionsMenu
                            onView={() => setContactAction({ action: "view", record: party })}
                            onEdit={() => setContactAction({ action: "edit", record: party })}
                            editDisabled={!permissions.partyManage}
                            onDelete={() => setContactAction({ action: "destroy", record: party })}
                            deleteDisabled={!permissions.partyManage}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="leads" className="space-y-5">
          <Panel
            title="Leads"
            description="Potenciais relacionamentos ainda não convertidos em contatos corporativos."
          >
            <div className="grid gap-2 border-b px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(260px,1fr)_repeat(5,minmax(128px,auto))]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={leadSearch}
                  onChange={(event) => setLeadSearch(event.target.value)}
                  placeholder="Buscar lead"
                  className="h-9 w-full rounded-sm pl-9"
                />
              </div>
              <select
                value={leadTypeFilter}
                onChange={(event) => setLeadTypeFilter(event.target.value)}
                className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
                aria-label="Filtrar leads por tipo"
              >
                <option value="all">Todos os tipos</option>
                <option value="person">Pessoa Física</option>
                <option value="organization">Pessoa Jurídica</option>
              </select>
              <select
                value={leadStatusFilter}
                onChange={(event) => setLeadStatusFilter(event.target.value)}
                className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
                aria-label="Filtrar leads por status"
              >
                <option value="all">Todos os status</option>
                {[
                  "new",
                  "contact_pending",
                  "contacted",
                  "qualifying",
                  "qualified",
                  "proposal_sent",
                  "negotiation",
                  "converted",
                  "lost",
                  "disqualified",
                ].map((status) => (
                  <option key={status} value={status}>
                    {leadStatusLabel(status as CrmLead["status"])}
                  </option>
                ))}
              </select>
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
                aria-label="Filtrar leads por unidade"
              >
                <option value="TODAS">Todas as unidades</option>
                {structure.businessUnits
                  .filter((item) => item.status === "active")
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                  .map((item) => (
                    <option key={item.id} value={item.code}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <select
                value={leadOwnerFilter}
                onChange={(event) => setLeadOwnerFilter(event.target.value)}
                className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
                aria-label="Filtrar leads por responsável"
              >
                <option value="all">Todos os responsáveis</option>
                <option value="unassigned">Sem responsável</option>
                {crm.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <select
                value={leadSourceFilter}
                onChange={(event) => setLeadSourceFilter(event.target.value)}
                className="h-9 min-w-0 w-full rounded-sm border bg-background px-3 text-sm"
                aria-label="Filtrar leads por origem"
              >
                <option value="all">Todas as origens</option>
                {[
                  "site",
                  "online_form",
                  "whatsapp",
                  "phone",
                  "email",
                  "social",
                  "referral",
                  "prospecting",
                  "partner",
                  "other",
                ].map((source) => (
                  <option key={source} value={source}>
                    {leadSourceLabel(source as CrmLead["source"])}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/60">
                  <tr className="label-caps">
                    {leadHeaders.map(({ key, label }) => (
                      <SortableTableHeader
                        key={key}
                        label={label}
                        active={leadSort?.key === key}
                        direction={leadSort?.direction ?? "asc"}
                        onSort={() => setLeadSort((current) => nextTableSort(current, key))}
                      />
                    ))}
                    <th className="w-14 px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 && <EmptyRow colSpan={8} label="Nenhum lead encontrado." />}
                  {sortedLeads.map((lead) => (
                    <tr key={lead.id} className="border-t align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {lead.lead_type === "organization"
                            ? lead.trade_name || lead.company_name || lead.contact_name
                            : lead.contact_name}
                        </p>
                        {lead.lead_type === "organization" && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {lead.company_name && lead.trade_name ? `${lead.company_name} · ` : ""}
                            Contato: {lead.contact_name}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.lead_type === "person" ? "Pessoa Física" : "Pessoa Jurídica"}
                      </td>
                      <td className="px-4 py-3">
                        <p>{lead.email ?? "—"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {lead.phone ?? lead.whatsapp ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{leadPrimaryServiceLabel(lead, crm)}</td>
                      <td className="px-4 py-3">{leadSourceLabel(lead.source)}</td>
                      <td className="px-4 py-3">{leadPriorityLabel(lead.priority)}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={leadStatusLabel(lead.status)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActionsMenu
                          onView={() => setLeadAction({ action: "view", leadId: lead.id })}
                          onEdit={() => setLeadAction({ action: "edit", leadId: lead.id })}
                          editDisabled={!permissions.leadManage}
                          onDelete={() => setLeadAction({ action: "destroy", leadId: lead.id })}
                          deleteDisabled={!permissions.leadManage || lead.status === "converted"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      <ContactFormDialog
        state={contactAction}
        parties={parties}
        structure={structure}
        profiles={crm.profiles}
        canManage={permissions.partyManage}
        canReadSensitive={permissions.sensitiveRead}
        canManageSensitive={permissions.sensitiveManage}
        onClose={() => setContactAction(null)}
        onChanged={refreshContacts}
      />
      <LeadDialog
        state={leadAction}
        directory={crm}
        canConvert={permissions.convert && permissions.partyManage}
        canManage={permissions.leadManage}
        onClose={() => setLeadAction(null)}
        onChanged={refreshLeads}
        onConvert={(lead) => {
          setLeadAction(null);
          setActiveTab("contacts");
          setContactAction({ action: "create", sourceLead: lead });
        }}
        onEdit={(lead) => setLeadAction({ action: "edit", leadId: lead.id })}
      />
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando CRM…
    </div>
  );
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="CRM" description="Não foi possível carregar contatos e leads." />
      <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Falha ao carregar o CRM."}
      </div>
    </div>
  );
}

function primaryContact(data: PartiesData, partyId: string, type: PartyContact["contact_type"]) {
  return (
    data.contacts.find(
      (contact) =>
        contact.party_id === partyId &&
        contact.contact_type === type &&
        contact.status === "active" &&
        contact.is_primary,
    ) ??
    data.contacts.find(
      (contact) =>
        contact.party_id === partyId &&
        contact.contact_type === type &&
        contact.status === "active",
    ) ??
    null
  );
}

function primaryPhone(data: PartiesData, partyId: string) {
  return primaryContact(data, partyId, "mobile") ?? primaryContact(data, partyId, "phone");
}

function countCategory(parties: Party[], category: string) {
  return parties.filter((party) => party.category === category).length;
}

function unitCode(structure: CrmReferenceData, id: string | null): string {
  if (!id) return "CORPORATIVO";
  return structure.businessUnits.find((item) => item.id === id)?.code ?? "UNIDADE_REMOVIDA";
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatTaxId(value: string | null, type: PartyType): string {
  if (!value) return "—";
  return type === "person" ? maskCpf(value) : maskCnpj(value);
}
