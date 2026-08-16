import { createFileRoute } from "@tanstack/react-router";

import { RelationshipCrmPage } from "@/modules/commercial/crm/relationship-crm-page";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "CRM — Contatos e Leads | Sistema Central Lander Solutions" },
      {
        name: "description",
        content: "CRM centralizado com contatos de todos os relacionamentos e controle de leads.",
      },
    ],
  }),
  component: RelationshipCrmPage,
});
