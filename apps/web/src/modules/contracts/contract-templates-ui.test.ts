import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(process.cwd(), "src/modules/contracts/pages/contract-templates-page.tsx"),
  "utf8",
);
const topbar = readFileSync(join(process.cwd(), "src/app/navigation/topbar.tsx"), "utf8");
const registry = readFileSync(
  join(process.cwd(), "src/modules/contracts/contract-template-variable-registry.ts"),
  "utf8",
);

function workspaceSource() {
  return page.slice(
    page.indexOf("function TemplateWorkspaceDialog"),
    page.indexOf("function ImageField"),
  );
}

describe("contract template workspace UX", () => {
  it("keeps both actions in the shared white route header and the listing compact", () => {
    const listing = page.slice(
      page.indexOf('<div className="min-w-0 space-y-3 p-2 md:p-3">'),
      page.indexOf("<TemplateDialog"),
    );
    expect(listing).not.toContain('<Panel\n        title="Templates de contratos"');
    expect(listing).not.toContain("Novo template");
    expect(listing).not.toContain("Configurar variáveis");
    expect(listing).not.toContain("<PageHeader");
    expect(listing).not.toContain("Todas as unidades");
    expect(listing).not.toMatch(/data inicial|data final|date range|período/i);
    expect(listing).toContain('className="grid gap-2 border-b bg-muted/20 p-2');
    expect(topbar).toContain(
      'const isContractTemplates = pathname === "/configuracoes-templates-contratos"',
    );
    const headerActions = topbar.slice(
      topbar.indexOf("{isContractTemplates &&"),
      topbar.indexOf("{isContractVariables &&"),
    );
    expect(headerActions).toContain("Configurar variáveis");
    expect(headerActions).toContain("Novo template");
    expect(headerActions.indexOf("Configurar variáveis")).toBeLessThan(
      headerActions.indexOf("Novo template"),
    );
    expect(headerActions).toContain('dispatchPageEvent("contract-templates:create")');
    expect(page).toContain('window.addEventListener("contract-templates:create"');
    expect(topbar.match(/!isContractTemplates/g)).toHaveLength(2);
  });

  it("renders the requested administrative table columns and local horizontal scroll", () => {
    const listing = page.slice(
      page.indexOf('data-testid="contract-template-list-box"'),
      page.indexOf("<TemplateDialog"),
    );
    expect(listing).toContain('className="overflow-x-auto"');
    expect(listing).toContain("<table");
    for (const column of [
      "Nome",
      "Unidade de negócio",
      "Tipo contratual",
      "Situação",
      "Variáveis",
      "Atualizado em",
      "Ações",
    ]) {
      expect(listing).toContain(`>${column}</th>`);
    }
    expect(listing).not.toContain("Identidade visual</th>");
    expect(listing).not.toMatch(/<article|grid-cols-2 2xl:grid-cols-3/);
  });

  it("uses one shared workspace for create, edit and duplicate", () => {
    expect(page).toContain("<TemplateWorkspaceDialog");
    expect(page.match(/function TemplateWorkspaceDialog/g)).toHaveLength(1);
  });

  it("uses a narrower responsive workspace for create, edit and duplicate", () => {
    const workspace = workspaceSource();
    expect(workspace).toContain("max-w-[1100px]");
    expect(workspace).toContain("h-[min(88vh,860px)]");
    expect(workspace).toContain("w-[calc(100vw-1rem)]");
    expect(workspace).not.toContain("max-w-[min(98vw,1600px)]");
  });

  it("exposes only the requested business fields", () => {
    const workspace = workspaceSource();
    for (const label of [
      'label="Unidade de negócio"',
      'label="Nome do template"',
      'label="Tipo contratual"',
      'label="Situação"',
      'title="Conteúdo do contrato"',
      'title="Variáveis do documento"',
      'title="Papéis das partes"',
      'title="Papéis dos signatários"',
      'label="Imagem de cabeçalho"',
      'label="Imagem de rodapé"',
    ]) {
      expect(workspace).toContain(label);
    }
    for (const removed of [
      'label="Código"',
      'label="Descrição"',
      'label="Texto do cabeçalho"',
      'label="Base de cálculo padrão"',
      'label="Componentes incluídos"',
      'label="Componentes excluídos"',
      'label="Regra de prejuízo"',
      'label="Regra de investimento"',
      'label="Texto do rodapé"',
    ]) {
      expect(workspace).not.toContain(removed);
    }
  });

  it("uses real business units and canonical contract type options", () => {
    expect(page).toContain("queryFn: listBusinessUnits");
    expect(page).toContain('value: "service", label: "Prestação de serviço"');
    expect(page).toContain('value: "nda", label: "Confidencialidade"');
    expect(page).not.toContain("products.map");
  });

  it("keeps all row actions only inside the contextual menu in the required order", () => {
    const menu = page.slice(
      page.indexOf("<DropdownMenuContent"),
      page.indexOf("</DropdownMenuContent>") + "</DropdownMenuContent>".length,
    );
    const labels = ["Visualizar", "Editar", "Duplicar", "Excluir"];
    expect(menu).toContain("<DropdownMenuItem");
    expect(labels.map((label) => menu.indexOf(label))).toEqual(
      [...labels.map((label) => menu.indexOf(label))].sort((a, b) => a - b),
    );
    expect(menu).toContain("text-destructive");
    expect(page).not.toContain(
      '<Button\n                        size="sm"\n                        variant="outline"\n                        onClick={() => setModal({ action: "view"',
    );
  });

  it("reuses A4 preview and offers direct variable insertion", () => {
    expect(page.match(/<ContractTemplatePreview/g)?.length).toBeGreaterThanOrEqual(2);
    expect(page).toContain("insertRegistryVariable");
    expect(page).toContain("Inserir no documento");
    expect(page).toContain("CONTRACT_TEMPLATE_VARIABLE_REGISTRY.filter");
  });

  it("offers a configurable business variable library backed by the template manifest", () => {
    expect(page).toContain("Configurar variáveis");
    expect(page).toContain('data-testid="variable-catalog"');
    expect(page).toContain("Biblioteca empresarial de variáveis");
    expect(page).toContain("Adicionar ao template");
    expect(page).toContain("Inserir no conteúdo");
    for (const field of [
      "Nome amigável",
      "Chave / placeholder",
      "Grupo",
      "Origem do dado",
      "Tipo",
      "Descrição",
      "Obrigatória",
      "Ativa",
    ]) {
      expect(page).toContain(field);
    }
    expect(page).toContain("variables_manifest: variables.map(normalizeTemplateVariable)");
    expect(registry).toContain("CONTRACT_TEMPLATE_VARIABLE_REGISTRY");
    expect(registry).toContain('source: "contracts.title"');
    expect(registry).toContain('source: "business_units.name"');
  });

  it("contains no musical concepts in the business variable registry", () => {
    expect(registry).not.toMatch(
      /artista|música|obra musical|lançamento|isrc|upc|royalt|gravadora|compositor|produtor musical|fonograma|repertório|direitos musicais/i,
    );
  });
});
