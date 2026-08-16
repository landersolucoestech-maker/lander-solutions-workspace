export type OrganizationalEntityKind =
  | "legal_entities"
  | "business_units"
  | "departments"
  | "positions"
  | "products"
  | "service_lines"
  | "projects"
  | "cost_centers"
  | "revenue_centers";

export interface OrganizationalRow {
  id: string;
  code?: string;
  name?: string;
  legal_name?: string;
  trade_name?: string | null;
  description?: string | null;
  status?: string;
  legal_entity_id?: string | null;
  business_unit_id?: string | null;
  department_id?: string | null;
  product_id?: string | null;
  service_line_id?: string | null;
  cost_center_id?: string | null;
  revenue_center_id?: string | null;
  parent_id?: string | null;
  parent_project_id?: string | null;
  manager_user_id?: string | null;
  owner_user_id?: string | null;
  sponsor_user_id?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  version?: number;
  [key: string]: unknown;
}

export interface OrganizationalDirectory {
  legalEntities: OrganizationalRow[];
  businessUnits: OrganizationalRow[];
  departments: OrganizationalRow[];
  positions: OrganizationalRow[];
  products: OrganizationalRow[];
  serviceLines: OrganizationalRow[];
  projects: OrganizationalRow[];
  costCenters: OrganizationalRow[];
  revenueCenters: OrganizationalRow[];
  profiles: Array<{ id: string; name: string }>;
}
