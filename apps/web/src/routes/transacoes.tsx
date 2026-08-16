import { createFileRoute } from "@tanstack/react-router";

import { TransactionWorkspacePage } from "@/modules/finance/transactions";

export const Route = createFileRoute("/transacoes")({
  head: () => ({
    meta: [
      { title: "Transações | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Movimentações financeiras reais por unidade de negócio, conta, categoria, status e período.",
      },
    ],
  }),
  component: TransactionWorkspacePage,
});
