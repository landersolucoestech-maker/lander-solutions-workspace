import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuditEvent, AuditFilters, AuditPageResult, AuditSummary } from "./types";

const auditColumns = [
  "id",
  "occurred_at",
  "actor_user_id",
  "actor_session_id",
  "action",
  "entity_schema",
  "entity_table",
  "entity_id",
  "before_data",
  "after_data",
  "metadata",
  "request_id",
].join(",");

function safeSearch(value: string) {
  return value
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ");
}

export async function listAuditEvents(filters: AuditFilters): Promise<AuditPageResult> {
  const client = getSupabaseBrowserClient();
  const from = Math.max(0, (filters.page - 1) * filters.pageSize);
  const to = from + filters.pageSize - 1;

  let query = client
    .from("audit_events")
    .select(auditColumns, { count: "exact" })
    .order("id", { ascending: false })
    .range(from, to);

  const search = safeSearch(filters.search);
  if (search) {
    const pattern = `*${search}*`;
    query = query.or(
      [
        `action.ilike.${pattern}`,
        `entity_schema.ilike.${pattern}`,
        `entity_table.ilike.${pattern}`,
        `entity_id.ilike.${pattern}`,
        `request_id.ilike.${pattern}`,
      ].join(","),
    );
  }
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.entityTable) query = query.eq("entity_table", filters.entityTable);
  if (filters.actorUserId) query = query.eq("actor_user_id", filters.actorUserId);
  if (filters.dateFrom) query = query.gte("occurred_at", `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte("occurred_at", `${filters.dateTo}T23:59:59.999Z`);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    events: (data ?? []) as unknown as AuditEvent[],
    total: count ?? 0,
  };
}

async function countAuditRows(action?: string) {
  const client = getSupabaseBrowserClient();
  let query = client.from("audit_events").select("id", { count: "exact", head: true });
  if (action) query = query.eq("action", action);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getAuditSummary(): Promise<AuditSummary> {
  const [total, inserts, updates, deletes] = await Promise.all([
    countAuditRows(),
    countAuditRows("insert"),
    countAuditRows("update"),
    countAuditRows("delete"),
  ]);
  return { total, inserts, updates, deletes };
}

export async function listAuditEntityTables(): Promise<string[]> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("audit_events")
    .select("entity_table")
    .order("entity_table")
    .limit(5000);
  if (error) throw error;

  return [...new Set((data ?? []).map((row) => String(row.entity_table)).filter(Boolean))];
}
