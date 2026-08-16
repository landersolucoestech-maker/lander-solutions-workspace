import { clientEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ContactFormPayload, ContactFormRecord, LeadFormPayload } from "./form-types";
import type { CrmLeadDiagnosticRequest } from "./types";

const DEVELOPMENT_PROJECT_REF = "jodzhcktrlwinywqgbab";

function usesDevelopmentRuntime() {
  return clientEnv.VITE_EXPECTED_SUPABASE_REF === DEVELOPMENT_PROJECT_REF;
}

async function invokeParties(body: Record<string, unknown>) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-parties", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as Record<string, unknown>;
}

async function invokeCrm(body: Record<string, unknown>) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.functions.invoke("admin-crm", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as Record<string, unknown>;
}

export async function getContactForm(partyId: string) {
  if (usesDevelopmentRuntime()) {
    const client = getSupabaseBrowserClient();
    const { data, error } = await client.rpc("dev_get_contact_form", { p_party_id: partyId });
    if (error) throw error;
    if (!data) throw new Error("Contato não encontrado.");
    return {
      contact: data as ContactFormRecord,
      canReadSensitive: true,
    };
  }

  const data = await invokeParties({ action: "get-contact", partyId });
  return {
    contact: data.contact as ContactFormRecord,
    canReadSensitive: Boolean(data.canReadSensitive),
  };
}

export async function saveContactForm(form: ContactFormPayload) {
  if (usesDevelopmentRuntime()) {
    const client = getSupabaseBrowserClient();
    const { data, error } = await client.rpc("dev_save_contact_form", { p_payload: form });
    if (error) throw error;
    if (!data) throw new Error("O contato não foi salvo.");
    return String(data);
  }

  const data = await invokeParties({ action: "save-contact", form });
  return String(data.partyId);
}

export async function uploadContactDocument(input: {
  partyId: string;
  documentType: string;
  file: File;
}) {
  const client = getSupabaseBrowserClient();
  const prepared = await invokeParties({
    action: "create-document-upload",
    partyId: input.partyId,
    fileName: input.file.name,
    mimeType: input.file.type,
    fileSize: input.file.size,
  });
  const bucket = String(prepared.bucket);
  const objectKey = String(prepared.objectKey);
  const token = String(prepared.token);
  const { error: uploadError } = await client.storage
    .from(bucket)
    .uploadToSignedUrl(objectKey, token, input.file, {
      contentType: input.file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;
  const registered = await invokeParties({
    action: "register-document",
    partyId: input.partyId,
    documentType: input.documentType,
    fileName: input.file.name,
    mimeType: input.file.type,
    fileSize: input.file.size,
    objectKey,
  });
  return registered.document;
}

export async function deleteContactDocument(documentId: string) {
  await invokeParties({ action: "delete-document", documentId });
}

export async function getContactDocumentUrl(documentId: string) {
  const data = await invokeParties({ action: "document-download", documentId });
  return String(data.signedUrl);
}

export async function saveLeadForm(form: LeadFormPayload) {
  const data = await invokeCrm({ action: "save-lead", form });
  return String(data.leadId);
}

export async function createLeadDiagnostic(input: {
  leadId: string;
  serviceLineId: string | null;
  deliveryMode: "internal" | "external";
  dueAt: string | null;
}) {
  const data = await invokeCrm({ action: "create-diagnostic", ...input });
  return data.diagnostic as CrmLeadDiagnosticRequest;
}
