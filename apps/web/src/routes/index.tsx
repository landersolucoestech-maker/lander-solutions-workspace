import { createFileRoute } from "@tanstack/react-router";

import { FinancialDashboardPage } from "@/modules/dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DASHBOARD | Sistema Central Lander Solutions" },
      {
        name: "description",
        content:
          "Visão consolidada dos indicadores e operações do Sistema Central Lander Solutions.",
      },
      { property: "og:title", content: "DASHBOARD | Lander Solutions" },
      {
        property: "og:description",
        content: "Visão consolidada dos indicadores e operações da organização.",
      },
    ],
  }),
  component: FinancialDashboardPage,
});
