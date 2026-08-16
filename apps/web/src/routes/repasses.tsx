import { createFileRoute } from "@tanstack/react-router";

import { PayoutsPage } from "@/modules/finance/payouts";

export const Route = createFileRoute("/repasses")({
  head: () => ({
    meta: [
      { title: "Repasses | Lander Solutions" },
      {
        name: "description",
        content: "Obrigações financeiras, pagamentos e conciliação de repasses contratuais.",
      },
    ],
  }),
  component: PayoutsPage,
});
