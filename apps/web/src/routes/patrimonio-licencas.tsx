import { createFileRoute } from "@tanstack/react-router";

import { AssetsPage } from "@/modules/company/assets";

export const Route = createFileRoute("/patrimonio-licencas")({
  head: () => ({
    meta: [
      { title: "Patrimônio e Licenças | Lander Solutions" },
      {
        name: "description",
        content:
          "Equipamentos, software, domínios, certificados, seguros e licenças operacionais da LANDER SOLUTIONS.",
      },
      { property: "og:title", content: "Patrimônio e Licenças | Lander Solutions" },
      {
        property: "og:description",
        content:
          "Cadastro patrimonial, custódia, renovação, manutenção, transferência e baixa auditável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssetsPage,
});
