import { createFileRoute } from "@tanstack/react-router";

import { ContractTemplatesPage } from "@/modules/contracts";

export const Route = createFileRoute("/configuracoes-templates-contratos")({
  head: () => ({
    meta: [
      { title: "Templates de contratos | Sistema Central Lander Solutions" },
      {
        name: "description",
        content: "Área restrita para configuração manual dos templates contratuais.",
      },
    ],
  }),
  component: ContractTemplatesPage,
});
