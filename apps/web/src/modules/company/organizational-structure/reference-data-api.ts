import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listBusinessUnits,
  type BusinessUnit,
} from "@/modules/company/organizational-structure/business-units";

export type DirectoryStatus = "active" | "inactive" | "closed";
export type ProductStatus = "planned" | "active" | "inactive" | "discontinued";
export type ProjectStatus = "planned" | "active" | "on_hold" | "completed" | "cancelled";

export interface LegalEntity {
  id: string;
  code: string;
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
  country_code: string;
  functional_currency_code: string;
  status: DirectoryStatus;
  is_system: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_unit_id: string;
  code: string;
  name: string;
  description: string | null;
  product_type: "saas" | "course" | "digital_product" | "content" | "other";
  status: ProductStatus;
  start_date: string | null;
  end_date: string | null;
  is_system: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceLine {
  id: string;
  business_unit_id: string;
  code: string;
  name: string;
  description: string | null;
  service_type: string;
  status: ProductStatus;
  start_date: string | null;
  end_date: string | null;
  is_system: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  code: string;
  name: string;
  description: string | null;
  responsible_user_id: string | null;
  status: DirectoryStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  department_id: string | null;
  code: string;
  name: string;
  description: string | null;
  responsible_user_id: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationalReferenceData {
  legalEntities: LegalEntity[];
  businessUnits: BusinessUnit[];
  products: Product[];
  serviceLines: ServiceLine[];
  departments: Department[];
  projects: Project[];
}

export async function listOrganizationalReferenceData(): Promise<OrganizationalReferenceData> {
  const client = getSupabaseBrowserClient();
  const [legalEntities, businessUnits, products, serviceLines, departments, projects] =
    await Promise.all([
      client.from("legal_entities").select("*").order("legal_name"),
      listBusinessUnits(),
      client.from("products").select("*").order("name"),
      client.from("service_lines").select("*").order("name"),
      client.from("departments").select("*").order("name"),
      client.from("projects").select("*").order("name"),
    ]);

  const failed = [legalEntities, products, serviceLines, departments, projects].find(
    (result) => result.error,
  );
  if (failed?.error) throw failed.error;

  return {
    legalEntities: (legalEntities.data ?? []) as LegalEntity[],
    businessUnits,
    products: (products.data ?? []) as Product[],
    serviceLines: (serviceLines.data ?? []) as ServiceLine[],
    departments: (departments.data ?? []) as Department[],
    projects: (projects.data ?? []) as Project[],
  };
}
