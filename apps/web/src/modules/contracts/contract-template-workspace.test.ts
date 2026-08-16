import { describe, expect, it } from "vitest";

import {
  extractPlaceholders,
  findUnresolvedTemplatePlaceholders,
  normalizeManifest,
} from "./contract-template-workspace";

describe("contract template workspace helpers", () => {
  it("loads an old template without the new optional fields", () => {
    expect(normalizeManifest(undefined)).toEqual([]);
    expect(normalizeManifest([])).toEqual([]);
  });

  it("enriches legacy manifest entries only from the canonical registry", () => {
    expect(
      normalizeManifest([
        {
          key: " contrato.titulo ",
          label: "Título",
          type: "text",
          required: true,
          group: "Contrato",
        },
      ]),
    ).toEqual([
      {
        key: "CONTRATO.TITULO",
        label: "Título",
        type: "text",
        required: true,
        group: "Contrato",
        source: "contracts.title",
        description: "Título informado no cadastro do contrato.",
        active: true,
      },
    ]);
  });

  it("finds unique placeholders across header, body and footer", () => {
    expect(
      extractPlaceholders("{{EMPRESA.NOME}}\n{{ contrato.titulo }}\n{{EMPRESA.NOME}}"),
    ).toEqual(["CONTRATO.TITULO", "EMPRESA.NOME"]);
  });

  it("does not classify configured party and signature placeholders as unresolved variables", () => {
    const placeholders = [
      "CONTRATANTE.RAZAO_SOCIAL",
      "CONTRATO.TITULO",
      "SIGNATURE.CONTRATANTE",
      "SIGN_DATE.CONTRATANTE",
      "SEM_OWNER.CAMPO",
    ];
    expect(
      findUnresolvedTemplatePlaceholders(
        placeholders,
        new Set(["CONTRATO.TITULO"]),
        ["CONTRATANTE"],
        ["CONTRATANTE"],
      ),
    ).toEqual(["SEM_OWNER.CAMPO"]);
  });
});
