export interface BusinessUnit {
  id: string;
  legal_entity_id: string;
  code: string;
  name: string;
  description: string | null;
  unit_type: "administrative" | "product" | "services";
  status: "active" | "inactive" | "closed";
  primary_currency_code: string;
  responsible_user_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_system: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}
