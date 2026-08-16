import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FiscalDirectory, FiscalDocument, FiscalDocumentBundleInput } from "./types";

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message);
  return data;
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_resolve, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

async function selectRows(table: string, orderColumn?: string) {
  const client = getSupabaseBrowserClient();
  let query = client.from(table).select("*");
  if (orderColumn) query = query.order(orderColumn);
  const { data, error } = await withTimeout(
    query,
    15_000,
    `Tempo limite excedido ao consultar ${table}.`,
  );
  if (error) throw new Error(`Falha ao consultar ${table}: ${error.message}`);
  return data ?? [];
}

export async function listFiscalDirectory(): Promise<FiscalDirectory> {
  const [
    fiscalDocuments,
    fiscalEvents,
    fiscalDocumentItems,
    financialDocuments,
    fiscalParties,
    fiscalPartyContacts,
    fiscalPartyAddresses,
    fiscalBusinessUnits,
    fiscalLegalEntities,
  ] = await Promise.all([
    selectRows("financial_fiscal_documents", "fiscal_number"),
    selectRows("financial_fiscal_events", "sequence_no"),
    selectRows("financial_fiscal_document_items", "sequence_no"),
    selectRows("financial_documents", "document_number"),
    selectRows("parties", "legal_name"),
    selectRows("party_contacts", "created_at"),
    selectRows("party_addresses", "created_at"),
    selectRows("business_units", "name"),
    selectRows("legal_entities", "legal_name"),
  ]);

  return {
    fiscalDocuments: fiscalDocuments as FiscalDirectory["fiscalDocuments"],
    fiscalEvents: fiscalEvents as FiscalDirectory["fiscalEvents"],
    fiscalDocumentItems: fiscalDocumentItems as FiscalDirectory["fiscalDocumentItems"],
    financialDocuments: financialDocuments.map((row) => ({
      id: String(row.id),
      document_number: String(row.document_number),
      description: String(row.description ?? ""),
      issue_date: row.issue_date ? String(row.issue_date) : undefined,
      due_date: row.due_date ? String(row.due_date) : undefined,
      competence_date: row.competence_date ? String(row.competence_date) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      party_id: row.party_id ? String(row.party_id) : undefined,
      status: String(row.status),
      original_currency_code: String(row.original_currency_code),
      original_amount: Number(row.original_amount),
      business_unit_id: String(row.business_unit_id),
      document_nature: String(row.document_nature),
      source_type: String(row.source_type),
      counterparty_account_id: String(row.counterparty_account_id),
    })),
    fiscalParties: fiscalParties.map((row) => ({
      id: String(row.id),
      legal_name: String(row.legal_name),
      trade_name: row.trade_name === null ? null : String(row.trade_name),
      tax_id: row.tax_id === null ? null : String(row.tax_id),
      status: String(row.status),
    })),
    fiscalPartyContacts: fiscalPartyContacts.map((row) => ({
      party_id: String(row.party_id),
      contact_type: String(row.contact_type),
      value: String(row.value),
      is_primary: Boolean(row.is_primary),
      status: String(row.status),
    })),
    fiscalPartyAddresses: fiscalPartyAddresses.map((row) => ({
      party_id: String(row.party_id),
      address_line_1: String(row.address_line_1),
      address_line_2: row.address_line_2 === null ? null : String(row.address_line_2),
      city: String(row.city),
      state_region: row.state_region === null ? null : String(row.state_region),
      postal_code: row.postal_code === null ? null : String(row.postal_code),
      is_primary: Boolean(row.is_primary),
      status: String(row.status),
    })),
    fiscalBusinessUnits: fiscalBusinessUnits.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      legal_entity_id: String(row.legal_entity_id),
      status: String(row.status),
    })),
    fiscalLegalEntities: fiscalLegalEntities.map((row) => ({
      id: String(row.id),
      legal_name: String(row.legal_name),
      trade_name: row.trade_name === null ? null : String(row.trade_name),
      tax_id: row.tax_id === null ? null : String(row.tax_id),
    })),
  };
}

async function deleteOne(table: string, id: string, message: string) {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.from(table).delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  requireData(data, message);
}

export async function uploadFiscalPdf(file: File): Promise<string> {
  const client = getSupabaseBrowserClient();
  const safeName = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
  const objectKey = `public-dev/${crypto.randomUUID()}-${safeName}`;
  const { error } = await client.storage
    .from("financial-fiscal-documents")
    .upload(objectKey, file, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
  return objectKey;
}

export async function createFiscalDocumentBundle(
  input: FiscalDocumentBundleInput,
): Promise<FiscalDocument> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.rpc("create_fiscal_document_bundle", {
    p_payload: input,
  });
  if (error) throw error;
  return data as FiscalDocument;
}

export const deleteFiscalDocument = (id: string) =>
  deleteOne("financial_fiscal_documents", id, "O documento fiscal não foi excluído.");
