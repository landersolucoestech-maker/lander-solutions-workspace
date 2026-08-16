import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  parseSupportApiEnvelope,
  SupportApiError,
  type SupportAction,
  type SupportActionRequest,
  type SupportActionResponse,
} from "./contracts";
type DistributiveOmit<T, K extends PropertyKey> = T extends object ? Omit<T, K> : never;

export type SupportInboxFilters = Omit<SupportActionRequest<"list-inbox">, "action">;

export { SupportApiError } from "./contracts";

async function invoke<A extends SupportAction>(
  request: SupportActionRequest<A>,
): Promise<SupportActionResponse<A>> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-support", { body: request });
  if (error) throw new SupportApiError(error.message, "function_error", null);
  return parseSupportApiEnvelope<A>(request.action as A, data);
}

export function listSupportProducts() {
  return invoke<"list-products">({ action: "list-products" });
}

export function getSupportWorkspace(productId: string) {
  return invoke<"get-workspace">({ action: "get-workspace", productId });
}

export function listSupportInbox(input: SupportInboxFilters) {
  return invoke<"list-inbox">({ action: "list-inbox", ...input });
}

export function getSupportConversation(conversationId: string) {
  return invoke<"get-conversation">({ action: "get-conversation", conversationId });
}

export function getSupportTicket(ticketId: string) {
  return invoke<"get-ticket">({ action: "get-ticket", ticketId });
}

export function replySupportConversation(
  input: Omit<SupportActionRequest<"reply-conversation">, "action" | "idempotencyKey">,
) {
  return invoke<"reply-conversation">({
    action: "reply-conversation",
    ...input,
    idempotencyKey: crypto.randomUUID(),
  });
}

export function addSupportConversationNote(
  input: Omit<SupportActionRequest<"add-conversation-note">, "action" | "idempotencyKey">,
) {
  return invoke<"add-conversation-note">({
    action: "add-conversation-note",
    ...input,
    idempotencyKey: crypto.randomUUID(),
  });
}

export function assignSupportConversation(
  input: Omit<SupportActionRequest<"assign-conversation">, "action">,
) {
  return invoke<"assign-conversation">({ action: "assign-conversation", ...input });
}

export function transitionSupportConversation(
  input: Omit<SupportActionRequest<"transition-conversation">, "action">,
) {
  return invoke<"transition-conversation">({ action: "transition-conversation", ...input });
}

export function createSupportTicket(input: Omit<SupportActionRequest<"create-ticket">, "action">) {
  return invoke<"create-ticket">({ action: "create-ticket", ...input });
}

export function transitionSupportTicket(
  input: DistributiveOmit<SupportActionRequest<"transition-ticket">, "action">,
) {
  return invoke<"transition-ticket">({ action: "transition-ticket", ...input });
}

export function getOrCreateSupportDraft(productId: string) {
  return invoke<"get-or-create-draft">({ action: "get-or-create-draft", productId });
}

export function validateSupportAutomation(versionId: string) {
  return invoke<"validate-automation">({ action: "validate-automation", versionId });
}

export function publishSupportAutomation(versionId: string, expectedVersion: number) {
  return invoke<"publish-automation">({ action: "publish-automation", versionId, expectedVersion });
}

export function invokeSupportAction<A extends SupportAction>(request: SupportActionRequest<A>) {
  return invoke<A>(request);
}
