import { createFileRoute } from "@tanstack/react-router";

import { OrganizationalStructurePage } from "@/modules/company/organizational-structure";

export const Route = createFileRoute("/estrutura-organizacional")({
  head: () => ({
    meta: [
      { title: "Estrutura Organizacional | Lander Solutions" },
      {
        name: "description",
        content:
          "Entidades, unidades, departamentos, cargos, produtos, serviços, projetos e centros financeiros da organização.",
      },
      { property: "og:title", content: "Estrutura Organizacional | Lander Solutions" },
      {
        property: "og:description",
        content:
          "Organização da operação interna sem confundir estrutura societária ou participações contratuais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrganizationalStructurePage,
});
