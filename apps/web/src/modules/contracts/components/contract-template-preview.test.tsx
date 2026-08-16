import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContractTemplatePreview } from "./contract-template-preview";

function render(headerImageUrl?: string, footerImageUrl?: string) {
  return renderToStaticMarkup(
    <ContractTemplatePreview
      headerText="Cabeçalho {{EMPRESA.NOME}}"
      bodyText="Conteúdo {{CONTRATO.TITULO}}"
      footerText="Rodapé"
      headerImageUrl={headerImageUrl}
      footerImageUrl={footerImageUrl}
    />,
  );
}

describe("ContractTemplatePreview", () => {
  it("renders a backward-compatible template without images", () => {
    const html = render();
    expect(html).toContain("contract-template-a4-preview");
    expect(html).not.toContain("Imagem de cabeçalho do template");
    expect(html).not.toContain("Imagem de rodapé do template");
  });

  it("renders only the header image", () => {
    const html = render("https://signed.test/header.png");
    expect(html).toContain("Imagem de cabeçalho do template");
    expect(html).not.toContain("Imagem de rodapé do template");
  });

  it("renders only the footer image", () => {
    const html = render(undefined, "https://signed.test/footer.png");
    expect(html).not.toContain("Imagem de cabeçalho do template");
    expect(html).toContain("Imagem de rodapé do template");
  });

  it("renders both images and highlights placeholders", () => {
    const html = render("https://signed.test/header.png", "https://signed.test/footer.png");
    expect(html).toContain("Imagem de cabeçalho do template");
    expect(html).toContain("Imagem de rodapé do template");
    expect(html).toContain("{{EMPRESA.NOME}}");
    expect(html).toContain("{{CONTRATO.TITULO}}");
    expect(html).toContain("<mark");
  });
});
