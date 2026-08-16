import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const dialog = read("src/modules/contracts/dialogs/contract-details-dialog.tsx");
const api = read("src/modules/contracts/api.ts");

describe("contract details document experience", () => {
  it("provides the main business tabs and a readable overview", () => {
    for (const value of [
      "overview",
      "documents",
      "parties",
      "signatures",
      "versions",
      "history",
      "conditions",
    ]) {
      expect(dialog).toContain(`value="${value}"`);
    }
    for (const block of [
      "Identificação",
      "Vigência e renovação",
      "Condições financeiras",
      "Contraparte principal",
    ]) {
      expect(dialog).toContain(block);
    }
    const labels = [
      "Visão geral",
      "Documento",
      "Partes",
      "Assinaturas",
      "Versões",
      "Condições",
      "Histórico",
    ];
    const positions = labels.map((label) => dialog.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(dialog).not.toContain("Versão do registro");
  });

  it("renders only the selected version snapshot in the A4 document", () => {
    expect(dialog).toContain("selectedVersion?.rendered_body?.trim()");
    expect(dialog).toContain("selectedVersion?.template_body_snapshot?.trim()");
    expect(dialog).toContain("<ContractTemplatePreview");
    expect(dialog).not.toMatch(/template_body_snapshot.*contract_templates/s);
  });

  it("preserves parties, economic functions, documents and approvals", () => {
    expect(dialog).toContain("<ContractPartiesTable");
    for (const entity of [
      'entity="participant"',
      'entity="component"',
      'entity="obligation"',
      'entity="document"',
    ]) {
      expect(dialog).toContain(entity);
    }
    expect(dialog).toContain("<ApprovalTable approvals={approvals}");
  });

  it("shows version status, creation, approval and observations without exposing UUIDs", () => {
    expect(dialog).toContain("<ContractVersionsTable");
    for (const column of ["Versão", "Situação", "Criada em", "Aprovação", "Observações"]) {
      expect(dialog).toContain(column);
    }
    expect(dialog).toContain("responsibleName(directory, record.approved_by)");
    expect(dialog).not.toContain('["ID", record.id]');
  });

  it("does not simulate signatures or history", () => {
    expect(dialog).toContain("A presença nesta lista não representa assinatura concluída");
    expect(dialog).toContain("Assinatura eletrônica não configurada para esta versão");
    expect(api).toContain('.from("audit_events")');
    expect(api).toContain('.in("entity_id", entityIds)');
    expect(dialog).toContain("events={auditQuery.data ?? []}");
  });
});
