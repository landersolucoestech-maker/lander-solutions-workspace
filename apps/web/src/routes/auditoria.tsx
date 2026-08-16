import { createFileRoute } from "@tanstack/react-router";

import { AuditPage } from "@/modules/audit";

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Trilha de auditoria | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Registro imutável das alterações realizadas no sistema, com ator, sessão, entidade e valores anteriores e posteriores.",
      },
      { property: "og:title", content: "Trilha de auditoria | Lander Solutions" },
      {
        property: "og:description",
        content: "Rastreabilidade completa das operações executadas no sistema corporativo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});
