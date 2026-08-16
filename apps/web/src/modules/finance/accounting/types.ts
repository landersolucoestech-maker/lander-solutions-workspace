export interface FinancialCategory {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  description: string | null;
  category_type:
    | "revenue"
    | "deduction"
    | "tax"
    | "payment_fee"
    | "direct_cost"
    | "expense"
    | "investment"
    | "reserve"
    | "asset"
    | "liability"
    | "equity"
    | "transfer";
  status: "active" | "inactive";
  is_system: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}
