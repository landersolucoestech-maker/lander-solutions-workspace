import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const failures: string[] = [];

async function exists(target: string) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory: string): Promise<string[]> {
  if (!(await exists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    if (entry.isFile()) files.push(target);
  }
  return files;
}

function fail(message: string) {
  failures.push(message);
}

const productionProjectRef = "giiwiwjerzavtwocxltz";
const legacyRuntimeTokens = [
  "DISPATCH-SOFTWARE",
  "DISPATCH-SERVICE",
  "TECH-SERVICES",
  "CLEANING-BPO",
];

if (await exists(path.join(root, "apps", "web", "src", "data"))) {
  fail("apps/web/src/data ainda existe; dados de demonstração não podem voltar ao runtime.");
}

const removedRouteFiles = [
  "ledger.tsx",
  "contas-a-pagar.tsx",
  "contas-a-receber.tsx",
  "categorias-financeiras.tsx",
  "centros-de-custo.tsx",
  "saas.tsx",
];
for (const file of removedRouteFiles) {
  const target = path.join(root, "apps", "web", "src", "routes", file);
  if (await exists(target)) fail(`Rota removida voltou ao runtime: apps/web/src/routes/${file}.`);
}

const requiredOperationalFiles = [
  "apps/web/src/routes/rateio.tsx",
  "apps/web/src/modules/finance/allocations/allocation-page.tsx",
  "apps/web/src/modules/finance/allocations/api.ts",
  "apps/web/src/modules/finance/allocations/types.ts",
  "apps/web/src/routes/participacoes.tsx",
  "apps/web/src/modules/finance/participations/participations-page.tsx",
  "apps/web/src/modules/finance/participations/api.ts",
  "apps/web/src/modules/finance/participations/types.ts",
  "apps/web/src/routes/estrutura-organizacional.tsx",
  "apps/web/src/modules/company/organizational-structure/organizational-structure-page.tsx",
  "apps/web/src/modules/company/organizational-structure/api.ts",
  "apps/web/src/modules/company/organizational-structure/types.ts",
  "apps/web/src/routes/estrutura-societaria.tsx",
  "apps/web/src/modules/company/corporate-ownership/corporate-ownership-page.tsx",
  "apps/web/src/modules/company/corporate-ownership/api.ts",
  "apps/web/src/modules/company/corporate-ownership/types.ts",
  "apps/web/src/routes/juridico.tsx",
  "apps/web/src/routes/compliance-politicas.tsx",
  "supabase/functions/admin-corporate-ownership/index.ts",
  "apps/web/src/routes/repasses.tsx",
  "apps/web/src/modules/finance/payouts/payouts-page.tsx",
  "apps/web/src/modules/finance/payouts/api.ts",
  "supabase/functions/admin-payouts/index.ts",
  "apps/web/src/routes/atendimento.tsx",
  "apps/web/src/modules/customer-support/support-page.tsx",
  "apps/web/src/modules/customer-support/api.ts",
  "apps/web/src/modules/customer-support/contracts.ts",
  "apps/web/src/routes/relatorios.tsx",
  "apps/web/src/modules/finance/reports/reports-page.tsx",
  "apps/web/src/routes/propriedade-intelectual.tsx",
  "apps/web/src/modules/governance/intellectual-property/intellectual-property-page.tsx",
  "apps/web/src/modules/governance/intellectual-property/api.ts",
  "apps/web/src/modules/governance/intellectual-property/types.ts",
  "supabase/functions/admin-intellectual-property/index.ts",
  "supabase/functions/admin-allocations/index.ts",
  "supabase/functions/admin-participations/index.ts",
  "supabase/migrations/20260802162644_remove_saas_and_simplify_integrations.sql",
  "supabase/migrations/20260804123237_isolate_public_development_security_definers.sql",
  "supabase/migrations/20260804135042_optimize_remaining_permissive_policies.sql",
  "supabase/migrations/20260804135559_merge_public_storage_read_policies.sql",
];
for (const relative of requiredOperationalFiles) {
  if (!(await exists(path.join(root, relative)))) {
    fail(`Arquivo operacional obrigatório ausente: ${relative}.`);
  }
}

const obsoleteArtifacts = [
  ".github/fiscal-unification-trigger",
  ".github/fiscal-unification-trigger-expanded",
  ".github/fiscal-unification-trigger-final",
  ".github/fix-reference-typecheck-trigger",
  ".github/workflows/apply-fiscal-unification-verified-once.yml",
  ".github/workflows/finalize-support-stage6.yml",
  "scripts/.fiscal-patch-exact-01.b64",
  "scripts/allocation-migration-parts",
  "scripts/finalize-operational-modules-once.sh",
  "scripts/finalize-corporate-structure-once.sh",
  "scripts/fix-corporate-narrowing.sh",
  "scripts/finalize-intellectual-property-once.sh",
  "scripts/fix-intellectual-property-option-tuples.sh",
  "scripts/fix-contract-template-memo.sh",
  "scripts/format-vite-native-path-config.sh",
  "scripts/format-vite-code-splitting.sh",
  "scripts/modernize-github-actions.sh",
  "scripts/report-migration-version-diff.sh",
  "scripts/reconcile-migration-aliases.sh",
  "scripts/harden-operational-route-audit-once.sh",
  "supabase/migrations/20260804110600_support_inbox_advanced_filters.sql",
];
for (const relative of obsoleteArtifacts) {
  if (await exists(path.join(root, relative))) {
    fail(`Artefato temporário ainda presente: ${relative}.`);
  }
}

const allocationRoutePath = path.join(root, "apps", "web", "src", "routes", "rateio.tsx");
const participationRoutePath = path.join(root, "apps", "web", "src", "routes", "participacoes.tsx");
if (await exists(allocationRoutePath)) {
  const allocationRoute = await readFile(allocationRoutePath, "utf8");
  if (!allocationRoute.includes('createFileRoute("/rateio")')) {
    fail("Rateio não expõe a rota operacional /rateio.");
  }
  if (!allocationRoute.includes("AllocationPage")) {
    fail("Rateio não está conectado ao workspace operacional.");
  }
  if (allocationRoute.includes("redirect")) {
    fail("Rateio ainda redireciona para outro módulo.");
  }
}
if (await exists(participationRoutePath)) {
  const participationRoute = await readFile(participationRoutePath, "utf8");
  if (!participationRoute.includes('createFileRoute("/participacoes")')) {
    fail("Participações e Repasses não expõe a rota /participacoes.");
  }
  if (!participationRoute.includes("ParticipationsPage")) {
    fail("Participações e Repasses não está conectado ao workspace operacional.");
  }
}

const independentRoutes = [
  {
    path: "apps/web/src/routes/estrutura-organizacional.tsx",
    route: 'createFileRoute("/estrutura-organizacional")',
    component: "OrganizationalStructurePage",
    label: "Estrutura Organizacional",
  },
  {
    path: "apps/web/src/routes/estrutura-societaria.tsx",
    route: 'createFileRoute("/estrutura-societaria")',
    component: "CorporateOwnershipPage",
    label: "Estrutura Societária",
  },
  {
    path: "apps/web/src/routes/relatorios.tsx",
    route: 'createFileRoute("/relatorios")',
    component: "ReportsPage",
    label: "Relatórios",
  },
  {
    path: "apps/web/src/routes/propriedade-intelectual.tsx",
    route: 'createFileRoute("/propriedade-intelectual")',
    component: "IntellectualPropertyPage",
    label: "Propriedade Intelectual",
  },
  {
    path: "apps/web/src/routes/repasses.tsx",
    route: 'createFileRoute("/repasses")',
    component: "PayoutsPage",
    label: "Repasses",
  },
];
for (const item of independentRoutes) {
  const target = path.join(root, item.path);
  if (!(await exists(target))) continue;
  const content = await readFile(target, "utf8");
  if (!content.includes(item.route)) fail(`${item.label} não expõe a rota própria.`);
  if (!content.includes(item.component)) fail(`${item.label} não usa o workspace operacional.`);
  if (content.includes("redirect")) fail(`${item.label} ainda redireciona para outro módulo.`);
}

const legacyOrganizationalRoutes = [
  { path: "apps/web/src/routes/estrutura.tsx", route: 'createFileRoute("/estrutura")' },
];
for (const item of legacyOrganizationalRoutes) {
  const target = path.join(root, item.path);
  if (!(await exists(target))) {
    fail(`Redirecionamento legado ausente: ${item.path}.`);
    continue;
  }
  const content = await readFile(target, "utf8");
  if (!content.includes(item.route)) fail(`${item.path} perdeu sua rota legada.`);
  if (!content.includes("redirect")) fail(`${item.path} não redireciona para o módulo canônico.`);
  if (!content.includes('to: "/estrutura-organizacional"')) {
    fail(`${item.path} redireciona para destino diferente da Estrutura Organizacional.`);
  }
}

const unitRoutes = [
  {
    path: "apps/web/src/routes/unidades.tsx",
    route: 'createFileRoute("/unidades")',
    component: "BusinessUnitsPage",
  },
  {
    path: "apps/web/src/routes/unidades.$unitId.tsx",
    route: 'createFileRoute("/unidades/$unitId")',
    component: "BusinessUnitDetailPage",
  },
];
for (const item of unitRoutes) {
  const target = path.join(root, item.path);
  if (!(await exists(target))) {
    fail(`Rota canônica de Unidades ausente: ${item.path}.`);
    continue;
  }
  const content = await readFile(target, "utf8");
  if (!content.includes(item.route)) fail(`${item.path} perdeu sua rota canônica.`);
  if (!content.includes(item.component)) fail(`${item.path} não usa o owner de Unidades.`);
  if (content.includes("redirect")) fail(`${item.path} voltou a ser um redirecionamento técnico.`);
}

const governancePagePath = path.join(
  root,
  "apps",
  "web",
  "src",
  "features",
  "legal",
  "legal-compliance-page.tsx",
);
if (await exists(governancePagePath)) {
  fail("O agregado morto legal-compliance-page.tsx ainda permanece em features/legal.");
}

const sidebarPath = path.join(root, "apps", "web", "src", "app", "navigation", "app-sidebar.tsx");
const sidebarSource = (await exists(sidebarPath)) ? await readFile(sidebarPath, "utf8") : "";
if (sidebarSource) {
  if (!sidebarSource.includes('url: "/rateio"')) {
    fail("Rateio não aparece na navegação principal.");
  }
  if (!sidebarSource.includes('url: "/participacoes"')) {
    fail("Participações Contratuais não aparece na navegação principal.");
  }
  for (const route of [
    "/repasses",
    "/estrutura-organizacional",
    "/estrutura-societaria",
    "/patrimonio-licencas",
    "/juridico",
    "/compliance-politicas",
    "/relatorios",
    "/propriedade-intelectual",
  ]) {
    if (!sidebarSource.includes(`url: "${route}"`)) {
      fail(`Rota operacional ausente da navegação principal: ${route}.`);
    }
  }
  if (sidebarSource.includes('url: "/saas"') || sidebarSource.includes("SaaS e Assinaturas")) {
    fail("SaaS central foi reintroduzido na navegação, contrariando a remoção homologada.");
  }
}

const accessPagePath = path.join(
  root,
  "apps",
  "web",
  "src",
  "features",
  "access",
  "access-page.tsx",
);
const accessApiPath = path.join(root, "apps", "web", "src", "features", "access", "api.ts");
if ((await exists(accessPagePath)) && (await exists(accessApiPath))) {
  const accessPage = await readFile(accessPagePath, "utf8");
  const accessApi = await readFile(accessApiPath, "utf8");
  const forbiddenAccessFragments = [
    "const unitOptions",
    "MUSICOS360",
    "VIVENDOMUSICA",
    "DICADECRIA",
    "DJSTAY-EAD",
    "LANDERSERVICES",
    "LANDERDISPATCH",
  ];
  for (const fragment of forbiddenAccessFragments) {
    if (accessPage.includes(fragment)) {
      fail(`Acessos contém unidade hard-coded: ${fragment}.`);
    }
  }
  if (!accessApi.includes('.from("business_units")')) {
    fail("Acessos não carrega os escopos a partir de business_units.");
  }
}

const runtimeFiles = [
  ...(await walk(path.join(root, "apps", "web", "src"))),
  ...(await walk(path.join(root, "supabase", "functions"))),
].filter((file) => /\.(ts|tsx|js|jsx|json|toml)$/.test(file));

for (const file of runtimeFiles) {
  const content = await readFile(file, "utf8");
  const relative = path.relative(root, file);
  if (content.includes(productionProjectRef)) {
    fail(`${relative} contém a referência do Supabase de produção.`);
  }
  for (const token of legacyRuntimeTokens) {
    if (content.includes(token)) fail(`${relative} contém a unidade legada ${token}.`);
  }
  const removedRouteTokens = [
    'createFileRoute("/ledger")',
    'createFileRoute("/contas-a-pagar")',
    'createFileRoute("/contas-a-receber")',
    'createFileRoute("/categorias-financeiras")',
    'createFileRoute("/centros-de-custo")',
    'createFileRoute("/saas")',
  ];
  for (const token of removedRouteTokens) {
    if (content.includes(token)) fail(`${relative} reintroduz rota removida ${token}.`);
  }
  if (/verify_jwt\s*=\s*false/i.test(content)) {
    fail(`${relative} desabilita verificação JWT.`);
  }
}

const migrationDirectory = path.join(root, "supabase", "migrations");
const migrationFiles = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql"));
const versions = new Set<string>();
for (const file of migrationFiles) {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
  if (!match) {
    fail(`Migration com nome inválido: ${file}.`);
    continue;
  }
  const version = match[1];
  if (versions.has(version)) fail(`Timestamp de migration duplicado: ${version}.`);
  versions.add(version);
}

const requiredMigrationVersions = ["20260804123237", "20260804135042", "20260804135559"];
for (const version of requiredMigrationVersions) {
  if (!versions.has(version)) {
    fail(`Migration crítica ausente do histórico local: ${version}.`);
  }
}

const migrationInvariants = [
  {
    file: "20260804123237_isolate_public_development_security_definers.sql",
    fragments: [
      "create schema if not exists development_private",
      "alter function public.has_permission(text, text) set schema development_private",
      "security invoker",
      "development_private.create_fiscal_document_bundle",
    ],
  },
  {
    file: "20260804135042_optimize_remaining_permissive_policies.sql",
    fragments: [
      "create policy bank_lines_select",
      "create policy cash_accounts_select",
      "to authenticated",
      "create policy crm_lead_diagnostics_insert",
      "create policy crm_lead_diagnostics_update",
      "create policy crm_lead_diagnostics_delete",
      "create policy crm_lead_services_insert",
      "create policy crm_lead_services_update",
      "create policy crm_lead_services_delete",
    ],
  },
  {
    file: "20260804135559_merge_public_storage_read_policies.sql",
    fragments: [
      "drop policy if exists dev_public_fiscal_pdf_select",
      "drop policy if exists dev_public_hr_documents_read",
      "create policy dev_public_document_read",
      "on storage.objects",
      "to anon",
    ],
  },
];
for (const invariant of migrationInvariants) {
  const target = path.join(migrationDirectory, invariant.file);
  if (!(await exists(target))) continue;
  const content = (await readFile(target, "utf8")).toLowerCase();
  for (const fragment of invariant.fragments) {
    if (!content.includes(fragment.toLowerCase())) {
      fail(`Migration ${invariant.file} perdeu o invariante: ${fragment}.`);
    }
  }
}

const storagePolicyMigrationPath = path.join(
  migrationDirectory,
  "20260804135559_merge_public_storage_read_policies.sql",
);
if (await exists(storagePolicyMigrationPath)) {
  const content = await readFile(storagePolicyMigrationPath, "utf8");
  const createPolicyCount = content.match(/create\s+policy/gi)?.length ?? 0;
  if (createPolicyCount !== 1) {
    fail("A consolidação de storage deve criar exatamente uma política de leitura pública.");
  }
}

const functionRoot = path.join(root, "supabase", "functions");
if (await exists(functionRoot)) {
  const functionDirectories = (await readdir(functionRoot, { withFileTypes: true })).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("admin-"),
  );
  for (const entry of functionDirectories) {
    const directory = path.join(functionRoot, entry.name);
    const indexPath = path.join(directory, "index.ts");
    const configPath = path.join(directory, "deno.json");
    if (!(await exists(indexPath))) fail(`${entry.name} não possui index.ts.`);
    if (!(await exists(configPath))) fail(`${entry.name} não possui deno.json.`);
    if (await exists(indexPath)) {
      const content = await readFile(indexPath, "utf8");
      const usesAllocationDispatcher = content.includes(
        'callerClient.rpc("run_allocation_workflow"',
      );
      if (!content.includes("Authorization")) fail(`${entry.name} não valida Authorization.`);
      if (!content.includes("has_aal2") && !usesAllocationDispatcher) {
        fail(`${entry.name} não exige MFA aal2.`);
      }
      if (!content.includes("has_permission") && !usesAllocationDispatcher) {
        fail(`${entry.name} não verifica permissão.`);
      }
      if (usesAllocationDispatcher) {
        const dispatcherMigration = await readFile(
          path.join(
            root,
            "supabase/migrations/20260805043000_caller_scoped_allocation_workflow.sql",
          ),
          "utf8",
        );
        if (!dispatcherMigration.includes("private.current_user_has_aal2()")) {
          fail("run_allocation_workflow não exige MFA aal2.");
        }
        if (
          !dispatcherMigration.includes("private.current_user_has_permission(v_permission,null)")
        ) {
          fail("run_allocation_workflow não verifica a permissão da ação.");
        }
      }
    }
  }
}

const workflowFiles = await walk(path.join(root, ".github", "workflows"));
for (const file of workflowFiles) {
  const name = path.basename(file).toLowerCase();
  if (name.includes("migration-export") || name.includes("temporary") || name.includes("once")) {
    fail(`Workflow temporário ainda presente: ${path.relative(root, file)}.`);
  }
}

const participationPayoutSeparationFiles = {
  participationPage: "apps/web/src/modules/finance/participations/participations-page.tsx",
  participationApi: "apps/web/src/modules/finance/participations/api.ts",
  payoutsPage: "apps/web/src/modules/finance/payouts/payouts-page.tsx",
  payoutsApi: "apps/web/src/modules/finance/payouts/api.ts",
  payoutsEdge: "supabase/functions/admin-payouts/index.ts",
};

const participationPageSource = await readFile(
  path.join(root, participationPayoutSeparationFiles.participationPage),
  "utf8",
);
const participationApiSource = await readFile(
  path.join(root, participationPayoutSeparationFiles.participationApi),
  "utf8",
);
const payoutsPageSource = await readFile(
  path.join(root, participationPayoutSeparationFiles.payoutsPage),
  "utf8",
);
const payoutsApiSource = await readFile(
  path.join(root, participationPayoutSeparationFiles.payoutsApi),
  "utf8",
);
const payoutsEdgeSource = await readFile(
  path.join(root, participationPayoutSeparationFiles.payoutsEdge),
  "utf8",
);

for (const forbidden of [
  "payout_obligations",
  "payout_payments",
  "createPayoutPayment",
  "postPayoutPayment",
  "listPayoutSettlements",
  "admin-payouts",
]) {
  if (participationPageSource.includes(forbidden) || participationApiSource.includes(forbidden)) {
    fail(`Participações Contratuais voltou a incorporar Repasses: ${forbidden}.`);
  }
}

if (!payoutsPageSource.includes("PayoutsPage")) {
  fail("Repasses não expõe workspace operacional próprio.");
}
if (!payoutsApiSource.includes('functions.invoke("admin-payouts"')) {
  fail("API de Repasses não utiliza o endpoint dedicado admin-payouts.");
}
if (payoutsApiSource.includes("admin-participations")) {
  fail("API de Repasses ainda depende do endpoint de Participações.");
}
if (!payoutsEdgeSource.includes('rpc("post_payout_payment"')) {
  fail("Endpoint de Repasses não utiliza a RPC caller-scoped de postagem.");
}
if (payoutsEdgeSource.includes("SUPABASE_SERVICE_ROLE_KEY")) {
  fail("Endpoint de Repasses voltou a utilizar service_role.");
}
if (!sidebarSource.includes('url: "/repasses"')) {
  fail("Sidebar não expõe a rota independente de Repasses.");
}

if (failures.length > 0) {
  console.error("Auditoria do repositório reprovada:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Auditoria aprovada: ${migrationFiles.length} migrations, ${runtimeFiles.length} arquivos de runtime e nenhum artefato proibido.`,
);
