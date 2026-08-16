import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("CRM relationship consistency", () => {
  const page = read("src/modules/commercial/crm/relationship-crm-page.tsx");
  const leadDialog = read("src/modules/commercial/crm/lead-dialog.tsx");
  const contactDialog = read("src/modules/commercial/crm/contact-form-dialog.tsx");

  it("uses the canonical party category instead of cross-domain roles", () => {
    expect(page).toContain("contactCategoryLabel(party.category)");
    expect(page).toContain("party.category === category");
    expect(page).not.toContain("relationshipLabel(role.role_code)");
  });

  it("hydrates lead view and edit from the canonical directory by id", () => {
    expect(page).toContain('{ action: "view", leadId: lead.id }');
    expect(page).toContain('{ action: "edit", leadId: lead.id }');
    expect(leadDialog).toContain("directory.leads.find((lead) => lead.id === state.leadId)");
    expect(page).toContain("onEdit={(lead)");
    expect(leadDialog).toContain('["create", "edit"].includes(state.action)');
  });

  it("presents administrative contact and lead sections without technical ids", () => {
    for (const title of ["Informações principais", "Contatos", "Relacionamento", "Endereços"]) {
      expect(contactDialog).toContain(`title="${title}"`);
    }
    for (const title of ["Contato", "Comercial", "Contexto", "Diagnóstico do serviço"]) {
      expect(leadDialog).toContain(`title="${title}"`);
    }
    expect(contactDialog).not.toContain('label="ID"');
    expect(leadDialog).not.toContain('label="ID"');
  });
});
