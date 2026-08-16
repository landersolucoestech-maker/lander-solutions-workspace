import { createFileRoute } from "@tanstack/react-router";

import { AccountingPage } from "@/modules/finance/accounting";

export const Route = createFileRoute("/contabilidade")({
  head: () => ({
    meta: [
      { title: "Profit & Loss | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Profit & Loss por competência e unidade, com indicadores, detalhamento por conta, importação e exportação.",
      },
    ],
  }),
  component: AccountingPage,
});
