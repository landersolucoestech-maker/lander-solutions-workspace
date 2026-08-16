import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listBusinessUnits,
  type BusinessUnit,
} from "@/modules/company/organizational-structure/business-units";
import type {
  LegalEntity,
  Product,
  ServiceLine,
} from "@/modules/company/organizational-structure/reference-data-api";
import type { Currency } from "@/modules/finance/reference-data-api";

export interface ContractReferenceData {
  currencies: Currency[];
  legalEntities: LegalEntity[];
  businessUnits: BusinessUnit[];
  products: Product[];
  serviceLines: ServiceLine[];
}

export async function listContractReferenceData(): Promise<ContractReferenceData> {
  const client = getSupabaseBrowserClient();
  const [currencies, legalEntities, businessUnits, products, serviceLines] = await Promise.all([
    client.from("currencies").select("*").order("code"),
    client.from("legal_entities").select("*").order("legal_name"),
    listBusinessUnits(),
    client.from("products").select("*").order("name"),
    client.from("service_lines").select("*").order("name"),
  ]);
  const failed = [currencies, legalEntities, products, serviceLines].find((result) => result.error);
  if (failed?.error) throw failed.error;
  return {
    currencies: (currencies.data ?? []) as Currency[],
    legalEntities: (legalEntities.data ?? []) as LegalEntity[],
    businessUnits,
    products: (products.data ?? []) as Product[],
    serviceLines: (serviceLines.data ?? []) as ServiceLine[],
  };
}
