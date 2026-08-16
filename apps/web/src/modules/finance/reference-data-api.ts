import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { listFinancialCategories, type FinancialCategory } from "./accounting";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
  is_system: boolean;
  version: number;
}

export interface CostCenter {
  id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  code: string;
  name: string;
  description: string | null;
  allocation_scope: "corporate" | "direct" | "shared";
  status: "active" | "inactive" | "closed";
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RevenueCenter {
  id: string;
  legal_entity_id: string;
  business_unit_id: string;
  product_id: string | null;
  service_line_id: string | null;
  project_id: string | null;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive" | "closed";
  version: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialPeriod {
  id: string;
  legal_entity_id: string;
  period_start: string;
  period_end: string;
  status: "open" | "closing" | "closed" | "reopened";
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopening_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialReferenceData {
  currencies: Currency[];
  costCenters: CostCenter[];
  revenueCenters: RevenueCenter[];
  categories: FinancialCategory[];
  periods: FinancialPeriod[];
}

export async function listFinancialReferenceData(): Promise<FinancialReferenceData> {
  const client = getSupabaseBrowserClient();
  const [currencies, costCenters, revenueCenters, categories, periods] = await Promise.all([
    client.from("currencies").select("*").order("code"),
    client.from("cost_centers").select("*").order("code"),
    client.from("revenue_centers").select("*").order("code"),
    listFinancialCategories(),
    client.from("financial_periods").select("*").order("period_start", { ascending: false }),
  ]);
  const failed = [currencies, costCenters, revenueCenters, periods].find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    currencies: (currencies.data ?? []) as Currency[],
    costCenters: (costCenters.data ?? []) as CostCenter[],
    revenueCenters: (revenueCenters.data ?? []) as RevenueCenter[],
    categories,
    periods: (periods.data ?? []) as FinancialPeriod[],
  };
}
