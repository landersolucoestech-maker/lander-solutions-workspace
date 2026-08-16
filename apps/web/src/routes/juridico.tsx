import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/modules/governance/legal";

export const Route = createFileRoute("/juridico")({
  head: () => ({
    meta: [
      { title: "Jurídico | Lander Solutions" },
      {
        name: "description",
        content:
          "Análises, notificações, disputas, processos, riscos, prazos, eventos e encerramentos jurídicos.",
      },
      { property: "og:title", content: "Jurídico | Lander Solutions" },
      {
        property: "og:description",
        content:
          "Gestão de assuntos jurídicos sem duplicação de compliance ou propriedade intelectual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegalPage,
});
