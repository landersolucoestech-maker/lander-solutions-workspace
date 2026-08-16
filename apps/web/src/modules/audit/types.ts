export type AuditJsonPrimitive = string | number | boolean | null;
export type AuditJsonValue =
  AuditJsonPrimitive | AuditJsonValue[] | { [key: string]: AuditJsonValue };

export interface AuditEvent {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  actor_session_id: string | null;
  action: string;
  entity_schema: string;
  entity_table: string;
  entity_id: string | null;
  before_data: AuditJsonValue | null;
  after_data: AuditJsonValue | null;
  metadata: AuditJsonValue;
  request_id: string | null;
}

export interface AuditFilters {
  search: string;
  action: string;
  entityTable: string;
  actorUserId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
}

export interface AuditPageResult {
  events: AuditEvent[];
  total: number;
}

export interface AuditSummary {
  total: number;
  inserts: number;
  updates: number;
  deletes: number;
}
