import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface HrPositionDetail {
  id: string;
  business_unit_id: string | null;
  department_id: string | null;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  version: number;
}

export async function listHrPositionsForManagement(): Promise<HrPositionDetail[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("positions")
    .select("id,business_unit_id,department_id,code,name,description,status,version")
    .is("deleted_at", null)
    .order("name");

  if (error) throw error;
  return (data ?? []) as HrPositionDetail[];
}
