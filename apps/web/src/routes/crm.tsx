import { createFileRoute } from "@tanstack/react-router";

import { RelationshipCrmPage } from "@/modules/commercial/crm/relationship-crm-page";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "CRM — Contatos/Clientes e Leads | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "CRM centralizado com contatos, clientes e controle completo do funil de leads da Lander Solutions.",
      },
    ],
  }),
  component: RelationshipCrmPage,
});
