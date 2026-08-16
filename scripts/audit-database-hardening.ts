import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const migrationRoot = path.join(root, "supabase", "migrations");
const failures: string[] = [];

async function exists(target: string) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function requireMigration(file: string, fragments: string[]) {
  const target = path.join(migrationRoot, file);
  if (!(await exists(target))) {
    failures.push(`Migration crítica ausente: ${file}.`);
    return;
  }

  const source = (await readFile(target, "utf8")).toLowerCase();
  for (const fragment of fragments) {
    if (!source.includes(fragment.toLowerCase())) {
      failures.push(`Migration ${file} perdeu o invariante: ${fragment}.`);
    }
  }
}

await requireMigration("20260804123237_isolate_public_development_security_definers.sql", [
  "create schema if not exists development_private",
  "security invoker",
  "development_private.create_fiscal_document_bundle",
]);

await requireMigration("20260804135042_optimize_remaining_permissive_policies.sql", [
  "create policy bank_lines_select",
  "create policy cash_accounts_select",
  "create policy crm_lead_diagnostics_insert",
  "create policy crm_lead_diagnostics_update",
  "create policy crm_lead_diagnostics_delete",
  "create policy crm_lead_services_insert",
  "create policy crm_lead_services_update",
  "create policy crm_lead_services_delete",
]);

await requireMigration("20260804135559_merge_public_storage_read_policies.sql", [
  "drop policy if exists dev_public_fiscal_pdf_select",
  "drop policy if exists dev_public_hr_documents_read",
  "create policy dev_public_document_read",
  "on storage.objects",
]);

await requireMigration("20260804172805_fix_support_inbox_filtered_cte_scope.sql", [
  "with filtered as",
  "page_rows as",
  "select count(*) from filtered",
  "from page_rows",
]);

await requireMigration("20260804173803_harden_integration_registry_authenticated_grants.sql", [
  "revoke insert, update, delete, truncate, references, trigger",
  "on table public.integration_connections",
  "grant select",
]);

await requireMigration("20260804174904_split_fiscal_item_authenticated_policies.sql", [
  "drop policy if exists fiscal_items_manage",
  "create policy fiscal_items_select",
  "create policy fiscal_items_insert",
  "create policy fiscal_items_update",
  "create policy fiscal_items_delete",
]);

await requireMigration("20260804174953_harden_fiscal_item_authenticated_grants.sql", [
  "revoke all",
  "on table public.financial_fiscal_document_items",
  "grant select, insert, update, delete",
]);

await requireMigration("20260804183943_revoke_client_table_ddl_privileges.sql", [
  "revoke truncate, references, trigger",
  "on all tables in schema public",
  "on all tables in schema private",
  "alter default privileges for role postgres in schema public",
  "alter default privileges for role postgres in schema private",
]);

await requireMigration("20260804184721_restrict_future_function_execution_defaults.sql", [
  "alter default privileges for role postgres in schema public",
  "alter default privileges for role postgres in schema private",
  "alter default privileges for role postgres in schema development_private",
  "revoke execute on functions from public",
]);

await requireMigration("20260804185320_enforce_global_function_execution_default.sql", [
  "alter default privileges for role postgres",
  "revoke execute on functions from public",
]);

await requireMigration("20260804233000_enforce_global_permission_scope.sql", [
  "create or replace function authorization_private.current_user_has_permission",
  "p_unit_code is null and ura.unit_code is null",
  "p_unit_code is not null",
  "ura.unit_code is null or ura.unit_code = p_unit_code",
]);

await requireMigration("20260804231206_harden_storage_public_read_and_client_ddl.sql", [
  "drop policy if exists dev_public_document_read",
  "create policy dev_public_document_read",
  "on storage.objects",
  "bucket_id = 'financial-fiscal-documents'",
  "name like 'public-dev/%'",
  "revoke truncate, references, trigger",
]);

const obsoleteDuplicate = path.join(
  migrationRoot,
  "20260804110600_support_inbox_advanced_filters.sql",
);
if (await exists(obsoleteDuplicate)) {
  failures.push("A migration duplicada de filtros de Atendimento foi reintroduzida.");
}

const fiscalPolicyPath = path.join(
  migrationRoot,
  "20260804174904_split_fiscal_item_authenticated_policies.sql",
);
if (await exists(fiscalPolicyPath)) {
  const source = (await readFile(fiscalPolicyPath, "utf8")).toLowerCase();
  if (source.includes("for all")) {
    failures.push("A política fiscal voltou a usar FOR ALL e reintroduz overlap de SELECT.");
  }
  const policyCount = source.match(/create\s+policy/g)?.length ?? 0;
  if (policyCount !== 4) {
    failures.push(`Esperadas quatro políticas fiscais específicas; encontradas ${policyCount}.`);
  }
}

const storagePolicyPath = path.join(
  migrationRoot,
  "20260804135559_merge_public_storage_read_policies.sql",
);
if (await exists(storagePolicyPath)) {
  const source = await readFile(storagePolicyPath, "utf8");
  const policyCount = source.match(/create\s+policy/gi)?.length ?? 0;
  if (policyCount !== 1) {
    failures.push(`A consolidação de storage deve criar uma política; encontradas ${policyCount}.`);
  }
}

const hardenedStoragePath = path.join(
  migrationRoot,
  "20260804231206_harden_storage_public_read_and_client_ddl.sql",
);
if (await exists(hardenedStoragePath)) {
  const source = (await readFile(hardenedStoragePath, "utf8")).toLowerCase();
  if (source.includes("hr-documents")) {
    failures.push("A política anônima de storage não pode expor documentos de RH.");
  }
  if (source.includes("bucket_id = any")) {
    failures.push("A política anônima de storage não pode liberar buckets inteiros.");
  }
  const policyCount = source.match(/create\s+policy/g)?.length ?? 0;
  if (policyCount !== 1) {
    failures.push(
      `A migration final de storage deve criar uma política; encontradas ${policyCount}.`,
    );
  }
}

const clientDdlPath = path.join(
  migrationRoot,
  "20260804183943_revoke_client_table_ddl_privileges.sql",
);
if (await exists(clientDdlPath)) {
  const source = (await readFile(clientDdlPath, "utf8")).toLowerCase();
  if (source.includes("revoke all")) {
    failures.push(
      "A migration de privilégios clientes não pode usar REVOKE ALL e remover o CRUD temporário da dev.",
    );
  }
  if (!source.includes("from anon, authenticated")) {
    failures.push("A migration de privilégios clientes deve atingir anon e authenticated.");
  }
}

const functionDefaultsPath = path.join(
  migrationRoot,
  "20260804184721_restrict_future_function_execution_defaults.sql",
);
if (await exists(functionDefaultsPath)) {
  const source = (await readFile(functionDefaultsPath, "utf8")).toLowerCase();
  if (source.includes("on all functions")) {
    failures.push(
      "A migration de defaults de funções não pode revogar RPCs existentes; deve alterar apenas privilégios padrão.",
    );
  }
  const defaultChangeCount = source.match(/alter\s+default\s+privileges/g)?.length ?? 0;
  if (defaultChangeCount !== 3) {
    failures.push(
      `Esperadas três alterações de defaults de funções; encontradas ${defaultChangeCount}.`,
    );
  }
}

const globalFunctionDefaultsPath = path.join(
  migrationRoot,
  "20260804185320_enforce_global_function_execution_default.sql",
);
if (await exists(globalFunctionDefaultsPath)) {
  const source = (await readFile(globalFunctionDefaultsPath, "utf8")).toLowerCase();
  if (source.includes("in schema")) {
    failures.push(
      "A restrição efetiva de EXECUTE deve ser global; REVOKE por schema não remove o default global do PostgreSQL.",
    );
  }
  if (source.match(/alter\s+default\s+privileges/g)?.length !== 1) {
    failures.push("A migration global de EXECUTE deve conter uma única alteração de default ACL.");
  }
}

if (failures.length > 0) {
  console.error("Auditoria de hardening do banco reprovada:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Auditoria de hardening do banco aprovada: cadeia final de migrations preservada.");
