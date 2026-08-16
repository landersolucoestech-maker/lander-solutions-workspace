import { createFileRoute } from "@tanstack/react-router";

import { ContractVariablesPage } from "@/modules/contracts";

export const Route = createFileRoute("/configuracoes-variaveis-contratos")({
  head: () => ({
    meta: [
      { title: "Variáveis de contratos | Sistema Central Lander Solutions" },
      {
        name: "description",
        content: "Biblioteca empresarial de variáveis disponíveis para templates contratuais.",
      },
    ],
  }),
  component: ContractVariablesPage,
});
