import { createFileRoute } from "@tanstack/react-router";

import { CorporateOwnershipPage } from "@/modules/company/corporate-ownership";

export const Route = createFileRoute("/estrutura-societaria")({
  head: () => ({
    meta: [
      { title: "Estrutura Societária | Lander Solutions" },
      {
        name: "description",
        content:
          "Capital social, quotas, sócios, administradores, documentos, deliberações e alterações societárias.",
      },
    ],
  }),
  component: CorporateOwnershipPage,
});
