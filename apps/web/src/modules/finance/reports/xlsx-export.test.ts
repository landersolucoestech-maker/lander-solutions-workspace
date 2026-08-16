import { describe, expect, it } from "vitest";

import { createWorkbookBlob } from "./xlsx-export";

describe("createWorkbookBlob", () => {
  it("gera um pacote XLSX válido com assinatura ZIP e arquivos OOXML", async () => {
    const blob = createWorkbookBlob(
      [
        {
          name: "Resumo",
          widths: [24, 18],
          rows: [
            ["Indicador", "Valor"],
            ["Receita", 1250.75],
            ["Ativo", true],
          ],
        },
        {
          name: "DRE",
          rows: [
            ["Conta", "Valor"],
            ["4000", 1250.75],
          ],
        },
      ],
      "2026-07-31T12:00:00.000Z",
    );

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(1000);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const binaryText = new TextDecoder("latin1").decode(bytes);
    expect(binaryText).toContain("xl/workbook.xml");
    expect(binaryText).toContain("xl/worksheets/sheet1.xml");
    expect(binaryText).toContain("[Content_Types].xml");
  });

  it("recusa um workbook sem planilhas", () => {
    expect(() => createWorkbookBlob([])).toThrow(
      "O arquivo XLSX precisa de pelo menos uma planilha.",
    );
  });
});
