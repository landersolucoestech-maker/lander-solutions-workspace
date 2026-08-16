import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ProductStatus,
  ServiceLine,
} from "@/modules/company/organizational-structure/reference-data-api";

interface SaveLeadServiceInput {
  businessUnitId: string;
  record?: ServiceLine | null;
  code: string;
  name: string;
  description: string | null;
  status: ProductStatus;
}

interface LeadServiceResponse {
  service?: ServiceLine;
  error?: string;
}

export async function saveLeadService(input: SaveLeadServiceInput): Promise<ServiceLine> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke<LeadServiceResponse>(
    "admin-lead-services",
    {
      body: {
        action: input.record ? "update-service" : "create-service",
        businessUnitId: input.businessUnitId,
        serviceId: input.record?.id ?? null,
        expectedVersion: input.record?.version ?? null,
        code: input.code,
        name: input.name,
        description: input.description,
        status: input.status,
      },
    },
  );

  if (error) {
    throw new Error(data?.error?.trim() || error.message || "Falha ao salvar o serviço.");
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.service) throw new Error("O serviço não foi retornado pelo servidor.");
  return data.service;
}
