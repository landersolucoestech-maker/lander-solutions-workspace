import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  aggregateFacadeViolations,
  featureRouteViolations,
  misplacedBusinessFiles,
  modulesToFeaturesViolations,
  reverseBarrelViolations,
  singleDomainSharedViolations,
  type SourceUnit,
} from "./module-boundary-rules.ts";

const root = process.cwd();
const failures: string[] = [];

async function exists(target: string): Promise<boolean> {
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

function relative(target: string): string {
  return path.relative(root, target).split(path.sep).join("/");
}

function fail(message: string): void {
  failures.push(message);
}

const routeOwnership = [
  ["apps/web/src/routes/index.tsx", "@/modules/dashboard"],
  ["apps/web/src/routes/acessos.tsx", "@/modules/access-control"],
  ["apps/web/src/routes/atendimento.tsx", "@/modules/customer-support"],
  ["apps/web/src/routes/auditoria.tsx", "@/modules/audit"],
  ["apps/web/src/routes/configuracoes/integracoes.tsx", "@/modules/settings/integrations"],
  ["apps/web/src/routes/patrimonio-licencas.tsx", "@/modules/company/assets"],
  ["apps/web/src/routes/agenda.tsx", "@/modules/scheduling/agenda"],
  ["apps/web/src/routes/contabilidade.tsx", "@/modules/finance/accounting"],
  ["apps/web/src/routes/configuracoes-servicos-leads.tsx", "@/modules/commercial/crm"],
  ["apps/web/src/routes/crm.tsx", "@/modules/commercial/crm"],
  ["apps/web/src/routes/contratos.tsx", "@/modules/contracts"],
  ["apps/web/src/routes/configuracoes-templates-contratos.tsx", "@/modules/contracts"],
  ["apps/web/src/routes/configuracoes-variaveis-contratos.tsx", "@/modules/contracts"],
  [
    "apps/web/src/routes/estrutura-organizacional.tsx",
    "@/modules/company/organizational-structure",
  ],
  ["apps/web/src/routes/unidades.tsx", "@/modules/company/organizational-structure"],
  ["apps/web/src/routes/unidades.$unitId.tsx", "@/modules/company/organizational-structure"],
  ["apps/web/src/routes/estrutura-societaria.tsx", "@/modules/company/corporate-ownership"],
  ["apps/web/src/routes/juridico.tsx", "@/modules/governance/legal"],
  ["apps/web/src/routes/compliance-politicas.tsx", "@/modules/governance/compliance"],
  ["apps/web/src/routes/propriedade-intelectual.tsx", "@/modules/governance/intellectual-property"],
  ["apps/web/src/routes/participacoes.tsx", "@/modules/finance/participations"],
  ["apps/web/src/routes/rateio.tsx", "@/modules/finance/allocations"],
  ["apps/web/src/routes/repasses.tsx", "@/modules/finance/payouts"],
  ["apps/web/src/routes/nota-fiscal.tsx", "@/modules/finance/fiscal"],
  ["apps/web/src/routes/relatorios.tsx", "@/modules/finance/reports"],
  ["apps/web/src/routes/rh.tsx", "@/modules/company/hr"],
  ["apps/web/src/routes/transacoes.tsx", "@/modules/finance/transactions"],
] as const;

for (const [route, ownerImport] of routeOwnership) {
  const target = path.join(root, route);
  if (!(await exists(target))) {
    fail(`Rota obrigatória ausente: ${route}.`);
    continue;
  }
  const content = await readFile(target, "utf8");
  if (!content.includes(ownerImport)) {
    fail(`${route} não aponta para o módulo proprietário ${ownerImport}.`);
  }
}

const legacyRedirectRoutes = [
  ["apps/web/src/routes/clientes.tsx", "/crm"],
  ["apps/web/src/routes/integracoes.tsx", "/configuracoes/integracoes"],
  ["apps/web/src/routes/estrutura.tsx", "/estrutura-organizacional"],
  ["apps/web/src/routes/ativos.tsx", "/patrimonio-licencas"],
] as const;
for (const [route, destination] of legacyRedirectRoutes) {
  const target = path.join(root, route);
  if (!(await exists(target))) {
    fail(`Redirecionamento legado ausente: ${route}.`);
    continue;
  }
  const content = await readFile(target, "utf8");
  if (!content.includes("redirect") || !content.includes(`to: "${destination}"`)) {
    fail(`${route} não redireciona para ${destination}.`);
  }
}

const requiredModuleFiles = [
  "apps/web/src/modules/access-control/pages/access-page.tsx",
  "apps/web/src/modules/customer-support/support-page.tsx",
  "apps/web/src/modules/audit/audit-page.tsx",
  "apps/web/src/modules/settings/integrations/integrations-page.tsx",
  "apps/web/src/modules/company/assets/assets-page.tsx",
  "apps/web/src/modules/finance/accounting/accounting-page.tsx",
  "apps/web/src/modules/company/organizational-structure/organizational-structure-page.tsx",
  "apps/web/src/modules/company/organizational-structure/business-units/business-units-page.tsx",
  "apps/web/src/modules/company/organizational-structure/business-units/business-unit-detail-page.tsx",
  "apps/web/src/modules/company/corporate-ownership/corporate-ownership-page.tsx",
  "apps/web/src/modules/governance/legal/legal-page.tsx",
  "apps/web/src/modules/governance/compliance/compliance-policies-page.tsx",
  "apps/web/src/modules/governance/intellectual-property/intellectual-property-page.tsx",
  "apps/web/src/modules/finance/participations/participations-page.tsx",
  "apps/web/src/modules/finance/allocations/allocation-page.tsx",
  "apps/web/src/modules/finance/payouts/payouts-page.tsx",
  "apps/web/src/modules/finance/transactions/transaction-workspace-page.tsx",
  "apps/web/src/modules/finance/transactions/transaction-editor-dialog.tsx",
  "apps/web/src/modules/finance/transactions/ofx-import-dialog.tsx",
  "apps/web/src/modules/finance/transactions/bank-operations-api.ts",
  "apps/web/src/modules/finance/transactions/bank-operations-types.ts",
  "apps/web/src/modules/finance/reports/reports-page.tsx",
  "apps/web/src/modules/finance/fiscal/fiscal-page.tsx",
  "apps/web/src/modules/commercial/crm/relationship-crm-page.tsx",
  "apps/web/src/modules/company/hr/hr-page.tsx",
];
for (const file of requiredModuleFiles) {
  if (!(await exists(path.join(root, file)))) {
    fail(`Arquivo do módulo ausente: ${file}.`);
  }
}

const forbiddenLegacyLocations = [
  "apps/web/src/features/accounting",
  "apps/web/src/features/corporate",
  "apps/web/src/features/crm",
  "apps/web/src/features/finance",
  "apps/web/src/features/financial-operations",
  "apps/web/src/features/fiscal",
  "apps/web/src/features/hr",
  "apps/web/src/features/reports",
  "apps/web/src/features/transactions",
  "apps/web/src/features/finance/transaction-workspace-page.tsx",
  "apps/web/src/features/finance/transaction-editor-dialog.tsx",
  "apps/web/src/features/finance/ofx-import-dialog.tsx",
  "apps/web/src/features/finance/bank-operations-api.ts",
  "apps/web/src/features/finance/bank-operations-types.ts",
  "apps/web/src/features/governance-registry",
  "apps/web/src/features/legal",
  "apps/web/src/features/compliance",
  "apps/web/src/features/intellectual-property",
  "apps/web/src/features/assets",
  "apps/web/src/features/allocations",
  "apps/web/src/features/payouts",
  "apps/web/src/features/organizational-structure",
  "apps/web/src/features/corporate-ownership",
  "apps/web/src/features/participations",
  "apps/web/src/features/support",
  "apps/web/src/features/audit",
  "apps/web/src/features/integrations",
  "apps/web/src/features/parties",
  "apps/web/src/features/workspace",
  "apps/web/src/features/reports/accounting-page.tsx",
  "apps/web/src/features/corporate/business-units-page.tsx",
  "apps/web/src/features/corporate/corporate-structure-page.tsx",
  "apps/web/src/features/corporate/structure-page.tsx",
  "apps/web/src/features/corporate/units-page.tsx",
  "apps/web/src/features/business-units",
  "apps/web/src/features/corporate-structure",
];
for (const file of forbiddenLegacyLocations) {
  if (await exists(path.join(root, file))) {
    fail(`Implementação permanece fora do módulo: ${file}.`);
  }
}

const routeFiles = (await walk(path.join(root, "apps", "web", "src", "routes"))).filter((file) =>
  /\.(ts|tsx)$/.test(file),
);
const forbiddenRouteMarkers = [
  "useMutation(",
  "useQuery(",
  "useState(",
  "getSupabaseBrowserClient",
  ".functions.invoke(",
  ".storage.from(",
];
for (const file of routeFiles) {
  const name = relative(file);
  if (name === "apps/web/src/routes/__root.tsx") continue;
  const content = await readFile(file, "utf8");
  const fileStat = await stat(file);
  if (fileStat.size > 6_000) {
    fail(`${name} possui ${fileStat.size} bytes; rotas devem ser adaptadores finos.`);
  }
  for (const marker of forbiddenRouteMarkers) {
    if (content.includes(marker)) {
      fail(`${name} contém lógica proibida de módulo: ${marker}.`);
    }
  }
}

const sourceFiles = (await walk(path.join(root, "apps", "web", "src"))).filter((file) =>
  /\.(ts|tsx)$/.test(file),
);
const sourceUnits: SourceUnit[] = await Promise.all(
  sourceFiles.map(async (file) => ({
    path: relative(file),
    content: await readFile(file, "utf8"),
  })),
);
for (const violation of modulesToFeaturesViolations(sourceUnits)) fail(violation);
for (const violation of featureRouteViolations(sourceUnits)) fail(violation);
for (const violation of reverseBarrelViolations(sourceUnits)) fail(violation);
for (const violation of misplacedBusinessFiles(sourceUnits)) fail(violation);
for (const violation of aggregateFacadeViolations(sourceUnits)) fail(violation);
for (const violation of singleDomainSharedViolations(sourceUnits)) fail(violation);

for (const file of sourceFiles) {
  const name = relative(file);
  const content = await readFile(file, "utf8");
  const accessesSupabase =
    content.includes("getSupabaseBrowserClient") ||
    content.includes(".functions.invoke(") ||
    /\.storage\s*\.\s*from\s*\(/s.test(content);
  if (!accessesSupabase) continue;

  const basename = path.basename(file);
  const allowedDataLayer =
    basename.endsWith(".test.ts") ||
    basename.endsWith(".test.tsx") ||
    name === "apps/web/src/lib/supabase/client.ts" ||
    name === "apps/web/src/server.ts" ||
    name === "apps/web/src/app/providers/auth-context.tsx" ||
    name === "apps/web/src/app/router/auth-gate.tsx" ||
    basename === "api.ts" ||
    basename.endsWith("-api.ts") ||
    basename.endsWith("-queries.ts") ||
    basename.endsWith("-mutations.ts") ||
    basename.endsWith(".functions.ts");
  if (!allowedDataLayer) {
    fail(`${name} acessa Supabase/storage fora da camada de dados do módulo.`);
  }
}

const functionRoot = path.join(root, "supabase", "functions");
if (await exists(functionRoot)) {
  const entries = await readdir(functionRoot, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(functionRoot, entry.name);
    if (!entry.isDirectory()) {
      fail(`Arquivo solto na raiz de Edge Functions: ${relative(target)}.`);
      continue;
    }
    if (!(await exists(path.join(target, "index.ts")))) {
      fail(`Edge Function sem index.ts: ${entry.name}.`);
    }
    if (!(await exists(path.join(target, "deno.json")))) {
      fail(`Edge Function sem deno.json: ${entry.name}.`);
    }
    const edgeIndex = path.join(target, "index.ts");
    if (await exists(edgeIndex)) {
      const edgeSource = await readFile(edgeIndex, "utf8");
      if (edgeSource.includes('"Access-Control-Allow-Origin": "*"'))
        fail(`${entry.name} mantém CORS irrestrito.`);
      if (edgeSource.includes("isDevelopmentProject") && edgeSource.includes("has_aal2"))
        fail(`${entry.name} contém bypass de MFA por ambiente.`);
      for (const code of [
        "LANDERSERVICES",
        "LANDERDISPATCH",
        "MUSICOS360",
        "VIVENDOMUSICA",
        "DICADECRIA",
        "DJSTAY-EAD",
      ]) {
        if (edgeSource.includes(`"${code}"`))
          fail(`${entry.name} contém unidade hard-coded: ${code}.`);
      }
      if (edgeSource.includes("String(document.storage_bucket"))
        fail(`${entry.name} confia em bucket vindo de metadados.`);
    }
  }
}

const authFiles = [
  "apps/web/src/app/providers/auth-context.tsx",
  "apps/web/src/app/router/auth-gate.tsx",
  "apps/web/src/config/authentication.ts",
];
for (const file of authFiles) {
  if (!(await exists(path.join(root, file)))) {
    fail(`Infraestrutura de autenticação ausente: ${file}.`);
  }
}

if (failures.length > 0) {
  console.error("Auditoria de fronteiras modulares reprovada:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Fronteiras aprovadas: ${routeOwnership.length} rotas vinculadas aos módulos proprietários, ${sourceFiles.length} arquivos TypeScript auditados e Edge Functions isoladas por pasta.`,
);
