import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { OrganizationalDirectory, OrganizationalEntityKind, OrganizationalRow } from "./types";

function asRows(data: unknown[] | null): OrganizationalRow[] {
  return (data ?? []) as OrganizationalRow[];
}

export async function listOrganizationalDirectory(): Promise<OrganizationalDirectory> {
  const client = getSupabaseBrowserClient();

  const legalEntitiesResult = await client.from("legal_entities").select("*").order("code");
  if (legalEntitiesResult.error) throw legalEntitiesResult.error;

  const businessUnitsResult = await client.from("business_units").select("*").order("code");
  if (businessUnitsResult.error) throw businessUnitsResult.error;

  const departmentsResult = await client.from("departments").select("*").order("code");
  if (departmentsResult.error) throw departmentsResult.error;

  const positionsResult = await client
    .from("positions")
    .select("*")
    .is("deleted_at", null)
    .order("code");
  if (positionsResult.error) throw positionsResult.error;

  const productsResult = await client.from("products").select("*").order("code");
  if (productsResult.error) throw productsResult.error;

  const serviceLinesResult = await client.from("service_lines").select("*").order("code");
  if (serviceLinesResult.error) throw serviceLinesResult.error;

  const projectsResult = await client.from("projects").select("*").order("code");
  if (projectsResult.error) throw projectsResult.error;

  const costCentersResult = await client.from("cost_centers").select("*").order("code");
  if (costCentersResult.error) throw costCentersResult.error;

  const revenueCentersResult = await client.from("revenue_centers").select("*").order("code");
  if (revenueCentersResult.error) throw revenueCentersResult.error;

  const profilesResult = await client
    .from("profiles")
    .select("id,display_name,email,status")
    .eq("status", "active")
    .order("display_name");
  if (profilesResult.error) throw profilesResult.error;

  return {
    legalEntities: asRows(legalEntitiesResult.data),
    businessUnits: asRows(businessUnitsResult.data),
    departments: asRows(departmentsResult.data),
    positions: asRows(positionsResult.data),
    products: asRows(productsResult.data),
    serviceLines: asRows(serviceLinesResult.data),
    projects: asRows(projectsResult.data),
    costCenters: asRows(costCentersResult.data),
    revenueCenters: asRows(revenueCentersResult.data),
    profiles: (profilesResult.data ?? []).map((profile) => ({
      id: String(profile.id),
      name: String(profile.display_name || profile.email || profile.id),
    })),
  };
}

async function createRow(
  kind: OrganizationalEntityKind,
  values: Record<string, unknown>,
): Promise<OrganizationalRow> {
  const client = getSupabaseBrowserClient();
  switch (kind) {
    case "legal_entities": {
      const { data, error } = await client
        .from("legal_entities")
        .insert(values)
        .select("*")
        .single();
      if (error) throw error;
      return data as OrganizationalRow;
    }
    case "business_units": {
      const { data, error } = await client
        .from("business_units")
        .insert(values)
        .select("*")
        .single();
      if (error) throw error;
      return data as OrganizationalRow;
    }
    case "departments": {
      const { data, error } = await client.from("departments").insert(values).select("*").single();
      if (error) throw error;
      return data as OrganizationalRow;
    }
    case "positions": {
      const { data, error } = await client.from("positions").insert(values).select("*").single();
      if (error) throw error;
      return data as OrganizationalRow;
    }
    case "products": {
      const { data, error } = await client.from("products").insert(values).select("*").single();
      if (error) throw error;
      return data as OrganizationalRow;
    }
    case "service_lines": {
      const { data, error } = await client
        .from("service_lines")
        .insert(values)
        .select("*")
        .single();
      if (error) throw error;
      return data as OrganizationalRow;
    }
    case "projects": {
      const { data, error } = await client.from("projects").insert(values).select("*").single();
      if (error) throw error;
      return data as OrganizationalRow;
    }
    case "cost_centers": {
      const { data, error } = await client.from("cost_centers").insert(values).select("*").single();
      if (error) throw error;
      return data as OrganizationalRow;
    }
    case "revenue_centers": {
      const { data, error } = await client
        .from("revenue_centers")
        .insert(values)
        .select("*")
        .single();
      if (error) throw error;
      return data as OrganizationalRow;
    }
  }
}

async function updateRow(
  kind: OrganizationalEntityKind,
  id: string,
  version: number | undefined,
  values: Record<string, unknown>,
): Promise<OrganizationalRow> {
  const client = getSupabaseBrowserClient();
  const execute = async (table: OrganizationalEntityKind) => {
    let query = client.from(table).update(values).eq("id", id);
    if (typeof version === "number") query = query.eq("version", version);
    const { data, error } = await query.select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("O registro foi alterado ou removido por outro usuário.");
    return data as OrganizationalRow;
  };
  return execute(kind);
}

export async function saveOrganizationalRow(
  kind: OrganizationalEntityKind,
  id: string | null,
  version: number | undefined,
  values: Record<string, unknown>,
): Promise<OrganizationalRow> {
  return id ? updateRow(kind, id, version, values) : createRow(kind, values);
}

export async function deleteOrganizationalRow(
  kind: OrganizationalEntityKind,
  id: string,
): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(kind).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("O registro não foi excluído.");
}
