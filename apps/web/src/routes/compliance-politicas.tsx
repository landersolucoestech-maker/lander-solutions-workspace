import { createFileRoute } from "@tanstack/react-router";

import { CompliancePoliciesPage } from "@/modules/governance/compliance";

export const Route = createFileRoute("/compliance-politicas")({
  head: () => ({
    meta: [
      { title: "Compliance e Políticas | Lander Solutions" },
      {
        name: "description",
        content:
          "Obrigações, ocorrências, evidências, dispensas e versões de políticas corporativas.",
      },
      { property: "og:title", content: "Compliance e Políticas | Lander Solutions" },
      {
        property: "og:description",
        content:
          "Controle de requisitos permanentes e suas execuções sem duplicar propriedade intelectual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompliancePoliciesPage,
});
