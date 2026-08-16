import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listBusinessUnits,
  type BusinessUnit,
} from "@/modules/company/organizational-structure/business-units";
import type { ServiceLine } from "@/modules/company/organizational-structure/reference-data-api";

export interface CrmReferenceData {
  businessUnits: BusinessUnit[];
  serviceLines: ServiceLine[];
}

export async function listCrmReferenceData(): Promise<CrmReferenceData> {
  const client = getSupabaseBrowserClient();
  const [businessUnits, serviceLines] = await Promise.all([
    listBusinessUnits(),
    client.from("service_lines").select("*").order("name"),
  ]);
  if (serviceLines.error) throw serviceLines.error;
  return {
    businessUnits,
    serviceLines: (serviceLines.data ?? []) as ServiceLine[],
  };
}
