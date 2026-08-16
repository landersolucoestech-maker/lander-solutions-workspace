import type {
  SupportAutomationVersion,
  SupportBusinessHours,
  SupportChannel,
  SupportConversation,
  SupportConversationStatus,
  SupportEscalationRule,
  SupportForm,
  SupportInboxPage,
  SupportNamedRecord,
  SupportPriority,
  SupportProductCatalogItem,
  SupportProductMember,
  SupportProductSettings,
  SupportQueue,
  SupportRoutingOption,
  SupportSlaPolicy,
  SupportTemplate,
  SupportWorkspace,
  VersionedRecord,
} from "./types";

export type SupportJsonPrimitive = string | number | boolean | null;
export type SupportJsonValue =
  SupportJsonPrimitive | SupportJsonValue[] | { [key: string]: SupportJsonValue };
export type SupportJsonObject = { [key: string]: SupportJsonValue };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class SupportApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = "SupportApiError";
  }
}

export function parseSupportApiEnvelope<A extends SupportAction>(
  action: A,
  data: unknown,
): SupportActionResponse<A> {
  if (!isObject(data)) {
    throw new SupportApiError(`Resposta inválida para a ação ${action}.`, "invalid_response", null);
  }
  if (typeof data.error === "string") {
    throw new SupportApiError(
      data.error,
      typeof data.code === "string" ? data.code : "support_error",
      typeof data.requestId === "string" ? data.requestId : null,
    );
  }
  if (!("result" in data)) {
    throw new SupportApiError(
      `A resposta da ação ${action} não contém resultado.`,
      "invalid_response",
      null,
    );
  }
  return data.result as SupportActionResponse<A>;
}

export type SupportChannelType =
  "web_chat" | "in_app" | "email" | "whatsapp" | "sms" | "manual" | "api";
export type SupportOperationRole = "admin" | "manager" | "supervisor" | "agent" | "viewer";
export type SupportAvailabilityStatus = "offline" | "available" | "busy" | "away";
export type SupportQueueMembershipRole = "manager" | "supervisor" | "agent" | "viewer";
export type SupportDistributionStrategy =
  "manual" | "round_robin" | "least_loaded" | "specific_agent";
export type SupportRecordStatus = "active" | "inactive" | "archived";
export type SupportDraftRecordStatus = "draft" | "active" | "archived";
export type SupportRoutingAction =
  | "collect_form"
  | "assign_queue"
  | "assign_agent"
  | "create_ticket"
  | "send_template"
  | "close_conversation"
  | "return_to_menu"
  | "human_handoff";
export type SupportMessageDirection = "inbound" | "outbound" | "internal";
export type SupportMessageSender = "customer" | "agent" | "automation" | "system";
export type SupportMessageContentType = "text" | "html" | "file" | "event";
export type SupportTicketStatus =
  "new" | "open" | "pending" | "waiting_for_customer" | "waiting_for_agent" | "resolved" | "closed";
export type SupportTicketTransitionAction =
  "assign" | "priority" | "status" | "resolve" | "reopen" | "close" | "internal_note";
export type SupportEscalationEvent =
  | "first_response_at_risk"
  | "first_response_breached"
  | "resolution_at_risk"
  | "resolution_breached"
  | "customer_waiting"
  | "ticket_unassigned"
  | "critical_incident";
export type SupportNotificationChannel = "in_app" | "email" | "whatsapp" | "sms" | "webhook";
export type SupportFormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "multi_select"
  | "checkbox"
  | "radio"
  | "file";

export interface SupportApiSuccessEnvelope<T> {
  result: T;
  requestId: string;
}

export interface SupportApiErrorEnvelope {
  error: string;
  code?: string;
  requestId?: string;
}

export interface SupportQueueMember {
  id: string;
  queue_id: string;
  user_id: string;
  membership_role: SupportQueueMembershipRole;
  capacity: number | null;
  status: "active" | "inactive";
  created_at: string;
}

export interface SupportCategory extends SupportNamedRecord {
  legal_entity_id: string;
  parent_id: string | null;
  description: string | null;
}

export type SupportTag = SupportNamedRecord & { legal_entity_id: string };

export interface SupportMessageTemplate extends SupportTemplate {
  legal_entity_id: string;
  channel_type: SupportChannelType | null;
  content: string;
  allowed_variables: string[];
}

export interface SupportFormField {
  id: string;
  form_id: string;
  field_key: string;
  label: string;
  field_type: SupportFormFieldType;
  display_order: number;
  is_required: boolean;
  placeholder: string | null;
  help_text: string | null;
  default_value: SupportJsonValue;
  validation_rules: SupportJsonObject;
  options: SupportJsonValue[];
  display_condition: SupportJsonObject | null;
  privacy_settings: SupportJsonObject;
  created_at: string;
}

export interface SupportBusinessHourInterval {
  id: string;
  business_hours_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export interface SupportHoliday {
  id: string;
  business_hours_id: string;
  holiday_date: string;
  name: string;
  is_closed: boolean;
  special_starts_at: string | null;
  special_ends_at: string | null;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  legal_entity_id: string;
  product_id: string;
  conversation_id: string;
  direction: SupportMessageDirection;
  sender_type: SupportMessageSender;
  sender_user_id: string | null;
  content_type: SupportMessageContentType;
  body: string | null;
  attachments: SupportJsonValue[];
  external_identifier: string | null;
  delivery_status: "stored" | "queued" | "sent" | "delivered" | "failed" | "read";
  idempotency_key: string | null;
  created_at: string;
}

export interface SupportTicket extends VersionedRecord {
  ticket_number: string;
  legal_entity_id: string;
  product_id: string;
  conversation_id: string | null;
  contact_party_id: string;
  organization_party_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  queue_id: string | null;
  agent_user_id: string | null;
  priority: SupportPriority;
  status: SupportTicketStatus;
  title: string;
  description: string | null;
  collected_data: SupportJsonObject;
  sla_policy_id: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  closure_reason: string | null;
  created_at: string;
}

export interface SupportTicketEvent {
  id: number;
  legal_entity_id: string;
  product_id: string;
  ticket_id: string;
  conversation_id: string | null;
  event_type:
    | "created"
    | "assigned"
    | "transferred"
    | "queue_changed"
    | "priority_changed"
    | "status_changed"
    | "response"
    | "internal_note"
    | "escalated"
    | "sla_breached"
    | "resolved"
    | "reopened"
    | "closed";
  actor_user_id: string | null;
  payload: SupportJsonObject;
  occurred_at: string;
}

export interface SupportAssignment {
  id: string;
  legal_entity_id: string;
  product_id: string;
  conversation_id: string | null;
  ticket_id: string | null;
  queue_id: string | null;
  agent_user_id: string | null;
  assigned_by: string | null;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface SupportAutomationValidationError {
  code: string;
  message: string;
  optionId?: string;
}

export interface SupportAutomationValidationResult {
  valid: boolean;
  errors: SupportAutomationValidationError[];
  productId: string;
}

export interface SupportAutomationDraftResult {
  version: SupportAutomationVersion;
  options: SupportRoutingOption[];
}

export interface SupportAutomationPreview extends SupportAutomationDraftResult {
  optionTags: Array<{ routing_option_id: string; tag_id: string }>;
  renderedMenu: string | null;
}

export interface SupportConversationDetail {
  conversation: SupportConversation;
  messages: SupportMessage[];
  tickets: SupportTicket[];
  assignments: SupportAssignment[];
}

export interface SupportConversationMessageResult {
  message: SupportMessage;
  conversation: SupportConversation;
}

export interface SupportConversationCreationResult {
  conversation: SupportConversation;
  messages: SupportMessage[];
}

export interface SupportTicketDetail {
  ticket: SupportTicket;
  events: SupportTicketEvent[];
  assignments: SupportAssignment[];
  tags: Array<{ ticket_id: string; tag_id: string; created_at: string }>;
}

export interface SupportQueueMembersResult {
  queueId: string;
  members: SupportQueueMember[];
}

export interface SupportFormSaveResult {
  form: SupportForm;
  fields: SupportFormField[];
}

export interface SupportBusinessHoursSaveResult {
  businessHours: SupportBusinessHours;
  intervals: SupportBusinessHourInterval[];
  holidays: SupportHoliday[];
}

export interface SupportSlaSimulationResult {
  firstResponseDueAt: string;
  resolutionDueAt: string;
}

export interface SupportAutomationPublishResult {
  valid: boolean;
  errors?: SupportAutomationValidationError[];
  publishedVersionId?: string;
  productId?: string;
}

export interface SupportAutomationRestoreResult {
  draftVersionId: string;
  versionNumber: number;
}

export interface SupportEscalationNotificationPreview {
  ruleId: string;
  eventType: SupportEscalationEvent;
  channel: SupportNotificationChannel;
  recipientUserId: string | null;
  recipientQueueId: string | null;
  message: string;
  idempotencyKey: string;
}

export interface SupportEscalationProcessingResult {
  ticketId: string;
  dryRun: boolean;
  notifications: SupportEscalationNotificationPreview[];
}

export interface SupportFormFieldInput {
  key: string;
  label: string;
  type: SupportFormFieldType;
  order: number;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: SupportJsonValue;
  validation?: SupportJsonObject;
  options?: SupportJsonValue[];
  displayCondition?: SupportJsonObject;
  privacy?: SupportJsonObject;
}

export interface SupportBusinessHourIntervalInput {
  weekday: number;
  startsAt: string;
  endsAt: string;
}

export interface SupportHolidayInput {
  date: string;
  name: string;
  isClosed: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface SupportRoutingOptionInput {
  order: number;
  title: string;
  description?: string;
  status?: "active" | "inactive";
  categoryId?: string;
  queueId?: string;
  defaultAssigneeUserId?: string;
  priority?: SupportPriority;
  templateId?: string;
  formId?: string;
  actionType: SupportRoutingAction;
  actionSettings?: SupportJsonObject;
  tagIds?: string[];
}

export type SupportTicketTransitionCommand =
  | {
      transition: "assign";
      payload: { queueId?: string; agentUserId?: string; reason?: string };
    }
  | { transition: "priority"; payload: { priority: SupportPriority } }
  | {
      transition: "status";
      payload: { status: Exclude<SupportTicketStatus, "resolved" | "closed"> };
    }
  | { transition: "resolve"; payload?: SupportJsonObject }
  | { transition: "reopen"; payload?: SupportJsonObject }
  | { transition: "close"; payload: { reason: string } }
  | { transition: "internal_note"; payload: { note: string } };

export interface SupportAutomationSettingsInput {
  welcomeMessage?: string;
  invalidOptionMessage?: string;
  inactivityMessage?: string;
  outOfHoursMessage?: string;
  humanHandoffMessage?: string;
  closingMessage?: string;
  returnCommands: string[];
  invalidAttemptLimit: number;
  inactivityMinutes: number;
  inactivityAction: "return_to_menu" | "human_handoff" | "close_conversation" | "none";
  fallbackQueueId?: string;
  languageCode: string;
  timezone: string;
  menuRenderMode: "auto_generated" | "custom";
  customMenuText?: string;
}

export interface SupportActionRequestMap {
  "list-products": { action: "list-products" };
  "get-workspace": { action: "get-workspace"; productId: string };
  "list-inbox": {
    action: "list-inbox";
    productId: string;
    page?: number;
    pageSize?: number;
    queueId?: string;
    agentUserId?: string;
    channelId?: string;
    categoryId?: string;
    slaPolicyId?: string;
    slaState?: "within_sla" | "at_risk" | "breached" | "no_sla";
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: SupportConversationStatus;
    priority?: SupportPriority;
    unassigned?: boolean;
  };
  "get-conversation": { action: "get-conversation"; conversationId: string };
  "get-ticket": { action: "get-ticket"; ticketId: string };
  "list-automation-versions": { action: "list-automation-versions"; productId: string };
  "preview-automation": { action: "preview-automation"; versionId: string };
  "simulate-sla": { action: "simulate-sla"; slaPolicyId: string; startedAt: string };
  "save-product-settings": {
    action: "save-product-settings";
    productId: string;
    settingsId: string;
    expectedVersion: number;
    brandName: string;
    internalDescription?: string;
    timezone: string;
    defaultLanguage: string;
    status: SupportRecordStatus;
    automationEnabled: boolean;
    fallbackQueueId?: string;
    identitySettings?: SupportJsonObject;
  };
  "save-product-member": {
    action: "save-product-member";
    productId: string;
    id?: string;
    expectedVersion?: number;
    userId: string;
    operationRole: SupportOperationRole;
    availabilityStatus: SupportAvailabilityStatus;
    capacity: number;
    supervisorUserId?: string;
    status: "active" | "inactive";
  };
  "save-queue": {
    action: "save-queue";
    id?: string;
    expectedVersion?: number;
    productId?: string;
    legalEntityId?: string;
    code: string;
    name: string;
    description?: string;
    status: SupportRecordStatus;
    defaultPriority: SupportPriority;
    distributionStrategy: SupportDistributionStrategy;
    businessHoursId?: string;
    slaPolicyId?: string;
    capacity?: number;
  };
  "archive-queue": { action: "archive-queue"; queueId: string; expectedVersion: number };
  "save-queue-members": {
    action: "save-queue-members";
    queueId: string;
    expectedVersion: number;
    members: Array<{
      userId: string;
      role: SupportQueueMembershipRole;
      capacity?: number;
    }>;
  };
  "save-category": {
    action: "save-category";
    productId: string;
    id?: string;
    expectedVersion?: number;
    parentId?: string;
    code: string;
    name: string;
    description?: string;
    status: SupportRecordStatus;
  };
  "save-tag": {
    action: "save-tag";
    productId: string;
    id?: string;
    expectedVersion?: number;
    code: string;
    name: string;
    status: SupportRecordStatus;
  };
  "save-channel": {
    action: "save-channel";
    productId: string;
    id?: string;
    expectedVersion?: number;
    channelType: SupportChannelType;
    name: string;
    provider?: string;
    status: "not_configured" | "configured" | "active" | "disabled" | "error";
    integrationConnectionId?: string;
    externalIdentifier?: string;
    settings?: SupportJsonObject;
  };
  "save-template": {
    action: "save-template";
    productId: string;
    id?: string;
    expectedVersion?: number;
    code: string;
    name: string;
    category: string;
    channelType?: SupportChannelType;
    languageCode: string;
    status: SupportDraftRecordStatus;
    content: string;
    allowedVariables: string[];
  };
  "archive-template": {
    action: "archive-template";
    templateId: string;
    expectedVersion: number;
  };
  "save-form": {
    action: "save-form";
    productId: string;
    id?: string;
    expectedVersion?: number;
    code: string;
    name: string;
    description?: string;
    status: SupportDraftRecordStatus;
    fields: SupportFormFieldInput[];
  };
  "archive-form": { action: "archive-form"; formId: string; expectedVersion: number };
  "save-business-hours": {
    action: "save-business-hours";
    id?: string;
    expectedVersion?: number;
    productId?: string;
    legalEntityId?: string;
    name: string;
    timezone: string;
    is24Hours: boolean;
    status: SupportRecordStatus;
    intervals: SupportBusinessHourIntervalInput[];
    holidays: SupportHolidayInput[];
  };
  "save-sla-policy": {
    action: "save-sla-policy";
    productId: string;
    id?: string;
    expectedVersion?: number;
    name: string;
    status: SupportRecordStatus;
    businessHoursId?: string;
    priority?: SupportPriority;
    conditions?: SupportJsonObject;
    firstResponseMinutes: number;
    nextResponseMinutes?: number;
    resolutionMinutes: number;
    pauseStatuses: SupportTicketStatus[];
  };
  "save-escalation-rule": {
    action: "save-escalation-rule";
    productId: string;
    id?: string;
    expectedVersion?: number;
    slaPolicyId?: string;
    queueId?: string;
    name: string;
    eventType: SupportEscalationEvent;
    elapsedMinutes: number;
    level: number;
    recipientRole?: string;
    recipientQueueId?: string;
    recipientUserId?: string;
    deliveryChannels: SupportNotificationChannel[];
    message: string;
    priority: SupportPriority;
    status: SupportRecordStatus;
    order: number;
    repeatPolicy: "once" | "repeat_until_resolved";
    repeatIntervalMinutes?: number;
    notificationLimit: number;
  };
  "get-or-create-draft": { action: "get-or-create-draft"; productId: string };
  "save-automation-draft": {
    action: "save-automation-draft";
    versionId: string;
    expectedVersion: number;
    settings: SupportAutomationSettingsInput;
    options: SupportRoutingOptionInput[];
  };
  "validate-automation": { action: "validate-automation"; versionId: string };
  "publish-automation": {
    action: "publish-automation";
    versionId: string;
    expectedVersion: number;
  };
  "restore-automation-version": {
    action: "restore-automation-version";
    sourceVersionId: string;
  };
  "create-conversation": {
    action: "create-conversation";
    productId: string;
    channelId: string;
    contactPartyId: string;
    organizationPartyId?: string;
    subject?: string;
    status?: SupportConversationStatus;
    queueId?: string;
    agentUserId?: string;
    priority?: SupportPriority;
    origin?: string;
    externalIdentifier?: string;
    automationVersionId?: string;
    initialMessage?: string;
    initialSenderType?: SupportMessageSender;
  };
  "reply-conversation": {
    action: "reply-conversation";
    conversationId: string;
    expectedVersion: number;
    body: string;
    contentType?: Exclude<SupportMessageContentType, "event">;
    attachments?: SupportJsonValue[];
    idempotencyKey?: string;
  };
  "add-conversation-note": {
    action: "add-conversation-note";
    conversationId: string;
    expectedVersion: number;
    note: string;
    attachments?: SupportJsonValue[];
    idempotencyKey?: string;
  };
  "assign-conversation": {
    action: "assign-conversation";
    conversationId: string;
    expectedVersion: number;
    queueId?: string;
    agentUserId?: string;
    reason?: string;
  };
  "transition-conversation": {
    action: "transition-conversation";
    conversationId: string;
    expectedVersion: number;
    status: SupportConversationStatus;
    reason?: string;
  };
  "create-ticket": {
    action: "create-ticket";
    productId: string;
    conversationId?: string;
    contactPartyId?: string;
    organizationPartyId?: string;
    categoryId?: string;
    subcategoryId?: string;
    queueId?: string;
    agentUserId?: string;
    priority?: SupportPriority;
    title: string;
    description?: string;
    collectedData?: SupportJsonObject;
    slaPolicyId?: string;
  };
  "transition-ticket": {
    action: "transition-ticket";
    ticketId: string;
    expectedVersion: number;
  } & SupportTicketTransitionCommand;
  "process-ticket-escalations": {
    action: "process-ticket-escalations";
    ticketId: string;
    dryRun: boolean;
    confirm?: boolean;
  };
}

export interface SupportActionResponseMap {
  "list-products": SupportProductCatalogItem[];
  "get-workspace": SupportWorkspace;
  "list-inbox": SupportInboxPage;
  "get-conversation": SupportConversationDetail;
  "get-ticket": SupportTicketDetail;
  "list-automation-versions": SupportAutomationVersion[];
  "preview-automation": SupportAutomationPreview;
  "simulate-sla": SupportSlaSimulationResult;
  "save-product-settings": SupportProductSettings;
  "save-product-member": SupportProductMember;
  "save-queue": SupportQueue;
  "archive-queue": SupportQueue;
  "save-queue-members": SupportQueueMembersResult;
  "save-category": SupportCategory;
  "save-tag": SupportTag;
  "save-channel": SupportChannel;
  "save-template": SupportMessageTemplate;
  "archive-template": SupportMessageTemplate;
  "save-form": SupportFormSaveResult;
  "archive-form": SupportForm;
  "save-business-hours": SupportBusinessHoursSaveResult;
  "save-sla-policy": SupportSlaPolicy;
  "save-escalation-rule": SupportEscalationRule;
  "get-or-create-draft": SupportAutomationDraftResult;
  "save-automation-draft": SupportAutomationDraftResult;
  "validate-automation": SupportAutomationValidationResult;
  "publish-automation": SupportAutomationPublishResult;
  "restore-automation-version": SupportAutomationRestoreResult;
  "create-conversation": SupportConversationCreationResult;
  "reply-conversation": SupportConversationMessageResult;
  "add-conversation-note": SupportConversationMessageResult;
  "assign-conversation": SupportConversation;
  "transition-conversation": SupportConversation;
  "create-ticket": SupportTicket;
  "transition-ticket": SupportTicket;
  "process-ticket-escalations": SupportEscalationProcessingResult;
}

export type SupportAction = keyof SupportActionRequestMap & keyof SupportActionResponseMap;
export type SupportActionRequest<A extends SupportAction> = SupportActionRequestMap[A];
export type SupportActionResponse<A extends SupportAction> = SupportActionResponseMap[A];

export const SUPPORT_ACTIONS = [
  "list-products",
  "get-workspace",
  "list-inbox",
  "get-conversation",
  "get-ticket",
  "list-automation-versions",
  "preview-automation",
  "simulate-sla",
  "save-product-settings",
  "save-product-member",
  "save-queue",
  "archive-queue",
  "save-queue-members",
  "save-category",
  "save-tag",
  "save-channel",
  "save-template",
  "archive-template",
  "save-form",
  "archive-form",
  "save-business-hours",
  "save-sla-policy",
  "save-escalation-rule",
  "get-or-create-draft",
  "save-automation-draft",
  "validate-automation",
  "publish-automation",
  "restore-automation-version",
  "create-conversation",
  "reply-conversation",
  "add-conversation-note",
  "assign-conversation",
  "transition-conversation",
  "create-ticket",
  "transition-ticket",
  "process-ticket-escalations",
] as const satisfies readonly SupportAction[];
