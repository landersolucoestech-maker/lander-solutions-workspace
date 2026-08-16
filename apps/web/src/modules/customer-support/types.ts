export type SupportPriority = "low" | "normal" | "high" | "urgent" | "critical";
export type SupportConversationStatus =
  | "new"
  | "automation"
  | "waiting_for_customer"
  | "waiting_for_agent"
  | "open"
  | "pending"
  | "resolved"
  | "closed";
export type SupportChannelStatus =
  "not_configured" | "configured" | "active" | "disabled" | "error";
export type SupportAutomationStatus = "draft" | "published" | "archived";
export type SupportDataValue =
  string | number | boolean | null | SupportDataValue[] | { [key: string]: SupportDataValue };
export type SupportDataObject = { [key: string]: SupportDataValue };

export interface VersionedRecord {
  id: string;
  version: number;
  updated_at: string;
}

export interface SupportBusinessUnitSummary {
  id: string;
  legalEntityId: string;
  code: string;
  name: string;
  status: string;
}

export interface SupportProductSettings extends VersionedRecord {
  legal_entity_id: string;
  product_id: string;
  brand_name: string;
  internal_description: string | null;
  timezone: string;
  default_language: string;
  status: "active" | "inactive" | "archived";
  automation_enabled: boolean;
  fallback_queue_id: string | null;
  identity_settings: SupportDataObject;
}

export interface SupportProductCatalogItem {
  id: string;
  businessUnitId: string;
  code: string;
  name: string;
  description: string | null;
  productType: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  businessUnit: SupportBusinessUnitSummary;
  settings: SupportProductSettings;
}

export interface SupportProduct {
  id: string;
  business_unit_id: string;
  code: string;
  name: string;
  description: string | null;
  product_type: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SupportScope {
  productId: string;
  legalEntityId: string;
  unitCode: string;
}

export interface SupportProfile {
  id: string;
  email: string | null;
  displayName: string;
  status: string;
  mfaRequired: boolean;
  lastSeenAt: string | null;
  version: number;
}

export interface SupportParty {
  id: string;
  legalName: string;
  tradeName: string | null;
  status: string;
}

export interface SupportProductMember extends VersionedRecord {
  product_id: string;
  user_id: string;
  operation_role: "admin" | "manager" | "supervisor" | "agent" | "viewer";
  availability_status: "offline" | "available" | "busy" | "away";
  capacity: number;
  supervisor_user_id: string | null;
  status: "active" | "inactive";
}

export interface SupportQueue extends VersionedRecord {
  legal_entity_id: string;
  product_id: string | null;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive" | "archived";
  default_priority: SupportPriority;
  distribution_strategy: "manual" | "round_robin" | "least_loaded" | "specific_agent";
  business_hours_id: string | null;
  sla_policy_id: string | null;
  capacity: number | null;
}

export interface SupportChannel extends VersionedRecord {
  legal_entity_id: string;
  product_id: string;
  channel_type: "web_chat" | "in_app" | "email" | "whatsapp" | "sms" | "manual" | "api";
  name: string;
  provider: string | null;
  status: SupportChannelStatus;
  integration_connection_id: string | null;
  external_identifier: string | null;
  settings: SupportDataObject;
  last_error: string | null;
}

export interface SupportNamedRecord extends VersionedRecord {
  product_id: string;
  code: string;
  name: string;
  status: string;
}

export interface SupportForm extends SupportNamedRecord {
  legal_entity_id: string;
  description: string | null;
  form_version: number;
}

export interface SupportTemplate extends SupportNamedRecord {
  legal_entity_id: string;
  category: string;
  channel_type: SupportChannel["channel_type"] | null;
  language_code: string;
  content: string;
  allowed_variables: string[];
  template_version: number;
}

export interface SupportBusinessHours extends VersionedRecord {
  legal_entity_id: string;
  product_id: string | null;
  name: string;
  timezone: string;
  is_24_hours: boolean;
  status: string;
}

export interface SupportSlaPolicy extends VersionedRecord {
  legal_entity_id: string;
  product_id: string;
  name: string;
  status: string;
  business_hours_id: string | null;
  priority: SupportPriority | null;
  conditions: SupportDataObject;
  first_response_minutes: number;
  next_response_minutes: number | null;
  resolution_minutes: number;
  pause_statuses: string[];
}

export interface SupportAutomationFlow extends VersionedRecord {
  legal_entity_id: string;
  product_id: string;
  status: string;
  published_version_id: string | null;
  draft_version_id: string | null;
}

export interface SupportAutomationVersion extends VersionedRecord {
  flow_id: string;
  version_number: number;
  status: SupportAutomationStatus;
  welcome_message: string | null;
  invalid_option_message: string | null;
  inactivity_message: string | null;
  out_of_hours_message: string | null;
  human_handoff_message: string | null;
  closing_message: string | null;
  return_commands: string[];
  invalid_attempt_limit: number;
  inactivity_minutes: number;
  inactivity_action: "return_to_menu" | "human_handoff" | "close_conversation" | "none";
  fallback_queue_id: string | null;
  language_code: string;
  timezone: string;
  menu_render_mode: "auto_generated" | "custom";
  custom_menu_text: string | null;
  published_at: string | null;
  published_by: string | null;
  validation_errors: Array<{ code: string; message: string; optionId?: string }>;
}

export interface SupportRoutingOption {
  id: string;
  automation_version_id: string;
  display_order: number;
  title: string;
  description: string | null;
  status: "active" | "inactive";
  category_id: string | null;
  queue_id: string | null;
  default_assignee_user_id: string | null;
  priority: SupportPriority;
  response_template_id: string | null;
  form_id: string | null;
  action_type:
    | "collect_form"
    | "assign_queue"
    | "assign_agent"
    | "create_ticket"
    | "send_template"
    | "close_conversation"
    | "return_to_menu"
    | "human_handoff";
  action_settings: SupportDataObject;
}

export interface SupportEscalationRule extends VersionedRecord {
  legal_entity_id: string;
  product_id: string;
  sla_policy_id: string | null;
  queue_id: string | null;
  name: string;
  event_type:
    | "first_response_at_risk"
    | "first_response_breached"
    | "resolution_at_risk"
    | "resolution_breached"
    | "customer_waiting"
    | "ticket_unassigned"
    | "critical_incident";
  elapsed_minutes: number;
  escalation_level: number;
  recipient_role: string | null;
  recipient_queue_id: string | null;
  recipient_user_id: string | null;
  delivery_channels: Array<"in_app" | "email" | "whatsapp" | "sms" | "webhook">;
  message: string;
  priority: SupportPriority;
  status: "active" | "inactive" | "archived";
  display_order: number;
  repeat_policy: "once" | "repeat_until_resolved";
  repeat_interval_minutes: number | null;
  notification_limit: number;
}

export interface SupportConversation extends VersionedRecord {
  product_id: string;
  channel_id: string;
  contact_party_id: string;
  organization_party_id: string | null;
  subject: string | null;
  status: SupportConversationStatus;
  current_queue_id: string | null;
  current_agent_user_id: string | null;
  priority: SupportPriority;
  last_message_preview: string | null;
  last_activity_at: string;
  contact?: { id: string; name: string };
  queue?: { id: string; name: string; code: string } | null;
  agent?: { id: string; name: string; email: string | null } | null;
  channel?: { id: string; name: string; type: string; status: string };
}

export interface SupportWorkspace {
  product: SupportProduct;
  scope: SupportScope;
  settings: SupportProductSettings;
  productMembers: SupportProductMember[];
  queues: SupportQueue[];
  queueMembers: Array<{
    id: string;
    queue_id: string;
    user_id: string;
    membership_role: string;
    capacity: number | null;
    status: string;
  }>;
  channels: SupportChannel[];
  categories: SupportNamedRecord[];
  tags: SupportNamedRecord[];
  templates: SupportTemplate[];
  forms: SupportForm[];
  formFields: Array<{
    id: string;
    form_id: string;
    field_key: string;
    label: string;
    field_type: string;
    display_order: number;
    is_required: boolean;
    placeholder: string | null;
    help_text: string | null;
    default_value: SupportDataValue;
    validation_rules: SupportDataObject;
    options: SupportDataValue[];
    display_condition: SupportDataObject | null;
    privacy_settings: SupportDataObject;
  }>;
  businessHours: SupportBusinessHours[];
  businessHourIntervals: Array<{
    id: string;
    business_hours_id: string;
    weekday: number;
    starts_at: string;
    ends_at: string;
  }>;
  holidays: Array<{
    id: string;
    business_hours_id: string;
    holiday_date: string;
    name: string;
    is_closed: boolean;
    special_starts_at: string | null;
    special_ends_at: string | null;
  }>;
  slaPolicies: SupportSlaPolicy[];
  escalationRules: SupportEscalationRule[];
  automationFlow: SupportAutomationFlow | null;
  automationVersions: SupportAutomationVersion[];
  routingOptions: SupportRoutingOption[];
  routingOptionTags: Array<{ routing_option_id: string; tag_id: string }>;
  profiles: SupportProfile[];
  contacts: SupportParty[];
  organizations: SupportParty[];
}

export interface SupportInboxPage {
  conversations: SupportConversation[];
  count: number;
  page: number;
  pageSize: number;
}

export interface SupportApiEnvelope<T> {
  result: T;
  requestId: string;
}
