import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const page = read("src/modules/contracts/pages/contract-variables-page.tsx");
const route = read("src/routes/configuracoes-variaveis-contratos.tsx");
const templates = read("src/modules/contracts/pages/contract-templates-page.tsx");
const registry = read("src/modules/contracts/contract-template-variable-registry.ts");

describe("contract variable registry page", () => {
  it("owns a dedicated administrative route and consumes the canonical registry", () => {
    expect(route).toContain('createFileRoute("/configuracoes-variaveis-contratos")');
    expect(page).toContain("CONTRACT_TEMPLATE_VARIABLE_REGISTRY.filter");
    expect(templates).toContain("CONTRACT_TEMPLATE_VARIABLE_REGISTRY.filter");
    expect(page).not.toContain("variables_manifest");
  });

  it("offers search, group filters and all details in a compact table", () => {
    expect(page).toContain("Buscar por nome, placeholder, grupo ou origem");
    expect(page).toContain("CONTRACT_TEMPLATE_VARIABLE_GROUPS");
    expect(page).toContain('className="overflow-x-auto"');
    expect(page).toContain("<table");
    for (const column of [
      "Nome",
      "Placeholder",
      "Grupo",
      "Tipo",
      "Origem dos dados",
      "Situação",
      "Obrigatória",
      "Ações",
    ]) {
      expect(page).toContain(`>${column}</th>`);
    }
    expect(page).toContain("Copiar placeholder");
    expect(page).toContain("<DropdownMenu");
    expect(page).not.toMatch(/<article|lg:grid-cols-2|2xl:grid-cols-3/);
  });

  it("does not introduce a second registry or musical concepts", () => {
    expect(page).not.toMatch(/localStorage|sessionStorage|from\("contract_variables"\)/);
    expect(`${page}\n${registry}`).not.toMatch(
      /artista|música|obra musical|lançamento|isrc|upc|royalt|gravadora|compositor|fonograma|repertório/i,
    );
  });
});
