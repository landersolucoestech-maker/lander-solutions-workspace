import { createFileRoute } from "@tanstack/react-router";

import { SupportPage } from "@/modules/customer-support";

export const Route = createFileRoute("/atendimento")({
  head: () => ({
    meta: [
      { title: "Atendimento e Suporte | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Central de atendimento multiproduto com filas, conversas, tickets, automações, SLA e auditoria.",
      },
      { property: "og:title", content: "Atendimento e Suporte | Lander Solutions" },
      {
        property: "og:description",
        content:
          "Customer Operations centralizado e isolado por produto, fila e usuário autorizado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});
