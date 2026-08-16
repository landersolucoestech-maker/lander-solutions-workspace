import { createFileRoute } from "@tanstack/react-router";

import { ContractsPage } from "@/modules/contracts";

export const Route = createFileRoute("/contratos")({
  head: () => ({
    meta: [
      { title: "Contratos | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Contratos, versões econômicas, partes, participações, componentes, obrigações e documentos da LANDER SOLUTIONS.",
      },
      { property: "og:title", content: "Contratos | Lander Solutions" },
      {
        property: "og:description",
        content:
          "Gestão contratual versionada, auditável e vinculada às unidades e produtos da empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractsPage,
});
