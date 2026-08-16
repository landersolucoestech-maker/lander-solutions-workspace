import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  CrmActivity,
  CrmDirectory,
  CrmLead,
  CrmLeadDiagnosticRequest,
  CrmLeadService,
  CrmOpportunity,
  CrmProjectProfile,
  CrmProjectScopeItem,
  CrmProposal,
  CrmProposalItem,
  CrmProposalVersion,
} from "./types";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

async function selectRows(table: string, orderColumn?: string) {
  const client = getSupabaseBrowserClient();
  let query = client.from(table).select("*");
  if (orderColumn) query = query.order(orderColumn);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listCrmDirectory(): Promise<CrmDirectory> {
  const stages = await selectRows("crm_pipeline_stages", "position");
  const leads = await selectRows("crm_leads", "created_at");
  const leadServices = await selectRows("crm_lead_services", "created_at");
  const leadDiagnostics = await selectRows("crm_lead_diagnostic_requests", "sent_at");
  const opportunities = await selectRows("crm_opportunities", "created_at");
  const proposals = await selectRows("crm_proposals", "created_at");
  const proposalVersions = await selectRows("crm_proposal_versions", "version_number");
  const proposalItems = await selectRows("crm_proposal_items", "sequence_no");
  const projectProfiles = await selectRows("crm_project_profiles", "created_at");
  const projectScopeItems = await selectRows("crm_project_scope_items", "sequence_no");
  const profitability = await selectRows("crm_project_profitability", "project_name");
  const activities = await selectRows("crm_activities", "created_at");
  const businessUnitRows = await selectRows("business_units", "name");
  const productRows = await selectRows("products", "name");
  const serviceRows = await selectRows("service_lines", "name");
  const partyRows = await selectRows("parties", "legal_name");
  const profileRows = await selectRows("profiles", "display_name");
  const projectRows = await selectRows("projects", "name");

  return {
    stages: stages as CrmDirectory["stages"],
    leads: leads as CrmDirectory["leads"],
    leadServices: leadServices as CrmDirectory["leadServices"],
    leadDiagnostics: leadDiagnostics as CrmDirectory["leadDiagnostics"],
    opportunities: opportunities as CrmDirectory["opportunities"],
    proposals: proposals as CrmDirectory["proposals"],
    proposalVersions: proposalVersions as CrmDirectory["proposalVersions"],
    proposalItems: proposalItems as CrmDirectory["proposalItems"],
    projectProfiles: projectProfiles as CrmDirectory["projectProfiles"],
    projectScopeItems: projectScopeItems as CrmDirectory["projectScopeItems"],
    profitability: profitability as CrmDirectory["profitability"],
    activities: activities as CrmDirectory["activities"],
    businessUnits: businessUnitRows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
    })),
    products: productRows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      business_unit_id: String(row.business_unit_id),
    })),
    serviceLines: serviceRows
      .filter((row) => String(row.status) === "active")
      .map((row) => ({
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        business_unit_id: String(row.business_unit_id),
      })),
    parties: partyRows.map((row) => ({
      id: String(row.id),
      name: String(row.trade_name ?? row.legal_name),
    })),
    profiles: profileRows.map((row) => ({
      id: String(row.id),
      name: String(row.display_name ?? row.email ?? row.id),
    })),
    projects: projectRows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      business_unit_id: String(row.business_unit_id),
    })),
  };
}

async function insertOne<T>(table: string, values: Record<string, unknown>): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).insert(values).select("*").single();
  if (error) throw error;
  return data as T;
}

async function updateOne<T>(
  table: string,
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
  message: string,
): Promise<T> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from(table)
    .update(values)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return requireData(data as T | null, message);
}

async function deleteOne(table: string, id: string, message: string) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  requireData(data, message);
}

export const createLead = (values: Record<string, unknown>) =>
  insertOne<CrmLead>("crm_leads", values);
export const updateLead = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<CrmLead>("crm_leads", id, version, values, "O lead foi alterado por outro usuário.");
export const deleteLead = (id: string) => deleteOne("crm_leads", id, "O lead não foi excluído.");

export async function replaceLeadServices(
  leadId: string,
  services: Array<{
    service_line_id: string | null;
    custom_service_name: string | null;
    is_primary: boolean;
  }>,
): Promise<CrmLeadService[]> {
  const client = getSupabaseBrowserClient();
  const { error: deleteError } = await client
    .from("crm_lead_services")
    .delete()
    .eq("lead_id", leadId);
  if (deleteError) throw deleteError;
  if (services.length === 0) return [];
  const { data, error } = await client
    .from("crm_lead_services")
    .insert(services.map((service) => ({ ...service, lead_id: leadId })))
    .select("*");
  if (error) throw error;
  return (data ?? []) as CrmLeadService[];
}

export async function createLeadDiagnosticRequest(values: {
  lead_id: string;
  service_line_id: string | null;
  custom_service_name: string | null;
  delivery_mode: "internal" | "external";
  form_url: string | null;
}): Promise<CrmLeadDiagnosticRequest> {
  return insertOne<CrmLeadDiagnosticRequest>("crm_lead_diagnostic_requests", values);
}

export function createOpportunity(values: Record<string, unknown>) {
  const id = crypto.randomUUID();
  return insertOne<CrmOpportunity>("crm_opportunities", {
    ...values,
    id,
    code: `OPP_${id.replaceAll("-", "").slice(0, 16).toUpperCase()}`,
  });
}
export const updateOpportunity = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<CrmOpportunity>(
    "crm_opportunities",
    id,
    version,
    values,
    "A oportunidade foi alterada por outro usuário.",
  );
export const deleteOpportunity = (id: string) =>
  deleteOne("crm_opportunities", id, "A oportunidade não foi excluída.");

export async function createProposalDraft(values: {
  opportunity_id: string;
  party_id: string;
  business_unit_id: string;
  title: string;
  owner_user_id?: string | null;
  currency_code: string;
  valid_until: string;
  payment_terms?: string | null;
  scope_summary?: string | null;
}) {
  const client = getSupabaseBrowserClient();
  const proposalId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const code = `PROP_${proposalId.replaceAll("-", "").slice(0, 16).toUpperCase()}`;
  const { data: proposal, error: proposalError } = await client
    .from("crm_proposals")
    .insert({
      id: proposalId,
      opportunity_id: values.opportunity_id,
      party_id: values.party_id,
      business_unit_id: values.business_unit_id,
      title: values.title,
      owner_user_id: values.owner_user_id ?? null,
      code,
      status: "draft",
    })
    .select("*")
    .single();
  if (proposalError) throw proposalError;

  const { data: version, error: versionError } = await client
    .from("crm_proposal_versions")
    .insert({
      id: versionId,
      proposal_id: proposalId,
      version_number: 1,
      currency_code: values.currency_code,
      valid_until: values.valid_until,
      payment_terms: values.payment_terms ?? null,
      scope_summary: values.scope_summary ?? null,
      status: "draft",
    })
    .select("*")
    .single();
  if (versionError) {
    await client.from("crm_proposals").delete().eq("id", proposalId);
    throw versionError;
  }

  const { error: linkError } = await client
    .from("crm_proposals")
    .update({ current_version_id: versionId })
    .eq("id", proposalId);
  if (linkError) throw linkError;
  return { proposal: proposal as CrmProposal, version: version as CrmProposalVersion };
}

export const updateProposal = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<CrmProposal>(
    "crm_proposals",
    id,
    version,
    values,
    "A proposta foi alterada por outro usuário.",
  );
export const deleteProposal = (id: string) =>
  deleteOne("crm_proposals", id, "A proposta não foi excluída.");
export const updateProposalVersion = (
  id: string,
  version: number,
  values: Record<string, unknown>,
) =>
  updateOne<CrmProposalVersion>(
    "crm_proposal_versions",
    id,
    version,
    values,
    "A versão da proposta foi alterada por outro usuário.",
  );
export const createProposalItem = (values: Record<string, unknown>) =>
  insertOne<CrmProposalItem>("crm_proposal_items", values);
export const updateProposalItem = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<CrmProposalItem>(
    "crm_proposal_items",
    id,
    version,
    values,
    "O item da proposta foi alterado por outro usuário.",
  );
export const deleteProposalItem = (id: string) =>
  deleteOne("crm_proposal_items", id, "O item da proposta não foi excluído.");

export const updateProjectProfile = (
  id: string,
  version: number,
  values: Record<string, unknown>,
) =>
  updateOne<CrmProjectProfile>(
    "crm_project_profiles",
    id,
    version,
    values,
    "O projeto foi alterado por outro usuário.",
  );
export const createProjectScopeItem = (values: Record<string, unknown>) =>
  insertOne<CrmProjectScopeItem>("crm_project_scope_items", values);
export const updateProjectScopeItem = (
  id: string,
  version: number,
  values: Record<string, unknown>,
) =>
  updateOne<CrmProjectScopeItem>(
    "crm_project_scope_items",
    id,
    version,
    values,
    "O item de escopo foi alterado por outro usuário.",
  );
export const deleteProjectScopeItem = (id: string) =>
  deleteOne("crm_project_scope_items", id, "O item de escopo não foi excluído.");

export const createActivity = (values: Record<string, unknown>) =>
  insertOne<CrmActivity>("crm_activities", values);
export const updateActivity = (id: string, version: number, values: Record<string, unknown>) =>
  updateOne<CrmActivity>(
    "crm_activities",
    id,
    version,
    values,
    "A atividade foi alterada por outro usuário.",
  );
export const deleteActivity = (id: string) =>
  deleteOne("crm_activities", id, "A atividade não foi excluída.");

async function invoke(body: Record<string, unknown>) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-crm", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data?.result;
}

export const qualifyLead = (leadId: string, expectedVersion: number) =>
  invoke({ action: "qualify-lead", leadId, expectedVersion });
export const submitProposal = (proposalVersionId: string, expectedVersion: number) =>
  invoke({ action: "submit-proposal", proposalVersionId, expectedVersion });
export const decideProposal = (
  proposalVersionId: string,
  expectedVersion: number,
  approve: boolean,
  reason?: string,
) =>
  invoke({
    action: approve ? "approve-proposal" : "reject-proposal",
    proposalVersionId,
    expectedVersion,
    reason,
  });
export const sendProposal = (proposalVersionId: string, expectedVersion: number) =>
  invoke({ action: "send-proposal", proposalVersionId, expectedVersion });
export const resolveProposal = (
  proposalVersionId: string,
  expectedVersion: number,
  accept: boolean,
  reason?: string,
) =>
  invoke({
    action: accept ? "accept-proposal" : "reject-sent-proposal",
    proposalVersionId,
    expectedVersion,
    reason,
  });
export const closeOpportunityLost = (
  opportunityId: string,
  expectedVersion: number,
  reason: string,
) => invoke({ action: "close-opportunity-lost", opportunityId, expectedVersion, reason });
export const convertOpportunityToProject = (opportunityId: string, expectedVersion: number) =>
  invoke({ action: "convert-opportunity-project", opportunityId, expectedVersion });
